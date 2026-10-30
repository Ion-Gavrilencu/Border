const pool = require("../config/database");
const {
  touchPresence,
  logMonitoringEvent,
} = require("../services/monitoringService");

const ONLINE_INTERVAL = "2 minutes";

// =====================================================
// HEARTBEAT — ACTUALIZAREA PREZENȚEI
// =====================================================

async function heartbeat(req, res) {
  try {
    await touchPresence(req);

    return res.json({ ok: true });
  } catch (error) {
    console.error("MONITORING HEARTBEAT ERROR:", error);

    return res.status(500).json({
      message: "Nu s-a putut actualiza prezența.",
    });
  }
}

// =====================================================
// OVERVIEW — UTILIZATORI ȘI STATISTICI
// =====================================================

async function getOverview(req, res) {
  try {
    const [users, stats] = await Promise.all([
      pool.query(`
        SELECT
          u.id,
          u.username,
          u.email,
          u.full_name,
          u.role,
          u.created_at,

          CASE
            WHEN u.avatar_data IS NOT NULL
            THEN '/api/auth/avatar-image/' || u.id ||
                 '?v=' ||
                 (
                   EXTRACT(
                     EPOCH FROM COALESCE(
                       u.avatar_updated_at,
                       u.created_at
                     )
                   ) * 1000
                 )::bigint::text
            ELSE NULL
          END AS avatar_url,

          p.last_seen_at,
          p.session_started_at,
          p.user_agent,

          COALESCE(
            (
              p.logged_out_at IS NULL
              AND p.last_seen_at >=
                NOW() - INTERVAL '${ONLINE_INTERVAL}'
            ),
            FALSE
          ) AS online

        FROM users u

        LEFT JOIN monitoring_presence p
          ON p.user_id = u.id

        ORDER BY u.id ASC
      `),

      pool.query(`
        SELECT
          (
            SELECT COUNT(*)::int
            FROM monitoring_presence
            WHERE logged_out_at IS NULL
              AND last_seen_at >=
                NOW() - INTERVAL '${ONLINE_INTERVAL}'
          ) AS online_users,

          (
            SELECT COUNT(*)::int
            FROM monitoring_events
            WHERE action = 'login'
              AND created_at >= date_trunc('day', NOW())
          ) AS logins_today,

          (
            SELECT COUNT(*)::int
            FROM monitoring_events
            WHERE action = 'search'
              AND created_at >=
                NOW() - INTERVAL '24 hours'
          ) AS searches_24h,

          (
            SELECT COUNT(*)::int
            FROM monitoring_events
            WHERE action = 'download'
              AND created_at >=
                NOW() - INTERVAL '24 hours'
          ) AS downloads_24h
      `),
    ]);

    return res.json({
      users: users.rows,
      stats: stats.rows[0],
    });
  } catch (error) {
    console.error("MONITORING OVERVIEW ERROR:", error);

    return res.status(500).json({
      message: "Nu s-au putut încărca statisticile.",
    });
  }
}

// =====================================================
// ACTIVITIES — ISTORICUL ACTIVITĂȚII
// =====================================================

async function getActivities(req, res) {
  try {
    const page = Math.max(
      1,
      Math.min(100000, Number.parseInt(req.query.page, 10) || 1),
    );

    const limit = Math.max(
      1,
      Math.min(50, Number.parseInt(req.query.limit, 10) || 10),
    );

    const userId = req.query.userId ? Number(req.query.userId) : null;

    const action =
      typeof req.query.action === "string" ? req.query.action.trim() : "";

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim().slice(0, 120)
        : "";

    const start = typeof req.query.start === "string" ? req.query.start : "";

    const end = typeof req.query.end === "string" ? req.query.end : "";

    // Validarea filtrelor
    if (
      (userId !== null && (!Number.isSafeInteger(userId) || userId < 1)) ||
      (start && !/^\d{4}-\d{2}-\d{2}$/.test(start)) ||
      (end && !/^\d{4}-\d{2}-\d{2}$/.test(end))
    ) {
      return res.status(400).json({
        message: "Filtre invalide.",
      });
    }

    const clauses = [];
    const values = [];

    const add = (sql, value) => {
      values.push(value);

      clauses.push(sql.replace("?", `$${values.length}`));
    };

    if (userId !== null) {
      add("e.user_id = ?", userId);
    }

    if (action && action !== "all") {
      add("e.action = ?", action);
    }

    if (search) {
      add("COALESCE(e.details, '') ILIKE ?", `%${search}%`);
    }

    if (start) {
      add("e.created_at >= ?::date", start);
    }

    if (end) {
      add("e.created_at < (?::date + INTERVAL '1 day')", end);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const base = `
      FROM monitoring_events e
      LEFT JOIN users u
        ON u.id = e.user_id
      ${where}
    `;

    const count = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        ${base}
      `,
      values,
    );

    const result = await pool.query(
      `
        SELECT
          e.id,
          e.user_id,
          e.action,
          e.details,
          e.ip_address,
          e.user_agent,
          e.created_at,
          u.username,
          u.full_name

        ${base}

        ORDER BY
          e.created_at DESC,
          e.id DESC

        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, limit, (page - 1) * limit],
    );

    return res.json({
      activities: result.rows,
      total: count.rows[0].total,
      page,
      limit,
    });
  } catch (error) {
    console.error("MONITORING ACTIVITIES ERROR:", error);

    return res.status(500).json({
      message: "Nu s-a putut încărca istoricul.",
    });
  }
}

// =====================================================
// PAGE VIEW — ÎNREGISTRAREA PAGINILOR ACCESATE
// =====================================================

const recordPageView = async (req, res) => {
  try {
    const { path } = req.body || {};

    if (
      typeof path !== "string" ||
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.length > 200
    ) {
      return res.status(400).json({
        message: "Pagina accesată este invalidă.",
      });
    }

    await logMonitoringEvent({
      userId: req.user.id,
      action: "page_view",
      details: `Pagină accesată: ${path}`,
      req,
    });

    return res.status(200).json({
      ok: true,
    });
  } catch (error) {
    console.error("PAGE VIEW ERROR:", error);

    return res.status(500).json({
      message: "Nu s-a putut înregistra pagina.",
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  heartbeat,
  getOverview,
  getActivities,
  recordPageView,
};
