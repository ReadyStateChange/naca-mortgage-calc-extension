# Testing + Effect-TS Adoption Plan

## Objective
Incrementally adopt Vitest for testing and Effect-TS for type-safe runtime validation, starting with external API calls (uncertain data shapes) and progressing to internal APIs (fully typed with Effect.Schema).

## Principles
- **Small Batches**: One test file or Effect integration per step
- **Verification Gate**: User approval required after each step
- **Progressive Enhancement**: No breaking changes to existing functionality
- **Type Safety**: Effect.Schema validates runtime data against TypeScript types

---

## Phase 0: Boilerplate Setup (One-Time) ✅ COMPLETE

### Step 0.1: Install Dependencies ✅
```bash
cd railway-api
bun add -d vitest @vitest/ui effect
```
**Status**: ✅ Complete - All dependencies installed in `package.json`

### Step 0.2: Create Vitest Config ✅
**File**: `railway-api/vitest.config.ts`
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    },
  },
});
```
**Status**: ✅ Complete - Config file created and working

### Step 0.3: Add Test Scripts ✅
**Update**: `railway-api/package.json`
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
  }
}
```
**Status**: ✅ Complete - All test scripts added

### Step 0.4: Create Test Directory Structure ✅
```bash
railway-api/
├── src/
│   ├── schemas/                  # Effect.Schema definitions
│   │   ├── external/
│   │   │   ├── census.ts        ✅ Created
│   │   │   ├── census.test.ts   ✅ Created (2 tests)
│   │   │   ├── rates.ts         ✅ Created
│   │   │   └── rates.test.ts    ✅ Created (4 tests)
│   │   └── internal/
│   │       ├── rates.ts         ⏸️ Pending
│   │       ├── rates.test.ts    ⏸️ Pending
│   │       ├── msa.ts           ⏸️ Pending
│   │       └── msa.test.ts      ⏸️ Pending
```

**Pattern**: Every `.ts` file gets a corresponding `.test.ts` file in the same directory.

**Status**: ✅ Complete - Vitest runs successfully with **6 passing tests**

---

## Phase 1: External API Validation (Uncertain Data Shapes) ✅ COMPLETE

### Context
External APIs return data we don't control:
1. **Census Geocoding API** (`/api/msa-lookup` dependency)
2. **NACA Website HTML Scraper** (rate extraction via regex)

These are perfect candidates for Effect.Schema since we need runtime validation.

---

### Step 1.1: Census Geocoding Schema + Test ✅

**User Story**: Validate Census API response structure to catch upstream changes.

#### 1.1a: Create Schema ✅
**File**: `railway-api/src/schemas/external/census.ts`
```typescript
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
```

**Key Implementation Notes**:
- Uses `Schema.NumberFromString` for STATE, COUNTY, TRACT (Census API returns these as strings)
- Uses `Schema.Record` with pipe/extend pattern for catch-all properties
- Uses `Schema.decodeUnknownEither` instead of `decodeUnknownSync` for better error handling
- Returns `Either` type for explicit success/failure handling

#### 1.1b: Create Test ✅
**File**: `railway-api/src/schemas/external/census.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { Either } from "effect";
import { decodeCensusGeocodeResponse } from "./census";

describe("Decoding Census Geocode Response", () => {
  it("parses successful geocode response", () => {
    const mockResponse = {
      result: {
        addressMatches: [
          {
            coordinates: { x: -71.0589, y: 42.3601 },
            geographies: {
              "Census Tracts": [
                {
                  GEOID: "25025010405",
                  TRACT: "010405",
                  COUNTY: "025",
                  STATE: "25",
                },
              ],
            },
            matchedAddress: "125 MAIN STREET, BALTIMORE, MD 22242 ",
          },
        ],
      },
    };
    const result = decodeCensusGeocodeResponse(mockResponse);

    expect(Either.isRight(result)).toBeTruthy();
  });

  it("rejects invalid response", () => {
    const mockResponse = {
      result: {
        benchmark: {
          isDefault: true,
          benchmarkDescription: "Public Address Ranges - Current Benchmark",
          id: "4",
          benchmarkName: "Public_AR_Current",
        },
      },
    };
    const result = decodeCensusGeocodeResponse(mockResponse);
    expect(Either.isLeft(result)).toBeTruthy();
  });
});
```

