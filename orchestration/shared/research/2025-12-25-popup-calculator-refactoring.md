# Research: Popup/JS Calculator Refactoring Architecture

**Date**: 2025-12-25
**Git Commit**: 8c6c4e37120cd13c2a7f58d80fd01dc0656f582f
**Repository**: naca-app

## Research Question

How to refactor the popup/ and js/ directories to create a module that:
1. Takes current data and outputs resulting data
2. Validates/parses user input - returns error response if invalid, proceeds if valid
3. Passes valid data to a single processing function/module
4. Returns results to UI (UI handling is out of scope)
5. Is testable

**Constraint**: The popup is a Chrome extension using plain JavaScript with no build step. Must remain bundleable via zip with no transpilation.

---

## Current State Analysis

### Files Examined

| File | Lines | Purpose |
|------|-------|---------|
| `js/calculator.js` | 260 | Core `MortgageCalculator` class |
| `js/api-config.js` | 11 | API endpoint configuration |
| `popup/popup.js` | 595 | Chrome extension UI logic |
| `popup/popup.html` | 274 | Extension HTML template |
| `railway-api/public/website.js` | 459 | Website version (~80% duplicate of popup.js) |

### Current Architecture Problems

1. **Tight Coupling**: UI logic is intertwined with data gathering and calculation triggering
   - Example: `popup/popup.js:200-214` - calculate button handler reads DOM, parses, calculates, updates DOM all in one place

2. **No Validation Layer**: Input parsing happens inline with silent fallback to 0
   ```javascript
   // popup/popup.js:201-208
   const inputs = {
     price: parseFloat(priceInput.value) || 0,  // Invalid input silently becomes 0
     term: parseInt(termSelect.value) || 30,
     // ...
   };
   ```

3. **Duplicated Code**: `popup/popup.js` and `railway-api/public/website.js` are ~80% identical

4. **DOM as State**: Code reads from DOM elements to get current state
   ```javascript
   // popup/popup.js:221-225
   const purchasePriceText = purchasePriceDisplay.textContent.replace(/[$,]/g, "");
   const principal = parseFloat(purchasePriceText) || 0;
   ```

5. **Pre-formatted Output**: Calculator returns formatted strings instead of raw numbers
   ```javascript
   // js/calculator.js:222-229
   return {
     monthlyPayment: this.formatNumber(desiredMonthlyPayment),  // Returns "$1,234.56"
     purchasePrice: this.formatNumber(purchasePrice),
     // ...
   };
   ```

### Current Data Flow

```
User Input → Event Handler → Read all DOM values → Parse inline → calculator.calculate() → Formatted strings → Update DOM
```

Problems with this flow:
- No validation step (invalid → 0 silently)
- No separation between parsing and calculation
- Formatted output requires parsing again for subsequent calculations

---

## Recommended Architecture

### Data Flow

```
┌─────────────┐     ┌───────────────────┐     ┌────────────────┐     ┌─────────────┐
│  UI Input   │ ──▶ │  InputValidator   │ ──▶ │  Calculator    │ ──▶ │   Results   │
│  (strings)  │     │  (parse/validate) │     │  (pure math)   │     │  (numbers)  │
└─────────────┘     └───────────────────┘     └────────────────┘     └─────────────┘
                           │                                                │
                           ▼                                                ▼
                    { ok: false,                                    { ok: true,
                      errors: [...] }                                 data: {...} }
                           │
                           ▼
                    UI shows field errors
```

### File Structure

```
js/
  calculator.js          # Existing - add calculateRaw() method
  inputValidator.js      # NEW - pure validation functions
  mortgageService.js     # NEW - orchestrates validation + calculation

popup/
  popup.js               # Simplified - just UI bindings
  popup.html             # Loads js/*.js files via script tags

tests/                   # NEW - Bun test files
  inputValidator.test.js
  calculator.test.js
  mortgageService.test.js
```

---

