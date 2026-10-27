
const express = require("express");
const pool = require("../config/database");

const router = express.Router();

// Obține ultimele noutăți
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        url,
        category,
        source,
        created_at
      FROM news
      ORDER BY created_at DESC, id DESC
      LIMIT 5
    `);

    res.json({
      articles: result.rows,
    });
  } catch (error) {
  console.error("NEWS GET ERROR:", {
    message: error.message,
    code: error.code,
    detail: error.detail,
  });

    res.status(500).json({
      message: "Noutățile nu au putut fi încărcate.",
    });
  }
});

module.exports = router;
