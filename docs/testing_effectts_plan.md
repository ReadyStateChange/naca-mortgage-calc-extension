# Testing + Effect-TS Adoption Plan

## Objective
Incrementally adopt Vitest for testing and Effect-TS for type-safe runtime validation, starting with external API calls (uncertain data shapes) and progressing to internal APIs (fully typed with Effect.Schema).

## Principles
- **Small Batches**: One test file or Effect integration per step
- **Verification Gate**: User approval required after each step
- **Progressive Enhancement**: No breaking changes to existing functionality
- **Type Safety**: Effect.Schema validates runtime data against TypeScript types

---

## Phase 0: Boilerplate Setup (One-Time)

### Step 0.1: Install Dependencies
```bash
cd railway-api
bun add -d vitest @vitest/ui  effect
```

### Step 0.2: Create Vitest Config
**File**: `railway-api/vitest.config.ts`
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts']
    }
  }
});
```

### Step 0.3: Add Test Scripts
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

### Step 0.4: Create Test Directory Structure
```bash
railway-api/
├── src/
│   ├── schemas/                  # Effect.Schema definitions
│   │   ├── external/
│   │   │   ├── census.ts
│   │   │   ├── census.test.ts   # Test colocated with schema
│   │   │   ├── naca.ts
│   │   │   └── naca.test.ts
│   │   └── internal/
│   │       ├── rates.ts
│   │       ├── rates.test.ts
│   │       ├── msa.ts
│   │       └── msa.test.ts
│   ├── services/
│   │   ├── rateScraper.ts
│   │   ├── rateScraper.test.ts  # Test colocated with service
│   │   ├── msaLookup.ts
│   │   └── msaLookup.test.ts
│   └── routes/
│       ├── rates.ts
│       ├── rates.test.ts        # Test colocated with route
│       └── ...
```

**Pattern**: Every `.ts` file gets a corresponding `.test.ts` file in the same directory.

**Deliverable**: Vitest runs successfully (`bun test`) with no tests yet.

---

## Phase 1: External API Validation (Uncertain Data Shapes)

### Context
External APIs return data we don't control:
1. **Census Geocoding API** (`/api/msa-lookup` dependency)
2. **NACA Website HTML Scraper** (rate extraction via regex)

These are perfect candidates for Effect.Schema since we need runtime validation.

---

### Step 1.1: Census Geocoding Schema + Test

**User Story**: Validate Census API response structure to catch upstream changes.

#### 1.1a: Create Schema
**File**: `railway-api/src/schemas/external/census.ts`
```typescript
import * as S from "@effect/schema/Schema";

// Census Geocoding API Response Schema
export const CensusGeocodeResult = S.Struct({
  result: S.Struct({
    addressMatches: S.Array(
      S.Struct({
        coordinates: S.Struct({
          x: S.Number,
          y: S.Number
        }),
        geographies: S.Struct({
          "Census Tracts": S.Array(
            S.Struct({
              GEOID: S.String,
              TRACT: S.String,
              COUNTY: S.String,
              STATE: S.String
            })
          )
        })
      })
    )
  })
});

export type CensusGeocodeResult = S.Schema.Type<typeof CensusGeocodeResult>;
```

#### 1.1b: Create Test
**File**: `railway-api/src/schemas/external/census.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import * as S from "@effect/schema/Schema";
import { CensusGeocodeResult } from './census';

describe('Census Geocoding API', () => {
  it('validates successful geocode response', () => {
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
                  STATE: "25"
                }
              ]
            }
          }
        ]
      }
    };

    const result = S.decodeUnknownSync(CensusGeocodeResult)(mockResponse);
    expect(result.result.addressMatches).toHaveLength(1);
    expect(result.result.addressMatches[0].coordinates.x).toBeCloseTo(-71.0589);
  });

  it('rejects invalid response structure', () => {
    const invalidResponse = {
      result: {
        addressMatches: []
      }
    };

    expect(() => {
      S.decodeUnknownSync(CensusGeocodeResult)(invalidResponse);
    }).not.toThrow(); // Empty array is valid

    const malformedResponse = { result: "not an object" };
    expect(() => {
      S.decodeUnknownSync(CensusGeocodeResult)(malformedResponse);
    }).toThrow();
  });
});
```

**Verification Checkpoint**: Run `bun test` → 2 tests pass.

---

### Step 1.2: Integrate Census Schema into MSA Lookup

**File**: `railway-api/src/services/msaLookup.ts` (modify existing)

#### Before:
```typescript
const geocodeResponse = await fetch(geocodeUrl);
const geocodeData = await geocodeResponse.json();
// No validation - assumes structure is correct
```

#### After:
```typescript
import * as S from "@effect/schema/Schema";
import { CensusGeocodeResult } from "../schemas/external/census";

