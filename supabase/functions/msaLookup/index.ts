// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

console.log("Hello from Functions!");

interface AddressRequest {
  address: string;
}

interface LocationData {
  state: string;
  county: string;
  tract: string;
  block: string;
  geoid: string;
}

interface IncomeData {
  msaMedianFamilyIncome: number;
  tractMedianFamilyIncome: number;
  tractPercentOfMsa: number;
}

async function geocodeAddress(address: string) {
  const encodedAddress = encodeURIComponent(address);
  const apiUrl =
    `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodedAddress}&benchmark=4&vintage=4&format=json`;
  const response = await fetch(apiUrl);
  const data = await response.json();

  if (data.result?.addressMatches?.length > 0) {
    const match = data.result.addressMatches[0];
    return {
      matched: true,
      matchedAddress: match.matchedAddress,
      coordinates: match.coordinates,
      geographies: match.geographies,
    };
  }

  return { matched: false };
}

function extractLocationData(geocodeResult: any): LocationData {
  const censusBlocks = geocodeResult.geographies["2020 Census Blocks"][0];
  const censusTract = geocodeResult.geographies["Census Tracts"][0];

  return {
    state: censusTract.STATE,
    county: censusTract.COUNTY,
    tract: censusTract.TRACT,
    block: censusBlocks.BLOCK,
    geoid: censusTract.GEOID,
  };
}

async function getIncomeData(
  stateCode: string,
  countyCode: string,
  tractCode: string,
): Promise<IncomeData> {
  // Create Supabase client using ANON key
  const supabaseClient = createClient(
    Deno.env.get("URL") ?? "",
    // Use the ANON key for potentially public/read-only data access
    Deno.env.get("ANON_KEY") ?? "",
  );

  const { data, error } = await supabaseClient
    .from("ffeic_msa_tract_income_2024")
    .select(
      "msa_median_income, estimated_tract_median_income, tract_median_income_percentage",
    )
    .eq("state_code", stateCode)
    .eq("county_code", countyCode)
    .eq("tract_code", tractCode)
    .single();

  if (error) throw new Error(`Database query failed: ${error.message}`);
  if (!data) throw new Error("No income data found for the specified location");

  return {
    msaMedianFamilyIncome: data.msa_median_income,
    tractMedianFamilyIncome: data.estimated_tract_median_income,
    tractPercentOfMsa: data.tract_median_income_percentage,
  };
}

// Helper function for CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Allow all origins (adjust for production)
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type", // Allow necessary headers
  "Access-Control-Allow-Methods": "POST, OPTIONS", // Allow POST and OPTIONS methods
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify request method (should be POST now, OPTIONS handled above)
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }, // Include CORS headers
      });
    }

    // Parse request body
    const { address } = await req.json() as AddressRequest;

    if (!address) {
      return new Response(JSON.stringify({ error: "Address is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }, // Include CORS headers
      });
    }

    // Geocode the address
    const geocodeResult = await geocodeAddress(address);
    if (!geocodeResult.matched) {
      return new Response(
        JSON.stringify({ error: "Address could not be geocoded" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" }, // Include CORS headers
        },
      );
    }

    // Extract location data
    const locationData = extractLocationData(geocodeResult);

    // Get income data
    const incomeData = await getIncomeData(
      locationData.state,
      locationData.county,
      locationData.tract,
      // Removed req parameter as we are using anon key
    );

    // Prepare response
    const result = {
      address: geocodeResult.matchedAddress || address,
      state: locationData.state,
      county: locationData.county,
      tract: locationData.tract,
      msaMedianFamilyIncome: incomeData.msaMedianFamilyIncome,
      tractMedianFamilyIncome: incomeData.tractMedianFamilyIncome,
      tractPercentOfMsa: incomeData.tractPercentOfMsa,
      year: 2024,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, // Include CORS headers
    });
  } catch (error) {
    const errorMessage = error instanceof Error
      ? error.message
      : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }, // Include CORS headers
    });
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/msaLookup' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
