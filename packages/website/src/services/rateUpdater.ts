import { pool } from "./db";
import { Either } from "effect";
import {
  decodeNacaMortgageRates,
  NacaMortgageRatesEquivalence,
  type NacaMortgageRates,
} from "../schemas/external/rates";

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

function ratesMatch(
  latestDbRates: NacaMortgageRates,
  ratesFromWebsite: NacaMortgageRates
) {
  if (!latestDbRates) return false;
  console.log("Testing if rates have changed");
  return NacaMortgageRatesEquivalence(latestDbRates, ratesFromWebsite);
}

export async function saveRatesIfNeeded(ratesFromWebsite: NacaMortgageRates) {
  const latestResult = await pool.query(
    "SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1"
  );

  const decodedRates = decodeNacaMortgageRates(latestResult.rows[0]);
  if (Either.isLeft(decodedRates)) {
    console.log(decodedRates.left);
    throw new Error("Could not parse rates from DB");
  }
  const parsedRatesFromDb = decodedRates.right;

  if (ratesMatch(parsedRatesFromDb, ratesFromWebsite)) {
    console.log("ℹ️ Rates unchanged, skipping insert");
    return { status: "unchanged" as const };
  }

  if (parsedRatesFromDb.created_at) {
    const lastCreatedAt = parsedRatesFromDb.created_at;
    const now = new Date();

    if (now.getTime() - lastCreatedAt.getTime() < ONE_DAY_IN_MS) {
      console.log(
        "ℹ️ Rates already captured in the last 24 hours, skipping insert"
      );
      return { status: "already_saved" as const, lastCreatedAt };
    }
  }

  const insertResult = await pool.query(
    `INSERT INTO naca_mortgage_rates
      (thirty_year_rate, twenty_year_rate, fifteen_year_rate)
    VALUES ($1, $2, $3)
    RETURNING *`,
    [
      ratesFromWebsite.thirty_year_rate,
      ratesFromWebsite.twenty_year_rate,
      ratesFromWebsite.fifteen_year_rate,
    ]
  );

  const saved = insertResult.rows[0];
  console.log("✅ New rates saved:", saved);
  return { status: "inserted" as const, record: saved };
}
