const pool = require("../config/database");

const createAuditLog = async ({
  userId,
  action,
  entityType,
  entityId = null,
  description = null,
}) => {
  try {
    await pool.query(
      `
      INSERT INTO audit_logs (
        user_id,
        action,
        entity_type,
        entity_id,
        description
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        userId,
        action,
        entityType,
        entityId,
        description,
      ]
    );
  } catch (error) {
    console.error("CREATE AUDIT LOG ERROR:", error);
  }
};

const getAuditLogs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.id,
        a.action,
        a.entity_type,
        a.entity_id,
        a.description,
        a.created_at,

        u.username,
        u.full_name

      FROM audit_logs a

      LEFT JOIN users u
        ON a.user_id = u.id

      ORDER BY a.created_at DESC

      LIMIT 200
    `);

    return res.status(200).json({
      logs: result.rows,
    });
  } catch (error) {
    console.error("GET AUDIT LOGS ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea jurnalului de activitate.",
    });
  }
};

module.exports = {
  createAuditLog,
  getAuditLogs,
};