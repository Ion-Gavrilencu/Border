
const pool = require("../config/database");
const {
  logMonitoringEvent,
} = require("../services/monitoringService");

const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;

    const searchTerm =
      typeof q === "string" ? q.trim() : "";

    if (!searchTerm) {
      return res.status(200).json({
        results: [],
      });
    }

    const search = `%${searchTerm}%`;

    const result = await pool.query(
      `
      SELECT
        id,
        'telegrama' AS type,
        title,
        content,
        created_at
      FROM telegrame
      WHERE
        title ILIKE $1
        OR number ILIKE $1
        OR content ILIKE $1

      UNION ALL

      SELECT
        id,
        'ordin' AS type,
        title,
        content,
        created_at
      FROM ordine
      WHERE
        title ILIKE $1
        OR number ILIKE $1
        OR content ILIKE $1

      UNION ALL

      SELECT
        id,
        'legislatie' AS type,
        title,
        content,
        created_at
      FROM legislatie
      WHERE
        title ILIKE $1
        OR law_number ILIKE $1
        OR content ILIKE $1

      UNION ALL

      SELECT
        id,
        'informatii' AS type,
        title,
        content,
        created_at
      FROM informatii_utile
      WHERE
        title ILIKE $1
        OR category ILIKE $1
        OR content ILIKE $1

      ORDER BY created_at DESC
      LIMIT 50
      `,
      [search]
    );

    // Înregistrăm căutarea în sistemul de monitorizare.
    // Limităm textul și nu salvăm date sensibile.
    const safeTerm = searchTerm.slice(0, 120);

    await logMonitoringEvent({
      userId: req.user.id,
      action: "search",
      details: `Căutare globală: ${safeTerm} | Rezultate: ${result.rows.length}`,
      req,
    });

    return res.status(200).json({
      results: result.rows,
    });
  } catch (error) {
    console.error("GLOBAL SEARCH ERROR:", error);

    return res.status(500).json({
      message: "Eroare la efectuarea căutării.",
    });
  }
};

module.exports = {
  globalSearch,
};
