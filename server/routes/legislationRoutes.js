const express = require("express");

const {
  getLegislation,
  getLegislationById,
  createLegislation,
  updateLegislation,
  deleteLegislation,
} = require("../controllers/legislationController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", authenticate, getLegislation);

router.get("/:id", authenticate, getLegislationById);

router.post(
  "/",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  createLegislation
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  updateLegislation
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteLegislation
);

module.exports = router;