const pool = require("../config/database");
const { createAuditLog } = require("./auditController");
const getTelegrame = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id,
        t.title,
        t.number,
        t.telegram_date,
        t.content,
        t.created_by,
        t.created_at,
        t.updated_at,
        u.username AS created_by_username,
        u.full_name AS created_by_name
      FROM telegrame t
      LEFT JOIN users u
        ON t.created_by = u.id
      ORDER BY t.telegram_date DESC NULLS LAST, t.id DESC
    `);

    return res.status(200).json({
      telegrame: result.rows,
    });
  } catch (error) {
    console.error("GET TELEGRAME ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea telegramelor.",
    });
  }
};

const getTelegramById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT
        t.id,
        t.title,
        t.number,
        t.telegram_date,
        t.content,
        t.created_by,
        t.created_at,
        t.updated_at,
        u.username AS created_by_username,
        u.full_name AS created_by_name
      FROM telegrame t
      LEFT JOIN users u
        ON t.created_by = u.id
      WHERE t.id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Telegrama nu a fost găsită.",
      });
    }

    return res.status(200).json({
      telegram: result.rows[0],
    });
  } catch (error) {
    console.error("GET TELEGRAM BY ID ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea telegramei.",
    });
  }
};

const createTelegram = async (req, res) => {
  try {
    const { title, number, telegramDate, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        message: "Titlul și conținutul sunt obligatorii.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO telegrame (
        title,
        number,
        telegram_date,
        content,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        title,
        number,
        telegram_date,
        content,
        created_by,
        created_at,
        updated_at
      `,
      [title, number || null, telegramDate || null, content, req.user.id],
    );

    await createAuditLog({
      userId: req.user.id,
      action: "CREATE",
      entityType: "telegrama",
      entityId: result.rows[0].id,
      description: `A creat telegrama "${result.rows[0].title}"`,
    });

    return res.status(201).json({
      message: "Telegrama a fost adăugată.",
      telegram: result.rows[0],
    });
  } catch (error) {
    console.error("CREATE TELEGRAM ERROR:", error);

    return res.status(500).json({
      message: "Eroare la adăugarea telegramei.",
    });
  }
};

const updateTelegram = async (req, res) => {
  try {
    const { id } = req.params;

    const { title, number, telegramDate, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        message: "Titlul și conținutul sunt obligatorii.",
      });
    }

    const result = await pool.query(
      `
      UPDATE telegrame
      SET
        title = $1,
        number = $2,
        telegram_date = $3,
        content = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING
        id,
        title,
        number,
        telegram_date,
        content,
        created_by,
        created_at,
        updated_at
      `,
      [title, number || null, telegramDate || null, content, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Telegrama nu a fost găsită.",
      });
    }

    await createAuditLog({
      userId: req.user.id,
      action: "UPDATE",
      entityType: "telegrama",
      entityId: result.rows[0].id,
      description: `A modificat telegrama "${result.rows[0].title}"`,
    });

    return res.status(200).json({
      message: "Telegrama a fost actualizată.",
      telegram: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE TELEGRAM ERROR:", error);

    return res.status(500).json({
      message: "Eroare la actualizarea telegramei.",
    });
  }
};

const deleteTelegram = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM telegrame
      WHERE id = $1
      RETURNING id, title
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Telegrama nu a fost găsită.",
      });
    }

    await createAuditLog({
      userId: req.user.id,
      action: "DELETE",
      entityType: "telegrama",
      entityId: Number(id),
      description: `A șters telegrama cu ID ${id}`,
    }); 
    
    return res.status(200).json({
      message: "Telegrama a fost ștearsă.",
      telegram: result.rows[0],
    });
  } catch (error) {
    console.error("DELETE TELEGRAM ERROR:", error);

    return res.status(500).json({
      message: "Eroare la ștergerea telegramei.",
    });
  }
};

module.exports = {
  getTelegrame,
  getTelegramById,
  createTelegram,
  updateTelegram,
  deleteTelegram,
};
