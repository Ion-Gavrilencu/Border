const pool = require("../config/database");

const PAGE_SIZE = 20;
const INITIAL_RECENT_SIZE = 4;

const DOCUMENT_CATEGORIES = ["telegrame", "ordine", "legislatie", "informatii_utile"];

// =====================================================
// DOCUMENTE RECENTE — ORDINE STABILĂ
// =====================================================

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

// =====================================================
// CALCULUL VARIAȚIEI PROCENTUALE
// =====================================================

function calculateTrend(current, previous) {
  const currentCount = Number(current);
  const previousCount = Number(previous);

  if (
    !Number.isFinite(currentCount) ||
    !Number.isFinite(previousCount) ||
    currentCount < 0 ||
    previousCount < 0
  ) {
    return {
      percentage: null,
      status: "unavailable",
    };
  }

  // Nu există bază de comparație.
  if (previousCount === 0) {
    if (currentCount > 0) {
      return {
        percentage: null,
        status: "new",
      };
    }

    return {
      percentage: null,
      status: "no_activity",
    };
  }

  const percentage = Math.round(((currentCount - previousCount) / previousCount) * 100);

  return {
    percentage,
    status: percentage > 0 ? "increase" : percentage < 0 ? "decrease" : "stable",
  };
}

// =====================================================
// STATISTICI DASHBOARD
// =====================================================

const getDashboardStats = async (req, res) => {
  try {
    // Numărul total de documente și utilizatori.
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM telegrame)
          AS telegrame,

        (SELECT COUNT(*) FROM ordine)
          AS ordine,

        (SELECT COUNT(*) FROM legislatie)
          AS legislatie,

        (SELECT COUNT(*) FROM informatii_utile)
          AS informatii_utile,

        (SELECT COUNT(*) FROM users)
          AS utilizatori
    `);

    // Documentele adăugate în două perioade
    // consecutive de câte 30 de zile.
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
      ),

      period_counts AS (
        SELECT
          category,

          COUNT(*) FILTER (
            WHERE created_at >=
              NOW() - INTERVAL '30 days'
              AND created_at <= NOW()
          ) AS current_count,

          COUNT(*) FILTER (
            WHERE created_at >=
              NOW() - INTERVAL '60 days'
              AND created_at <
                NOW() - INTERVAL '30 days'
          ) AS previous_count

        FROM document_counts
        GROUP BY category
      )

      SELECT
        category,
        current_count,
        previous_count

      FROM period_counts
    `);

    const trends = {};
    const trendStatus = {};
    const trendCounts = {};

    // Inițializăm toate categoriile.
    for (const category of DOCUMENT_CATEGORIES) {
      trends[category] = null;
      trendStatus[category] = "unavailable";

      trendCounts[category] = {
        current: 0,
        previous: 0,
      };
    }

    // Prelucrăm datele reale.
    for (const row of trendsResult.rows) {
      const category = row.category;

      if (!Object.prototype.hasOwnProperty.call(trends, category)) {
        continue;
      }

      const current = Number(row.current_count);
      const previous = Number(row.previous_count);

      const result = calculateTrend(current, previous);

      trends[category] = result.percentage;
      trendStatus[category] = result.status;

      trendCounts[category] = {
        current,
        previous,
      };
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

      // Procentele reale.
      trends,

      // Starea fiecărei categorii.
      trendStatus,

      // Numărul documentelor din fiecare perioadă.
      trendCounts,

      // Documentele recente.
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
