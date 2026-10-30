const {
  logMonitoringEvent,
  touchPresence,
  markUserOffline,
} = require("../services/monitoringService");
const bcrypt = require("bcrypt");
const pool = require("../config/database");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");

const publicUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  fullName: row.full_name,
  role: row.role,
  created_at: row.created_at,
  emailNotifications: row.email_notifications,
  avatarURL: row.avatar_data
    ? `/api/auth/avatar-image/${row.id}?v=${new Date(row.avatar_updated_at || Date.now()).getTime()}`
    : null,
});

const register = async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password || !fullName) {
      return res.status(400).json({
        message: "Toate câmpurile sunt obligatorii.",
      });
    }

    const existingUser = await pool.query(
      "SELECT id FROM users WHERE username = $1 OR email = $2",
      [username, email],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: "Utilizatorul sau emailul există deja.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users
      (username, email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, full_name, role, created_at, email_notifications, avatar_data, avatar_updated_at`,
      [username, email, passwordHash, fullName, "USER"],
    );

    return res.status(201).json({
      message: "Utilizator creat cu succes.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);

    return res.status(500).json({
      message: "Eroare la crearea utilizatorului.",
    });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Utilizatorul și parola sunt obligatorii.",
      });
    }

    const result = await pool.query(
      `SELECT *
       FROM users
       WHERE username = $1
       AND is_active = TRUE`,
      [username],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Date de autentificare incorecte.",
      });
    }

    const user = result.rows[0];

    const passwordCorrect = await bcrypt.compare(password, user.password_hash);

    if (!passwordCorrect) {
      return res.status(401).json({
        message: "Date de autentificare incorecte.",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        sessionVersion: user.session_version,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/",
    });

    await logMonitoringEvent({
      userId: user.id,
      action: "login",
      details: "Autentificare reușită",
      req,
    });

    try {
      await touchPresence({
        user: { id: user.id },
        get: req.get.bind(req),
        ip: req.ip,
      });
    } catch (monitoringError) {
      console.error("LOGIN MONITORING ERROR:", monitoringError);
    }
    return res.json({
      message: "Autentificare reușită.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Eroare la autentificare.",
    });
  }
};

const logout = async (req, res) => {
  try {
    // Înregistrăm deconectarea doar dacă utilizatorul
    // a fost identificat de middleware-ul de autentificare.
    if (req.user?.id) {
      await logMonitoringEvent({
        userId: req.user.id,
        action: "logout",
        details: "Deconectare din aplicație",
        req,
      });

      await markUserOffline(req.user.id);
    }

    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.status(200).json({
      message: "Deconectare reușită.",
    });
  } catch (error) {
    console.error("LOGOUT ERROR:", error);

    // Cookie-ul trebuie șters chiar dacă monitorizarea
    // întâmpină o eroare.
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
    });

    return res.status(200).json({
      message: "Deconectare reușită.",
    });
  }
};

const activateAccount = async (req, res) => {
  try {
    const { token, password } = req.body || {};

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/.test(token) ||
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message:
          "Link invalid sau parolă invalidă. Parola trebuie să aibă între 12 și 128 de caractere.",
      });
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `
      UPDATE users
      SET password_hash = $1,
          is_active = TRUE,
          must_change_password = FALSE,
          activation_token_hash = NULL,
          activation_expires_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE activation_token_hash = $2
        AND activation_expires_at > CURRENT_TIMESTAMP
        AND is_active = FALSE
      RETURNING id, username
      `,
      [passwordHash, tokenHash],
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        message: "Linkul de activare este invalid sau a expirat.",
      });
    }

    return res.status(200).json({
      message: "Contul a fost activat. Acum te poți autentifica.",
    });
  } catch (error) {
    console.error("ACTIVATE ACCOUNT ERROR:", error);

    return res.status(500).json({
      message: "Eroare la activarea contului.",
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      newPassword.length < 12 ||
      newPassword.length > 128
    ) {
      return res.status(400).json({
        message: "Parola nouă trebuie să aibă între 12 și 128 de caractere.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "Parola nouă trebuie să fie diferită de cea actuală.",
      });
    }

    const result = await pool.query(
      `SELECT password_hash
       FROM users
       WHERE id = $1 AND is_active = TRUE`,
      [req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Contul nu este disponibil.",
      });
    }

    const passwordCorrect = await bcrypt.compare(
      currentPassword,
      result.rows[0].password_hash,
    );

    if (!passwordCorrect) {
      return res.status(400).json({
        message: "Parola actuală este incorectă.",
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `UPDATE users
   SET password_hash = $1,
       must_change_password = FALSE,
       session_version = session_version + 1,
       updated_at = CURRENT_TIMESTAMP
   WHERE id = $2
     AND is_active = TRUE`,
      [newPasswordHash, req.user.id],
    );

    return res.status(200).json({
      message: "Parola a fost schimbată cu succes.",
    });
  } catch (error) {
    console.error("CHANGE PASSWORD ERROR:", error);

    return res.status(500).json({
      message: "Eroare la schimbarea parolei.",
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { fullName, username } = req.body || {};

    if (
      typeof fullName !== "string" ||
      fullName.trim().length < 3 ||
      fullName.trim().length > 100
    ) {
      return res.status(400).json({
        message: "Numele trebuie să conțină între 3 și 100 de caractere.",
      });
    }

    if (
      typeof username !== "string" ||
      !/^[a-zA-Z0-9._-]{3,30}$/.test(username.trim())
    ) {
      return res.status(400).json({
        message:
          "Username-ul trebuie să aibă între 3 și 30 de caractere și poate conține litere, cifre, punct, cratimă sau underscore.",
      });
    }

    const cleanUsername = username.trim();
    const cleanFullName = fullName.trim();

    const result = await pool.query(
      `UPDATE users
       SET full_name = $1,
           username = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
         AND is_active = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM users
           WHERE LOWER(username) = LOWER($2)
             AND id <> $3
         )
       RETURNING id, username, email, full_name, role, created_at, email_notifications, avatar_data, avatar_updated_at`,
      [cleanFullName, cleanUsername, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        message:
          "Numele de utilizator este deja folosit sau contul nu este disponibil.",
      });
    }

    const updatedUser = result.rows[0];

    return res.status(200).json({
      message: "Datele personale au fost actualizate cu succes.",
      user: publicUser(updatedUser),
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Numele de utilizator este deja folosit.",
      });
    }

    console.error("UPDATE PROFILE ERROR:", error);

    return res.status(500).json({
      message: "Eroare la actualizarea profilului.",
    });
  }
};

// Fotografiile sunt salvate în PostgreSQL, nu pe discul temporar al serverului.
const updateAvatar = async (req, res) => {
  if (!req.file)
    return res.status(400).json({ message: "Selectează o fotografie." });
  try {
    const buffer = req.file.buffer;
    // Verificare semnătură, nu doar MIME-ul declarat de browser.
    const jpeg =
      buffer.length >= 3 &&
      buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    const png =
      buffer.length >= 8 &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      buffer.length >= 12 &&
      buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP";
    const mime = jpeg
      ? "image/jpeg"
      : png
        ? "image/png"
        : webp
          ? "image/webp"
          : null;
    if (!mime || req.file.mimetype !== mime) {
      return res.status(400).json({
        message: "Fotografia trebuie să fie JPG, PNG sau WebP valid.",
      });
    }
    const result = await pool.query(
      `UPDATE users SET avatar_data = $1, avatar_mime = $2,
         avatar_updated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND is_active = TRUE
       RETURNING id, username, email, full_name, role, created_at, email_notifications, avatar_data, avatar_updated_at`,
      [buffer, mime, req.user.id],
    );
    if (!result.rows.length)
      return res.status(404).json({ message: "Contul nu a fost găsit." });
    return res.json({
      message: "Fotografia a fost actualizată.",
      user: publicUser(result.rows[0]),
    });
  } catch (error) {
    console.error("UPDATE AVATAR ERROR:", error);
    return res
      .status(500)
      .json({ message: "Fotografia nu a putut fi salvată." });
  }
};

// URL publică doar pentru fotografie; nu expune alte date de cont.
const getAvatarImage = async (req, res) => {
  try {
    if (!/^\d+$/.test(String(req.params.id))) return res.sendStatus(404);
    const result = await pool.query(
      "SELECT avatar_data, avatar_mime FROM users WHERE id = $1 AND is_active = TRUE",
      [req.params.id],
    );
    const row = result.rows[0];
    if (!row?.avatar_data) return res.sendStatus(404);
    res.set("Content-Type", row.avatar_mime);
    res.set("Cache-Control", "public, max-age=86400");
    res.set("X-Content-Type-Options", "nosniff");
    return res.send(row.avatar_data);
  } catch (error) {
    console.error("GET AVATAR ERROR:", error);
    return res.sendStatus(500);
  }
};

const updatePreferences = async (req, res) => {
  const { emailNotifications } = req.body || {};
  if (typeof emailNotifications !== "boolean") {
    return res
      .status(400)
      .json({ message: "Valoare invalidă pentru notificările e-mail." });
  }
  try {
    const result = await pool.query(
      `UPDATE users SET email_notifications = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND is_active = TRUE
       RETURNING id, username, email, full_name, role, created_at, email_notifications, avatar_data, avatar_updated_at`,
      [emailNotifications, req.user.id],
    );
    if (!result.rows.length)
      return res.status(404).json({ message: "Contul nu a fost găsit." });
    return res.json({
      message: "Preferința a fost salvată.",
      user: publicUser(result.rows[0]),
    });
  } catch (error) {
    console.error("UPDATE PREFERENCES ERROR:", error);
    return res
      .status(500)
      .json({ message: "Preferința nu a putut fi salvată." });
  }
};

const getMe = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, username, email, full_name, role, created_at,
              email_notifications, avatar_data, avatar_updated_at
       FROM users WHERE id = $1 AND is_active = TRUE`,
      [req.user.id],
    );
    if (!result.rows.length)
      return res.status(401).json({ message: "Cont indisponibil." });
    return res.json({
      message: "Utilizator autentificat.",
      user: publicUser(result.rows[0]),
    });
  } catch (error) {
    console.error("GET ME ERROR:", error);
    return res
      .status(500)
      .json({ message: "Profilul nu a putut fi încărcat." });
  }
};

module.exports = {
  register,
  login,
  logout,
  activateAccount,
  updateProfile,
  changePassword,
  updateAvatar,
  getAvatarImage,
  updatePreferences,
  getMe,
};
