const pool = require("../config/database");

const { touchMonitoringSession, logMonitoringEvent } = require("../services/monitoringService");

const ONLINE_INTERVAL = "2 minutes";

async function heartbeat(req, res) {
  try {
    const updated = await touchMonitoringSession({
      sessionId: req.user.sessionId,

      userId: req.user.id,

      req,
    });

    if (!updated) return res.status(401).json({ message: "Sesiunea nu mai este activă." });

    return res.json({ ok: true });
  } catch (error) {
    console.error("MONITORING HEARTBEAT ERROR:", error);

    return res.status(500).json({ message: "Nu s-a putut actualiza prezența." });
  }
}

async function getOverview(req, res) {
  try {
    const [users, stats] = await Promise.all([
      pool.query(`

        SELECT u.id, u.username, u.email, u.full_name, u.role, u.created_at,

          CASE WHEN u.avatar_data IS NOT NULL THEN

            '/api/auth/avatar-image/' || u.id || '?v=' ||

            (EXTRACT(EPOCH FROM COALESCE(u.avatar_updated_at, u.created_at)) * 1000)::bigint::text

          ELSE NULL END AS avatar_url,

          latest.last_seen_at, latest.started_at AS session_started_at, latest.user_agent,

          COALESCE(sessions.active_sessions, 0)::int AS active_sessions,

          COALESCE(sessions.devices, '[]'::json) AS sessions,

          COALESCE(sessions.active_sessions, 0) > 0 AS online

        FROM users u

        LEFT JOIN LATERAL (

          SELECT s.last_seen_at, s.started_at, s.user_agent

          FROM monitoring_sessions s WHERE s.user_id = u.id

          ORDER BY s.last_seen_at DESC, s.id DESC LIMIT 1

        ) latest ON TRUE

        LEFT JOIN LATERAL (

          SELECT COUNT(*)::int AS active_sessions,

            COALESCE(json_agg(json_build_object(

              'session_id', s.session_id,

              'started_at', s.started_at,

              'last_seen_at', s.last_seen_at,

              'user_agent', s.user_agent,

              'online', TRUE

            ) ORDER BY s.last_seen_at DESC), '[]'::json) AS devices

          FROM monitoring_sessions s

          WHERE s.user_id = u.id

            AND s.logged_out_at IS NULL

            AND s.expires_at > NOW()

            AND s.last_seen_at >= NOW() - INTERVAL '${ONLINE_INTERVAL}'

        ) sessions ON TRUE

        ORDER BY u.id ASC

      `),

      pool.query(`

        SELECT

          (SELECT COUNT(DISTINCT user_id)::int FROM monitoring_sessions

           WHERE logged_out_at IS NULL AND expires_at > NOW()

             AND last_seen_at >= NOW() - INTERVAL '${ONLINE_INTERVAL}') AS online_users,

          (SELECT COUNT(*)::int FROM monitoring_events WHERE action = 'login'

           AND created_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Europe/Chisinau') AT TIME ZONE 'Europe/Chisinau')) AS logins_today,

          (SELECT COUNT(*)::int FROM monitoring_events WHERE action = 'search'

           AND created_at >= NOW() - INTERVAL '24 hours') AS searches_24h,

          (SELECT COUNT(*)::int FROM monitoring_events WHERE action = 'download'

           AND created_at >= NOW() - INTERVAL '24 hours') AS downloads_24h

      `),
    ]);

    return res.json({ users: users.rows, stats: stats.rows[0] });
  } catch (error) {
    console.error("MONITORING OVERVIEW ERROR:", error);

    return res.status(500).json({ message: "Nu s-au putut încărca statisticile." });
  }
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);

  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

// Reconstruim denumirile pentru evenimentele vechi, fără să modificăm

// istoricul stocat în baza de date. Căutările sunt grupate pe pagină.

const DOCUMENT_TYPES = {
  telegrame: { label: "Telegramă", number: "number" },

  ordine: { label: "Ordin intern", number: "number" },

  legislatie: { label: "Act normativ", number: "law_number" },

  informatii_utile: { label: "Informație utilă" },

  news: { label: "Noutate" },
};

function formatDocumentTitle(row) {
  const config = DOCUMENT_TYPES[row.entity_type];
  if (!config) return null;
  const title = String(row.document_title || "").trim();
  if (!title) return null;
  const number = String(row.document_number || "").trim();
  const numberText = number && !title.includes(number) ? ` nr. ${number}` : "";
  return `${config.label}${numberText}: ${title}`;
}

