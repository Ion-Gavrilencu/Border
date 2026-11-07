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
    `SELECT a.id FROM professional_test_assignments a WHERE a.version_id=$1 AND a.revoked_at IS NULL AND (a.available_from IS NULL OR a.available_from<=now()) AND (a.deadline_at IS NULL OR a.deadline_at>=now()) AND (a.target_type='ALL' OR (a.target_type='USER' AND a.user_id=$2) OR (a.target_type='GROUP' AND EXISTS(SELECT 1 FROM professional_test_group_members m WHERE m.group_id=a.group_id AND m.user_id=$2))) LIMIT 1`,
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
const createTest = asyncRoute(async (req, res) => {
  const title = String(req.body.title || "").trim();
  if (!title || title.length > 250) return fail(res, 400, "Titlu invalid.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const t = await client.query(
      "INSERT INTO professional_tests(title,description,created_by) VALUES($1,$2,$3) RETURNING *",
      [title, req.body.description || null, req.user.id],
    );
    const v = await client.query(
      "INSERT INTO professional_test_versions(test_id,version_number) VALUES($1,1) RETURNING *",
      [t.rows[0].id],
    );
    await client.query("COMMIT");
    return res.status(201).json({ test: t.rows[0], version: v.rows[0] });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});
const listTests = asyncRoute(async (req, res) => {
  const r = await pool.query(
    `SELECT t.id,t.title,t.description,t.created_by,t.created_at,v.id AS version_id,v.version_number,v.status FROM professional_tests t LEFT JOIN LATERAL (SELECT id,version_number,status FROM professional_test_versions WHERE test_id=t.id ORDER BY version_number DESC LIMIT 1) v ON true WHERE t.archived_at IS NULL AND ($1='ADMIN' OR t.created_by=$2) ORDER BY t.created_at DESC LIMIT 200`,
    [req.user.role, req.user.id],
  );
  res.json({ tests: r.rows });
});