**Status**: ✅ Complete - 2 tests passing

---

### Step 1.2: Integrate Census Schema into MSA Lookup ✅

**File**: `railway-api/src/routes/msaLookup.ts`

#### Implementation:
```typescript
import { decodeCensusGeocodeResponse } from "../schemas/external/census";
import { Either } from "effect";

async function geocodeAddress(address: string) {
  const encodedAddress = encodeURIComponent(address);
  const apiUrl = `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodedAddress}&benchmark=4&vintage=4&format=json`;

  const response = await fetch(apiUrl);
  const data = await response.json();

  const result = decodeCensusGeocodeResponse(data);

  if (Either.isLeft(result)) {
    return { matched: false, error: result.left };
  }

  const censusGeocodeResponse = result.right;
  const censusTract =
    censusGeocodeResponse.result.addressMatches[0].geographies[
      "Census Tracts"
    ][0];
  const matchedAddress =
    censusGeocodeResponse.result.addressMatches[0].matchedAddress;

  return {
    matched: true,
    state: censusTract.STATE,
    county: censusTract.COUNTY,
    tract: censusTract.TRACT,
    matchedAddress,
  };
}
```

**Key Implementation Notes**:
- Uses `Either.isLeft()` to check for validation errors
- Returns explicit error object with `matched: false` on validation failure
- Properly extracts validated data from `result.right`
- Handles both validation errors and missing data gracefully

**Status**: ✅ Complete - Census API validation integrated into MSA lookup endpoint

---

### Step 1.3: NACA Scraper Schema + Test ✅

**User Story**: Validate scraped rate data structure before inserting into DB.

#### 1.3a: Create Schema ✅
**File**: `railway-api/src/schemas/external/rates.ts`
```typescript
import { Schema } from "effect";

export const NacaMortgageRatesSchema = Schema.Struct({
  thirty_year_rate: Schema.NumberFromString,
  twenty_year_rate: Schema.NumberFromString,
  fifteen_year_rate: Schema.NumberFromString,
  created_at: Schema.optionalWith(Schema.DateFromString, { exact: true }),
}).pipe(
  Schema.extend(Schema.Record({ key: Schema.String, value: Schema.Unknown }))
);

export type NacaMortgageRates = Schema.Schema.Type<
  typeof NacaMortgageRatesSchema
>;

export const decodeNacaMortgageRates = Schema.decodeUnknownEither(
  NacaMortgageRatesSchema
);
```

**Key Implementation Notes**:
- Uses `Schema.NumberFromString` to parse rate strings (e.g., "6.5" → 6.5)
- `created_at` is optional with `exact: true` for strict undefined handling
- Uses `Schema.Record` catch-all to allow extra fields from DB (like `id`, timestamps)
- Returns `Either<ParseError, NacaMortgageRates>` for explicit error handling

#### 1.3b: Create Test ✅
**File**: `railway-api/src/schemas/external/rates.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { decodeNacaMortgageRates, type NacaMortgageRates } from "./rates";
import { Either } from "effect";

describe("Decoding NACA Mortgage Rates", () => {
  it("parses valid mortgage rates with all fields", () => {
    const mockRates = {
      thirty_year_rate: "6.5",
      twenty_year_rate: "6.25",
      fifteen_year_rate: "5.75",
      created_at: "2024-01-15T10:30:00Z",
    };
    const result = decodeNacaMortgageRates(mockRates);

    expect(Either.isRight(result)).toBeTruthy();
    if (Either.isRight(result)) {
      expect(result.right.thirty_year_rate).toBe(6.5);
      expect(result.right.twenty_year_rate).toBe(6.25);
      expect(result.right.fifteen_year_rate).toBe(5.75);
      expect(result.right.created_at).toBeInstanceOf(Date);
    }
  });

  it("parses valid mortgage rates without created_at", () => {
    const mockRates = {
      thirty_year_rate: "6.5",
      twenty_year_rate: "6.25",
      fifteen_year_rate: "5.75",
    };
    const result = decodeNacaMortgageRates(mockRates);

    expect(Either.isRight(result)).toBeTruthy();
    if (Either.isRight(result)) {
      expect(result.right.thirty_year_rate).toBe(6.5);
      expect(result.right.created_at).toBeUndefined();
    }
  });

  it("parses valid mortgage rates with extra key-value pairs", () => {
    const mockRates = {
      thirty_year_rate: "6.5",
      twenty_year_rate: "6.25",
      fifteen_year_rate: "5.75",
      created_at: "2024-01-15T10:30:00Z",
      extra_field: "some value",
      another_field: 123,
    };
    const result = decodeNacaMortgageRates(mockRates);

    expect(Either.isRight(result)).toBeTruthy();
    if (Either.isRight(result)) {
      expect((result.right as any).extra_field).toBe("some value");
      expect((result.right as any).another_field).toBe(123);
    }
  });

  it("fails parsing when one rate value is missing", () => {
    const mockRates = {
      thirty_year_rate: "6.5",
      twenty_year_rate: "6.25",
      // fifteen_year_rate is missing
      created_at: "2024-01-15T10:30:00Z",
    };
    const result = decodeNacaMortgageRates(mockRates);

    expect(Either.isLeft(result)).toBeTruthy();
  });
});
```