## Module Specifications

### Module 1: `js/inputValidator.js`

Pure validation functions with no DOM dependencies.

```javascript
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
function validatePrice(value) {
  const trimmed = String(value).trim();
  if (trimmed === '') {
    return { ok: false, errors: [{ field: 'price', message: 'Required' }] };
  }
  const num = parseFloat(trimmed);
  if (isNaN(num)) {
    return { ok: false, errors: [{ field: 'price', message: 'Must be a number' }] };
  }
  if (num < 0) {
    return { ok: false, errors: [{ field: 'price', message: 'Must be positive' }] };
  }
  return { ok: true, data: num };
}

/**
 * Validate loan term
 * @param {string} value
 * @returns {ValidationResult}
 */
function validateTerm(value) {
  const num = parseInt(value, 10);
  if (![15, 20, 30].includes(num)) {
    return { ok: false, errors: [{ field: 'term', message: 'Must be 15, 20, or 30' }] };
  }
  return { ok: true, data: num };
}

/**
 * Validate interest rate
 * @param {string} value
 * @returns {ValidationResult}
 */
function validateRate(value) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { ok: false, errors: [{ field: 'rate', message: 'Must be a number' }] };
  }
  if (num < 0 || num > 20) {
    return { ok: false, errors: [{ field: 'rate', message: 'Must be between 0 and 20' }] };
  }
  return { ok: true, data: num };
}

/**
 * Validate a non-negative number field
 * @param {string} value
 * @param {string} fieldName
 * @returns {ValidationResult}
 */
function validateNonNegative(value, fieldName) {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { ok: false, errors: [{ field: fieldName, message: 'Must be a number' }] };
  }
  if (num < 0) {
    return { ok: false, errors: [{ field: fieldName, message: 'Must be non-negative' }] };
  }
  return { ok: true, data: num };
}

/**
 * Validate all calculator inputs
 * @param {Object} raw - Raw input values (strings from form)
 * @returns {ValidationResult}
 */
function validateCalculatorInput(raw) {
  const errors = [];
  const data = {};

  const priceResult = validatePrice(raw.price);
  if (!priceResult.ok) errors.push(...priceResult.errors);
  else data.price = priceResult.data;

  const termResult = validateTerm(raw.term);
  if (!termResult.ok) errors.push(...termResult.errors);
  else data.term = termResult.data;

  const rateResult = validateRate(raw.rate);
  if (!rateResult.ok) errors.push(...rateResult.errors);
  else data.rate = rateResult.data;

  const taxResult = validateNonNegative(raw.tax, 'tax');
  if (!taxResult.ok) errors.push(...taxResult.errors);
  else data.tax = taxResult.data;

  const insuranceResult = validateNonNegative(raw.insurance, 'insurance');
  if (!insuranceResult.ok) errors.push(...insuranceResult.errors);
  else data.insurance = insuranceResult.data;

  const hoaResult = validateNonNegative(raw.hoaFee, 'hoaFee');
  if (!hoaResult.ok) errors.push(...hoaResult.errors);
  else data.hoaFee = hoaResult.data;

  const buydownResult = validateNonNegative(raw.principalBuydown, 'principalBuydown');
  if (!buydownResult.ok) errors.push(...buydownResult.errors);
  else data.principalBuydown = buydownResult.data;

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data };
}

// Export for testing (ignored by browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    validatePrice,
    validateTerm,
    validateRate,
    validateNonNegative,
    validateCalculatorInput,
  };
}
```

### Module 2: Modify `js/calculator.js`

Add a new method that returns raw numbers. Keep existing `calculate()` for backwards compatibility during migration.

