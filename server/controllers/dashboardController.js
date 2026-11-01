
const pool = require("../config/database");

const getDashboardStats = async (req, res) => {
  try {
    // STATISTICILE DASHBOARD-ULUI
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM telegrame) AS telegrame,
        (SELECT COUNT(*) FROM ordine) AS ordine,
        (SELECT COUNT(*) FROM legislatie) AS legislatie,
        (SELECT COUNT(*) FROM informatii_utile) AS informatii_utile,
        (SELECT COUNT(*) FROM users) AS utilizatori
    `);

    // TOATE DOCUMENTELE RECENTE
    const recentResult = await pool.query(`
      SELECT *
      FROM (
        SELECT
          id,
          'telegrama' AS type,
          title,
          created_at
        FROM telegrame

        UNION ALL

        SELECT
          id,
          'ordin' AS type,
          title,
          created_at
        FROM ordine

        UNION ALL

        SELECT
          id,
          'legislatie' AS type,
          title,
          created_at
        FROM legislatie

        UNION ALL

        SELECT
          id,
          'informatii' AS type,
          title,
          created_at
        FROM informatii_utile
      ) AS documents
      ORDER BY created_at DESC
    `);

    return res.status(200).json({
      stats: {
        telegrame: Number(statsResult.rows[0].telegrame),
        ordine: Number(statsResult.rows[0].ordine),
        legislatie: Number(statsResult.rows[0].legislatie),
        informatii_utile: Number(
          statsResult.rows[0].informatii_utile
        ),
        utilizatori: Number(statsResult.rows[0].utilizatori),
      },

      recent: recentResult.rows,
    });
  } catch (error) {
    console.error("GET DASHBOARD STATS ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea datelor Dashboard-ului.",
    });
  }
};

module.exports = {
  getDashboardStats,
};
