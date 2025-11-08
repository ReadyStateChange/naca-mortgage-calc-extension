import { pool } from "../services/db";
import { corsHeaders } from "../utils/cors";

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

export async function msaLookup(req: Request): Promise<Response> {
  try {
    const body = await req.json() as AddressRequest;
    const { address } = body;

    if (!address) {
      return new Response(
        JSON.stringify({ error: "Address is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Geocode address
    const geocodeResult = await geocodeAddress(address);
    if (!geocodeResult.matched) {
      return new Response(
        JSON.stringify({ error: "Address could not be geocoded" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Extract location data
    const locationData = extractLocationData(geocodeResult);

    // Query income data from Neon
    // Convert string codes to integers to match database schema
    const result = await pool.query(
      `SELECT
        msa_median_income,
        estimated_tract_median_income,
        tract_median_income_percentage
      FROM ffeic_msa_tract_income_2024
      WHERE state_code = $1 AND county_code = $2 AND tract_code = $3`,
      [
        parseInt(locationData.state, 10),
        parseInt(locationData.county, 10),
        parseInt(locationData.tract, 10),
      ],
    );

    if (result.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No income data found for this location" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const incomeData = result.rows[0];

    const response = {
      address: geocodeResult.matchedAddress || address,
      state: locationData.state,
      county: locationData.county,
      tract: locationData.tract,
      msaMedianFamilyIncome: incomeData.msa_median_income,
      tractMedianFamilyIncome: incomeData.estimated_tract_median_income,
      tractPercentOfMsa: incomeData.tract_median_income_percentage,
      year: 2024,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in MSA lookup:", error);
    const errorMessage = error instanceof Error
      ? error.message
      : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
}
