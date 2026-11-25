const express = require("express");
const pool = require("../config/database");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const router = express.Router();
router.use(authenticate, authorizeRoles("ADMIN", "EDITOR"));
const run = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
const bad = (res, message) => res.status(400).json({ message });
const idOk = (x) =>
  typeof x === "string" && /^[1-9]\d{0,18}$/.test(x) && BigInt(x) <= 9223372036854775807n;
const text = (x, max, optional = false) =>
  typeof x === "string" && x.trim().length <= max && (optional || x.trim())
    ? x.trim()
    : optional && (x == null || x === "")
      ? ""
      : null;
function validate(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const category = text(raw.category, 100),
    q = raw.question;
  if (!category || !q || typeof q !== "object") return null;
  const type = q.type,
    questionText = text(q.text, 10000),
    points = Number(q.points),
    explanation = text(q.explanation, 10000, true),
    legalReference = text(q.legalReference, 1000, true);
  if (
    !["single", "multiple", "truefalse"].includes(type) ||
    !questionText ||
    !Number.isFinite(points) ||
    points <= 0 ||
    points > 1000 ||
    explanation === null ||
    legalReference === null ||
    !Array.isArray(q.answers) ||
    q.answers.length < 2 ||
    q.answers.length > 12
  )
    return null;
  const answers = q.answers.map((a) => ({ text: text(a?.text, 5000), correct: a?.correct }));
  if (answers.some((a) => !a.text || typeof a.correct !== "boolean")) return null;
  const correct = answers.filter((a) => a.correct).length;
  if (
    !correct ||
    (type !== "multiple" && correct !== 1) ||
    (type === "truefalse" &&
      (answers.length !== 2 || answers[0].text !== "Adevărat" || answers[1].text !== "Fals"))
  )
    return null;
  return {
    category,
    question: { type, text: questionText, points, explanation, legalReference, answers },
  };
}
const norm = (v) =>
  String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
const questionKey = (q) =>
  JSON.stringify([
    q.type,
    norm(q.text),
    (q.answers || []).map((a) => JSON.stringify([norm(a.text), !!a.correct])).sort(),
  ]);
router.get(
  "/",
  run(async (req, res) => {
    const q = String(req.query.q ?? "").trim(),
      category = String(req.query.category ?? "").trim(),
      page = Number(req.query.page ?? 1),
      archived = req.query.archived === "true";
    if (
      q.length > 120 ||
      category.length > 100 ||
      !Number.isSafeInteger(page) ||
      page < 1 ||
      page > 100000
    )
      return bad(res, "Filtre invalide.");
    const params = [archived, category, q];
    const where = `(archived_at IS NOT NULL)=$1 AND ($2='' OR category=$2) AND ($3='' OR strpos(lower(question->>'text'),lower($3))>0 OR strpos(lower(COALESCE(question->>'legalReference','')),lower($3))>0)`;
    const rows = await pool.query(
      `SELECT id::text,category,question,created_by::text,archived_at FROM professional_question_bank WHERE ${where} ORDER BY id DESC LIMIT 50 OFFSET $4`,
      [...params, (page - 1) * 50],
    );
    const count = await pool.query(
      `SELECT count(*)::int AS total FROM professional_question_bank WHERE ${where}`,
      params,
    );
    const categories = await pool.query(
      "SELECT category,count(*)::int AS count FROM professional_question_bank WHERE archived_at IS NULL GROUP BY category ORDER BY category",
    );
    res.json({
      items: rows.rows.map((r) => ({
        ...r,
        can_edit: req.user.role === "ADMIN" || String(req.user.id) === r.created_by,
      })),
      total: count.rows[0].total,
      categories: categories.rows,
    });
  }),
);
router.post(
  "/",
  run(async (req, res) => {
    const values = Array.isArray(req.body?.items) ? req.body.items : [req.body];
    if (!values.length || values.length > 100)
      return bad(res, "Sunt permise 1–100 întrebări per operațiune.");
    const items = values.map(validate);
    if (items.some((x) => !x)) return bad(res, "Una sau mai multe întrebări sunt invalide.");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(91290201)");
      let added = 0,
        skipped = 0;
      const seen = new Map();
      for (const item of items) {
        if (req.body?.skipDuplicates === true) {
          if (!seen.has(item.category)) {
            const existing = await client.query(
              "SELECT question FROM professional_question_bank WHERE category=$1 AND archived_at IS NULL",
              [item.category],
            );
            seen.set(item.category, new Set(existing.rows.map((x) => questionKey(x.question))));
          }
          const key = questionKey(item.question);
          if (seen.get(item.category).has(key)) {
            skipped++;
            continue;
          }
          seen.get(item.category).add(key);
        }
        await client.query(
          "INSERT INTO professional_question_bank(category,question,created_by) VALUES($1,$2::jsonb,$3)",
          [item.category, JSON.stringify(item.question), req.user.id],
        );
        added++;
      }
      await client.query("COMMIT");
      res.status(201).json({ added, skipped });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }),
);
router.patch(
  "/:id",
  run(async (req, res) => {
    if (!idOk(req.params.id)) return bad(res, "ID invalid.");
    const item = validate(req.body);
    if (!item) return bad(res, "Întrebare invalidă.");
    const r = await pool.query(
      "UPDATE professional_question_bank SET category=$2,question=$3::jsonb,updated_at=now() WHERE id=$1 AND archived_at IS NULL AND ($4::boolean OR created_by=$5) RETURNING id",
      [
        req.params.id,
        item.category,
        JSON.stringify(item.question),
        req.user.role === "ADMIN",
        req.user.id,
      ],
    );
    if (!r.rowCount)
      return res.status(404).json({ message: "Întrebarea nu este disponibilă pentru editare." });
    res.json({ updated: true });
  }),
);
router.post(
  "/:id/archive",
  run(async (req, res) => {
    if (!idOk(req.params.id) || typeof req.body?.archived !== "boolean")
      return bad(res, "Cerere invalidă.");
    const r = await pool.query(
      "UPDATE professional_question_bank SET archived_at=CASE WHEN $2 THEN now() ELSE NULL END,updated_at=now() WHERE id=$1 AND ($3::boolean OR created_by=$4) RETURNING id",
      [req.params.id, req.body.archived, req.user.role === "ADMIN", req.user.id],
    );
    if (!r.rowCount) return res.status(404).json({ message: "Întrebarea nu este disponibilă." });
    res.json({ updated: true });
  }),
);
router.post(
  "/sample",
  run(async (req, res) => {
    const selections = req.body?.selections;
    if (
      !Array.isArray(selections) ||
      !selections.length ||
      selections.length > 30 ||
      selections.some(
        (x) =>
          !text(x?.category, 100) || !Number.isSafeInteger(x.count) || x.count < 1 || x.count > 100,
      ) ||
      new Set(selections.map((x) => x.category)).size !== selections.length ||
      selections.reduce((n, x) => n + x.count, 0) > 100
    )
      return bad(res, "Selectează maximum 100 de întrebări din categorii distincte.");
    const items = [];
    for (const x of selections) {
      const r = await pool.query(
        "SELECT question FROM professional_question_bank WHERE category=$1 AND archived_at IS NULL ORDER BY random() LIMIT $2",
        [x.category, x.count],
      );
      if (r.rowCount !== x.count)
        return res
          .status(409)
          .json({ message: `Întrebări insuficiente în categoria ${x.category}.` });
      items.push(...r.rows.map((r) => r.question));
    }
    res.json({ questions: items });
  }),
);
module.exports = router;
