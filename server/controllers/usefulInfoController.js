const pool = require("../config/database");

const { createAuditLog } = require("./auditController");

const { notifyUsers } = require("../services/notificationService");

const isValidUsefulInfoId = (id) => /^[1-9]\d*$/.test(String(id ?? ""));

const getUsefulInfo = async (req, res) => {
  try {
    const result = await pool.query(
      `

      SELECT i.id, i.title, i.category, i.content, i.created_by,

        i.created_at, i.updated_at,

        u.username AS created_by_username, u.full_name AS created_by_name,

        EXISTS (

          SELECT 1 FROM useful_info_favorites f

          WHERE f.info_id = i.id AND f.user_id = $1

        ) AS is_favorite,

        (

          SELECT COUNT(*)::integer FROM attachments a

          WHERE a.entity_type = 'informatii_utile' AND a.entity_id = i.id

        ) AS attachments_count

      FROM informatii_utile i

      LEFT JOIN users u ON i.created_by = u.id

      ORDER BY i.created_at DESC, i.id DESC

    `,

      [req.user.id],
    );

    return res.status(200).json({ informatii: result.rows });
  } catch (error) {
    console.error("GET USEFUL INFO ERROR:", error);

    return res.status(500).json({ message: "Eroare la încărcarea informațiilor utile." });
  }
};

const getUsefulInfoById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUsefulInfoId(id)) {
      return res.status(400).json({ message: "ID-ul informației utile este invalid." });
    }

    const result = await pool.query(
      `

      SELECT i.id, i.title, i.category, i.content, i.created_by,

        i.created_at, i.updated_at,

        u.username AS created_by_username, u.full_name AS created_by_name,

        EXISTS (

          SELECT 1 FROM useful_info_favorites f

          WHERE f.info_id = i.id AND f.user_id = $2

        ) AS is_favorite,

        (

          SELECT COUNT(*)::integer FROM attachments a

          WHERE a.entity_type = 'informatii_utile' AND a.entity_id = i.id

        ) AS attachments_count

      FROM informatii_utile i

      LEFT JOIN users u ON i.created_by = u.id

      WHERE i.id = $1

    `,

      [id, req.user.id],
    );

    if (!result.rows.length)
      return res.status(404).json({ message: "Informația utilă nu a fost găsită." });

    return res.status(200).json({ informatie: result.rows[0] });
  } catch (error) {
    console.error("GET USEFUL INFO BY ID ERROR:", error);

    return res.status(500).json({ message: "Eroare la încărcarea informației utile." });
  }
};

const createUsefulInfo = async (req, res) => {
  try {
    const { title, category, content } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Titlul informației este obligatoriu." });
    }

    const result = await pool.query(
      `

      INSERT INTO informatii_utile (title, category, content, created_by)

      VALUES ($1, $2, $3, $4)

      RETURNING id, title, category, content, created_by, created_at, updated_at

    `,

      [
        title.trim(),

        typeof category === "string" ? category.trim() || null : null,

        typeof content === "string" ? content : "",

        req.user.id,
      ],
    );

    const informatie = result.rows[0];

    await createAuditLog({
      userId: req.user.id,

      action: "CREATE",

      entityType: "informatii",

      entityId: informatie.id,

      description: `A creat informația utilă "${informatie.title}"`,
    });

    try {
      const categoryText = informatie.category ? ` în categoria „${informatie.category}”` : "";

      await notifyUsers({
        actorId: req.user.id,

        title: "Informație utilă nouă",

        message: `A fost adăugată informația „${informatie.title}”${categoryText}.`,

        type: "informatii",

        link: `/informatii-utile?open=${informatie.id}`,
      });
    } catch (notificationError) {
      console.error("CREATE USEFUL INFO NOTIFICATION ERROR:", notificationError);
    }

    return res.status(201).json({ message: "Informația utilă a fost adăugată.", informatie });
  } catch (error) {
    console.error("CREATE USEFUL INFO ERROR:", error);

    return res.status(500).json({ message: "Eroare la adăugarea informației utile." });
  }
};

