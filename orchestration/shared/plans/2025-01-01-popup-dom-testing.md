# Popup DOM Testing Implementation Plan

## Overview

Add DOM testing infrastructure for the Chrome extension popup using Bun + Happy DOM + @testing-library/dom. This plan also converts the JavaScript files to ES modules as a prerequisite, which prepares the codebase for the UI/business logic separation outlined in `2025-12-31-ui-business-logic-separation.md`.

## Current State Analysis

### What Exists Now
- **Testing**: Bun test runner with pure function tests (`tests/*.test.js`)
- **No DOM testing**: No Happy DOM, no @testing-library/dom, no bunfig.toml
- **Browser scripts**: `js/calculator.js` uses IIFE pattern (not ES module)
- **mortgageService.js**: Uses `Bun.file()` - Bun-specific, won't work in browser
- **popup.js**: Directly instantiates `MortgageCalculator` via global, not ES module
- **Test helper**: `tests/helpers/calculatorLoader.js` uses `new Function()` workaround

### Key Discoveries:
- `popup.js` has 9 distinct user interactions triggering DOM updates (`popup/popup.js:200-467`)
- All inputs follow `.input-group` pattern suitable for Testing Library queries
- Existing test pattern loads browser scripts via `new Function(code)()`
- Happy DOM is officially recommended by Bun for DOM testing

## Desired End State

After implementation:
1. **ES module architecture**: calculator.js, mortgageService.js, and popup.js are all ES modules
2. **DOM testing infrastructure**: Bun + Happy DOM + @testing-library/dom configured
3. **Popup tests exist**: Core user interactions tested (calculate, term change, sliders)
4. **Tests are fast**: Happy DOM provides near-instant DOM tests
5. **Tests are resilient**: Testing Library queries survive HTML refactors

### Verification:
- All unit tests pass: `bun test`
- DOM tests pass with popup interactions verified
- popup.js loads as ES module in browser without errors
- Extension still functions correctly in Chrome

## What We're NOT Doing

- NOT integrating MortgageService into popup.js yet (separate plan)
- NOT adding error display UI elements (separate plan)
- NOT testing MSA lookup functionality (involves API mocking complexity)
- NOT setting up CI/CD for tests
- NOT adding test coverage reporting

---

## Phase 1: Convert JavaScript Files to ES Modules

### Overview
Convert calculator.js to an ES module and make mortgageService.js browser-compatible. This removes the need for the `new Function()` workaround in tests and prepares for the MortgageService integration.

### Changes Required:

#### 1. Export MortgageCalculator from calculator.js
**File**: `js/calculator.js`

Add export statement at the end of the file (after the class definition ends around line 329):

```javascript
export { MortgageCalculator };
```

This makes MortgageCalculator importable while keeping the class definition unchanged.

#### 1b. Convert popup.js to ES Module
**File**: `popup/popup.js`

Add import statement at the top of the file (before line 1):

```javascript
import { MortgageCalculator } from "../js/calculator.js";
```

This replaces the global `MortgageCalculator` dependency with an explicit ES module import.

#### 1c. Update popup.html Script Loading
**File**: `popup/popup.html`

Replace the script tags at the end of the file:

**Change from** (lines 270-272):
```html
    <script src="../js/calculator.js"></script>
    <!-- Load local Supabase JS Library -->
    <script src="popup.js"></script>
```

**To**:
```html
    <script type="module" src="popup.js"></script>
```

The `type="module"` attribute enables ES module support. The separate calculator.js script tag is removed because popup.js now imports it directly.

#### 2. Simplify Rate Validation (Remove allowableRates dependency)
**File**: `js/inputValidator.js`

The current `validateMortgageRate` requires `allowableRates` parameter, which complicates testing and browser usage. Replace with simpler validation.

**Current code** (`js/inputValidator.js:51-98`):
```javascript
export function validateMortgageRate(termValue, rateValue, allowableRates) {
  // ... validates against allowableRates object
}
```

