const fs = require("node:fs");
const path = require("node:path");
const pool = require("../config/database");
const nodemailer = require("nodemailer");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function getFrontendOrigin() {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function getFrontendLink(versionId) {
  const origin = getFrontendOrigin();
  if (!origin) return null;
  const url = new URL("/testare", origin);
  url.searchParams.set("versiune", String(versionId));
  return url.href;
}

function getEmailLogo() {
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
  const origin = getFrontendOrigin();
  if (origin?.startsWith("https://")) {
    return { src: `${origin}/images/border-logo.png`, attachments: [] };
  }
  return { src: null, attachments: [] };
}

function buildTestEmailHtml({ title, message, url, logoSrc }) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message).replace(/\r?\n/g, "<br />");
  const safeUrl = url ? escapeHtml(url) : "";
  const logo = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" width="78" height="78" alt="Emblema BORDER" style="display:block;width:78px;height:78px;border:0;outline:none;text-decoration:none;" />`
    : `<span style="font-size:34px;color:#f9cf54;">&#9670;</span>`;
  const action = url
    ? `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 20px;">
      <tr><td bgcolor="#0754b7" style="background:#0754b7;border-radius:12px;">
        <a href="${safeUrl}" target="_blank" style="display:inline-block;padding:16px 30px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;border-radius:12px;">Deschide testul profesional &nbsp;&rarr;</a>
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
        <span style="display:inline-block;background:#0754b7;color:#ffffff;border-radius:20px;padding:9px 15px;font-size:12px;font-weight:700;letter-spacing:.4px;">&#9745; &nbsp;TEST PROFESIONAL</span>
        <span style="display:inline-block;color:#54759f;font-size:11px;font-weight:700;letter-spacing:.7px;padding:9px 0 0 8px;">&bull; NOTIFICARE AUTOMATĂ</span>
      </td></tr></table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 26px;"><tr>
        <td width="5" bgcolor="#0864d1" style="background:#0864d1;border-radius:4px;"></td>
        <td style="padding-left:16px;"><h1 class="email-title" style="margin:0;color:#102b59;font-size:30px;line-height:1.3;font-weight:800;">${safeTitle}</h1></td>
      </tr></table>
      <p style="margin:0 0 22px;color:#223e65;font-size:16px;line-height:1.7;">Bună ziua!</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eaf4ff;border-radius:14px;"><tr>
        <td width="54" valign="middle" style="padding:20px 0 20px 18px;color:#0a5ec6;font-size:30px;">&#128203;</td>
        <td valign="middle" style="padding:20px 18px;color:#18365f;font-size:16px;line-height:1.75;overflow-wrap:anywhere;word-break:break-word;">${safeMessage}</td>
      </tr></table>
      ${action}
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;background:#eaf4ff;border-radius:12px;"><tr>
        <td width="38" valign="middle" style="padding:17px 0 17px 16px;color:#0b5dbd;font-size:23px;">&#10003;</td>
        <td style="padding:17px 16px 17px 4px;color:#27456d;font-size:13px;line-height:1.6;">Pentru accesarea testului este necesară autentificarea în platformă.</td>
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
}

// Notifică numai destinatarii efectivi ai atribuirii curente.
// Un utilizator primește cel mult o notificare pentru aceeași versiune de test.
async function notifyTestAssignment({ assignmentId, versionId, testTitle }) {
  const link = `/testare?versiune=${encodeURIComponent(versionId)}`;
  const title = "Test profesional nou atribuit";
  const message = `Vi s-a atribuit testul profesional „${testTitle}”. Accesați secțiunea Testare profesională pentru detalii.`;
  const inserted = await pool.query(
    `WITH target_users AS (
       SELECT DISTINCT u.id, u.email, u.email_notifications
       FROM professional_test_assignments a
       JOIN users u ON u.is_active = TRUE
       WHERE a.id = $1 AND a.version_id = $2 AND a.revoked_at IS NULL
         AND (
           (a.target_type = 'USER' AND a.user_id = u.id)
           OR (a.target_type = 'GROUP' AND EXISTS (
             SELECT 1 FROM professional_test_group_members gm
             WHERE gm.group_id = a.group_id AND gm.user_id = u.id
           ))
           OR a.target_type = 'ALL'
         )
     ), new_notifications AS (
       INSERT INTO notifications(user_id, title, message, type, link)
       SELECT t.id, $3, $4, 'test', $5
       FROM target_users t
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications n
         WHERE n.user_id = t.id AND n.type = 'test' AND n.link = $5
       )
       RETURNING user_id
     )
     SELECT t.email FROM target_users t
     JOIN new_notifications n ON n.user_id = t.id
     WHERE t.email_notifications = TRUE
       AND t.email IS NOT NULL AND BTRIM(t.email) <> ''`,
    [assignmentId, versionId, title, message, link],
  );

  const recipients = inserted.rows.map((r) => r.email);
  if (!recipients.length) return;

  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser;
  if (
    !smtpUser ||
    !smtpPassword ||
    !Number.isInteger(smtpPort) ||
    smtpPort < 1 ||
    smtpPort > 65535
  ) {
    console.warn(
      "TEST NOTIFICATION: Configurație SMTP absentă sau invalidă; notificările din aplicație au fost salvate.",
    );
    return;
  }

  const url = getFrontendLink(versionId);
  const emailLogo = getEmailLogo();
  const html = buildTestEmailHtml({ title, message, url, logoSrc: emailLogo.src });
  const text = [
    "Bună ziua!",
    "",
    message,
    ...(url ? ["", "Deschide testul profesional:", url] : []),
    "",
    "Pentru accesarea testului este necesară autentificarea în BORDER.",
    "",
    "BORDER — Platformă informațională",
  ].join("\n");
  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPassword },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });
  try {
    // Concurență limitată pentru a nu supraîncărca SMTP în Vercel.
    for (let i = 0; i < recipients.length; i += 5) {
      const batch = recipients.slice(i, i + 5);
      const outcomes = await Promise.allSettled(
        batch.map((email) =>
          transport.sendMail({
            from: smtpFrom,
            to: email,
            subject: title,
            text,
            html,
            attachments: emailLogo.attachments,
          }),
        ),
      );
      outcomes.forEach((outcome) => {
        if (outcome.status === "rejected")
          console.error("TEST EMAIL ERROR:", outcome.reason?.message || outcome.reason);
      });
    }
  } finally {
    transport.close();
  }
}

module.exports = { notifyTestAssignment };
