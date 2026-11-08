const pool = require("../config/database");
const { logMonitoringEvent } = require("../services/monitoringService");

const MAX_SEARCH_LENGTH = 120;

const globalSearch = async (req, res) => {
  try {
    const { q } = req.query;
    const searchTerm = typeof q === "string" ? q.trim() : "";

    if (!searchTerm) {
      return res.status(200).json({ results: [] });
    }

    if (searchTerm.length > MAX_SEARCH_LENGTH) {
      return res.status(400).json({
        message: `Căutarea nu poate depăși ${MAX_SEARCH_LENGTH} de caractere.`,
      });
    }

    // ESCAPE '!' păstrează căutarea literală pentru %, _ și !.
    const escapedTerm = searchTerm.replace(/[!%_]/g, (character) => `!${character}`);
    const search = `%${escapedTerm}%`;

    const result = await pool.query(
      `
      SELECT id, 'telegrama' AS type, title, content, created_at
      FROM telegrame
      WHERE title ILIKE $1 ESCAPE '!'
         OR number ILIKE $1 ESCAPE '!'
         OR content ILIKE $1 ESCAPE '!'

      UNION ALL

      SELECT id, 'ordin' AS type, title, content, created_at
      FROM ordine
      WHERE title ILIKE $1 ESCAPE '!'
         OR number ILIKE $1 ESCAPE '!'
         OR content ILIKE $1 ESCAPE '!'

      UNION ALL

      SELECT id, 'legislatie' AS type, title, content, created_at
      FROM legislatie
      WHERE title ILIKE $1 ESCAPE '!'
         OR law_number ILIKE $1 ESCAPE '!'
         OR content ILIKE $1 ESCAPE '!'

      UNION ALL

      SELECT id, 'informatii' AS type, title, content, created_at
      FROM informatii_utile
      WHERE title ILIKE $1 ESCAPE '!'
         OR category ILIKE $1 ESCAPE '!'
         OR content ILIKE $1 ESCAPE '!'

      ORDER BY created_at DESC
      LIMIT 50
      `,
      [search],
    );

    await logMonitoringEvent({
      userId: req.user.id,
      action: "search",
      details: `Căutare globală: ${searchTerm} | Rezultate: ${result.rows.length}`,
      req,
    });

    return res.status(200).json({ results: result.rows });
  } catch (error) {
    console.error("GLOBAL SEARCH ERROR:", error);
    return res.status(500).json({
      message: "Eroare la efectuarea căutării.",
    });
  }
};

module.exports = { globalSearch };
