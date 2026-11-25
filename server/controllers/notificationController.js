const pool = require("../config/database");

const fields = "id, title, message, type, link, is_read, created_at";
const validId = (id) =>
  typeof id === "string" && /^[1-9]\d{0,18}$/.test(id) && BigInt(id) <= 9223372036854775807n;
function integer(value, fallback, min, max) {
  if (value === undefined) return fallback;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) && n >= min && n <= max ? n : null;
}
function failure(res, label, error) {
  console.error(label, error);
  return res.status(500).json({ message: "Operațiunea asupra notificărilor nu a reușit." });
}

const getNotifications = async (req, res) => {
  try {
    const { q = "", type = "", status = "all" } = req.query;
    const page = integer(req.query.page, 1, 1, 100000);
    const limit = integer(req.query.limit, 50, 1, 100);
    if (
      !page ||
      !limit ||
      typeof q !== "string" ||
      q.length > 120 ||
      typeof type !== "string" ||
      type.length > 80 ||
      !["all", "read", "unread"].includes(status)
    ) {
      return res.status(400).json({ message: "Filtrele sau paginarea sunt invalide." });
    }
    const params = [req.user.id];
    const where = ["user_id = $1"];
    if (status !== "all") {
      params.push(status === "read");
      where.push(`is_read = $${params.length}`);
    }
    if (type.trim().toLowerCase() === "documents") {
      where.push("LOWER(type) NOT IN ('test','stire')");
    } else if (type.trim()) {
      params.push(type.trim().toLowerCase());
      where.push(`LOWER(type) = $${params.length}`);
    }
    if (q.trim()) {
      params.push("%" + q.trim().replace(/[!%_]/g, (c) => "!" + c) + "%");
      where.push(
        `(unaccent(COALESCE(title, '')) ILIKE unaccent($${params.length}) ESCAPE '!' OR unaccent(COALESCE(message, '')) ILIKE unaccent($${params.length}) ESCAPE '!')`,
      );
    }
    const predicate = where.join(" AND ");
    // One statement: list and counters share the same database snapshot.
    const result = await pool.query(
      `
      WITH filtered AS (
        SELECT ${fields} FROM notifications WHERE ${predicate}
      ), page_rows AS (
        SELECT * FROM filtered ORDER BY created_at DESC NULLS LAST, id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      )
      SELECT COALESCE((SELECT json_agg(jsonb_set(to_jsonb(p), '{id}', to_jsonb(p.id::text)) ORDER BY p.created_at DESC NULLS LAST, p.id DESC) FROM page_rows p), '[]'::json) AS notifications,
        (SELECT COUNT(*)::integer FROM filtered) AS total,
        (SELECT COUNT(*)::integer FROM notifications WHERE user_id = $1 AND is_read = FALSE) AS unread_count
    `,
      [...params, limit, (page - 1) * limit],
    );
    const row = result.rows[0];
    return res.json({
      notifications: row.notifications,
      unreadCount: row.unread_count,
      pagination: {
        page,
        limit,
        total: row.total,
        totalPages: Math.ceil(row.total / limit),
        hasMore: page * limit < row.total,
      },
    });
  } catch (error) {
    return failure(res, "GET NOTIFICATIONS ERROR:", error);
  }
};

function setRead(value) {
  return async (req, res) => {
    try {
      if (!validId(req.params.id))
        return res.status(400).json({ message: "Identificatorul notificării este invalid." });
      const result = await pool.query(
        "UPDATE notifications SET is_read = $3 WHERE id = $1 AND user_id = $2 RETURNING id, is_read",
        [req.params.id, req.user.id, value],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Notificarea nu a fost găsită." });
      return res.json({
        message: value
          ? "Notificarea a fost marcată ca citită."
          : "Notificarea a fost marcată ca necitită.",
        notification: result.rows[0],
      });
    } catch (error) {
      return failure(res, "SET NOTIFICATION READ ERROR:", error);
    }
  };
}
const markNotificationRead = setRead(true);
const markNotificationUnread = setRead(false);
const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
      [req.user.id],
    );
    return res.json({
      message: "Toate notificările au fost marcate ca citite.",
      updatedCount: result.rowCount,
    });
  } catch (error) {
    return failure(res, "MARK ALL NOTIFICATIONS ERROR:", error);
  }
};
const deleteNotification = async (req, res) => {
  try {
    if (!validId(req.params.id))
      return res.status(400).json({ message: "Identificatorul notificării este invalid." });
    const result = await pool.query(
      "DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id",
      [req.params.id, req.user.id],
    );
    if (!result.rowCount) return res.status(404).json({ message: "Notificarea nu a fost găsită." });
    return res.json({ message: "Notificarea a fost ștearsă.", deletedId: result.rows[0].id });
  } catch (error) {
    return failure(res, "DELETE NOTIFICATION ERROR:", error);
  }
};
const deleteReadNotifications = async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM notifications WHERE user_id = $1 AND is_read = TRUE",
      [req.user.id],
    );
    return res.json({
      message: "Notificările citite au fost șterse.",
      deletedCount: result.rowCount,
    });
  } catch (error) {
    return failure(res, "DELETE READ NOTIFICATIONS ERROR:", error);
  }
};
module.exports = {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  markNotificationUnread,
  deleteNotification,
  deleteReadNotifications,
};
