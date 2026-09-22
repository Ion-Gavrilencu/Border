const bcrypt = require("bcrypt");
const pool = require("../config/database");
const jwt = require("jsonwebtoken");

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
      [username, email]
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
      RETURNING id, username, email, full_name, role`,
      [username, email, passwordHash, fullName, "USER"]
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
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Date de autentificare incorecte.",
      });
    }

    const user = result.rows[0];

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

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
  },
  process.env.JWT_SECRET,
  {
    expiresIn: "8h",
  }
);

res.cookie("token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 8 * 60 * 60 * 1000,
});

return res.json({
  message: "Autentificare reușită.",
  user: {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.full_name,
    role: user.role,
  },
});

    return res.json({
      message: "Autentificare reușită.",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    return res.status(500).json({
      message: "Eroare la autentificare.",
    });
  }
};
const logout = (req, res) => {
  res.cookie("token", "", {
    httpOnly: true,
    expires: new Date(0),
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });

  return res.status(200).json({
    message: "Deconectare reușită.",
  });
};
module.exports = {
  register,
  login,
  logout,
};