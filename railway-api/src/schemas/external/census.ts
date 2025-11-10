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
        // Using catchAll to allow other properties without typing them
      }).pipe(
        Schema.extend(
          Schema.Record({ key: Schema.String, value: Schema.Unknown })
        )
      )
    ),
  }),
});

export type CensusGeocodeResponse = Schema.Schema.Type<
  typeof CensusGeocodeResponseSchema
>;

export const decodeCensusGeocodeResponse = Schema.decodeUnknownEither(
  CensusGeocodeResponseSchema
);
