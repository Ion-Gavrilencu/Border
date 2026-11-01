const pool = require("../config/database");

const ALLOWED_TYPES = new Set(["telegrama", "ordin", "legislatie", "informatii", "stire"]);

const DOCUMENT_LABELS = {
  telegrama: "Vezi telegrama",

  ordin: "Vezi ordinul",

  legislatie: "Vezi actul legislativ",

  informatii: "Vezi informația",

  stire: "Vezi știrea",
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#39;");

const getFrontendUrl = () => {
  const value = process.env.FRONTEND_URL?.trim();

  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
};

const buildDocumentUrl = (link) => {
  const frontendUrl = getFrontendUrl();

  if (!frontendUrl) {
    return null;
  }

  try {
    const url = new URL(link, frontendUrl);

    if (url.origin !== frontendUrl) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
};

const buildEmailHtml = ({ title, message, type, documentUrl }) => {
  const buttonLabel = DOCUMENT_LABELS[type] || "Vezi documentul";
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br />");
  const safeUrl = documentUrl ? escapeHtml(documentUrl) : "";
  const categoryLabel =
    {
      telegrama: "TELEGRAMĂ INTERNĂ",
      ordin: "ORDIN INTERN",
      legislatie: "ACT NORMATIV",
      informatii: "INFORMAȚIE UTILĂ",
      stire: "ȘTIRE NOUĂ",
    }[type] || "NOTIFICARE";

  const documentButton = documentUrl
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 18px;">
        <tr><td bgcolor="#1558a6" style="border-radius:10px;">
          <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:15px 25px;background:#1558a6;border-radius:10px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">
            ${escapeHtml(buttonLabel)} &rarr;
          </a>
        </td></tr>
      </table>
      <p style="margin:0 0 6px;color:#64748b;font-size:12px;line-height:1.6;">Dacă butonul nu funcționează, accesați linkul:</p>
      <p style="margin:0;font-size:12px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word;">
        <a href="${safeUrl}" style="color:#1558a6;text-decoration:underline;">${safeUrl}</a>
      </p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background:#edf3fa;color:#102b59;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#edf3fa;">
    <tr><td align="center" style="padding:22px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:580px;background:#ffffff;border:1px solid #dfe8f3;border-radius:16px;">
        <tr><td bgcolor="#103e7c" style="padding:25px 24px;background:#103e7c;border-radius:16px 16px 0 0;">
          <p style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:1px;line-height:1.2;">BORDER</p>
          <p style="margin:7px 0 0;color:#d6e7ff;font-size:13px;line-height:1.5;">Platformă informațională</p>
        </td></tr>
        <tr><td style="padding:28px 24px 26px;">
          <p style="margin:0 0 13px;color:#1558a6;font-size:11px;font-weight:700;letter-spacing:1px;">${escapeHtml(categoryLabel)} &nbsp;&bull;&nbsp; NOTIFICARE AUTOMATĂ</p>
          <h1 style="margin:0 0 24px;color:#102b59;font-size:23px;font-weight:700;line-height:1.35;">${safeTitle}</h1>
          <p style="margin:0 0 17px;color:#334155;font-size:15px;line-height:1.7;">Bună ziua!</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f2f7fd;border:1px solid #e0ebfa;border-radius:10px;">
            <tr><td style="padding:18px 17px;color:#334155;font-size:15px;line-height:1.8;overflow-wrap:anywhere;word-break:break-word;">${safeMessage}</td></tr>
          </table>
          ${documentButton}
          <p style="margin:26px 0 0;color:#64748b;font-size:12px;line-height:1.7;">Pentru accesarea documentului este necesară autentificarea în platformă.</p>
        </td></tr>
        <tr><td style="padding:18px 24px;background:#f8fbff;border-top:1px solid #e2eaf5;border-radius:0 0 16px 16px;">
          <p style="margin:0 0 5px;color:#476384;font-size:12px;font-weight:700;">BORDER &bull; Platformă informațională</p>
          <p style="margin:0;color:#718096;font-size:11px;line-height:1.6;">Mesaj generat automat. Nu răspundeți la acest e-mail.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
};

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
    link.startsWith("//") ||
    /[\r\n\\]/.test(link)
  ) {
    throw new Error("Date invalide pentru notificare.");
  }

  const cleanTitle = title.trim();

  const cleanMessage = message.trim();

  // Păstrăm notificările interne pentru

  // toți utilizatorii activi, exceptând autorul.

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

    [cleanTitle, cleanMessage, type, link, id],
  );

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;

  // SMTP neconfigurat:

  // notificările interne rămân funcționale.

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    console.warn("NOTIFICATION EMAIL: SMTP incomplet; trimiterea e-mailurilor a fost omisă.");

    return result.rowCount;
  }

  try {
    const nodemailer = require("nodemailer");

    const recipients = await pool.query(
      `

      SELECT email

      FROM users

      WHERE is_active = TRUE

        AND id <> $1

        AND email_notifications = TRUE

        AND email IS NOT NULL

        AND BTRIM(email) <> ''

      `,

      [id],
    );

    if (recipients.rows.length === 0) {
      console.info(
        "NOTIFICATION EMAIL: Nu există destinatari activi cu notificările e-mail activate (autorul este exclus).",
      );

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

      connectionTimeout: 15000,

      greetingTimeout: 15000,

      socketTimeout: 20000,
    });

    const documentUrl = buildDocumentUrl(link);

    const html = buildEmailHtml({
      title: cleanTitle,

      message: cleanMessage,

      type,

      documentUrl,
    });

    const buttonLabel = DOCUMENT_LABELS[type] || "Vezi documentul";

    const plainText = [
      "Bună ziua!",

      "",

      cleanMessage,

      ...(documentUrl ? ["", `${buttonLabel}:`, documentUrl] : []),

      "",

      "Pentru accesarea documentului este necesară autentificarea.",

      "",

      "BORDER — Platformă informațională",
    ].join("\n");

    // Fiecare utilizator primește

    // notificarea separat.

    const outcomes = await Promise.allSettled(
      recipients.rows.map(({ email }) =>
        transport.sendMail({
          from: SMTP_FROM,

          to: email,

          subject: cleanTitle,

          text: plainText,

          html,
        }),
      ),
    );

    const failed = outcomes.filter((outcome) => outcome.status === "rejected").length;

    for (const outcome of outcomes) {
      if (outcome.status === "rejected") {
        console.error(
          "NOTIFICATION EMAIL SEND ERROR:",
          outcome.reason?.message || String(outcome.reason),
        );
      }
    }

    console.info(
      `NOTIFICATION EMAIL: ${outcomes.length - failed}/${outcomes.length} trimiteri acceptate de serverul SMTP.`,
    );

    if (failed > 0) {
      console.error(`NOTIFICATION EMAIL: ${failed} trimiteri eșuate din ${outcomes.length}.`);
    }

    transport.close();
  } catch (error) {
    console.error("NOTIFICATION EMAIL ERROR:", error.message);
  }

  return result.rowCount;
};

module.exports = {
  notifyUsers,
};
