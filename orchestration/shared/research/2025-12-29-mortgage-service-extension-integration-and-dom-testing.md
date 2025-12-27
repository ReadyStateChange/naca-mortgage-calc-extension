---
date: 2025-12-30T02:30:46Z
researcher: Claude
git_commit: 7f28a99
branch: HEAD (detached)
repository: naca-app
topic: "MortgageService Extension Integration and DOM Testing Strategy"
tags: [research, codebase, mortgageService, popup, testing, dom-testing, validation]
status: complete
last_updated: 2025-12-30
last_updated_by: Claude
---

# Research: MortgageService Extension Integration and DOM Testing Strategy

**Date**: 2025-12-30T02:30:46Z
**Researcher**: Claude
**Git Commit**: 7f28a99
**Branch**: HEAD (detached)
**Repository**: naca-app

## Research Question

How to integrate MortgageService into the Chrome extension popup, handle validation errors in the UI, and establish a DOM testing strategy using Testing Library vs Bun's test runner for plain HTML/JS.

## Summary

The codebase has a well-architected MortgageService (`js/mortgageService.js`) and InputValidator (`js/inputValidator.js`) that are already implemented. The popup (`popup/popup.js`) still uses the legacy MortgageCalculator directly. Integration requires:

1. **Replacing MortgageCalculator usage in popup.js with MortgageService calls**
2. **Adding error display UI elements to popup.html**
3. **Adding error styling to popup.css**
4. **Testing strategy: Bun + Happy DOM + @testing-library/dom is the recommended approach**

---

## Detailed Findings

### 1. Current MortgageCalculator Usage in popup.js

The extension popup (`popup/popup.js`) currently instantiates and uses `MortgageCalculator` directly:

**Instantiation** (`popup/popup.js:4`):
```javascript
const calculator = new MortgageCalculator();
```

**Calculation method change** (`popup/popup.js:189`):
```javascript
calculator.setCalcMethod(e.target.value);
```

**Main calculation calls** (`popup/popup.js:141`, `popup/popup.js:180`, `popup/popup.js:211`, `popup/popup.js:277`, `popup/popup.js:329`):
```javascript
const results = calculator.calculate(inputs);
```

**Input gathering pattern** (multiple locations):
```javascript
const inputs = {
  price: parseFloat(priceInput.value) || 0,  // Silent fallback to 0
  term: parseInt(termSelect.value) || 30,
  rate: parseFloat(interestRateBuydownSlider.value) || 0,
  tax: parseFloat(taxInput.value) || 0,
  insurance: parseFloat(insuranceInput.value) || 0,
  hoaFee: parseFloat(hoaFeeInput.value) || 0,
  principalBuydown: parseFloat(principalBuydownSlider.value) || 0,
};
```

**Key Problem**: Invalid inputs silently default to 0 - no validation feedback to users.

### 2. MortgageService Architecture

**Location**: `js/mortgageService.js`

The MortgageService is an ES module that:
1. Takes raw string inputs from the form
2. Validates via `validateCalculatorInput()` from `inputValidator.js`
3. Returns `{ ok: false, errors: [...] }` on validation failure
4. Returns `{ ok: true, data: {...} }` with raw numbers on success

**API**:
```javascript
export function calculateMortgage(rawInput, calcMethod, allowableRates) {
  // 1. Validate
  const validation = validateCalculatorInput(rawInput, allowableRates);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  // 2. Calculate
  const calculator = new MortgageCalculator();
  calculator.setCalcMethod(calcMethod);
  const result = calculator.calculateRaw(validation.data);

  // 3. Return raw numbers
  return { ok: true, data: result };
}
```

**Critical Requirement**: The service requires `allowableRates` parameter for term/rate validation. This is fetched from the API and already available in popup.js as `interestRates`.

### 3. InputValidator Error Structure

**Location**: `js/inputValidator.js`

Each validation error has the structure:
```javascript
{ field: string, message: string }
```

**Field names that can have errors**:
- `price` - "Required", "Must be a number", "Must be positive"
- `term` - "Invalid term. Must be 15, 20, or 30"
- `rate` - "Rate must be a number", "Invalid rate for X-year term"
- `tax` - "Required", "Property tax must be a number", "Invalid property tax rate"
- `insurance` - "Required", "Must be a number", "Must be non-negative"
- `hoaFee` - "Required", "Must be a number", "Must be non-negative"
- `principalBuydown` - "Required", "Must be a number", "Must be non-negative"

### 4. Current popup.html Structure

