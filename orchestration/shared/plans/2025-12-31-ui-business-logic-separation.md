# UI/Business Logic Separation Implementation Plan

## Overview

Separate the UI layer from business logic in the Chrome extension popup by having the UI feed raw inputs to MortgageService and receive calculated results back. The UI handles formatting and display; the service handles validation and calculation.

## Current State Analysis

### What Exists Now (Updated after DOM Testing Plan Phase 1)
- `popup/popup.js` is an ES module that imports `MortgageCalculator` directly
- `popup/popup.js` still uses `calculator.calculate(inputs)` directly (not via MortgageService)
- Invalid inputs silently default to 0 (no validation feedback)
- `js/mortgageService.js` is browser-compatible with 4 exports: `calculateMortgage`, `recalculateMortgage`, `formatCurrency`, `calculateInterestRateBuydown`
- `js/inputValidator.js` has simplified `validateMortgageRate` (no `allowableRates` param)
- `js/calculator.js` is an ES module with `export { MortgageCalculator }`

### Key Discoveries:
- Calculator has separate `calculate()` and `calculateRaw()` methods (`js/calculator.js:181-256`, `js/calculator.js:263-328`)
- Slider handlers recalculate on every input event (`popup/popup.js:217-299`, `popup/popup.js:302-371`)
- Buydown cost calculation is separate from mortgage calculation (`js/calculator.js:128-168`)

## Desired End State

After implementation:
1. ✅ **popup.js is an ES module** (completed in DOM testing plan)
2. ✅ **MortgageCalculator is an ES module export** (completed in DOM testing plan)
3. ✅ **MortgageService has four entry points** (completed in DOM testing plan):
   - `calculateMortgage()` - validates all inputs, then calculates (for Calculate button)
   - `recalculateMortgage()` - skips validation, just calculates (for sliders after initial validation)
   - `calculateInterestRateBuydown()` - skips validation, calculates buydown cost (for slider updates)
   - `formatCurrency()` - formats numbers as currency strings
4. **popup.js uses MortgageService** instead of MortgageCalculator directly (Phase 3-4)
5. **Validation errors display inline** next to the relevant input field (Phase 2-3)
6. **Errors clear on input change** for better UX (Phase 5)
7. **Raw numbers returned from service** - UI handles all formatting (Phase 3-4)

### Verification:
- All existing tests pass: `bun test`
- Manual testing: Enter invalid inputs, see error messages appear
- Manual testing: Slider adjustments update calculations via MortgageService
- Manual testing: Clearing/fixing an invalid input clears the error
- Code review: popup.js has no direct references to `MortgageCalculator` or `calculator.`

## What We're NOT Doing

- NOT adding new validation rules beyond current inputValidator.js
- NOT changing the calculation logic in calculator.js
- NOT modifying the MSA lookup functionality
- NOT setting up DOM testing infrastructure (separate task)
- NOT refactoring the rate-fetching or caching logic

---

## Phase 1: Make MortgageService Browser-Compatible and Encapsulate Calculator ✅ COMPLETED

> **Note**: This phase was completed as part of the DOM testing plan (`2025-01-01-popup-dom-testing.md` Phase 1). All changes below have been implemented.

### Overview
Refactor mortgageService.js to work in the browser by removing Bun-specific code and simplifying rate validation. Convert calculator.js to an ES module so MortgageCalculator is only accessible through MortgageService.

### Changes Required:

#### 1. Simplify Rate Validation
**File**: `js/inputValidator.js`

Remove the `allowableRates` dependency from `validateMortgageRate`. Change it to only validate that term is 15/20/30 and rate is a positive number.

Current code (`js/inputValidator.js:51-84`):
```javascript
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
```

Replace with:
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

#### 2. Convert calculator.js to ES Module
**File**: `js/calculator.js`

Add export statement at the end of the file to make MortgageCalculator importable:

Current code ends at line 329 with just the class definition.

Add at the end of the file:
```javascript
export { MortgageCalculator };
```

This allows MortgageService to import it directly while keeping the class definition unchanged.

#### 3. Update validateCalculatorInput
**File**: `js/inputValidator.js`

Update the function signature and call to `validateMortgageRate`:

