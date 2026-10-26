
const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,

  // Neon necesită conexiune SSL
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
  console.error("Eroare PostgreSQL:", error);
});

module.exports = pool;