const updateUsefulInfo = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidUsefulInfoId(id)) {
      return res.status(400).json({ message: "ID-ul informației utile este invalid." });
    }

    const { title, category, content } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Titlul informației este obligatoriu." });
    }

    const result = await pool.query(
      `

      UPDATE informatii_utile SET title = $1, category = $2,

        content = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4

      RETURNING id, title, category, content, created_by, created_at, updated_at

    `,

      [
        title.trim(),

        typeof category === "string" ? category.trim() || null : null,

        typeof content === "string" ? content : "",

        id,
      ],
    );

    if (!result.rows.length)
      return res.status(404).json({ message: "Informația utilă nu a fost găsită." });

    await createAuditLog({
      userId: req.user.id,

      action: "UPDATE",

      entityType: "informatii",

      entityId: result.rows[0].id,

      description: `A modificat informația utilă "${result.rows[0].title}"`,
    });

    return res

      .status(200)

      .json({ message: "Informația utilă a fost actualizată.", informatie: result.rows[0] });
  } catch (error) {
    console.error("UPDATE USEFUL INFO ERROR:", error);

    return res.status(500).json({ message: "Eroare la actualizarea informației utile." });
  }
};

// Ștergere tranzacțională: datele sunt șterse împreună;
// fișierele locale sunt eliminate numai după COMMIT.
const {
  isLocalStorage,
  resolveLocalPath,
  removeLocalFile,
} = require("../services/attachmentStorage");

const deleteUsefulInfo = async (req, res) => {
  const { id } = req.params;
  if (!isValidUsefulInfoId(id)) {
    return res.status(400).json({ message: "ID-ul informației utile este invalid." });
  }
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Doar administratorul poate șterge informații." });
  }

  let client;
  let inTransaction = false;
  let deletedInfo;
  let queuedFiles = 0;
  const localFiles = [];

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    inTransaction = true;

    const found = await client.query(
      "SELECT id, title FROM informatii_utile WHERE id = $1 FOR UPDATE",
      [id],
    );
    if (!found.rows.length) {
      await client.query("ROLLBACK");
      inTransaction = false;
      return res.status(404).json({ message: "Informația utilă nu a fost găsită." });
    }
    deletedInfo = found.rows[0];

    const attachments = await client.query(
      `SELECT id, attachment_type, file_path
       FROM attachments
       WHERE entity_type = 'informatii_utile' AND entity_id = $1
       FOR UPDATE`,
      [id],
    );

    for (const attachment of attachments.rows) {
      if (attachment.attachment_type === "link") continue;
      if (attachment.attachment_type !== "file" || typeof attachment.file_path !== "string") {
        const error = new Error(`Atașament invalid: ${attachment.id}`);
        error.code = "UNSUPPORTED_ATTACHMENT_PATH";
        throw error;
      }

      const localPath = resolveLocalPath(attachment.file_path);
      const isBlob = attachment.file_path.startsWith("blob:");
      if (!localPath && !isBlob) {
        const error = new Error(`Cale de fișier necunoscută: ${attachment.id}`);
        error.code = "UNSUPPORTED_ATTACHMENT_PATH";
        throw error;
      }
      if (localPath && !isLocalStorage()) {
        const error = new Error("Fișier local indisponibil în producție.");
        error.code = "UNSUPPORTED_ATTACHMENT_PATH";
        throw error;
      }

      const relativePath = isBlob ? attachment.file_path.slice(5) : attachment.file_path.slice(6);
      const match = /^attachments\/informatii_utile\/([1-9]\d*)\/[^/]+$/.exec(relativePath);
      if (!match || match[1] !== String(id)) {
        const error = new Error(`Calea nu corespunde documentului: ${attachment.id}`);
        error.code = "UNSUPPORTED_ATTACHMENT_PATH";
        throw error;
      }

      const shared = await client.query(
        "SELECT id FROM attachments WHERE file_path = $1 AND id <> $2 LIMIT 1",
        [attachment.file_path, attachment.id],
      );
      if (shared.rows.length) {
        const error = new Error(`Fișier referit de alt atașament: ${attachment.id}`);
        error.code = "SHARED_ATTACHMENT_PATH";
        throw error;
      }

      if (localPath) {
        localFiles.push(attachment.file_path);
        continue;
      }

      // Un Blob se șterge numai prin coada existentă, niciodată direct.
      const queued = await client.query(
        `INSERT INTO blob_cleanup_queue
         (blob_path, source_entity_type, source_entity_id, source_attachment_id, reason)
         VALUES ($1, 'informatii_utile', $2, $3, 'useful_info_deleted')
         ON CONFLICT (blob_path) DO UPDATE
           SET updated_at = blob_cleanup_queue.updated_at
         WHERE blob_cleanup_queue.status IN ('pending', 'error')
         RETURNING id`,
        [relativePath, id, attachment.id],
      );
      if (queued.rowCount !== 1) {
        const error = new Error(`Fișier deja procesat: ${attachment.id}`);
        error.code = "BLOB_QUEUE_CONFLICT";
        throw error;
      }
      queuedFiles++;
    }

    await client.query(
      "DELETE FROM attachments WHERE entity_type = 'informatii_utile' AND entity_id = $1",
      [id],
    );
    await client.query("DELETE FROM informatii_utile WHERE id = $1", [id]);
    await client.query("COMMIT");
    inTransaction = false;
  } catch (error) {
    if (inTransaction && client) {
      await client
        .query("ROLLBACK")
        .catch((rollbackError) =>
          console.error("DELETE USEFUL INFO ROLLBACK ERROR:", rollbackError),
        );
    }
    console.error("DELETE USEFUL INFO ERROR:", error);
    if (
      ["UNSUPPORTED_ATTACHMENT_PATH", "SHARED_ATTACHMENT_PATH", "BLOB_QUEUE_CONFLICT"].includes(
        error.code,
      )
    ) {
      return res.status(409).json({
        message:
          "Ștergerea a fost anulată: un atașament necesită verificare (cale invalidă, partajată sau deja procesată).",
      });
    }
    return res.status(500).json({ message: "Eroare la ștergerea informației utile." });
  } finally {
    if (client) client.release();
  }

  // Eliminarea de pe disc are loc numai după confirmarea ștergerii din baza de date.
  const failedLocalFiles = [];
  for (const filePath of localFiles) {
    try {
      await removeLocalFile(filePath);
    } catch (error) {
      console.error("LOCAL USEFUL INFO CLEANUP ERROR:", filePath, error);
      failedLocalFiles.push(filePath);
    }
  }

  try {
    await createAuditLog({
      userId: req.user.id,
      action: "DELETE",
      entityType: "informatii",
      entityId: deletedInfo.id,
      description: `A șters informația utilă "${deletedInfo.title}"`,
    });
  } catch (auditError) {
    console.error("DELETE USEFUL INFO AUDIT ERROR:", auditError);
  }

  return res.status(200).json({
    message: failedLocalFiles.length
      ? "Informația a fost ștearsă, dar unele fișiere locale necesită curățare manuală."
      : "Informația utilă și atașamentele sale au fost eliminate.",
    informatie: deletedInfo,
    queuedFiles,
    deletedLocalFiles: localFiles.length - failedLocalFiles.length,
    failedLocalFiles: failedLocalFiles.length,
    warning: failedLocalFiles.length > 0,
  });
};

