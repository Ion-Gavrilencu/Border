
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const { put, get, del } = require("@vercel/blob");

const pool = require("../config/database");
const { logMonitoringEvent } = require("../services/monitoringService");

const allowedEntityTypes = [
  "telegrame",
  "ordine",
  "legislatie",
  "informatii_utile",
  "news",
];

const allowedFileCategories = [
  "image",
  "video",
  "pdf",
  "word",
  "other",
];

const MAX_NEWS_FILES = 10;
const MAX_NEWS_FILE_SIZE = 4 * 1024 * 1024;

const newsMimeCategories = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "application/pdf": "pdf",
  "application/msword": "word",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "word",
};

const getEntityTable = (entityType) => {
  const tables = {
    telegrame: "telegrame",
    ordine: "ordine",
    legislatie: "legislatie",
    informatii_utile: "informatii_utile",
    news: "news",
  };

  return tables[entityType] || null;
};

const validEntityId = (value) =>
  /^[1-9]\d*$/.test(String(value ?? ""));

const getSafeFilename = (filename) =>
  path
    .basename(String(filename || "document"))
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 150) || "document";

const getBlobPath = (attachment) => {
  if (
    typeof attachment?.file_path !== "string" ||
    !attachment.file_path.startsWith("blob:")
  ) {
    return null;
  }

  const blobPath = attachment.file_path.slice(5);

  return blobPath || null;
};

const isValidHttpUrl = (value) => {
  if (typeof value !== "string") return null;

  try {
    const parsedUrl = new URL(value.trim());

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return null;
    }

    return parsedUrl.toString();
  } catch {
    return null;
  }
};

const getBlobErrorStatus = (error) => {
  const status = Number(
    error?.status ||
      error?.statusCode ||
      error?.response?.status,
  );

  if (status === 404) return 404;
  if (status === 403) return 403;

  if (
    error?.name === "BlobNotFoundError" ||
    error?.code === "not_found" ||
    error?.code === "blob_not_found"
  ) {
    return 404;
  }

  return 500;
};

const rollbackTransaction = async (client) => {
  try {
    await client.query("ROLLBACK");
  } catch (error) {
    console.error("ATTACHMENT ROLLBACK ERROR:", error);
  }
};

// =====================================================
// INCARCARE FISIER
// =====================================================

