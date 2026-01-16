import { Schema } from "effect";
import { NacaMortgageRatesSchema } from "../external/rates";

export const msaLookupSchema = Schema.extend(
  NacaMortgageRatesSchema,
  Schema.Struct({
    address: Schema.String,
    msaMedianFamilyIncome: Schema.Number,
    tractMedianFamilyIncome: Schema.Number,
    tractPercentOfMsa: Schema.Number,
    year: Schema.Number,
  })
);

export type MsaLookSchemaType = Schema.Schema.Type<typeof msaLookupSchema>;

export const decodeMsaLookupSchema =
  Schema.decodeUnknownEither(msaLookupSchema);
