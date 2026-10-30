const pool = require("../config/database");

const ALLOWED_TYPES = new Set([
  "telegrama",
  "ordin",
  "legislatie",
  "informatii",
  "stire",
]);

/**
 * Creează notificări în aplicație pentru toți utilizatorii activi,
 * cu excepția autorului.
 *
 * Notificările e-mail se trimit numai utilizatorilor
 * care au activată opțiunea email_notifications.
 *
 * Erorile SMTP nu afectează notificările din aplicație.
 */
const notifyUsers = async ({ actorId, title, message, type, link }) => {
  const id = Number(actorId);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    typeof title !== "string" ||
    !title.trim() ||
    typeof message !== "string" ||
    !message.trim() ||
    !ALLOWED_TYPES.has(type) ||
    typeof link !== "string" ||
    !link.startsWith("/") ||
    link.startsWith("//")
  ) {
    throw new Error("Date invalide pentru notificare.");
  }

  const cleanTitle = title.trim();
  const cleanMessage = message.trim();

  // Notificări interne: pentru toți utilizatorii activi,
  // indiferent de preferința pentru e-mail.
  const result = await pool.query(
    `INSERT INTO notifications (user_id, title, message, type, link)
     SELECT u.id, $1, $2, $3, $4
     FROM users u
     WHERE u.is_active = TRUE
       AND u.id <> $5`,
    [cleanTitle, cleanMessage, type, link, id],
  );

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } =
    process.env;

  // Dacă SMTP nu este configurat, notificările interne
  // continuă să funcționeze normal.
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    return result.rowCount;
  }

  try {
    const nodemailer = require("nodemailer");

    const recipients = await pool.query(
      `SELECT email
       FROM users
       WHERE is_active = TRUE
         AND id <> $1
         AND email_notifications = TRUE
         AND email IS NOT NULL
         AND BTRIM(email) <> ''`,
      [id],
    );

    if (recipients.rows.length === 0) {
      return result.rowCount;
    }

    const port = Number(SMTP_PORT);

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("SMTP_PORT invalid.");
    }

    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });

    // Fiecare destinatar primește mesajul separat.
    const outcomes = await Promise.allSettled(
      recipients.rows.map(({ email }) =>
        transport.sendMail({
          from: SMTP_FROM,
          to: email,
          subject: cleanTitle,
          text: cleanMessage,
        }),
      ),
    );

    const failed = outcomes.filter(
      (outcome) => outcome.status === "rejected",
    ).length;

    if (failed > 0) {
      console.error(
        `NOTIFICATION EMAIL: ${failed} trimiteri eșuate din ${outcomes.length}.`,
      );
    }
  } catch (error) {
    console.error("NOTIFICATION EMAIL ERROR:", error.message);
  }

  return result.rowCount;
};

module.exports = {
  notifyUsers,
};
