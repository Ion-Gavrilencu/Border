const express = require("express");
const { getDashboardStats, getDashboardRecent } = require("../controllers/dashboardController");
const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/stats", authenticate, getDashboardStats);
router.get("/recent", authenticate, getDashboardRecent);

module.exports = router;
