const pool = require("../config/database");
const {
  isLocalStorage,
  resolveLocalPath,
  removeLocalFile,
} = require("../services/attachmentStorage");

const { createAuditLog } = require("./auditController");

const { notifyUsers } = require("../services/notificationService");

const validId = (id) => /^[1-9]\d*$/.test(String(id ?? ""));

const invalidId = (res) => res.status(400).json({ message: "ID-ul telegramei este invalid." });

const getTelegrame = async (req, res) => {
  try {
    const result = await pool.query(
      `

      SELECT t.id, t.title, t.number, t.telegram_date, t.content,

             t.created_by, t.created_at, t.updated_at,

             u.username AS created_by_username, u.full_name AS created_by_name,

             EXISTS (SELECT 1 FROM telegram_favorites f

                     WHERE f.telegram_id = t.id AND f.user_id = $1) AS is_favorite,

             COALESCE(ac.attachments_count, 0)::integer AS attachments_count

      FROM telegrame t

      LEFT JOIN users u ON u.id = t.created_by

      LEFT JOIN (

        SELECT entity_id, COUNT(*) AS attachments_count

        FROM attachments WHERE entity_type = 'telegrame'

        GROUP BY entity_id

      ) ac ON ac.entity_id = t.id

      ORDER BY t.telegram_date DESC NULLS LAST, t.id DESC

    `,

      [req.user.id],
    );

    return res.status(200).json({ telegrame: result.rows });
  } catch (error) {
    console.error("GET TELEGRAME ERROR:", error);

    return res.status(500).json({ message: "Eroare la încărcarea telegramelor." });
  }
};

const getTelegramById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) return invalidId(res);

    const result = await pool.query(
      `

      SELECT t.id, t.title, t.number, t.telegram_date, t.content,

             t.created_by, t.created_at, t.updated_at,

             u.username AS created_by_username, u.full_name AS created_by_name,

             EXISTS (SELECT 1 FROM telegram_favorites f

                     WHERE f.telegram_id = t.id AND f.user_id = $2) AS is_favorite,

             (SELECT COUNT(*)::integer FROM attachments a

              WHERE a.entity_type = 'telegrame' AND a.entity_id = t.id) AS attachments_count

      FROM telegrame t

      LEFT JOIN users u ON u.id = t.created_by

      WHERE t.id = $1

    `,

      [id, req.user.id],
    );

    if (!result.rows.length)
      return res.status(404).json({ message: "Telegrama nu a fost găsită." });

    return res.status(200).json({ telegram: result.rows[0] });
  } catch (error) {
    console.error("GET TELEGRAM BY ID ERROR:", error);

    return res.status(500).json({ message: "Eroare la încărcarea telegramei." });
  }
};

const createTelegram = async (req, res) => {
  try {
    const { title, number, telegramDate, content } = req.body || {};

    if (typeof title !== "string" || !title.trim())
      return res.status(400).json({ message: "Denumirea telegramei este obligatorie." });

    const result = await pool.query(
      `

      INSERT INTO telegrame (title, number, telegram_date, content, created_by)

      VALUES ($1, $2, $3, $4, $5)

      RETURNING id, title, number, telegram_date, content, created_by, created_at, updated_at

    `,

      [
        title.trim(),

        typeof number === "string" ? number.trim() || null : null,

        telegramDate || null,

        typeof content === "string" ? content : "",

        req.user.id,
      ],
    );

    const telegram = result.rows[0];

    await createAuditLog({
      userId: req.user.id,

      action: "CREATE",

      entityType: "telegrama",

      entityId: telegram.id,

      description: `A creat telegrama "${telegram.title}"`,
    });

    try {
      await notifyUsers({
        actorId: req.user.id,

        title: "Telegramă nouă",

        message: `A fost adăugată telegrama „${telegram.title}”.`,

        type: "telegrama",

        link: `/telegrame?open=${telegram.id}`,
      });
    } catch (error) {
      console.error("CREATE TELEGRAM NOTIFICATION ERROR:", error);
    }

    return res.status(201).json({ message: "Telegrama a fost adăugată.", telegram });
  } catch (error) {
    console.error("CREATE TELEGRAM ERROR:", error);

    return res.status(500).json({ message: "Eroare la adăugarea telegramei." });
  }
};

