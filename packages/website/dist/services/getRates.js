import { Effect, Data, Either } from "effect";
import { DbConnectionPool, pool } from "./db";
import { decodeNacaMortgageRates } from "../schemas/external/rates";
export class DbError extends Data.TaggedError("DbError") {
}
export class ParseError extends Data.TaggedError("ParseError") {
}
const rateEffect = Effect.gen(function* () {
    const connectionPool = yield* DbConnectionPool;
    const rows = yield* Effect.tryPromise({
        try: async () => {
            const result = await connectionPool.query("SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1");
            return result.rows;
        },
        catch: (error) => new DbError({ cause: error }),
    });
    console.log("Raw created_at:", rows[0].created_at, typeof rows[0].created_at);
    const parsedRates = decodeNacaMortgageRates(rows[0]);
    if (Either.isLeft(parsedRates)) {
        return new ParseError({ cause: parsedRates.left });
    }
    return parsedRates.right;
});
const getRates = Effect.provideService(rateEffect, DbConnectionPool, pool);
const theRates = await Effect.runPromise(getRates);
console.log(theRates);
