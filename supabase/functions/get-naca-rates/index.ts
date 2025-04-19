import { serve } from "std/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const NACA_CALCULATOR_URL = "https://www.naca.com/mortgage-calculator/";

// Regular expression to find the fillRate function and extract the rates
const rateRegex =
  /function\s+fillRate\s*\(\)\s*\{\s*var\s+thirtyYearRate\s*=\s*"([^"]+)";\s*var\s+twentyYearRate\s*=\s*"([^"]+)";\s*var\s+fifteenYearRate\s*=\s*"([^"]+)";/;

serve(async (_req) => {
  try {
    // Initialize Supabase client early for cache check
    const supabaseUrl = Deno.env.get("NACA_APP_SUPABASE_URL");
    const supabaseRoleKey = Deno.env.get("NACA_APP_SUPABASE_ROLE_KEY");
    if (!supabaseUrl) {
      throw new Error("Missing environment variable: NACA_APP_SUPABASE_URL");
    }
    if (!supabaseRoleKey) {
      throw new Error(
        "Missing environment variable: NACA_APP_SUPABASE_ROLE_KEY",
      );
    }
    const supabase = createClient(supabaseUrl, supabaseRoleKey);

    // Check the most recent rate entry
    const { data: latestRate, error: latestError } = await supabase
      .from("naca_mortgage_rates")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (latestError) {
      console.error("Error fetching latest rate:", latestError);
    } else if (latestRate) {
      const lastDate = new Date(latestRate.created_at);
      // If last fetch was under 24 hours ago, return cached entry
      if (Date.now() - lastDate.getTime() < 24 * 60 * 60 * 1000) {
        console.log("Returning cached rates:", latestRate);
        return new Response(JSON.stringify(latestRate), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Fetch the HTML content from the NACA website
    const response = await fetch(NACA_CALCULATOR_URL);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${NACA_CALCULATOR_URL}: ${response.statusText}`,
      );
    }
    const html = await response.text();

    // Execute the regex to find the rates
    const match = html.match(rateRegex);

    if (!match || match.length < 4) {
      throw new Error("Could not find or parse rates from the NACA page.");
    }

    // Extract and clean the rates (remove '%')
    const rateStrings = {
      thirtyYearRate: match[1].replace("%", ""),
      twentyYearRate: match[2].replace("%", ""),
      fifteenYearRate: match[3].replace("%", ""),
    };

    // Convert rates to numbers for database insertion
    // Ensure your table columns match these names (e.g., thirty_year_rate)
    const ratesNumeric = {
      thirty_year_rate: parseFloat(rateStrings.thirtyYearRate),
      twenty_year_rate: parseFloat(rateStrings.twentyYearRate),
      fifteen_year_rate: parseFloat(rateStrings.fifteenYearRate),
    };

    // Insert data into the database
    const { data, error: dbError } = await supabase
      .from("naca_mortgage_rates") // Your table name
      .insert([ratesNumeric]) // Insert the numeric rates
      .select() // Optionally return the inserted data
      .single(); // Assuming you want the single inserted row

    if (dbError) {
      console.error("Database Error:", dbError);
      // Add specific check for RLS violation if possible, though error message might vary
      if (dbError.message.includes("permission denied")) {
        console.warn(
          "Potential RLS issue: Check RLS policy on 'naca_mortgage_rates' allows INSERT for 'anon' role.",
        );
      }
      throw new Error(`Database error: ${dbError.message}`);
    }

    console.log("Rates saved successfully:", data);

    // Return the saved rates (or a success message)
    return new Response(
      JSON.stringify(data ?? { message: "Rates saved successfully" }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in function:", error); // Log the specific error
    const errorMessage = error instanceof Error
      ? error.message
      : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});

// To run this locally using the Supabase CLI:
// 1. Ensure NACA_APP_SUPABASE_URL and NACA_APP_SUPABASE_ROLE_KEY are in supabase/.env
//    NACA_APP_SUPABASE_URL="your-project-url"
//    NACA_APP_SUPABASE_ROLE_KEY="your-role-key"
// 2. supabase functions serve get-naca-rates --env-file ./supabase/.env --no-verify-jwt
//
// To deploy:
// 1. Set secrets using the SAME names:
//    supabase secrets set NACA_APP_SUPABASE_URL=your-project-url
//    supabase secrets set NACA_APP_SUPABASE_ROLE_KEY=your-role-key
// 2. supabase functions deploy get-naca-rates --no-verify-jwt
