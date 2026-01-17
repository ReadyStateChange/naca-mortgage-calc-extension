/**
 * Mortgage Service - Single entry point for mortgage calculations
 * Orchestrates validation and calculation
 *
 * MortgageCalculator is encapsulated here - not exposed globally
 */

// @ts-expect-error - MortgageCalculator is a JavaScript module from the shared package
import { MortgageCalculator } from "@naca-app/calculator";
import {
  validateCalculatorInput,
  type RawCalculatorInput,
  type ValidationError,
} from "./inputValidator";

export interface CalculationResult {
  monthlyPayment: number;
  purchasePrice: number;
  principalInterest: number;
  taxes: number;
  insurance: number;
  hoaFee: number;
}

export interface CalculateMortgageSuccess {
  ok: true;
  data: CalculationResult;
}

export interface CalculateMortgageError {
  ok: false;
  errors: ValidationError[];
}

export type CalculateMortgageResult = CalculateMortgageSuccess | CalculateMortgageError;

export interface RecalculateInput {
  price: number;
  term: number;
  rate: number;
  tax: number;
  insurance: number;
  hoaFee: number;
  principalBuydown: number;
}

/**
 * Validate inputs and calculate mortgage
 * @param rawInput - Raw string values from form
 * @param calcMethod - 'payment' or 'price'
 * @returns - { ok: boolean, data?: Object, errors?: Array }
 */
export function calculateMortgage(
  rawInput: RawCalculatorInput,
  calcMethod: "payment" | "price"
): CalculateMortgageResult {
  // 1. Validate
  const validation = validateCalculatorInput(rawInput);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors || [] };
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
 * @param validatedInput - Already validated input object with numeric values
 * @param calcMethod - 'payment' or 'price'
 * @returns - Raw calculation results
 */
export function recalculateMortgage(
  validatedInput: RecalculateInput,
  calcMethod: "payment" | "price"
): CalculationResult {
  const calculator = new MortgageCalculator();
  calculator.setCalcMethod(calcMethod);
  return calculator.calculateRaw(validatedInput);
}

/**
 * Format a number as currency
 */
export function formatCurrency(num: number, decimals = 2): string {
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
 * @param principal - The principal amount
 * @param originalRate - The starting interest rate
 * @param desiredRate - The target bought-down rate
 * @param term - Loan term in years
 * @returns - The cost to buy down the rate
 */
export function calculateInterestRateBuydown(
  principal: number,
  originalRate: number,
  desiredRate: number,
  term: number
): number {
  const calculator = new MortgageCalculator();
  return calculator.calculateInterestRateBuydown(principal, originalRate, desiredRate, term);
}
