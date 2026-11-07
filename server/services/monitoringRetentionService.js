const pool = require("../config/database");

const SETTINGS_KEY = "monitoring_events";

async function getRetentionSettings() {
  const result = await pool.query(
    `SELECT retention_days, last_cleanup_at, last_deleted_count
       FROM monitoring_retention_settings WHERE setting_key = $1`,
    [SETTINGS_KEY],
  );
  if (!result.rows.length) throw new Error("Rulați mai întâi migrarea SQL pentru retenție.");
  return result.rows[0];
}

async function setRetentionDays(days) {
  const result = await pool.query(
    `UPDATE monitoring_retention_settings SET retention_days = $1, updated_at = NOW()
     WHERE setting_key = $2
     RETURNING retention_days, last_cleanup_at, last_deleted_count`,
    [days, SETTINGS_KEY],
  );
  if (!result.rows.length) throw new Error("Lipsește configurarea inițială SQL.");
  return result.rows[0];
}

async function cleanupMonitoringEvents() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Împiedică două execuții concurente, inclusiv în instanțe Vercel diferite.
    const lock = await client.query("SELECT pg_try_advisory_xact_lock(4391, 2027) AS acquired");
    if (!lock.rows[0].acquired) {
      await client.query("ROLLBACK");
      return { skipped: true, reason: "Curățarea este deja în curs." };
    }
    const settings = await client.query(
      `SELECT retention_days FROM monitoring_retention_settings
       WHERE setting_key = $1 FOR UPDATE`,
      [SETTINGS_KEY],
    );
    if (!settings.rows.length) throw new Error("Lipsește migrarea SQL pentru retenție.");
    const days = Number(settings.rows[0].retention_days);
    // Ștergere în loturi pentru a evita interogările lungi pe Vercel/Neon.
    const deleted = await client.query(
      `WITH old_rows AS (
         SELECT id FROM monitoring_events
         WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')
         ORDER BY created_at ASC, id ASC LIMIT 1000
       )
       DELETE FROM monitoring_events e USING old_rows o WHERE e.id = o.id`,
      [days],
    );
    await client.query(
      `UPDATE monitoring_retention_settings
       SET last_cleanup_at = NOW(), last_deleted_count = $1, updated_at = NOW()
       WHERE setting_key = $2`,
      [deleted.rowCount, SETTINGS_KEY],
    );
    await client.query("COMMIT");
    return {
      ok: true,
      retention_days: days,
      deleted: deleted.rowCount,
      more_possible: deleted.rowCount === 1000,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
module.exports = { getRetentionSettings, setRetentionDays, cleanupMonitoringEvents };
