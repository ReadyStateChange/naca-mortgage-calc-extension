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

    const raw = result.rows[0];
    const normalized = {
      ...raw,
      thirty_year_rate: raw?.thirty_year_rate != null
        ? parseFloat(raw.thirty_year_rate)
        : null,
      twenty_year_rate: raw?.twenty_year_rate != null
        ? parseFloat(raw.twenty_year_rate)
        : null,
      fifteen_year_rate: raw?.fifteen_year_rate != null
        ? parseFloat(raw.fifteen_year_rate)
        : null,
    };

    return new Response(JSON.stringify(normalized), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
