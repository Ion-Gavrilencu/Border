
const express = require("express");

const authenticate = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const {
  heartbeat,
  getOverview,
  getActivities,
  recordPageView,
} = require("../controllers/monitoringController");

const router = express.Router();

router.use(authenticate);

// Toți utilizatorii autentificați
router.post("/heartbeat", heartbeat);
router.post("/page-view", recordPageView);

// Doar administratorul poate consulta monitorizarea
router.use(authorizeRoles("ADMIN"));

router.get("/overview", getOverview);
router.get("/activities", getActivities);

module.exports = router;
