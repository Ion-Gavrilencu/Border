
const pool = require("../config/database");
const { createAuditLog } = require("./auditController");
const { notifyUsers } = require("../services/notificationService");

const isValidLegislationId = (id) =>
  /^[1-9]\d*$/.test(String(id || ""));

// LISTA ACTELOR NORMATIVE
const getLegislation = async (req, res) => {
  try {
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
        u.full_name AS created_by_name,
        EXISTS (
          SELECT 1
          FROM legislation_favorites f
          WHERE f.legislation_id = l.id
            AND f.user_id = $1
        ) AS is_favorite,
        COALESCE(ac.attachments_count, 0)::integer
          AS attachments_count
      FROM legislatie l
      LEFT JOIN users u ON l.created_by = u.id
      LEFT JOIN (
        SELECT entity_id, COUNT(*) AS attachments_count
        FROM attachments
        WHERE entity_type = 'legislatie'
        GROUP BY entity_id
      ) ac ON ac.entity_id = l.id
      ORDER BY l.law_date DESC NULLS LAST, l.id DESC
      `,
      [req.user.id]
    );

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

    if (!isValidLegislationId(id)) {
      return res.status(400).json({
        message: "ID-ul actului normativ este invalid.",
      });
    }

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
        u.full_name AS created_by_name,
        EXISTS (
          SELECT 1
          FROM legislation_favorites f
          WHERE f.legislation_id = l.id
            AND f.user_id = $2
        ) AS is_favorite,
        (
          SELECT COUNT(*)::integer
          FROM attachments a
          WHERE a.entity_type = 'legislatie'
            AND a.entity_id = l.id
        ) AS attachments_count
      FROM legislatie l
      LEFT JOIN users u ON l.created_by = u.id
      WHERE l.id = $1
      `,
      [id, req.user.id]
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
    const { title, lawNumber, lawDate, content } = req.body || {};

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

    const legislation = result.rows[0];

    await createAuditLog({
      userId: req.user.id,
      action: "CREATE",
      entityType: "legislatie",
      entityId: legislation.id,
      description: `A creat actul normativ "${legislation.title}"`,
    });

    try {
      const lawNumberText = legislation.law_number
        ? ` nr. ${legislation.law_number}`
        : "";

      
await notifyUsers({
  actorId: req.user.id,
  title: "Act normativ nou",
  message:
    `A fost adăugat actul normativ${lawNumberText} ` +
    `„${legislation.title}”.`,
  type: "legislatie",
  link: `/legislatie?open=${legislation.id}`,
});

    } catch (notificationError) {
      console.error(
        "CREATE LEGISLATION NOTIFICATION ERROR:",
        notificationError
      );
    }

    return res.status(201).json({
      message: "Actul normativ a fost adăugat.",
      legislation,
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

    if (!isValidLegislationId(id)) {
      return res.status(400).json({
        message: "ID-ul actului normativ este invalid.",
      });
    }

    const { title, lawNumber, lawDate, content } = req.body || {};

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

    if (!isValidLegislationId(id)) {
      return res.status(400).json({
        message: "ID-ul actului normativ este invalid.",
      });
    }

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

// ADAUGĂ ACT NORMATIV LA FAVORITE
const addLegislationFavorite = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidLegislationId(id)) {
      return res.status(400).json({
        message: "ID-ul actului normativ este invalid.",
      });
    }

    const legislationResult = await pool.query(
      "SELECT id FROM legislatie WHERE id = $1",
      [id]
    );

    if (legislationResult.rows.length === 0) {
      return res.status(404).json({
        message: "Actul normativ nu a fost găsit.",
      });
    }

    await pool.query(
      `
      INSERT INTO legislation_favorites (
        user_id,
        legislation_id
      )
      VALUES ($1, $2)
      ON CONFLICT (user_id, legislation_id)
      DO NOTHING
      `,
      [req.user.id, id]
    );

    return res.status(200).json({
      message: "Actul normativ a fost adăugat la favorite.",
      legislation_id: Number(id),
      is_favorite: true,
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(404).json({
        message: "Actul normativ sau utilizatorul nu mai există.",
      });
    }

    console.error("ADD LEGISLATION FAVORITE ERROR:", error);

    return res.status(500).json({
      message: "Actul normativ nu a putut fi adăugat la favorite.",
    });
  }
};

// ELIMINĂ ACT NORMATIV DIN FAVORITE
const removeLegislationFavorite = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidLegislationId(id)) {
      return res.status(400).json({
        message: "ID-ul actului normativ este invalid.",
      });
    }

    await pool.query(
      `
      DELETE FROM legislation_favorites
      WHERE user_id = $1
        AND legislation_id = $2
      `,
      [req.user.id, id]
    );

    return res.status(200).json({
      message: "Actul normativ a fost eliminat din favorite.",
      legislation_id: Number(id),
      is_favorite: false,
    });
  } catch (error) {
    console.error("REMOVE LEGISLATION FAVORITE ERROR:", error);

    return res.status(500).json({
      message: "Actul normativ nu a putut fi eliminat din favorite.",
    });
  }
};

module.exports = {
  getLegislation,
  getLegislationById,
  createLegislation,
  updateLegislation,
  deleteLegislation,
  addLegislationFavorite,
  removeLegislationFavorite,
};
