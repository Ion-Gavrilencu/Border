const pool = require("../config/database");
const mammoth = require("mammoth");
const XLSX = require("xlsx");
const pdfParse = require("pdf-parse"); // pdf-parse@1.1.1

const LIMIT = 100;
const clean = (v) => String(v ?? "").trim();
const numberId = (v) => (Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const respondError = (res, status, message) => res.status(status).json({ message });
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validateQuestion(raw) {
  const q = {
    question_type: clean(raw.question_type).toUpperCase(),
    question_text: clean(raw.question_text),
    points: Number(raw.points ?? 1),
    explanation: clean(raw.explanation) || null,
    legal_reference: clean(raw.legal_reference) || null,
    options: Array.isArray(raw.options)
      ? raw.options.map((o) => ({
          option_text: clean(o.option_text),
          is_correct: o.is_correct === true,
        }))
      : [],
  };
  if (
    !["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"].includes(q.question_type) ||
    !q.question_text ||
    q.question_text.length > 10000 ||
    !Number.isFinite(q.points) ||
    q.points <= 0 ||
    q.points > 1000 ||
    q.options.length < 2 ||
    q.options.length > 12 ||
    q.options.some((o) => !o.option_text || o.option_text.length > 5000)
  )
    return null;
  const correct = q.options.filter((o) => o.is_correct).length;
  if (
    !correct ||
    (q.question_type !== "MULTIPLE_CHOICE" && correct !== 1) ||
    (q.question_type === "TRUE_FALSE" && q.options.length !== 2)
  )
    return null;
  return q;
}

function parseText(text) {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map((x) => x.trim());
  const blocks = [];
  let current = null;
  const flush = () => {
    if (current) blocks.push(current);
    current = null;
  };
  for (const line of lines) {
    if (!line) continue;
    const start = line.match(/^(?:Întrebarea\s*)?(\d{1,3})\s*[.)]\s*(.+)$/i);
    const option = line.match(/^([A-L])\s*[.)]\s*(.+)$/i);
    const answer = line.match(
      /^(?:Răspuns(?:uri)?\s+corect(?:e)?|Correct\s+answer(?:s)?)\s*:\s*(.+)$/i,
    );
    const points = line.match(/^(?:Punctaj|Puncte|Points)\s*:\s*(\d+(?:[.,]\d+)?)$/i);
    if (start) {
      flush();
      current = { question_text: start[2], options: [], correctLetters: [], points: 1 };
    } else if (current && option)
      current.options.push({ letter: option[1].toUpperCase(), option_text: option[2] });
    else if (current && answer)
      current.correctLetters = answer[1].toUpperCase().match(/\b[A-L]\b/g) || [];
    else if (current && points) current.points = Number(points[1].replace(",", "."));
    else if (current && !current.options.length) current.question_text += " " + line;
  }
  flush();
  return blocks.map((b) => ({
    question_text: b.question_text,
    question_type: b.correctLetters.length > 1 ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE",
    points: b.points,
    options: b.options.map((o) => ({
      option_text: o.option_text,
      is_correct: b.correctLetters.includes(o.letter),
    })),
  }));
}

function parseSpreadsheet(buffer, isCsv) {
  const book = XLSX.read(buffer, {
    type: "buffer",
    raw: false,
    cellFormula: false,
    cellHTML: false,
  });
  const rows = [];
  for (const sheetName of book.SheetNames) {
    const sheet = book.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
    for (const r of records) {
      const get = (...names) => {
        const key = Object.keys(r).find((k) =>
          names.some((n) => k.trim().toLowerCase() === n.toLowerCase()),
        );
        return key === undefined ? "" : r[key];
      };
      const options = "ABCDEFGHIJKL"
        .split("")
        .map((letter) => ({
          letter,
          option_text: clean(get(letter, `Varianta ${letter}`, `Option ${letter}`)),
        }))
        .filter((o) => o.option_text);
      const correct =
        clean(get("Corect", "Raspuns corect", "Răspuns corect", "Correct"))
          .toUpperCase()
          .match(/\b[A-L]\b/g) || [];
      rows.push({
        question_text: get("Intrebare", "Întrebare", "Question"),
        question_type:
          clean(get("Tip", "Type")).toUpperCase() ||
          (correct.length > 1 ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE"),
        points: clean(get("Punctaj", "Points")) || 1,
        explanation: get("Explicatie", "Explicație", "Explanation"),
        legal_reference: get("Referinta", "Referință", "Legal reference"),
        options: options.map((o) => ({
          option_text: o.option_text,
          is_correct: correct.includes(o.letter),
        })),
      });
    }
  }
  return rows;
}

async function extract(file) {
  const name = clean(file.originalname).toLowerCase();
  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return parseText(result.value);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".csv")) return parseSpreadsheet(file.buffer);
  if (name.endsWith(".txt")) return parseText(file.buffer.toString("utf8"));
  if (name.endsWith(".json")) {
    const obj = JSON.parse(file.buffer.toString("utf8"));
    return Array.isArray(obj) ? obj : obj.questions;
  }
  if (name.endsWith(".pdf")) {
    const result = await pdfParse(file.buffer);
    if (!result.text?.trim())
      throw Object.assign(
        new Error("PDF fără text selectabil. Pentru documente scanate este necesar OCR."),
        { status: 422 },
      );
    return parseText(result.text);
  }
  throw Object.assign(new Error("Format neacceptat."), { status: 415 });
}

