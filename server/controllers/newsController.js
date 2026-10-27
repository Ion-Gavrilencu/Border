
const pool = require("../config/database");

const allowedCategories = [
  "documente",
  "transport",
  "contrabanda",
  "migratie",
  "altele",
];

const validId = (id) => /^[1-9]\d*$/.test(String(id));

const validUrl = (value) => {
  try {
    const url = new URL(value);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.hostname.includes(".") &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
};

const validateNews = (body) => {
  const title =
    typeof body.title === "string" ? body.title.trim() : "";

  const url =
    typeof body.url === "string" ? body.url.trim() : "";

  const category =
    typeof body.category === "string"
      ? body.category.trim()
      : "altele";

  const source =
    typeof body.source === "string" ? body.source.trim() : "";

  const imageUrl =
    typeof body.image_url === "string"
      ? body.image_url.trim()
      : "";

  if (!title || title.length > 300) {
    return {
      error: "Titlul trebuie să aibă între 1 și 300 de caractere.",
    };
  }

  if (!url || url.length > 2048 || !validUrl(url)) {
    return {
      error: "Introdu un link HTTP/HTTPS valid către articol.",
    };
  }

  if (!allowedCategories.includes(category)) {
    return { error: "Categoria selectată nu este validă." };
  }

  if (source.length > 150) {
    return {
      error: "Sursa nu poate depăși 150 de caractere.",
    };
  }

  if (
    imageUrl &&
    (imageUrl.length > 2048 || !validUrl(imageUrl))
  ) {
    return {
      error: "Linkul imaginii trebuie să fie un URL valid.",
    };
  }

  return {
    data: {
      title,
      url,
      category,
      source: source || null,
      image_url: imageUrl || null,
    },
  };
};

// GET /api/news
const getNews = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id, title, url, category, source,
        image_url, created_by, created_at, updated_at
      FROM news
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `);

    return res.json({ articles: result.rows });
  } catch (error) {
    console.error("GET NEWS ERROR:", error);

    return res.status(500).json({
      message: "Noutățile nu au putut fi încărcate.",
    });
  }
};

// GET /api/news/:id
const getNewsById = async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Identificator invalid.",
      });
    }

    const result = await pool.query(
      "SELECT * FROM news WHERE id = $1",
      [req.params.id],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Noutatea nu a fost găsită.",
      });
    }

    return res.json({ article: result.rows[0] });
  } catch (error) {
    console.error("GET NEWS BY ID ERROR:", error);

    return res.status(500).json({
      message: "Noutatea nu a putut fi încărcată.",
    });
  }
};

// POST /api/news
const createNews = async (req, res) => {
  try {
    const validation = validateNews(req.body || {});

    if (validation.error) {
      return res.status(400).json({
        message: validation.error,
      });
    }

    const {
      title,
      url,
      category,
      source,
      image_url,
    } = validation.data;

    const result = await pool.query(
      `INSERT INTO news
        (title, url, category, source, image_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        title,
        url,
        category,
        source,
        image_url,
        req.user.id,
      ],
    );

    return res.status(201).json({
      message: "Noutatea a fost adăugată.",
      article: result.rows[0],
    });
  } catch (error) {
    console.error("CREATE NEWS ERROR:", error);

    return res.status(500).json({
      message: "Noutatea nu a putut fi adăugată.",
    });
  }
};

// PATCH /api/news/:id
const updateNews = async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Identificator invalid.",
      });
    }

    const existing = await pool.query(
      "SELECT * FROM news WHERE id = $1",
      [req.params.id],
    );

    if (!existing.rows.length) {
      return res.status(404).json({
        message: "Noutatea nu a fost găsită.",
      });
    }

    const current = existing.rows[0];

    const validation = validateNews({
      title: req.body?.title ?? current.title,
      url: req.body?.url ?? current.url,
      category: req.body?.category ?? current.category,
      source: req.body?.source ?? current.source,
      image_url: req.body?.image_url ?? current.image_url,
    });

    if (validation.error) {
      return res.status(400).json({
        message: validation.error,
      });
    }

    const {
      title,
      url,
      category,
      source,
      image_url,
    } = validation.data;

    const result = await pool.query(
      `UPDATE news
       SET title = $1,
           url = $2,
           category = $3,
           source = $4,
           image_url = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        title,
        url,
        category,
        source,
        image_url,
        req.params.id,
      ],
    );

    return res.json({
      message: "Noutatea a fost actualizată.",
      article: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE NEWS ERROR:", error);

    return res.status(500).json({
      message: "Noutatea nu a putut fi actualizată.",
    });
  }
};

// DELETE /api/news/:id
const deleteNews = async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Identificator invalid.",
      });
    }

    const result = await pool.query(
      "DELETE FROM news WHERE id = $1 RETURNING id",
      [req.params.id],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Noutatea nu a fost găsită.",
      });
    }

    return res.json({
      message: "Noutatea a fost ștearsă.",
    });
  } catch (error) {
    console.error("DELETE NEWS ERROR:", error);

    return res.status(500).json({
      message: "Noutatea nu a putut fi ștearsă.",
    });
  }
};

module.exports = {
  getNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
};
