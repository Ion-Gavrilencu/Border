const express = require("express");

const {
  getUsefulInfo,
  getUsefulInfoById,
  createUsefulInfo,
  updateUsefulInfo,
  deleteUsefulInfo,
} = require("../controllers/usefulInfoController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get("/", authenticate, getUsefulInfo);
router.get("/:id", authenticate, getUsefulInfoById);

router.post(
  "/",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  createUsefulInfo
);

router.patch(
  "/:id",
  authenticate,
  authorizeRoles("EDITOR", "ADMIN"),
  updateUsefulInfo
);

router.delete(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN"),
  deleteUsefulInfo
);

module.exports = router;