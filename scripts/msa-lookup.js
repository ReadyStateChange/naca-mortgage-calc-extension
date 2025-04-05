#!/usr/bin/env node

const https = require("https");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Configuration - replace with your own API keys
const CONFIG = {
  CENSUS_API_KEY: "a935e97717d6caed3054f50100a5401012eaf80c", // Optional but recommended
  HUD_API_KEY:
    "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI2IiwianRpIjoiNzE0NWY4ZDk2YmY4ZjcwNDFhODEzYjE2NzkwNTg1MmY4ZDQwOWVlZjJlN2ZiMjVmMDk5ZGYzNTRhZTk5NDZkZTRmOGFkNDY3NzUzY2NlZDAiLCJpYXQiOjE3NDMzODMzNTYuNzgwODQsIm5iZiI6MTc0MzM4MzM1Ni43ODA4NDMsImV4cCI6MjA1ODkxNjE1Ni43NzY5NjgsInN1YiI6Ijk0MTAwIiwic2NvcGVzIjpbXX0.Xta4WVbaJEuPwTRZX7iIbGyKn-nQ0_TNUqBp8qyoyu9S5LcGFgjUdIUZKi7-UmkA-2LU5OuYN0dxtfExnzH5OA", // Required for HUD API
  YEAR: 2024, // Analysis year
};

/**
 * Main function - processes an address and returns income information
 * @param {string} address - The full address to analyze
 */
async function getAddressIncomeInfo(address) {
  try {
    // Step 1: Geocode the address to get its census tract
    const geocodeResult = await geocodeAddress(address);
    if (!geocodeResult.matched) {
      console.error("Error: Address could not be geocoded.");
      return null;
    }

    // Step 2: Extract FIPS codes and tract info
    const { state, county, tract } = extractLocationData(geocodeResult);
    console.log(
      `Address is in census tract: ${tract} (State: ${state}, County: ${county})`
    );

    // Step 3: Get income data from PostgreSQL database
    const incomeData = await getIncomeData(state, county, tract);

    // Step 4: Format and return results
    const result = {
      address: geocodeResult.matchedAddress || address,
      state,
      county,
      tract,
      msaMedianFamilyIncome: incomeData.msaMedianFamilyIncome,
      tractMedianFamilyIncome: incomeData.tractMedianFamilyIncome,
      tractPercentOfMsa: incomeData.tractPercentOfMsa,
      year: CONFIG.YEAR,
    };

    return result;
  } catch (error) {
    console.error("Error analyzing address:", error.message);
    return null;
  }
}

/**
 * Geocode an address using Census Geocoding API
 * @param {string} address - The address to geocode
 * @returns {object} - Geocoding result with location data
 */
function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    // Format address for URL
    const encodedAddress = encodeURIComponent(address);

    // Build Census Geocoder API URL
    const apiUrl = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodedAddress}&benchmark=2020&vintage=2020&format=json`;

    // Make the request to Census API
    https
      .get(apiUrl, (response) => {
        let data = "";

        response.on("data", (chunk) => {
          data += chunk;
        });

        response.on("end", () => {
          try {
            const result = JSON.parse(data);

            // Check if we got a match
            if (
              result.result &&
              result.result.addressMatches &&
              result.result.addressMatches.length > 0
            ) {
              const match = result.result.addressMatches[0];
              resolve({
                matched: true,
                matchedAddress: match.matchedAddress,
                coordinates: match.coordinates,
                geographies: match.geographies,
              });
            } else {
              resolve({ matched: false });
            }
          } catch (error) {
            reject(
              new Error(`Failed to parse geocoding response: ${error.message}`)
            );
          }
        });
      })
      .on("error", (error) => {
        reject(new Error(`Geocoding request failed: ${error.message}`));
      });
  });
}

/**
 * Extract relevant location data from geocoding result
 * @param {object} geocodeResult - Result from geocodeAddress function
 * @returns {object} - Extracted location data
 */
function extractLocationData(geocodeResult) {
  const censusBlocks = geocodeResult.geographies["Census Blocks"][0];
  const censusTract = geocodeResult.geographies["Census Tracts"][0];

  return {
    state: censusTract.STATE,
    county: censusTract.COUNTY,
    tract: censusTract.TRACT,
    block: censusBlocks.BLOCK,
    geoid: censusTract.GEOID, // Census tract identifier (includes state, county, and tract)
  };
}

/**
 * Get income data from PostgreSQL database
 * @param {string} stateCode - State FIPS code
 * @param {string} countyCode - County FIPS code
 * @param {string} tractCode - Census tract code
 * @returns {object} - Income data
 */
function getIncomeData(stateCode, countyCode, tractCode) {
  return new Promise(async (resolve, reject) => {
    const pool = new Pool({
      user: process.env.PGUSER || "your_username",
      host: process.env.PGHOST || "localhost",
      database: "naca_extension",
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT || 5432,
    });

    try {
      const query = `
        SELECT
          msa_median_income as "msaMedianFamilyIncome",
          estimated_tract_median_income as "tractMedianFamilyIncome",
          tract_median_income_percentage as "tractPercentOfMsa"
        FROM ffeic_msa_tract_income_2024
        WHERE
          state_code = $1
          AND county_code = $2
          AND tract_code = $3
      `;

      const result = await pool.query(query, [
        stateCode,
        countyCode,
        tractCode,
      ]);

      if (result.rows.length > 0) {
        resolve(result.rows[0]);
      } else {
        reject(new Error("No income data found for the specified location"));
      }
    } catch (error) {
      reject(new Error(`Database query failed: ${error.message}`));
    } finally {
      await pool.end();
    }
  });
}

/**
 * Format and print the results
 * @param {object} result - Income analysis result
 */
function printResults(result) {
  if (!result) {
    console.error("No results to display");
    return;
  }

  console.log("\n=== ADDRESS INCOME ANALYSIS ===");
  console.log(`Address: ${result.address}`);
  console.log(
    `Location: Census Tract ${result.tract}, County: ${result.county}, State: ${result.state}`
  );
  console.log(
    `\nMSA Median Family Income (${
      result.year
    }): $${result.msaMedianFamilyIncome.toLocaleString()}`
  );
  console.log(
    `Tract Median Family Income: $${result.tractMedianFamilyIncome.toLocaleString()}`
  );
  console.log(`Tract Income as % of MSA Income: ${result.tractPercentOfMsa}%`);

  // Add income classification comparison if desired
  if (result.tractPercentOfMsa < 50) {
    console.log("Classification: Low Income (< 50%)");
  } else if (result.tractPercentOfMsa < 80) {
    console.log("Classification: Moderate Income (50-80%)");
  } else if (result.tractPercentOfMsa < 120) {
    console.log("Classification: Middle Income (80-120%)");
  } else {
    console.log("Classification: Upper Income (> 120%)");
  }
}

// Run the CLI application
if (require.main === module) {
  // Get the address from command line arguments
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Please provide an address as a command line argument");
    console.log('Usage: node index.js "123 Main St, Anytown, CA 12345"');
    process.exit(1);
  }

  const address = args.join(" ");

  // Run the analysis
  getAddressIncomeInfo(address)
    .then((result) => {
      if (result) {
        printResults(result);
      } else {
        console.error("Failed to analyze the address");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("Error:", error.message);
      process.exit(1);
    });
} else {
  // Export for use as a module
  module.exports = {
    getAddressIncomeInfo,
  };
}
