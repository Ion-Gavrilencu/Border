const pool = require("../config/database");
const { createAuditLog } = require("./auditController");
const getOrders = async (req, res) => {
  try {
    const result = await pool.query(`
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
        u.full_name AS created_by_name
      FROM ordine o
      LEFT JOIN users u
        ON o.created_by = u.id
      ORDER BY o.order_date DESC NULLS LAST, o.id DESC
    `);

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

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

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
        u.full_name AS created_by_name
      FROM ordine o
      LEFT JOIN users u
        ON o.created_by = u.id
      WHERE o.id = $1
      `,
      [id],
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

const createOrder = async (req, res) => {
  try {
    const { title, number, orderDate, content } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        message: "Titlul și conținutul sunt obligatorii.",
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
      [title, number || null, orderDate || null, content, req.user.id],
    );

    await createAuditLog({
      userId: req.user.id,
      action: "CREATE",
      entityType: "ordin",
      entityId: result.rows[0].id,
      description: `A creat ordinul "${result.rows[0].title}"`,
    });

    return res.status(201).json({
      message: "Ordinul a fost adăugat.",
      order: result.rows[0],
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);

    return res.status(500).json({
      message: "Eroare la adăugarea ordinului.",
    });
  }
};

const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const { title, number, orderDate, content } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({
        message: "Titlul și conținutul sunt obligatorii.",
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
      [title, number || null, orderDate || null, content, id],
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

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM ordine
      WHERE id = $1
      RETURNING id, title
      `,
      [id],
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

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
};
