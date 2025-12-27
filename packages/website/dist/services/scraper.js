import { Either } from "effect";
import { decodeNacaMortgageRates, } from "../schemas/external/rates";
// Regex extracted from the NACA mortgage calculator script
const rateRegex = /function\s+fillRate\s*\(\)\s*\{\s*var\s+thirtyYearRate\s*=\s*"([^"]+)";\s*var\s+twentyYearRate\s*=\s*"([^"]+)";\s*var\s+fifteenYearRate\s*=\s*"([^"]+)";/;
const NACA_CALCULATOR_URL = "https://www.naca.com/mortgage-calculator/";
export async function scrapeNacaRates() {
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
        thirty_year_rate: match[1].replace("%", ""),
        twenty_year_rate: match[2].replace("%", ""),
        fifteen_year_rate: match[3].replace("%", ""),
    };
    const parsedRates = decodeNacaMortgageRates(rates);
    if (Either.isLeft(parsedRates)) {
        console.log(parsedRates.left);
        throw new Error("Could not parse rates from NACA page");
    }
    console.log("✅ Scraped rates:", parsedRates.right);
    return parsedRates.right;
}
