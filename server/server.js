const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const path = require("path");

// Încărcăm .env înaintea conexiunii DB și a rutelor
dotenv.config({
  path: path.join(__dirname, ".env"),
});

// Conexiunea PostgreSQL
const pool = require("./config/database");

// Rutele aplicației
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
const newsRoutes = require("./routes/newsRoutes");
const newsFileRoutes = require("./routes/newsFileRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

const PORT = Number(process.env.PORT) || 5000;

// Domenii autorizate
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
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
  }),
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Necesar pentru citirea cookie-urilor de autentificare
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
    console.error("HEALTH ERROR:", error.message);

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
app.use("/api/news", newsRoutes);
app.use("/api/notifications", notificationRoutes);

// Nou: upload și acces securizat la fișierele știrilor
app.use("/api/news-files", newsFileRoutes);

// Export pentru Vercel
module.exports = app;

// Pornire doar în mediul local
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server pornit pe portul ${PORT}`);
  });
}
