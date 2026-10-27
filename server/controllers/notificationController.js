
const pool = require("../config/database");

// Obține notificările utilizatorului autentificat.
const getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
         id,
         title,
         message,
         type,
         link,
         is_read,
         created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::INTEGER AS unread_count
       FROM notifications
       WHERE user_id = $1
         AND is_read = FALSE`,
      [userId]
    );

    return res.json({
      notifications: result.rows,
      unreadCount: countResult.rows[0].unread_count,
    });
  } catch (error) {
    console.error("GET NOTIFICATIONS ERROR:", error);

    return res.status(500).json({
      message: "Nu s-au putut încărca notificările.",
    });
  }
};

// Marchează o notificare ca citită.
const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    if (!/^\d+$/.test(id)) {
      return res.status(400).json({
        message: "Identificatorul notificării este invalid.",
      });
    }

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1
         AND user_id = $2
       RETURNING id, is_read`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Notificarea nu a fost găsită.",
      });
    }

    return res.json({
      message: "Notificarea a fost marcată ca citită.",
      notification: result.rows[0],
    });
  } catch (error) {
    console.error("MARK NOTIFICATION READ ERROR:", error);

    return res.status(500).json({
      message: "Nu s-a putut actualiza notificarea.",
    });
  }
};

// Marchează toate notificările ca citite.
const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1
         AND is_read = FALSE`,
      [userId]
    );

    return res.json({
      message: "Toate notificările au fost marcate ca citite.",
      updatedCount: result.rowCount,
    });
  } catch (error) {
    console.error("MARK ALL NOTIFICATIONS ERROR:", error);

    return res.status(500).json({
      message: "Nu s-au putut actualiza notificările.",
    });
  }
};

module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};
