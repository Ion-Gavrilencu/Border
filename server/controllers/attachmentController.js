const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

const allowedEntityTypes = [
  "telegrame",
  "ordine",
  "legislatie",
  "informatii_utile",
];

const allowedFileCategories = [
  "image",
  "video",
  "pdf",
  "word",
  "other",
];

const getEntityTable = (entityType) => {
  const tables = {
    telegrame: "telegrame",
    ordine: "ordine",
    legislatie: "legislatie",
    informatii_utile: "informatii_utile",
  };

  return tables[entityType];
};

// =====================================================
// ADAUGĂ FIȘIER
// =====================================================
const uploadAttachment = async (req, res) => {
  try {
    const { entityType, entityId, fileCategory } = req.body;

    if (!allowedEntityTypes.includes(entityType)) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        message: "Tipul entității nu este valid.",
      });
    }

    if (!entityId || Number.isNaN(Number(entityId))) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }

      return res.status(400).json({
        message: "ID-ul entității nu este valid.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Nu a fost selectat niciun fișier.",
      });
    }

    if (!allowedFileCategories.includes(fileCategory)) {
      fs.unlinkSync(req.file.path);

      return res.status(400).json({
        message: "Categoria fișierului nu este validă.",
      });
    }

    const tableName = getEntityTable(entityType);

    const entityResult = await pool.query(
      `SELECT id FROM ${tableName} WHERE id = $1`,
      [entityId]
    );

    if (entityResult.rows.length === 0) {
      fs.unlinkSync(req.file.path);

      return res.status(404).json({
        message: "Elementul pentru care se adaugă fișierul nu există.",
      });
    }

    const result = await pool.query(
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
      VALUES (
        $1,
        $2,
        'file',
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9
      )
      RETURNING *
      `,
      [
        entityType,
        entityId,
        fileCategory,
        req.file.originalname,
        req.file.originalname,
        path.relative(
          path.join(__dirname, ".."),
          req.file.path
        ).replace(/\\/g, "/"),
        req.file.mimetype,
        req.file.size,
        req.user?.id || null,
      ]
    );

    return res.status(201).json({
      message: "Fișierul a fost încărcat cu succes.",
      attachment: result.rows[0],
    });
  } catch (error) {
    console.error("Eroare upload atașament:", error);

    if (req.file) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (deleteError) {
        console.error(
          "Eroare ștergere fișier după eroare:",
          deleteError
        );
      }
    }

    return res.status(500).json({
      message: "Fișierul nu a putut fi încărcat.",
    });
  }
};

// =====================================================
// ADAUGĂ LINK
// =====================================================
const createAttachmentLink = async (req, res) => {
  try {
    const {
      entityType,
      entityId,
      name,
      url,
    } = req.body;

    if (!allowedEntityTypes.includes(entityType)) {
      return res.status(400).json({
        message: "Tipul entității nu este valid.",
      });
    }

    if (!entityId || Number.isNaN(Number(entityId))) {
      return res.status(400).json({
        message: "ID-ul entității nu este valid.",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Numele linkului este obligatoriu.",
      });
    }

    if (!url || !url.trim()) {
      return res.status(400).json({
        message: "Linkul este obligatoriu.",
      });
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return res.status(400).json({
        message: "Linkul introdus nu este valid.",
      });
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({
        message: "Sunt permise doar linkurile HTTP și HTTPS.",
      });
    }

    const tableName = getEntityTable(entityType);

    const entityResult = await pool.query(
      `SELECT id FROM ${tableName} WHERE id = $1`,
      [entityId]
    );

    if (entityResult.rows.length === 0) {
      return res.status(404).json({
        message: "Elementul pentru care se adaugă linkul nu există.",
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
      VALUES (
        $1,
        $2,
        'link',
        $3,
        $4,
        $5
      )
      RETURNING *
      `,
      [
        entityType,
        entityId,
        name.trim(),
        url.trim(),
        req.user?.id || null,
      ]
    );

    return res.status(201).json({
      message: "Linkul a fost adăugat cu succes.",
      attachment: result.rows[0],
    });
  } catch (error) {
    console.error("Eroare adăugare link:", error);

    return res.status(500).json({
      message: "Linkul nu a putut fi adăugat.",
    });
  }
};

