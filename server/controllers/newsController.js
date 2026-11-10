const pool = require("../config/database");

const { notifyUsers } = require("../services/notificationService");

const {
  isLocalStorage,

  resolveLocalPath,

  removeLocalFile,
} = require("../services/attachmentStorage");

const allowedCategories = ["documente", "transport", "contrabanda", "migratie", "altele"];

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

  const category = typeof body.category === "string" ? body.category.trim() : "altele";

  const source = typeof body.source === "string" ? body.source.trim() : "";

  const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() : "";

  const images = body.images ?? [];

  if (!title || title.length > 300)
    return { error: "Titlul trebuie să aibă între 1 și 300 de caractere." };

  if (!["external", "internal"].includes(type)) return { error: "Tipul știrii nu este valid." };

  if (!allowedCategories.includes(category))
    return { error: "Categoria selectată nu este validă." };

  if (source.length > 150) return { error: "Sursa nu poate depăși 150 de caractere." };

  if (imageUrl && (imageUrl.length > 2048 || !validUrl(imageUrl))) {
    return { error: "Linkul imaginii trebuie să fie un URL HTTP/HTTPS valid." };
  }

  if (
    !Array.isArray(images) ||
    images.length > 10 ||
    images.some((item) => typeof item !== "string" || item.length > 2048 || !validUrl(item))
  ) {
    return { error: "Galeria poate conține cel mult 10 linkuri HTTP/HTTPS valide." };
  }

  if (type === "external") {
    if (!url || url.length > 2048 || !validUrl(url)) {
      return { error: "Introdu un link HTTP/HTTPS valid către articol." };
    }
  } else if (url) {
    return { error: "Știrile proprii nu necesită link extern." };
  }

  if (type === "internal" && (!content || content.length > 20000)) {
    return { error: "Textul știrii proprii trebuie să aibă între 1 și 20000 de caractere." };
  }

  if (type === "external" && content.length > 20000) {
    return { error: "Textul nu poate depăși 20000 de caractere." };
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
    const limitRaw = Number(req.query.limit ?? 2);
    const offsetRaw = Number(req.query.offset ?? 0);
    if (
      !Number.isSafeInteger(limitRaw) ||
      limitRaw < 1 ||
      limitRaw > 50 ||
      !Number.isSafeInteger(offsetRaw) ||
      offsetRaw < 0
    ) {
      return res.status(400).json({ message: "Parametri de paginare invalizi." });
    }
    const category = req.query.category || "toate";
    if (category !== "toate" && !allowedCategories.includes(category)) {
      return res.status(400).json({ message: "Categoria selectată nu este validă." });
    }

    const result = await pool.query(
      `
      SELECT n.id, n.title, n.type, n.url, n.content, n.category, n.source,
             n.image_url, n.images, n.created_by, n.created_at, n.updated_at,
             img.id AS main_image_id, img.name AS main_image_name,
             img.original_name AS main_image_original_name
      FROM news n
      LEFT JOIN LATERAL (
        SELECT a.id, a.name, a.original_name
        FROM attachments a
        WHERE a.entity_type = 'news' AND a.entity_id = n.id
          AND a.attachment_type = 'file' AND a.file_category = 'image'
        ORDER BY a.id ASC LIMIT 1
      ) img ON TRUE
      WHERE ($1::text = 'toate' OR n.category = $1)
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT $2 OFFSET $3
    `,
      [category, limitRaw, offsetRaw],
    );

    const totalsResult = await pool.query(`
      SELECT category, COUNT(*)::integer AS count FROM news GROUP BY category
    `);
    const counts = Object.fromEntries(allowedCategories.map((name) => [name, 0]));
    for (const row of totalsResult.rows) {
      if (Object.hasOwn(counts, row.category)) counts[row.category] = Number(row.count);
    }
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
    const articles = result.rows.map(
      ({ main_image_id, main_image_name, main_image_original_name, ...article }) => ({
        ...article,
        mainImage:
          main_image_id == null
            ? null
            : {
                id: main_image_id,
                name: main_image_name,
                original_name: main_image_original_name,
                attachment_type: "file",
                file_category: "image",
              },
      }),
    );
    const filteredTotal = category === "toate" ? total : counts[category];
    return res.json({
      articles,
      total,
      counts,
      filteredTotal,
      limit: limitRaw,
      offset: offsetRaw,
      hasMore: offsetRaw + articles.length < filteredTotal,
    });
  } catch (error) {
    console.error("GET NEWS ERROR:", error);
    return res.status(500).json({ message: "Noutățile nu au putut fi încărcate." });
  }
};

