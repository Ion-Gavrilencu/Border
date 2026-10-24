
const jwt = require("jsonwebtoken");
const pool = require("../config/database");

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({
        message: "Nu ești autentificat.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const result = await pool.query(
      `SELECT
         id,
         username,
         email,
         full_name,
         role,
         is_active,
         session_version
       FROM users
       WHERE id = $1`,
      [decoded.id]
    );

    if (
      result.rows.length === 0 ||
      !result.rows[0].is_active
    ) {
      return res.status(401).json({
        message: "Contul este inactiv sau nu mai există.",
      });
    }

    const user = result.rows[0];

    // Verificăm dacă sesiunea mai este valabilă
    if (
      !Number.isInteger(decoded.sessionVersion) ||
      decoded.sessionVersion !== user.session_version
    ) {
      return res.status(401).json({
        message:
          "Sesiunea a fost invalidată. Autentifică-te din nou.",
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
    };

    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        message: "Sesiunea este invalidă sau a expirat.",
      });
    }

    console.error("AUTH MIDDLEWARE ERROR:", error);

    return res.status(500).json({
      message: "Eroare la verificarea autentificării.",
    });
  }
};

module.exports = authenticate;
