const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const { isMonitoringSessionValid } = require("../services/monitoringService");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Nu ești autentificat." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (
      !Number.isSafeInteger(decoded.id) ||
      !Number.isInteger(decoded.sessionVersion) ||
      typeof decoded.sessionId !== "string" ||
      !UUID_PATTERN.test(decoded.sessionId)
    ) {
      return res.status(401).json({
        message: "Sesiunea este invalidă. Autentifică-te din nou.",
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         username,
         email,
         full_name,
         role,
         is_active,
         session_version,
         email_notifications,
         CASE
           WHEN avatar_data IS NOT NULL THEN
             '/api/auth/avatar-image/' || id || '?v=' ||
             (EXTRACT(EPOCH FROM COALESCE(avatar_updated_at, created_at)) * 1000)::bigint::text
           ELSE NULL
         END AS avatar_url
       FROM users
       WHERE id = $1`,
      [decoded.id],
    );

    if (!result.rows.length || !result.rows[0].is_active) {
      return res.status(401).json({
        message: "Contul este inactiv sau nu mai există.",
      });
    }

    const user = result.rows[0];

    if (decoded.sessionVersion !== user.session_version) {
      return res.status(401).json({
        message: "Sesiunea a fost invalidată. Autentifică-te din nou.",
      });
    }

    const validSession = await isMonitoringSessionValid({
      sessionId: decoded.sessionId,
      userId: user.id,
    });

    if (!validSession) {
      return res.status(401).json({
        message:
          "Sesiunea a expirat sau a fost închisă. Autentifică-te din nou.",
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      avatarUrl: user.avatar_url,
      emailNotifications: user.email_notifications,
      sessionId: decoded.sessionId,
    };

    return next();
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
