const pool = require("../config/database");
const {
  isLocalStorage,
  resolveLocalPath,
  removeLocalFile,
} = require("../services/attachmentStorage");

const { createAuditLog } = require("./auditController");

const { notifyUsers } = require("../services/notificationService");

// VALIDARE ID ORDIN

const isValidOrderId = (id) => /^[1-9]\d*$/.test(String(id ?? ""));

// LISTA ORDINELOR

const getOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `

      SELECT

        o.id, o.title, o.number, o.order_date, o.content,

        o.created_by, o.created_at, o.updated_at,

        u.username AS created_by_username,

        u.full_name AS created_by_name,

        EXISTS (

          SELECT 1 FROM order_favorites f

          WHERE f.order_id = o.id AND f.user_id = $1

        ) AS is_favorite,

        COALESCE(ac.attachments_count, 0)::integer AS attachments_count

      FROM ordine o

      LEFT JOIN users u ON o.created_by = u.id

      LEFT JOIN (

        SELECT entity_id, COUNT(*) AS attachments_count

        FROM attachments

        WHERE entity_type = 'ordine'

        GROUP BY entity_id

      ) ac ON ac.entity_id = o.id

      ORDER BY o.order_date DESC NULLS LAST, o.id DESC

      `,

      [req.user.id],
    );

    return res.status(200).json({ ordine: result.rows });
  } catch (error) {
    console.error("GET ORDINE ERROR:", error);

    return res.status(500).json({ message: "Eroare la încărcarea ordinelor." });
  }
};

// DETALII ORDIN

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidOrderId(id)) {
      return res.status(400).json({ message: "ID-ul ordinului este invalid." });
    }

    const result = await pool.query(
      `

      SELECT

        o.id, o.title, o.number, o.order_date, o.content,

        o.created_by, o.created_at, o.updated_at,

        u.username AS created_by_username,

        u.full_name AS created_by_name,

        EXISTS (

          SELECT 1 FROM order_favorites f

          WHERE f.order_id = o.id AND f.user_id = $2

        ) AS is_favorite,

        (

          SELECT COUNT(*)::integer FROM attachments a

          WHERE a.entity_type = 'ordine' AND a.entity_id = o.id

        ) AS attachments_count

      FROM ordine o

      LEFT JOIN users u ON o.created_by = u.id

      WHERE o.id = $1

      `,

      [id, req.user.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Ordinul nu a fost găsit." });
    }

    return res.status(200).json({ order: result.rows[0] });
  } catch (error) {
    console.error("GET ORDER BY ID ERROR:", error);

    return res.status(500).json({ message: "Eroare la încărcarea ordinului." });
  }
};

// ADAUGĂ ORDIN

const createOrder = async (req, res) => {
  try {
    const { title, number, orderDate, content } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Denumirea ordinului este obligatorie." });
    }

    const result = await pool.query(
      `

      INSERT INTO ordine (title, number, order_date, content, created_by)

      VALUES ($1, $2, $3, $4, $5)

      RETURNING id, title, number, order_date, content,

                created_by, created_at, updated_at

      `,

      [
        title.trim(),

        typeof number === "string" ? number.trim() || null : null,

        orderDate || null,

        typeof content === "string" ? content : "",

        req.user.id,
      ],
    );

    const order = result.rows[0];

    await createAuditLog({
      userId: req.user.id,

      action: "CREATE",

      entityType: "ordin",

      entityId: order.id,

      description: `A creat ordinul "${order.title}"`,
    });

    try {
      const orderNumber = order.number ? ` nr. ${order.number}` : "";

      await notifyUsers({
        actorId: req.user.id,

        title: "Ordin nou",

        message: `A fost adăugat ordinul${orderNumber} „${order.title}”.`,

        type: "ordin",

        link: `/ordine?open=${order.id}`,
      });
    } catch (notificationError) {
      console.error("CREATE ORDER NOTIFICATION ERROR:", notificationError);
    }

    return res.status(201).json({ message: "Ordinul a fost adăugat.", order });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    return res.status(500).json({ message: "Eroare la adăugarea ordinului." });
  }
};

// MODIFICĂ ORDIN