const previewImport = asyncRoute(async (req, res) => {
  if (!numberId(req.params.versionId)) return respondError(res, 400, "ID versiune invalid.");
  if (!req.file) return respondError(res, 400, "Selectează un document.");
  const version = await pool.query(
    `SELECT v.status,t.created_by,t.archived_at FROM professional_test_versions v JOIN professional_tests t ON t.id=v.test_id WHERE v.id=$1`,
    [req.params.versionId],
  );
  const v = version.rows[0];
  if (!v || v.archived_at) return respondError(res, 404, "Versiunea nu există.");
  if (req.user.role !== "ADMIN" && Number(v.created_by) !== Number(req.user.id))
    return respondError(res, 403, "Acces interzis.");
  if (v.status !== "DRAFT") return respondError(res, 409, "Importul este permis doar în DRAFT.");
  let raw;
  try {
    raw = await extract(req.file);
  } catch (err) {
    if (err.status) return respondError(res, err.status, err.message);
    if (err instanceof SyntaxError) return respondError(res, 400, "JSON invalid.");
    throw err;
  }
  if (!Array.isArray(raw) || !raw.length)
    return respondError(res, 422, "Nu s-au identificat întrebări. Verifică formatul documentului.");
  if (raw.length > LIMIT) return respondError(res, 413, `Maximum ${LIMIT} întrebări per import.`);
  const questions = raw.map(validateQuestion);
  const errors = questions.flatMap((q, i) =>
    q ? [] : [{ row: i + 1, message: "Întrebare, variante sau răspuns corect invalid." }],
  );
  return res.json({
    questions: raw.map((q, i) => questions[i] || q),
    valid_count: questions.length - errors.length,
    errors,
  });
});

const confirmImport = asyncRoute(async (req, res) => {
  const versionId = numberId(req.params.versionId);
  const raw = req.body?.questions;
  if (!versionId || !Array.isArray(raw) || !raw.length || raw.length > LIMIT)
    return respondError(res, 400, "Lista de întrebări este invalidă.");
  const questions = raw.map(validateQuestion);
  if (questions.some((q) => !q))
    return respondError(res, 400, "Corectează toate întrebările înainte de import.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `SELECT v.status,t.created_by,t.archived_at FROM professional_test_versions v JOIN professional_tests t ON t.id=v.test_id WHERE v.id=$1 FOR UPDATE OF v`,
      [versionId],
    );
    const v = result.rows[0];
    if (!v || v.archived_at) {
      await client.query("ROLLBACK");
      return respondError(res, 404, "Versiunea nu există.");
    }
    if (req.user.role !== "ADMIN" && Number(v.created_by) !== Number(req.user.id)) {
      await client.query("ROLLBACK");
      return respondError(res, 403, "Acces interzis.");
    }
    if (v.status !== "DRAFT") {
      await client.query("ROLLBACK");
      return respondError(res, 409, "Versiunea nu mai este DRAFT.");
    }
    const pos = await client.query(
      "SELECT COALESCE(MAX(position),0)::int AS position FROM professional_test_questions WHERE version_id=$1",
      [versionId],
    );
    let position = pos.rows[0].position;
    for (const q of questions) {
      const saved = await client.query(
        `INSERT INTO professional_test_questions(version_id,position,question_type,question_text,explanation,legal_reference,points) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          versionId,
          ++position,
          q.question_type,
          q.question_text,
          q.explanation,
          q.legal_reference,
          q.points,
        ],
      );
      for (let i = 0; i < q.options.length; i++) {
        const o = q.options[i];
        await client.query(
          "INSERT INTO professional_test_options(question_id,position,option_text,is_correct) VALUES($1,$2,$3,$4)",
          [saved.rows[0].id, i + 1, o.option_text, o.is_correct],
        );
      }
    }
    await client.query("COMMIT");
    return res.status(201).json({ imported: questions.length });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});

module.exports = { previewImport, confirmImport };
