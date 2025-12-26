# Popup/JS Calculator Refactoring Implementation Plan

## Overview

Refactor the popup/ and js/ directories to create a testable, modular architecture that:
1. Separates input validation from calculation logic
2. Returns raw numbers instead of formatted strings
3. Provides clear error handling for invalid inputs
4. Is testable with Bun's test runner

**Approach**: Test-Driven Development (TDD) - write failing tests first, then implement to make them pass.

**Constraint**: Chrome extension using plain JavaScript with no build step. Must remain bundleable via zip with no transpilation.

## Current State Analysis

### Files to Modify/Create
| File                            | Action | Purpose                                         |
| ------------------------------- | ------ | ----------------------------------------------- |
| `js/calculator.js`              | Modify | Add `calculateRaw()` method, add module.exports |
| `js/inputValidator.js`          | Create | Pure validation functions                       |
| `js/mortgageService.js`         | Create | Orchestrates validation + calculation           |
| `tests/inputValidator.test.js`  | Create | Validation tests                                |
| `tests/calculator.test.js`      | Create | Calculator tests                                |
| `tests/mortgageService.test.js` | Create | Integration tests                               |
| `package.json`                  | Modify | Add bun test script                             |

### Key Discoveries
- `js/calculator.js:184-258` - `calculate()` method returns formatted strings, not numbers
- `js/calculator.js` has no module.exports - class is global
- No `tests/` directory exists at root level
- Root `package.json` has no test script configured
- `popup/popup.js:201-208` - Input parsing uses `parseFloat() || 0` pattern (silent fallback)

## Desired End State

After this plan is complete:
1. **Testable modules**: `inputValidator.js`, `calculator.js`, `mortgageService.js` all have comprehensive test coverage
2. **Raw data output**: Calculator returns numbers; UI handles formatting
3. **Explicit error handling**: Invalid inputs return structured error objects instead of silently defaulting to 0
4. **Clear separation**: Validation → Calculation → Formatting are distinct layers

### Verification
- `bun test` passes all tests
- Extension still works when loaded in Chrome (manual verification)
- Existing `calculate()` method continues to work (backwards compatibility)

## What We're NOT Doing

- Modifying `popup/popup.js` to use new modules (Phase 2 work)
- Modifying `railway-api/public/website.js` (Phase 3 work)
- Removing the existing `calculate()` method (backwards compatibility)
- Adding TypeScript or build steps
- Changing the extension manifest
- Adding real-time validation or debouncing

---

## Phase 1: Setup Test Infrastructure

### Overview
Configure Bun test runner and verify it works with a trivial test.

### Changes Required:

#### 1. Update `package.json`
**File**: `package.json`
**Changes**: Add test script

```json
{
  "name": "naca-app",
  "version": "1.0.0",
  "description": "This browser extension mimics the mortgage calculator available on the [NACA website](https://www.naca.com/mortgage-calculator/)...",
  "main": "popup/popup.js",
  "scripts": {
    "test": "bun test"
  },
  "author": "",
  "license": "ISC",
  "devDependencies": {
    "csv-parse": "^5.6.0",
    "http-server": "^14.1.1",
    "pg": "^8.14.1"
  }
}
```

#### 2. Create test directory and trivial test
**File**: `tests/setup.test.js`
**Changes**: Verify test infrastructure works

```javascript
import { describe, it, expect } from "bun:test";

describe("Test infrastructure", () => {
  it("should run tests successfully", () => {
    expect(1 + 1).toBe(2);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `bun test` runs and passes the trivial test

#### Manual Verification:
- [x] None required for this phase

---

## Phase 2: Add Tests for inputValidator (Failing)

### Overview
Write comprehensive tests for the input validator module. These tests will FAIL because the module doesn't exist yet.

### Changes Required:

#### 1. Create inputValidator tests
**File**: `tests/inputValidator.test.js`
**Changes**: Full test suite for validation functions

```javascript
import { describe, it, expect } from "bun:test";
import {
  validatePrice,
  validateMortgageRate,
  validatePropertyTax,
  validateNonNegative,
  validateCalculatorInput,
} from "../js/inputValidator.js";

