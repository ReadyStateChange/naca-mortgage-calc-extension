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
