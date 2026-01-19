---
date: 2026-01-01T20:47:05-05:00
researcher: AI Agent
git_commit: 2cddb2cfd986ee30a5c9bf3f6246fb749e618608
branch: HEAD
repository: naca-app
topic: "UI/Business Logic Separation Implementation"
tags: [implementation, popup, mortgageService, validation, refactoring]
status: in_progress
last_updated: 2026-01-01
last_updated_by: AI Agent
type: implementation_strategy
---

# Handoff: UI/Business Logic Separation - Phases 2-4 In Progress

## Task(s)

Implementing `orchestration/shared/plans/2025-12-31-ui-business-logic-separation.md`:

| Phase   | Description                                                 | Status                      |
| ------- | ----------------------------------------------------------- | --------------------------- |
| Phase 1 | Make MortgageService Browser-Compatible                     | ✅ Completed (prior session) |
| Phase 2 | Add Error Display UI Elements                               | ✅ Completed                 |
| Phase 3 | Convert popup.js to ES Module and Integrate MortgageService | 🔄 In Progress               |
| Phase 4 | Update Slider Handlers to Use MortgageService               | 🔄 In Progress               |
| Phase 5 | Clear Errors on Input Change                                | ❌ Not Started               |

## Critical References

- `orchestration/shared/plans/2025-12-31-ui-business-logic-separation.md` - Implementation plan
- `js/mortgageService.js` - Service layer with 4 exports: `calculateMortgage`, `recalculateMortgage`, `formatCurrency`, `calculateInterestRateBuydown`

## Recent changes

**Phase 2 - Completed:**
- `popup/popup.html:32-33` - Added `<span class="error-message" id="price-error"></span>` after price input
- `popup/popup.html:41-42` - Added term-error span
- `popup/popup.html:50-51` - Added rate-error span
- `popup/popup.html:111-112` - Added tax-error span
- `popup/popup.html:122-123` - Added insurance-error span
- `popup/popup.html:131-132` - Added hoaFee-error span
- `popup/popup.css:263-288` - Added error styles (`.error-message`, `.visible`, `.has-error`)

**Phase 3 & 4 - In Progress:**
- `popup/popup.js:1` - Changed import from `MortgageCalculator` to MortgageService functions
- `popup/popup.js:42-90` - Added state variables (`hasValidatedInputs`, `lastValidatedInputs`, `currentCalcMethod`) and error display functions (`showValidationErrors`, `clearValidationErrors`, `clearFieldError`, `updateDisplayResultsFromRaw`)
- `popup/popup.js:169-189` - Updated term change handler to use `recalculateMortgage`
- `popup/popup.js:203-221` - Updated rate change handler to use `recalculateMortgage`
- `popup/popup.js:236-251` - Updated calc method handler to set `currentCalcMethod`
- `popup/popup.js:253-276` - Replaced calculate button handler to use `calculateMortgage` with validation
- `popup/popup.js:278-331` - Updated interest rate buydown slider to use `calculateInterestRateBuydown` and `recalculateMortgage`
- `popup/popup.js:333-382` - Updated principal buydown slider to use `formatCurrency` and `recalculateMortgage`

**Test Updates:**
- `tests/popup.test.js:137-168` - Updated "State 2: Invalid Submission" tests to expect error messages instead of silent $0.00 replacement

## Learnings

1. **Tests reflect old behavior**: The existing popup tests expected silent error handling (empty price → $0.00). New validation shows errors instead, requiring test updates.

2. **Calculation not executing for valid inputs**: Tests show that even valid inputs (e.g., "300000" in price mode) result in display staying at "$0". This indicates the `calculateMortgage` call is returning errors when it shouldn't.

3. **Root cause hypothesis**: The issue is likely in how `rawInput` is constructed or how validation interprets the slider values. The `interestRateBuydownSlider.value` may not be properly initialized when the form loads, causing rate validation to fail.

4. **All `calculator.` references removed**: Verified with grep - no direct MortgageCalculator references remain in popup.js.

## Artifacts

- `popup/popup.html` - Updated with error span elements
- `popup/popup.css` - Updated with error styling
- `popup/popup.js` - Refactored to use MortgageService (incomplete - has bugs)
- `tests/popup.test.js` - Partially updated for new validation behavior
- `orchestration/shared/plans/2025-12-31-ui-business-logic-separation.md:529-531` - Updated Phase 2 checkboxes

## Action Items & Next Steps

1. **Debug why valid inputs fail validation**: Add console.log in calculate button handler to inspect `rawInput` and `result` from `calculateMortgage`. Likely issue is `interestRateBuydownSlider.value` being empty/invalid at form load.

2. **Fix slider initialization timing**: The buydown slider gets its value set in `updateInterestRateOptions` via setTimeout. The calculate button may be clicked before this completes in tests.

3. **Update remaining tests**: Several popup tests still expect old behavior:
   - "calculates correct monthly payment for price mode" - expects "$300,000.00"
   - "calculates correct purchase price for payment mode" - expects "$2,000.00"
   - "updates calculation when principal buydown slider changes" - expects "$10,000.00"
   - "recalculates when term changes after initial calculation"

4. **Complete Phase 5**: Add `setupErrorClearingListeners()` function and call it during initialization.

5. **Manual testing**: Once tests pass, manually verify in Chrome extension.

## Other Notes

**Current test status**: 95 pass, 6 fail (all in popup.test.js)

**Key file locations:**
- MortgageService: `js/mortgageService.js`
- Input Validator: `js/inputValidator.js`
- Calculator: `js/calculator.js`
- Popup UI: `popup/popup.js`, `popup/popup.html`, `popup/popup.css`
- Popup tests: `tests/popup.test.js`

**Debugging approach for next session:**
```javascript
// Add to calculate button handler temporarily:
console.log('rawInput:', rawInput);
console.log('result:', result);
```

Run tests with: `bun test tests/popup.test.js`

