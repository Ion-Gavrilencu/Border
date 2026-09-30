const pool = require("../config/database");
const { createAuditLog } = require("./auditController");

const getUsefulInfo = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        i.id,
        i.title,
        i.category,
        i.content,
        i.created_by,
        i.created_at,
        i.updated_at,
        u.username AS created_by_username,
        u.full_name AS created_by_name
      FROM informatii_utile i
      LEFT JOIN users u
        ON i.created_by = u.id
      ORDER BY i.created_at DESC, i.id DESC
    `);

    return res.status(200).json({
      informatii: result.rows,
    });
  } catch (error) {
    console.error("GET USEFUL INFO ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea informațiilor utile.",
    });
  }
};

const createUsefulInfo = async (req, res) => {
  try {
    const { title, category, content } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        message: "Titlul și conținutul sunt obligatorii.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO informatii_utile (
        title,
        category,
        content,
        created_by
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        title,
        category,
        content,
        created_by,
        created_at,
        updated_at
      `,
      [title, category || null, content, req.user.id],
    );

    await createAuditLog({
      userId: req.user.id,
      action: "CREATE",
      entityType: "informatii",
      entityId: result.rows[0].id,
      description: `A creat informația utilă "${result.rows[0].title}"`,
    });

    return res.status(201).json({
      message: "Informația utilă a fost adăugată.",
      informatie: result.rows[0],
    });
  } catch (error) {
    console.error("CREATE USEFUL INFO ERROR:", error);

    return res.status(500).json({
      message: "Eroare la adăugarea informației utile.",
    });
  }
};

const updateUsefulInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const { title, category, content } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        message: "Titlul și conținutul sunt obligatorii.",
      });
    }

    const result = await pool.query(
      `
      UPDATE informatii_utile
      SET
        title = $1,
        category = $2,
        content = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING
        id,
        title,
        category,
        content,
        created_by,
        created_at,
        updated_at
      `,
      [title, category || null, content, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Informația utilă nu a fost găsită.",
      });
    }

    await createAuditLog({
      userId: req.user.id,
      action: "UPDATE",
      entityType: "informatii",
      entityId: result.rows[0].id,
      description: `A modificat informația utilă "${result.rows[0].title}"`,
    });

    return res.status(200).json({
      message: "Informația utilă a fost actualizată.",
      informatie: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE USEFUL INFO ERROR:", error);

    return res.status(500).json({
      message: "Eroare la actualizarea informației utile.",
    });
  }
};

const deleteUsefulInfo = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM informatii_utile
      WHERE id = $1
      RETURNING id, title
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Informația utilă nu a fost găsită.",
      });
    }

    await createAuditLog({
      userId: req.user.id,
      action: "DELETE",
      entityType: "informatii",
      entityId: result.rows[0].id,
      description: `A șters informația utilă "${result.rows[0].title}"`,
    });

    return res.status(200).json({
      message: "Informația utilă a fost ștearsă.",
      informatie: result.rows[0],
    });
  } catch (error) {
    console.error("DELETE USEFUL INFO ERROR:", error);

    return res.status(500).json({
      message: "Eroare la ștergerea informației utile.",
    });
  }
};

const getUsefulInfoById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        i.id,
        i.title,
        i.category,
        i.content,
        i.created_by,
        i.created_at,
        i.updated_at,
        u.username AS created_by_username,
        u.full_name AS created_by_name
      FROM informatii_utile i
      LEFT JOIN users u
        ON i.created_by = u.id
      WHERE i.id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Informația utilă nu a fost găsită.",
      });
    }

    return res.status(200).json({
      informatie: result.rows[0],
    });
  } catch (error) {
    console.error("GET USEFUL INFO BY ID ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea informației utile.",
    });
  }
};

module.exports = {
  getUsefulInfo,
  getUsefulInfoById,
  createUsefulInfo,
  updateUsefulInfo,
  deleteUsefulInfo,
};