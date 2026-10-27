
const express = require("express");

const authenticate = require("../middleware/authMiddleware");

const router = express.Router();

// Toate rutele din acest fișier necesită autentificare.
router.use(authenticate);

// Verificare temporară
router.get("/status", (req, res) => {
  res.json({
    status: "OK",
    message: "Modulul pentru fișiere private este activ.",
  });
});

module.exports = router;