// =====================================================
// LISTĂ ATAȘAMENTE
// =====================================================
const getAttachments = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    if (!allowedEntityTypes.includes(entityType)) {
      return res.status(400).json({
        message: "Tipul entității nu este valid.",
      });
    }

    if (!entityId || Number.isNaN(Number(entityId))) {
      return res.status(400).json({
        message: "ID-ul entității nu este valid.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        a.*,
        u.username AS uploaded_by_username,
        u.full_name AS uploaded_by_name
      FROM attachments a
      LEFT JOIN users u
        ON u.id = a.uploaded_by
      WHERE a.entity_type = $1
        AND a.entity_id = $2
      ORDER BY a.created_at DESC
      `,
      [entityType, entityId]
    );

    return res.json({
      attachments: result.rows,
    });
  } catch (error) {
    console.error("Eroare încărcare atașamente:", error);

    return res.status(500).json({
      message: "Atașamentele nu au putut fi încărcate.",
    });
  }
};

// =====================================================
// ȘTERGE ATAȘAMENT
// =====================================================
const deleteAttachment = async (req, res) => {
  try {
    const { id } = req.params;

    const attachmentResult = await pool.query(
      `
      SELECT *
      FROM attachments
      WHERE id = $1
      `,
      [id]
    );

    if (attachmentResult.rows.length === 0) {
      return res.status(404).json({
        message: "Atașamentul nu a fost găsit.",
      });
    }

    const attachment = attachmentResult.rows[0];

    if (attachment.attachment_type === "file") {
      const filePath = path.join(
        __dirname,
        "..",
        attachment.file_path
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await pool.query(
      `
      DELETE FROM attachments
      WHERE id = $1
      `,
      [id]
    );

    return res.json({
      message: "Atașamentul a fost șters cu succes.",
    });
  } catch (error) {
    console.error("Eroare ștergere atașament:", error);

    return res.status(500).json({
      message: "Atașamentul nu a putut fi șters.",
    });
  }
};

const getAttachmentFile = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM attachments
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Fișierul nu a fost găsit.",
      });
    }

    const attachment = result.rows[0];

    if (attachment.attachment_type !== "file") {
      return res.status(400).json({
        message: "Acest atașament este un link, nu un fișier.",
      });
    }

    if (!attachment.file_path) {
      return res.status(404).json({
        message: "Calea fișierului nu există.",
      });
    }

    const uploadsDirectory = path.resolve(
      __dirname,
      "..",
      "uploads",
      "attachments"
    );

    const filePath = path.resolve(
      __dirname,
      "..",
      attachment.file_path
    );

    // Verificare de securitate:
    // fișierul trebuie să fie în directorul uploads/attachments
    if (
      filePath !== uploadsDirectory &&
      !filePath.startsWith(uploadsDirectory + path.sep)
    ) {
      return res.status(403).json({
        message: "Accesul la acest fișier nu este permis.",
      });
    }

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        message: "Fișierul nu mai există pe server.",
      });
    }

    res.setHeader(
      "Content-Type",
      attachment.mime_type || "application/octet-stream"
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(
        attachment.original_name || attachment.name
      )}"`
    );

    return res.sendFile(filePath);
  } catch (error) {
    console.error("Eroare accesare fișier:", error);

    return res.status(500).json({
      message: "Fișierul nu a putut fi accesat.",
    });
  }
};

module.exports = {
  uploadAttachment,
  createAttachmentLink,
  getAttachments,
  deleteAttachment,
  getAttachmentFile,
};