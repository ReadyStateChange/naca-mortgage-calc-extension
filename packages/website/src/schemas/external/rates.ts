import { Schema } from "effect";

export const NacaMortgageRatesSchema = Schema.Struct({
  thirty_year_rate: Schema.Union(Schema.NumberFromString, Schema.Number),
  twenty_year_rate: Schema.Union(Schema.NumberFromString, Schema.Number),
  fifteen_year_rate: Schema.Union(Schema.NumberFromString, Schema.Number),
  created_at: Schema.optionalWith(
    Schema.Union(Schema.instanceOf(Date), Schema.DateFromString),
    { exact: true }
  ),
}).annotations({
  equivalence: () => (rate1, rate2) => {
    return (
      rate1.thirty_year_rate === rate2.thirty_year_rate &&
      rate1.twenty_year_rate === rate2.twenty_year_rate &&
      rate1.fifteen_year_rate === rate2.fifteen_year_rate
    );
  },
});

export const NacaMortgageRatesEquivalence = Schema.equivalence(
  NacaMortgageRatesSchema
);

export type NacaMortgageRates = Schema.Schema.Type<
  typeof NacaMortgageRatesSchema
>;

export const decodeNacaMortgageRates = Schema.decodeUnknownEither(
  NacaMortgageRatesSchema
);
