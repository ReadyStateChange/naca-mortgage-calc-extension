import { Schema } from "effect";

// We only validate the path to Census Tracts
export const CensusGeocodeResponseSchema = Schema.Struct({
  result: Schema.Struct({
    addressMatches: Schema.Array(
      Schema.Struct({
        geographies: Schema.Struct({
          "Census Tracts": Schema.Array(
            Schema.Struct({
              STATE: Schema.NumberFromString,
              COUNTY: Schema.NumberFromString,
              TRACT: Schema.NumberFromString,
            })
          ),
        }),
        matchedAddress: Schema.optional(Schema.String),
      })
    ),
  }),
});

export type CensusGeocodeResponse = Schema.Schema.Type<
  typeof CensusGeocodeResponseSchema
>;

export const decodeCensusGeocodeResponse = Schema.decodeUnknownEither(
  CensusGeocodeResponseSchema
);
