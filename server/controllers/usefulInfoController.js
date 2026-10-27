
const pool = require("../config/database");
const { createAuditLog } = require("./auditController");
const { notifyUsers } = require("../services/notificationService");

// LISTA INFORMAȚIILOR UTILE
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

// DETALII INFORMAȚIE UTILĂ
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

// ADAUGĂ INFORMAȚIE UTILĂ
const createUsefulInfo = async (req, res) => {
  try {
    const { title, category, content } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Titlul informației este obligatoriu.",
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
      [
        title.trim(),
        typeof category === "string"
          ? category.trim() || null
          : null,
        typeof content === "string" ? content : "",
        req.user.id,
      ],
    );

    const informatie = result.rows[0];

    // ÎNREGISTRARE ÎN JURNALUL DE AUDIT
    await createAuditLog({
      userId: req.user.id,
      action: "CREATE",
      entityType: "informatii",
      entityId: informatie.id,
      description:
        `A creat informația utilă "${informatie.title}"`,
    });

    // NOTIFICARE AUTOMATĂ PENTRU INFORMAȚIE NOUĂ
    try {
      const categoryText = informatie.category
        ? ` în categoria „${informatie.category}”`
        : "";

      await notifyUsers({
        actorId: req.user.id,
        title: "Informație utilă nouă",
        message:
          `A fost adăugată informația „${informatie.title}”` +
          `${categoryText}.`,
        type: "informatii",
        link: `/informatii-utile/${informatie.id}`,
      });
    } catch (notificationError) {
      // Informația rămâne salvată dacă notificarea eșuează.
      console.error(
        "CREATE USEFUL INFO NOTIFICATION ERROR:",
        notificationError,
      );
    }

    return res.status(201).json({
      message: "Informația utilă a fost adăugată.",
      informatie,
    });
  } catch (error) {
    console.error("CREATE USEFUL INFO ERROR:", error);

    return res.status(500).json({
      message: "Eroare la adăugarea informației utile.",
    });
  }
};

// MODIFICĂ INFORMAȚIE UTILĂ
const updateUsefulInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, content } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Titlul informației este obligatoriu.",
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
      [
        title.trim(),
        typeof category === "string"
          ? category.trim() || null
          : null,
        typeof content === "string" ? content : "",
        id,
      ],
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
      description:
        `A modificat informația utilă "${result.rows[0].title}"`,
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

// ȘTERGE INFORMAȚIE UTILĂ
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
      description:
        `A șters informația utilă "${result.rows[0].title}"`,
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

module.exports = {
  getUsefulInfo,
  getUsefulInfoById,
  createUsefulInfo,
  updateUsefulInfo,
  deleteUsefulInfo,
};
