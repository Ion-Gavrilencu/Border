
const express = require("express");

const {
  getUsefulInfo,
  getUsefulInfoById,
  createUsefulInfo,
  updateUsefulInfo,
  deleteUsefulInfo,
  addUsefulInfoFavorite,
  removeUsefulInfoFavorite,
} = require("../controllers/usefulInfoController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// USER, EDITOR, ADMIN — lista informațiilor utile
router.get("/", authenticate, getUsefulInfo);

// USER, EDITOR, ADMIN — adăugare la favorite
router.post(
  "/:id/favorite",
  authenticate,
  addUsefulInfoFavorite
);

// USER, EDITOR, ADMIN — eliminare din favorite
router.delete(
  "/:id/favorite",
  authenticate,
  removeUsefulInfoFavorite
);

// USER, EDITOR, ADMIN — detaliile unei informații
router.get("/:id", authenticate, getUsefulInfoById);

// EDITOR, ADMIN — creare informație
router.post(
  "/",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  createUsefulInfo
);

// EDITOR, ADMIN — modificare informație
router.patch(
  "/:id",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  updateUsefulInfo
);

// ADMIN — ștergere informație
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteUsefulInfo
);

module.exports = router;