```javascript
// Add this method to MortgageCalculator class

/**
 * Calculate mortgage details and return raw numbers (not formatted strings)
 * @param {Object} inputs - Validated input object
 * @returns {Object} Raw numeric results
 */
calculateRaw(inputs) {
  const { price, term, rate, tax, insurance, hoaFee, principalBuydown = 0 } = inputs;

  if (this.calcMethod === "payment") {
    const purchasePrice = this.calculateMaxPurchasePrice(
      price, rate, term, tax, insurance, hoaFee, principalBuydown
    );
    const principal = purchasePrice - principalBuydown;
    const principalInterest = this.calculateBaseMonthlyPayment(
      principal > 0 ? principal : 0, rate, term
    );
    const monthlyTax = this.calculateMonthlyTax(purchasePrice, tax);

    return {
      monthlyPayment: price,
      purchasePrice: purchasePrice,
      principalInterest: principalInterest,
      taxes: monthlyTax,
      insurance: insurance,
      hoaFee: hoaFee,
    };
  } else {
    const principal = price - principalBuydown;
    const principalInterest = this.calculateBaseMonthlyPayment(
      principal > 0 ? principal : 0, rate, term
    );
    const monthlyTax = this.calculateMonthlyTax(price, tax);
    const totalMonthlyPayment = principalInterest + monthlyTax + insurance + hoaFee;

    return {
      monthlyPayment: totalMonthlyPayment,
      purchasePrice: price,
      principalInterest: principalInterest,
      taxes: monthlyTax,
      insurance: insurance,
      hoaFee: hoaFee,
    };
  }
}
```

### Module 3: `js/mortgageService.js`

Single entry point that orchestrates validation and calculation.

```javascript
/**
 * Single entry point for mortgage calculations
 * @param {Object} rawInput - Raw string values from form
 * @param {string} calcMethod - 'payment' or 'price'
 * @returns {Object} - { ok: boolean, data?: Object, errors?: Array }
 */
function calculateMortgage(rawInput, calcMethod) {
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
 * Format a number as currency
 * @param {number} num
 * @param {number} decimals
 * @returns {string}
 */
function formatCurrency(num, decimals = 2) {
  if (isNaN(num)) return '';
  return '$' + num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Export for testing (ignored by browser)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateMortgage, formatCurrency };
}
```

### Script Loading Order in `popup.html`

```html
<script src="../js/inputValidator.js"></script>
<script src="../js/calculator.js"></script>
<script src="../js/mortgageService.js"></script>
<script src="popup.js"></script>
```

---

## Testing Strategy

### Test Runner

Use Bun's built-in test runner. Tests live in a separate `tests/` directory and use CommonJS exports from the modules.

### Test File: `tests/inputValidator.test.js`

