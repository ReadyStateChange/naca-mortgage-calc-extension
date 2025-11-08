import { pool } from "../services/db";
import { corsHeaders } from "../utils/cors";

export async function getRates(): Promise<Response> {
  try {
    const result = await pool.query(
      "SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1",
    );

    if (result.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No rates available" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify(result.rows[0]),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error fetching rates:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
