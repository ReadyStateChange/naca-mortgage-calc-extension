#!/usr/bin/env node

const fs = require("node:fs");
const { parse } = require("csv-parse");
const { Pool } = require("pg"); // Use Pool for managing connections

// --- Configuration ---
const CSV_FILE_PATH = "CensusFlatFile2024.csv"; // Replace with your CSV file path
const TABLE_NAME = "ffeic_msa_tract_income_2024";

// PostgreSQL Connection Details (replace with your actual configuration)
const PG_CONFIG = {
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: parseInt(process.env.PG_PORT, 10),
};

// Define the columns you want to extract from CSV (0-based index)
// CSV Columns: 2, 3, 4, 5, 13, 14 -> Indices: 1, 2, 3, 4, 12, 13
const COLUMN_INDICES = [1, 2, 3, 4, 12, 13];
// Map indices to their conceptual meaning for easier access later
const DATA_MAP = {
  msa_code_idx: 1,
  state_code_idx: 2,
  county_code_idx: 3,
  tract_code_idx: 4,
  tract_percentage_idx: 12, // Float
  msa_income_idx: 13, // Integer
};

// Define the database column names, including the new calculated one
const DB_COLUMN_NAMES = [
  "msa_code", // INTEGER (from index 1)
  "state_code", // INTEGER (from index 2)
  "county_code", // INTEGER (from index 3)
  "tract_code", // INTEGER (from index 4)
  "tract_median_income_percentage", // DOUBLE PRECISION (from index 12)
  "msa_median_income", // INTEGER (from index 13) - Renamed for clarity
  "estimated_tract_median_income", // INTEGER (Calculated)
];

const BATCH_SIZE = 1000; // How many rows to insert in a single transaction batch
// --- End Configuration ---

