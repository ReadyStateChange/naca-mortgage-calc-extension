import { Schema } from "effect";

export const NacaMortgageRatesSchema = Schema.Struct({
  thirtyYearRate: Schema.NumberFromString,
  twentyYearRate: Schema.NumberFromString,
  fifteenYearRate: Schema.NumberFromString,
});

export type NacaMortgageRates = Schema.Schema.Type<
  typeof NacaMortgageRatesSchema
>;

export const decodeNacaMortgageRates = Schema.decodeUnknownEither(
  NacaMortgageRatesSchema
);
