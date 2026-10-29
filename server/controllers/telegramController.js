const pool = require("../config/database");
const { createAuditLog } = require("./auditController");
const { notifyUsers } = require("../services/notificationService");

const validId = (id) => /^[1-9]\d*$/.test(String(id ?? ""));
const invalidId = (res) => res.status(400).json({ message: "ID-ul telegramei este invalid." });

const getTelegrame = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.id, t.title, t.number, t.telegram_date, t.content,
             t.created_by, t.created_at, t.updated_at,
             u.username AS created_by_username, u.full_name AS created_by_name,
             EXISTS (SELECT 1 FROM telegram_favorites f
                     WHERE f.telegram_id = t.id AND f.user_id = $1) AS is_favorite,
             COALESCE(ac.attachments_count, 0)::integer AS attachments_count
      FROM telegrame t
      LEFT JOIN users u ON u.id = t.created_by
      LEFT JOIN (
        SELECT entity_id, COUNT(*) AS attachments_count
        FROM attachments WHERE entity_type = 'telegrame'
        GROUP BY entity_id
      ) ac ON ac.entity_id = t.id
      ORDER BY t.telegram_date DESC NULLS LAST, t.id DESC
    `, [req.user.id]);
    return res.status(200).json({ telegrame: result.rows });
  } catch (error) {
    console.error("GET TELEGRAME ERROR:", error);
    return res.status(500).json({ message: "Eroare la încărcarea telegramelor." });
  }
};

const getTelegramById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return invalidId(res);
    const result = await pool.query(`
      SELECT t.id, t.title, t.number, t.telegram_date, t.content,
             t.created_by, t.created_at, t.updated_at,
             u.username AS created_by_username, u.full_name AS created_by_name,
             EXISTS (SELECT 1 FROM telegram_favorites f
                     WHERE f.telegram_id = t.id AND f.user_id = $2) AS is_favorite,
             (SELECT COUNT(*)::integer FROM attachments a
              WHERE a.entity_type = 'telegrame' AND a.entity_id = t.id) AS attachments_count
      FROM telegrame t
      LEFT JOIN users u ON u.id = t.created_by
      WHERE t.id = $1
    `, [id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ message: "Telegrama nu a fost găsită." });
    return res.status(200).json({ telegram: result.rows[0] });
  } catch (error) {
    console.error("GET TELEGRAM BY ID ERROR:", error);
    return res.status(500).json({ message: "Eroare la încărcarea telegramei." });
  }
};

const createTelegram = async (req, res) => {
  try {
    const { title, number, telegramDate, content } = req.body || {};
    if (typeof title !== "string" || !title.trim())
      return res.status(400).json({ message: "Denumirea telegramei este obligatorie." });
    const result = await pool.query(`
      INSERT INTO telegrame (title, number, telegram_date, content, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, title, number, telegram_date, content, created_by, created_at, updated_at
    `, [title.trim(), typeof number === "string" ? number.trim() || null : null,
      telegramDate || null, typeof content === "string" ? content : "", req.user.id]);
    const telegram = result.rows[0];
    await createAuditLog({ userId: req.user.id, action: "CREATE", entityType: "telegrama",
      entityId: telegram.id, description: `A creat telegrama "${telegram.title}"` });
    try {
      await notifyUsers({ actorId: req.user.id, title: "Telegramă nouă",
        message: `A fost adăugată telegrama „${telegram.title}”.`,
        type: "telegrama", link: `/telegrame/${telegram.id}` });
    } catch (error) { console.error("CREATE TELEGRAM NOTIFICATION ERROR:", error); }
    return res.status(201).json({ message: "Telegrama a fost adăugată.", telegram });
  } catch (error) {
    console.error("CREATE TELEGRAM ERROR:", error);
    return res.status(500).json({ message: "Eroare la adăugarea telegramei." });
  }
};

const updateTelegram = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return invalidId(res);
    const { title, number, telegramDate, content } = req.body || {};
    if (typeof title !== "string" || !title.trim())
      return res.status(400).json({ message: "Denumirea telegramei este obligatorie." });
    const result = await pool.query(`
      UPDATE telegrame SET title = $1, number = $2, telegram_date = $3,
        content = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5
      RETURNING id, title, number, telegram_date, content, created_by, created_at, updated_at
    `, [title.trim(), typeof number === "string" ? number.trim() || null : null,
      telegramDate || null, typeof content === "string" ? content : "", id]);
    if (!result.rows.length) return res.status(404).json({ message: "Telegrama nu a fost găsită." });
    const telegram = result.rows[0];
    await createAuditLog({ userId: req.user.id, action: "UPDATE", entityType: "telegrama",
      entityId: telegram.id, description: `A modificat telegrama "${telegram.title}"` });
    return res.status(200).json({ message: "Telegrama a fost actualizată.", telegram });
  } catch (error) {
    console.error("UPDATE TELEGRAM ERROR:", error);
    return res.status(500).json({ message: "Eroare la actualizarea telegramei." });
  }
};

const deleteTelegram = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return invalidId(res);
    const result = await pool.query("DELETE FROM telegrame WHERE id = $1 RETURNING id, title", [id]);
    if (!result.rows.length) return res.status(404).json({ message: "Telegrama nu a fost găsită." });
    await createAuditLog({ userId: req.user.id, action: "DELETE", entityType: "telegrama",
      entityId: Number(id), description: `A șters telegrama cu ID ${id}` });
    return res.status(200).json({ message: "Telegrama a fost ștearsă.", telegram: result.rows[0] });
  } catch (error) {
    console.error("DELETE TELEGRAM ERROR:", error);
    return res.status(500).json({ message: "Eroare la ștergerea telegramei." });
  }
};

const addTelegramFavorite = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return invalidId(res);
    const found = await pool.query("SELECT id FROM telegrame WHERE id = $1", [id]);
    if (!found.rows.length) return res.status(404).json({ message: "Telegrama nu a fost găsită." });
    await pool.query(`INSERT INTO telegram_favorites (user_id, telegram_id)
      VALUES ($1, $2) ON CONFLICT (user_id, telegram_id) DO NOTHING`, [req.user.id, id]);
    return res.status(200).json({ message: "Telegrama a fost adăugată la favorite.",
      telegram_id: Number(id), is_favorite: true });
  } catch (error) {
    if (error.code === "23503") return res.status(404).json({ message: "Telegrama sau utilizatorul nu mai există." });
    console.error("ADD TELEGRAM FAVORITE ERROR:", error);
    return res.status(500).json({ message: "Telegrama nu a putut fi adăugată la favorite." });
  }
};

const removeTelegramFavorite = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validId(id)) return invalidId(res);
    await pool.query("DELETE FROM telegram_favorites WHERE user_id = $1 AND telegram_id = $2", [req.user.id, id]);
    return res.status(200).json({ message: "Telegrama a fost eliminată din favorite.",
      telegram_id: Number(id), is_favorite: false });
  } catch (error) {
    console.error("REMOVE TELEGRAM FAVORITE ERROR:", error);
    return res.status(500).json({ message: "Telegrama nu a putut fi eliminată din favorite." });
  }
};

module.exports = { getTelegrame, getTelegramById, createTelegram, updateTelegram,
  deleteTelegram, addTelegramFavorite, removeTelegramFavorite };
