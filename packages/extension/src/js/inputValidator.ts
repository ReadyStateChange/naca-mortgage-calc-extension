/**
 * Input validation module for mortgage calculator
 * Pure functions with no DOM dependencies
 */

export type ValidationField = 'price' | 'term' | 'rate' | 'tax' | 'insurance' | 'hoaFee' | 'principalBuydown';

export interface ValidationSuccess<T> {
  kind: 'success';
  data: T;
}

export interface ValidationFailure {
  kind: 'failure';
  field: ValidationField;
  message: string;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export interface RawCalculatorInput {
  price: string;
  term: string;
  rate: string;
  tax: string;
  insurance: string;
  hoaFee: string;
  principalBuydown: string;
}

export interface ValidatedCalculatorInput {
  price: number;
  term: number;
  rate: number;
  tax: number;
  insurance: number;
  hoaFee: number;
  principalBuydown: number;
}

/**
 * Validate and parse a price/payment value
 */
export function validatePrice(value: string): ValidationResult<number> {
  const trimmed = String(value).trim();
  if (trimmed === "") {
    return { kind: 'failure', field: 'price', message: 'Required' };
  }
  const num = parseFloat(trimmed);
  if (isNaN(num)) {
    return { kind: 'failure', field: 'price', message: 'Must be a number' };
  }
  if (num < 0) {
    return { kind: 'failure', field: 'price', message: 'Must be positive' };
  }
  return { kind: 'success', data: num };
}

const VALID_TERMS = [15, 20, 30];

/**
 * Validate mortgage rate - validates term and rate together
 */
export function validateMortgageRate(
  termValue: string,
  rateValue: string
): ValidationResult<{ term: number; rate: number }> {
  // Parse and validate term
  const term = parseInt(termValue, 10);
  if (isNaN(term) || !VALID_TERMS.includes(term)) {
    return { kind: 'failure', field: 'term', message: 'Invalid term. Must be 15, 20, or 30' };
  }

  // Parse and validate rate
  const rate = parseFloat(rateValue);
  if (isNaN(rate)) {
    return { kind: 'failure', field: 'rate', message: 'Rate must be a number' };
  }
  if (rate <= 0) {
    return { kind: 'failure', field: 'rate', message: 'Rate must be positive' };
  }

  return { kind: 'success', data: { term, rate } };
}

/**
 * Valid property tax rates: 5 to 30.5 in 0.5 increments
 * These match the hardcoded options in popup/popup.html
 */
const VALID_PROPERTY_TAX_RATES: number[] = [];
for (let i = 5; i <= 30.5; i += 0.5) {
  VALID_PROPERTY_TAX_RATES.push(Math.round(i * 10) / 10); // Avoid floating point issues
}

/**
 * Validate property tax rate
 * Must be one of the hardcoded options from popup.html (5 to 30.5 in 0.5 increments)
 */
export function validatePropertyTax(value: string): ValidationResult<number> {
  const trimmed = String(value).trim();
  if (trimmed === "") {
    return { kind: 'failure', field: 'tax', message: 'Required' };
  }

  const num = parseFloat(trimmed);
  if (isNaN(num)) {
    return { kind: 'failure', field: 'tax', message: 'Property tax must be a number' };
  }

  // Check if rate is in the valid list
  const roundedNum = Math.round(num * 10) / 10; // Round to 1 decimal place for comparison
  if (!VALID_PROPERTY_TAX_RATES.includes(roundedNum)) {
    return { kind: 'failure', field: 'tax', message: 'Invalid property tax rate' };
  }

  return { kind: 'success', data: num };
}

/**
 * Validate a non-negative number field
 */
export function validateNonNegative(value: string, field: ValidationField): ValidationResult<number> {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return { kind: 'failure', field, message: 'Must be a number' };
  }
  if (num < 0) {
    return { kind: 'failure', field, message: 'Must be non-negative' };
  }
  return { kind: 'success', data: num };
}

/**
 * Validate all calculator inputs (fail-fast: returns first error encountered)
 */
export function validateCalculatorInput(
  raw: RawCalculatorInput
): ValidationResult<ValidatedCalculatorInput> {
  // Validate price
  const priceResult = validatePrice(raw.price);
  if (priceResult.kind === 'failure') return priceResult;

  // Validate term and rate together
  const mortgageRateResult = validateMortgageRate(raw.term, raw.rate);
  if (mortgageRateResult.kind === 'failure') return mortgageRateResult;

  // Validate tax (using hardcoded property tax options)
  if (raw.tax === undefined || raw.tax === null) {
    return { kind: 'failure', field: 'tax', message: 'Required' };
  }
  const taxResult = validatePropertyTax(String(raw.tax));
  if (taxResult.kind === 'failure') return taxResult;

  // Validate insurance (required field)
  if (raw.insurance === undefined || raw.insurance === null) {
    return { kind: 'failure', field: 'insurance', message: 'Required' };
  }
  const insuranceResult = validateNonNegative(String(raw.insurance), 'insurance');
  if (insuranceResult.kind === 'failure') return insuranceResult;

  // Validate hoaFee (required field)
  if (raw.hoaFee === undefined || raw.hoaFee === null) {
    return { kind: 'failure', field: 'hoaFee', message: 'Required' };
  }
  const hoaResult = validateNonNegative(String(raw.hoaFee), 'hoaFee');
  if (hoaResult.kind === 'failure') return hoaResult;

  // Validate principalBuydown (required field)
  if (raw.principalBuydown === undefined || raw.principalBuydown === null) {
    return { kind: 'failure', field: 'principalBuydown', message: 'Required' };
  }
  const buydownResult = validateNonNegative(String(raw.principalBuydown), 'principalBuydown');
  if (buydownResult.kind === 'failure') return buydownResult;

  return {
    kind: 'success',
    data: {
      price: priceResult.data,
      term: mortgageRateResult.data.term,
      rate: mortgageRateResult.data.rate,
      tax: taxResult.data,
      insurance: insuranceResult.data,
      hoaFee: hoaResult.data,
      principalBuydown: buydownResult.data
    }
  };
}