async function enrichLegacyAttachmentEvents(activities) {
  const legacyPattern = /^(Vizualizare|Descărcare) atașament #([1-9]\d*): /;

  const ids = [
    ...new Set(
      activities.flatMap((item) => {
        if (!["view", "download"].includes(item.action)) return [];

        const match = legacyPattern.exec(String(item.details || ""));

        return match ? [match[2]] : [];
      }),
    ),
  ];

  if (!ids.length) return activities;

  try {
    const result = await pool.query(
      `

      SELECT a.id::text AS attachment_id, a.entity_type, a.entity_id,

        COALESCE(t.title, o.title, l.title, i.title, n.title) AS document_title,

        CASE a.entity_type

          WHEN 'telegrame' THEN t.number

          WHEN 'ordine' THEN o.number

          WHEN 'legislatie' THEN l.law_number

          ELSE NULL

        END AS document_number

      FROM attachments a

      LEFT JOIN telegrame t ON a.entity_type = 'telegrame' AND t.id = a.entity_id

      LEFT JOIN ordine o ON a.entity_type = 'ordine' AND o.id = a.entity_id

      LEFT JOIN legislatie l ON a.entity_type = 'legislatie' AND l.id = a.entity_id

      LEFT JOIN informatii_utile i ON a.entity_type = 'informatii_utile' AND i.id = a.entity_id

      LEFT JOIN news n ON a.entity_type = 'news' AND n.id = a.entity_id

      WHERE a.id::text = ANY($1::text[])

    `,

      [ids],
    );

    const records = new Map(result.rows.map((row) => [row.attachment_id, row]));
    return activities.map((item) => {
      if (!["view", "download"].includes(item.action)) return item;
      const match = legacyPattern.exec(String(item.details || ""));
      if (!match) return item;
      const record = records.get(match[2]);
      if (!record) return item;
      const title = formatDocumentTitle(record);
      return {
        ...item,
        details: title ? `${match[1]} document: ${title}` : item.details,
        document: {
          entity_type: record.entity_type,
          entity_id: record.entity_id,
          attachment_id: record.attachment_id,
          title: title || "Document",
        },
      };
    });
  } catch (error) {
    // Jurnalul trebuie să rămână accesibil chiar dacă rezolvarea titlurilor eșuează.

    console.error("MONITORING LEGACY DOCUMENT TITLES ERROR:", error);

    return activities;
  }
}

async function getActivities(req, res) {
  try {
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));

    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 10));

    const userId = req.query.userId ? Number(req.query.userId) : null;

    const action = typeof req.query.action === "string" ? req.query.action.trim() : "";

    const search =
      typeof req.query.search === "string" ? req.query.search.trim().slice(0, 120) : "";

    const start = typeof req.query.start === "string" ? req.query.start : "";

    const end = typeof req.query.end === "string" ? req.query.end : "";

    if (
      (userId !== null && (!Number.isSafeInteger(userId) || userId < 1)) ||
      (start && !validDate(start)) ||
      (end && !validDate(end)) ||
      (start && end && start > end)
    ) {
      return res.status(400).json({ message: "Filtre invalide." });
    }

    const clauses = [];

    const values = [];

    const add = (sql, value) => {
      values.push(value);

      clauses.push(sql.replace("?", `$${values.length}`));
    };

    if (userId !== null) add("e.user_id = ?", userId);

    if (action && action !== "all") add("e.action = ?", action);

    if (search) add("COALESCE(e.details, '') ILIKE ?", `%${search}%`);

    if (start) add("e.created_at >= (?::date AT TIME ZONE 'Europe/Chisinau')", start);

    if (end)
      add("e.created_at < ((?::date + INTERVAL '1 day') AT TIME ZONE 'Europe/Chisinau')", end);

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const base = `FROM monitoring_events e LEFT JOIN users u ON u.id = e.user_id ${where}`;

    const count = await pool.query(`SELECT COUNT(*)::int AS total ${base}`, values);

    const result = await pool.query(
      `SELECT e.id, e.user_id, e.action, e.details, e.ip_address, e.user_agent,

              e.created_at, u.username, u.full_name ${base}

       ORDER BY e.created_at DESC, e.id DESC

       LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,

      [...values, limit, (page - 1) * limit],
    );

    const activities = await enrichLegacyAttachmentEvents(result.rows);

    return res.json({
      activities,

      total: count.rows[0].total,

      page,

      limit,
    });
  } catch (error) {
    console.error("MONITORING ACTIVITIES ERROR:", error);

    return res.status(500).json({ message: "Nu s-a putut încărca istoricul." });
  }
}

async function recordPageView(req, res) {
  try {
    const { path } = req.body || {};

    if (
      typeof path !== "string" ||
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.length > 200
    ) {
      return res.status(400).json({ message: "Pagina accesată este invalidă." });
    }

    await logMonitoringEvent({
      userId: req.user.id,

      action: "page_view",

      details: `Pagină accesată: ${path}`,

      req,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error("PAGE VIEW ERROR:", error);

    return res.status(500).json({ message: "Nu s-a putut înregistra pagina." });
  }
}

// Setări de retenție accesibile exclusiv administratorului prin rutele protejate.
async function getRetentionSettings(req, res) {
  try {
    const { getRetentionSettings: read } = require("../services/monitoringRetentionService");
    return res.json(await read());
  } catch (error) {
    console.error("MONITORING RETENTION SETTINGS ERROR:", error);
    return res.status(500).json({ message: "Nu s-au putut încărca setările de păstrare." });
  }
}

async function updateRetentionSettings(req, res) {
  const days = req.body?.retention_days;
  if (!Number.isInteger(days) || ![7, 14, 30, 60, 90].includes(days)) {
    return res.status(400).json({ message: "Selectați 7, 14, 30, 60 sau 90 de zile." });
  }
  try {
    const { setRetentionDays } = require("../services/monitoringRetentionService");
    return res.json(await setRetentionDays(days));
  } catch (error) {
    console.error("MONITORING RETENTION UPDATE ERROR:", error);
    return res.status(500).json({ message: "Nu s-a putut salva perioada de păstrare." });
  }
}

module.exports = {
  heartbeat,
  getOverview,
  getActivities,
  recordPageView,
  getRetentionSettings,
  updateRetentionSettings,
};
