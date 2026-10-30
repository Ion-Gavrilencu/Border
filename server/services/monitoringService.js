const pool = require('../config/database');

async function logMonitoringEvent({ userId, action, details = null, req = null }) {
  if (!userId || !action) return;
  try {
    await pool.query(
      `INSERT INTO monitoring_events (user_id, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, details, req?.ip || null, req?.get?.('user-agent') || null]
    );
  } catch (error) {
    console.error('MONITORING LOG ERROR:', error);
  }
}

async function touchPresence(req) {
  const userId = req.user?.id;
  if (!userId) return;
  await pool.query(
    `INSERT INTO monitoring_presence (user_id, last_seen_at, session_started_at, user_agent, ip_address)
     VALUES ($1, NOW(), NOW(), $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET last_seen_at = NOW(), user_agent = EXCLUDED.user_agent, ip_address = EXCLUDED.ip_address`,
    [userId, req.get('user-agent') || null, req.ip || null]
  );
}

module.exports = { logMonitoringEvent, touchPresence };