**Status**: ✅ Complete - 4 tests passing

---

### Step 1.4: Integrate NACA Schema into Rate Scraper ✅

**Files**: `railway-api/src/services/scraper.ts` and `railway-api/src/services/rateUpdater.ts`

#### Implementation in scraper.ts ✅
```typescript
import { Either } from "effect";
import {
  decodeNacaMortgageRates,
  type NacaMortgageRates,
} from "../schemas/external/rates";

const rateRegex =
  /function\s+fillRate\s*\(\)\s*\{\s*var\s+thirtyYearRate\s*=\s*"([^"]+)";\s*var\s+twentyYearRate\s*=\s*"([^"]+)";\s*var\s+fifteenYearRate\s*=\s*"([^"]+)";/;

const NACA_CALCULATOR_URL = "https://www.naca.com/mortgage-calculator/";

export async function scrapeNacaRates(): Promise<NacaMortgageRates> {
  console.log("🔍 Fetching rates from NACA website...");

  const response = await fetch(NACA_CALCULATOR_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch NACA page: ${response.statusText}`);
  }

  const html = await response.text();
  const match = html.match(rateRegex);

  if (!match || match.length < 4) {
    throw new Error("Could not parse rates from NACA page");
  }

  const rates = {
    thirty_year_rate: match[1].replace("%", ""),
    twenty_year_rate: match[2].replace("%", ""),
    fifteen_year_rate: match[3].replace("%", ""),
  };

  const parsedRates = decodeNacaMortgageRates(rates);
  if (Either.isLeft(parsedRates)) {
    console.log(parsedRates.left);
    throw new Error("Could not parse rates from NACA page");
  }

  console.log("✅ Scraped rates:", parsedRates.right);
  return parsedRates.right;
}
```

#### Implementation in rateUpdater.ts ✅
```typescript
import {
  decodeNacaMortgageRates,
  type NacaMortgageRates,
} from "../schemas/external/rates";
import { Either } from "effect";

function ratesMatch(
  latestDbRates: NacaMortgageRates,
  ratesFromWebsite: NacaMortgageRates
) {
  if (!latestDbRates) return false;
  return (
    latestDbRates.thirty_year_rate === ratesFromWebsite.thirty_year_rate &&
    latestDbRates.twenty_year_rate === ratesFromWebsite.twenty_year_rate &&
    latestDbRates.fifteen_year_rate === ratesFromWebsite.fifteen_year_rate
  );
}

