// Identitate de conținut: ignoră spațiile, majusculele și ordinea variantelor.
const norm = (v) =>
  String(v ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
export const questionKey = (q) =>
  JSON.stringify([
    q.type,
    norm(q.text),
    (q.answers || []).map((a) => JSON.stringify([norm(a.text), !!a.correct])).sort(),
  ]);
export const bankPayload = (q, category) => ({
  category: String(category ?? "").trim(),
  question: {
    type: q.type,
    text: String(q.text ?? "").trim(),
    points: Number(q.points),
    explanation: q.explanation || "",
    legalReference: q.legalReference || "",
    answers: (q.answers || []).map((a) => ({
      text: String(a.text ?? "").trim(),
      correct: !!a.correct,
    })),
  },
});
export const validBankPayload = ({ category, question: q }) =>
  category.length > 0 &&
  category.length <= 100 &&
  ["single", "multiple", "truefalse"].includes(q.type) &&
  q.text.length > 0 &&
  q.text.length <= 10000 &&
  Number.isFinite(q.points) &&
  q.points > 0 &&
  q.points <= 1000 &&
  q.answers.length >= 2 &&
  q.answers.length <= 12 &&
  q.answers.every((a) => a.text.length > 0 && a.text.length <= 5000) &&
  q.answers.some((a) => a.correct) &&
  (q.type === "multiple" || q.answers.filter((a) => a.correct).length === 1) &&
  (q.type !== "truefalse" ||
    (q.answers.length === 2 && q.answers[0].text === "Adevărat" && q.answers[1].text === "Fals")) &&
  q.explanation.length <= 10000 &&
  q.legalReference.length <= 1000;