const uploadAttachment = async (req, res) => {
  let client = null;
  let transactionStarted = false;
  let uploadedBlobPath = null;

  try {
    const {
      entityType,
      entityId,
      fileCategory,
    } = req.body || {};

    if (
      !allowedEntityTypes.includes(entityType) ||
      !validEntityId(entityId)
    ) {
      return res.status(400).json({
        message: "Tipul sau ID-ul entității este invalid.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Nu a fost selectat niciun fișier.",
      });
    }

    if (
      !req.file.buffer ||
      !Buffer.isBuffer(req.file.buffer) ||
      req.file.size <= 0
    ) {
      return res.status(400).json({
        message: "Fișierul încărcat este invalid sau gol.",
      });
    }

    if (!allowedFileCategories.includes(fileCategory)) {
      return res.status(400).json({
        message: "Categoria fișierului nu este validă.",
      });
    }

    if (entityType === "news") {
      if (req.file.size > MAX_NEWS_FILE_SIZE) {
        return res.status(400).json({
          message: "Fișierul trebuie să aibă maximum 4 MB.",
        });
      }

      const expectedCategory =
        newsMimeCategories[req.file.mimetype];

      if (!expectedCategory) {
        return res.status(400).json({
          message:
            "Sunt permise doar JPG, PNG, WEBP, PDF, DOC și DOCX.",
        });
      }

      if (expectedCategory !== fileCategory) {
        return res.status(400).json({
          message:
            "Categoria fișierului nu corespunde formatului.",
        });
      }
    }

    const tableName = getEntityTable(entityType);

    if (!tableName) {
      return res.status(400).json({
        message: "Tipul entității nu este acceptat.",
      });
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    const entityResult = await client.query(
      `SELECT id FROM ${tableName}
       WHERE id = $1
       FOR UPDATE`,
      [entityId],
    );

    if (entityResult.rows.length === 0) {
      await rollbackTransaction(client);
      transactionStarted = false;

      return res.status(404).json({
        message: "Elementul nu există.",
      });
    }

    if (entityType === "news") {
      const countResult = await client.query(
        `SELECT COUNT(*)::integer AS total
         FROM attachments
         WHERE entity_type = 'news'
           AND entity_id = $1
           AND attachment_type = 'file'`,
        [entityId],
      );

      const total = Number(
        countResult.rows[0]?.total || 0,
      );

      if (total >= MAX_NEWS_FILES) {
        await rollbackTransaction(client);
        transactionStarted = false;

        return res.status(409).json({
          message:
            "Pentru o noutate sunt permise maximum 10 fișiere.",
        });
      }
    }

    const filename = getSafeFilename(
      req.file.originalname,
    );

    const blobPath = [
      "attachments",
      entityType,
      entityId,
      `${Date.now()}-${crypto.randomUUID()}-${filename}`,
    ].join("/");

    const blob = await put(
      blobPath,
      req.file.buffer,
      {
        access: "private",
        contentType:
          req.file.mimetype ||
          "application/octet-stream",
        addRandomSuffix: false,
      },
    );

    uploadedBlobPath = blob.pathname;

    const result = await client.query(
      `INSERT INTO attachments (
        entity_type,
        entity_id,
        attachment_type,
        file_category,
        name,
        original_name,
        file_path,
        mime_type,
        file_size,
        uploaded_by
      )
      VALUES (
        $1, $2, 'file', $3, $4,
        $5, $6, $7, $8, $9
      )
      RETURNING *`,
      [
        entityType,
        entityId,
        fileCategory,
        req.file.originalname,
        req.file.originalname,
        `blob:${blob.pathname}`,
        req.file.mimetype ||
          "application/octet-stream",
        req.file.size,
        req.user?.id || null,
      ],
    );

    await client.query("COMMIT");
    transactionStarted = false;
    uploadedBlobPath = null;

    return res.status(201).json({
      message: "Fișierul a fost încărcat cu succes.",
      attachment: result.rows[0],
    });
  } catch (error) {
    console.error("UPLOAD ATTACHMENT ERROR:", error);

    if (transactionStarted && client) {
      await rollbackTransaction(client);
    }

    if (uploadedBlobPath) {
      try {
        await del(uploadedBlobPath);
      } catch (cleanupError) {
        console.error(
          "BLOB CLEANUP ERROR:",
          cleanupError,
        );
      }
    }

    return res.status(500).json({
      message: "Fișierul nu a putut fi încărcat.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};

// =====================================================
// ADAUGARE LINK EXTERN
// =====================================================

const createAttachmentLink = async (req, res) => {
  try {
    const {
      entityType,
      entityId,
      name,
      url,
    } = req.body || {};

    if (
      !allowedEntityTypes.includes(entityType) ||
      !validEntityId(entityId)
    ) {
      return res.status(400).json({
        message: "Tipul sau ID-ul entității este invalid.",
      });
    }

    if (entityType === "news") {
      return res.status(400).json({
        message:
          "Pentru noutăți, fișierele trebuie încărcate direct.",
      });
    }

    if (
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        message: "Numele linkului este obligatoriu.",
      });
    }

    const validUrl = isValidHttpUrl(url);

    if (!validUrl) {
      return res.status(400).json({
        message:
          "Linkul trebuie să înceapă cu http:// sau https://.",
      });
    }

    const tableName = getEntityTable(entityType);

    const entityResult = await pool.query(
      `SELECT id FROM ${tableName} WHERE id = $1`,
      [entityId],
    );

    if (!entityResult.rows.length) {
      return res.status(404).json({
        message: "Elementul nu există.",
      });
    }

    const result = await pool.query(
      `INSERT INTO attachments (
        entity_type,
        entity_id,
        attachment_type,
        name,
        url,
        uploaded_by
      )
      VALUES ($1, $2, 'link', $3, $4, $5)
      RETURNING *`,
      [
        entityType,
        entityId,
        name.trim(),
        validUrl,
        req.user?.id || null,
      ],
    );

    return res.status(201).json({
      message: "Linkul a fost adăugat cu succes.",
      attachment: result.rows[0],
    });
  } catch (error) {
    console.error("CREATE LINK ERROR:", error);

    return res.status(500).json({
      message: "Linkul nu a putut fi adăugat.",
    });
  }
};

// =====================================================
// LISTARE ATASAMENTE
// =====================================================

const getAttachments = async (req, res) => {
  try {
    const {
      entityType,
      entityId,
    } = req.params;

    if (
      !allowedEntityTypes.includes(entityType) ||
      !validEntityId(entityId)
    ) {
      return res.status(400).json({
        message: "Parametrii sunt invalizi.",
      });
    }

    const result = await pool.query(
      `SELECT
        a.*,
        u.username AS uploaded_by_username,
        u.full_name AS uploaded_by_name
      FROM attachments a
      LEFT JOIN users u
        ON u.id = a.uploaded_by
      WHERE a.entity_type = $1
        AND a.entity_id = $2
      ORDER BY a.created_at DESC, a.id DESC`,
      [entityType, entityId],
    );

    return res.status(200).json({
      attachments: result.rows,
    });
  } catch (error) {
    console.error("GET ATTACHMENTS ERROR:", error);

    return res.status(500).json({
      message:
        "Atașamentele nu au putut fi încărcate.",
    });
  }
};

// =====================================================
// DESCHIDERE FISIER PRIVAT
// =====================================================

const getAttachmentFile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validEntityId(id)) {
      return res.status(400).json({
        message: "ID-ul fișierului este invalid.",
      });
    }

    const result = await pool.query(
      "SELECT * FROM attachments WHERE id = $1",
      [id],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Fișierul nu a fost găsit.",
      });
    }

    const attachment = result.rows[0];

    if (attachment.attachment_type !== "file") {
      return res.status(400).json({
        message:
          "Acest atașament este un link, nu un fișier.",
      });
    }

    const blobPath = getBlobPath(attachment);

    if (!blobPath) {
      return res.status(410).json({
        message:
          "Fișierul aparține vechiului sistem de stocare și trebuie reîncărcat.",
      });
    }

    let blob;

    try {
      blob = await get(blobPath, {
        access: "private",
      });
    } catch (error) {
      console.error("VERCEL BLOB GET ERROR:", error);

      const status = getBlobErrorStatus(error);

      if (status === 404) {
        return res.status(404).json({
          message:
            "Fișierul nu mai există în Vercel Blob.",
        });
      }

      if (status === 403) {
        return res.status(502).json({
          message:
            "Serverul nu poate accesa fișierul privat din Vercel Blob.",
        });
      }

      return res.status(502).json({
        message:
          "Serviciul de stocare nu este disponibil momentan.",
      });
    }

    if (!blob || !blob.stream) {
      return res.status(404).json({
        message:
          "Fișierul nu există în sistemul de stocare.",
      });
    }

    const filename = getSafeFilename(
      attachment.original_name ||
        attachment.name,
    );

    res.setHeader(
      "Content-Type",
      attachment.mime_type ||
        "application/octet-stream",
    );

    res.setHeader(
      "X-Content-Type-Options",
      "nosniff",
    );

    res.setHeader(
      "Cache-Control",
      "private, no-store",
    );

    // Cererile existente rămân vizualizări. Descărcarea explicită
    // se solicită cu GET /api/attachments/file/:id?download=1.
    const isDownload = req.query.download === "1";

    res.setHeader(
      "Content-Disposition",
      `${isDownload ? "attachment" : "inline"}; filename="${filename}"`,
    );

    // Înregistrăm evenimentul doar după finalizarea răspunsului.
    // Nu blocăm livrarea fișierului dacă jurnalizarea eșuează.
    res.once("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void logMonitoringEvent({
          userId: req.user?.id,
          action: isDownload ? "download" : "view",
          details: `${isDownload ? "Descărcare" : "Vizualizare"} atașament #${attachment.id}: ${filename} (${attachment.entity_type} #${attachment.entity_id})`,
          req,
        });
      }
    });

    const stream = Readable.fromWeb(blob.stream);

    stream.on("error", (error) => {
      console.error("BLOB STREAM ERROR:", error);

      if (!res.destroyed) {
        res.destroy(error);
      }
    });

    stream.pipe(res);
  } catch (error) {
    console.error(
      "GET ATTACHMENT FILE ERROR:",
      error,
    );

    if (!res.headersSent) {
      return res.status(500).json({
        message:
          "Fișierul nu a putut fi deschis.",
      });
    }

    if (!res.destroyed) {
      res.destroy(error);
    }
  }
};

