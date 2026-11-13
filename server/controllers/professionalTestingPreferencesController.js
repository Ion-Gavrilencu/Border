const pool = require("../config/database");

const defaults = Object.freeze({
  grading: "both",
  threshold: 50,
  maxGrade: 10,
  rounding: "one",
  attempts: 1,
  allowRetake: true,
  retryInterval: "24",
  showGrade: true,
  showAnswers: true,
  showExplanations: false,
  notifyAssignment: true,
  notifyExpiry: true,
  expiryHours: "24",
  notifyPublish: false,
  duration: "30",
  validity: "7",
  authenticated: true,
  idleTimeout: "10",
  blockNavigation: false,
});
const booleanKeys = new Set([
  "allowRetake",
  "showGrade",
  "showAnswers",
  "showExplanations",
  "notifyAssignment",
  "notifyExpiry",
  "notifyPublish",
  "authenticated",
  "blockNavigation",
]);
const numericKeys = new Set(["threshold", "maxGrade", "attempts"]);
const stringKeys = new Set([
  "grading",
  "rounding",
  "retryInterval",
  "expiryHours",
  "duration",
  "validity",
  "idleTimeout",
]);
const allowedEnums = {
  grading: ["both", "grade", "percentage"],
  rounding: ["one", "none", "integer", "two"],
};
function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const result = { ...defaults };
  for (const [key, value] of Object.entries(data)) {
    if (!(key in defaults)) return null;
    if (booleanKeys.has(key)) {
      if (typeof value !== "boolean") return null;
    } else if (numericKeys.has(key)) {
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      if (key === "threshold" && (value < 0 || value > 100)) return null;
      if (key === "maxGrade" && (value < 1 || value > 100)) return null;
      if (key === "attempts" && (!Number.isInteger(value) || value < 1 || value > 100)) return null;
    } else if (stringKeys.has(key)) {
      if (typeof value !== "string" || value.length > 30) return null;
      if (allowedEnums[key] && !allowedEnums[key].includes(value)) return null;
      if (!allowedEnums[key] && (!/^\d+$/.test(value) || Number(value) > 10000)) return null;
    }
    result[key] = value;
  }
  return result;
}
exports.getPreferences = async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT preferences FROM professional_test_user_preferences WHERE user_id=$1",
      [req.user.id],
    );
    res.json({ preferences: { ...defaults, ...(rows[0]?.preferences || {}) } });
  } catch (error) {
    next(error);
  }
};
exports.savePreferences = async (req, res, next) => {
  const preferences = validate(req.body?.preferences);
  if (!preferences) return res.status(400).json({ message: "Preferințe invalide." });
  try {
    await pool.query(
      `INSERT INTO professional_test_user_preferences (user_id, preferences)
      VALUES ($1,$2::jsonb) ON CONFLICT (user_id)
      DO UPDATE SET preferences=EXCLUDED.preferences, updated_at=NOW()`,
      [req.user.id, JSON.stringify(preferences)],
    );
    res.json({ preferences });
  } catch (error) {
    next(error);
  }
};
