const pool = require("../config/database");
const { notifyTestAssignment } = require("../services/professionalTestNotificationService");
const VALID_TYPES = new Set(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"]);
const REVEAL = new Set(["NEVER", "AFTER_SUBMISSION", "AFTER_DEADLINE", "MANUAL"]);
const integer = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const fail = (res, code, message) => res.status(code).json({ message });
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isManager = (req) => ["ADMIN", "EDITOR"].includes(req.user.role);
const canManage = (req, test) =>
  req.user.role === "ADMIN" || Number(test.created_by) === Number(req.user.id);
async function testAccess(client, id) {
  const r = await client.query("SELECT * FROM professional_tests WHERE id=$1", [id]);
  return r.rows[0];
}
async function versionAccess(client, id) {
  const r = await client.query(
    `SELECT v.*,t.created_by,t.title,t.archived_at FROM professional_test_versions v JOIN professional_tests t ON t.id=v.test_id WHERE v.id=$1`,
    [id],
  );
  return r.rows[0];
}
async function eligible(client, versionId, userId) {
  const r = await client.query(
    `SELECT a.id FROM professional_test_assignments a WHERE a.version_id=$1 AND a.revoked_at IS NULL AND (a.available_from IS NULL OR a.available_from<=now()) AND (NOT a.block_after_expiry OR a.deadline_at IS NULL OR a.deadline_at>=now()) AND (a.target_type='ALL' OR (a.target_type='USER' AND a.user_id=$2) OR (a.target_type='GROUP' AND EXISTS(SELECT 1 FROM professional_test_group_members m WHERE m.group_id=a.group_id AND m.user_id=$2))) LIMIT 1`,
    [versionId, userId],
  );
  return !!r.rowCount;
}
async function questionList(client, versionId, includeCorrect = false) {
  const q = await client.query(
    "SELECT id,version_id,position,question_type,question_text,points" +
      (includeCorrect ? ",explanation,legal_reference" : "") +
      " FROM professional_test_questions WHERE version_id=$1 ORDER BY position",
    [versionId],
  );
  const o = await client.query(
    "SELECT id,question_id,position,option_text" +
      (includeCorrect ? ",is_correct" : "") +
      " FROM professional_test_options WHERE question_id=ANY($1::bigint[]) ORDER BY question_id,position",
    [q.rows.map((x) => x.id)],
  );
  return q.rows.map((x) => ({
    ...x,
    options: o.rows.filter((y) => String(y.question_id) === String(x.id)),
  }));
}

// Ordine reproductibilă pe durata încercării; nu modifică ID-urile sau răspunsurile.
// Folosim un hash criptografic determinist pentru a evita reordonarea la refresh.
const { createHash } = require("crypto");
const stableShuffle = (rows, attemptId, namespace) =>
  [...rows].sort((left, right) => {
    const digest = (id) =>
      createHash("sha256").update(`${namespace}:${attemptId}:${id}`).digest("hex");
    return digest(left.id).localeCompare(digest(right.id));
  });

async function orderedAttemptQuestions(client, attempt) {
  const version = await client.query(
    `SELECT shuffle_questions,shuffle_options FROM professional_test_versions WHERE id=$1`,
    [attempt.version_id],
  );
  if (!version.rowCount) throw new Error("Versiunea testului nu există.");
  const flags = version.rows[0];
  let questions = await questionList(client, attempt.version_id, false);
  if (flags.shuffle_questions) questions = stableShuffle(questions, attempt.id, "question");
  if (flags.shuffle_options) {
    questions = questions.map((q) => ({
      ...q,
      options: stableShuffle(q.options, attempt.id, `option:${q.id}`),
    }));
  }
  return questions;
}

const createTest = asyncRoute(async (req, res) => {
  const b = req.body || {};

  const title = String(b.title ?? "").trim();
  const category = String(b.category ?? "").trim();
  const description = String(b.description ?? "").trim();

  if (!title || title.length > 250) {
    return fail(res, 400, "Titlul trebuie să aibă maximum 250 de caractere.");
  }

  if (category.length > 100 || description.length > 10000) {
    return fail(res, 400, "Categoria sau descrierea este prea lungă.");
  }

  const duration = Number(b.duration_minutes ?? b.duration ?? 30);
  const maxAttempts = Number(b.max_attempts ?? b.maxAttempts ?? 1);
  const passing = Number(b.passing_percentage ?? b.passThreshold ?? 50);
  const maxGrade = Number(b.max_grade ?? b.maxGrade ?? 10);

  const grading = b.grading_mode ?? b.grading ?? "grade-percent";
  const rounding = b.rounding_mode ?? b.rounding ?? "one-decimal";

  const reveal = b.reveal_answers ?? "AFTER_DEADLINE";

  const bool = (value, fallback) => (value === undefined ? fallback : value);

  const allowRetake = bool(b.allow_retake ?? b.allowRetake, true);
  const showGrade = bool(b.show_grade ?? b.showGrade, true);
  const showExplanations = bool(b.show_explanations ?? b.showExplanations, false);
  const shuffleQuestions = bool(b.shuffle_questions ?? b.shuffleQuestions, false);
  const shuffleOptions = bool(b.shuffle_options ?? b.shuffleAnswers, false);

  if (
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 480 ||
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 100 ||
    !Number.isFinite(passing) ||
    passing < 0 ||
    passing > 100 ||
    !Number.isFinite(maxGrade) ||
    maxGrade < 1 ||
    maxGrade > 100 ||
    !["grade-percent", "grade", "percent"].includes(grading) ||
    !["one-decimal", "integer", "two-decimals"].includes(rounding) ||
    !REVEAL.has(reveal) ||
    [allowRetake, showGrade, showExplanations, shuffleQuestions, shuffleOptions].some(
      (value) => typeof value !== "boolean",
    )
  ) {
    return fail(res, 400, "Setările testului sunt invalide.");
  }

  const parseDate = (value) => {
    if (value === undefined || value === null || value === "") {
      return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error("INVALID_DATE");
    }
    return date.toISOString();
  };

  let availableFrom;
  let availableUntil;

  try {
    availableFrom = parseDate(b.available_from ?? b.availableFrom);
    availableUntil = parseDate(b.available_until ?? b.availableUntil);
  } catch {
    return fail(res, 400, "Data de disponibilitate este invalidă.");
  }

  if (availableFrom && availableUntil && new Date(availableUntil) <= new Date(availableFrom)) {
    return fail(res, 400, "Data finală trebuie să fie după data inițială.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const testResult = await client.query(
      `INSERT INTO professional_tests
       (title, category, description, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, category || null, description || null, req.user.id],
    );

    const test = testResult.rows[0];

    const versionResult = await client.query(
      `INSERT INTO professional_test_versions (
        test_id,
        version_number,
        duration_minutes,
        max_attempts,
        passing_percentage,
        reveal_answers,
        shuffle_questions,
        shuffle_options,
        available_from,
        available_until,
        max_grade,
        grading_mode,
        rounding_mode,
        allow_retake,
        show_grade,
        show_explanations
      )
      VALUES (
        $1, 1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING *`,
      [
        test.id,
        duration,
        maxAttempts,
        passing,
        reveal,
        shuffleQuestions,
        shuffleOptions,
        availableFrom,
        availableUntil,
        maxGrade,
        grading,
        rounding,
        allowRetake,
        showGrade,
        showExplanations,
      ],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Testul a fost creat cu succes.",
      test,
      version: versionResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

const listTests = asyncRoute(async (req, res) => {
  const result = await pool.query(
    `SELECT
       t.id,
       t.title,
       t.category,
       t.description,
       t.created_by,
       t.created_at,
       v.id AS version_id,
       v.version_number,
       v.status,
       v.duration_minutes,
       v.max_attempts,
       v.passing_percentage,
       v.max_grade,
       v.available_from,
       v.available_until,
       COALESCE(q.question_count, 0) AS question_count,
       COALESCE(a.attempt_count, 0) AS attempt_count,
       COALESCE(ass.assignment_count, 0) AS assignment_count,
       COALESCE(ass.recipient_count, 0) AS recipient_count,
       COALESCE(ass.recipient_count, 0) AS assignments_count
     FROM professional_tests t
     LEFT JOIN LATERAL (
       SELECT *
       FROM professional_test_versions
       WHERE test_id = t.id
       ORDER BY version_number DESC
       LIMIT 1
     ) v ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS question_count
       FROM professional_test_questions
       WHERE version_id = v.id
     ) q ON TRUE
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS attempt_count
       FROM professional_test_attempts
       WHERE version_id = v.id
     ) a ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         (SELECT COUNT(*)::int
          FROM professional_test_assignments pa
          WHERE pa.version_id = v.id
            AND pa.revoked_at IS NULL) AS assignment_count,
         (SELECT COUNT(*)::int
          FROM users u
          WHERE u.is_active = true
            AND EXISTS (
              SELECT 1
              FROM professional_test_assignments pa
              WHERE pa.version_id = v.id
                AND pa.revoked_at IS NULL
                AND (
                  pa.target_type = 'ALL'
                  OR (pa.target_type = 'USER' AND pa.user_id = u.id)
                  OR (pa.target_type = 'GROUP' AND EXISTS (
                    SELECT 1
                    FROM professional_test_group_members gm
                    WHERE gm.group_id = pa.group_id
                      AND gm.user_id = u.id
                  ))
                )
            )) AS recipient_count
     ) ass ON TRUE
     WHERE t.archived_at IS NULL
       AND (
         $1 = 'ADMIN'
         OR t.created_by = $2
       )
     ORDER BY t.created_at DESC
     LIMIT 200`,
    [req.user.role, req.user.id],
  );

  return res.json({
    tests: result.rows,
  });
});

// Citire setări versiune: acces doar administratorului sau creatorului testului.

const getVersion = asyncRoute(async (req, res) => {
  const id = integer(req.params.versionId);

  if (!id) {
    return fail(res, 400, "ID versiune invalid.");
  }

  const result = await pool.query(
    `SELECT
       v.*,
       t.title,
       t.category,
       t.description,
       t.created_by,
       t.archived_at
     FROM professional_test_versions v
     JOIN professional_tests t ON t.id = v.test_id
     WHERE v.id = $1`,
    [id],
  );

  const version = result.rows[0];

  if (!version || version.archived_at) {
    return fail(res, 404, "Versiunea nu există.");
  }

  if (!canManage(req, version)) {
    return fail(res, 403, "Acces interzis.");
  }

  return res.json({ version });
});

// Actualizare atomică a întrebării și a tuturor variantelor sale, doar în DRAFT.
const editQuestion = asyncRoute(async (req, res) => {
  const versionId = integer(req.params.versionId);
  const questionId = integer(req.params.questionId);
  const b = req.body || {};
  if (
    !versionId ||
    !questionId ||
    !VALID_TYPES.has(b.question_type) ||
    !String(b.question_text || "").trim() ||
    !Array.isArray(b.options) ||
    b.options.length < 2 ||
    b.options.length > 12
  )
    return fail(res, 400, "Întrebare invalidă.");
  const options = b.options.map((x) => ({
    text: String(x?.option_text || "").trim(),
    correct: x?.is_correct === true,
  }));
  const correct = options.filter((x) => x.correct).length;
  const points = Number(b.points ?? 1);
  if (
    options.some((x) => !x.text) ||
    correct < 1 ||
    (b.question_type !== "MULTIPLE_CHOICE" && correct !== 1) ||
    (b.question_type === "TRUE_FALSE" && options.length !== 2) ||
    !Number.isFinite(points) ||
    points <= 0 ||
    points > 1000
  )
    return fail(res, 400, "Variantele sau punctajul sunt invalide.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const vr = await c.query(
      `SELECT v.status,t.created_by,t.archived_at FROM professional_test_versions v
       JOIN professional_tests t ON t.id=v.test_id WHERE v.id=$1 FOR UPDATE OF v`,
      [versionId],
    );
    const v = vr.rows[0];
    if (!v || v.archived_at) {
      await c.query("ROLLBACK");
      return fail(res, 404, "Versiunea nu există.");
    }
    if (!canManage(req, v)) {
      await c.query("ROLLBACK");
      return fail(res, 403, "Acces interzis.");
    }
    if (v.status !== "DRAFT") {
      await c.query("ROLLBACK");
      return fail(res, 409, "Versiunea publicată nu poate fi modificată.");
    }
    const updated = await c.query(
      `UPDATE professional_test_questions SET question_type=$3,question_text=$4,
       explanation=$5,legal_reference=$6,points=$7
       WHERE id=$1 AND version_id=$2 RETURNING *`,
      [
        questionId,
        versionId,
        b.question_type,
        b.question_text.trim(),
        b.explanation || null,
        b.legal_reference || null,
        points,
      ],
    );
    if (!updated.rowCount) {
      await c.query("ROLLBACK");
      return fail(res, 404, "Întrebarea nu există.");
    }
    // Întrebările publicate nu se modifică; variantele din ciornă pot fi recreate.
    await c.query("DELETE FROM professional_test_options WHERE question_id=$1", [questionId]);
    for (let i = 0; i < options.length; i++) {
      await c.query(
        "INSERT INTO professional_test_options(question_id,position,option_text,is_correct) VALUES($1,$2,$3,$4)",
        [questionId, i + 1, options[i].text, options[i].correct],
      );
    }
    await c.query("COMMIT");
    res.json({ question: updated.rows[0] });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});

const deleteQuestion = asyncRoute(async (req, res) => {
  const versionId = integer(req.params.versionId);
  const questionId = integer(req.params.questionId);
  if (!versionId || !questionId) return fail(res, 400, "ID invalid.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const vr = await c.query(
      `SELECT v.status,t.created_by,t.archived_at FROM professional_test_versions v
       JOIN professional_tests t ON t.id=v.test_id WHERE v.id=$1 FOR UPDATE OF v`,
      [versionId],
    );
    const v = vr.rows[0];
    if (!v || v.archived_at) {
      await c.query("ROLLBACK");
      return fail(res, 404, "Versiunea nu există.");
    }
    if (!canManage(req, v)) {
      await c.query("ROLLBACK");
      return fail(res, 403, "Acces interzis.");
    }
    if (v.status !== "DRAFT") {
      await c.query("ROLLBACK");
      return fail(res, 409, "Versiunea publicată nu poate fi modificată.");
    }
    const q = await c.query(
      "SELECT id FROM professional_test_questions WHERE id=$1 AND version_id=$2",
      [questionId, versionId],
    );
    if (!q.rowCount) {
      await c.query("ROLLBACK");
      return fail(res, 404, "Întrebarea nu există.");
    }
    await c.query("DELETE FROM professional_test_options WHERE question_id=$1", [questionId]);
    await c.query("DELETE FROM professional_test_questions WHERE id=$1 AND version_id=$2", [
      questionId,
      versionId,
    ]);
    await c.query("COMMIT");
    res.json({ deleted: true });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});

const updateDraft = asyncRoute(async (req, res) => {
  const id = integer(req.params.versionId);
  if (!id) return fail(res, 400, "ID invalid.");

  const b = req.body || {};
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `SELECT v.*, t.created_by, t.archived_at
       FROM professional_test_versions v
       JOIN professional_tests t ON t.id = v.test_id
       WHERE v.id = $1
       FOR UPDATE OF v`,
      [id],
    );

    const v = result.rows[0];

    if (!v || v.archived_at) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Versiunea nu există.");
    }

    if (!canManage(req, v)) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Acces interzis.");
    }

    if (v.status !== "DRAFT") {
      await client.query("ROLLBACK");
      return fail(res, 409, "Versiunea publicată nu poate fi modificată.");
    }

    const value = (snake, camel, fallback) => b[snake] ?? b[camel] ?? fallback;

    const duration = Number(value("duration_minutes", "duration", v.duration_minutes));

    const maxAttempts = Number(value("max_attempts", "maxAttempts", v.max_attempts));

    const passing = Number(value("passing_percentage", "passThreshold", v.passing_percentage));

    const maxGrade = Number(value("max_grade", "maxGrade", v.max_grade));

    const grading = value("grading_mode", "grading", v.grading_mode);

    const rounding = value("rounding_mode", "rounding", v.rounding_mode);

    const reveal = b.reveal_answers ?? v.reveal_answers;

    const bool = (snake, camel, fallback) => {
      const x = value(snake, camel, fallback);
      return typeof x === "boolean" ? x : null;
    };

    const allowRetake = bool("allow_retake", "allowRetake", v.allow_retake);
    const showGrade = bool("show_grade", "showGrade", v.show_grade);
    const showExplanations = bool("show_explanations", "showExplanations", v.show_explanations);
    const shuffleQuestions = bool("shuffle_questions", "shuffleQuestions", v.shuffle_questions);
    const shuffleOptions = bool("shuffle_options", "shuffleAnswers", v.shuffle_options);

    if (
      !Number.isInteger(duration) ||
      duration < 1 ||
      duration > 480 ||
      !Number.isInteger(maxAttempts) ||
      maxAttempts < 1 ||
      maxAttempts > 100 ||
      !Number.isFinite(passing) ||
      passing < 0 ||
      passing > 100 ||
      !Number.isFinite(maxGrade) ||
      maxGrade < 1 ||
      maxGrade > 100 ||
      !["grade-percent", "grade", "percent"].includes(grading) ||
      !["one-decimal", "integer", "two-decimals"].includes(rounding) ||
      !REVEAL.has(reveal) ||
      [allowRetake, showGrade, showExplanations, shuffleQuestions, shuffleOptions].some(
        (x) => x === null,
      )
    ) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Setările testului sunt invalide.");
    }

    const parseDate = (raw) => {
      if (raw === null || raw === "") return null;
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        throw new Error("INVALID_DATE");
      }
      return date.toISOString();
    };

    let availableFrom;
    let availableUntil;

    try {
      availableFrom = parseDate(value("available_from", "availableFrom", v.available_from));
      availableUntil = parseDate(value("available_until", "availableUntil", v.available_until));
    } catch {
      await client.query("ROLLBACK");
      return fail(res, 400, "Data de disponibilitate este invalidă.");
    }

    if (availableFrom && availableUntil && new Date(availableUntil) <= new Date(availableFrom)) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Data finală trebuie să fie după data inițială.");
    }

    const updated = await client.query(
      `UPDATE professional_test_versions
       SET duration_minutes = $2,
           max_attempts = $3,
           passing_percentage = $4,
           reveal_answers = $5,
           shuffle_questions = $6,
           shuffle_options = $7,
           available_from = $8,
           available_until = $9,
           max_grade = $10,
           grading_mode = $11,
           rounding_mode = $12,
           allow_retake = $13,
           show_grade = $14,
           show_explanations = $15,
           updated_at = NOW()
       WHERE id = $1 AND status = 'DRAFT'
       RETURNING *`,
      [
        id,
        duration,
        maxAttempts,
        passing,
        reveal,
        shuffleQuestions,
        shuffleOptions,
        availableFrom,
        availableUntil,
        maxGrade,
        grading,
        rounding,
        allowRetake,
        showGrade,
        showExplanations,
      ],
    );

    if (!updated.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 409, "Ciorna nu mai poate fi modificată.");
    }

    // Actualizăm și informațiile generale ale testului.
    // Câmpurile neincluse în cerere își păstrează valorile.

    const title = b.title === undefined ? undefined : String(b.title).trim();

    const category = b.category === undefined ? undefined : String(b.category ?? "").trim();

    const description =
      b.description === undefined ? undefined : String(b.description ?? "").trim();

    if (
      (title !== undefined && (title.length === 0 || title.length > 250)) ||
      (category !== undefined && category.length > 100) ||
      (description !== undefined && description.length > 10000)
    ) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Titlul, categoria sau descrierea este invalidă.");
    }

    const testResult = await client.query(
      `UPDATE professional_tests
       SET title = COALESCE($2, title),
           category = CASE
             WHEN $3::boolean THEN $4
             ELSE category
           END,
           description = CASE
             WHEN $5::boolean THEN $6
             ELSE description
           END
       WHERE id = $1
       RETURNING *`,
      [
        v.test_id,
        title ?? null,
        category !== undefined,
        category === "" ? null : category,
        description !== undefined,
        description === "" ? null : description,
      ],
    );

    if (!testResult.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Testul nu există.");
    }

    await client.query("COMMIT");

    return res.json({
      message: "Ciorna a fost salvată cu succes.",
      test: testResult.rows[0],
      version: updated.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

const saveQuestion = asyncRoute(async (req, res) => {
  const versionId = integer(req.params.versionId),
    b = req.body;
  if (
    !versionId ||
    !VALID_TYPES.has(b.question_type) ||
    !String(b.question_text || "").trim() ||
    !Array.isArray(b.options) ||
    b.options.length < 2 ||
    b.options.length > 12
  )
    return fail(res, 400, "Întrebare invalidă.");
  const options = b.options.map((x) => ({
    text: String(x.option_text || "").trim(),
    correct: x.is_correct === true,
  }));
  const count = options.filter((x) => x.correct).length;
  if (
    options.some((x) => !x.text) ||
    count < 1 ||
    (b.question_type !== "MULTIPLE_CHOICE" && count !== 1) ||
    (b.question_type === "TRUE_FALSE" && options.length !== 2)
  )
    return fail(res, 400, "Variantele sau răspunsurile corecte sunt invalide.");
  const points = Number(b.points ?? 1);
  if (!Number.isFinite(points) || points <= 0 || points > 1000)
    return fail(res, 400, "Punctaj invalid.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const v = await client.query(
      `SELECT v.*,t.created_by FROM professional_test_versions v JOIN professional_tests t ON t.id=v.test_id WHERE v.id=$1 FOR UPDATE OF v`,
      [versionId],
    );
    if (!v.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Versiunea nu există.");
    }
    if (!canManage(req, v.rows[0])) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Acces interzis.");
    }
    if (v.rows[0].status !== "DRAFT") {
      await client.query("ROLLBACK");
      return fail(res, 409, "Versiune blocată.");
    }
    const pos = await client.query(
      "SELECT COALESCE(MAX(position),0)+1 AS n FROM professional_test_questions WHERE version_id=$1",
      [versionId],
    );
    const q = await client.query(
      `INSERT INTO professional_test_questions(version_id,position,question_type,question_text,explanation,legal_reference,points) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        versionId,
        pos.rows[0].n,
        b.question_type,
        b.question_text.trim(),
        b.explanation || null,
        b.legal_reference || null,
        points,
      ],
    );
    for (let i = 0; i < options.length; i++)
      await client.query(
        "INSERT INTO professional_test_options(question_id,position,option_text,is_correct) VALUES($1,$2,$3,$4)",
        [q.rows[0].id, i + 1, options[i].text, options[i].correct],
      );
    await client.query("COMMIT");
    res.status(201).json({ question: q.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

const duplicateQuestion = asyncRoute(async (req, res) => {
  const versionId = integer(req.params.versionId);
  const questionId = integer(req.params.questionId);

  if (!versionId || !questionId) {
    return fail(res, 400, "ID invalid.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const versionResult = await client.query(
      `SELECT v.status, t.created_by, t.archived_at
       FROM professional_test_versions v
       JOIN professional_tests t ON t.id = v.test_id
       WHERE v.id = $1
       FOR UPDATE OF v`,
      [versionId],
    );

    const version = versionResult.rows[0];

    if (!version || version.archived_at) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Versiunea nu există.");
    }

    if (!canManage(req, version)) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Acces interzis.");
    }

    if (version.status !== "DRAFT") {
      await client.query("ROLLBACK");
      return fail(res, 409, "Doar întrebările din ciornă pot fi duplicate.");
    }

    const originalResult = await client.query(
      `SELECT *
       FROM professional_test_questions
       WHERE id = $1 AND version_id = $2`,
      [questionId, versionId],
    );

    const original = originalResult.rows[0];

    if (!original) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Întrebarea nu există.");
    }

    const positionResult = await client.query(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next_position
       FROM professional_test_questions
       WHERE version_id = $1`,
      [versionId],
    );

    const nextPosition = Number(positionResult.rows[0].next_position);

    const duplicatedResult = await client.query(
      `INSERT INTO professional_test_questions (
        version_id,
        position,
        question_type,
        question_text,
        explanation,
        legal_reference,
        points
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        versionId,
        nextPosition,
        original.question_type,
        original.question_text,
        original.explanation,
        original.legal_reference,
        original.points,
      ],
    );

    const duplicated = duplicatedResult.rows[0];

    await client.query(
      `INSERT INTO professional_test_options (
        question_id,
        position,
        option_text,
        is_correct
      )
      SELECT
        $1,
        position,
        option_text,
        is_correct
      FROM professional_test_options
      WHERE question_id = $2
      ORDER BY position`,
      [duplicated.id, questionId],
    );

    const optionsResult = await client.query(
      `SELECT *
       FROM professional_test_options
       WHERE question_id = $1
       ORDER BY position`,
      [duplicated.id],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "Întrebarea a fost duplicată.",
      question: {
        ...duplicated,
        options: optionsResult.rows,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

const getQuestions = asyncRoute(async (req, res) => {
  const id = integer(req.params.versionId);
  if (!id) return fail(res, 400, "ID invalid.");
  const v = await versionAccess(pool, id);
  if (!v) return fail(res, 404, "Versiunea nu există.");
  if (!canManage(req, v)) return fail(res, 403, "Acces interzis.");
  res.json({ questions: await questionList(pool, id, true) });
});
const publish = asyncRoute(async (req, res) => {
  const id = integer(req.params.versionId);
  if (!id) return fail(res, 400, "ID invalid.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      `SELECT v.*,t.created_by FROM professional_test_versions v JOIN professional_tests t ON t.id=v.test_id WHERE v.id=$1 FOR UPDATE OF v`,
      [id],
    );
    const v = r.rows[0];
    if (!v) {
      await c.query("ROLLBACK");
      return fail(res, 404, "Versiunea nu există.");
    }
    if (!canManage(req, v)) {
      await c.query("ROLLBACK");
      return fail(res, 403, "Acces interzis.");
    }
    if (v.status !== "DRAFT") {
      await c.query("ROLLBACK");
      return fail(res, 409, "Versiunea nu este ciornă.");
    }
    const invalid = await c.query(
      `SELECT q.id FROM professional_test_questions q LEFT JOIN professional_test_options o ON o.question_id=q.id WHERE q.version_id=$1 GROUP BY q.id,q.question_type HAVING COUNT(o.id)<2 OR SUM(CASE WHEN o.is_correct THEN 1 ELSE 0 END)<1 OR (q.question_type IN ('SINGLE_CHOICE','TRUE_FALSE') AND SUM(CASE WHEN o.is_correct THEN 1 ELSE 0 END)<>1) OR (q.question_type='TRUE_FALSE' AND COUNT(o.id)<>2)`,
      [id],
    );
    const cnt = await c.query(
      "SELECT COUNT(*)::int AS n FROM professional_test_questions WHERE version_id=$1",
      [id],
    );
    if (invalid.rowCount || !cnt.rows[0].n) {
      await c.query("ROLLBACK");
      return fail(res, 400, "Testul trebuie să conțină întrebări valide.");
    }
    await c.query(
      `UPDATE professional_test_versions SET status='PUBLISHED',published_at=now(),updated_at=now() WHERE id=$1`,
      [id],
    );
    await c.query("COMMIT");
    res.json({ message: "Versiune publicată." });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
const newVersion = asyncRoute(async (req, res) => {
  const testId = integer(req.params.testId);
  if (!testId) return fail(res, 400, "ID invalid.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const t = await c.query("SELECT * FROM professional_tests WHERE id=$1 FOR UPDATE", [testId]);
    if (!t.rowCount) {
      await c.query("ROLLBACK");
      return fail(res, 404, "Test inexistent.");
    }
    if (!canManage(req, t.rows[0])) {
      await c.query("ROLLBACK");
      return fail(res, 403, "Acces interzis.");
    }
    const old = await c.query(
      "SELECT * FROM professional_test_versions WHERE test_id=$1 ORDER BY version_number DESC LIMIT 1",
      [testId],
    );
    if (!old.rowCount || old.rows[0].status === "DRAFT") {
      await c.query("ROLLBACK");
      return fail(res, 409, "Există deja o ciornă sau lipsește versiunea inițială.");
    }
    const v = old.rows[0];
    const n = await c.query(
      `INSERT INTO professional_test_versions(
         test_id,version_number,duration_minutes,max_attempts,passing_percentage,
         reveal_answers,shuffle_questions,shuffle_options,available_from,available_until,
         max_grade,grading_mode,rounding_mode,allow_retake,show_grade,show_explanations
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [
        testId,
        v.version_number + 1,
        v.duration_minutes,
        v.max_attempts,
        v.passing_percentage,
        v.reveal_answers,
        v.shuffle_questions,
        v.shuffle_options,
        v.available_from,
        v.available_until,
        v.max_grade,
        v.grading_mode,
        v.rounding_mode,
        v.allow_retake,
        v.show_grade,
        v.show_explanations,
      ],
    );
    const qs = await questionList(c, v.id, true);
    for (const q of qs) {
      const x = await c.query(
        `INSERT INTO professional_test_questions(version_id,position,question_type,question_text,explanation,legal_reference,points) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          n.rows[0].id,
          q.position,
          q.question_type,
          q.question_text,
          q.explanation,
          q.legal_reference,
          q.points,
        ],
      );
      for (const o of q.options)
        await c.query(
          "INSERT INTO professional_test_options(question_id,position,option_text,is_correct) VALUES($1,$2,$3,$4)",
          [x.rows[0].id, o.position, o.option_text, o.is_correct],
        );
    }
    await c.query("COMMIT");
    res.status(201).json({ version: n.rows[0] });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
const eligibleUsers = asyncRoute(async (req, res) => {
  const r = await pool.query(
    "SELECT id,full_name,username FROM users WHERE is_active=true ORDER BY full_name LIMIT 1000",
  );
  res.json({ users: r.rows });
});
const assign = asyncRoute(async (req, res) => {
  const id = integer(req.params.versionId),
    type = req.body.target_type,
    userId = integer(req.body.user_id),
    groupId = integer(req.body.group_id);
  if (
    !id ||
    !["USER", "GROUP", "ALL"].includes(type) ||
    (type === "USER" && !userId) ||
    (type === "GROUP" && !groupId)
  )
    return fail(res, 400, "Atribuire invalidă.");
  const v = await versionAccess(pool, id);
  if (!v) return fail(res, 404, "Versiune inexistentă.");
  if (!canManage(req, v)) return fail(res, 403, "Acces interzis.");
  if (v.status !== "PUBLISHED")
    return fail(res, 409, "Doar versiunile publicate pot fi atribuite.");
  const options = {
    notify_on_assignment: req.body.notify_on_assignment !== false,
    send_reminder: req.body.send_reminder === true,
    reminder_hours: Number(req.body.reminder_hours ?? 24),
    block_after_expiry: req.body.block_after_expiry !== false,
    allow_retake: req.body.allow_retake !== false,
    show_in_assigned_tests: req.body.show_in_assigned_tests !== false,
  };
  if (
    ![24, 48, 72].includes(options.reminder_hours) ||
    Object.entries(options).some(
      ([key, value]) => key !== "reminder_hours" && typeof value !== "boolean",
    )
  )
    return fail(res, 400, "Opțiuni de atribuire invalide.");
  const from = req.body.available_from ? new Date(req.body.available_from) : null;
  const until = req.body.deadline_at ? new Date(req.body.deadline_at) : null;
  if (
    !from ||
    !until ||
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(until.getTime()) ||
    until <= from
  )
    return fail(res, 400, "Perioada atribuirii este invalidă.");
  const target = type === "USER" ? userId : null,
    group = type === "GROUP" ? groupId : null;
  if (type === "USER") {
    const u = await pool.query("SELECT id FROM users WHERE id=$1 AND is_active=true", [userId]);
    if (!u.rowCount) return fail(res, 400, "Utilizator inactiv sau inexistent.");
  }
  if (type === "GROUP") {
    const g = await pool.query(
      `
      SELECT g.id, EXISTS (
        SELECT 1 FROM professional_test_group_members gm
        JOIN users u ON u.id=gm.user_id AND u.is_active=true
        WHERE gm.group_id=g.id
      ) AS has_active_members
      FROM professional_test_groups g WHERE g.id=$1
    `,
      [groupId],
    );
    if (!g.rowCount) return fail(res, 400, "Grup inexistent.");
    if (!g.rows[0].has_active_members) return fail(res, 400, "Grupul nu are membri activi.");
  }
  try {
    const r = await pool.query(
      `INSERT INTO professional_test_assignments(
        version_id,target_type,user_id,group_id,assigned_by,available_from,deadline_at,
        notify_on_assignment,send_reminder,reminder_hours,block_after_expiry,allow_retake,show_in_assigned_tests
      ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        id,
        type,
        target,
        group,
        req.user.id,
        from.toISOString(),
        until.toISOString(),
        options.notify_on_assignment,
        options.send_reminder,
        options.reminder_hours,
        options.block_after_expiry,
        options.allow_retake,
        options.show_in_assigned_tests,
      ],
    );
    // Atribuirea a fost salvată. Eșecul notificării nu anulează atribuirea.
    try {
      if (options.notify_on_assignment)
        await notifyTestAssignment({
          assignmentId: r.rows[0].id,
          versionId: id,
          testTitle: v.title,
        });
    } catch (notificationError) {
      console.error("TEST ASSIGNMENT NOTIFICATION ERROR:", notificationError);
    }
    res.status(201).json({ assignment: r.rows[0] });
  } catch (e) {
    if (e.code === "23505") return fail(res, 409, "Atribuirea există deja.");
    if (e.code === "23514") return fail(res, 400, "Interval de atribuire invalid.");
    throw e;
  }
});
const listAssigned = asyncRoute(async (req, res) => {
  const r = await pool.query(
    `SELECT DISTINCT v.id AS version_id,t.title,v.version_number,v.duration_minutes,v.max_attempts,v.available_until FROM professional_test_versions v JOIN professional_tests t ON t.id=v.test_id JOIN professional_test_assignments a ON a.version_id=v.id WHERE v.status='PUBLISHED' AND t.archived_at IS NULL AND a.revoked_at IS NULL AND (a.available_from IS NULL OR a.available_from<=now()) AND (NOT a.block_after_expiry OR a.deadline_at IS NULL OR a.deadline_at>=now()) AND a.show_in_assigned_tests AND (v.available_from IS NULL OR v.available_from<=now()) AND (v.available_until IS NULL OR v.available_until>=now()) AND (a.target_type='ALL' OR (a.target_type='USER' AND a.user_id=$1) OR (a.target_type='GROUP' AND EXISTS(SELECT 1 FROM professional_test_group_members m WHERE m.group_id=a.group_id AND m.user_id=$1))) ORDER BY t.title LIMIT 200`,
    [req.user.id],
  );
  res.json({ tests: r.rows });
});
const startAttempt = asyncRoute(async (req, res) => {
  const id = integer(req.params.versionId);
  if (!id) return fail(res, 400, "ID invalid.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const v = await versionAccess(c, id);
    if (!v || v.status !== "PUBLISHED" || v.archived_at) {
      await c.query("ROLLBACK");
      return fail(res, 404, "Test indisponibil.");
    }
    if (
      (v.available_from && new Date(v.available_from) > new Date()) ||
      (v.available_until && new Date(v.available_until) < new Date()) ||
      !(await eligible(c, id, req.user.id))
    ) {
      await c.query("ROLLBACK");
      return fail(res, 403, "Testul nu este disponibil pentru tine.");
    }
    await c.query("SELECT pg_advisory_xact_lock($1,$2)", [id % 2147483647, req.user.id]);
    const active = await c.query(
      `SELECT * FROM professional_test_attempts WHERE version_id=$1 AND user_id_snapshot=$2 AND status='IN_PROGRESS' FOR UPDATE`,
      [id, req.user.id],
    );
    if (active.rowCount) {
      if (new Date(active.rows[0].expires_at) > new Date()) {
        await c.query("COMMIT");
        return res.json({ attempt: active.rows[0], resumed: true });
      }
      await finalize(c, active.rows[0], "EXPIRED");
    }
    const count = await c.query(
      "SELECT COUNT(*)::int AS n FROM professional_test_attempts WHERE version_id=$1 AND user_id_snapshot=$2",
      [id, req.user.id],
    );
    const retakePolicy = await c.query(
      `
      SELECT COALESCE(bool_or(a.allow_retake), false) AS allowed
      FROM professional_test_assignments a
      WHERE a.version_id=$1 AND a.revoked_at IS NULL
        AND (a.available_from IS NULL OR a.available_from<=now())
        AND (NOT a.block_after_expiry OR a.deadline_at IS NULL OR a.deadline_at>=now())
        AND (a.target_type='ALL' OR (a.target_type='USER' AND a.user_id=$2)
          OR (a.target_type='GROUP' AND EXISTS (
            SELECT 1 FROM professional_test_group_members gm
            WHERE gm.group_id=a.group_id AND gm.user_id=$2)))
    `,
      [id, req.user.id],
    );
    if (count.rows[0].n > 0 && (v.allow_retake === false || !retakePolicy.rows[0].allowed)) {
      await c.query("COMMIT");
      return fail(res, 409, "Reluarea acestui test nu este permisă.");
    }
    if (count.rows[0].n >= v.max_attempts) {
      // Păstrăm finalizarea încercării expirate efectuată mai sus.
      await c.query("COMMIT");
      return fail(res, 409, "Numărul maxim de încercări a fost atins.");
    }
    const r = await c.query(
      `INSERT INTO professional_test_attempts(version_id,user_id,user_id_snapshot,user_name_snapshot,attempt_number,expires_at) VALUES($1,$2,$2,$3,$4,LEAST(now()+($5::int * interval '1 minute'), COALESCE((SELECT MIN(a.deadline_at) FROM professional_test_assignments a WHERE a.version_id=$1 AND a.revoked_at IS NULL AND a.block_after_expiry AND a.deadline_at IS NOT NULL AND (a.target_type='ALL' OR (a.target_type='USER' AND a.user_id=$2) OR (a.target_type='GROUP' AND EXISTS(SELECT 1 FROM professional_test_group_members gm WHERE gm.group_id=a.group_id AND gm.user_id=$2)))), 'infinity'::timestamptz))) RETURNING *`,
      [
        id,
        req.user.id,
        req.user.fullName || req.user.username,
        count.rows[0].n + 1,
        v.duration_minutes,
      ],
    );
    await c.query("COMMIT");
    res.status(201).json({ attempt: r.rows[0], resumed: false });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
async function finalize(c, a, status) {
  const qs = await c.query(
    "SELECT id,points FROM professional_test_questions WHERE version_id=$1",
    [a.version_id],
  );
  const total = qs.rows.reduce((s, q) => s + Number(q.points), 0);
  let earned = 0;
  for (const q of qs.rows) {
    const o = await c.query(
      "SELECT id,is_correct FROM professional_test_options WHERE question_id=$1",
      [q.id],
    );
    const correct = o.rows
      .filter((x) => x.is_correct)
      .map((x) => String(x.id))
      .sort();
    const ans = await c.query(
      "SELECT id,selected_option_ids FROM professional_test_attempt_answers WHERE attempt_id=$1 AND question_id=$2",
      [a.id, q.id],
    );
    const selected = (ans.rows[0]?.selected_option_ids || []).map(String).sort();
    const good = correct.length === selected.length && correct.every((x, i) => x === selected[i]);
    const pts = good ? Number(q.points) : 0;
    earned += pts;
    if (ans.rowCount)
      await c.query(
        "UPDATE professional_test_attempt_answers SET is_correct=$2,awarded_points=$3 WHERE id=$1",
        [ans.rows[0].id, good, pts],
      );
  }
  const pct = total ? Math.round((earned / total) * 10000) / 100 : 0;
  // Procentul rămâne independent de modul de afișare a notei.
  // Scara de notare pornește de la 1 și ajunge la max_grade la 100%.
  const v = await c.query(
    `SELECT passing_percentage, max_grade, grading_mode, rounding_mode
     FROM professional_test_versions WHERE id=$1`,
    [a.version_id],
  );
  if (!v.rowCount) throw new Error("Versiunea testului nu există.");
  const settings = v.rows[0];
  const maxGrade = Number(settings.max_grade);
  if (!Number.isFinite(maxGrade) || maxGrade < 1 || maxGrade > 100) {
    throw new Error("Nota maximă configurată este invalidă.");
  }
  const decimals = {
    integer: 0,
    "one-decimal": 1,
    "two-decimals": 2,
  }[settings.rounding_mode];
  if (decimals === undefined) throw new Error("Regula de rotunjire este invalidă.");
  // grading_mode determină prezentarea notei/procentului în interfață;
  // ambele valori sunt stocate pentru rapoarte și audit.
  const factor = 10 ** decimals;
  const rawGrade = 1 + ((maxGrade - 1) * earned) / (total || 1);
  const grade = Math.round((rawGrade + Number.EPSILON) * factor) / factor;
  const r = await c.query(
    `UPDATE professional_test_attempts SET status=$2,submitted_at=now(),earned_points=$3,total_points=$4,percentage=$5,grade=$6,passed=$7 WHERE id=$1 RETURNING *`,
    [a.id, status, earned, total, pct, grade, pct >= Number(v.rows[0].passing_percentage)],
  );
  return r.rows[0];
}
// Finalizează atomic o încercare expirată, inclusiv dacă browserul a fost închis.
// Blocarea rândului împiedică evaluarea dublă la cereri concurente.
async function finalizeExpiredAttempt(attemptId, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      `SELECT * FROM professional_test_attempts
       WHERE id=$1 AND user_id_snapshot=$2 FOR UPDATE`,
      [attemptId, userId],
    );
    if (!found.rowCount) {
      await client.query("COMMIT");
      return null;
    }
    const attempt = found.rows[0];
    if (attempt.status === "IN_PROGRESS" && new Date(attempt.expires_at).getTime() <= Date.now()) {
      const finished = await finalize(client, attempt, "EXPIRED");
      await client.query("COMMIT");
      return finished;
    }
    await client.query("COMMIT");
    return attempt;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
const attemptData = asyncRoute(async (req, res) => {
  const id = integer(req.params.attemptId);
  if (!id) return fail(res, 400, "ID invalid.");
  const a = await finalizeExpiredAttempt(id, req.user.id);
  if (!a) return fail(res, 404, "Încercare inexistentă.");
  if (a.status !== "IN_PROGRESS") return fail(res, 409, "Încercarea este încheiată.");
  const questions = await orderedAttemptQuestions(pool, a);
  const saved = await pool.query(
    "SELECT question_id,selected_option_ids FROM professional_test_attempt_answers WHERE attempt_id=$1",
    [id],
  );
  res.json({ attempt: a, questions, answers: saved.rows });
});
const saveAnswer = asyncRoute(async (req, res) => {
  const id = integer(req.params.attemptId),
    qid = integer(req.body.question_id),
    ids = req.body.selected_option_ids;
  if (
    !id ||
    !qid ||
    !Array.isArray(ids) ||
    ids.length > 12 ||
    ids.some((x) => !integer(x)) ||
    new Set(ids.map(String)).size !== ids.length
  )
    return fail(res, 400, "Răspuns invalid.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      "SELECT * FROM professional_test_attempts WHERE id=$1 AND user_id_snapshot=$2 FOR UPDATE",
      [id, req.user.id],
    );
    if (!r.rowCount) {
      await c.query("ROLLBACK");
      return fail(res, 404, "Încercare inexistentă.");
    }
    const a = r.rows[0];
    if (a.status !== "IN_PROGRESS") {
      await c.query("COMMIT");
      return fail(res, 409, "Încercarea este deja încheiată.");
    }
    if (new Date(a.expires_at) <= new Date()) {
      await finalize(c, a, "EXPIRED");
      await c.query("COMMIT");
      return fail(res, 409, "Timpul a expirat. Încercarea a fost finalizată automat.");
    }
    const q = await c.query(
      "SELECT id,question_type FROM professional_test_questions WHERE id=$1 AND version_id=$2",
      [qid, a.version_id],
    );
    if (!q.rowCount) {
      await c.query("ROLLBACK");
      return fail(res, 400, "Întrebare invalidă.");
    }
    if (q.rows[0].question_type !== "MULTIPLE_CHOICE" && ids.length > 1) {
      await c.query("ROLLBACK");
      return fail(res, 400, "Este permis un singur răspuns.");
    }
    const opts = await c.query("SELECT id FROM professional_test_options WHERE question_id=$1", [
      qid,
    ]);
    const allowed = new Set(opts.rows.map((x) => String(x.id)));
    if (ids.some((x) => !allowed.has(String(x)))) {
      await c.query("ROLLBACK");
      return fail(res, 400, "Opțiune invalidă.");
    }
    await c.query(
      `INSERT INTO professional_test_attempt_answers(attempt_id,version_id,question_id,selected_option_ids) VALUES($1,$2,$3,$4::bigint[]) ON CONFLICT(attempt_id,question_id) DO UPDATE SET selected_option_ids=EXCLUDED.selected_option_ids,saved_at=now()`,
      [id, a.version_id, qid, ids],
    );
    await c.query("COMMIT");
    res.json({ saved: true });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
const submit = asyncRoute(async (req, res) => {
  const id = integer(req.params.attemptId);
  if (!id) return fail(res, 400, "ID invalid.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await c.query(
      "SELECT * FROM professional_test_attempts WHERE id=$1 AND user_id_snapshot=$2 FOR UPDATE",
      [id, req.user.id],
    );
    if (!r.rowCount) {
      await c.query("ROLLBACK");
      return fail(res, 404, "Încercare inexistentă.");
    }
    const a = r.rows[0];
    if (a.status !== "IN_PROGRESS") {
      await c.query("COMMIT");
      return res.json({ attempt: a });
    }
    const finished = await finalize(
      c,
      a,
      new Date(a.expires_at) <= new Date() ? "EXPIRED" : "SUBMITTED",
    );
    await c.query("COMMIT");
    res.json({ attempt: finished });
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
});
// Revizuirea unei încercări finalizate. Nu expune răspunsurile corecte înainte de termen.
const attemptReview = asyncRoute(async (req, res) => {
  const id = integer(req.params.attemptId);
  if (!id) return fail(res, 400, "ID invalid.");
  await finalizeExpiredAttempt(id, req.user.id);
  const found = await pool.query(
    `SELECT a.*,v.reveal_answers,v.available_until,v.show_grade,v.grading_mode,
            v.show_explanations,t.title
     FROM professional_test_attempts a
     JOIN professional_test_versions v ON v.id=a.version_id
     JOIN professional_tests t ON t.id=v.test_id
     WHERE a.id=$1 AND a.user_id_snapshot=$2`,
    [id, req.user.id],
  );
  if (!found.rowCount) return fail(res, 404, "Încercare inexistentă.");
  const a = found.rows[0];
  if (a.status === "IN_PROGRESS") return fail(res, 409, "Testul nu este finalizat.");

  const reveal =
    a.reveal_answers === "AFTER_SUBMISSION" ||
    (a.reveal_answers === "AFTER_DEADLINE" &&
      a.available_until &&
      new Date(a.available_until).getTime() <= Date.now());
  // NEVER și MANUAL rămân închise; MANUAL necesită un mecanism separat de autorizare.
  const questions = await questionList(pool, a.version_id, reveal);
  // Explicațiile nu sunt afișate dacă setarea este dezactivată, chiar după dezvăluire.
  if (!a.show_explanations || !reveal) {
    for (const question of questions) {
      delete question.explanation;
      delete question.legal_reference;
    }
  }
  const saved = await pool.query(
    `SELECT question_id,selected_option_ids,is_correct,awarded_points
     FROM professional_test_attempt_answers WHERE attempt_id=$1`,
    [id],
  );
  const byQuestion = new Map(saved.rows.map((x) => [String(x.question_id), x]));
  const items = questions.map((q) => {
    const answer = byQuestion.get(String(q.id));
    const item = {
      ...q,
      selected_option_ids: (answer?.selected_option_ids || []).map(String),
      is_correct: answer?.is_correct === true,
      awarded_points: Number(answer?.awarded_points || 0),
      answered: Boolean(answer?.selected_option_ids?.length),
    };
    // Înainte de dezvăluire nu furnizăm nici indicatorul de corectitudine per întrebare.
    if (!reveal) {
      delete item.is_correct;
      delete item.awarded_points;
    }
    return item;
  });
  const durationSeconds =
    a.started_at && a.submitted_at
      ? Math.max(0, Math.floor((new Date(a.submitted_at) - new Date(a.started_at)) / 1000))
      : null;
  res.json({
    attempt: {
      id: a.id,
      version_id: a.version_id,
      attempt_number: a.attempt_number,
      status: a.status,
      started_at: a.started_at,
      submitted_at: a.submitted_at,
      percentage: a.show_grade && a.grading_mode !== "grade" ? a.percentage : null,
      grade: a.show_grade && a.grading_mode !== "percent" ? a.grade : null,
      show_grade: a.show_grade,
      grading_mode: a.grading_mode,
      passed: a.passed,
      earned_points: a.earned_points,
      total_points: a.total_points,
      duration_seconds: durationSeconds,
      title: a.title,
    },
    reveal_answers: reveal,
    questions: items,
  });
});

const myResults = asyncRoute(async (req, res) => {
  const r = await pool.query(
    `SELECT a.id,a.version_id,a.attempt_number,a.status,a.started_at,a.submitted_at,CASE WHEN a.submitted_at IS NOT NULL THEN GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (a.submitted_at-a.started_at))))::int ELSE NULL END AS duration_seconds,a.percentage,a.grade,a.passed,t.title FROM professional_test_attempts a JOIN professional_test_versions v ON v.id=a.version_id JOIN professional_tests t ON t.id=v.test_id WHERE a.user_id_snapshot=$1 ORDER BY a.started_at DESC LIMIT 100`,
    [req.user.id],
  );
  res.json({ results: r.rows });
});
const listVersionAssignments = asyncRoute(async (req, res) => {
  const id = integer(req.params.versionId);
  if (!id) return fail(res, 400, "ID invalid.");
  const v = await versionAccess(pool, id);
  if (!v || v.archived_at) return fail(res, 404, "Versiune inexistentă.");
  if (!canManage(req, v)) return fail(res, 403, "Acces interzis.");
  // Se expandează destinatarii USER, GROUP și ALL; nu se dezvăluie răspunsuri.
  const r = await pool.query(
    `
    SELECT a.id AS assignment_id, a.version_id, t.title AS test_title,
           u.id AS user_id, u.full_name, u.username,
           a.target_type, a.group_id, g.name AS group_name,
           a.available_from, a.deadline_at, a.assigned_at AS assigned_at,
           CASE WHEN a.target_type = 'USER' THEN 'Atribuire individuală'
                WHEN a.target_type = 'GROUP' THEN 'Atribuire prin grup'
                ELSE 'Atribuire generală' END AS target_label,
           CASE WHEN last_attempt.status IN ('SUBMITTED', 'EXPIRED') THEN 'FINISHED'
                WHEN last_attempt.status = 'IN_PROGRESS' AND last_attempt.expires_at <= now() THEN 'FINISHED'
                WHEN last_attempt.status = 'IN_PROGRESS' THEN 'IN_PROGRESS'
                WHEN a.available_from > now() THEN 'SCHEDULED'
                ELSE 'NOT_STARTED' END AS progress_status
    FROM professional_test_assignments a
    JOIN professional_test_versions v ON v.id = a.version_id
    JOIN professional_tests t ON t.id = v.test_id
    LEFT JOIN professional_test_groups g ON g.id = a.group_id
    JOIN users u ON u.is_active = true AND (
      (a.target_type = 'USER' AND u.id = a.user_id)
      OR (a.target_type = 'ALL')
      OR (a.target_type = 'GROUP' AND EXISTS (
        SELECT 1 FROM professional_test_group_members gm
        WHERE gm.group_id = a.group_id AND gm.user_id = u.id
      ))
    )
    LEFT JOIN LATERAL (
      SELECT at.id, at.submitted_at, at.status, at.expires_at
      FROM professional_test_attempts at
      WHERE at.version_id = a.version_id AND at.user_id_snapshot = u.id
      ORDER BY at.started_at DESC, at.id DESC LIMIT 1
    ) last_attempt ON true
    WHERE a.version_id = $1 AND a.revoked_at IS NULL
    ORDER BY a.id DESC, u.full_name, u.id
    LIMIT 2000
  `,
    [id],
  );
  return res.json({ assignments: r.rows });
});

// Administratorul poate finaliza o lucrare expirată înainte de revizuire.
// Autorizarea este verificată înainte de orice modificare.
async function finalizeExpiredForManager(attemptId, req) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT a.*, t.created_by, t.archived_at
       FROM professional_test_attempts a
       JOIN professional_test_versions v ON v.id = a.version_id
       JOIN professional_tests t ON t.id = v.test_id
       WHERE a.id = $1 FOR UPDATE OF a`,
      [attemptId],
    );
    const attempt = result.rows[0];
    if (!attempt || attempt.archived_at || !canManage(req, attempt)) {
      await client.query("ROLLBACK");
      return false;
    }
    if (attempt.status === "IN_PROGRESS" && new Date(attempt.expires_at).getTime() <= Date.now()) {
      await finalize(client, attempt, "EXPIRED");
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Revizuire managerială: numai ADMIN sau editorul care a creat testul.
// Nu permite consultarea răspunsurilor unei încercări încă active.
const managerAttemptReview = asyncRoute(async (req, res) => {
  const id = integer(req.params.attemptId);
  if (!id) return fail(res, 400, "ID invalid.");
  const authorized = await finalizeExpiredForManager(id, req);
  if (!authorized) return fail(res, 404, "Lucrarea nu există sau accesul este interzis.");
  const result = await pool.query(
    `SELECT a.*, t.title, t.created_by, t.archived_at
     FROM professional_test_attempts a
     JOIN professional_test_versions v ON v.id=a.version_id
     JOIN professional_tests t ON t.id=v.test_id
     WHERE a.id=$1`,
    [id],
  );
  const a = result.rows[0];
  if (!a || a.archived_at) return fail(res, 404, "Lucrarea nu există.");
  if (!canManage(req, a)) return fail(res, 403, "Nu ai permisiunea de a consulta această lucrare.");
  if (a.status === "IN_PROGRESS") return fail(res, 409, "Lucrarea este încă în desfășurare.");
  const questions = await questionList(pool, a.version_id, true);
  const saved = await pool.query(
    `SELECT question_id, selected_option_ids, is_correct, awarded_points
     FROM professional_test_attempt_answers WHERE attempt_id=$1`,
    [id],
  );
  const answers = new Map(saved.rows.map((row) => [String(row.question_id), row]));
  res.json({
    attempt: {
      id: a.id,
      version_id: a.version_id,
      attempt_number: a.attempt_number,
      user_name_snapshot: a.user_name_snapshot,
      status: a.status,
      started_at: a.started_at,
      submitted_at: a.submitted_at,
      percentage: a.percentage,
      grade: a.grade,
      passed: a.passed,
      earned_points: a.earned_points,
      total_points: a.total_points,
      title: a.title,
    },
    questions: questions.map((q) => {
      const answer = answers.get(String(q.id));
      return {
        ...q,
        selected_option_ids: (answer?.selected_option_ids || []).map(String),
        answered: Boolean(answer?.selected_option_ids?.length),
        is_correct: answer?.is_correct ?? null,
        awarded_points: Number(answer?.awarded_points || 0),
      };
    }),
  });
});

const managerResults = asyncRoute(async (req, res) => {
  const id = integer(req.params.versionId);
  if (!id) return fail(res, 400, "ID invalid.");
  const v = await versionAccess(pool, id);
  if (!v) return fail(res, 404, "Versiune inexistentă.");
  if (!canManage(req, v)) return fail(res, 403, "Acces interzis.");
  const r = await pool.query(
    `SELECT a.id, a.version_id, a.user_name_snapshot, a.attempt_number,
            a.status, a.started_at, a.submitted_at,
            CASE WHEN a.submitted_at IS NOT NULL
              THEN GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (a.submitted_at-a.started_at))))::int
              ELSE NULL END AS duration_seconds,
            a.percentage, a.grade, a.passed, t.title AS test_title,
            t.category AS category_name
     FROM professional_test_attempts a
     JOIN professional_test_versions v ON v.id = a.version_id
     JOIN professional_tests t ON t.id = v.test_id
     WHERE a.version_id=$1
     ORDER BY a.started_at DESC, a.id DESC LIMIT 500`,
    [id],
  );
  res.json({ results: r.rows });
});
const createGroup = asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name || name.length > 150) return fail(res, 400, "Nume invalid.");
  const r = await pool.query(
    "INSERT INTO professional_test_groups(name,description,created_by) VALUES($1,$2,$3) RETURNING *",
    [name, req.body.description || null, req.user.id],
  );
  res.status(201).json({ group: r.rows[0] });
});
const addGroupMember = asyncRoute(async (req, res) => {
  const gid = integer(req.params.groupId),
    uid = integer(req.body.user_id);
  if (!gid || !uid) return fail(res, 400, "ID invalid.");
  const g = await pool.query("SELECT * FROM professional_test_groups WHERE id=$1", [gid]);
  if (!g.rowCount) return fail(res, 404, "Grup inexistent.");
  if (!canManage(req, g.rows[0])) return fail(res, 403, "Acces interzis.");
  const u = await pool.query("SELECT id FROM users WHERE id=$1 AND is_active=true", [uid]);
  if (!u.rowCount) return fail(res, 400, "Utilizator invalid.");
  await pool.query(
    "INSERT INTO professional_test_group_members(group_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
    [gid, uid],
  );
  res.json({ added: true });
});

// Grupurile sunt vizibile tuturor managerilor; modificarea este rezervata
// administratorului sau creatorului grupului.
const listGroups = asyncRoute(async (req, res) => {
  const result = await pool.query(`
    SELECT g.id, g.name, g.description, g.created_by, g.created_at, g.updated_at,
           COUNT(u.id)::int AS member_count
    FROM professional_test_groups g
    LEFT JOIN professional_test_group_members gm ON gm.group_id = g.id
    LEFT JOIN users u ON u.id = gm.user_id AND u.is_active = true
    GROUP BY g.id
    ORDER BY LOWER(g.name), g.id
  `);
  res.json({ groups: result.rows.map((g) => ({ ...g, can_edit: canManage(req, g) })) });
});

const getGroup = asyncRoute(async (req, res) => {
  const gid = integer(req.params.groupId);
  if (!gid) return fail(res, 400, "ID grup invalid.");
  const group = await pool.query("SELECT * FROM professional_test_groups WHERE id=$1", [gid]);
  if (!group.rowCount) return fail(res, 404, "Grup inexistent.");
  const members = await pool.query(
    `
    SELECT u.id, u.full_name, u.username, u.is_active, gm.added_at
    FROM professional_test_group_members gm
    JOIN users u ON u.id = gm.user_id
    WHERE gm.group_id=$1
    ORDER BY LOWER(COALESCE(u.full_name, u.username)), u.id
  `,
    [gid],
  );
  res.json({
    group: { ...group.rows[0], can_edit: canManage(req, group.rows[0]) },
    members: members.rows,
  });
});

const updateGroup = asyncRoute(async (req, res) => {
  const gid = integer(req.params.groupId);
  if (!gid) return fail(res, 400, "ID grup invalid.");
  const b = req.body || {};
  if (b.name === undefined && b.description === undefined)
    return fail(res, 400, "Nu au fost furnizate modificari.");
  const name = b.name === undefined ? null : String(b.name ?? "").trim();
  const description = b.description === undefined ? null : String(b.description ?? "").trim();
  if (name !== null && (!name || name.length > 150)) return fail(res, 400, "Nume invalid.");
  if (description !== null && description.length > 2000)
    return fail(res, 400, "Descrierea este prea lunga.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "SELECT * FROM professional_test_groups WHERE id=$1 FOR UPDATE",
      [gid],
    );
    if (!found.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Grup inexistent.");
    }
    if (!canManage(req, found.rows[0])) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Acces interzis.");
    }
    const updated = await client.query(
      `
      UPDATE professional_test_groups
      SET name=COALESCE($2,name),
          description=CASE WHEN $3::boolean THEN $4 ELSE description END,
          updated_at=now()
      WHERE id=$1 RETURNING *
    `,
      [gid, name, b.description !== undefined, description || null],
    );
    await client.query("COMMIT");
    res.json({ group: updated.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

const removeGroupMember = asyncRoute(async (req, res) => {
  const gid = integer(req.params.groupId);
  const uid = integer(req.params.userId);
  if (!gid || !uid) return fail(res, 400, "ID invalid.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const group = await client.query(
      "SELECT * FROM professional_test_groups WHERE id=$1 FOR UPDATE",
      [gid],
    );
    if (!group.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Grup inexistent.");
    }
    if (!canManage(req, group.rows[0])) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Acces interzis.");
    }
    const removed = await client.query(
      "DELETE FROM professional_test_group_members WHERE group_id=$1 AND user_id=$2 RETURNING user_id",
      [gid, uid],
    );
    await client.query("UPDATE professional_test_groups SET updated_at=now() WHERE id=$1", [gid]);
    await client.query("COMMIT");
    res.json({ removed: !!removed.rowCount, user_id: uid });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

const addGroupMembers = asyncRoute(async (req, res) => {
  const gid = integer(req.params.groupId);
  const raw = req.body?.user_ids;
  if (!gid || !Array.isArray(raw) || raw.length < 1 || raw.length > 1000)
    return fail(res, 400, "Lista membrilor este invalida (1-1000 utilizatori).");
  const ids = raw.map(integer);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
    return fail(res, 400, "Lista contine ID-uri invalide sau duplicate.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const group = await client.query(
      "SELECT * FROM professional_test_groups WHERE id=$1 FOR UPDATE",
      [gid],
    );
    if (!group.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Grup inexistent.");
    }
    if (!canManage(req, group.rows[0])) {
      await client.query("ROLLBACK");
      return fail(res, 403, "Acces interzis.");
    }
    const users = await client.query(
      "SELECT id FROM users WHERE id=ANY($1::int[]) AND is_active=true",
      [ids],
    );
    if (users.rowCount !== ids.length) {
      await client.query("ROLLBACK");
      return fail(res, 400, "Unul sau mai multi utilizatori nu exista sau sunt inactivi.");
    }
    const added = await client.query(
      `
      INSERT INTO professional_test_group_members(group_id,user_id)
      SELECT $1, unnest($2::int[])
      ON CONFLICT (group_id,user_id) DO NOTHING
      RETURNING user_id
    `,
      [gid, ids],
    );
    await client.query("UPDATE professional_test_groups SET updated_at=now() WHERE id=$1", [gid]);
    await client.query("COMMIT");
    res.json({ added_count: added.rowCount, already_members: ids.length - added.rowCount });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

// Stergere definitiva a unui test si a datelor sale dependente. Doar ADMIN.
const deleteTest = asyncRoute(async (req, res) => {
  const testId = integer(req.params.testId);
  if (!testId) return fail(res, 400, "ID test invalid.");
  if (req.user.role !== "ADMIN") return fail(res, 403, "Doar administratorul poate sterge teste.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const test = await client.query(
      "SELECT id, title FROM professional_tests WHERE id=$1 FOR UPDATE",
      [testId],
    );
    if (!test.rowCount) {
      await client.query("ROLLBACK");
      return fail(res, 404, "Testul nu exista.");
    }

    // Nu distruge istoricul evaluărilor. Testele susținute pot fi doar arhivate.
    const history = await client.query(
      `SELECT EXISTS(SELECT 1 FROM professional_test_attempts a
       JOIN professional_test_versions v ON v.id=a.version_id
       WHERE v.test_id=$1) AS has_history`,
      [testId],
    );
    if (history.rows[0].has_history) {
      await client.query("ROLLBACK");
      return fail(
        res,
        409,
        "Testul are încercări înregistrate și nu poate fi șters definitiv. Arhivează-l pentru a păstra istoricul.",
      );
    }

    // Ordinea respecta dependentele dintre cele noua tabele ale modulului.
    // Grupele si membrii grupelor nu sunt sterse: pot fi folosite de alte teste.
    await client.query(
      `DELETE FROM professional_test_attempt_answers
       WHERE attempt_id IN (
         SELECT a.id FROM professional_test_attempts a
         JOIN professional_test_versions v ON v.id=a.version_id
         WHERE v.test_id=$1
       )`,
      [testId],
    );
    await client.query(
      `DELETE FROM professional_test_attempts
       WHERE version_id IN (SELECT id FROM professional_test_versions WHERE test_id=$1)`,
      [testId],
    );
    await client.query(
      `DELETE FROM professional_test_assignments
       WHERE version_id IN (SELECT id FROM professional_test_versions WHERE test_id=$1)`,
      [testId],
    );
    await client.query(
      `DELETE FROM professional_test_options
       WHERE question_id IN (
         SELECT q.id FROM professional_test_questions q
         JOIN professional_test_versions v ON v.id=q.version_id
         WHERE v.test_id=$1
       )`,
      [testId],
    );
    await client.query(
      `DELETE FROM professional_test_questions
       WHERE version_id IN (SELECT id FROM professional_test_versions WHERE test_id=$1)`,
      [testId],
    );
    await client.query("DELETE FROM professional_test_versions WHERE test_id=$1", [testId]);
    await client.query("DELETE FROM professional_tests WHERE id=$1", [testId]);
    await client.query("COMMIT");
    return res.json({ deleted: true, test_id: testId, title: test.rows[0].title });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

// Preferințe personale pentru interfața modulului de testare.
// Nu modifică regulile versiunilor publicate și nu înlocuiește autorizarea serverului.
const getPreferences = asyncRoute(async (req, res) => {
  const userId = integer(req.user?.id);
  if (!userId) return fail(res, 401, "Autentificare necesară.");

  const result = await pool.query(
    "SELECT preferences FROM professional_test_user_preferences WHERE user_id = $1",
    [userId],
  );
  return res.json({ preferences: result.rows[0]?.preferences ?? {} });
});

const savePreferences = asyncRoute(async (req, res) => {
  const userId = integer(req.user?.id);
  if (!userId) return fail(res, 401, "Autentificare necesară.");

  const preferences = req.body?.preferences;
  if (
    !preferences ||
    typeof preferences !== "object" ||
    Array.isArray(preferences) ||
    Object.getPrototypeOf(preferences) !== Object.prototype
  ) {
    return fail(res, 400, "Preferințele trebuie să fie un obiect JSON.");
  }

  // Limita previne salvarea unor payloaduri excesive în baza de date.
  const json = JSON.stringify(preferences);
  if (Buffer.byteLength(json, "utf8") > 16384) {
    return fail(res, 413, "Preferințele depășesc limita de 16 KB.");
  }

  const result = await pool.query(
    `INSERT INTO professional_test_user_preferences (user_id, preferences)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET preferences = EXCLUDED.preferences, updated_at = NOW()
     RETURNING preferences`,
    [userId, json],
  );

  return res.json({
    message: "Preferințele au fost salvate.",
    preferences: result.rows[0].preferences,
  });
});

module.exports = {
  getPreferences,
  savePreferences,
  deleteTest,
  createTest,
  listTests,
  updateDraft,
  getVersion,
  editQuestion,
  deleteQuestion,
  duplicateQuestion,
  saveQuestion,
  getQuestions,
  publish,
  newVersion,
  eligibleUsers,
  assign,
  listAssigned,
  startAttempt,
  attemptData,
  saveAnswer,
  submit,
  myResults,
  attemptReview,
  managerResults,
  managerAttemptReview,
  listVersionAssignments,
  createGroup,
  addGroupMember,
  addGroupMembers,
  listGroups,
  getGroup,
  updateGroup,
  removeGroupMember,
};
