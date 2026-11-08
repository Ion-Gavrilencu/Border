const pool = require("../config/database");

const PAGE_SIZE = 20;
const INITIAL_RECENT_SIZE = 4;

// Aceeași ordine stabilă este folosită atât pentru Dashboard, cât și pentru paginare.
// Tipul și ID-ul departajează documentele cu aceeași dată.
const recentDocumentsSql = `
  SELECT id, 'telegrama' AS type, title, created_at FROM telegrame
  UNION ALL
  SELECT id, 'ordin' AS type, title, created_at FROM ordine
  UNION ALL
  SELECT id, 'legislatie' AS type, title, created_at FROM legislatie
  UNION ALL
  SELECT id, 'informatii' AS type, title, created_at FROM informatii_utile
`;

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

    const recentResult = await pool.query(
      `SELECT * FROM (${recentDocumentsSql}) AS documents
       ORDER BY created_at DESC NULLS LAST, type ASC, id DESC
       LIMIT $1`,
      [INITIAL_RECENT_SIZE],
    );

    return res.status(200).json({
      stats: {
        telegrame: Number(statsResult.rows[0].telegrame),
        ordine: Number(statsResult.rows[0].ordine),
        legislatie: Number(statsResult.rows[0].legislatie),
        informatii_utile: Number(statsResult.rows[0].informatii_utile),
        utilizatori: Number(statsResult.rows[0].utilizatori),
      },
      recent: recentResult.rows,
    });
  } catch (error) {
    console.error("GET DASHBOARD STATS ERROR:", error);
    return res.status(500).json({ message: "Eroare la încărcarea datelor Dashboard-ului." });
  }
};

const getDashboardRecent = async (req, res) => {
  const rawOffset = req.query.offset;
  const offset = Number(rawOffset);
  if (
    typeof rawOffset !== "string" ||
    !/^\d+$/.test(rawOffset) ||
    !Number.isSafeInteger(offset) ||
    offset > 1000000
  ) {
    return res.status(400).json({ message: "Parametrul offset este invalid." });
  }

  try {
    // Un rând suplimentar permite detectarea paginii următoare fără COUNT(*).
    const result = await pool.query(
      `SELECT * FROM (${recentDocumentsSql}) AS documents
       ORDER BY created_at DESC NULLS LAST, type ASC, id DESC
       LIMIT $1 OFFSET $2`,
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
    return res.status(500).json({ message: "Informațiile nu au putut fi încărcate." });
  }
};

module.exports = { getDashboardStats, getDashboardRecent };
