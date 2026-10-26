
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");

dotenv.config();

const pool = require("./config/database");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const telegramRoutes = require("./routes/telegramRoutes");
const orderRoutes = require("./routes/orderRoutes");
const legislationRoutes = require("./routes/legislationRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const usefulInfoRoutes = require("./routes/usefulInfoRoutes");
const searchRoutes = require("./routes/searchRoutes");
const auditRoutes = require("./routes/auditRoutes");
const attachmentRoutes = require("./routes/attachmentRoutes");

const app = express();

const PORT = process.env.PORT || 5000;

// Domenii autorizate
const allowedOrigins = [
  "http://localhost:5173",
  "https://ion-gavrilencu.github.io",
  "https://border-4391.vercel.app",
];

// Configurare CORS
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origine neautorizată"));
    },
    credentials: true,
  })
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Verificare API
app.get("/", (req, res) => {
  res.json({
    message: "API Platforma de Serviciu funcționează!",
  });
});

// Verificare bază de date
app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      status: "OK",
      message: "Serverul și baza de date funcționează",
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error("HEALTH ERROR:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Nu s-a putut conecta la baza de date",
    });
  }
});

// Rute API
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/telegrame", telegramRoutes);
app.use("/api/ordine", orderRoutes);
app.use("/api/legislatie", legislationRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/informatii-utile", usefulInfoRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/attachments", attachmentRoutes);

// Export pentru Vercel
module.exports = app;

// Pornire doar în mediul local
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server pornit pe portul ${PORT}`);
  });
}
