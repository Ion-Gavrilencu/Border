// Atașați acest router în routerul cron existent, deja montat la /api/cron.
// Endpoint: GET /api/cron/cleanup-monitoring
const express = require("express");
const crypto = require("node:crypto");
const { cleanupMonitoringEvents } = require("../services/monitoringRetentionService");
const router = express.Router();
router.get("/cleanup-monitoring", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const supplied = req.get("authorization") || "";
  const expected = secret ? `Bearer ${secret}` : "";
  if (
    !secret ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  ) {
    return res.status(401).json({ message: "Neautorizat." });
  }
  try {
    return res.json(await cleanupMonitoringEvents());
  } catch (error) {
    console.error("MONITORING CLEANUP ERROR:", error);
    return res.status(500).json({ message: "Curățarea istoricului a eșuat." });
  }
});
module.exports = router;
