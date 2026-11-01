const fs = require("node:fs");
const path = require("node:path");
const pool = require("../config/database");

const ALLOWED_TYPES = new Set(["telegrama", "ordin", "legislatie", "informatii", "stire"]);
const DOCUMENT_LABELS = {
  telegrama: "Vezi telegrama",
  ordin: "Vezi ordinul",
  legislatie: "Vezi actul legislativ",
  informatii: "Vezi informația",
  stire: "Vezi știrea",
};
const CATEGORIES = {
  telegrama: ["TELEGRAMĂ INTERNĂ", "&#9993;"],
  ordin: ["ORDIN INTERN", "&#9776;"],
  legislatie: ["ACT NORMATIV", "&#9878;"],
  informatii: ["INFORMAȚIE UTILĂ", "&#9432;"],
  stire: ["ȘTIRE NOUĂ", "&#9679;"],
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
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
};

const buildDocumentUrl = (link) => {
  const frontendUrl = getFrontendUrl();
  if (!frontendUrl) return null;
  try {
    const url = new URL(link, frontendUrl);
    return url.origin === frontendUrl ? url.href : null;
  } catch {
    return null;
  }
};

// Logo-ul este cel din public/images, folosit și de aplicația web.
// Atașamentul CID funcționează chiar dacă imaginile externe sunt blocate în clientul e-mail.
const getEmailLogo = () => {
  const logoPath = path.resolve(__dirname, "../../public/images/border-logo.png");
  if (fs.existsSync(logoPath)) {
    return {
      src: "cid:border-logo",
      attachments: [
        {
          filename: "border-logo.png",
          path: logoPath,
          cid: "border-logo",
          contentDisposition: "inline",
        },
      ],
    };
  }

  // Fallback pentru deploy-uri serverless care nu includ folderul public în backend.
  const frontendUrl = getFrontendUrl();
  if (frontendUrl && frontendUrl.startsWith("https://")) {
    console.warn(
      "NOTIFICATION EMAIL: Logo-ul local nu este disponibil; se folosește URL-ul public.",
    );
    return { src: `${frontendUrl}/images/border-logo.png`, attachments: [] };
  }
  console.warn("NOTIFICATION EMAIL: Logo-ul BORDER nu a fost găsit.");
  return { src: null, attachments: [] };
};

