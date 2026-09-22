const express = require("express");

const {
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
} = require("../controllers/userController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  getUsers
);

router.patch(
  "/:id/role",
  authenticate,
  authorizeRoles("ADMIN"),
  updateUserRole
);

router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("ADMIN"),
  updateUserStatus
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteUser
);

module.exports = router;