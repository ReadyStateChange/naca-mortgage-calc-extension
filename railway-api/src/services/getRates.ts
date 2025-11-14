import { Effect, Data, Either } from "effect";
import { DbConnectionPool, pool } from "./db";
import { decodeNacaMortgageRates } from "../schemas/external/rates";

export class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}

export const getRatesFromDb = Effect.gen(function* () {
  const connectionPool = yield* DbConnectionPool;
  const dbQuery = Effect.tryPromise({
    try: async () => {
      const result = await connectionPool.query(
        "SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1"
      );
      return result.rows;
    },
    catch: (error) => new DbError({ cause: error }),
  });

  const dbResult = yield* Effect.either(dbQuery);

  if (Either.isLeft(dbResult)) {
    return yield* Effect.fail(dbResult.left);
  }

  const parsedRates = decodeNacaMortgageRates(dbResult.right[0]);
  if (Either.isLeft(parsedRates)) {
    return yield* Effect.fail(parsedRates.left);
  }
  const { thirty_year_rate, twenty_year_rate, fifteen_year_rate } =
    parsedRates.right;
  return { thirty_year_rate, twenty_year_rate, fifteen_year_rate };
});

export const getRates = Effect.provideService(
  getRatesFromDb,
  DbConnectionPool,
  pool
);
