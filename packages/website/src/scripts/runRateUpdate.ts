import { pool } from "../services/db";
import { scrapeNacaRates } from "../services/scraper";
import { saveRatesIfNeeded } from "../services/rateUpdater";

async function run() {
  console.log("⏰ Cron run started");

  try {
    const rates = await scrapeNacaRates();
    const result = await saveRatesIfNeeded(rates);
    console.log("ℹ️ Cron result:", result);
  } catch (error) {
    console.error("❌ Rate cron failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end(); // Required so the process exits cleanly on Railway Cron
    console.log("👋 Cron run finished");
  }
}

run();