const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidOrderId(id)) {
      return res.status(400).json({ message: "ID-ul ordinului este invalid." });
    }

    const { title, number, orderDate, content } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ message: "Denumirea ordinului este obligatorie." });
    }

    const result = await pool.query(
      `

      UPDATE ordine SET title = $1, number = $2, order_date = $3,

        content = $4, updated_at = CURRENT_TIMESTAMP

      WHERE id = $5

      RETURNING id, title, number, order_date, content,

                created_by, created_at, updated_at

      `,

      [
        title.trim(),

        typeof number === "string" ? number.trim() || null : null,

        orderDate || null,

        typeof content === "string" ? content : "",

        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Ordinul nu a fost găsit." });
    }

    await createAuditLog({
      userId: req.user.id,

      action: "UPDATE",

      entityType: "ordin",

      entityId: result.rows[0].id,

      description: `A modificat ordinul "${result.rows[0].title}"`,
    });

    return res.status(200).json({
      message: "Ordinul a fost actualizat.",

      order: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE ORDER ERROR:", error);

    return res.status(500).json({ message: "Eroare la actualizarea ordinului." });
  }
};

// Ștergere tranzacțională cu suport pentru stocare locală și Vercel Blob.
const deleteOrder = async (req, res) => {
  const { id } = req.params;
  if (!isValidOrderId(id))
    return res.status(400).json({ message: "ID-ul ordinului este invalid." });

  let client;
  let transactionStarted = false;
  let deletedOrder;
  let queuedFiles = 0;
  const localFiles = [];

  try {
    client = await pool.connect();
    await client.query("BEGIN");
    transactionStarted = true;

    const found = await client.query("SELECT id, title FROM ordine WHERE id = $1 FOR UPDATE", [id]);
    if (!found.rows.length) {
      await client.query("ROLLBACK");
      transactionStarted = false;
      return res.status(404).json({ message: "Ordinul nu a fost găsit." });
    }
    deletedOrder = found.rows[0];

    const attachments = await client.query(
      `SELECT id, attachment_type, file_path FROM attachments
       WHERE entity_type = 'ordine' AND entity_id = $1 FOR UPDATE`,
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
      const match = /^attachments\/ordine\/([1-9]\d*)\/([^/]+)$/.exec(relativePath);
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
           VALUES ($1, 'ordine', $2, $3, 'order_deleted')
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

    await client.query("DELETE FROM attachments WHERE entity_type = 'ordine' AND entity_id = $1", [
      id,
    ]);
    await client.query("DELETE FROM ordine WHERE id = $1", [id]);
    await client.query("COMMIT");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted && client) {
      await client
        .query("ROLLBACK")
        .catch((rollbackError) => console.error("DELETE ORDER ROLLBACK ERROR:", rollbackError));
    }
    console.error("DELETE ORDER ERROR:", error);
    const conflict = ["INVALID_ATTACHMENT", "SHARED_ATTACHMENT", "BLOB_QUEUE_CONFLICT"].includes(
      error.code,
    );
    return res.status(conflict ? 409 : 500).json({
      message: conflict
        ? "Ștergerea a fost anulată: un atașament necesită verificare."
        : "Ordinul nu a putut fi ștearsă.",
    });
  } finally {
    if (client) client.release();
  }

  const failedLocalFiles = [];
  for (const storedPath of localFiles) {
    try {
      await removeLocalFile(storedPath);
    } catch (error) {
      console.error("DELETE ORDER LOCAL CLEANUP ERROR:", error);
      failedLocalFiles.push(storedPath);
    }
  }

  try {
    await createAuditLog({
      userId: req.user.id,
      action: "DELETE",
      entityType: "ordin",
      entityId: Number(id),
      description: `A șters ordinul "${deletedOrder.title}" (ID ${id}); ${queuedFiles} fișiere Blob în coadă; ${localFiles.length - failedLocalFiles.length} fișiere locale șterse`,
    });
  } catch (error) {
    console.error("DELETE ORDER AUDIT ERROR:", error);
  }

  return res.status(200).json({
    message: failedLocalFiles.length
      ? "Ordinul a fost ștearsă, dar unele fișiere locale necesită curățare manuală."
      : "Ordinul și atașamentele au fost eliminate. Curățarea Blob, dacă există, a fost programată.",
    order: deletedOrder,
    queuedFiles,
    deletedLocalFiles: localFiles.length - failedLocalFiles.length,
    failedLocalFiles: failedLocalFiles.length,
    warning: failedLocalFiles.length > 0,
  });
};

// ADAUGĂ ORDIN LA FAVORITE

const addOrderFavorite = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidOrderId(id)) {
      return res.status(400).json({ message: "ID-ul ordinului este invalid." });
    }

    const orderResult = await pool.query("SELECT id FROM ordine WHERE id = $1", [id]);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: "Ordinul nu a fost găsit." });
    }

    await pool.query(
      `INSERT INTO order_favorites (user_id, order_id)

       VALUES ($1, $2)

       ON CONFLICT (user_id, order_id) DO NOTHING`,

      [req.user.id, id],
    );

    return res.status(200).json({
      message: "Ordinul a fost adăugat la favorite.",

      order_id: Number(id),

      is_favorite: true,
    });
  } catch (error) {
    if (error.code === "23503") {
      return res.status(404).json({ message: "Ordinul sau utilizatorul nu mai există." });
    }

    console.error("ADD ORDER FAVORITE ERROR:", error);

    return res.status(500).json({ message: "Ordinul nu a putut fi adăugat la favorite." });
  }
};

// ELIMINĂ ORDIN DIN FAVORITE

const removeOrderFavorite = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidOrderId(id)) {
      return res.status(400).json({ message: "ID-ul ordinului este invalid." });
    }

    await pool.query(
      `DELETE FROM order_favorites

       WHERE user_id = $1 AND order_id = $2`,

      [req.user.id, id],
    );

    return res.status(200).json({
      message: "Ordinul a fost eliminat din favorite.",

      order_id: Number(id),

      is_favorite: false,
    });
  } catch (error) {
    console.error("REMOVE ORDER FAVORITE ERROR:", error);

    return res.status(500).json({ message: "Ordinul nu a putut fi eliminat din favorite." });
  }
};

module.exports = {
  getOrders,

  getOrderById,

  createOrder,

  updateOrder,

  deleteOrder,

  addOrderFavorite,

  removeOrderFavorite,
};
