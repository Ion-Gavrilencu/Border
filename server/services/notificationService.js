
const pool = require("../config/database");

const ALLOWED_TYPES = new Set([
  "telegrama",
  "ordin",
  "legislatie",
  "informatii",
  "stire",
]);

/**
 * Creează o notificare pentru fiecare utilizator activ,
 * cu excepția autorului acțiunii.
 *
 * Funcția poate fi reutilizată de toate modulele.
 */
const notifyUsers = async ({
  actorId,
  title,
  message,
  type,
  link,
}) => {
  if (
    !Number.isInteger(Number(actorId)) ||
    typeof title !== "string" ||
    !title.trim() ||
    typeof message !== "string" ||
    !message.trim() ||
    !ALLOWED_TYPES.has(type) ||
    typeof link !== "string" ||
    !link.startsWith("/")
  ) {
    throw new Error("Date invalide pentru notificare.");
  }

  const result = await pool.query(
    `
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      link
    )
    SELECT
      u.id,
      $1,
      $2,
      $3,
      $4
    FROM users u
    WHERE u.is_active = TRUE
      AND u.id <> $5
    `,
    [
      title.trim(),
      message.trim(),
      type,
      link,
      actorId,
    ]
  );

  return result.rowCount;
};

module.exports = {
  notifyUsers,
};
