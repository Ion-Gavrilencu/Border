
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendActivationEmail = async ({
  email,
  username,
  activationLink,
}) => {
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
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