```javascript
export function validateCalculatorInput(raw) {
  const errors = [];
  const data = {};

  // Validate price
  const priceResult = validatePrice(raw.price);
  if (!priceResult.ok) errors.push(...priceResult.errors);
  else data.price = priceResult.data;

  // Validate term and rate (no longer needs allowableRates)
  const mortgageRateResult = validateMortgageRate(raw.term, raw.rate);
  if (!mortgageRateResult.ok) {
    errors.push(...mortgageRateResult.errors);
  } else {
    data.term = mortgageRateResult.data.term;
    data.rate = mortgageRateResult.data.rate;
  }

  // ... rest of validation unchanged
```

#### 4. Refactor MortgageService for Browser
**File**: `js/mortgageService.js`

Replace the Bun-specific loading with browser-compatible approach. Import MortgageCalculator directly (not global):

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

#### 5. Update Test Helper for ES Module Import
**File**: `tests/helpers/loadCalculator.js`

Since calculator.js is now an ES module, the test helper is no longer needed for loading it globally. However, we need to ensure tests can import mortgageService properly.

**Delete this file** - it's no longer needed since MortgageService imports MortgageCalculator directly.

Tests will simply import from mortgageService.js, which handles the calculator import internally.

#### 6. Update MortgageService Tests
**File**: `tests/mortgageService.test.js`

Update tests - no longer need helper since ES modules handle imports:

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

  // ... update remaining tests similarly (remove allowableRates parameter)
});

