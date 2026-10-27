
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const { put, get, del } = require("@vercel/blob");
const pool = require("../config/database");

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

  return tables[entityType];
};

const validEntityId = (value) =>
  /^[1-9]\d*$/.test(String(value || ""));

const getSafeFilename = (filename) =>
  path
    .basename(filename || "document")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 150);

const getBlobPath = (attachment) => {
  if (
    typeof attachment.file_path !== "string" ||
    !attachment.file_path.startsWith("blob:")
  ) {
    return null;
  }

  return attachment.file_path.slice(5);
};

// ÎNCĂRCARE FIȘIER
const uploadAttachment = async (req, res) => {
  let uploadedBlobPath = null;
  let client = null;
  let transactionStarted = false;

  try {
    const { entityType, entityId, fileCategory } =
      req.body || {};

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

    if (!allowedFileCategories.includes(fileCategory)) {
      return res.status(400).json({
        message: "Categoria fișierului nu este validă.",
      });
    }

    if (entityType === "news") {
      if (
        req.file.size <= 0 ||
        req.file.size > MAX_NEWS_FILE_SIZE
      ) {
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

    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    // Blocăm entitatea pentru a serializa încărcările
    // simultane ale aceleiași noutăți.
    const entityResult = await client.query(
      `SELECT id FROM ${tableName}
       WHERE id = $1
       FOR UPDATE`,
      [entityId]
    );

    if (entityResult.rows.length === 0) {
      await client.query("ROLLBACK");
      transactionStarted = false;

      return res.status(404).json({
        message: "Elementul nu există.",
      });
    }

    if (entityType === "news") {
      const countResult = await client.query(
        `
        SELECT COUNT(*)::integer AS total
        FROM attachments
        WHERE entity_type = 'news'
          AND entity_id = $1
          AND attachment_type = 'file'
        `,
        [entityId]
      );

      const total = Number(
        countResult.rows[0]?.total || 0
      );

      if (total >= MAX_NEWS_FILES) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          message:
            "Pentru o noutate sunt permise maximum 10 fișiere.",
        });
      }
    }

    const filename = getSafeFilename(
      req.file.originalname
    );

    const blobPath =
      `attachments/${entityType}/${entityId}/` +
      `${Date.now()}-${crypto.randomUUID()}-${filename}`;

    const blob = await put(
      blobPath,
      req.file.buffer,
      {
        access: "private",
        contentType: req.file.mimetype,
        addRandomSuffix: false,
      }
    );

    uploadedBlobPath = blob.pathname;

    const result = await client.query(
      `
      INSERT INTO attachments (
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
      VALUES ($1, $2, 'file', $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        entityType,
        entityId,
        fileCategory,
        req.file.originalname,
        req.file.originalname,
        `blob:${blob.pathname}`,
        req.file.mimetype,
        req.file.size,
        req.user?.id || null,
      ]
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
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("ROLLBACK ERROR:", rollbackError);
      }
    }

    if (uploadedBlobPath) {
      try {
        await del(uploadedBlobPath);
      } catch (cleanupError) {
        console.error("BLOB CLEANUP ERROR:", cleanupError);
      }
    }

    return res.status(500).json({
      message: "Fișierul nu a putut fi încărcat.",
    });
  } finally {
    if (client) client.release();
  }
};

// ADAUGĂ LINK
const createAttachmentLink = async (req, res) => {
  try {
    const { entityType, entityId, name, url } =
      req.body || {};

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
          "Pentru noutăți, fotografiile și documentele trebuie încărcate direct.",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Numele linkului este obligatoriu.",
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({
        message: "Linkul este invalid.",
      });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        message: "Sunt permise doar linkuri HTTP și HTTPS.",
      });
    }

    const tableName = getEntityTable(entityType);

    const entityResult = await pool.query(
      `SELECT id FROM ${tableName} WHERE id = $1`,
      [entityId]
    );

    if (!entityResult.rows.length) {
      return res.status(404).json({
        message: "Elementul nu există.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO attachments (
        entity_type,
        entity_id,
        attachment_type,
        name,
        url,
        uploaded_by
      )
      VALUES ($1, $2, 'link', $3, $4, $5)
      RETURNING *
      `,
      [
        entityType,
        entityId,
        name.trim(),
        parsedUrl.toString(),
        req.user?.id || null,
      ]
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

// LISTARE ATAȘAMENTE
const getAttachments = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    if (
      !allowedEntityTypes.includes(entityType) ||
      !validEntityId(entityId)
    ) {
      return res.status(400).json({
        message: "Parametrii sunt invalizi.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        a.*,
        u.username AS uploaded_by_username,
        u.full_name AS uploaded_by_name
      FROM attachments a
      LEFT JOIN users u ON u.id = a.uploaded_by
      WHERE a.entity_type = $1
        AND a.entity_id = $2
      ORDER BY a.created_at DESC, a.id DESC
      `,
      [entityType, entityId]
    );

    return res.json({
      attachments: result.rows,
    });
  } catch (error) {
    console.error("GET ATTACHMENTS ERROR:", error);

    return res.status(500).json({
      message: "Atașamentele nu au putut fi încărcate.",
    });
  }
};

// DESCHIDERE FIȘIER PRIVAT
const getAttachmentFile = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validEntityId(id)) {
      return res.status(400).json({
        message: "ID invalid.",
      });
    }

    const result = await pool.query(
      "SELECT * FROM attachments WHERE id = $1",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Fișierul nu a fost găsit.",
      });
    }

    const attachment = result.rows[0];

    if (attachment.attachment_type !== "file") {
      return res.status(400).json({
        message: "Atașamentul nu este un fișier.",
      });
    }

    const blobPath = getBlobPath(attachment);

    if (!blobPath) {
      return res.status(410).json({
        message:
          "Acest fișier a fost încărcat în vechiul sistem de stocare. Trebuie reîncărcat.",
      });
    }

    const blob = await get(blobPath, {
      access: "private",
    });

    if (!blob || !blob.stream) {
      return res.status(404).json({
        message: "Fișierul nu există în Blob Storage.",
      });
    }

    res.setHeader(
      "Content-Type",
      attachment.mime_type || "application/octet-stream"
    );

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store");

    const filename = getSafeFilename(
      attachment.original_name || attachment.name
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${filename}"`
    );

    Readable.fromWeb(blob.stream)
      .on("error", (error) => {
        console.error("BLOB STREAM ERROR:", error);
        res.destroy(error);
      })
      .pipe(res);
  } catch (error) {
    console.error("GET ATTACHMENT FILE ERROR:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Fișierul nu a putut fi deschis.",
      });
    }

    res.destroy(error);
  }
};

// ȘTERGERE ATAȘAMENT
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
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        message: "Atașamentul nu a fost găsit.",
      });
    }

    const attachment = result.rows[0];
    const blobPath = getBlobPath(attachment);

    if (blobPath) {
      await del(blobPath);
    }

    await pool.query(
      "DELETE FROM attachments WHERE id = $1",
      [id]
    );

    return res.json({
      message: "Atașamentul a fost șters cu succes.",
    });
  } catch (error) {
    console.error("DELETE ATTACHMENT ERROR:", error);

    return res.status(500).json({
      message: "Atașamentul nu a putut fi șters.",
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