const updateTelegram = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) return invalidId(res);

    const { title, number, telegramDate, content } = req.body || {};

    if (typeof title !== "string" || !title.trim())
      return res.status(400).json({ message: "Denumirea telegramei este obligatorie." });

    const result = await pool.query(
      `

      UPDATE telegrame SET title = $1, number = $2, telegram_date = $3,

        content = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5

      RETURNING id, title, number, telegram_date, content, created_by, created_at, updated_at

    `,

      [
        title.trim(),

        typeof number === "string" ? number.trim() || null : null,

        telegramDate || null,

        typeof content === "string" ? content : "",

        id,
      ],
    );

    if (!result.rows.length)
      return res.status(404).json({ message: "Telegrama nu a fost găsită." });

    const telegram = result.rows[0];

    await createAuditLog({
      userId: req.user.id,

      action: "UPDATE",

      entityType: "telegrama",

      entityId: telegram.id,

      description: `A modificat telegrama "${telegram.title}"`,
    });

    return res.status(200).json({ message: "Telegrama a fost actualizată.", telegram });
  } catch (error) {
    console.error("UPDATE TELEGRAM ERROR:", error);

    return res.status(500).json({ message: "Eroare la actualizarea telegramei." });
  }
};

// Ștergere tranzacțională cu suport pentru stocare locală și Vercel Blob.
const deleteTelegram = async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return invalidId(res);

  let client;
  let transactionStarted = false;
  let deletedTelegram;
  let queuedFiles = 0;
  const localFiles = [];

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const found = await client.query("SELECT id, title FROM telegrame WHERE id = $1 FOR UPDATE", [
      id,
    ]);
    if (!found.rows.length) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ message: "Telegrama nu a fost găsită." });
    }
    deletedTelegram = found.rows[0];

    const attachments = await client.query(
      `SELECT id, attachment_type, file_path FROM attachments
       WHERE entity_type = 'telegrame' AND entity_id = $1 FOR UPDATE`,
      [id],
    );

    for (const attachment of attachments.rows) {
      if (attachment.attachment_type === "link") continue;
      if (attachment.attachment_type !== "file" || typeof attachment.file_path !== "string") {
        const error = new Error(`Atașament necunoscut: ${attachment.id}`);
        error.code = "INVALID_ATTACHMENT";
        throw error;
      }

      const storedPath = attachment.file_path;
      const isLocal = storedPath.startsWith("local:");
      const isBlob = storedPath.startsWith("blob:");
      const relativePath = storedPath.slice(isLocal ? 6 : 5);
      const match = /^attachments\/telegrame\/([1-9]\d*)\/([^/]+)$/.exec(relativePath);
      if (
        (!isLocal && !isBlob) ||
        !match ||
        match[1] !== String(id) ||
        match[2] === "." ||
        match[2] === ".." ||
        match[2].includes("\\")
      ) {
        const error = new Error(`Cale invalidă pentru atașamentul ${attachment.id}`);
        error.code = "INVALID_ATTACHMENT";
        throw error;
      }

      const shared = await client.query(
        "SELECT id FROM attachments WHERE file_path = $1 AND id <> $2 LIMIT 1",
        [storedPath, attachment.id],
      );
      if (shared.rowCount) {
        const error = new Error(`Cale partajată: ${attachment.id}`);
        error.code = "SHARED_ATTACHMENT";
        throw error;
      }

      if (isLocal) {
        if (!isLocalStorage() || !resolveLocalPath(storedPath)) {
          const error = new Error(`Fișier local indisponibil: ${attachment.id}`);
          error.code = "INVALID_ATTACHMENT";
          throw error;
        }
        localFiles.push(storedPath);
      } else {
        const queued = await client.query(
          `INSERT INTO blob_cleanup_queue
             (blob_path, source_entity_type, source_entity_id, source_attachment_id, reason)
           VALUES ($1, 'telegrame', $2, $3, 'telegram_deleted')
           ON CONFLICT (blob_path) DO UPDATE
             SET updated_at = blob_cleanup_queue.updated_at
           WHERE blob_cleanup_queue.status IN ('pending', 'error')
           RETURNING id`,
          [relativePath, id, attachment.id],
        );
        if (queued.rowCount !== 1) {
          const error = new Error(`Fișier Blob deja procesat sau în procesare: ${attachment.id}`);
          error.code = "BLOB_QUEUE_CONFLICT";
          throw error;
        }
        queuedFiles += 1;
      }
    }

    await client.query(
      "DELETE FROM attachments WHERE entity_type = 'telegrame' AND entity_id = $1",
      [id],
    );
    await client.query("DELETE FROM telegrame WHERE id = $1", [id]);
    await client.query("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted && client) {
      await client
        .query("ROLLBACK")
        .catch((rollbackError) => console.error("DELETE TELEGRAM ROLLBACK ERROR:", rollbackError));
    }
    console.error("DELETE TELEGRAM ERROR:", error);
    const conflict = ["INVALID_ATTACHMENT", "SHARED_ATTACHMENT", "BLOB_QUEUE_CONFLICT"].includes(
      error.code,
    );
    return res.status(conflict ? 409 : 500).json({
      message: conflict
        ? "Ștergerea a fost anulată: un atașament necesită verificare."
        : "Telegrama nu a putut fi ștearsă.",
    });
  } finally {
    if (client) client.release();
  }

  const failedLocalFiles = [];
  for (const storedPath of localFiles) {
    try {
      await removeLocalFile(storedPath);
    } catch (error) {
      console.error("DELETE TELEGRAM LOCAL CLEANUP ERROR:", error);
      failedLocalFiles.push(storedPath);
    }
  }

  try {
    await createAuditLog({
      userId: req.user.id,
      action: "DELETE",
      entityType: "telegrama",
      entityId: Number(id),
      description: `A șters telegrama "${deletedTelegram.title}" (ID ${id}); ${queuedFiles} fișiere Blob în coadă; ${localFiles.length - failedLocalFiles.length} fișiere locale șterse`,
    });
  } catch (error) {
    console.error("DELETE TELEGRAM AUDIT ERROR:", error);
  }

  return res.status(200).json({
    message: failedLocalFiles.length
      ? "Telegrama a fost ștearsă, dar unele fișiere locale necesită curățare manuală."
      : "Telegrama și atașamentele au fost eliminate. Curățarea Blob, dacă există, a fost programată.",
    telegram: deletedTelegram,
    queuedFiles,
    deletedLocalFiles: localFiles.length - failedLocalFiles.length,
    failedLocalFiles: failedLocalFiles.length,
    warning: failedLocalFiles.length > 0,
  });
};