// --- Database Setup Function ---
async function setupDatabase(pool, tableName, dbColumns) {
  let client = null; // Use a single client for setup
  try {
    client = await pool.connect();
    console.log(`Connected to PostgreSQL database: ${PG_CONFIG.database}`);

    // Define column types based on requirements
    const columnsWithTypes = [
      `${dbColumns[0]} INTEGER`,
      `${dbColumns[1]} INTEGER`,
      `${dbColumns[2]} INTEGER`,
      `${dbColumns[3]} INTEGER`,
      `${dbColumns[4]} DOUBLE PRECISION`, // For tract percentage (float)
      `${dbColumns[5]} INTEGER`, // For MSA income (integer)
      `${dbColumns[6]} INTEGER`, // For the calculated estimate (integer)
    ];
    const createTableSql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnsWithTypes.join(
      ", "
    )})`;

    console.log(`Executing: ${createTableSql}`);
    await client.query(createTableSql);
    console.log(`Table '${tableName}' ensured to exist.`);
  } catch (err) {
    console.error(`Error setting up database table ${tableName}:`, err);
    throw err; // Re-throw error to be caught by the caller
  } finally {
    if (client) {
      client.release(); // Release client back to the pool
      console.log("Setup client released back to pool.");
    }
  }
}

// --- CSV Processing and DB Insertion Function ---
async function importCsvToDb() {
  const pool = new Pool(PG_CONFIG);
  let processedRows = 0;
  let rowCount = 0; // To track original row number for logs
  let batch = []; // Array to hold rows for batch insertion

  pool.on("error", (err, client) => {
    console.error("Unexpected error on idle client in pool", err);
  });

  try {
    await setupDatabase(pool, TABLE_NAME, DB_COLUMN_NAMES);

    const insertSqlBase = `INSERT INTO ${TABLE_NAME} (${DB_COLUMN_NAMES.join(
      ", "
    )}) VALUES `;

    const parser = parse({
      delimiter: ",",
      columns: false,
      skip_empty_lines: true,
      trim: true,
      cast: (value, context) => {
        // Only cast columns we are actually using
        if (!COLUMN_INDICES.includes(context.index)) {
          return undefined; // Skip casting for columns we don't care about
        }

        // Handle potential empty strings before parsing
        if (value === "") return null;

        try {
          if (context.index === DATA_MAP.tract_percentage_idx) {
            // Tract Percentage (Float)
            const num = parseFloat(value);
            return isNaN(num) ? null : num;
          } else {
            // All other desired columns are Integers
            const num = parseInt(value, 10);
            return isNaN(num) ? null : num;
          }
        } catch (parseError) {
          console.warn(
            `Warning: Could not parse value "${value}" at row ${context.lines}, column index ${context.index}. Inserting NULL.`
          );
          return null;
        }
      },
    });

    const inputStream = fs.createReadStream(CSV_FILE_PATH);

    const insertBatch = async (currentBatch) => {
      // (No changes needed in insertBatch itself, as it dynamically creates placeholders)
      // ... identical to previous version ...
      if (currentBatch.length === 0) return;
      let client = null;
      try {
        client = await pool.connect();
        const valuesPlaceholders = [];
        const queryParams = [];
        let paramIndex = 1;
        for (const rowData of currentBatch) {
          // Now expects 7 values per rowData
          const placeholders = rowData.map(() => `$${paramIndex++}`);
          valuesPlaceholders.push(`(${placeholders.join(", ")})`);
          queryParams.push(...rowData);
        }
        const batchInsertSql = insertSqlBase + valuesPlaceholders.join(", ");
        await client.query("BEGIN");
        await client.query(batchInsertSql, queryParams);
        await client.query("COMMIT");
        processedRows += currentBatch.length;
        console.log(
          `Committed batch of ${currentBatch.length} rows. Total processed: ${processedRows}`
        );
      } catch (err) {
        console.error("Error during batch insert:", err);
        if (client) {
          try {
            await client.query("ROLLBACK");
            console.log("Batch rolled back.");
          } catch (rbErr) {
            console.error("Rollback failed:", rbErr);
          }
        }
      } finally {
        if (client) {
          client.release();
        }
      }
    };

    parser.on("readable", async () => {
      let record;
      while ((record = parser.read()) !== null) {
        rowCount++;
        try {
          // Extract the base data using the indices
          const msaCode = record[DATA_MAP.msa_code_idx];
          const stateCode = record[DATA_MAP.state_code_idx];
          const countyCode = record[DATA_MAP.county_code_idx];
          const tractCode = record[DATA_MAP.tract_code_idx];
          const tractPercentage = record[DATA_MAP.tract_percentage_idx]; // float or null
          const msaIncome = record[DATA_MAP.msa_income_idx]; // integer or null

          // Ensure we have the necessary values for calculation
          let estimatedIncome = null; // Default to null
          if (msaIncome !== null && tractPercentage !== null) {
            // Calculate: round(msa_income * (tract_percentage / 100.0))
            // Ensure tractPercentage is treated as percentage (divide by 100)
            estimatedIncome = Math.round(msaIncome * (tractPercentage / 100.0));
            // Check if calculation resulted in a valid number
            if (isNaN(estimatedIncome)) {
              console.warn(
                `Warning: Calculation resulted in NaN for row ${rowCount}. Setting estimated income to NULL. Inputs: MSA Income=${msaIncome}, Tract Percentage=${tractPercentage}`
              );
              estimatedIncome = null;
            }
          } else {
            // Log if calculation couldn't be performed due to missing data
            // console.log(`Info: Skipping estimation for row ${rowCount} due to NULL input(s).`);
          }

          // Construct the full data row for the database, including the calculated value
          const dbRow = [
            msaCode,
            stateCode,
            countyCode,
            tractCode,
            tractPercentage,
            msaIncome,
            estimatedIncome, // Add the calculated value
          ];

          // Add the complete row to the batch
          batch.push(dbRow);

          if (batch.length >= BATCH_SIZE) {
            parser.pause();
            const currentBatch = [...batch];
            batch = [];
            await insertBatch(currentBatch);
            parser.resume();
          }
        } catch (e) {
          console.error(
            `Error processing data logic for row ${rowCount}: ${e.message}`,
            record
          );
          parser.pause();
          console.error("Pausing stream due to row processing error.");
        }
      }
    });

    parser.on("error", (err) => {
      console.error("CSV Parser Error:", err.message);
      cleanupAndEndPool(pool, batch, "Parser error occurred.");
    });

    parser.on("end", async () => {
      console.log(`\nFinished reading CSV file.`);
      if (batch.length > 0) {
        console.log(`Inserting final batch of ${batch.length} rows...`);
        await insertBatch(batch);
      }
      cleanupAndEndPool(
        pool,
        [],
        `Import process finished. Final processed count (approx): ${processedRows}`
      );
    });

    inputStream.on("error", (err) => {
      console.error(`Error reading file ${CSV_FILE_PATH}:`, err.message);
      cleanupAndEndPool(pool, batch, "File stream error occurred.");
    });

    console.log(`Starting processing of ${CSV_FILE_PATH}...`);
    inputStream.pipe(parser);
  } catch (error) {
    console.error("Fatal error during setup:", error.message);
    await cleanupAndEndPool(pool, batch, "Import failed due to setup error.");
    process.exit(1);
  }
}

// --- Helper to Finalize Statement and Close DB ---
// (No changes needed in cleanup function itself)
async function cleanupAndEndPool(pool, remainingBatch, message) {
  // ... identical to previous version ...
  try {
    if (remainingBatch && remainingBatch.length > 0) {
      console.warn(
        `Attempting to insert ${remainingBatch.length} rows from incomplete batch before closing...`
      );
      console.warn(
        "Skipping final batch insertion during cleanup to ensure pool closure."
      );
    }
  } catch (finalInsertErr) {
    console.error(
      "Error inserting final batch during cleanup:",
      finalInsertErr
    );
  } finally {
    if (pool) {
      console.log("Closing PostgreSQL connection pool...");
      await pool.end();
      console.log("Connection pool closed.");
    }
    console.log(message);
  }
}

// --- Run the import process ---
if (require.main === module) {
  console.log("Starting CSV to PostgreSQL import process (Node.js)...");
  importCsvToDb();
  console.log(
    "Import process initiated (asynchronous). Check logs for progress and completion."
  );
}
