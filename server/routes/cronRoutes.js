const express = require("express");
const crypto = require("node:crypto");

const { syncBorderNews } = require("../services/borderNewsSyncService");
const { processBlobCleanupQueue } = require("../services/blobCleanupService");
const { cleanupMonitoringEvents } = require("../services/monitoringRetentionService");

const router = express.Router();

// Autorizează toate sarcinile cron prin același secret.
const authorizeCron = (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  const authorization = req.get("authorization") || "";

  if (!secret) {
    return res.status(503).json({
      message: "Serviciul Cron nu este configurat.",
    });
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return res.status(401).json({
      message: "Acces neautorizat.",
    });
  }

  next();
};

// Sincronizarea știrilor existente.
router.get("/sync-border-news", authorizeCron, async (req, res) => {
  try {
    const result = await syncBorderNews();

    console.log("BORDER NEWS SYNC:", result);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("BORDER NEWS CRON ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Sincronizarea știrilor a eșuat.",
    });
  }
});

// Curățarea fișierelor Vercel Blob.
router.get("/cleanup-blobs", authorizeCron, async (req, res) => {
  try {
    const result = await processBlobCleanupQueue({ limit: 10 });

    console.log("BORDER BLOB CLEANUP:", {
      processed: result.processed,
      deleted: result.deleted,
      failed: result.failed,
    });

    return res.status(200).json({
      success: result.failed === 0,
      message:
        result.failed === 0
          ? "Procesarea cozii de curățare s-a încheiat."
          : "Procesarea s-a încheiat cu unele erori.",
      ...result,
    });
  } catch (error) {
    console.error("BORDER BLOB CLEANUP ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Curățarea fișierelor a eșuat.",
    });
  }
});

// Curățarea periodică a evenimentelor de monitorizare.
router.get("/cleanup-monitoring", authorizeCron, async (req, res) => {
  try {
    const result = await cleanupMonitoringEvents();
    console.log("BORDER MONITORING CLEANUP:", result);
    return res.json(result);
  } catch (error) {
    console.error("MONITORING CLEANUP ERROR:", error);
    return res.status(500).json({
      message: "Curățarea istoricului a eșuat.",
    });
  }
});

module.exports = router;
