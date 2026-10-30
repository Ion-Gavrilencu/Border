const pool = require("../config/database");
const { createAuditLog } = require("./auditController");
const { notifyUsers } = require("../services/notificationService");

const getUsefulInfo = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.title, i.category, i.content, i.created_by,
        i.created_at, i.updated_at,
        u.username AS created_by_username, u.full_name AS created_by_name,
        EXISTS (
          SELECT 1 FROM useful_info_favorites f
          WHERE f.info_id = i.id AND f.user_id = $1
        ) AS is_favorite
      FROM informatii_utile i
      LEFT JOIN users u ON i.created_by = u.id
      ORDER BY i.created_at DESC, i.id DESC
    `, [req.user.id]);
    return res.status(200).json({ informatii: result.rows });
  } catch (error) {
    console.error("GET USEFUL INFO ERROR:", error);
    return res.status(500).json({ message: "Eroare la încărcarea informațiilor utile." });
  }
};

const getUsefulInfoById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT i.id, i.title, i.category, i.content, i.created_by,
        i.created_at, i.updated_at,
        u.username AS created_by_username, u.full_name AS created_by_name,
        EXISTS (
          SELECT 1 FROM useful_info_favorites f
          WHERE f.info_id = i.id AND f.user_id = $2
        ) AS is_favorite
      FROM informatii_utile i
      LEFT JOIN users u ON i.created_by = u.id
      WHERE i.id = $1
    `, [id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ message: "Informația utilă nu a fost găsită." });
    return res.status(200).json({ informatie: result.rows[0] });
  } catch (error) {
    console.error("GET USEFUL INFO BY ID ERROR:", error);
    return res.status(500).json({ message: "Eroare la încărcarea informației utile." });
  }
};

const createUsefulInfo = async (req, res) => {
  try {
    const { title, category, content } = req.body || {};
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Titlul informației este obligatoriu." });
    }
    const result = await pool.query(`
      INSERT INTO informatii_utile (title, category, content, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, category, content, created_by, created_at, updated_at
    `, [title.trim(), typeof category === "string" ? category.trim() || null : null,
      typeof content === "string" ? content : "", req.user.id]);
    const informatie = result.rows[0];
    await createAuditLog({
      userId: req.user.id, action: "CREATE", entityType: "informatii",
      entityId: informatie.id, description: `A creat informația utilă "${informatie.title}"`,
    });
    try {
      const categoryText = informatie.category ? ` în categoria „${informatie.category}”` : "";
      await notifyUsers({
        actorId: req.user.id, title: "Informație utilă nouă",
        message: `A fost adăugată informația „${informatie.title}”${categoryText}.`,
        type: "informatii", link: `/informatii-utile?open=${informatie.id}`,
      });
    } catch (notificationError) {
      console.error("CREATE USEFUL INFO NOTIFICATION ERROR:", notificationError);
    }
    return res.status(201).json({ message: "Informația utilă a fost adăugată.", informatie });
  } catch (error) {
    console.error("CREATE USEFUL INFO ERROR:", error);
    return res.status(500).json({ message: "Eroare la adăugarea informației utile." });
  }
};

const updateUsefulInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, category, content } = req.body || {};
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Titlul informației este obligatoriu." });
    }
    const result = await pool.query(`
      UPDATE informatii_utile SET title = $1, category = $2,
        content = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4
      RETURNING id, title, category, content, created_by, created_at, updated_at
    `, [title.trim(), typeof category === "string" ? category.trim() || null : null,
      typeof content === "string" ? content : "", id]);
    if (!result.rows.length) return res.status(404).json({ message: "Informația utilă nu a fost găsită." });
    await createAuditLog({
      userId: req.user.id, action: "UPDATE", entityType: "informatii",
      entityId: result.rows[0].id,
      description: `A modificat informația utilă "${result.rows[0].title}"`,
    });
    return res.status(200).json({ message: "Informația utilă a fost actualizată.", informatie: result.rows[0] });
  } catch (error) {
    console.error("UPDATE USEFUL INFO ERROR:", error);
    return res.status(500).json({ message: "Eroare la actualizarea informației utile." });
  }
};

const deleteUsefulInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM informatii_utile WHERE id = $1 RETURNING id, title`, [id]
    );
    if (!result.rows.length) return res.status(404).json({ message: "Informația utilă nu a fost găsită." });
    await createAuditLog({
      userId: req.user.id, action: "DELETE", entityType: "informatii",
      entityId: result.rows[0].id,
      description: `A șters informația utilă "${result.rows[0].title}"`,
    });
    return res.status(200).json({ message: "Informația utilă a fost ștearsă.", informatie: result.rows[0] });
  } catch (error) {
    console.error("DELETE USEFUL INFO ERROR:", error);
    return res.status(500).json({ message: "Eroare la ștergerea informației utile." });
  }
};

const addUsefulInfoFavorite = async (req, res) => {
  try {
    const result = await pool.query(`
      INSERT INTO useful_info_favorites (user_id, info_id)
      SELECT $1, id FROM informatii_utile WHERE id = $2
      ON CONFLICT (user_id, info_id) DO NOTHING
      RETURNING info_id
    `, [req.user.id, req.params.id]);
    if (!result.rowCount) {
      const exists = await pool.query(`SELECT 1 FROM informatii_utile WHERE id = $1`, [req.params.id]);
      if (!exists.rowCount) return res.status(404).json({ message: "Informația utilă nu a fost găsită." });
    }
    return res.status(200).json({ message: "Adăugat la importante.", is_favorite: true });
  } catch (error) {
    console.error("ADD USEFUL INFO FAVORITE ERROR:", error);
    return res.status(500).json({ message: "Nu s-a putut salva favoritul." });
  }
};

const removeUsefulInfoFavorite = async (req, res) => {
  try {
    const exists = await pool.query(`SELECT 1 FROM informatii_utile WHERE id = $1`, [req.params.id]);
    if (!exists.rowCount) return res.status(404).json({ message: "Informația utilă nu a fost găsită." });
    await pool.query(`DELETE FROM useful_info_favorites WHERE user_id = $1 AND info_id = $2`,
      [req.user.id, req.params.id]);
    return res.status(200).json({ message: "Eliminat din importante.", is_favorite: false });
  } catch (error) {
    console.error("REMOVE USEFUL INFO FAVORITE ERROR:", error);
    return res.status(500).json({ message: "Nu s-a putut elimina favoritul." });
  }
};

module.exports = {
  getUsefulInfo, getUsefulInfoById, createUsefulInfo, updateUsefulInfo,
  deleteUsefulInfo, addUsefulInfoFavorite, removeUsefulInfoFavorite,
};