const geocodeResponse = await fetch(geocodeUrl);
const geocodeData = await geocodeResponse.json();

// Validate response with Effect.Schema
try {
  const validated = S.decodeUnknownSync(CensusGeocodeResult)(geocodeData);
  // Use validated.result.addressMatches instead of geocodeData
} catch (error) {
  console.error("Census API response validation failed:", error);
  throw new Error("Invalid Census API response structure");
}
```

**Verification Checkpoint**: Test MSA lookup endpoint with real address → still works, logs validation errors if Census API changes.

---

### Step 1.3: NACA Scraper Schema + Test

**User Story**: Validate scraped rate data structure before inserting into DB.

#### 1.3a: Create Schema
**File**: `railway-api/src/schemas/external/naca.ts`
```typescript
import * as S from "@effect/schema/Schema";

export const NacaScrapedRate = S.Struct({
  loan_term: S.Number,
  interest_rate: S.Number,
  scraped_at: S.Date
});

export const NacaScrapedRates = S.Array(NacaScrapedRate);

export type NacaScrapedRate = S.Schema.Type<typeof NacaScrapedRate>;
```

#### 1.3b: Create Test
**File**: `railway-api/src/schemas/external/naca.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import * as S from "@effect/schema/Schema";
import { NacaScrapedRate, NacaScrapedRates } from './naca';

describe('NACA Rate Scraper', () => {
  it('validates scraped rate object', () => {
    const scraped = {
      loan_term: 30,
      interest_rate: 6.5,
      scraped_at: new Date()
    };

    const result = S.decodeUnknownSync(NacaScrapedRate)(scraped);
    expect(result.loan_term).toBe(30);
    expect(result.interest_rate).toBe(6.5);
  });

  it('validates array of scraped rates', () => {
    const scraped = [
      { loan_term: 15, interest_rate: 6.0, scraped_at: new Date() },
      { loan_term: 20, interest_rate: 6.25, scraped_at: new Date() },
      { loan_term: 30, interest_rate: 6.5, scraped_at: new Date() }
    ];

    const result = S.decodeUnknownSync(NacaScrapedRates)(scraped);
    expect(result).toHaveLength(3);
  });

  it('rejects invalid rate data', () => {
    const invalid = {
      loan_term: "thirty", // should be number
      interest_rate: 6.5,
      scraped_at: new Date()
    };

    expect(() => {
      S.decodeUnknownSync(NacaScrapedRate)(invalid);
    }).toThrow();
  });
});
```

**Verification Checkpoint**: Run `bun test` → 5 tests total pass.

---

### Step 1.4: Integrate NACA Schema into Rate Scraper

**File**: `railway-api/src/services/rateScraper.ts` (modify existing)

#### Before:
```typescript
return rates.map(rate => ({
  loan_term: rate.loan_term,
  interest_rate: rate.interest_rate,
  scraped_at: new Date()
}));
```

#### After:
```typescript
import * as S from "@effect/schema/Schema";
import { NacaScrapedRates } from "../schemas/external/naca";

const scrapedRates = rates.map(rate => ({
  loan_term: rate.loan_term,
  interest_rate: rate.interest_rate,
  scraped_at: new Date()
}));

// Validate before returning
const validated = S.decodeUnknownSync(NacaScrapedRates)(scrapedRates);
return validated;
```

**Verification Checkpoint**: Run rate scraper → validates scraped data, throws if NACA site changes break assumptions.

---

## Phase 2: Internal API Validation (Controlled Data Shapes)

### Context
Internal APIs return data we control. Use Effect.Schema to ensure type safety between backend and frontend.

---

### Step 2.1: Rates API Schema + Test

**User Story**: Type-safe `/api/rates` endpoint with validation.

#### 2.1a: Create Schema
**File**: `railway-api/src/schemas/internal/rates.ts`
```typescript
import * as S from "@effect/schema/Schema";

