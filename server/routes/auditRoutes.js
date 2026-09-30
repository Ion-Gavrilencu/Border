const express = require("express");

const {
  getAuditLogs,
} = require("../controllers/auditController");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN"),
  getAuditLogs
);

module.exports = router;