const addTelegramFavorite = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) return invalidId(res);

    const found = await pool.query("SELECT id FROM telegrame WHERE id = $1", [id]);

    if (!found.rows.length) return res.status(404).json({ message: "Telegrama nu a fost găsită." });

    await pool.query(
      `INSERT INTO telegram_favorites (user_id, telegram_id)

      VALUES ($1, $2) ON CONFLICT (user_id, telegram_id) DO NOTHING`,

      [req.user.id, id],
    );

    return res.status(200).json({
      message: "Telegrama a fost adăugată la favorite.",

      telegram_id: Number(id),

      is_favorite: true,
    });
  } catch (error) {
    if (error.code === "23503")
      return res.status(404).json({ message: "Telegrama sau utilizatorul nu mai există." });

    console.error("ADD TELEGRAM FAVORITE ERROR:", error);

    return res.status(500).json({ message: "Telegrama nu a putut fi adăugată la favorite." });
  }
};

const removeTelegramFavorite = async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) return invalidId(res);

    await pool.query("DELETE FROM telegram_favorites WHERE user_id = $1 AND telegram_id = $2", [
      req.user.id,

      id,
    ]);

    return res.status(200).json({
      message: "Telegrama a fost eliminată din favorite.",

      telegram_id: Number(id),

      is_favorite: false,
    });
  } catch (error) {
    console.error("REMOVE TELEGRAM FAVORITE ERROR:", error);

    return res.status(500).json({ message: "Telegrama nu a putut fi eliminată din favorite." });
  }
};

module.exports = {
  getTelegrame,

  getTelegramById,

  createTelegram,

  updateTelegram,

  deleteTelegram,

  addTelegramFavorite,

  removeTelegramFavorite,
};