const buildEmailHtml = ({ title, message, type, documentUrl, logoSrc }) => {
  const [categoryLabel, categoryIcon] = CATEGORIES[type] || ["NOTIFICARE", "&#9993;"];
  const buttonLabel = DOCUMENT_LABELS[type] || "Vezi documentul";
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br />");
  const safeUrl = documentUrl ? escapeHtml(documentUrl) : "";
  const logo = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" width="78" height="78" alt="Emblema BORDER" style="display:block;width:78px;height:78px;border:0;outline:none;text-decoration:none;" />`
    : `<span style="font-size:34px;color:#f9cf54;">&#9670;</span>`;

  const documentButton = documentUrl
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 20px;">
      <tr><td bgcolor="#0754b7" style="background:#0754b7;border-radius:12px;">
        <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:16px 30px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:12px;">${escapeHtml(buttonLabel)} &nbsp;&rarr;</a>
      </td></tr>
    </table>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td width="26" valign="top" style="font-size:20px;color:#0c5ab6;padding-top:3px;">&#128279;</td>
        <td style="font-size:13px;line-height:1.7;color:#536987;">Dacă butonul nu funcționează, accesați linkul:<br />
          <a href="${safeUrl}" style="color:#0754b7;text-decoration:underline;overflow-wrap:anywhere;word-break:break-all;">${safeUrl}</a>
        </td>
      </tr>
    </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>${safeTitle}</title>
<style>
@media only screen and (max-width:600px) {
  .outer-padding { padding:12px 8px !important; }
  .header-padding { padding:20px 17px !important; }
  .body-padding { padding:24px 18px !important; }
  .footer-padding { padding:19px 18px !important; }
  .brand-name { font-size:27px !important; }
  .brand-subtitle { font-size:13px !important; }
  .email-title { font-size:25px !important; }
  .brand-logo { width:66px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#eaf3fd;color:#102b59;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eaf3fd;">
<tr><td class="outer-padding" align="center" style="padding:28px 12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:620px;background:#ffffff;border:1px solid #d9e7f6;border-radius:20px;overflow:hidden;">
    <tr><td class="header-padding" bgcolor="#083a7b" style="padding:28px 30px;background:#083a7b;border-bottom:4px solid #f2c64b;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td class="brand-logo" width="94" valign="middle" style="width:94px;">${logo}</td>
        <td valign="middle" style="padding-left:14px;border-left:1px solid #5a80b0;">
          <p class="brand-name" style="margin:0;color:#ffffff;font-size:34px;font-weight:800;letter-spacing:1px;line-height:1.15;">BORDER</p>
          <p class="brand-subtitle" style="margin:7px 0 0;color:#dcecff;font-size:16px;font-weight:600;line-height:1.4;">Platformă informațională</p>
        </td>
      </tr></table>
    </td></tr>
    <tr><td class="body-padding" style="padding:34px 30px 36px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;"><tr><td>
        <span style="display:inline-block;background:#0754b7;color:#ffffff;border-radius:20px;padding:9px 15px;font-size:12px;font-weight:700;letter-spacing:.4px;">${categoryIcon} &nbsp;${escapeHtml(categoryLabel)}</span>
        <span style="display:inline-block;color:#54759f;font-size:11px;font-weight:700;letter-spacing:.7px;padding:9px 0 0 8px;">&bull; NOTIFICARE AUTOMATĂ</span>
      </td></tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 26px;"><tr>
        <td width="5" bgcolor="#0864d1" style="background:#0864d1;border-radius:4px;"></td>
        <td style="padding-left:16px;"><h1 class="email-title" style="margin:0;color:#102b59;font-size:30px;line-height:1.3;font-weight:800;">${safeTitle}</h1></td>
      </tr></table>
      <p style="margin:0 0 22px;color:#223e65;font-size:16px;line-height:1.7;">Bună ziua!</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eaf4ff;border-radius:14px;"><tr>
        <td width="54" valign="middle" style="padding:20px 0 20px 18px;color:#0a5ec6;font-size:30px;">&#128196;</td>
        <td valign="middle" style="padding:20px 18px;color:#18365f;font-size:16px;line-height:1.75;overflow-wrap:anywhere;word-break:break-word;">${safeMessage}</td>
      </tr></table>
      ${documentButton}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;background:#eaf4ff;border-radius:12px;"><tr>
        <td width="38" valign="middle" style="padding:17px 0 17px 16px;color:#0b5dbd;font-size:23px;">&#10003;</td>
        <td style="padding:17px 16px 17px 4px;color:#27456d;font-size:13px;line-height:1.6;">Pentru accesarea documentului este necesară autentificarea în platformă.</td>
      </tr></table>
    </td></tr>
    <tr><td class="footer-padding" bgcolor="#0c356f" style="padding:23px 30px;background:#0c356f;">
      <p style="margin:0 0 7px;color:#ffffff;font-size:14px;line-height:1.5;"><strong>BORDER</strong> &nbsp;&bull;&nbsp; Platformă informațională</p>
      <p style="margin:0;color:#d6e5f9;font-size:12px;line-height:1.6;">Mesaj generat automat. Nu răspundeți la acest e-mail.</p>
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
  const result = await pool.query(
    `
    INSERT INTO notifications (user_id, title, message, type, link)
    SELECT u.id, $1, $2, $3, $4
    FROM users u
    WHERE u.is_active = TRUE AND u.id <> $5
  `,
    [cleanTitle, cleanMessage, type, link, id],
  );

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM) {
    console.warn("NOTIFICATION EMAIL: SMTP incomplet; trimiterea e-mailurilor a fost omisă.");
    return result.rowCount;
  }

  try {
    const nodemailer = require("nodemailer");
    const recipients = await pool.query(
      `
      SELECT email FROM users
      WHERE is_active = TRUE AND id <> $1
        AND email_notifications = TRUE
        AND email IS NOT NULL AND BTRIM(email) <> ''
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
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT invalid.");

    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });

    const documentUrl = buildDocumentUrl(link);
    const emailLogo = getEmailLogo();
    const html = buildEmailHtml({
      title: cleanTitle,
      message: cleanMessage,
      type,
      documentUrl,
      logoSrc: emailLogo.src,
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

    const outcomes = await Promise.allSettled(
      recipients.rows.map(({ email }) =>
        transport.sendMail({
          from: SMTP_FROM,
          to: email,
          subject: cleanTitle,
          text: plainText,
          html,
          attachments: emailLogo.attachments,
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
    if (failed > 0)
      console.error(`NOTIFICATION EMAIL: ${failed} trimiteri eșuate din ${outcomes.length}.`);
    transport.close();
  } catch (error) {
    console.error("NOTIFICATION EMAIL ERROR:", error.message);
  }
  return result.rowCount;
};

module.exports = { notifyUsers };