// =====================================================
// STERGERE ATASAMENT
// =====================================================

const deleteAttachment = async (req, res) => {
  try {
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({
        message:
          "Doar administratorul poate șterge atașamente.",
      });
    }

    const { id } = req.params;

    if (!validEntityId(id)) {
      return res.status(400).json({
        message: "ID invalid.",
      });
    }

    const result = await pool.query(
      "SELECT * FROM attachments WHERE id = $1",
      [id],
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Atașamentul nu a fost găsit.",
      });
    }

    const attachment = result.rows[0];

    const blobPath = getBlobPath(attachment);

    if (blobPath) {
      try {
        await del(blobPath);
      } catch (error) {
        console.error("BLOB DELETE ERROR:", error);

        return res.status(502).json({
          message:
            "Fișierul nu a putut fi șters din Vercel Blob.",
        });
      }
    }

    await pool.query(
      "DELETE FROM attachments WHERE id = $1",
      [id],
    );

    return res.status(200).json({
      message: "Atașamentul a fost șters cu succes.",
    });
  } catch (error) {
    console.error(
      "DELETE ATTACHMENT ERROR:",
      error,
    );

    return res.status(500).json({
      message:
        "Atașamentul nu a putut fi șters.",
    });
  }
};

module.exports = {
  uploadAttachment,
  createAttachmentLink,
  getAttachments,
  getAttachmentFile,
  deleteAttachment,
};