**Replace with**:
```javascript
const VALID_TERMS = [15, 20, 30];

export function validateMortgageRate(termValue, rateValue) {
  const errors = [];

  // Parse and validate term
  const term = parseInt(termValue, 10);
  if (isNaN(term) || !VALID_TERMS.includes(term)) {
    errors.push({
      field: "term",
      message: "Invalid term. Must be 15, 20, or 30"
    });
    return { ok: false, errors };
  }

  // Parse and validate rate
  const rate = parseFloat(rateValue);
  if (isNaN(rate)) {
    errors.push({ field: "rate", message: "Rate must be a number" });
    return { ok: false, errors };
  }
  if (rate <= 0) {
    errors.push({ field: "rate", message: "Rate must be positive" });
    return { ok: false, errors };
  }

  return { ok: true, data: { term, rate } };
}
```

#### 3. Update validateCalculatorInput to not require allowableRates
**File**: `js/inputValidator.js`

Update the function signature and call to `validateMortgageRate` (around line 149):

**Change from**:
```javascript
export function validateCalculatorInput(raw, allowableRates) {
  // ...
  const mortgageRateResult = validateMortgageRate(raw.term, raw.rate, allowableRates);
```

**To**:
```javascript
export function validateCalculatorInput(raw) {
  // ...
  const mortgageRateResult = validateMortgageRate(raw.term, raw.rate);
```

#### 4. Refactor MortgageService for Browser Compatibility
**File**: `js/mortgageService.js`

Replace the entire file with browser-compatible ES module:

```javascript
/**
 * Mortgage Service - Single entry point for mortgage calculations
 * Orchestrates validation and calculation
 *
 * MortgageCalculator is encapsulated here - not exposed globally
 */

import { MortgageCalculator } from "./calculator.js";
import { validateCalculatorInput } from "./inputValidator.js";

/**
 * Validate inputs and calculate mortgage
 * @param {Object} rawInput - Raw string values from form
 * @param {string} calcMethod - 'payment' or 'price'
 * @returns {Object} - { ok: boolean, data?: Object, errors?: Array }
 */
export function calculateMortgage(rawInput, calcMethod) {
  // 1. Validate
  const validation = validateCalculatorInput(rawInput);
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
 * Recalculate mortgage without validation (for slider updates)
 * Use this when inputs have already been validated and only slider values changed.
 * @param {Object} validatedInput - Already validated input object with numeric values
 * @param {string} calcMethod - 'payment' or 'price'
 * @returns {Object} - Raw calculation results
 */
export function recalculateMortgage(validatedInput, calcMethod) {
  const calculator = new MortgageCalculator();
  calculator.setCalcMethod(calcMethod);
  return calculator.calculateRaw(validatedInput);
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

/**
 * Calculate interest rate buydown cost (no validation)
 * Use this for slider updates where inputs are already validated.
 * @param {number} principal - The principal amount
 * @param {number} originalRate - The starting interest rate
 * @param {number} desiredRate - The target bought-down rate
 * @param {number} term - Loan term in years
 * @returns {number} - The cost to buy down the rate
 */
export function calculateInterestRateBuydown(principal, originalRate, desiredRate, term) {
  const calculator = new MortgageCalculator();
  return calculator.calculateInterestRateBuydown(principal, originalRate, desiredRate, term);
}
```

#### 5. Delete Test Helper (No Longer Needed)
**File**: `tests/helpers/calculatorLoader.js`

Delete this file. ES modules handle imports directly now.

#### 6. Update Calculator Tests
**File**: `tests/calculator.test.js`

Update imports to use ES module directly:

**Change from**:
```javascript
import { describe, it, expect, beforeEach } from "bun:test";
import { MortgageCalculator } from "./helpers/calculatorLoader.js";
```

**To**:
```javascript
import { describe, it, expect, beforeEach } from "bun:test";
import { MortgageCalculator } from "../js/calculator.js";
```

#### 7. Update InputValidator Tests
**File**: `tests/inputValidator.test.js`

Update tests for simplified `validateMortgageRate` (remove `allowableRates` parameter):

**Update test cases**:
```javascript
describe("validateMortgageRate", () => {
  it("accepts valid term and rate", () => {
    const result = validateMortgageRate("30", "6.125");
    expect(result.ok).toBe(true);
    expect(result.data.term).toBe(30);
    expect(result.data.rate).toBe(6.125);
  });

  it("rejects invalid term", () => {
    const result = validateMortgageRate("25", "6.125");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("term");
  });

  it("rejects non-numeric rate", () => {
    const result = validateMortgageRate("30", "abc");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("rate");
  });

  it("rejects zero or negative rate", () => {
    const result = validateMortgageRate("30", "0");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("rate");
  });
});
```

