/**
 * Mortgage Service - Single entry point for mortgage calculations
 * Orchestrates validation and calculation
 */

import { validateCalculatorInput } from "./inputValidator.js";

// Load calculator.js (browser script) dynamically for ES module compatibility
const calculatorCode = await Bun.file(import.meta.dir + "/calculator.js").text();
new Function(calculatorCode + "\n; globalThis.MortgageCalculator = MortgageCalculator;")();
const MortgageCalculator = globalThis.MortgageCalculator;

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
