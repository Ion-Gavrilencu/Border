const pool = require("../config/database");
const nodemailer = require("nodemailer");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function getFrontendLink() {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    return new URL("/testare", url.origin).href;
  } catch {
    return null;
  }
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

  const url = getFrontendLink();
  const html = `<!doctype html><html lang="ro"><body style="margin:0;background:#edf4fc;font-family:Arial,sans-serif;color:#102b59">
    <div style="max-width:620px;margin:24px auto;background:#fff;border-radius:16px;overflow:hidden">
      <div style="padding:25px;background:#083a7b;color:white;font-size:28px;font-weight:bold">BORDER
        <div style="font-size:13px;font-weight:normal">Platformă informațională</div></div>
      <div style="padding:30px"><h2>${escapeHtml(title)}</h2>
        <p>Bună ziua!</p><p>${escapeHtml(message)}</p>
        ${url ? `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 20px;background:#0754b7;color:white;text-decoration:none;border-radius:8px">Deschide Testare profesională</a></p>` : ""}
        <p style="font-size:13px;color:#536987">Pentru accesarea testului este necesară autentificarea în BORDER.</p>
      </div><div style="padding:18px 30px;background:#0c356f;color:white;font-size:12px">BORDER · Mesaj automat</div>
    </div></body></html>`;
  const text = [
    "Bună ziua!",
    "",
    message,
    ...(url ? ["", url] : []),
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
          transport.sendMail({ from: smtpFrom, to: email, subject: title, text, html }),
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
