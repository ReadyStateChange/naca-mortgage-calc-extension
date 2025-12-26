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
