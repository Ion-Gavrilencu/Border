const pool = require("../config/database");

const getUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
      FROM users
      ORDER BY id ASC
    `);

    return res.status(200).json({
      users: result.rows,
    });
  } catch (error) {
    console.error("GET USERS ERROR:", error);

    return res.status(500).json({
      message: "Eroare la încărcarea utilizatorilor.",
    });
  }
};


const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
const { role } = req.body || {};

    const allowedRoles = ["USER", "EDITOR", "ADMIN"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Rol invalid.",
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET role = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
      `,
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Utilizatorul nu a fost găsit.",
      });
    }

    return res.status(200).json({
      message: "Rolul utilizatorului a fost actualizat.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE ROLE ERROR:", error);

    return res.status(500).json({
      message: "Eroare la modificarea rolului.",
    });
  }
};


const updateUserStatus = async (req, res) => {
  try {
    
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        message: "Valoarea statusului este invalidă.",
      });
    }

    const result = await pool.query(
      `
      UPDATE users
      SET is_active = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING
        id,
        username,
        email,
        full_name,
        role,
        is_active,
        created_at,
        updated_at
      `,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Utilizatorul nu a fost găsit.",
      });
    }

    return res.status(200).json({
      message: "Statusul utilizatorului a fost actualizat.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("UPDATE STATUS ERROR:", error);

    return res.status(500).json({
      message: "Eroare la modificarea statusului.",
    });
  }
};


const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (Number(id) === req.user.id) {
      return res.status(400).json({
        message: "Nu îți poți șterge propriul cont.",
      });
    }

    const result = await pool.query(
      `
      DELETE FROM users
      WHERE id = $1
      RETURNING id, username
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Utilizatorul nu a fost găsit.",
      });
    }

    return res.status(200).json({
      message: "Utilizatorul a fost șters.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);

    return res.status(500).json({
      message: "Eroare la ștergerea utilizatorului.",
    });
  }
};


module.exports = {
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
};