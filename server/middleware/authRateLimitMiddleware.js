"use strict";

const crypto = require("node:crypto");
const pool = require("../config/database");

// Persistență în PostgreSQL: funcționează între instanțele Vercel serverless.
// Limitele se aplică per IP și per endpoint, nu blochează permanent conturi.
const makeAuthRateLimiter = ({ action, maxAttempts, windowMinutes = 15 }) => {
  if (!/^[a-z_-]+$/.test(action)) throw new Error("Acțiune invalidă pentru limitator.");

  return async (req, res, next) => {
    try {
      // req.ip folosește adresa furnizată de infrastructura proxy de încredere.
      const ip = req.ip || req.socket?.remoteAddress || "unknown";
      const clientHash = crypto.createHash("sha256").update(ip).digest("hex");
      const result = await pool.query(
        `INSERT INTO auth_rate_limits (action, client_hash, attempts, window_started_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (action, client_hash)
         DO UPDATE SET
           attempts = CASE
             WHEN auth_rate_limits.window_started_at <= NOW() - ($3::int * INTERVAL '1 minute')
             THEN 1 ELSE auth_rate_limits.attempts + 1 END,
           window_started_at = CASE
             WHEN auth_rate_limits.window_started_at <= NOW() - ($3::int * INTERVAL '1 minute')
             THEN NOW() ELSE auth_rate_limits.window_started_at END
         RETURNING attempts, window_started_at`,
        [action, clientHash, windowMinutes],
      );

      const { attempts, window_started_at: startedAt } = result.rows[0];
      if (attempts > maxAttempts) {
        const retrySeconds = Math.max(
          1,
          Math.ceil((new Date(startedAt).getTime() + windowMinutes * 60000 - Date.now()) / 1000),
        );
        res.set("Retry-After", String(retrySeconds));
        return res.status(429).json({
          message: "Prea multe încercări. Încearcă din nou mai târziu.",
        });
      }
      return next();
    } catch (error) {
      // Pentru endpointurile sensibile, nu ocolim protecția dacă stocarea e indisponibilă.
      console.error("AUTH RATE LIMIT ERROR:", error);
      return res.status(503).json({
        message: "Autentificarea este temporar indisponibilă. Încearcă mai târziu.",
      });
    }
  };
};

const loginRateLimit = makeAuthRateLimiter({ action: "login", maxAttempts: 10 });
const activationRateLimit = makeAuthRateLimiter({ action: "activate", maxAttempts: 8 });

module.exports = { loginRateLimit, activationRateLimit };