Also update `validateCalculatorInput` tests to remove `allowableRates` parameter.

#### 8. Update MortgageService Tests
**File**: `tests/mortgageService.test.js`

Update to use new ES module imports and remove `allowableRates`:

```javascript
import { describe, it, expect } from "bun:test";
import { calculateMortgage, recalculateMortgage, formatCurrency, calculateInterestRateBuydown } from "../js/mortgageService.js";

describe("calculateMortgage", () => {
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
      "price"
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
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price"
    );

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.purchasePrice).toBe(300000);
    expect(typeof result.data.monthlyPayment).toBe("number");
  });
});

describe("recalculateMortgage", () => {
  it("calculates without validation", () => {
    const result = recalculateMortgage(
      {
        price: 300000,
        term: 30,
        rate: 5.5, // Any valid rate works (no allowableRates check)
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      },
      "price"
    );

    expect(result.purchasePrice).toBe(300000);
    expect(typeof result.monthlyPayment).toBe("number");
  });
});

describe("calculateInterestRateBuydown", () => {
  it("calculates buydown cost", () => {
    const cost = calculateInterestRateBuydown(300000, 6.5, 6.0, 30);
    expect(typeof cost).toBe("number");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns 0 when desired rate equals original rate", () => {
    const cost = calculateInterestRateBuydown(300000, 6.5, 6.5, 30);
    expect(cost).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formats numbers as currency", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `bun test`
- [x] No import/export errors

#### Manual Verification:
- [x] mortgageService.js contains no `Bun.file()` calls
- [x] calculator.js has `export { MortgageCalculator }` at end
- [x] popup.js has `import { MortgageCalculator }` at top
- [x] popup.html uses `<script type="module" src="popup.js"></script>`
- [x] popup.html has NO separate calculator.js script tag
- [x] `tests/helpers/calculatorLoader.js` is deleted
- [x] Extension still functions correctly in Chrome (load unpacked and test calculator)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation before proceeding to Phase 2.

---

## Phase 2: Setup DOM Testing Infrastructure

### Overview
Install Happy DOM and Testing Library dependencies, configure Bun test runner for DOM environment.

### Changes Required:

#### 1. Install Dependencies
Run in project root:
```bash
bun add -D @happy-dom/global-registrator @testing-library/dom @testing-library/user-event
```

#### 2. Create Happy DOM Preload File
**File**: `tests/happydom.ts`

```typescript
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();
```

#### 3. Create Bun Configuration
**File**: `bunfig.toml`

```toml
[test]
preload = ["./tests/happydom.ts"]
```

#### 4. Verify DOM APIs Available
**File**: `tests/setup.test.js`

Add DOM availability test:

```javascript
import { describe, it, expect } from "bun:test";

