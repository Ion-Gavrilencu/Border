const { Pool } = require("pg");
const dotenv = require("dotenv");
const path = require("path");

// Asigurăm încărcarea configurației și în alte puncte de intrare
dotenv.config({
  path: path.join(__dirname, "../.env"),
});

const isProduction = process.env.NODE_ENV === "production";

const requiredVariables = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];

const missingVariables = requiredVariables.filter((name) => !process.env[name]);

if (missingVariables.length > 0) {
  throw new Error(
    `Lipsesc variabilele PostgreSQL: ${missingVariables.join(", ")}`,
  );
}

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

pool.on("connect", () => {
  console.log("Conectat la PostgreSQL");
});

pool.on("error", (error) => {
  console.error("Eroare PostgreSQL:", error.message);
});

module.exports = pool;
