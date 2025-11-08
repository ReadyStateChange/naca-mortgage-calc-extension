import { pool } from "./db";

type RateSnapshot = {
  thirty_year_rate: number;
  twenty_year_rate: number;
  fifteen_year_rate: number;
};

const ONE_DAY_IN_MS = 24 * 60 * 60 * 1000;

function ratesMatch(
  latest: RateSnapshot | undefined,
  incoming: RateSnapshot,
) {
  if (!latest) return false;
  return (
    latest.thirty_year_rate === incoming.thirty_year_rate &&
    latest.twenty_year_rate === incoming.twenty_year_rate &&
    latest.fifteen_year_rate === incoming.fifteen_year_rate
  );
}

export async function saveRatesIfNeeded(rates: RateSnapshot) {
  const latestResult = await pool.query(
    "SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1",
  );

  const latest = latestResult.rows[0] as
    | (RateSnapshot & { created_at: string })
    | undefined;

  if (ratesMatch(latest, rates)) {
    console.log("ℹ️ Rates unchanged, skipping insert");
    return { status: "unchanged" as const };
  }

  if (latest) {
    const lastCreatedAt = new Date(latest.created_at);
    const now = new Date();

    if (now.getTime() - lastCreatedAt.getTime() < ONE_DAY_IN_MS) {
      console.log(
        "ℹ️ Rates already captured in the last 24 hours, skipping insert",
      );
      return { status: "already_saved" as const, lastCreatedAt };
    }
  }

  const insertResult = await pool.query(
    `INSERT INTO naca_mortgage_rates
      (thirty_year_rate, twenty_year_rate, fifteen_year_rate)
    VALUES ($1, $2, $3)
    RETURNING *`,
    [rates.thirty_year_rate, rates.twenty_year_rate, rates.fifteen_year_rate],
  );

  const saved = insertResult.rows[0];
  console.log("✅ New rates saved:", saved);
  return { status: "inserted" as const, record: saved };
}
