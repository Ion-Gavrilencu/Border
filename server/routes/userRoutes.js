
const express = require("express");

const {
  createUser,
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
} = require("../controllers/userController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Crearea utilizatorilor - doar ADMIN
router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  createUser
);

// Lista utilizatorilor - doar ADMIN
router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  getUsers
);

// Modificarea rolului
router.patch(
  "/:id/role",
  authenticate,
  authorizeRoles("ADMIN"),
  updateUserRole
);

// Activarea / dezactivarea contului
router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updateUserStatus
);

// Ștergerea utilizatorului
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteUser
);

module.exports = router;
