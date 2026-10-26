
const pool = require("../config/database");
const { createAuditLog } = require("./auditController");

// LISTA ACTELOR NORMATIVE
const getLegislation = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.id,
        l.title,
        l.law_number,
        l.law_date,
        l.content,
        l.created_by,
        l.created_at,
        l.updated_at,
        u.username AS created_by_username,
        u.full_name AS created_by_name
      FROM legislatie l
      LEFT JOIN users u ON l.created_by = u.id
      ORDER BY l.law_date DESC NULLS LAST, l.id DESC
    `);

    return res.status(200).json({
      legislatie: result.rows,
    });
  } catch (error) {
    console.error("GET LEGISLATION ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea legislației.",
    });
  }
};

// DETALII ACT NORMATIV
const getLegislationById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        l.id,
        l.title,
        l.law_number,
        l.law_date,
        l.content,
        l.created_by,
        l.created_at,
        l.updated_at,
        u.username AS created_by_username,
        u.full_name AS created_by_name
      FROM legislatie l
      LEFT JOIN users u ON l.created_by = u.id
      WHERE l.id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Actul normativ nu a fost găsit.",
      });
    }

    return res.status(200).json({
      legislation: result.rows[0],
    });
  } catch (error) {
    console.error("GET LEGISLATION BY ID ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea actului normativ.",
    });
  }
};

// ADAUGĂ ACT NORMATIV
const createLegislation = async (req, res) => {
  try {
    const {
      title,
      lawNumber,
      lawDate,
      content,
    } = req.body || {};

    // Doar denumirea este obligatorie.
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Denumirea actului normativ este obligatorie.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO legislatie (
        title,
        law_number,
        law_date,
        content,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        title,
        law_number,
        law_date,
        content,
        created_by,
        created_at,
        updated_at
      `,
      [
        title.trim(),
        typeof lawNumber === "string"
          ? lawNumber.trim() || null
          : null,
        lawDate || null,
        typeof content === "string" ? content : "",
        req.user.id,
      ]
    );

    await createAuditLog({
      userId: req.user.id,
      action: "CREATE",
      entityType: "legislatie",
      entityId: result.rows[0].id,
      description:
        `A creat actul normativ "${result.rows[0].title}"`,
    });

    return res.status(201).json({
      message: "Actul normativ a fost adăugat.",
      legislation: result.rows[0],
    });
  } catch (error) {
    console.error("CREATE LEGISLATION ERROR:", error);

    return res.status(500).json({
      message: "Eroare la adăugarea actului normativ.",
    });
  }
};

// MODIFICĂ ACT NORMATIV
const updateLegislation = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      title,
      lawNumber,
      lawDate,
      content,
    } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Denumirea actului normativ este obligatorie.",
      });
    }

    const result = await pool.query(
      `
      UPDATE legislatie
      SET
        title = $1,
        law_number = $2,
        law_date = $3,
        content = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING
        id,
        title,
        law_number,
        law_date,
        content,
        created_by,
        created_at,
        updated_at
      `,
      [
        title.trim(),
        typeof lawNumber === "string"
          ? lawNumber.trim() || null
          : null,
        lawDate || null,
        typeof content === "string" ? content : "",
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Actul normativ nu a fost găsit.",
      });
    }

    await createAuditLog({
      userId: req.user.id,
      action: "UPDATE",
      entityType: "legislatie",
      entityId: result.rows[0].id,
      description:
        `A modificat actul normativ "${result.rows[0].title}"`,
    });

    return res.status(200).json({
      message: "Actul normativ a fost actualizat.",
      legislation: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE LEGISLATION ERROR:", error);

    return res.status(500).json({
      message: "Eroare la actualizarea actului normativ.",
    });
  }
};

// ȘTERGE ACT NORMATIV
const deleteLegislation = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM legislatie
      WHERE id = $1
      RETURNING id, title
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Actul normativ nu a fost găsit.",
      });
    }

    await createAuditLog({
      userId: req.user.id,
      action: "DELETE",
      entityType: "legislatie",
      entityId: result.rows[0].id,
      description:
        `A șters actul normativ "${result.rows[0].title}"`,
    });

    return res.status(200).json({
      message: "Actul normativ a fost șters.",
      legislation: result.rows[0],
    });
  } catch (error) {
    console.error("DELETE LEGISLATION ERROR:", error);

    return res.status(500).json({
      message: "Eroare la ștergerea actului normativ.",
    });
  }
};

module.exports = {
  getLegislation,
  getLegislationById,
  createLegislation,
  updateLegislation,
  deleteLegislation,
};
