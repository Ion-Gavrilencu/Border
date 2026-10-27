const nodemailer = require("nodemailer");

const sendActivationEmail = async ({ email, username, activationLink }) => {
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 465);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser;

  if (!smtpUser || !smtpPassword) {
    throw new Error("Configurația SMTP lipsește: SMTP_USER sau SMTP_PASSWORD.");
  }

  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
    throw new Error("SMTP_PORT este invalid.");
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  await transporter.sendMail({
    from: smtpFrom,
    to: email,
    subject: "Activarea contului - Platforma de Serviciu",
    text: `
Bună ziua!

Administratorul a creat un cont pentru dumneavoastră pe Platforma de Serviciu.

Nume de utilizator: ${username}

Pentru activarea contului și stabilirea parolei, accesați linkul:

${activationLink}

Linkul este valabil 24 de ore și poate fi utilizat o singură dată.

Dacă nu ați solicitat acest cont, ignorați mesajul.

Platforma de Serviciu
    `.trim(),
  });
};

module.exports = {
  sendActivationEmail,
};
