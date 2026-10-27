
const express = require("express");

const {
  getNews,
  getNewsById,
  createNews,
  updateNews,
  deleteNews,
} = require("../controllers/newsController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// Vizualizare: toți utilizatorii autentificați
router.get("/", authenticate, getNews);
router.get("/:id", authenticate, getNewsById);

// Adăugare: EDITOR și ADMIN
router.post(
  "/",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  createNews
);

// Modificare: EDITOR și ADMIN
router.patch(
  "/:id",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  updateNews
);

// Ștergere: doar ADMIN
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteNews
);

module.exports = router;
