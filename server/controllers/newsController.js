const pool = require("../config/database");
const { notifyUsers } = require("../services/notificationService");

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
  const title = typeof body.title === "string" ? body.title.trim() : "";

  const type = body.type ?? "external";

  const url = typeof body.url === "string" ? body.url.trim() : "";

  const content = typeof body.content === "string" ? body.content.trim() : "";

  const category =
    typeof body.category === "string" ? body.category.trim() : "altele";

  const source = typeof body.source === "string" ? body.source.trim() : "";

  const imageUrl =
    typeof body.image_url === "string" ? body.image_url.trim() : "";

  const images = body.images ?? [];

  if (!title || title.length > 300) {
    return {
      error: "Titlul trebuie să aibă între 1 și 300 de caractere.",
    };
  }

  if (!["external", "internal"].includes(type)) {
    return { error: "Tipul știrii nu este valid." };
  }

  if (!allowedCategories.includes(category)) {
    return { error: "Categoria selectată nu este validă." };
  }

  if (source.length > 150) {
    return {
      error: "Sursa nu poate depăși 150 de caractere.",
    };
  }

  if (imageUrl && (imageUrl.length > 2048 || !validUrl(imageUrl))) {
    return {
      error: "Linkul imaginii trebuie să fie un URL HTTP/HTTPS valid.",
    };
  }

  if (
    !Array.isArray(images) ||
    images.length > 10 ||
    images.some(
      (item) =>
        typeof item !== "string" || item.length > 2048 || !validUrl(item),
    )
  ) {
    return {
      error: "Galeria poate conține cel mult 10 linkuri HTTP/HTTPS valide.",
    };
  }

  if (type === "external") {
    if (!url || url.length > 2048 || !validUrl(url)) {
      return {
        error: "Introdu un link HTTP/HTTPS valid către articol.",
      };
    }
  } else if (url) {
    return {
      error: "Știrile proprii nu necesită link extern.",
    };
  }

  if (type === "internal" && (!content || content.length > 20000)) {
    return {
      error:
        "Textul știrii proprii trebuie să aibă între 1 și 20000 de caractere.",
    };
  }

  if (type === "external" && content.length > 20000) {
    return {
      error: "Textul nu poate depăși 20000 de caractere.",
    };
  }

  return {
    data: {
      title,
      type,
      url: url || null,
      content: content || null,
      category,
      source: source || null,
      image_url: imageUrl || images[0] || null,
      images,
    },
  };
};

// GET /api/news
const getNews = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        title,
        type,
        url,
        content,
        category,
        source,
        image_url,
        images,
        created_by,
        created_at,
        updated_at
      FROM news
      ORDER BY created_at DESC, id DESC
      LIMIT 100
    `);

    return res.json({
      articles: result.rows,
    });
  } catch (error) {
    console.error("GET NEWS ERROR:", error);

    return res.status(500).json({
      message: "Noutățile nu au putut fi încărcate.",
    });
  }
};

// GET /api/news/:id
const getNewsById = async (req, res) => {
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Identificator invalid.",
    });
  }

  try {
    const result = await pool.query("SELECT * FROM news WHERE id = $1", [
      req.params.id,
    ]);

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Noutatea nu a fost găsită.",
      });
    }

    return res.json({
      article: result.rows[0],
    });
  } catch (error) {
    console.error("GET NEWS BY ID ERROR:", error);

    return res.status(500).json({
      message: "Noutatea nu a putut fi încărcată.",
    });
  }
};

// POST /api/news
const createNews = async (req, res) => {
  const validation = validateNews(req.body || {});

  if (validation.error) {
    return res.status(400).json({
      message: validation.error,
    });
  }

  try {
    const { title, type, url, content, category, source, image_url, images } =
      validation.data;

    const result = await pool.query(
      `INSERT INTO news (
        title,
        type,
        url,
        content,
        category,
        source,
        image_url,
        images,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      RETURNING *`,
      [
        title,
        type,
        url,
        content,
        category,
        source,
        image_url,
        JSON.stringify(images),
        req.user.id,
      ],
    );

    const article = result.rows[0];

    // NOTIFICARE AUTOMATĂ PENTRU ȘTIRE NOUĂ
    try {
      await notifyUsers({
        actorId: req.user.id,
        title: "Știre nouă",
        message: `A fost publicată știrea „${article.title}”.`,
        type: "stire",
        link: `/dashboard?open=${article.id}`,
      });
    } catch (notificationError) {
      // Știrea rămâne salvată dacă notificarea eșuează.
      console.error("CREATE NEWS NOTIFICATION ERROR:", notificationError);
    }

    return res.status(201).json({
      message: "Noutatea a fost adăugată.",
      article,
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
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Identificator invalid.",
    });
  }

  try {
    const existing = await pool.query("SELECT * FROM news WHERE id = $1", [
      req.params.id,
    ]);

    if (!existing.rows.length) {
      return res.status(404).json({
        message: "Noutatea nu a fost găsită.",
      });
    }

    const current = existing.rows[0];

    const validation = validateNews({
      title: req.body?.title ?? current.title,
      type: req.body?.type ?? current.type,
      url: req.body?.url ?? current.url,
      content: req.body?.content ?? current.content,
      category: req.body?.category ?? current.category,
      source: req.body?.source ?? current.source,
      image_url: req.body?.image_url ?? current.image_url,
      images: req.body?.images ?? current.images,
    });

    if (validation.error) {
      return res.status(400).json({
        message: validation.error,
      });
    }

    const { title, type, url, content, category, source, image_url, images } =
      validation.data;

    const result = await pool.query(
      `UPDATE news
       SET
         title = $1,
         type = $2,
         url = $3,
         content = $4,
         category = $5,
         source = $6,
         image_url = $7,
         images = $8::jsonb,
         updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        title,
        type,
        url,
        content,
        category,
        source,
        image_url,
        JSON.stringify(images),
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
  if (!validId(req.params.id)) {
    return res.status(400).json({
      message: "Identificator invalid.",
    });
  }

  try {
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