const addUsefulInfoFavorite = async (req, res) => {
  try {
    if (!isValidUsefulInfoId(req.params.id)) {
      return res.status(400).json({ message: "ID-ul informației utile este invalid." });
    }

    const result = await pool.query(
      `

      INSERT INTO useful_info_favorites (user_id, info_id)

      SELECT $1, id FROM informatii_utile WHERE id = $2

      ON CONFLICT (user_id, info_id) DO NOTHING

      RETURNING info_id

    `,

      [req.user.id, req.params.id],
    );

    if (!result.rowCount) {
      const exists = await pool.query(`SELECT 1 FROM informatii_utile WHERE id = $1`, [
        req.params.id,
      ]);

      if (!exists.rowCount)
        return res.status(404).json({ message: "Informația utilă nu a fost găsită." });
    }

    return res.status(200).json({ message: "Adăugat la importante.", is_favorite: true });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(404).json({ message: "Informația utilă sau utilizatorul nu mai există." });
    }

    console.error("ADD USEFUL INFO FAVORITE ERROR:", error);

    return res.status(500).json({ message: "Nu s-a putut salva favoritul." });
  }
};

const removeUsefulInfoFavorite = async (req, res) => {
  try {
    if (!isValidUsefulInfoId(req.params.id)) {
      return res.status(400).json({ message: "ID-ul informației utile este invalid." });
    }

    const exists = await pool.query(`SELECT 1 FROM informatii_utile WHERE id = $1`, [
      req.params.id,
    ]);

    if (!exists.rowCount)
      return res.status(404).json({ message: "Informația utilă nu a fost găsită." });

    await pool.query(`DELETE FROM useful_info_favorites WHERE user_id = $1 AND info_id = $2`, [
      req.user.id,

      req.params.id,
    ]);

    return res.status(200).json({ message: "Eliminat din importante.", is_favorite: false });
  } catch (error) {
    console.error("REMOVE USEFUL INFO FAVORITE ERROR:", error);

    return res.status(500).json({ message: "Nu s-a putut elimina favoritul." });
  }
};

module.exports = {
  getUsefulInfo,

  getUsefulInfoById,

  createUsefulInfo,

  updateUsefulInfo,

  deleteUsefulInfo,

  addUsefulInfoFavorite,

  removeUsefulInfoFavorite,
};
