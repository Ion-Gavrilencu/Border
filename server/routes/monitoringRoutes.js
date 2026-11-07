const express = require("express");
const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  heartbeat,
  getOverview,
  getActivities,
  recordPageView,
  getRetentionSettings,
  updateRetentionSettings,
} = require("../controllers/monitoringController");
const router = express.Router();
router.use(authenticate);
router.post("/heartbeat", heartbeat);
router.post("/page-view", recordPageView);
router.use(authorizeRoles("ADMIN"));
router.get("/overview", getOverview);
router.get("/activities", getActivities);
router.get("/retention", getRetentionSettings);
router.put("/retention", express.json(), updateRetentionSettings);
module.exports = router;