**Input fields that need error display**:
- `#price` - text input (line 32)
- `#term` - select (lines 37-41)
- `#rate` - select (lines 48-50)
- `#tax` - select (lines 57-110)
- `#insurance` - number input (lines 117-121)
- `#hoaFee` - number input (lines 127-130)
- `#principalBuydown` - range slider (lines 188-194)

**Current CSS classes available**:
- `.input-group` - container for each input
- `.status-message` - used for MSA lookup status, could be reused

### 5. Integration Approach

**Option A: Direct Replacement (Recommended)**
Replace `calculator.calculate(inputs)` calls with `calculateMortgage()` calls. Handle the result pattern:

```javascript
const result = calculateMortgage(rawInput, calcMethod, allowableRates);
if (!result.ok) {
  showValidationErrors(result.errors);
  return;
}
updateDisplayResults(result.data);
```

**Challenge**: MortgageService is an ES module with `import` statements, but popup.js runs as a browser script without module support.

**Solution Options**:
1. Convert popup.js to ES module (`<script type="module">`)
2. Bundle mortgageService.js for browser (remove ES module syntax)
3. Create a browser-compatible version of the service

**Recommended**: Option 1 - Convert to ES module. This is the cleanest approach and Chrome extensions support ES modules.

### 6. Error Display Strategy

**HTML Changes** - Add error container after each input:
```html
<div class="input-group">
  <label for="price">Purchase Price / Payment</label>
  <input type="text" id="price" placeholder="Enter amount" />
  <span class="error-message" id="price-error"></span>
</div>
```

**CSS Changes**:
```css
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
```

**JavaScript Error Display Function**:
```javascript
function showValidationErrors(errors) {
  // Clear previous errors
  document.querySelectorAll('.error-message').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
  document.querySelectorAll('.input-group.has-error').forEach(el => {
    el.classList.remove('has-error');
  });

  // Show new errors
  errors.forEach(error => {
    const errorEl = document.getElementById(`${error.field}-error`);
    if (errorEl) {
      errorEl.textContent = error.message;
      errorEl.classList.add('visible');
      errorEl.closest('.input-group')?.classList.add('has-error');
    }
  });
}

function clearValidationErrors() {
  document.querySelectorAll('.error-message').forEach(el => {
    el.textContent = '';
    el.classList.remove('visible');
  });
  document.querySelectorAll('.input-group.has-error').forEach(el => {
    el.classList.remove('has-error');
  });
}
```

---

## DOM Testing Strategy Comparison

### Testing Library (DOM Testing Library)

**What it is**: A library of DOM querying utilities that test from the user's perspective.

**Key characteristics**:
- Queries by role, label, text, placeholder - not implementation details
- Works with any test runner (Jest, Vitest, Bun, Mocha)
- Requires a DOM environment (jsdom or happy-dom)
- `@testing-library/dom` is the standalone package for vanilla JS
- `@testing-library/user-event` provides realistic user interaction simulation

**Setup for Plain HTML/JS with Bun**:
```bash
bun add -D @testing-library/dom @testing-library/user-event @happy-dom/global-registrator
```

**Example test**:
```javascript
import { screen, within } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';

test('shows error when price is empty', async () => {
  document.body.innerHTML = loadHTML('./popup.html');

  const calculateBtn = screen.getByRole('button', { name: /calculate/i });
  await userEvent.click(calculateBtn);

  const priceError = screen.getByText(/required/i);
  expect(priceError).toBeVisible();
});
```

### Bun Test Runner

**What it is**: Bun's built-in test runner with Jest-compatible API.

**Key characteristics**:
- No native DOM APIs - requires Happy DOM or jsdom
- Happy DOM is officially recommended
- Fastest test runner available (~17x faster than Jest)
- Single-threaded - side effects persist between tests
- jsdom support added December 2024

**DOM Environment Setup** (`bunfig.toml`):
```toml
[test]
preload = ["./tests/happydom.ts"]
```

**Preload file** (`tests/happydom.ts`):
```typescript
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();
```

### Comparison Table

| Aspect | Testing Library + Bun | Raw Bun + Happy DOM |
|--------|----------------------|---------------------|
| **Query Style** | User-centric (by role, label, text) | DOM-centric (getElementById, querySelector) |
| **Async Handling** | `userEvent` handles async naturally | Manual event dispatching |
| **Error Messages** | Clear, actionable errors | Generic assertion failures |
| **Learning Curve** | Higher (new query patterns) | Lower (familiar DOM APIs) |
| **Maintenance** | Tests survive refactors | Tests break on HTML changes |
| **Bundle Size** | ~80KB additional | Minimal overhead |
| **Best For** | User-facing behavior | Implementation testing |

