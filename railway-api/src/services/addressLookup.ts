import { Effect, Data, Either } from "effect";
import { DbConnectionPool, pool, DbError } from "./db";
import {
  decodeCensusGeocodeResponse,
  type CensusGeocodeResponse,
} from "../schemas/external/census";
import { Pool } from "pg";

export class GetGeocodingError extends Data.TaggedError("GetGeocodingError")<{
  cause: unknown;
}> {}

const fetchGeocode = (address: string) =>
  Effect.tryPromise({
    try: async () => {
      const encodedAddress = encodeURIComponent(address);
      const apiUrl = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodedAddress}&benchmark=4&vintage=4&format=json`;

      const response = await fetch(apiUrl);
      const data = await response.json();
      return data;
    },
    catch(error) {
      return new GetGeocodingError({ cause: error });
    },
  });

const lookupIncomeData = (
  geocodeData: CensusGeocodeResponse,
  dbConnection: Pool
) =>
  Effect.tryPromise({
    try: async () => {
      const censusTract =
        geocodeData.result.addressMatches[0].geographies["Census Tracts"][0];
      const result = await dbConnection.query(
        `SELECT
        msa_median_income,
        estimated_tract_median_income,
        tract_median_income_percentage
      FROM ffeic_msa_tract_income_2024
      WHERE state_code = $1 AND county_code = $2 AND tract_code = $3`,
        [censusTract.STATE, censusTract.COUNTY, censusTract.COUNTY]
      );
      return {
        address: geocodeData.result.addressMatches[0].matchedAddress,
        state: censusTract.STATE,
        county: censusTract.COUNTY,
        tract: censusTract.TRACT,
        msaMedianFamilyIncome: result.rows[0].msa_median_income,
        tractMedianFamilyIncome: result.rows[0].estimated_tract_median_income,
        tractPercentOfMsa: result.rows[0].tract_median_income_percentage,
        year: 2024,
      };
    },
    catch(error) {
      return new DbError({ cause: error });
    },
  });

export const addressLookup = (address: string) =>
  Effect.gen(function* () {
    const dbConnnnection = yield* DbConnectionPool;
    const geocodeData = yield* Effect.either(fetchGeocode(address));
    if (Either.isLeft(geocodeData)) {
      return yield* Effect.fail(geocodeData.left);
    }

    const parsedGeocodeData = decodeCensusGeocodeResponse(geocodeData);
    if (Either.isLeft(parsedGeocodeData)) {
      return yield* Effect.fail(parsedGeocodeData.left);
    }
    const incomeData = yield* Effect.either(
      lookupIncomeData(parsedGeocodeData.right, dbConnnnection)
    );
    if (Either.isLeft(incomeData)) {
      return yield* Effect.fail(incomeData.left);
    }
    return incomeData.right;
  });