// GET /api/news/:id

const getNewsById = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Identificator invalid." });

  try {
    const result = await pool.query("SELECT * FROM news WHERE id = $1", [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ message: "Noutatea nu a fost găsită." });

    return res.json({ article: result.rows[0] });
  } catch (error) {
    console.error("GET NEWS BY ID ERROR:", error);

    return res.status(500).json({ message: "Noutatea nu a putut fi încărcată." });
  }
};

// POST /api/news

const createNews = async (req, res) => {
  const validation = validateNews(req.body || {});

  if (validation.error) return res.status(400).json({ message: validation.error });

  try {
    const { title, type, url, content, category, source, image_url, images } = validation.data;

    const result = await pool.query(
      `INSERT INTO news (title, type, url, content, category, source, image_url, images, created_by)

       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) RETURNING *`,

      [title, type, url, content, category, source, image_url, JSON.stringify(images), req.user.id],
    );

    const article = result.rows[0];

    try {
      await notifyUsers({
        actorId: req.user.id,

        title: "Știre nouă",

        message: `A fost publicată știrea „${article.title}”.`,

        type: "stire",

        link: `/dashboard?open=${article.id}`,
      });
    } catch (notificationError) {
      console.error("CREATE NEWS NOTIFICATION ERROR:", notificationError);
    }

    return res.status(201).json({ message: "Noutatea a fost adăugată.", article });
  } catch (error) {
    console.error("CREATE NEWS ERROR:", error);

    return res.status(500).json({ message: "Noutatea nu a putut fi adăugată." });
  }
};

// PATCH /api/news/:id