describe("recalculateMortgage", () => {
  it("calculates without validation", () => {
    const result = recalculateMortgage(
      {
        price: 300000,
        term: 30,
        rate: 5.5, // Bought-down rate (not in any allowableRates list)
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
  it("calculates buydown cost without validation", () => {
    const cost = calculateInterestRateBuydown(300000, 6.5, 6.0, 30);
    expect(typeof cost).toBe("number");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns 0 when desired rate equals original rate", () => {
    const cost = calculateInterestRateBuydown(300000, 6.5, 6.5, 30);
    expect(cost).toBe(0);
  });

  it("enforces 1.5% max buydown cap", () => {
    // Trying to buy down 2% should be capped at 1.5%
    const cost = calculateInterestRateBuydown(300000, 6.5, 4.5, 30);
    const costAtCap = calculateInterestRateBuydown(300000, 6.5, 5.0, 30);
    expect(cost).toBe(costAtCap); // Should be same since both hit the cap
  });
});
```

#### 7. Update InputValidator Tests
**File**: `tests/inputValidator.test.js`

Update tests for the simplified `validateMortgageRate`:

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

describe("validateCalculatorInput", () => {
  it("validates all inputs without allowableRates", () => {
    const result = validateCalculatorInput({
      price: "300000",
      term: "30",
      rate: "5.5", // Any valid rate works now
      tax: "15",
      insurance: "50",
      hoaFee: "0",
      principalBuydown: "0",
    });

    expect(result.ok).toBe(true);
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] All unit tests pass: `bun test`
- [x] No linting errors (if linter is configured)

#### Test Coverage Verification:
- [x] `tests/inputValidator.test.js` has `validateMortgageRate` tests without `allowableRates` parameter
- [x] `tests/inputValidator.test.js` covers: valid terms (15/20/30), invalid term, non-numeric rate, zero/negative rate
- [x] `tests/mortgageService.test.js` imports from `../js/mortgageService.js` (ES module)
- [x] `tests/mortgageService.test.js` has tests for all 4 exports: `calculateMortgage`, `recalculateMortgage`, `formatCurrency`, `calculateInterestRateBuydown`

#### Manual Verification:
- [x] mortgageService.js no longer contains Bun-specific code
- [x] calculator.js exports MortgageCalculator as ES module
- [x] mortgageService.js imports MortgageCalculator (not relying on global)

**Status**: ✅ Completed via DOM testing plan. Proceed to Phase 2.

---

## Phase 2: Add Error Display UI Elements

### Overview
Add error message spans to popup.html and error styling to popup.css.

### Changes Required:

#### 1. Add Error Spans to popup.html
**File**: `popup/popup.html`

Add error span after each input that can have validation errors:

**Price input** (after line 32):
```html
<div class="input-group">
  <label for="price">Purchase Price / Payment</label>
  <input type="text" id="price" placeholder="Enter amount" />
  <span class="error-message" id="price-error"></span>
</div>
```

**Term select** (after line 41):
```html
<div class="input-group">
  <label for="term">Loan Term</label>
  <select id="term">
    <option value="30">30 Years</option>
    <option value="20">20 Years</option>
    <option value="15">15 Years</option>
  </select>
  <span class="error-message" id="term-error"></span>
</div>
```

**Rate select** (after line 50):
```html
<div class="input-group">
  <label for="rate">Interest Rate (%)</label>
  <select id="rate">
    <!-- Interest rates will be populated dynamically based on term -->
  </select>
  <span class="error-message" id="rate-error"></span>
</div>
```

**Tax select** (after line 110):
```html
</select>
<span class="error-message" id="tax-error"></span>
```

**Insurance input** (after line 121):
```html
<input
  type="number"
  id="insurance"
  placeholder="Enter insurance amount"
/>
<span class="error-message" id="insurance-error"></span>
```

**HOA Fee input** (after line 130):
```html
<input
  type="number"
  id="hoaFee"
  placeholder="Enter HOA/Condo fee"
/>
<span class="error-message" id="hoaFee-error"></span>
```

#### 2. Add Error Styles to popup.css
**File**: `popup/popup.css`

Add at the end of the file:

```css
/* Error Styles */
.error-message {
  color: #dc3545;
  font-size: 0.8em;
  margin-top: 4px;
  display: none;
}

.error-message.visible {
  display: block;
}

.input-group.has-error input,
.input-group.has-error select {
  border-color: #dc3545;
}

.input-group.has-error input:focus,
.input-group.has-error select:focus {
  border-color: #dc3545;
  box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2);
}
```

### Success Criteria:

#### Automated Verification:
- [x] HTML is valid (no syntax errors)
- [x] CSS is valid (no syntax errors)

#### Manual Verification:
- [x] Load the extension popup and verify no visual changes (errors are hidden by default)
- [x] Inspect elements to confirm error spans exist with correct IDs

**Status**: ✅ Completed. Proceed to Phase 3.

---

## Phase 3: Convert popup.js to ES Module and Integrate MortgageService

### Overview
popup.js is already an ES module (from DOM testing plan). Now integrate MortgageService by replacing direct MortgageCalculator usage with MortgageService calls, and replace the calculate button handler.

### Changes Required:

> **Note**: popup.html script tags already updated in DOM testing plan. popup.js is already an ES module with `import { MortgageCalculator } from "../js/calculator.js"`. We now need to switch to MortgageService imports.

#### 1. Update Imports and Add Error Display Functions
**File**: `popup/popup.js`

**Replace the current import** at line 1:
```javascript
// CHANGE FROM:
import { MortgageCalculator } from "../js/calculator.js";

// CHANGE TO:
import { calculateMortgage, recalculateMortgage, formatCurrency, calculateInterestRateBuydown } from "../js/mortgageService.js";
```

The `RATE_CACHE_EXPIRY_MS` constant at line 3 remains unchanged.

**Remove the calculator instantiation** at line 6:
```javascript
// DELETE THIS LINE:
const calculator = new MortgageCalculator();
```

Add after the DOM element declarations (around line 40, after all `document.getElementById` calls):

```javascript
// State to track if initial calculation has passed validation
let hasValidatedInputs = false;
let lastValidatedInputs = null;
let currentCalcMethod = "payment";

// Error display functions
function showValidationErrors(errors) {
  clearValidationErrors();
  errors.forEach((error) => {
    const errorEl = document.getElementById(`${error.field}-error`);
    if (errorEl) {
      errorEl.textContent = error.message;
      errorEl.classList.add("visible");
      errorEl.closest(".input-group")?.classList.add("has-error");
    }
  });
}

function clearValidationErrors() {
  document.querySelectorAll(".error-message").forEach((el) => {
    el.textContent = "";
    el.classList.remove("visible");
  });
  document.querySelectorAll(".input-group.has-error").forEach((el) => {
    el.classList.remove("has-error");
  });
}

function clearFieldError(fieldName) {
  const errorEl = document.getElementById(`${fieldName}-error`);
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.remove("visible");
    errorEl.closest(".input-group")?.classList.remove("has-error");
  }
}
```

#### 2. Update Calculate Button Handler
**File**: `popup/popup.js`

Replace the calculate button handler (lines 200-214):

```javascript
// Handle calculate button click
calculateButton.addEventListener("click", () => {
  // Gather raw inputs as strings
  const rawInput = {
    price: priceInput.value,
    term: termSelect.value,
    rate: interestRateBuydownSlider.value, // Use slider value (effective rate)
    tax: taxInput.value,
    insurance: insuranceInput.value,
    hoaFee: hoaFeeInput.value,
    principalBuydown: principalBuydownSlider.value,
  };

  const result = calculateMortgage(rawInput, currentCalcMethod);

  if (!result.ok) {
    showValidationErrors(result.errors);
    return;
  }

  // Clear errors on successful validation
  clearValidationErrors();

  // Store validated inputs for slider recalculations
  hasValidatedInputs = true;
  lastValidatedInputs = {
    price: result.data.purchasePrice, // Use calculated price for payment mode
    term: parseInt(termSelect.value),
    rate: parseFloat(interestRateBuydownSlider.value),
    tax: parseFloat(taxInput.value),
    insurance: parseFloat(insuranceInput.value),
    hoaFee: parseFloat(hoaFeeInput.value),
    principalBuydown: parseFloat(principalBuydownSlider.value),
  };

  // Format and display results
  updateDisplayResultsFromRaw(result.data);
});
```

#### 3. Add Helper Function for Displaying Raw Results
**File**: `popup/popup.js`

Add after updateDisplayResults function:

```javascript
// Helper function to update display from raw numbers
function updateDisplayResultsFromRaw(rawData) {
  monthlyPaymentDisplay.textContent = formatCurrency(rawData.monthlyPayment);
  purchasePriceDisplay.textContent = formatCurrency(rawData.purchasePrice);
  principalInterestDisplay.textContent = formatCurrency(rawData.principalInterest);
  taxesDisplay.textContent = formatCurrency(rawData.taxes);
  insuranceAmountDisplay.textContent = formatCurrency(rawData.insurance);
  hoaFeeDisplay.textContent = formatCurrency(rawData.hoaFee);

  // Update principal buydown slider max value
  updatePrincipalBuydownSliderMax();
}
```

#### 4. Update Calc Method Change Handler
**File**: `popup/popup.js`

Update the calcMethodInputs handler (around line 187):

```javascript
// Handle calculation method change
calcMethodInputs.forEach((input) => {
  input.addEventListener("change", (e) => {
    currentCalcMethod = e.target.value;
    // NOTE: Remove calculator.setCalcMethod() - now handled by MortgageService
    priceInput.placeholder = e.target.value === "payment"
      ? "Enter desired monthly payment"
      : "Enter purchase price";

    // Reset validation state when mode changes
    hasValidatedInputs = false;
    lastValidatedInputs = null;

    // Update principal buydown slider max value
    updatePrincipalBuydownSliderMax();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] No JavaScript errors in browser console when loading popup
- [x] All existing tests still pass: `bun test`
- [x] `tests/popup.test.js` "State 2: Invalid Submission" tests pass - validates error display behavior:
  - `shows error for empty price input` - checks `price-error` element shows "Required" with `.visible` class
  - `calculates zero price input as valid` - confirms zero is accepted

#### Manual Verification:
- [x] popup.js imports from `mortgageService.js` (not `calculator.js`)
- [x] popup.js has no `const calculator = new MortgageCalculator()` instantiation
- [x] Click Calculate with empty price - error appears
- [x] Click Calculate with valid inputs - calculation displays correctly
- [x] Error clears when Calculate succeeds after fixing input

**Status**: ✅ Completed. Proceed to Phase 4.

---

## Phase 4: Update Slider Handlers to Use MortgageService

### Overview
Modify the slider handlers to use `recalculateMortgage()` and `calculateInterestRateBuydown()` from MortgageService instead of calling the calculator directly. After this phase, popup.js has no direct access to MortgageCalculator.

### Changes Required:

#### 1. Update Interest Rate Buydown Slider Handler
**File**: `popup/popup.js`

Replace the slider handler (starting around line 217):

```javascript
// Add event listener for the interest rate buydown slider
interestRateBuydownSlider.addEventListener("input", () => {
  let desiredRate = parseFloat(interestRateBuydownSlider.value);
  const originalRate = parseFloat(rateInput.value);
  const term = parseInt(termSelect.value);
  const purchasePriceText = purchasePriceDisplay.textContent.replace(/[$,]/g, "");
  const principal = parseFloat(purchasePriceText) || 0;

  if (principal > 0) {
    // Calculate buydown cost via MortgageService (no validation needed)
    const buydownCost = calculateInterestRateBuydown(
      principal,
      originalRate,
      desiredRate,
      term
    );
    interestRateBuydownCostDisplay.textContent = formatCurrency(buydownCost);

    // Apply 1.5% buydown cap and update the displayed percentage
    const minAllowedRate = Math.max(0, originalRate - 1.5);
    let capReached = false;
    if (desiredRate < minAllowedRate) {
      desiredRate = minAllowedRate;
      interestRateBuydownSlider.value = String(minAllowedRate);
      capReached = true;
    }
    interestRateBuydownValue.textContent = capReached
      ? `${desiredRate.toFixed(3)}% (1.5% cap reached)`
      : `${desiredRate.toFixed(3)}%`;

    // Recalculate mortgage using MortgageService with lastValidInput and a new rate
    const recalculateInputs = {
      ...lastValidatedInputs,
      rate: parseFloat(desiredRate)
    };

    const recalculatedResults = recalculateMortgage(recalculateInputs, currentCalcMethod);

    // Update the display based on the calculation method
    if (currentCalcMethod === "price") {
      updateDisplayResultsFromRaw(recalculatedResults);
      purchasePriceDisplay.textContent = formatCurrency(recalculateInputs.price);
    } else {
      updateDisplayResultsFromRaw(recalculatedResults);
      monthlyPaymentDisplay.textContent = formatCurrency(recalculateInputs.price);
    }

    // Update principal buydown slider max value after recalculation
    updatePrincipalBuydownSliderMax();
  }
});
```

#### 2. Update Principal Buydown Slider Handler
**File**: `popup/popup.js`

Replace the slider handler (starting around line 302):

```javascript
// Add event listener for the principal buydown slider
principalBuydownSlider.addEventListener("input", () => {
  const principalBuydown = parseFloat(principalBuydownSlider.value) || 0;
  principalBuydownValue.textContent = formatCurrency(principalBuydown);
  principalBuydownCostDisplay.textContent = formatCurrency(principalBuydown);


  // Use lastValidatedInputs adding new principalBuydown
  const recalculateInputs = {
    ...lastValidatedInputs,
    principalBuydown: principalBuydown,
  };

  // Recalculate using MortgageService (no validation)
  const recalculatedResults = recalculateMortgage(recalculateInputs, currentCalcMethod);

  // Update the display based on the calculation method
  if (currentCalcMethod === "price") {
    updateDisplayResultsFromRaw(recalculatedResults);
    purchasePriceDisplay.textContent = formatCurrency(recalculateInputs.price);
  } else {
    updateDisplayResultsFromRaw(recalculatedResults);
    monthlyPaymentDisplay.textContent = formatCurrency(recalculateInputs.price);
  }

  // Update principal buydown slider max value after recalculation
  updatePrincipalBuydownSliderMax();

  // Also re-calculate and update the interest rate buydown cost via MortgageService
  const originalInterestRate = parseFloat(rateInput.value);
  const currentPurchasePriceText = purchasePriceDisplay.textContent.replace(/[$,]/g, "");
  const currentPrincipal = parseFloat(currentPurchasePriceText) || 0;
  if (currentPrincipal > 0) {
    const interestBuydownCost = calculateInterestRateBuydown(
      currentPrincipal,
      originalInterestRate,
      desiredRate,
      term
    );
    interestRateBuydownCostDisplay.textContent = formatCurrency(interestBuydownCost);
  } else {
    interestRateBuydownCostDisplay.textContent = "$0";
  }
});
```

#### 3. Update Term and Rate Change Handlers
**File**: `popup/popup.js`

These handlers also trigger recalculations. Update them to use `recalculateMortgage`:

**Term change handler** (around line 129):
```javascript
setTimeout(() => {
  // Use lastValidatedInputs with updated term
  const recalculateInputs = {
    ...lastValidatedInputs,
    term: parseInt(termSelect.value) || 30,
  };

  const results = recalculateMortgage(recalculateInputs, currentCalcMethod);
  updateDisplayResultsFromRaw(results);
}, 50);
```

**Rate change handler** (around line 169):
```javascript
// Use lastValidatedInputs with updated rate
const recalculateInputs = {
  ...lastValidatedInputs,
  rate: newRate,
};

const results = recalculateMortgage(recalculateInputs, currentCalcMethod);
updateDisplayResultsFromRaw(results);
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `bun test`
- [x] No console errors when using sliders

#### Manual Verification:
- [x] Interest rate slider updates calculations in real-time
- [x] Principal buydown slider updates calculations in real-time
- [x] Changing term recalculates correctly
- [x] Changing rate recalculates correctly
- [x] 1.5% buydown cap is still enforced
- [x] `grep -n "MortgageCalculator\|calculator\." popup/popup.js` returns no matches (all calls go through MortgageService)

**Status**: ✅ Completed. Proceed to Phase 5.

---

## Phase 5: Clear Errors on Input Change

### Overview
Add event listeners to clear field-specific errors when the user modifies an input.

### Changes Required:

#### 1. Add Input Change Listeners for Error Clearing
**File**: `popup/popup.js`

Add after the error display functions:

```javascript
// Clear errors on input change
function setupErrorClearingListeners() {
  // Price input
  priceInput.addEventListener("input", () => clearFieldError("price"));

  // Term select
  termSelect.addEventListener("change", () => clearFieldError("term"));

  // Rate select
  rateInput.addEventListener("change", () => clearFieldError("rate"));

  // Tax select
  taxInput.addEventListener("change", () => clearFieldError("tax"));

  // Insurance input
  insuranceInput.addEventListener("input", () => clearFieldError("insurance"));

  // HOA Fee input
  hoaFeeInput.addEventListener("input", () => clearFieldError("hoaFee"));
}

// Call this during initialization
setupErrorClearingListeners();
```

Move the `setupErrorClearingListeners()` call to after all DOM elements are declared (around line 40).

#### 2. Add Test for Error Clearing Behavior
**File**: `tests/popup.test.js`

Add to "State 2: Invalid Submission" describe block:

```javascript
    it("clears error when user starts typing", async () => {
      const priceInput = document.getElementById("price");
      const calculateBtn = document.getElementById("calculate");
      const priceError = document.getElementById("price-error");

      // Trigger error
      priceInput.value = "";
      await user.click(calculateBtn);
      expect(priceError.classList.contains("visible")).toBe(true);

      // Start typing - error should clear
      await user.type(priceInput, "1");
      expect(priceError.classList.contains("visible")).toBe(false);
    });
```

### Success Criteria:

#### Automated Verification:
- [x] All tests pass: `bun test`
- [x] `tests/popup.test.js` includes "clears error when user starts typing" test

#### Manual Verification:
- [x] Enter invalid price, click Calculate (error appears)
- [x] Start typing in price field - error clears immediately
- [x] Same behavior for all input fields

**Status**: ✅ Completed. All phases complete.

---

## Testing Strategy

### Unit Tests:
- `validateMortgageRate` accepts valid terms and rates
- `validateMortgageRate` rejects invalid terms
- `validateMortgageRate` rejects non-numeric and non-positive rates
- `calculateMortgage` returns errors for invalid inputs
- `calculateMortgage` returns raw numbers for valid inputs
- `recalculateMortgage` works without validation

### Integration Tests:
- Full calculation flow from raw inputs to formatted output
- Error display and clearing behavior

### Manual Testing Steps:
1. Load extension popup
2. Leave price empty, click Calculate - verify "Required" error appears
3. Enter "abc" in price, click Calculate - verify "Must be a number" error
4. Enter valid price, click Calculate - verify error clears and results display
5. Adjust interest rate slider - verify calculations update in real-time
6. Adjust principal buydown slider - verify calculations update
7. Change term - verify rates update and calculations recalculate
8. Verify 1.5% buydown cap is enforced

## Performance Considerations

- Sliders trigger recalculations on every input event (current behavior preserved)
- No additional validation overhead for slider recalculations (using `recalculateMortgage`)
- ES module loading is async but happens once on page load

## References

- Original research: `orchestration/shared/research/2025-12-29-mortgage-service-extension-integration-and-dom-testing.md`
- **Prerequisite plan (Phase 1 completed)**: `orchestration/shared/plans/2025-01-01-popup-dom-testing.md`
- MortgageService: `js/mortgageService.js`
- InputValidator: `js/inputValidator.js`
- Calculator: `js/calculator.js`
- Popup: `popup/popup.js`, `popup/popup.html`, `popup/popup.css`
