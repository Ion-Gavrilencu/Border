const { Pool } = require("pg");
const dotenv = require("dotenv");
const path = require("path");

// Încarcă variabilele de mediu pentru conexiunea la baza de date.
dotenv.config({
  path: path.join(__dirname, "../.env"),
});

const isProduction = process.env.NODE_ENV === "production";

const requiredVariables = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];

const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  throw new Error(`Lipsesc variabilele PostgreSQL: ${missingVariables.join(", ")}`);
}

// Configurează conexiunile PostgreSQL pentru mediul curent.
const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  ssl: isProduction
    ? {
        rejectUnauthorized: true,
      }
    : false,

  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Înregistrează stabilirea unei conexiuni noi.
pool.on("connect", () => {
  console.log("Conectat la PostgreSQL");
});

// Înregistrează erorile apărute la nivelul pool-ului.
pool.on("error", (error) => {
  console.error("Eroare PostgreSQL:", error.message);
});

module.exports = pool;