const updateNews = async (req, res) => {
  if (!validId(req.params.id)) return res.status(400).json({ message: "Identificator invalid." });

  try {
    const existing = await pool.query("SELECT * FROM news WHERE id = $1", [req.params.id]);

    if (!existing.rows.length)
      return res.status(404).json({ message: "Noutatea nu a fost găsită." });

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

    if (validation.error) return res.status(400).json({ message: validation.error });

    const { title, type, url, content, category, source, image_url, images } = validation.data;

    const result = await pool.query(
      `UPDATE news SET title = $1, type = $2, url = $3, content = $4,

       category = $5, source = $6, image_url = $7, images = $8::jsonb,

       updated_at = NOW() WHERE id = $9 RETURNING *`,

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

    return res.json({ message: "Noutatea a fost actualizată.", article: result.rows[0] });
  } catch (error) {
    console.error("UPDATE NEWS ERROR:", error);

    return res.status(500).json({ message: "Noutatea nu a putut fi actualizată." });
  }
};

// DELETE /api/news/:id

// DB și coada Blob se modifică atomic; fișierele locale se șterg numai după COMMIT.

const deleteNews = async (req, res) => {
  const { id } = req.params;

  if (!validId(id)) return res.status(400).json({ message: "Identificator invalid." });

  let client;

  let transactionStarted = false;

  let queuedFiles = 0;

  let deletedArticle;

  const localFiles = [];

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    transactionStarted = true;

    // Ordinea blocării corespunde încărcării atașamentelor: părinte, apoi atașamente.

    const found = await client.query("SELECT id, title FROM news WHERE id = $1 FOR UPDATE", [id]);

    if (!found.rows.length) {
      await client.query("ROLLBACK");

      transactionStarted = false;

      return res.status(404).json({ message: "Noutatea nu a fost găsită." });
    }

    deletedArticle = found.rows[0];

    const attachments = await client.query(
      `SELECT id, attachment_type, file_path FROM attachments

       WHERE entity_type = 'news' AND entity_id = $1 FOR UPDATE`,

      [id],
    );

    for (const attachment of attachments.rows) {
      if (attachment.attachment_type === "link") continue;

      if (attachment.attachment_type !== "file" || typeof attachment.file_path !== "string") {
        const error = new Error(`Tip sau cale necunoscută pentru atașamentul ${attachment.id}`);

        error.code = "UNSUPPORTED_ATTACHMENT_PATH";

        throw error;
      }

      const filePath = attachment.file_path;

      const localPath = resolveLocalPath(filePath);

      const isBlob = filePath.startsWith("blob:");

      const blobPath = isBlob ? filePath.slice(5) : null;

      const match = blobPath && /^attachments\/news\/([1-9]\d*)\/[^/]+$/.exec(blobPath);

      if (localPath) {
        if (!isLocalStorage()) {
          const error = new Error("Fișierul local nu poate fi șters din producție.");

          error.code = "UNSUPPORTED_ATTACHMENT_PATH";

          throw error;
        }

        // Asigurăm că fișierul aparține exact acestei noutăți.

        const expectedPrefix = `attachments/news/${id}/`;

        if (!filePath.slice("local:".length).startsWith(expectedPrefix)) {
          const error = new Error("Cale locală asociată altui document.");

          error.code = "UNSUPPORTED_ATTACHMENT_PATH";

          throw error;
        }
      } else if (!match || match[1] !== String(id)) {
        const error = new Error(`Cale invalidă pentru atașamentul ${attachment.id}`);

        error.code = "UNSUPPORTED_ATTACHMENT_PATH";

        throw error;
      }

      const shared = await client.query(
        "SELECT id FROM attachments WHERE file_path = $1 AND id <> $2 LIMIT 1",

        [filePath, attachment.id],
      );

      if (shared.rowCount > 0) {
        const error = new Error(`Fișierul ${attachment.id} este folosit și de alt atașament.`);

        error.code = "SHARED_ATTACHMENT_PATH";

        throw error;
      }

      if (localPath) {
        localFiles.push(filePath);
      } else {
        const queued = await client.query(
          `INSERT INTO blob_cleanup_queue

           (blob_path, source_entity_type, source_entity_id, source_attachment_id, reason)

           VALUES ($1, 'news', $2, $3, 'news_deleted')

           ON CONFLICT (blob_path) DO NOTHING RETURNING id`,

          [blobPath, id, attachment.id],
        );

        if (queued.rowCount !== 1) {
          const error = new Error(`Blob ${blobPath} există deja în coada de curățare.`);

          error.code = "BLOB_QUEUE_CONFLICT";

          throw error;
        }

        queuedFiles += 1;
      }
    }

    await client.query("DELETE FROM attachments WHERE entity_type = 'news' AND entity_id = $1", [
      id,
    ]);

    await client.query("DELETE FROM news WHERE id = $1", [id]);

    await client.query("COMMIT");

    transactionStarted = false;
  } catch (error) {
    if (transactionStarted && client) {
      await client.query("ROLLBACK").catch((rollbackError) => {
        console.error("DELETE NEWS ROLLBACK ERROR:", rollbackError);
      });
    }

    console.error("DELETE NEWS ERROR:", error);

    if (
      ["UNSUPPORTED_ATTACHMENT_PATH", "SHARED_ATTACHMENT_PATH", "BLOB_QUEUE_CONFLICT"].includes(
        error.code,
      )
    ) {
      return res.status(409).json({
        message:
          "Ștergerea a fost anulată: un atașament are o cale invalidă, partajată sau deja programată pentru curățare.",
      });
    }

    return res.status(500).json({ message: "Noutatea nu a putut fi ștearsă." });
  } finally {
    if (client) client.release();
  }

  const cleanupFailures = [];

  for (const storedPath of localFiles) {
    try {
      await removeLocalFile(storedPath);
    } catch (error) {
      console.error("DELETE NEWS LOCAL FILE ERROR:", error);

      cleanupFailures.push(storedPath);
    }
  }

  return res.status(200).json({
    message: cleanupFailures.length
      ? "Noutatea a fost ștearsă, dar unele fișiere locale necesită curățare manuală."
      : queuedFiles
        ? "Noutatea a fost ștearsă. Curățarea fișierelor Blob a fost programată."
        : "Noutatea și atașamentele locale au fost șterse.",

    article: deletedArticle,

    queuedFiles,

    warning: cleanupFailures.length > 0,

    failedLocalFiles: cleanupFailures.length,
  });
};

module.exports = { getNews, getNewsById, createNews, updateNews, deleteNews };