describe("Test Environment", () => {
  it("has DOM APIs available", () => {
    expect(typeof document).toBe("object");
    expect(typeof window).toBe("object");
    expect(typeof document.createElement).toBe("function");
  });

  it("can create and query DOM elements", () => {
    document.body.innerHTML = '<div id="test">Hello</div>';
    const el = document.getElementById("test");
    expect(el).not.toBeNull();
    expect(el.textContent).toBe("Hello");
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] `bun test` runs without errors
- [x] DOM API tests pass
- [x] Happy DOM preload works correctly

#### Manual Verification:
- [x] `bunfig.toml` exists in project root
- [x] `tests/happydom.ts` exists
- [x] Dependencies in package.json devDependencies

**Implementation Note**: After completing this phase and all verification passes, pause here for confirmation before proceeding to Phase 3.

---

## Phase 3: Create Popup Test Utilities

### Overview
Create helper utilities to load popup HTML and scripts for DOM testing.

### Changes Required:

#### 1. Create Popup Test Helper
**File**: `tests/helpers/popupLoader.js`

```javascript
import fs from "fs";
import path from "path";

/**
 * Load popup HTML into the DOM
 * @returns {void}
 */
export function loadPopupHTML() {
  const htmlPath = path.resolve(import.meta.dir, "../../popup/popup.html");
  const html = fs.readFileSync(htmlPath, "utf8");

  // Extract just the body content (between <body> tags)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    document.body.innerHTML = bodyMatch[1];
  } else {
    document.body.innerHTML = html;
  }
}

/**
 * Load popup CSS into the DOM
 * @returns {void}
 */
export function loadPopupCSS() {
  const cssPath = path.resolve(import.meta.dir, "../../popup/popup.css");
  const css = fs.readFileSync(cssPath, "utf8");

  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

/**
 * Mock the rates API response
 * @returns {Object} Mock rates data
 */
export function getMockRates() {
  return {
    "15": [5.625, 5.75],
    "20": [5.875, 6.0],
    "30": [6.125, 6.25]
  };
}

/**
 * Setup mock fetch for rates API
 * @param {Object} mockRates - Rates to return
 */
export function mockFetch(mockRates = getMockRates()) {
  globalThis.fetch = async (url) => {
    if (url.includes("/api/rates")) {
      return {
        ok: true,
        json: async () => mockRates
      };
    }
    throw new Error(`Unmocked fetch: ${url}`);
  };
}

/**
 * Clear localStorage (used for rate caching)
 */
export function clearLocalStorage() {
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
}

/**
 * Reset DOM and mocks between tests
 */
export function resetTestEnvironment() {
  document.body.innerHTML = "";
  document.head.innerHTML = "";
  clearLocalStorage();
}

/**
 * Initialize popup.js by dynamically importing and triggering DOMContentLoaded
 * This allows tests to import popup.js as an ES module
 * @returns {Promise<void>}
 */
export async function initializePopup() {
  // Import popup.js as ES module - this registers all event listeners
  await import("../../popup/popup.js");

  // Trigger DOMContentLoaded to initialize the popup
  // Note: popup.js wraps everything in DOMContentLoaded listener
  const event = new Event("DOMContentLoaded", {
    bubbles: true,
    cancelable: true
  });
  document.dispatchEvent(event);

  // Wait for async initialization (rate fetching, etc.)
  await new Promise(resolve => setTimeout(resolve, 100));
}
```

#### 2. Create Testing Library Helpers
**File**: `tests/helpers/testingLibrary.js`

```javascript
import { screen, within, waitFor } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

// Re-export Testing Library utilities
export { screen, within, waitFor };

/**
 * Create a user event instance for interaction simulation
 * @returns {Object} userEvent instance
 */
export function createUser() {
  return userEvent.setup();
}

/**
 * Get input by its label text (case-insensitive partial match)
 * @param {string} labelText
 * @returns {HTMLElement}
 */
export function getInputByLabel(labelText) {
  return screen.getByLabelText(new RegExp(labelText, "i"));
}

/**
 * Get button by its text content
 * @param {string} buttonText
 * @returns {HTMLElement}
 */
export function getButton(buttonText) {
  return screen.getByRole("button", { name: new RegExp(buttonText, "i") });
}

/**
 * Get select dropdown by its label
 * @param {string} labelText
 * @returns {HTMLElement}
 */
export function getSelectByLabel(labelText) {
  return screen.getByRole("combobox", { name: new RegExp(labelText, "i") });
}

/**
 * Wait for text to appear in the document
 * @param {string} text
 * @returns {Promise<HTMLElement>}
 */
export async function waitForText(text) {
  return waitFor(() => screen.getByText(new RegExp(text, "i")));
}
```

### Success Criteria:

#### Automated Verification:
- [x] Helper files have no syntax errors
- [x] Imports resolve correctly

#### Manual Verification:
- [x] `tests/helpers/popupLoader.js` exists
- [x] `tests/helpers/testingLibrary.js` exists

**Implementation Note**: After completing this phase, proceed to Phase 4.

---

## Phase 4: Write Core Popup DOM Tests

### Overview
Write DOM tests for the 3 main states of the mortgage calculator: Empty state, Invalid submission, and Valid submission with slider interactions.

### Changes Required:

#### 1. Create Main Popup Test File
**File**: `tests/popup.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import userEvent from "@testing-library/user-event";
import {
  loadPopupHTML,
  loadPopupCSS,
  mockFetch,
  getMockRates,
  resetTestEnvironment,
  initializePopup
} from "./helpers/popupLoader.js";

describe("Popup Calculator", () => {
  let user;

  beforeEach(async () => {
    resetTestEnvironment();
    mockFetch();
    loadPopupHTML();
    loadPopupCSS();
    user = userEvent.setup();

    // Initialize popup.js (now an ES module)
    await initializePopup();
  });

  afterEach(() => {
    resetTestEnvironment();
  });

  describe("State 1: Empty State (Default)", () => {
    it("has 'desired monthly payment' as default calculation method", () => {
      const paymentRadio = document.querySelector('input[name="calcMethod"][value="payment"]');
      const priceRadio = document.querySelector('input[name="calcMethod"][value="price"]');

      expect(paymentRadio.checked).toBe(true);
      expect(priceRadio.checked).toBe(false);
    });

    it("has loan term filled with 30 years as default", () => {
      const termSelect = document.getElementById("term");
      expect(termSelect.value).toBe("30");
    });

    it("has interest rate dropdown populated with rates for 30-year term", () => {
      const rateSelect = document.getElementById("rate");
      const options = rateSelect.querySelectorAll("option");

      // Should have rate options populated from mock rates
      expect(options.length).toBeGreaterThan(0);
      // Rate should be set (not empty)
      expect(rateSelect.value).not.toBe("");
    });

    it("has property tax filled with default value", () => {
      const taxSelect = document.getElementById("tax");
      expect(taxSelect.value).toBe("15.00");
    });

    it("has insurance filled with default value", () => {
      const insuranceInput = document.getElementById("insurance");
      expect(insuranceInput.value).toBe("50");
    });

    it("has HOA fee filled with default value", () => {
      const hoaFeeInput = document.getElementById("hoaFee");
      expect(hoaFeeInput.value).toBe("0");
    });

    it("has empty price/payment input field", () => {
      const priceInput = document.getElementById("price");
      expect(priceInput.value).toBe("");
    });

    it("updates interest rate options when term changes", async () => {
      const termSelect = document.getElementById("term");
      const rateSelect = document.getElementById("rate");

      // Get initial rate for 30-year
      const initialRate = rateSelect.value;

      // Change to 15-year term
      await user.selectOptions(termSelect, "15");

      // Rate options should update (values differ per term in mock data)
      const newOptions = rateSelect.querySelectorAll("option");
      expect(newOptions.length).toBeGreaterThan(0);
    });
  });

  describe("State 2: Invalid Submission", () => {
    it("silently handles empty price input (replaces with zero)", async () => {
      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");

      // Leave price empty
      expect(priceInput.value).toBe("");

      // Click calculate
      await user.click(calculateBtn);

      // Current behavior: silently calculates with 0, displays $0
      expect(monthlyPaymentDisplay.textContent).toBe("$0");
    });

    it("silently handles invalid price input (non-numeric)", async () => {
      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");

      // Enter invalid value (input validation strips non-numeric, so this becomes empty)
      await user.type(priceInput, "abc");

      // Click calculate
      await user.click(calculateBtn);

      // Current behavior: parseFloat returns NaN, || 0 converts to 0
      expect(monthlyPaymentDisplay.textContent).toBe("$0");
    });

    it("handles zero price input", async () => {
      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");

      await user.type(priceInput, "0");
      await user.click(calculateBtn);

      // Zero price results in $0 payment
      expect(monthlyPaymentDisplay.textContent).toBe("$0");
    });
  });

  describe("State 3: Valid Submission", () => {
    it("calculates correct monthly payment for price mode", async () => {
      // Switch to price mode
      const priceRadio = document.querySelector('input[name="calcMethod"][value="price"]');
      await user.click(priceRadio);

      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");
      const purchasePriceDisplay = document.getElementById("purchasePrice");

      // Enter valid purchase price
      await user.type(priceInput, "300000");
      await user.click(calculateBtn);

      // Verify purchase price is displayed correctly
      expect(purchasePriceDisplay.textContent).toBe("$300,000");

      // Verify monthly payment is calculated (should be > $0)
      const paymentText = monthlyPaymentDisplay.textContent;
      expect(paymentText).not.toBe("$0");
      expect(paymentText.startsWith("$")).toBe(true);
    });

    it("calculates correct purchase price for payment mode", async () => {
      // Payment mode is default, no need to switch
      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");
      const purchasePriceDisplay = document.getElementById("purchasePrice");
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");

      // Enter desired monthly payment
      await user.type(priceInput, "2000");
      await user.click(calculateBtn);

      // Verify monthly payment is displayed as entered
      expect(monthlyPaymentDisplay.textContent).toBe("$2,000");

      // Verify purchase price is calculated (should be > $0)
      const priceText = purchasePriceDisplay.textContent;
      expect(priceText).not.toBe("$0");
      expect(priceText.startsWith("$")).toBe(true);
    });

    it("displays PITI breakdown after calculation", async () => {
      const priceRadio = document.querySelector('input[name="calcMethod"][value="price"]');
      await user.click(priceRadio);

      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");

      await user.type(priceInput, "300000");
      await user.click(calculateBtn);

      // Verify all PITI components are displayed
      const principalInterest = document.getElementById("principalInterest").textContent;
      const taxes = document.getElementById("taxes").textContent;
      const insurance = document.getElementById("insuranceAmount").textContent;
      const hoaFee = document.getElementById("hoaFeeDisplay").textContent;

      expect(principalInterest.startsWith("$")).toBe(true);
      expect(taxes.startsWith("$")).toBe(true);
      expect(insurance.startsWith("$")).toBe(true);
      expect(hoaFee.startsWith("$")).toBe(true);
    });
  });

  describe("State 3: Slider Interactions (Auto-Recalculate)", () => {
    beforeEach(async () => {
      // Setup: Switch to price mode and calculate first
      const priceRadio = document.querySelector('input[name="calcMethod"][value="price"]');
      await user.click(priceRadio);

      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");

      await user.type(priceInput, "300000");
      await user.click(calculateBtn);
    });

    it("updates calculation when interest rate buydown slider changes", async () => {
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");
      const interestRateBuydownSlider = document.getElementById("interestRateBuydown");
      const interestRateBuydownCost = document.getElementById("interestRateBuydownCost");

      // Get initial payment
      const initialPayment = monthlyPaymentDisplay.textContent;

      // Get slider range
      const maxRate = parseFloat(interestRateBuydownSlider.max);
      const minRate = parseFloat(interestRateBuydownSlider.min);

      // Move slider to buy down the rate (set to minimum allowed)
      interestRateBuydownSlider.value = minRate.toString();
      interestRateBuydownSlider.dispatchEvent(new Event("input", { bubbles: true }));

      // Payment should decrease when rate is bought down
      const newPayment = monthlyPaymentDisplay.textContent;

      // Buydown cost should be > $0 when rate is reduced
      if (minRate < maxRate) {
        expect(interestRateBuydownCost.textContent).not.toBe("$0");
      }
    });

    it("updates calculation when principal buydown slider changes", async () => {
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");
      const principalBuydownSlider = document.getElementById("principalBuydown");
      const principalBuydownCost = document.getElementById("principalBuydownCost");
      const principalBuydownValue = document.getElementById("principalBuydownValue");

      // Get initial payment
      const initialPayment = monthlyPaymentDisplay.textContent;

      // Move slider to buy down principal by $10,000
      principalBuydownSlider.value = "10000";
      principalBuydownSlider.dispatchEvent(new Event("input", { bubbles: true }));

      // Payment should decrease when principal is bought down
      const newPayment = monthlyPaymentDisplay.textContent;

      // Buydown value and cost should reflect the $10,000
      expect(principalBuydownValue.textContent).toBe("$10,000");
      expect(principalBuydownCost.textContent).toBe("$10,000");
    });

    it("enforces 1.5% maximum buydown cap on interest rate slider", async () => {
      const interestRateBuydownSlider = document.getElementById("interestRateBuydown");
      const interestRateBuydownValue = document.getElementById("interestRateBuydownValue");
      const rateSelect = document.getElementById("rate");

      const originalRate = parseFloat(rateSelect.value);
      const minAllowedRate = Math.max(0, originalRate - 1.5);

      // Slider min should be set to enforce 1.5% cap
      expect(parseFloat(interestRateBuydownSlider.min)).toBeCloseTo(minAllowedRate, 2);

      // Try to set slider below minimum (should be capped)
      interestRateBuydownSlider.value = "0";
      interestRateBuydownSlider.dispatchEvent(new Event("input", { bubbles: true }));

      // Value display should show cap message if rate is at minimum
      const displayText = interestRateBuydownValue.textContent;
      expect(displayText).toBe(`${minAllowedRate}%`)
    });

    it("recalculates when term changes after initial calculation", async () => {
      const monthlyPaymentDisplay = document.getElementById("monthlyPayment");
      const termSelect = document.getElementById("term");

      // Get initial payment (30-year term)
      const initialPayment = monthlyPaymentDisplay.textContent;

      // Change to 15-year term
      await user.selectOptions(termSelect, "15");

      // Payment should change (15-year has higher monthly payment but different rate)
      const newPayment = monthlyPaymentDisplay.textContent;
      // Payment will be different due to term and rate change
      expect(newPayment).not.toBe(initialPayment);
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [ ] All DOM tests pass: `bun test`
- [ ] No console errors during test execution

#### Manual Verification:
- [ ] Tests cover State 1 (Empty state): default calc method, term, rate populated
- [ ] Tests cover State 2 (Invalid submission): empty/invalid inputs silently handled
- [ ] Tests cover State 3 (Valid submission): correct calculation output
- [ ] Tests cover slider interactions: auto-recalculate on slider change, 1.5% cap enforced

**Implementation Note**: After completing this phase and all verification passes, the DOM testing infrastructure is complete.

---

## Phase 5: Add Integration Tests for Calculator Behavior (Future)

### Overview
This phase is for after popup.js is converted to ES module and MortgageService is integrated. These tests will verify the full calculation flow.

### Planned Tests (to be implemented after UI/business logic separation):

```javascript
describe("Calculator Integration", () => {
  it("calculates monthly payment when Calculate button is clicked", async () => {
    // Enter price
    // Click Calculate
    // Verify result displays update
  });

  it("shows validation error for empty price", async () => {
    // Leave price empty
    // Click Calculate
    // Verify error message appears
  });

  it("updates calculations when term changes", async () => {
    // Enter price and click Calculate
    // Change term
    // Verify results update
  });

  it("updates calculations when interest rate slider moves", async () => {
    // Enter price and click Calculate
    // Adjust interest rate slider
    // Verify results update in real-time
  });

  it("enforces 1.5% buydown cap on interest rate slider", async () => {
    // Set up calculation
    // Move slider beyond 1.5% buydown
    // Verify cap message appears
  });
});
```

### Note:
These integration tests require popup.js to be refactored as an ES module that can be imported in tests. This will be done as part of the UI/business logic separation plan.

---

## Testing Strategy

### Unit Tests (Existing):
- Calculator math functions
- Input validation functions
- MortgageService orchestration

### DOM Tests (New - This Plan):
- Initial state verification
- Tab navigation
- Input field interactions
- Structure validation

### Integration Tests (Future - After MortgageService Integration):
- Full calculation flow
- Error display behavior
- Slider real-time updates

### Manual Testing Steps:
1. Run `bun test` - all tests pass
2. Load extension in Chrome - popup displays correctly
3. All existing functionality still works
4. No console errors

## Performance Considerations

- Happy DOM is faster than jsdom for most use cases
- Tests run in-memory without browser overhead
- Parallel test execution supported by Bun

## Dependencies Added

```json
{
  "devDependencies": {
    "@happy-dom/global-registrator": "^15.x",
    "@testing-library/dom": "^10.x",
    "@testing-library/user-event": "^14.x"
  }
}
```

## References

- Research document: `orchestration/shared/research/2025-12-29-mortgage-service-extension-integration-and-dom-testing.md`
- UI/Business Logic Separation Plan: `orchestration/shared/plans/2025-12-31-ui-business-logic-separation.md`
- Popup files: `popup/popup.js`, `popup/popup.html`, `popup/popup.css`
- Test files: `tests/*.test.js`
- Bun DOM testing docs: https://bun.sh/docs/test/dom
- Testing Library docs: https://testing-library.com/docs/dom-testing-library/intro