### Recommended Approach: Bun + Happy DOM + @testing-library/dom

**Why**:
1. **Bun's speed** - Tests run nearly instantly
2. **Testing Library queries** - Tests don't break when HTML structure changes
3. **User perspective** - Tests verify what users see and do
4. **Already using Bun** - Existing test infrastructure in place

**Full Setup**:

```bash
# Install dependencies
bun add -D @happy-dom/global-registrator @testing-library/dom @testing-library/user-event
```

**Create `tests/happydom.ts`**:
```typescript
import { GlobalRegistrator } from "@happy-dom/global-registrator";
GlobalRegistrator.register();
```

**Create `bunfig.toml`** (if not exists):
```toml
[test]
preload = ["./tests/happydom.ts"]
```

**Example popup test** (`tests/popup.test.js`):
```javascript
import { describe, it, expect, beforeEach } from "bun:test";
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import fs from "fs";
import path from "path";

// Load HTML and scripts
function setupPopup() {
  const html = fs.readFileSync(
    path.resolve(__dirname, "../popup/popup.html"),
    "utf8"
  );
  document.body.innerHTML = html;

  // Load calculator.js
  const calcCode = fs.readFileSync(
    path.resolve(__dirname, "../js/calculator.js"),
    "utf8"
  );
  new Function(calcCode)();
}

describe("Popup Calculator", () => {
  beforeEach(() => {
    setupPopup();
  });

  it("displays validation error when price is empty", async () => {
    const user = userEvent.setup();

    const priceInput = screen.getByLabelText(/purchase price/i);
    const calculateBtn = screen.getByRole("button", { name: /calculate/i });

    // Clear the input and click calculate
    await user.clear(priceInput);
    await user.click(calculateBtn);

    // Check for error message
    const error = await screen.findByText(/required/i);
    expect(error).toBeTruthy();
  });

  it("calculates monthly payment for valid inputs", async () => {
    const user = userEvent.setup();

    const priceInput = screen.getByLabelText(/purchase price/i);
    const calculateBtn = screen.getByRole("button", { name: /calculate/i });

    await user.type(priceInput, "300000");
    await user.click(calculateBtn);

    const result = screen.getByText(/\$\d+,?\d*/);
    expect(result).toBeTruthy();
  });
});
```

### Happy DOM vs jsdom

| Aspect | Happy DOM | jsdom |
|--------|-----------|-------|
| **Performance** | Faster for most tests | Slower but more comprehensive |
| **API Coverage** | Most common APIs | Nearly complete browser API |
| **Bun Support** | Officially recommended | Supported (Dec 2024) |
| **Use Case** | General UI testing | Complex browser feature testing |

**Recommendation**: Start with Happy DOM. Only switch to jsdom if you encounter missing APIs.

---

## Code References

- `popup/popup.js:4` - MortgageCalculator instantiation
- `popup/popup.js:200-214` - Main calculate button handler
- `popup/popup.js:141-150` - Term change recalculation
- `popup/popup.js:169-184` - Rate change recalculation
- `js/mortgageService.js:21-36` - calculateMortgage function
- `js/inputValidator.js:149-208` - validateCalculatorInput function
- `tests/mortgageService.test.js` - Existing service tests
- `tests/inputValidator.test.js` - Existing validator tests

## Architecture Documentation

### Current Testing Infrastructure

The project uses Bun's test runner with tests in `/tests/`:
- `tests/calculator.test.js` - MortgageCalculator unit tests
- `tests/inputValidator.test.js` - Validation function tests
- `tests/mortgageService.test.js` - Service integration tests
- `tests/helpers/calculatorLoader.js` - Helper to load browser script as module

Tests run with `bun test` and use a helper pattern to load browser scripts:
```javascript
const code = await Bun.file(import.meta.dir + "/../../js/calculator.js").text();
new Function(code + "\n; globalThis.MortgageCalculator = MortgageCalculator;")();
```

This same pattern can be extended for DOM testing.

## Related Research

- `orchestration/shared/research/2025-12-25-popup-calculator-refactoring.md` - Original architecture plan for MortgageService

## Open Questions

1. **Module loading strategy**: Should popup.js become an ES module, or should mortgageService.js be bundled for browser compatibility?
2. **Error display timing**: Should errors clear on input change or only on next submit?
3. **Rate fetching integration**: The allowableRates are already fetched - need to ensure they're passed to MortgageService correctly
4. **Slider inputs**: How should validation errors appear for range sliders (buydown fields)?
5. **Real-time validation**: Should validation run on every keystroke or only on submit?