// Citire setări versiune: acces doar administratorului sau creatorului testului.
const getVersion = asyncRoute(async (req, res) => {
  const id = integer(req.params.versionId);
  if (!id) return fail(res, 400, "ID invalid.");
  const v = await versionAccess(pool, id);
  if (!v || v.archived_at) return fail(res, 404, "Versiunea nu există.");
  if (!canManage(req, v)) return fail(res, 403, "Acces interzis.");
  res.json({ version: v });
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
  const v = await versionAccess(pool, id);
  if (!v) return fail(res, 404, "Versiunea nu există.");
  if (!canManage(req, v)) return fail(res, 403, "Acces interzis.");
  if (v.status !== "DRAFT") return fail(res, 409, "Versiunea publicată nu poate fi modificată.");
  const b = req.body;
  const duration = integer(b.duration_minutes ?? v.duration_minutes),
    max = integer(b.max_attempts ?? v.max_attempts),
    passing = Number(b.passing_percentage ?? v.passing_percentage),
    reveal = b.reveal_answers ?? v.reveal_answers;
  if (
    !duration ||
    duration > 480 ||
    !max ||
    max > 100 ||
    !Number.isFinite(passing) ||
    passing < 0 ||
    passing > 100 ||
    !REVEAL.has(reveal)
  )
    return fail(res, 400, "Setări invalide.");
  const r = await pool.query(
    `UPDATE professional_test_versions SET duration_minutes=$2,max_attempts=$3,passing_percentage=$4,reveal_answers=$5,shuffle_questions=$6,shuffle_options=$7,available_from=$8,available_until=$9,updated_at=now() WHERE id=$1 AND status='DRAFT' RETURNING *`,
    [
      id,
      duration,
      max,
      passing,
      reveal,
      b.shuffle_questions ?? v.shuffle_questions,
      b.shuffle_options ?? v.shuffle_options,
      b.available_from === undefined ? v.available_from : b.available_from,
      b.available_until === undefined ? v.available_until : b.available_until,
    ],
  );
  res.json({ version: r.rows[0] });
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
      `INSERT INTO professional_test_versions(test_id,version_number,duration_minutes,max_attempts,passing_percentage,reveal_answers,shuffle_questions,shuffle_options,available_from,available_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
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
  const target = type === "USER" ? userId : null,
    group = type === "GROUP" ? groupId : null;
  if (type === "USER") {
    const u = await pool.query("SELECT id FROM users WHERE id=$1 AND is_active=true", [userId]);
    if (!u.rowCount) return fail(res, 400, "Utilizator inactiv sau inexistent.");
  }
  if (type === "GROUP") {
    const g = await pool.query("SELECT id FROM professional_test_groups WHERE id=$1", [groupId]);
    if (!g.rowCount) return fail(res, 400, "Grup inexistent.");
  }
  try {
    const r = await pool.query(
      `INSERT INTO professional_test_assignments(version_id,target_type,user_id,group_id,assigned_by,available_from,deadline_at) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        id,
        type,
        target,
        group,
        req.user.id,
        req.body.available_from || null,
        req.body.deadline_at || null,
      ],
    );
    // Atribuirea a fost salvată. Eșecul notificării nu anulează atribuirea.
    try {
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
    `SELECT DISTINCT v.id AS version_id,t.title,v.version_number,v.duration_minutes,v.max_attempts,v.available_until FROM professional_test_versions v JOIN professional_tests t ON t.id=v.test_id JOIN professional_test_assignments a ON a.version_id=v.id WHERE v.status='PUBLISHED' AND t.archived_at IS NULL AND a.revoked_at IS NULL AND (a.available_from IS NULL OR a.available_from<=now()) AND (a.deadline_at IS NULL OR a.deadline_at>=now()) AND (v.available_from IS NULL OR v.available_from<=now()) AND (v.available_until IS NULL OR v.available_until>=now()) AND (a.target_type='ALL' OR (a.target_type='USER' AND a.user_id=$1) OR (a.target_type='GROUP' AND EXISTS(SELECT 1 FROM professional_test_group_members m WHERE m.group_id=a.group_id AND m.user_id=$1))) ORDER BY t.title LIMIT 200`,
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
    if (count.rows[0].n >= v.max_attempts) {
      await c.query("ROLLBACK");
      return fail(res, 409, "Numărul maxim de încercări a fost atins.");
    }
    const r = await c.query(
      `INSERT INTO professional_test_attempts(version_id,user_id,user_id_snapshot,user_name_snapshot,attempt_number,expires_at) VALUES($1,$2,$2,$3,$4,now()+($5::int * interval '1 minute')) RETURNING *`,
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
  const grade = Math.round((1 + (9 * pct) / 100) * 100) / 100;
  const v = await c.query("SELECT passing_percentage FROM professional_test_versions WHERE id=$1", [
    a.version_id,
  ]);
  const r = await c.query(
    `UPDATE professional_test_attempts SET status=$2,submitted_at=now(),earned_points=$3,total_points=$4,percentage=$5,grade=$6,passed=$7 WHERE id=$1 RETURNING *`,
    [a.id, status, earned, total, pct, grade, pct >= Number(v.rows[0].passing_percentage)],
  );
  return r.rows[0];
}
const attemptData = asyncRoute(async (req, res) => {
  const id = integer(req.params.attemptId);
  if (!id) return fail(res, 400, "ID invalid.");
  const r = await pool.query(
    "SELECT * FROM professional_test_attempts WHERE id=$1 AND user_id_snapshot=$2",
    [id, req.user.id],
  );
  if (!r.rowCount) return fail(res, 404, "Încercare inexistentă.");
  const a = r.rows[0];
  if (a.status !== "IN_PROGRESS") return fail(res, 409, "Încercarea este încheiată.");
  if (new Date(a.expires_at) <= new Date())
    return fail(res, 409, "Timpul a expirat. Trimite testul pentru evaluare.");
  const questions = await questionList(pool, a.version_id, false);
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
    if (a.status !== "IN_PROGRESS" || new Date(a.expires_at) <= new Date()) {
      await c.query("ROLLBACK");
      return fail(res, 409, "Încercarea nu mai este activă.");
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
  const found = await pool.query(
    `SELECT a.*,v.reveal_answers,v.available_until,t.title
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
      percentage: a.percentage,
      grade: a.grade,
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
    SELECT a.id AS assignment_id, u.id AS user_id, u.full_name, u.username,
           a.target_type, a.assigned_at AS assigned_at,
           CASE WHEN a.target_type = 'USER' THEN 'Atribuire individuală'
                WHEN a.target_type = 'GROUP' THEN 'Atribuire prin grup'
                ELSE 'Atribuire generală' END AS target_label,
           CASE WHEN last_attempt.submitted_at IS NOT NULL THEN 'FINISHED'
                WHEN last_attempt.id IS NOT NULL THEN 'IN_PROGRESS'
                ELSE 'NOT_STARTED' END AS progress_status
    FROM professional_test_assignments a
    JOIN users u ON u.is_active = true AND (
      (a.target_type = 'USER' AND u.id = a.user_id)
      OR (a.target_type = 'ALL')
      OR (a.target_type = 'GROUP' AND EXISTS (
        SELECT 1 FROM professional_test_group_members gm
        WHERE gm.group_id = a.group_id AND gm.user_id = u.id
      ))
    )
    LEFT JOIN LATERAL (
      SELECT at.id, at.submitted_at
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

const managerResults = asyncRoute(async (req, res) => {
  const id = integer(req.params.versionId);
  if (!id) return fail(res, 400, "ID invalid.");
  const v = await versionAccess(pool, id);
  if (!v) return fail(res, 404, "Versiune inexistentă.");
  if (!canManage(req, v)) return fail(res, 403, "Acces interzis.");
  const r = await pool.query(
    "SELECT id,user_name_snapshot,attempt_number,status,started_at,submitted_at,CASE WHEN submitted_at IS NOT NULL THEN GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (submitted_at-started_at))))::int ELSE NULL END AS duration_seconds,percentage,grade,passed FROM professional_test_attempts WHERE version_id=$1 ORDER BY started_at DESC LIMIT 500",
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

module.exports = {
  deleteTest,
  createTest,
  listTests,
  updateDraft,
  getVersion,
  editQuestion,
  deleteQuestion,
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
  listVersionAssignments,
  createGroup,
  addGroupMember,
};
