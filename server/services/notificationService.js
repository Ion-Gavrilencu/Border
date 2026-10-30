const pool = require("../config/database");

const ALLOWED_TYPES = new Set([
  "telegrama",
  "ordin",
  "legislatie",
  "informatii",
  "stire",
]);

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
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br>");
  const safeUrl = documentUrl ? escapeHtml(documentUrl) : "";

  const documentButton = documentUrl
    ? `
      <table role="presentation"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="margin:28px 0 20px;">
        <tr>
          <td
            bgcolor="#1156a3"
            style="border-radius:10px;">
            <a
              href="${safeUrl}"
              target="_blank"
              style="
                display:inline-block;
                padding:14px 26px;
                background:#1156a3;
                border-radius:10px;
                color:#ffffff;
                font-size:15px;
                font-weight:700;
                text-decoration:none;
              ">
              ${escapeHtml(buttonLabel)} &rarr;
            </a>
          </td>
        </tr>
      </table>

      <p style="
        margin:0 0 10px;
        color:#64748b;
        font-size:12px;
        line-height:1.6;
      ">
        Dacă butonul nu funcționează,
        accesați acest link:
      </p>

      <p style="
        margin:0;
        font-size:12px;
        line-height:1.7;
        overflow-wrap:anywhere;
        word-break:break-word;
      ">
        <a
          href="${safeUrl}"
          style="color:#1156a3;">
          ${safeUrl}
        </a>
      </p>
    `
    : "";

  return `
    <!DOCTYPE html>
    <html lang="ro">
      <head>
        <meta charset="UTF-8">
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        >
        <title>${safeTitle}</title>
      </head>

      <body style="
        margin:0;
        padding:0;
        background:#f2f6fc;
        font-family:Arial,Helvetica,sans-serif;
        color:#102b52;
      ">
        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="background:#f2f6fc;"
        >
          <tr>
            <td
              align="center"
              style="padding:30px 14px;"
            >
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  max-width:560px;
                  background:#ffffff;
                  border:1px solid #e2eaf5;
                  border-radius:16px;
                "
              >
                <tr>
                  <td style="
                    padding:26px 28px;
                    background:#103e78;
                    border-radius:16px 16px 0 0;
                  ">
                    <p style="
                      margin:0;
                      color:#ffffff;
                      font-size:20px;
                      font-weight:700;
                    ">
                      Platforma de Serviciu
                    </p>

                    <p style="
                      margin:8px 0 0;
                      color:#d6e7fb;
                      font-size:13px;
                    ">
                      Notificare automată
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:30px 28px;">
                    <h1 style="
                      margin:0 0 20px;
                      font-size:23px;
                      line-height:1.3;
                      color:#103e78;
                    ">
                      ${safeTitle}
                    </h1>

                    <p style="
                      margin:0 0 14px;
                      font-size:15px;
                      line-height:1.7;
                    ">
                      Bună ziua!
                    </p>

                    <p style="
                      margin:0;
                      font-size:15px;
                      line-height:1.8;
                      color:#334155;
                    ">
                      ${safeMessage}
                    </p>

                    ${documentButton}

                    <p style="
                      margin:24px 0 0;
                      color:#64748b;
                      font-size:13px;
                      line-height:1.7;
                    ">
                      Pentru accesarea documentului
                      este necesară autentificarea
                      în platformă.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="
                    padding:18px 28px;
                    border-top:1px solid #e2eaf5;
                    background:#f8fbff;
                    border-radius:0 0 16px 16px;
                  ">
                    <p style="
                      margin:0;
                      color:#718096;
                      font-size:12px;
                      line-height:1.6;
                    ">
                      Acest mesaj a fost generat
                      automat de Platforma de Serviciu.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
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

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } =
    process.env;

  // SMTP neconfigurat:
  // notificările interne rămân funcționale.
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
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
      "Platforma de Serviciu",
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

    const failed = outcomes.filter(
      (outcome) => outcome.status === "rejected",
    ).length;

    if (failed > 0) {
      console.error(
        `NOTIFICATION EMAIL: ${failed} trimiteri eșuate din ${outcomes.length}.`,
      );
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
