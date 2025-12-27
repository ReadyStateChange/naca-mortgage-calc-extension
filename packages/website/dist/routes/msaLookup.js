import { pool } from "../services/db";
import { corsHeaders } from "../utils/cors";
import { decodeCensusGeocodeResponse } from "../schemas/external/census";
import { Either } from "effect";
async function geocodeAddress(address) {
    const encodedAddress = encodeURIComponent(address);
    const apiUrl = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodedAddress}&benchmark=4&vintage=4&format=json`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    const result = decodeCensusGeocodeResponse(data);
    if (Either.isLeft(result)) {
        return { matched: false, error: result.left };
    }
    const censusGeocodeResponse = result.right;
    const censusTract = censusGeocodeResponse.result.addressMatches[0].geographies["Census Tracts"][0];
    const matchedAddress = censusGeocodeResponse.result.addressMatches[0].matchedAddress;
    return {
        matched: true,
        state: censusTract.STATE,
        county: censusTract.COUNTY,
        tract: censusTract.TRACT,
        matchedAddress,
    };
}
export async function msaLookup(req) {
    try {
        const body = (await req.json());
        const { address } = body;
        if (!address) {
            return new Response(JSON.stringify({ error: "Address is required" }), {
                status: 400,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        // Geocode address
        const geocodeResult = await geocodeAddress(address);
        if (!geocodeResult.matched) {
            return new Response(JSON.stringify({ error: "Address could not be geocoded" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        const result = await pool.query(`SELECT
        msa_median_income,
        estimated_tract_median_income,
        tract_median_income_percentage
      FROM ffeic_msa_tract_income_2024
      WHERE state_code = $1 AND county_code = $2 AND tract_code = $3`, [geocodeResult.state, geocodeResult.county, geocodeResult.tract]);
        // Query income data from Neon
        // Convert string codes to integers to match database schema
        if (result.rows.length === 0) {
            return new Response(JSON.stringify({ error: "No income data found for this location" }), {
                status: 404,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }
        const incomeData = result.rows[0];
        const response = {
            address: geocodeResult.matchedAddress || address,
            state: geocodeResult.state,
            county: geocodeResult.county,
            tract: geocodeResult.tract,
            msaMedianFamilyIncome: incomeData.msa_median_income,
            tractMedianFamilyIncome: incomeData.estimated_tract_median_income,
            tractPercentOfMsa: incomeData.tract_median_income_percentage,
            year: 2024,
        };
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
    catch (error) {
        console.error("Error in MSA lookup:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
}
