
const express = require("express");

const {
  createUser,
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
  resendActivation,
} = require("../controllers/userController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Toate rutele de utilizatori sunt accesibile doar ADMIN.
router.use(authenticate);
router.use(authorizeRoles("ADMIN"));

// Crearea utilizatorilor
router.post("/", createUser);

// Lista utilizatorilor
router.get("/", getUsers);

// Retrimiterea linkului de activare
router.post("/:id/resend-activation", resendActivation);

// Modificarea rolului
router.patch("/:id/role", updateUserRole);

// Activarea / dezactivarea contului
router.patch("/:id/status", updateUserStatus);

// Ștergerea utilizatorului
router.delete("/:id", deleteUser);

module.exports = router;
