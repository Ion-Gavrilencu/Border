const pool = require("../config/database");

const PAGE_SIZE = 20;
const INITIAL_RECENT_SIZE = 4;

// Ordine stabilă pentru Dashboard și paginare.
const recentDocumentsSql = `
  SELECT id, 'telegrama' AS type, title, created_at
  FROM telegrame

  UNION ALL

  SELECT id, 'ordin' AS type, title, created_at
  FROM ordine

  UNION ALL

  SELECT id, 'legislatie' AS type, title, created_at
  FROM legislatie

  UNION ALL

  SELECT id, 'informatii' AS type, title, created_at
  FROM informatii_utile
`;

// Calculează variația procentuală.
// Dacă nu există date în perioada precedentă,
// returnează null pentru a evita procente incorecte.
const calculateTrend = (current, previous) => {
  const currentCount = Number(current);
  const previousCount = Number(previous);

  if (!Number.isFinite(currentCount) || !Number.isFinite(previousCount) || previousCount === 0) {
    return null;
  }

  return Math.round(((currentCount - previousCount) / previousCount) * 100);
};

// =====================================================
// STATISTICI DASHBOARD
// =====================================================
const getDashboardStats = async (req, res) => {
  try {
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM telegrame) AS telegrame,
        (SELECT COUNT(*) FROM ordine) AS ordine,
        (SELECT COUNT(*) FROM legislatie) AS legislatie,
        (SELECT COUNT(*) FROM informatii_utile) AS informatii_utile,
        (SELECT COUNT(*) FROM users) AS utilizatori
    `);

    // Comparăm ultimele 30 de zile cu cele 30 anterioare.
    // Folosim o singură interogare pentru toate categoriile.
    const trendsResult = await pool.query(`
      WITH document_counts AS (
        SELECT
          'telegrame' AS category,
          created_at
        FROM telegrame

        UNION ALL

        SELECT
          'ordine' AS category,
          created_at
        FROM ordine

        UNION ALL

        SELECT
          'legislatie' AS category,
          created_at
        FROM legislatie

        UNION ALL

        SELECT
          'informatii_utile' AS category,
          created_at
        FROM informatii_utile
      )
      SELECT
        category,

        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '30 days'
            AND created_at <= NOW()
        ) AS current_count,

        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '60 days'
            AND created_at < NOW() - INTERVAL '30 days'
        ) AS previous_count

      FROM document_counts
      GROUP BY category
    `);

    const trends = {
      telegrame: null,
      ordine: null,
      legislatie: null,
      informatii_utile: null,
    };

    for (const row of trendsResult.rows) {
      if (Object.prototype.hasOwnProperty.call(trends, row.category)) {
        trends[row.category] = calculateTrend(row.current_count, row.previous_count);
      }
    }

    // Ultimele 4 documente.
    const recentResult = await pool.query(
      `
        SELECT *
        FROM (${recentDocumentsSql}) AS documents

        ORDER BY
          created_at DESC NULLS LAST,
          type ASC,
          id DESC

        LIMIT $1
      `,
      [INITIAL_RECENT_SIZE],
    );

    const row = statsResult.rows[0];

    return res.status(200).json({
      stats: {
        telegrame: Number(row.telegrame),
        ordine: Number(row.ordine),
        legislatie: Number(row.legislatie),
        informatii_utile: Number(row.informatii_utile),
        utilizatori: Number(row.utilizatori),
      },

      trends,

      recent: recentResult.rows,
    });
  } catch (error) {
    console.error("GET DASHBOARD STATS ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea datelor Dashboard-ului.",
    });
  }
};

// =====================================================
// DOCUMENTE RECENTE — PAGINARE
// =====================================================
const getDashboardRecent = async (req, res) => {
  const rawOffset = req.query.offset;
  const offset = Number(rawOffset);

  if (
    typeof rawOffset !== "string" ||
    !/^\d+$/.test(rawOffset) ||
    !Number.isSafeInteger(offset) ||
    offset > 1000000
  ) {
    return res.status(400).json({
      message: "Parametrul offset este invalid.",
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT *
        FROM (${recentDocumentsSql}) AS documents

        ORDER BY
          created_at DESC NULLS LAST,
          type ASC,
          id DESC

        LIMIT $1 OFFSET $2
      `,
      [PAGE_SIZE + 1, offset],
    );

    const hasMore = result.rows.length > PAGE_SIZE;

    const items = result.rows.slice(0, PAGE_SIZE);

    return res.status(200).json({
      recent: items,
      nextOffset: offset + items.length,
      hasMore,
    });
  } catch (error) {
    console.error("GET DASHBOARD RECENT ERROR:", error);

    return res.status(500).json({
      message: "Informațiile nu au putut fi încărcate.",
    });
  }
};

module.exports = {
  getDashboardStats,
  getDashboardRecent,
};
