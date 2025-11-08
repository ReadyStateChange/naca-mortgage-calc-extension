// Regex extracted from the NACA mortgage calculator script
const rateRegex =
  /function\s+fillRate\s*\(\)\s*\{\s*var\s+thirtyYearRate\s*=\s*"([^"]+)";\s*var\s+twentyYearRate\s*=\s*"([^"]+)";\s*var\s+fifteenYearRate\s*=\s*"([^"]+)";/;

const NACA_CALCULATOR_URL = "https://www.naca.com/mortgage-calculator/";

export interface RateData {
  thirty_year_rate: number;
  twenty_year_rate: number;
  fifteen_year_rate: number;
}

export async function scrapeNacaRates(): Promise<RateData> {
  console.log("🔍 Fetching rates from NACA website...");

  const response = await fetch(NACA_CALCULATOR_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch NACA page: ${response.statusText}`);
  }

  const html = await response.text();
  const match = html.match(rateRegex);

  if (!match || match.length < 4) {
    throw new Error("Could not parse rates from NACA page");
  }

  const rates = {
    thirty_year_rate: parseFloat(match[1].replace("%", "")),
    twenty_year_rate: parseFloat(match[2].replace("%", "")),
    fifteen_year_rate: parseFloat(match[3].replace("%", "")),
  };

  console.log("✅ Scraped rates:", rates);
  return rates;
}