```javascript
const { describe, it, expect } = require('bun:test');
const {
  validatePrice,
  validateTerm,
  validateRate,
  validateNonNegative,
  validateCalculatorInput,
} = require('../js/inputValidator.js');

describe('validatePrice', () => {
  it('accepts valid positive numbers', () => {
    const result = validatePrice('1500');
    expect(result.ok).toBe(true);
    expect(result.data).toBe(1500);
  });

  it('accepts decimal numbers', () => {
    const result = validatePrice('1500.50');
    expect(result.ok).toBe(true);
    expect(result.data).toBe(1500.50);
  });

  it('rejects empty string', () => {
    const result = validatePrice('');
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe('price');
    expect(result.errors[0].message).toBe('Required');
  });

  it('rejects whitespace-only string', () => {
    const result = validatePrice('   ');
    expect(result.ok).toBe(false);
  });

  it('rejects non-numeric strings', () => {
    const result = validatePrice('abc');
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toBe('Must be a number');
  });

  it('rejects negative numbers', () => {
    const result = validatePrice('-100');
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toBe('Must be positive');
  });
});

describe('validateTerm', () => {
  it('accepts 15 year term', () => {
    expect(validateTerm('15')).toEqual({ ok: true, data: 15 });
  });

  it('accepts 20 year term', () => {
    expect(validateTerm('20')).toEqual({ ok: true, data: 20 });
  });

  it('accepts 30 year term', () => {
    expect(validateTerm('30')).toEqual({ ok: true, data: 30 });
  });

  it('rejects invalid terms', () => {
    const result = validateTerm('25');
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe('term');
  });
});

describe('validateRate', () => {
  it('accepts valid rates', () => {
    expect(validateRate('6.5').data).toBe(6.5);
  });

  it('rejects rates above 20', () => {
    const result = validateRate('25');
    expect(result.ok).toBe(false);
  });

  it('rejects negative rates', () => {
    const result = validateRate('-1');
    expect(result.ok).toBe(false);
  });
});

describe('validateCalculatorInput', () => {
  const validInput = {
    price: '2000',
    term: '30',
    rate: '6.5',
    tax: '15',
    insurance: '50',
    hoaFee: '0',
    principalBuydown: '0',
  };

  it('accepts valid complete input', () => {
    const result = validateCalculatorInput(validInput);
    expect(result.ok).toBe(true);
    expect(result.data.price).toBe(2000);
    expect(result.data.term).toBe(30);
    expect(result.data.rate).toBe(6.5);
  });

  it('returns all validation errors at once', () => {
    const result = validateCalculatorInput({
      price: '',
      term: '25',
      rate: 'invalid',
      tax: '-5',
      insurance: '50',
      hoaFee: '0',
      principalBuydown: '0',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('identifies which fields have errors', () => {
    const result = validateCalculatorInput({
      ...validInput,
      price: '',
      rate: 'bad',
    });
    const errorFields = result.errors.map(e => e.field);
    expect(errorFields).toContain('price');
    expect(errorFields).toContain('rate');
    expect(errorFields).not.toContain('term');
  });
});
```

### Test File: `tests/calculator.test.js`

```javascript
const { describe, it, expect } = require('bun:test');

// Need to load calculator.js - may need adjustment based on how it exports
// For now, assume we add module.exports to calculator.js
const { MortgageCalculator } = require('../js/calculator.js');

describe('MortgageCalculator', () => {
  describe('calculateRaw - price mode', () => {
    it('calculates monthly payment for given purchase price', () => {
      const calculator = new MortgageCalculator();
      calculator.setCalcMethod('price');

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
      expect(result.monthlyPayment).toBeGreaterThan(2000);
      expect(result.monthlyPayment).toBeLessThan(2500);
      expect(result.insurance).toBe(50);
      expect(result.hoaFee).toBe(0);
    });

    it('accounts for principal buydown', () => {
      const calculator = new MortgageCalculator();
      calculator.setCalcMethod('price');

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
  });

  describe('calculateRaw - payment mode', () => {
    it('calculates max purchase price for desired payment', () => {
      const calculator = new MortgageCalculator();
      calculator.setCalcMethod('payment');

      const result = calculator.calculateRaw({
        price: 2000,  // desired monthly payment
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(result.monthlyPayment).toBe(2000);
      expect(result.purchasePrice).toBeGreaterThan(200000);
      expect(result.purchasePrice).toBeLessThan(350000);
    });
  });

  describe('calculateInterestRateBuydown', () => {
    it('calculates buydown cost correctly for 30-year', () => {
      const calculator = new MortgageCalculator();

      // 1 point = 1/6% reduction for 30 year
      // 1 point costs 1% of principal
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 6.0, 30);

      // 0.5% reduction = 3 points = 3% of $300k = $9000
      expect(cost).toBeCloseTo(9000, 0);
    });

    it('calculates buydown cost correctly for 15-year', () => {
      const calculator = new MortgageCalculator();

      // 1 point = 1/4% reduction for 15 year
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 6.0, 15);

      // 0.5% reduction = 2 points = 2% of $300k = $6000
      expect(cost).toBeCloseTo(6000, 0);
    });

    it('enforces 1.5% max buydown', () => {
      const calculator = new MortgageCalculator();

      // Try to buy down 2% (beyond the 1.5% cap)
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 4.5, 30);

      // Should only charge for 1.5% buydown
      // 1.5% = 9 points = 9% of $300k = $27000
      expect(cost).toBeCloseTo(27000, 0);
    });

    it('returns 0 when desired rate >= current rate', () => {
      const calculator = new MortgageCalculator();
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 7.0, 30);
      expect(cost).toBe(0);
    });
  });
});
```