export async function saveRatesIfNeeded(ratesFromWebsite: NacaMortgageRates) {
  const latestResult = await pool.query(
    "SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1"
  );

  // Validate DB data with the same schema
  const decodedRates = decodeNacaMortgageRates(latestResult.rows[0]);
  if (Either.isLeft(decodedRates)) {
    console.log(decodedRates.left);
    throw new Error("Could not parse rates from DB");
  }
  const parsedRatesFromDb = decodedRates.right;

  // ... deduplication logic ...
}
```

**Key Implementation Notes**:
- Scraper validates data immediately after extraction from HTML
- Rate updater validates data from DB using the same schema (ensuring DB integrity)
- Both services use `Either.isLeft()` for error checking
- Errors are logged with full ParseError details before throwing
- Type safety enforced throughout: both functions return/accept `NacaMortgageRates`

**Status**: ✅ Complete - Schema integrated into both scraper and rate update services

---

## Phase 2: Internal API Validation (Controlled Data Shapes) ⏸️ PENDING

### Context
Internal APIs return data we control. Use Effect.Schema to ensure type safety between backend and frontend.

**Pattern to Follow**: Based on Phase 1 implementation, use:
- `import { Schema } from "effect"` (not `@effect/schema/Schema`)
- `Schema.decodeUnknownEither()` for decoder functions
- `Either.isLeft()` / `Either.isRight()` for error handling
- Optional fields with `Schema.optionalWith(..., { exact: true })`
- Record catch-all with `.pipe(Schema.extend(Schema.Record(...)))`

---

### Step 2.1: Extract DB Logic into Service with Effect ⏸️

**Goal**: Extract DB lookup from routes into `src/services/getRates.ts` using Effect.tryPromise with Pool as dependency

#### 2.1a: Write Tests First ✅
**File**: `src/services/getRates.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { Effect, Context } from "effect";
import { getRates, DbError, ParseError } from "./getRates";
import { Pool } from "pg";

// Create test Pool service
const TestPool = Context.GenericTag<Pool>("Pool");

describe("getRates service", () => {
  it("returns parsed rates on success", async () => {
    const mockPool = {
      query: async () => ({
        rows: [
          { thirty_year_rate: "6.5", twenty_year_rate: "6.25", fifteen_year_rate: "5.75" }
        ]
      })
    } as Pool;

    const program = getRates.pipe(Effect.provideService(TestPool, mockPool));
    const result = await Effect.runPromise(program);

    expect(result).toHaveLength(1);
    expect(result[0].thirty_year_rate).toBe(6.5);
  });

  it("throws DbError on connection failure", async () => {
    const mockPool = {
      query: async () => { throw new Error("Connection failed"); }
    } as Pool;

    const program = getRates.pipe(Effect.provideService(TestPool, mockPool));
    const result = await Effect.runPromise(Effect.either(program));

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left._tag).toBe("DbError");
    }
  });

  it("throws ParseError when DB returns invalid data", async () => {
    const mockPool = {
      query: async () => ({
        rows: [{ thirty_year_rate: "invalid" }] // missing required fields
      })
    } as Pool;

    const program = getRates.pipe(Effect.provideService(TestPool, mockPool));
    const result = await Effect.runPromise(Effect.either(program));

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left._tag).toBe("ParseError");
    }
  });
});
```

#### 2.1b: Create Service with Tagged Errors ⏸️
**File**: `src/services/getRates.ts`
```typescript
import { Effect, Data, Context } from "effect";
import { Pool } from "pg";
import { decodeNacaMortgageRates, type NacaMortgageRates } from "../schemas/external/rates";

// Tagged error types
export class DbError extends Data.TaggedError("DbError")<{ cause: unknown }> {}
export class ParseError extends Data.TaggedError("ParseError")<{ cause: unknown }> {}

// Pool service tag
const PoolService = Context.GenericTag<Pool>("Pool");

export const getRates: Effect.Effect<NacaMortgageRates[], DbError | ParseError, Pool> =
  Effect.gen(function* () {
    const pool = yield* PoolService;

    const rows = yield* Effect.tryPromise({
      try: async () => {
        const result = await pool.query(
          "SELECT * FROM naca_mortgage_rates ORDER BY created_at DESC LIMIT 1"
        );
        return result.rows;
      },
      catch: (error) => new DbError({ cause: error }),
    });

    const parsed = yield* Effect.all(
      rows.map((row) => {
        const decoded = decodeNacaMortgageRates(row);
        return decoded._tag === "Left"
          ? Effect.fail(new ParseError({ cause: decoded.left }))
          : Effect.succeed(decoded.right);
      })
    );

    return parsed;
  });
```

**Verification Checkpoint**: Run `bun test` → 3 new tests pass

### Step 2.2: Integrate Service into GET /api/rates ⏸️

**File**: `railway-api/src/routes/rates.ts`
```typescript
import { Effect } from "effect";
import { getRates, DbError, ParseError } from "../services/getRates";
import { pool } from "../services/db";

