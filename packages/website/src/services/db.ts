import { Pool } from "pg";
import { Context, Data } from "effect";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}
export class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}

export class DbConnectionPool extends Context.Tag("DbConnectionPoool")<
  DbConnectionPool,
  InstanceType<typeof Pool>
>() {}

export type DbConnectionPoolType = Context.Tag.Service<DbConnectionPool>;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon requires SSL
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.on("error", (err) => {
  console.error("Unexpected database error", err);
  process.exit(-1);
});

export async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    console.log("✅ Database connected successfully:", result.rows[0]);
    client.release();
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    throw error;
  }
}
