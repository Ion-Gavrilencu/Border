const express = require("express");

const {
  getTelegrame,
  getTelegramById,
  createTelegram,
  updateTelegram,
  deleteTelegram,
} = require("../controllers/telegramController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// USER, EDITOR, ADMIN
router.get(
  "/",
  authenticate,
  getTelegrame
);

// USER, EDITOR, ADMIN
router.get(
  "/:id",
  authenticate,
  getTelegramById
);

// EDITOR, ADMIN
router.post(
  "/",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  createTelegram
);

// EDITOR, ADMIN
router.patch(
  "/:id",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  updateTelegram
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteTelegram
);
module.exports = router;