export async function rates(req: Request): Promise<Response> {
  const program = getRates.pipe(Effect.provideService(PoolService, pool));
  const result = await Effect.runPromise(Effect.either(program));

  if (result._tag === "Left") {
    const error = result.left;
    console.error(`${error._tag}:`, error.cause);
    return new Response(
      JSON.stringify({ error: error._tag === "DbError" ? "Database error" : "Data validation error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify(result.right), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

**Verification Checkpoint**: `curl /api/rates` → returns validated rates with proper error handling

---

### Step 2.3: MSA Lookup API Schema + Test ⏸️

**User Story**: Type-safe `/api/msa-lookup` request/response validation.

#### 2.3a: Create Schema
**File**: `railway-api/src/schemas/internal/msa.ts`
```typescript
import { Schema } from "effect";

export const MsaLookupRequestSchema = Schema.Struct({
  address: Schema.String.pipe(Schema.minLength(5)),
});

export const MsaLookupResponseSchema = Schema.Struct({
  address: Schema.String,
  state: Schema.Number,
  county: Schema.Number,
  tract: Schema.Number,
  msaMedianFamilyIncome: Schema.Number,
  tractMedianFamilyIncome: Schema.Number,
  tractPercentOfMsa: Schema.Number,
  year: Schema.Number,
});

export type MsaLookupRequest = Schema.Schema.Type<
  typeof MsaLookupRequestSchema
>;
export type MsaLookupResponse = Schema.Schema.Type<
  typeof MsaLookupResponseSchema
>;

export const decodeMsaLookupRequest = Schema.decodeUnknownEither(
  MsaLookupRequestSchema
);
export const decodeMsaLookupResponse = Schema.decodeUnknownEither(
  MsaLookupResponseSchema
);
```

#### 2.3b: Create Test
**File**: `railway-api/src/schemas/internal/msa.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { Either } from "effect";
import {
  decodeMsaLookupRequest,
  decodeMsaLookupResponse,
} from "./msa";

describe("POST /api/msa-lookup Schema", () => {
  it("validates request with valid address", () => {
    const request = { address: "123 Main St, Boston, MA" };
    const result = decodeMsaLookupRequest(request);

    expect(Either.isRight(result)).toBeTruthy();
    if (Either.isRight(result)) {
      expect(result.right.address).toBe("123 Main St, Boston, MA");
    }
  });

  it("rejects request with short address", () => {
    const request = { address: "123" };
    const result = decodeMsaLookupRequest(request);

    expect(Either.isLeft(result)).toBeTruthy();
  });

  it("validates MSA response", () => {
    const response = {
      address: "125 MAIN STREET, BALTIMORE, MD 22242",
      state: 25,
      county: 25,
      tract: 10405,
      msaMedianFamilyIncome: 120000,
      tractMedianFamilyIncome: 98000,
      tractPercentOfMsa: 81.67,
      year: 2024,
    };

    const result = decodeMsaLookupResponse(response);
    expect(Either.isRight(result)).toBeTruthy();
    if (Either.isRight(result)) {
      expect(result.right.msaMedianFamilyIncome).toBe(120000);
    }
  });
});
```

**Verification Checkpoint**: Run `bun test` → 9 tests total pass.

---

### Step 2.4: Integrate MSA Schema into POST /api/msa-lookup ⏸️

**File**: `railway-api/src/routes/msaLookup.ts` (modify existing)

#### Implementation Pattern:
```typescript
import { Either } from "effect";
import {
  decodeMsaLookupRequest,
  decodeMsaLookupResponse,
} from "../schemas/internal/msa";

export async function msaLookup(req: Request): Promise<Response> {
  try {
    const body = await req.json();

    // Validate request
    const requestResult = decodeMsaLookupRequest(body);
    if (Either.isLeft(requestResult)) {
      return new Response(
        JSON.stringify({ error: "Invalid request: address must be at least 5 characters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { address } = requestResult.right;

    // ... perform lookup ...

    // Validate response before returning
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

    const responseResult = decodeMsaLookupResponse(response);
    if (Either.isLeft(responseResult)) {
      console.error("Failed to validate MSA response:", responseResult.left);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(responseResult.right), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // ... error handling ...
  }
}
```

**Verification Checkpoint**: Test MSA lookup with valid/invalid addresses → proper validation errors with detailed feedback.

---

## Phase 3: Calculator Logic Testing (Optional) ⏸️ PENDING

### Context
The calculator logic currently lives in the frontend (`js/calculator.js` and `website/calculator.js`). If/when the calculator is ported to the backend for server-side calculations, these tests will ensure correctness.

### Step 3.1: Payment-to-Price Calculator Tests ⏸️

**File**: `railway-api/src/calculator/calculator.test.ts` (if porting calculator to backend)
```typescript
import { describe, it, expect } from "vitest";
import { MortgageCalculator } from "./calculator";

describe("Payment to Price Calculator", () => {
  it("calculates max price for $2000/month payment", () => {
    const calculator = new MortgageCalculator({
      mode: "payment",
      desiredPayment: 2000,
      interestRate: 6.5,
      loanTerm: 30,
      propertyTaxRate: 1.2,
      downPayment: 0,
      interestBuydown: 0,
      principalBuydown: 0,
    });

    const result = calculator.calculate();
    expect(result.purchasePrice).toBeCloseTo(315000, -3); // Within $1000
  });

  it("accounts for property tax correctly in PITI", () => {
    const calculator = new MortgageCalculator({
      mode: "price",
      purchasePrice: 300000,
      interestRate: 6.5,
      loanTerm: 30,
      propertyTaxRate: 1.2,
      downPayment: 0,
      interestBuydown: 0,
      principalBuydown: 0,
    });

    const result = calculator.calculate();
    const expectedMonthlyTax = (300000 * 0.012) / 12;
    expect(result.monthlyPropertyTax).toBeCloseTo(expectedMonthlyTax, 2);
  });

  it("applies interest rate buydown correctly (1 point = 1/6% for 30 year)", () => {
    const calculator = new MortgageCalculator({
      mode: "price",
      purchasePrice: 300000,
      interestRate: 6.5,
      loanTerm: 30,
      propertyTaxRate: 1.2,
      downPayment: 0,
      interestBuydown: 6, // 6 points = 1% reduction
      principalBuydown: 0,
    });

    const result = calculator.calculate();
    expect(result.effectiveInterestRate).toBeCloseTo(5.5, 2); // 6.5% - 1%
  });
});
```

**Verification Checkpoint**: Property-based tests ensure calculator logic correctness across edge cases.

---

## Phase 4: Frontend Integration (Future) ⏸️ PENDING

### Context
Once backend schemas are stable (Phase 2 complete), share them with frontend for end-to-end type safety. This ensures the browser extension and website consume validated, type-safe data.

### Step 4.1: Share Schema Types with Frontend ⏸️

**Option A**: Export standalone TypeScript types from schemas
```typescript
// In railway-api/src/schemas/internal/rates.ts
// Add type exports that can be imported by frontend

// Then in popup/types/api.ts (or website/types/api.ts):
export type { MortgageRate, RatesResponse } from "../../railway-api/src/schemas/internal/rates";
export type { MsaLookupRequest, MsaLookupResponse } from "../../railway-api/src/schemas/internal/msa";
```

**Option B**: Bundle Effect into frontend and use schemas directly
- Adds ~100KB to extension bundle
- Provides runtime validation on frontend
- Shares exact schema definitions

### Step 4.2: Frontend API Client with Type Safety ⏸️

**Pattern**: Use Either pattern for API calls in frontend

**File**: `popup/api/client.ts` (new file)
```typescript
import { Either } from "effect";
import { decodeRatesResponse, type RatesResponse } from "../../railway-api/src/schemas/internal/rates";

const API_URL = "https://your-railway-app.up.railway.app";

export async function fetchRates(): Promise<RatesResponse> {
  const response = await fetch(`${API_URL}/api/rates`);
  const data = await response.json();

  const result = decodeRatesResponse(data);
  if (Either.isLeft(result)) {
    console.error("Invalid rates response from API:", result.left);
    throw new Error("Failed to validate rates response");
  }

  return result.right;
}

export async function lookupMsa(address: string) {
  const response = await fetch(`${API_URL}/api/msa-lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });

  const data = await response.json();

  const result = decodeMsaLookupResponse(data);
  if (Either.isLeft(result)) {
    console.error("Invalid MSA response from API:", result.left);
    throw new Error("Failed to validate MSA response");
  }

  return result.right;
}
```

**Benefits**:
- Catch API contract changes immediately in frontend
- Full TypeScript autocomplete for API responses
- Runtime validation prevents displaying invalid data
- Shared schemas ensure backend/frontend always agree on types

---

## Progress Tracking

| Phase | Step | Status     | Notes                                                 |
| ----- | ---- | ---------- | ----------------------------------------------------- |
| 0     | 0.1  | ✅ Complete | Dependencies installed (vitest, @vitest/ui, effect)   |
| 0     | 0.2  | ✅ Complete | Vitest config created                                 |
| 0     | 0.3  | ✅ Complete | Test scripts added to package.json                    |
| 0     | 0.4  | ✅ Complete | Schema directory structure created                    |
| 1     | 1.1  | ✅ Complete | Census schema + 2 tests (census.ts, census.test.ts)   |
| 1     | 1.2  | ✅ Complete | Census schema integrated into msaLookup.ts            |
| 1     | 1.3  | ✅ Complete | NACA rates schema + 4 tests (rates.ts, rates.test.ts) |
| 1     | 1.4  | ✅ Complete | Schema integrated into scraper.ts and rateUpdater.ts  |
| 2     | 2.1  | ⏸️ Pending  | Internal rates API schema + test                      |
| 2     | 2.2  | ⏸️ Pending  | Rates API integration                                 |
| 2     | 2.3  | ⏸️ Pending  | MSA API schema + test                                 |
| 2     | 2.4  | ⏸️ Pending  | MSA API integration                                   |
| 3     | 3.1  | ⏸️ Pending  | Calculator tests (optional, if porting to backend)    |
| 4     | 4.1  | ⏸️ Pending  | Share types with frontend                             |
| 4     | 4.2  | ⏸️ Pending  | Frontend API client with validation                   |

**Current Status**: ✅ **Phase 0 and Phase 1 Complete** (6 tests passing)
- All external API validation complete (Census API, NACA scraper)
- Ready to proceed with Phase 2 (internal API validation)

---

## Benefits Summary

✅ **Runtime Safety**: Catch API contract changes immediately
✅ **Type Safety**: Full TypeScript inference from schemas
✅ **Self-Documenting**: Schemas serve as living API docs
✅ **Incremental**: No big-bang migration risk
✅ **Testable**: Every schema has corresponding test coverage

---

## Next Steps

1. ✅ ~~Review plan and execute Phase 0 setup~~ **COMPLETE**
2. ✅ ~~Execute Phase 1 (External API validation)~~ **COMPLETE**
3. **NEXT**: Proceed with Phase 2 (Internal API validation)
   - Step 2.1: Create internal rates API schema + tests
   - Step 2.2: Integrate rates schema into GET /api/rates endpoint
   - Step 2.3: Create MSA lookup API schema + tests
   - Step 2.4: Integrate MSA schema into POST /api/msa-lookup endpoint
4. Optionally expand to Phase 3 (calculator tests) if porting calculator to backend
5. Optionally expand to Phase 4 (frontend integration) for end-to-end type safety

## Key Learnings from Phase 1 Implementation

**Established Patterns** (use these going forward):
1. **Import Style**: `import { Schema } from "effect"` (not `@effect/schema/Schema`)
2. **Decoder Pattern**: `Schema.decodeUnknownEither()` returns `Either<ParseError, T>`
3. **Error Handling**: Use `Either.isLeft()` / `Either.isRight()` for control flow
4. **String Parsing**: Use `Schema.NumberFromString`, `Schema.DateFromString` for type coercion
5. **Optional Fields**: Use `Schema.optionalWith(..., { exact: true })` for strict undefined handling
6. **Catch-all Properties**: Use `.pipe(Schema.extend(Schema.Record({ key: Schema.String, value: Schema.Unknown })))`
7. **Test Pattern**: Always test both success and failure cases, use `Either.isRight()` assertions

**Actual vs. Planned Differences**:
- Census schema uses `NumberFromString` for numeric fields (Census returns strings)
- Catch-all pattern is more sophisticated with pipe/extend
- Error handling is more explicit with Either pattern throughout
- DB validation added in rateUpdater (validates data coming FROM database too)

