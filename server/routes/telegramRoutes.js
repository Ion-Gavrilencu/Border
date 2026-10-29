
const express = require("express");

const {
  getTelegrame,
  getTelegramById,
  createTelegram,
  updateTelegram,
  deleteTelegram,
  addTelegramFavorite,
  removeTelegramFavorite,
} = require("../controllers/telegramController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// USER, EDITOR, ADMIN — lista telegramelor
router.get("/", authenticate, getTelegrame);

// USER, EDITOR, ADMIN — adăugare la favorite
router.post(
  "/:id/favorite",
  authenticate,
  addTelegramFavorite
);

// USER, EDITOR, ADMIN — eliminare din favorite
router.delete(
  "/:id/favorite",
  authenticate,
  removeTelegramFavorite
);

// USER, EDITOR, ADMIN — detaliile unei telegrame
router.get("/:id", authenticate, getTelegramById);

// EDITOR, ADMIN — creare telegramă
router.post(
  "/",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  createTelegram
);

// EDITOR, ADMIN — modificare telegramă
router.patch(
  "/:id",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  updateTelegram
);

// ADMIN — ștergere telegramă
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteTelegram
);

module.exports = router;