describe("validatePrice", () => {
  it("accepts valid positive numbers", () => {
    const result = validatePrice("1500");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(1500);
  });

  it("accepts decimal numbers", () => {
    const result = validatePrice("1500.50");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(1500.5);
  });

  it("accepts zero", () => {
    const result = validatePrice("0");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(0);
  });

  it("trims whitespace", () => {
    const result = validatePrice("  1500  ");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(1500);
  });

  it("rejects empty string", () => {
    const result = validatePrice("");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("price");
    expect(result.errors[0].message).toBe("Required");
  });

  it("rejects whitespace-only string", () => {
    const result = validatePrice("   ");
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toBe("Required");
  });

  it("rejects non-numeric strings", () => {
    const result = validatePrice("abc");
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toBe("Must be a number");
  });

  it("rejects negative numbers", () => {
    const result = validatePrice("-100");
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toBe("Must be positive");
  });
});

describe("validateMortgageRate", () => {
  // Allowable rates passed as parameter (simulates API-fetched rates)
  const allowableRates = {
    "15": [4.625, 5.625],
    "20": [4.65, 5.65],
    "30": [5.125, 6.125],
  };

  it("accepts valid term and rate combination", () => {
    const result = validateMortgageRate("30", "5.125", allowableRates);
    expect(result.ok).toBe(true);
    expect(result.data.term).toBe(30);
    expect(result.data.rate).toBe(5.125);
  });

  it("accepts all valid rates for 15-year term", () => {
    expect(validateMortgageRate("15", "4.625", allowableRates).ok).toBe(true);
    expect(validateMortgageRate("15", "5.625", allowableRates).ok).toBe(true);
  });

  it("accepts all valid rates for 20-year term", () => {
    expect(validateMortgageRate("20", "4.65", allowableRates).ok).toBe(true);
    expect(validateMortgageRate("20", "5.65", allowableRates).ok).toBe(true);
  });

  it("accepts all valid rates for 30-year term", () => {
    expect(validateMortgageRate("30", "5.125", allowableRates).ok).toBe(true);
    expect(validateMortgageRate("30", "6.125", allowableRates).ok).toBe(true);
  });

  it("rejects invalid term", () => {
    const result = validateMortgageRate("25", "5.125", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("term");
    expect(result.errors[0].message).toBe("Invalid term. Must be 15, 20, or 30");
  });

  it("rejects rate not in allowable list for term", () => {
    const result = validateMortgageRate("30", "4.625", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("rate");
    expect(result.errors[0].message).toBe("Invalid rate for 30-year term");
  });

  it("rejects non-numeric term", () => {
    const result = validateMortgageRate("abc", "5.125", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("term");
  });

  it("rejects non-numeric rate", () => {
    const result = validateMortgageRate("30", "abc", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("rate");
    expect(result.errors[0].message).toBe("Rate must be a number");
  });

  it("rejects empty term", () => {
    const result = validateMortgageRate("", "5.125", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("term");
  });

  it("rejects empty rate", () => {
    const result = validateMortgageRate("30", "", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("rate");
  });

  it("handles rates with floating point precision", () => {
    // Ensure 5.125 matches even if passed as string
    const result = validateMortgageRate("30", "5.125", allowableRates);
    expect(result.ok).toBe(true);
    expect(result.data.rate).toBe(5.125);
  });
});

describe("validatePropertyTax", () => {
  // Property tax options: 5 to 30.5 in 0.5 increments
  it("accepts minimum valid tax (5)", () => {
    const result = validatePropertyTax("5");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(5);
  });

  it("accepts maximum valid tax (30.5)", () => {
    const result = validatePropertyTax("30.5");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(30.5);
  });

  it("accepts valid tax with 0.5 increment (15.5)", () => {
    const result = validatePropertyTax("15.5");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(15.5);
  });

  it("accepts whole number tax in range (10)", () => {
    const result = validatePropertyTax("10");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(10);
  });

  it("rejects tax below minimum", () => {
    const result = validatePropertyTax("4.5");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
    expect(result.errors[0].message).toBe("Invalid property tax rate");
  });

  it("rejects tax above maximum", () => {
    const result = validatePropertyTax("31");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
    expect(result.errors[0].message).toBe("Invalid property tax rate");
  });

  it("rejects tax not on 0.5 increment (7.3)", () => {
    const result = validatePropertyTax("7.3");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
    expect(result.errors[0].message).toBe("Invalid property tax rate");
  });

  it("rejects non-numeric tax", () => {
    const result = validatePropertyTax("abc");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
    expect(result.errors[0].message).toBe("Property tax must be a number");
  });

  it("rejects empty string", () => {
    const result = validatePropertyTax("");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
  });
});

describe("validateNonNegative", () => {
  it("accepts positive numbers", () => {
    const result = validateNonNegative("100", "tax");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(100);
  });

  it("accepts zero", () => {
    const result = validateNonNegative("0", "tax");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(0);
  });

  it("accepts decimals", () => {
    const result = validateNonNegative("15.50", "tax");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(15.5);
  });

  it("rejects negative numbers", () => {
    const result = validateNonNegative("-5", "tax");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
    expect(result.errors[0].message).toBe("Must be non-negative");
  });

  it("rejects non-numeric strings", () => {
    const result = validateNonNegative("abc", "insurance");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("insurance");
    expect(result.errors[0].message).toBe("Must be a number");
  });

  it("uses provided field name in errors", () => {
    const result = validateNonNegative("-1", "hoaFee");
    expect(result.errors[0].field).toBe("hoaFee");
  });
});

describe("validateCalculatorInput", () => {
  // Allowable rates passed as parameter (simulates API-fetched rates)
  const allowableRates = {
    "15": [4.625, 5.625],
    "20": [4.65, 5.65],
    "30": [5.125, 6.125],
  };

  const validInput = {
    price: "2000",
    term: "30",
    rate: "6.125",  // Must be a valid rate for term 30
    tax: "15",
    insurance: "50",
    hoaFee: "0",
    principalBuydown: "0",
  };

  it("accepts valid complete input", () => {
    const result = validateCalculatorInput(validInput, allowableRates);
    expect(result.ok).toBe(true);
    expect(result.data.price).toBe(2000);
    expect(result.data.term).toBe(30);
    expect(result.data.rate).toBe(6.125);
    expect(result.data.tax).toBe(15);
    expect(result.data.insurance).toBe(50);
    expect(result.data.hoaFee).toBe(0);
    expect(result.data.principalBuydown).toBe(0);
  });

  it("returns all validation errors at once", () => {
    const result = validateCalculatorInput({
      price: "",
      term: "25",        // invalid term
      rate: "invalid",   // invalid rate
      tax: "4",          // invalid (below 5)
      insurance: "50",
      hoaFee: "0",
      principalBuydown: "0",
    }, allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3); // price, term, tax at minimum
  });

  it("identifies which fields have errors", () => {
    const result = validateCalculatorInput({
      ...validInput,
      price: "",
      rate: "9.99",  // invalid rate for term 30
    }, allowableRates);
    const errorFields = result.errors.map((e) => e.field);
    expect(errorFields).toContain("price");
    expect(errorFields).toContain("rate");
    expect(errorFields).not.toContain("term");
  });

  it("handles missing fields gracefully", () => {
    const result = validateCalculatorInput({
      price: "1000",
      term: "30",
      rate: "6.125",
      // missing tax, insurance, hoaFee, principalBuydown
    }, allowableRates);
    expect(result.ok).toBe(false);
  });

  it("validates term and rate together", () => {
    // Valid rate for term 15, but using term 30
    const result = validateCalculatorInput({
      ...validInput,
      term: "30",
      rate: "4.625",  // Valid for 15-year, invalid for 30-year
    }, allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.field === "rate")).toBe(true);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `bun test tests/inputValidator.test.js` runs but FAILS (module not found)

#### Manual Verification:
- [x] None required for this phase

---

## Phase 3: Implement inputValidator (Make Tests Pass)

### Overview
Implement the input validator module to make all Phase 2 tests pass.

### Changes Required:

#### 1. Create inputValidator module
**File**: `js/inputValidator.js`
**Changes**: Pure validation functions with ES module exports

```javascript
/**
 * Input validation module for mortgage calculator
 * Pure functions with no DOM dependencies
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} field
 * @property {string} message
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} ok
 * @property {*} [data]
 * @property {ValidationError[]} [errors]
 */

/**
 * Validate and parse a price/payment value
 * @param {string} value
 * @returns {ValidationResult}
 */
export function validatePrice(value) {
  const trimmed = String(value).trim();
  if (trimmed === "") {
    return { ok: false, errors: [{ field: "price", message: "Required" }] };
  }
  const num = parseFloat(trimmed);
  if (isNaN(num)) {
    return { ok: false, errors: [{ field: "price", message: "Must be a number" }] };
  }
  if (num < 0) {
    return { ok: false, errors: [{ field: "price", message: "Must be positive" }] };
  }
  return { ok: true, data: num };
}

/**
 * Validate mortgage rate - validates term and rate together
 * A valid mortgage rate is a combination where:
 * 1. The term is one of the allowable terms (keys in allowableRates)
 * 2. The rate is one of the allowable rates for that specific term
 *
 * @param {string} termValue - The loan term as a string
 * @param {string} rateValue - The interest rate as a string
 * @param {Object} allowableRates - Mapping of term to array of valid rates
 *   Example: { "15": [4.625, 5.625], "20": [4.65, 5.65], "30": [5.125, 6.125] }
 * @returns {ValidationResult}
 */
export function validateMortgageRate(termValue, rateValue, allowableRates) {
  const errors = [];

  // Parse term
  const term = parseInt(termValue, 10);
  if (isNaN(term) || !allowableRates.hasOwnProperty(String(term))) {
    const validTerms = Object.keys(allowableRates).join(", ");
    errors.push({
      field: "term",
      message: `Invalid term. Must be ${validTerms.replace(/,([^,]*)$/, ", or$1")}`
    });
    // Can't validate rate without a valid term
    return { ok: false, errors };
  }

  // Parse rate
  const rate = parseFloat(rateValue);
  if (isNaN(rate)) {
    errors.push({ field: "rate", message: "Rate must be a number" });
    return { ok: false, errors };
  }

  // Check if rate is in the allowable list for this term
  const validRatesForTerm = allowableRates[String(term)];
  if (!validRatesForTerm.includes(rate)) {
    errors.push({
      field: "rate",
      message: `Invalid rate for ${term}-year term`
    });
    return { ok: false, errors };
  }

  return { ok: true, data: { term, rate } };
}

/**
 * Valid property tax rates: 5 to 30.5 in 0.5 increments
 * These match the hardcoded options in popup/popup.html
 */
const VALID_PROPERTY_TAX_RATES = [];
for (let i = 5; i <= 30.5; i += 0.5) {
  VALID_PROPERTY_TAX_RATES.push(Math.round(i * 10) / 10); // Avoid floating point issues
}

/**
 * Validate property tax rate
 * Must be one of the hardcoded options from popup.html (5 to 30.5 in 0.5 increments)
 *
 * @param {string} value - The property tax rate as a string
 * @returns {ValidationResult}
 */
export function validatePropertyTax(value) {
  const trimmed = String(value).trim();
  if (trimmed === "") {
    return { ok: false, errors: [{ field: "tax", message: "Required" }] };
  }

  const num = parseFloat(trimmed);
  if (isNaN(num)) {
    return { ok: false, errors: [{ field: "tax", message: "Property tax must be a number" }] };
  }

  // Check if rate is in the valid list
  const roundedNum = Math.round(num * 10) / 10; // Round to 1 decimal place for comparison
  if (!VALID_PROPERTY_TAX_RATES.includes(roundedNum)) {
    return { ok: false, errors: [{ field: "tax", message: "Invalid property tax rate" }] };
  }

  return { ok: true, data: num };
}

/**
 * Validate a non-negative number field
 * @param {string} value
 * @param {string} fieldName
 * @returns {ValidationResult}
 */
export function validateNonNegative(value, fieldName) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { ok: false, errors: [{ field: fieldName, message: "Must be a number" }] };
  }
  if (num < 0) {
    return { ok: false, errors: [{ field: fieldName, message: "Must be non-negative" }] };
  }
  return { ok: true, data: num };
}

/**
 * Validate all calculator inputs
 * Note: This function requires allowable mortgage rates to be passed in.
 * The rates are fetched from the API and passed through from the UI layer.
 *
 * @param {Object} raw - Raw input values (strings from form)
 * @param {Object} allowableRates - Mapping of term to array of valid rates
 *   Example: { "15": [4.625, 5.625], "20": [4.65, 5.65], "30": [5.125, 6.125] }
 * @returns {ValidationResult}
 */
export function validateCalculatorInput(raw, allowableRates) {
  const errors = [];
  const data = {};

  // Validate price
  const priceResult = validatePrice(raw.price);
  if (!priceResult.ok) errors.push(...priceResult.errors);
  else data.price = priceResult.data;

  // Validate term and rate together (they are interdependent)
  const mortgageRateResult = validateMortgageRate(raw.term, raw.rate, allowableRates);
  if (!mortgageRateResult.ok) {
    errors.push(...mortgageRateResult.errors);
  } else {
    data.term = mortgageRateResult.data.term;
    data.rate = mortgageRateResult.data.rate;
  }

  // Validate tax (using hardcoded property tax options)
  if (raw.tax === undefined || raw.tax === null) {
    errors.push({ field: "tax", message: "Required" });
  } else {
    const taxResult = validatePropertyTax(String(raw.tax));
    if (!taxResult.ok) errors.push(...taxResult.errors);
    else data.tax = taxResult.data;
  }

  // Validate insurance (required field)
  if (raw.insurance === undefined || raw.insurance === null) {
    errors.push({ field: "insurance", message: "Required" });
  } else {
    const insuranceResult = validateNonNegative(String(raw.insurance), "insurance");
    if (!insuranceResult.ok) errors.push(...insuranceResult.errors);
    else data.insurance = insuranceResult.data;
  }

  // Validate hoaFee (required field)
  if (raw.hoaFee === undefined || raw.hoaFee === null) {
    errors.push({ field: "hoaFee", message: "Required" });
  } else {
    const hoaResult = validateNonNegative(String(raw.hoaFee), "hoaFee");
    if (!hoaResult.ok) errors.push(...hoaResult.errors);
    else data.hoaFee = hoaResult.data;
  }

  // Validate principalBuydown (required field)
  if (raw.principalBuydown === undefined || raw.principalBuydown === null) {
    errors.push({ field: "principalBuydown", message: "Required" });
  } else {
    const buydownResult = validateNonNegative(String(raw.principalBuydown), "principalBuydown");
    if (!buydownResult.ok) errors.push(...buydownResult.errors);
    else data.principalBuydown = buydownResult.data;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data };
}
```

### Success Criteria:

#### Automated Verification:
- [x] `bun test tests/inputValidator.test.js` passes all tests

#### Manual Verification:
- [x] None required for this phase

---

## Phase 4: Add Tests for Calculator.calculateRaw (Failing)

### Overview
Write tests for the new `calculateRaw()` method on MortgageCalculator. These tests will FAIL because the method doesn't exist yet.

### Changes Required:

#### 1. Create calculator tests
**File**: `tests/calculator.test.js`
**Changes**: Tests for calculateRaw and existing methods

```javascript
import { describe, it, expect, beforeEach } from "bun:test";
import { MortgageCalculator } from "../js/calculator.js";

describe("MortgageCalculator", () => {
  let calculator;

  beforeEach(() => {
    calculator = new MortgageCalculator();
  });

  describe("calculateBaseMonthlyPayment", () => {
    it("calculates correct P&I for standard mortgage", () => {
      // $300,000 at 6.5% for 30 years
      const payment = calculator.calculateBaseMonthlyPayment(300000, 6.5, 30);
      // Expected: ~$1,896.20
      expect(payment).toBeCloseTo(1896.2, 0);
    });

    it("calculates correct P&I for 15-year mortgage", () => {
      // $300,000 at 6.0% for 15 years
      const payment = calculator.calculateBaseMonthlyPayment(300000, 6.0, 15);
      // Expected: ~$2,531.57
      expect(payment).toBeCloseTo(2531.57, 0);
    });

    it("returns 0 for 0% interest rate", () => {
      // At 0% interest, monthly payment is just principal / months
      const payment = calculator.calculateBaseMonthlyPayment(360000, 0, 30);
      expect(payment).toBeCloseTo(1000, 0);
    });
  });

  describe("calculateMonthlyTax", () => {
    it("calculates monthly tax from annual rate per $1000", () => {
      // $300,000 at $15 per $1000 = $4,500/year = $375/month
      const tax = calculator.calculateMonthlyTax(300000, 15);
      expect(tax).toBe(375);
    });

    it("rounds to whole number", () => {
      // $250,000 at $12 per $1000 = $3,000/year = $250/month
      const tax = calculator.calculateMonthlyTax(250000, 12);
      expect(tax).toBe(250);
    });
  });

  describe("calculateInterestRateBuydown", () => {
    it("calculates buydown cost correctly for 30-year", () => {
      // 1 point = 1/6% reduction for 30 year
      // 0.5% reduction = 3 points = 3% of $300k = $9000
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 6.0, 30);
      expect(cost).toBeCloseTo(9000, 0);
    });

    it("calculates buydown cost correctly for 15-year", () => {
      // 1 point = 1/4% reduction for 15 year
      // 0.5% reduction = 2 points = 2% of $300k = $6000
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 6.0, 15);
      expect(cost).toBeCloseTo(6000, 0);
    });

    it("enforces 1.5% max buydown", () => {
      // Try to buy down 2% (beyond the 1.5% cap)
      // Should only charge for 1.5% buydown
      // 1.5% = 9 points = 9% of $300k = $27000
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 4.5, 30);
      expect(cost).toBeCloseTo(27000, 0);
    });

    it("returns 0 when desired rate >= current rate", () => {
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 7.0, 30);
      expect(cost).toBe(0);
    });

    it("returns 0 for invalid principal", () => {
      expect(calculator.calculateInterestRateBuydown(0, 6.5, 6.0, 30)).toBe(0);
      expect(calculator.calculateInterestRateBuydown(-1000, 6.5, 6.0, 30)).toBe(0);
      expect(calculator.calculateInterestRateBuydown(NaN, 6.5, 6.0, 30)).toBe(0);
    });
  });

  describe("calculateRaw - price mode", () => {
    beforeEach(() => {
      calculator.setCalcMethod("price");
    });

    it("calculates monthly payment for given purchase price", () => {
      const result = calculator.calculateRaw({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(result.purchasePrice).toBe(300000);
      expect(typeof result.monthlyPayment).toBe("number");
      expect(result.monthlyPayment).toBeGreaterThan(2000);
      expect(result.monthlyPayment).toBeLessThan(2500);
      expect(result.insurance).toBe(50);
      expect(result.hoaFee).toBe(0);
    });

    it("returns raw numbers, not formatted strings", () => {
      const result = calculator.calculateRaw({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(typeof result.monthlyPayment).toBe("number");
      expect(typeof result.purchasePrice).toBe("number");
      expect(typeof result.principalInterest).toBe("number");
      expect(typeof result.taxes).toBe("number");
    });

    it("accounts for principal buydown", () => {
      const withoutBuydown = calculator.calculateRaw({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      const withBuydown = calculator.calculateRaw({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 50000,
      });

      expect(withBuydown.monthlyPayment).toBeLessThan(withoutBuydown.monthlyPayment);
    });

    it("includes all PITI components", () => {
      const result = calculator.calculateRaw({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 100,
        principalBuydown: 0,
      });

      const expectedTotal =
        result.principalInterest + result.taxes + result.insurance + result.hoaFee;
      expect(result.monthlyPayment).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe("calculateRaw - payment mode", () => {
    beforeEach(() => {
      calculator.setCalcMethod("payment");
    });

    it("calculates max purchase price for desired payment", () => {
      const result = calculator.calculateRaw({
        price: 2000, // desired monthly payment
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(result.monthlyPayment).toBe(2000);
      expect(typeof result.purchasePrice).toBe("number");
      expect(result.purchasePrice).toBeGreaterThan(200000);
      expect(result.purchasePrice).toBeLessThan(350000);
    });

    it("returns the desired payment as monthlyPayment", () => {
      const result = calculator.calculateRaw({
        price: 1500,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(result.monthlyPayment).toBe(1500);
    });

    it("accounts for principal buydown in price calculation", () => {
      const withoutBuydown = calculator.calculateRaw({
        price: 2000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      const withBuydown = calculator.calculateRaw({
        price: 2000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 50000,
      });

      // With buydown, can afford higher purchase price for same payment
      expect(withBuydown.purchasePrice).toBeGreaterThan(withoutBuydown.purchasePrice);
    });
  });

  describe("existing calculate method - backwards compatibility", () => {
    it("still returns formatted strings", () => {
      calculator.setCalcMethod("price");
      const result = calculator.calculate({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(typeof result.monthlyPayment).toBe("string");
      expect(result.monthlyPayment).toContain("$");
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `bun test tests/calculator.test.js` runs but FAILS (module export not found - expected before Phase 5)
- [x] Other tests (calculateBaseMonthlyPayment, etc.) cannot run yet - export needed first

#### Manual Verification:
- [x] None required for this phase

---

## Phase 5: Implement Calculator.calculateRaw (Make Tests Pass)

### Overview
Add the `calculateRaw()` method to MortgageCalculator and add ES module export.

### Changes Required:

#### 1. Modify calculator.js
**File**: `js/calculator.js`
**Changes**: Add calculateRaw method and export

Add this method before the closing brace of the class (after line 257):

```javascript
  /**
   * Calculate mortgage details and return raw numbers (not formatted strings)
   * @param {Object} inputs - Validated input object
   * @returns {Object} Raw numeric results
   */
  calculateRaw(inputs) {
    const {
      price,
      term,
      rate,
      tax,
      insurance,
      hoaFee,
      principalBuydown = 0,
    } = inputs;

    if (this.calcMethod === "payment") {
      const desiredMonthlyPayment = price;

      const purchasePrice = this.calculateMaxPurchasePrice(
        desiredMonthlyPayment,
        rate,
        term,
        tax,
        insurance,
        hoaFee,
        principalBuydown,
      );

      const principal = purchasePrice - principalBuydown;
      const principalInterest = this.calculateBaseMonthlyPayment(
        principal > 0 ? principal : 0,
        rate,
        term,
      );

      const monthlyTax = this.calculateMonthlyTax(purchasePrice, tax);

      return {
        monthlyPayment: desiredMonthlyPayment,
        purchasePrice: purchasePrice,
        principalInterest: principalInterest,
        taxes: monthlyTax,
        insurance: insurance,
        hoaFee: hoaFee,
      };
    } else {
      // calcMethod === 'price'
      const purchasePrice = price;
      const principal = purchasePrice - principalBuydown;

      const principalInterest = this.calculateBaseMonthlyPayment(
        principal > 0 ? principal : 0,
        rate,
        term,
      );

      const monthlyTax = this.calculateMonthlyTax(purchasePrice, tax);
      const totalMonthlyPayment = principalInterest + monthlyTax + insurance + hoaFee;

      return {
        monthlyPayment: totalMonthlyPayment,
        purchasePrice: purchasePrice,
        principalInterest: principalInterest,
        taxes: monthlyTax,
        insurance: insurance,
        hoaFee: hoaFee,
      };
    }
  }
```

Add this at the end of the file (after the class closing brace):

```javascript
// ES module export for testing (ignored by browser when loaded via script tag)
export { MortgageCalculator };
```

### Success Criteria:

#### Automated Verification:
- [x] `bun test tests/calculator.test.js` passes all tests

#### Manual Verification:
- [x] None required for this phase

---

## Phase 6: Add Tests for mortgageService (Failing)

### Overview
Write tests for the mortgage service module that orchestrates validation and calculation. These tests will FAIL because the module doesn't exist yet.

### Changes Required:

#### 1. Create mortgageService tests
**File**: `tests/mortgageService.test.js`
**Changes**: Integration tests for the service

```javascript
import { describe, it, expect } from "bun:test";
import { calculateMortgage, formatCurrency } from "../js/mortgageService.js";

describe("calculateMortgage", () => {
  // Allowable rates passed as parameter (simulates API-fetched rates)
  const allowableRates = {
    "15": [4.625, 5.625],
    "20": [4.65, 5.65],
    "30": [5.125, 6.125],
  };

  it("returns validation errors for invalid input", () => {
    const result = calculateMortgage(
      {
        price: "",
        term: "30",
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors[0].field).toBe("price");
  });

  it("returns calculated results for valid input", () => {
    const result = calculateMortgage(
      {
        price: "300000",
        term: "30",
        rate: "6.125",  // Valid rate for 30-year
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.purchasePrice).toBe(300000);
    expect(typeof result.data.monthlyPayment).toBe("number");
  });

  it("respects calcMethod parameter - price mode", () => {
    const result = calculateMortgage(
      {
        price: "300000",
        term: "30",
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    expect(result.data.purchasePrice).toBe(300000);
    // Monthly payment should be calculated
    expect(result.data.monthlyPayment).toBeGreaterThan(2000);
  });

  it("respects calcMethod parameter - payment mode", () => {
    const result = calculateMortgage(
      {
        price: "2000",
        term: "30",
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "payment",
      allowableRates
    );

    expect(result.data.monthlyPayment).toBe(2000);
    // Purchase price should be calculated
    expect(result.data.purchasePrice).toBeGreaterThan(200000);
  });

  it("returns all errors for multiple invalid fields", () => {
    const result = calculateMortgage(
      {
        price: "",
        term: "25",        // invalid term
        rate: "abc",       // invalid rate
        tax: "4",          // invalid (below 5)
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3); // price, term, tax at minimum
  });

  it("handles principal buydown correctly", () => {
    const withoutBuydown = calculateMortgage(
      {
        price: "300000",
        term: "30",
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    const withBuydown = calculateMortgage(
      {
        price: "300000",
        term: "30",
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "50000",
      },
      "price",
      allowableRates
    );

    expect(withBuydown.data.monthlyPayment).toBeLessThan(
      withoutBuydown.data.monthlyPayment
    );
  });

  it("rejects rate not valid for the specified term", () => {
    const result = calculateMortgage(
      {
        price: "300000",
        term: "30",
        rate: "4.625",  // Valid for 15-year, invalid for 30-year
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.field === "rate")).toBe(true);
  });
});

describe("formatCurrency", () => {
  it("formats numbers as currency", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("adds commas for thousands", () => {
    expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
  });

  it("handles whole numbers", () => {
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("returns empty string for NaN", () => {
    expect(formatCurrency(NaN)).toBe("");
  });

  it("respects decimal parameter", () => {
    expect(formatCurrency(1234.5678, 0)).toBe("$1,235");
    expect(formatCurrency(1234.5678, 3)).toBe("$1,234.568");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles negative numbers", () => {
    expect(formatCurrency(-1234.56)).toBe("$-1,234.56");
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `bun test tests/mortgageService.test.js` runs but FAILS (module not found)

#### Manual Verification:
- [x] None required for this phase

---

## Phase 7: Implement mortgageService (Make Tests Pass)

### Overview
Implement the mortgage service module that orchestrates validation and calculation.

### Changes Required:

#### 1. Create mortgageService module
**File**: `js/mortgageService.js`
**Changes**: Service layer that combines validation and calculation

```javascript
/**
 * Mortgage Service - Single entry point for mortgage calculations
 * Orchestrates validation and calculation
 */

import { validateCalculatorInput } from "./inputValidator.js";
import { MortgageCalculator } from "./calculator.js";

/**
 * Single entry point for mortgage calculations
 * @param {Object} rawInput - Raw string values from form
 * @param {string} calcMethod - 'payment' or 'price'
 * @param {Object} allowableRates - Mapping of term to array of valid rates
 *   Example: { "15": [4.625, 5.625], "20": [4.65, 5.65], "30": [5.125, 6.125] }
 * @returns {Object} - { ok: boolean, data?: Object, errors?: Array }
 */
export function calculateMortgage(rawInput, calcMethod, allowableRates) {
  // 1. Validate (pass allowable rates for term/rate validation)
  const validation = validateCalculatorInput(rawInput, allowableRates);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  // 2. Calculate
  const calculator = new MortgageCalculator();
  calculator.setCalcMethod(calcMethod);

  const result = calculator.calculateRaw(validation.data);

  // 3. Return raw numbers (UI formats them)
  return { ok: true, data: result };
}

/**
 * Format a number as currency
 * @param {number} num
 * @param {number} decimals
 * @returns {string}
 */
export function formatCurrency(num, decimals = 2) {
  if (isNaN(num)) return "";
  return (
    "$" +
    num
      .toFixed(decimals)
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
  );
}
```

### Success Criteria:

#### Automated Verification:
- [x] `bun test tests/mortgageService.test.js` passes all tests

#### Manual Verification:
- [x] None required for this phase

---

## Phase 8: Run Full Test Suite and Verify Extension

### Overview
Run all tests and verify the extension still works in Chrome.

### Changes Required:

None - this is a verification phase.

### Success Criteria:

#### Automated Verification:
- [x] `bun test` passes all tests in all test files (93 tests across 9 files)
- [ ] No console errors when loading extension in Chrome

#### Manual Verification:
- [ ] Load extension in Chrome developer mode
- [ ] Open extension popup
- [ ] Enter test values and click Calculate
- [ ] Verify results display correctly
- [ ] Test both "payment" and "price" calculation modes
- [ ] Test interest rate buydown slider
- [ ] Test principal buydown slider

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before the refactoring is considered complete.

---

## Testing Strategy

### Test Runner
Bun's built-in test runner with ES module imports.

### Running Tests
```bash
# Run all tests
bun test

# Run specific test file
bun test tests/inputValidator.test.js

# Watch mode
bun test --watch
```

### Test Categories

1. **Unit Tests** (inputValidator.test.js):
   - Individual validation functions
   - Edge cases (empty, whitespace, negative, NaN)
   - Error message correctness

2. **Unit Tests** (calculator.test.js):
   - Core calculation methods
   - Both calculation modes
   - Buydown calculations
   - Backwards compatibility

3. **Integration Tests** (mortgageService.test.js):
   - End-to-end validation + calculation
   - Error propagation
   - Result structure

---

## Migration Path for Future Work

### Phase 2 (Future): Migrate Popup.js
- Replace event handlers to use `calculateMortgage()`
- Move formatting to UI layer using `formatCurrency()`
- Add error display handling to UI
- Not included in this plan

### Phase 3 (Future): Consolidate Website
- Apply same changes to `railway-api/public/website.js`
- Share modules between extension and website
- Not included in this plan

---

## References

- Research document: `orchestration/shared/research/2025-12-25-popup-calculator-refactoring.md`
- Current calculator: `js/calculator.js:184-258`
- Current popup: `popup/popup.js:200-214`
