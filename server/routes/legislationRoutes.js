
const express = require("express");

const {
  getLegislation,
  getLegislationById,
  createLegislation,
  updateLegislation,
  deleteLegislation,
  addLegislationFavorite,
  removeLegislationFavorite,
} = require("../controllers/legislationController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

// USER, EDITOR, ADMIN — lista actelor normative
router.get("/", authenticate, getLegislation);

// USER, EDITOR, ADMIN — favorite
router.post("/:id/favorite", authenticate, addLegislationFavorite);
router.delete("/:id/favorite", authenticate, removeLegislationFavorite);

// USER, EDITOR, ADMIN — detalii
router.get("/:id", authenticate, getLegislationById);

// EDITOR, ADMIN — creare
router.post(
  "/",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  createLegislation
);

// EDITOR, ADMIN — modificare
router.patch(
  "/:id",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  updateLegislation
);

// ADMIN — ștergere
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteLegislation
);

module.exports = router;