export const MortgageRate = S.Struct({
  id: S.Number,
  loan_term: S.Number,
  interest_rate: S.Number,
  scraped_at: S.Date,
  created_at: S.Date
});

export const RatesResponse = S.Array(MortgageRate);

export type MortgageRate = S.Schema.Type<typeof MortgageRate>;
export type RatesResponse = S.Schema.Type<typeof RatesResponse>;
```

#### 2.1b: Create Test
**File**: `railway-api/src/schemas/internal/rates.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import * as S from "@effect/schema/Schema";
import { MortgageRate, RatesResponse } from './rates';

describe('GET /api/rates', () => {
  it('validates single rate object', () => {
    const rate = {
      id: 1,
      loan_term: 30,
      interest_rate: 6.5,
      scraped_at: new Date(),
      created_at: new Date()
    };

    const result = S.decodeUnknownSync(MortgageRate)(rate);
    expect(result.id).toBe(1);
  });

  it('validates rates array response', () => {
    const rates = [
      { id: 1, loan_term: 15, interest_rate: 6.0, scraped_at: new Date(), created_at: new Date() },
      { id: 2, loan_term: 30, interest_rate: 6.5, scraped_at: new Date(), created_at: new Date() }
    ];

    const result = S.decodeUnknownSync(RatesResponse)(rates);
    expect(result).toHaveLength(2);
  });
});
```

**Verification Checkpoint**: Run `bun test` → 7 tests total pass.

---

### Step 2.2: Integrate Rates Schema into GET /api/rates

**File**: `railway-api/src/routes/rates.ts` (modify existing)

#### After:
```typescript
import * as S from "@effect/schema/Schema";
import { RatesResponse } from "../schemas/internal/rates";

// ... fetch rates from DB ...

// Validate before sending response
const validated = S.decodeUnknownSync(RatesResponse)(rows);
return Response.json(validated);
```

**Verification Checkpoint**: `curl /api/rates` → response still works, validated on backend.

---

### Step 2.3: MSA Lookup API Schema + Test

**User Story**: Type-safe `/api/msa-lookup` request/response validation.

#### 2.3a: Create Schema
**File**: `railway-api/src/schemas/internal/msa.ts`
```typescript
import * as S from "@effect/schema/Schema";

export const MsaLookupRequest = S.Struct({
  address: S.String.pipe(S.minLength(5))
});

export const MsaLookupResponse = S.Struct({
  tract_id: S.String,
  msa_income: S.Number,
  tract_income: S.Number,
  tract_percent_msa: S.Number,
  year: S.Number
});

export type MsaLookupRequest = S.Schema.Type<typeof MsaLookupRequest>;
export type MsaLookupResponse = S.Schema.Type<typeof MsaLookupResponse>;
```

#### 2.3b: Create Test
**File**: `railway-api/src/schemas/internal/msa.test.ts`
```typescript
import { describe, it, expect } from 'vitest';
import * as S from "@effect/schema/Schema";
import { MsaLookupRequest, MsaLookupResponse } from './msa';

describe('POST /api/msa-lookup', () => {
  it('validates request with valid address', () => {
    const request = { address: "123 Main St, Boston, MA" };
    const result = S.decodeUnknownSync(MsaLookupRequest)(request);
    expect(result.address).toBe("123 Main St, Boston, MA");
  });

  it('rejects request with short address', () => {
    const request = { address: "123" };
    expect(() => {
      S.decodeUnknownSync(MsaLookupRequest)(request);
    }).toThrow();
  });

  it('validates MSA response', () => {
    const response = {
      tract_id: "25025010405",
      msa_income: 120000,
      tract_income: 98000,
      tract_percent_msa: 81.67,
      year: 2024
    };

    const result = S.decodeUnknownSync(MsaLookupResponse)(response);
    expect(result.tract_id).toBe("25025010405");
  });
});
```

**Verification Checkpoint**: Run `bun test` → 10 tests total pass.

---

### Step 2.4: Integrate MSA Schema into POST /api/msa-lookup

**File**: `railway-api/src/routes/msaLookup.ts` (modify existing)

#### After:
```typescript
import * as S from "@effect/schema/Schema";
import { MsaLookupRequest, MsaLookupResponse } from "../schemas/internal/msa";

