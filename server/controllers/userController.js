const pool = require("../config/database");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendActivationEmail } = require("../services/emailService");

const createUser = async (req, res) => {
  try {
    const { username, email, fullName, role = "USER" } = req.body || {};

    const normalizedUsername = String(username || "").trim();
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const normalizedFullName = String(fullName || "").trim();

    if (!normalizedUsername || !normalizedEmail || !normalizedFullName) {
      return res.status(400).json({
        message: "Completează toate câmpurile obligatorii.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({
        message: "Adresa de e-mail este invalidă.",
      });
    }

    if (!["USER", "EDITOR", "ADMIN"].includes(role)) {
      return res.status(400).json({
        message: "Rol invalid.",
      });
    }

    // Generăm tokenul pentru activarea contului
    const activationToken = crypto.randomBytes(32).toString("hex");

    // În baza de date păstrăm numai hash-ul tokenului
    const activationTokenHash = crypto
      .createHash("sha256")
      .update(activationToken)
      .digest("hex");

    // Linkul va expira după 24 de ore
    const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Parolă aleatorie, necunoscută utilizatorului
    const randomPassword = crypto.randomBytes(32).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    const result = await pool.query(
      `
      INSERT INTO users (
        username,
        email,
        full_name,
        password_hash,
        role,
        is_active,
        activation_token_hash,
        activation_expires_at,
        must_change_password
      )
      VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7, TRUE)
      RETURNING
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        created_at
      `,
      [
        normalizedUsername,
        normalizedEmail,
        normalizedFullName,
        passwordHash,
        role,
        activationTokenHash,
        activationExpiresAt,
      ],
    );

    
    const activationLink = new URL(
      `${process.env.FRONTEND_URL.replace(/\/$/, "")}/activate`
    );

    activationLink.searchParams.set("token", activationToken);

    try {
      await sendActivationEmail({
        email: normalizedEmail,
        username: normalizedUsername,
        activationLink: activationLink.toString(),
      });
    } catch (emailError) {
      console.error("SEND ACTIVATION EMAIL ERROR:", emailError);

      return res.status(502).json({
        message:
          "Contul a fost creat, dar e-mailul de activare nu a putut fi trimis. Contactează administratorul pentru retrimiterea linkului.",
      });
    }

    return res.status(201).json({
      message: "Contul a fost creat. E-mailul de activare a fost trimis.",
      user: result.rows[0],
    });


    return res.status(201).json({
      message:
        "Contul a fost creat, dar activarea prin e-mail nu este încă disponibilă.",
      user: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({
        message: "Username-ul sau adresa de e-mail există deja.",
      });
    }

    console.error("CREATE USER ERROR:", error);

    return res.status(500).json({
      message: "Eroare la crearea utilizatorului.",
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
      FROM users
      ORDER BY id ASC
    `);

    return res.status(200).json({
      users: result.rows,
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea utilizatorilor.",
    });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body || {};
    if (Number(id) === Number(req.user.id) && role !== "ADMIN") {
      return res.status(400).json({
        message: "Nu îți poți modifica propriul rol de administrator.",
      });
    }
    const allowedRoles = ["USER", "EDITOR", "ADMIN"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Rol invalid.",
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET role = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
      `,
      [role, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Utilizatorul nu a fost găsit.",
      });
    }

    return res.status(200).json({
      message: "Rolul utilizatorului a fost actualizat.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE ROLE ERROR:", error);

    return res.status(500).json({
      message: "Eroare la modificarea rolului.",
    });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    if (Number(id) === Number(req.user.id) && isActive === false) {
      return res.status(400).json({
        message: "Nu îți poți dezactiva propriul cont de administrator.",
      });
    }
    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "Valoarea statusului este invalidă.",
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET is_active = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
      `,
      [isActive, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Utilizatorul nu a fost găsit.",
      });
    }

    return res.status(200).json({
      message: "Statusul utilizatorului a fost actualizat.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE STATUS ERROR:", error);

    return res.status(500).json({
      message: "Eroare la modificarea statusului.",
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(id) === req.user.id) {
      return res.status(400).json({
        message: "Nu îți poți șterge propriul cont.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, username
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Utilizatorul nu a fost găsit.",
      });
    }

    return res.status(200).json({
      message: "Utilizatorul a fost șters.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);

    return res.status(500).json({
      message: "Eroare la ștergerea utilizatorului.",
    });
  }
};

module.exports = {
  createUser,
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
};
