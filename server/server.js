const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

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
const newsRoutes = require("./routes/newsRoutes");
const newsFileRoutes = require("./routes/newsFileRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");
const cronRoutes = require("./routes/cronRoutes");

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Origin înseamnă protocol + domeniu + port, fără cale sau slash final.
const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://ion-gavrilencu.github.io",
  "https://border-4391.vercel.app",
]);

// FRONTEND_URL este opțional, dar, dacă există, trebuie să fie un origin valid.
if (process.env.FRONTEND_URL) {
  try {
    const frontendUrl = new URL(process.env.FRONTEND_URL.trim());
    if (!["http:", "https:"].includes(frontendUrl.protocol)) {
      throw new Error("Protocol invalid");
    }
    allowedOrigins.add(frontendUrl.origin);
  } catch {
    throw new Error("FRONTEND_URL nu este un URL HTTP/HTTPS valid.");
  }
}

const isAllowedOrigin = (origin) => typeof origin === "string" && allowedOrigins.has(origin);

app.disable("x-powered-by");

app.use(
  cors({
    origin(origin, callback) {
      // Cererile fără Origin (de exemplu cron/server-to-server) nu primesc
      // antete CORS. Cererile din browser sunt permise doar din lista definită.
      if (!origin) return callback(null, false);
      return callback(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());

// Protecție CSRF pentru cererile care pot modifica date.
// CORS nu este suficient: un site extern poate încerca să trimită o cerere
// chiar dacă browserul nu îi permite să citească răspunsul.
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  // Cron folosește Bearer CRON_SECRET, nu cookie-ul browserului.
  // Validarea secretului rămâne în cronRoutes.js.
  if (req.path.startsWith("/api/cron/")) return next();

  const origin = req.get("origin");
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({
      message: "Cerere respinsă: origine neautorizată sau absentă.",
    });
  }

  return next();
});

app.get("/", (req, res) => res.json({ message: "API Platforma de Serviciu funcționează!" }));

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    return res.json({
      status: "OK",
      message: "Serverul și baza de date funcționează",
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    console.error("HEALTH ERROR:", error.message);
    return res.status(500).json({
      status: "ERROR",
      message: "Nu s-a putut conecta la baza de date",
    });
  }
});

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
app.use("/api/news-files", newsFileRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/cron", cronRoutes);

// Returnează JSON pentru erori de parsare și încărcări prea mari.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Cererea depășește dimensiunea permisă." });
  }
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "Conținut JSON invalid." });
  }
  console.error("SERVER ERROR:", error);
  return res.status(500).json({ message: "Eroare internă a serverului." });
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => console.log(`Server pornit pe portul ${PORT}`));
}