// Validate request
const body = await request.json();
const validatedRequest = S.decodeUnknownSync(MsaLookupRequest)(body);

// ... perform lookup ...

// Validate response before returning
const response = {
  tract_id: tractId,
  msa_income: msaIncome,
  tract_income: tractIncome,
  tract_percent_msa: tractPercentMsa,
  year: 2024
};

const validated = S.decodeUnknownSync(MsaLookupResponse)(response);
return Response.json(validated);
```

**Verification Checkpoint**: Test MSA lookup with valid/invalid addresses → proper validation errors.

---

## Phase 3: Calculator Logic Testing (Optional)

### Step 3.1: Payment-to-Price Calculator Tests

**File**: `railway-api/src/calculator/calculator.test.ts` (if porting calculator to backend)
```typescript
import { describe, it, expect } from 'vitest';
// Import calculator class from ./calculator

describe('Payment to Price Calculator', () => {
  it('calculates max price for $2000/month payment', () => {
    // Test cases with known inputs/outputs
  });

  it('accounts for property tax correctly', () => {
    // Verify PITI calculation
  });
});
```

**Verification Checkpoint**: Property-based tests ensure calculator logic correctness.

---

## Phase 4: Frontend Integration (Future)

Once backend schemas are stable, share them with frontend:

### Step 4.1: Generate TypeScript Types for Extension
```bash
# Export schemas as standalone types
effect-schema codegen --output popup/types/api.ts
```

### Step 4.2: Frontend API Client with Effect
```typescript
// popup/popup.js → popup/popup.ts
import * as S from "@effect/schema/Schema";
import { RatesResponse } from "./types/api";

const response = await fetch(`${API_URL}/api/rates`);
const data = await response.json();
const validated = S.decodeUnknownSync(RatesResponse)(data);
// Use validated data with type safety
```

---

## Progress Tracking

| Phase | Step | Status    | Notes                      |
| ----- | ---- | --------- | -------------------------- |
| 0     | 0.1  | ⏸️ Pending | Install dependencies       |
| 0     | 0.2  | ⏸️ Pending | Vitest config              |
| 0     | 0.3  | ⏸️ Pending | Package.json scripts       |
| 0     | 0.4  | ⏸️ Pending | Directory structure        |
| 1     | 1.1  | ⏸️ Pending | Census schema + test       |
| 1     | 1.2  | ⏸️ Pending | Census integration         |
| 1     | 1.3  | ⏸️ Pending | NACA scraper schema + test |
| 1     | 1.4  | ⏸️ Pending | NACA scraper integration   |
| 2     | 2.1  | ⏸️ Pending | Rates schema + test        |
| 2     | 2.2  | ⏸️ Pending | Rates integration          |
| 2     | 2.3  | ⏸️ Pending | MSA schema + test          |
| 2     | 2.4  | ⏸️ Pending | MSA integration            |
| 3     | 3.1  | ⏸️ Pending | Calculator tests           |
| 4     | 4.1  | ⏸️ Pending | Frontend types             |
| 4     | 4.2  | ⏸️ Pending | Frontend client            |

---

## Benefits Summary

✅ **Runtime Safety**: Catch API contract changes immediately
✅ **Type Safety**: Full TypeScript inference from schemas
✅ **Self-Documenting**: Schemas serve as living API docs
✅ **Incremental**: No big-bang migration risk
✅ **Testable**: Every schema has corresponding test coverage

---

## Next Steps

1. Review this plan and approve Phase 0 setup
2. Execute Phase 0 (boilerplate) in one batch
3. Proceed with Phase 1 step-by-step, awaiting approval after each checkpoint
4. Continue to Phase 2 once external APIs are validated
5. Optionally expand to Phase 3/4 based on project needs

