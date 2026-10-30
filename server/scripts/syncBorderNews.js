
require("dotenv").config();

const {
  syncBorderNews,
} = require("../services/borderNewsSyncService");

async function main() {
  try {
    console.log("Pornire sincronizare Poliția de Frontieră...");

    const result = await syncBorderNews();

    console.log("Sincronizare finalizată.");
    console.log(`Articole găsite: ${result.found}`);
    console.log(`Articole importate: ${result.imported}`);
    console.log(`Articole existente: ${result.skipped}`);
  } catch (error) {
    console.error("Eroare sincronizare:", error);
    process.exitCode = 1;
  }
}

main();
