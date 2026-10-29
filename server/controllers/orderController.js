
const pool = require("../config/database");
const { createAuditLog } = require("./auditController");
const { notifyUsers } = require("../services/notificationService");

// VALIDARE ID ORDIN
const isValidOrderId = (id) => /^[1-9]\d*$/.test(String(id || ""));

// LISTA ORDINELOR
const getOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        o.id,
        o.title,
        o.number,
        o.order_date,
        o.content,
        o.created_by,
        o.created_at,
        o.updated_at,
        u.username AS created_by_username,
        u.full_name AS created_by_name,

        EXISTS (
          SELECT 1
          FROM order_favorites f
          WHERE f.order_id = o.id
            AND f.user_id = $1
        ) AS is_favorite,

        COALESCE(ac.attachments_count, 0)::integer
          AS attachments_count

      FROM ordine o

      LEFT JOIN users u
        ON o.created_by = u.id

      LEFT JOIN (
        SELECT
          entity_id,
          COUNT(*) AS attachments_count
        FROM attachments
        WHERE entity_type = 'ordine'
        GROUP BY entity_id
      ) ac ON ac.entity_id = o.id

      ORDER BY
        o.order_date DESC NULLS LAST,
        o.id DESC
      `,
      [req.user.id]
    );

    return res.status(200).json({
      ordine: result.rows,
    });
  } catch (error) {
    console.error("GET ORDINE ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea ordinelor.",
    });
  }
};

// DETALII ORDIN
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidOrderId(id)) {
      return res.status(400).json({
        message: "ID-ul ordinului este invalid.",
      });
    }

    const result = await pool.query(
      `
      SELECT
        o.id,
        o.title,
        o.number,
        o.order_date,
        o.content,
        o.created_by,
        o.created_at,
        o.updated_at,
        u.username AS created_by_username,
        u.full_name AS created_by_name,

        EXISTS (
          SELECT 1
          FROM order_favorites f
          WHERE f.order_id = o.id
            AND f.user_id = $2
        ) AS is_favorite,

        (
          SELECT COUNT(*)::integer
          FROM attachments a
          WHERE a.entity_type = 'ordine'
            AND a.entity_id = o.id
        ) AS attachments_count

      FROM ordine o

      LEFT JOIN users u
        ON o.created_by = u.id

      WHERE o.id = $1
      `,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Ordinul nu a fost găsit.",
      });
    }

    return res.status(200).json({
      order: result.rows[0],
    });
  } catch (error) {
    console.error("GET ORDER BY ID ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea ordinului.",
    });
  }
};

// ADAUGĂ ORDIN
const createOrder = async (req, res) => {
  try {
    const { title, number, orderDate, content } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Denumirea ordinului este obligatorie.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO ordine (
        title,
        number,
        order_date,
        content,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        title,
        number,
        order_date,
        content,
        created_by,
        created_at,
        updated_at
      `,
      [
        title.trim(),
        typeof number === "string" ? number.trim() || null : null,
        orderDate || null,
        typeof content === "string" ? content : "",
        req.user.id,
      ]
    );

    const order = result.rows[0];

    await createAuditLog({
      userId: req.user.id,
      action: "CREATE",
      entityType: "ordin",
      entityId: order.id,
      description: `A creat ordinul "${order.title}"`,
    });

    // NOTIFICARE AUTOMATĂ PENTRU ORDIN NOU
    try {
      const orderNumber = order.number
        ? ` nr. ${order.number}`
        : "";

      await notifyUsers({
        actorId: req.user.id,
        title: "Ordin nou",
        message: `A fost adăugat ordinul${orderNumber} „${order.title}”.`,
        type: "ordin",
        link: `/ordine/${order.id}`,
      });
    } catch (notificationError) {
      // Ordinul rămâne salvat chiar dacă notificarea eșuează.
      console.error(
        "CREATE ORDER NOTIFICATION ERROR:",
        notificationError
      );
    }

    return res.status(201).json({
      message: "Ordinul a fost adăugat.",
      order,
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    return res.status(500).json({
      message: "Eroare la adăugarea ordinului.",
    });
  }
};

// MODIFICĂ ORDIN
const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, number, orderDate, content } = req.body || {};

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Denumirea ordinului este obligatorie.",
      });
    }

    const result = await pool.query(
      `
      UPDATE ordine
      SET
        title = $1,
        number = $2,
        order_date = $3,
        content = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING
        id,
        title,
        number,
        order_date,
        content,
        created_by,
        created_at,
        updated_at
      `,
      [
        title.trim(),
        typeof number === "string" ? number.trim() || null : null,
        orderDate || null,
        typeof content === "string" ? content : "",
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Ordinul nu a fost găsit.",
      });
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

    return res.status(500).json({
      message: "Eroare la actualizarea ordinului.",
    });
  }
};

// ȘTERGE ORDIN
const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM ordine
      WHERE id = $1
      RETURNING id, title
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Ordinul nu a fost găsit.",
      });
    }

    await createAuditLog({
      userId: req.user.id,
      action: "DELETE",
      entityType: "ordin",
      entityId: Number(id),
      description: `A șters ordinul cu ID ${id}`,
    });

    return res.status(200).json({
      message: "Ordinul a fost șters.",
      order: result.rows[0],
    });
  } catch (error) {
    console.error("DELETE ORDER ERROR:", error);

    return res.status(500).json({
      message: "Eroare la ștergerea ordinului.",
    });
  }
};

// ADAUGĂ ORDIN LA FAVORITE
const addOrderFavorite = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidOrderId(id)) {
      return res.status(400).json({
        message: "ID-ul ordinului este invalid.",
      });
    }

    const orderResult = await pool.query(
      "SELECT id FROM ordine WHERE id = $1",
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        message: "Ordinul nu a fost găsit.",
      });
    }

    await pool.query(
      `
      INSERT INTO order_favorites (user_id, order_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id, order_id)
      DO NOTHING
      `,
      [req.user.id, id]
    );

    return res.status(200).json({
      message: "Ordinul a fost adăugat la favorite.",
      order_id: Number(id),
      is_favorite: true,
    });
  } catch (error) {
    // Ordinul poate fi șters între verificare și inserare.
    if (error.code === "23503") {
      return res.status(404).json({
        message: "Ordinul sau utilizatorul nu mai există.",
      });
    }

    console.error("ADD ORDER FAVORITE ERROR:", error);

    return res.status(500).json({
      message: "Ordinul nu a putut fi adăugat la favorite.",
    });
  }
};

// ELIMINĂ ORDIN DIN FAVORITE
const removeOrderFavorite = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidOrderId(id)) {
      return res.status(400).json({
        message: "ID-ul ordinului este invalid.",
      });
    }

    await pool.query(
      `
      DELETE FROM order_favorites
      WHERE user_id = $1
        AND order_id = $2
      `,
      [req.user.id, id]
    );

    return res.status(200).json({
      message: "Ordinul a fost eliminat din favorite.",
      order_id: Number(id),
      is_favorite: false,
    });
  } catch (error) {
    console.error("REMOVE ORDER FAVORITE ERROR:", error);

    return res.status(500).json({
      message: "Ordinul nu a putut fi eliminat din favorite.",
    });
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
