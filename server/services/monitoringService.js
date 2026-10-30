
const pool = require("../config/database");

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
    [
      userId,
      req.get("user-agent") || null,
      req.ip || null,
    ],
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

module.exports = {
  logMonitoringEvent,
  touchPresence,
  markUserOffline,
};
