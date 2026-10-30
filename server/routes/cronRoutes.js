
const express = require("express");
const crypto = require("node:crypto");

const {
  syncBorderNews,
} = require("../services/borderNewsSyncService");

const router = express.Router();

router.get("/sync-border-news", async (req, res) => {
  const secret = process.env.CRON_SECRET;
  const authorization = req.get("authorization") || "";

  if (!secret) {
    return res.status(503).json({
      message: "Sincronizarea nu este configurată.",
    });
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);

  if (
    expected.length !== received.length ||
    !crypto.timingSafeEqual(expected, received)
  ) {
    return res.status(401).json({
      message: "Acces neautorizat.",
    });
  }

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

module.exports = router;