### Test File: `tests/mortgageService.test.js`

```javascript
const { describe, it, expect } = require('bun:test');

// Load dependencies in correct order
require('../js/inputValidator.js');
require('../js/calculator.js');
const { calculateMortgage, formatCurrency } = require('../js/mortgageService.js');

describe('calculateMortgage', () => {
  it('returns validation errors for invalid input', () => {
    const result = calculateMortgage({
      price: '',
      term: '30',
      rate: '6.5',
      tax: '15',
      insurance: '50',
      hoaFee: '0',
      principalBuydown: '0',
    }, 'price');

    expect(result.ok).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors[0].field).toBe('price');
  });

  it('returns calculated results for valid input', () => {
    const result = calculateMortgage({
      price: '300000',
      term: '30',
      rate: '6.5',
      tax: '15',
      insurance: '50',
      hoaFee: '0',
      principalBuydown: '0',
    }, 'price');

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.purchasePrice).toBe(300000);
    expect(typeof result.data.monthlyPayment).toBe('number');
  });

  it('respects calcMethod parameter', () => {
    const priceMode = calculateMortgage({
      price: '300000',
      term: '30',
      rate: '6.5',
      tax: '15',
      insurance: '50',
      hoaFee: '0',
      principalBuydown: '0',
    }, 'price');

    const paymentMode = calculateMortgage({
      price: '2000',
      term: '30',
      rate: '6.5',
      tax: '15',
      insurance: '50',
      hoaFee: '0',
      principalBuydown: '0',
    }, 'payment');

    expect(priceMode.data.purchasePrice).toBe(300000);
    expect(paymentMode.data.monthlyPayment).toBe(2000);
  });
});

describe('formatCurrency', () => {
  it('formats numbers as currency', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });

  it('adds commas for thousands', () => {
    expect(formatCurrency(1234567.89)).toBe('$1,234,567.89');
  });

  it('handles whole numbers', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
  });

  it('returns empty string for NaN', () => {
    expect(formatCurrency(NaN)).toBe('');
  });
});
```

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/inputValidator.test.js

# Watch mode
bun test --watch

# With coverage (if needed)
bun test --coverage
```

---

## Migration Path

### Phase 1: Add New Modules (Non-Breaking)
1. Create `js/inputValidator.js`
2. Add `calculateRaw()` method to `js/calculator.js`
3. Create `js/mortgageService.js`
4. Add tests
5. Update `popup.html` script loading order

### Phase 2: Migrate Popup.js Gradually
1. Replace one event handler at a time to use `calculateMortgage()`
2. Move formatting to UI layer
3. Add error display handling to UI

### Phase 3: Consolidate
1. Apply same changes to `railway-api/public/website.js`
2. Consider sharing modules between extension and website
3. Remove deprecated `calculate()` method once all consumers updated

---

## Key Benefits

| Benefit | Description |
|---------|-------------|
| **Separation of Concerns** | Validation, calculation, and formatting are separate modules |
| **Testable** | Pure functions with no DOM dependencies |
| **Clear Error Handling** | UI receives structured errors with field names and messages |
| **Reusable** | Same modules work for extension and website |
| **Raw Data Output** | UI decides how to format (allows different formatting per platform) |
| **No Build Step** | Plain JavaScript, browser ignores CommonJS exports |

---

## Open Questions

1. Should validation happen on every keystroke or only on submit?
2. Should there be debouncing for real-time calculation updates?
3. How should the UI display validation errors (inline, toast, etc.)?
4. Should we add TypeScript later with a build step for better DX?
