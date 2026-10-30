const pool = require("../config/database");

const ACTIVE_INTERVAL = "2 minutes";

// =====================================================
// ÎNREGISTRAREA ACTIVITĂȚILOR
// =====================================================

async function logMonitoringEvent({
  userId,
  action,
  details = null,
  req = null,
}) {
  if (!userId || !action) return;

  try {
    await pool.query(
      `INSERT INTO monitoring_events
       (user_id, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        userId,
        action,
        details,
        req?.ip || null,
        req?.get?.("user-agent") || null,
      ],
    );
  } catch (error) {
    console.error("MONITORING LOG ERROR:", error);
  }
}

// =====================================================
// COMPATIBILITATE CU SISTEMUL EXISTENT
// =====================================================

async function touchPresence(req) {
  const userId = req.user?.id;

  if (!userId) return;

  await pool.query(
    `INSERT INTO monitoring_presence
     (
       user_id,
       last_seen_at,
       session_started_at,
       user_agent,
       ip_address,
       logged_out_at
     )
     VALUES ($1, NOW(), NOW(), $2, $3, NULL)
     ON CONFLICT (user_id)
     DO UPDATE SET
       last_seen_at = NOW(),
       user_agent = EXCLUDED.user_agent,
       ip_address = EXCLUDED.ip_address,
       logged_out_at = NULL,
       session_started_at =
         CASE
           WHEN monitoring_presence.logged_out_at IS NOT NULL
             OR monitoring_presence.last_seen_at
                < NOW() - INTERVAL '2 minutes'
           THEN NOW()
           ELSE monitoring_presence.session_started_at
         END`,
    [userId, req.get("user-agent") || null, req.ip || null],
  );
}

async function markUserOffline(userId) {
  if (!userId) return;

  await pool.query(
    `UPDATE monitoring_presence
     SET logged_out_at = NOW(),
         last_seen_at = NOW()
     WHERE user_id = $1`,
    [userId],
  );
}

// =====================================================
// CREAREA UNEI SESIUNI INDIVIDUALE
// =====================================================

async function createMonitoringSession({ sessionId, userId, expiresAt, req }) {
  if (!sessionId || !userId || !expiresAt) {
    throw new Error("Datele sesiunii sunt incomplete.");
  }

  const result = await pool.query(
    `INSERT INTO monitoring_sessions
     (
       session_id,
       user_id,
       started_at,
       last_seen_at,
       expires_at,
       user_agent,
       ip_address
     )
     VALUES ($1, $2, NOW(), NOW(), $3, $4, $5)
     RETURNING session_id`,
    [
      sessionId,
      userId,
      expiresAt,
      req?.get?.("user-agent") || null,
      req?.ip || null,
    ],
  );

  return result.rows[0];
}

// =====================================================
// ACTUALIZAREA UNEI SESIUNI
// =====================================================

async function touchMonitoringSession({ sessionId, userId, req }) {
  if (!sessionId || !userId) return false;

  const result = await pool.query(
    `UPDATE monitoring_sessions
     SET last_seen_at = NOW(),
         user_agent = $3,
         ip_address = $4
     WHERE session_id = $1
       AND user_id = $2
       AND logged_out_at IS NULL
       AND expires_at > NOW()
     RETURNING session_id`,
    [sessionId, userId, req?.get?.("user-agent") || null, req?.ip || null],
  );

  return result.rowCount > 0;
}

// =====================================================
// ÎNCHIDEREA UNEI SINGURE SESIUNI
// =====================================================

async function closeMonitoringSession({ sessionId, userId }) {
  if (!sessionId || !userId) return false;

  const result = await pool.query(
    `UPDATE monitoring_sessions
     SET logged_out_at = NOW()
     WHERE session_id = $1
       AND user_id = $2
       AND logged_out_at IS NULL
     RETURNING session_id`,
    [sessionId, userId],
  );

  return result.rowCount > 0;
}

// =====================================================
// VERIFICAREA SESIUNII
// =====================================================

async function isMonitoringSessionValid({ sessionId, userId }) {
  if (!sessionId || !userId) return false;

  const result = await pool.query(
    `SELECT 1
     FROM monitoring_sessions
     WHERE session_id = $1
       AND user_id = $2
       AND logged_out_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [sessionId, userId],
  );

  return result.rowCount > 0;
}

// =====================================================
// NUMĂRUL SESIUNILOR ACTIVE RECENT
// =====================================================

async function countActiveSessions(userId) {
  if (!userId) return 0;

  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM monitoring_sessions
     WHERE user_id = $1
       AND logged_out_at IS NULL
       AND expires_at > NOW()
       AND last_seen_at >= NOW() - INTERVAL '${ACTIVE_INTERVAL}'`,
    [userId],
  );

  return result.rows[0]?.total || 0;
}

module.exports = {
  logMonitoringEvent,
  touchPresence,
  markUserOffline,
  createMonitoringSession,
  touchMonitoringSession,
  closeMonitoringSession,
  isMonitoringSessionValid,
  countActiveSessions,
};
