import { describe, it, expect } from "bun:test";
import {
  validatePrice,
  validateMortgageRate,
  validatePropertyTax,
  validateNonNegative,
  validateCalculatorInput,
} from "../js/inputValidator.js";

describe("validatePrice", () => {
  it("accepts valid positive numbers", () => {
    const result = validatePrice("1500");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(1500);
  });

  it("accepts decimal numbers", () => {
    const result = validatePrice("1500.50");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(1500.5);
  });

  it("accepts zero", () => {
    const result = validatePrice("0");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(0);
  });

  it("trims whitespace", () => {
    const result = validatePrice("  1500  ");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(1500);
  });

  it("rejects empty string", () => {
    const result = validatePrice("");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("price");
    expect(result.errors[0].message).toBe("Required");
  });

  it("rejects whitespace-only string", () => {
    const result = validatePrice("   ");
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toBe("Required");
  });

  it("rejects non-numeric strings", () => {
    const result = validatePrice("abc");
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toBe("Must be a number");
  });

  it("rejects negative numbers", () => {
    const result = validatePrice("-100");
    expect(result.ok).toBe(false);
    expect(result.errors[0].message).toBe("Must be positive");
  });
});

describe("validateMortgageRate", () => {
  // Allowable rates passed as parameter (simulates API-fetched rates)
  const allowableRates = {
    "15": [4.625, 5.625],
    "20": [4.65, 5.65],
    "30": [5.125, 6.125],
  };

  it("accepts valid term and rate combination", () => {
    const result = validateMortgageRate("30", "5.125", allowableRates);
    expect(result.ok).toBe(true);
    expect(result.data.term).toBe(30);
    expect(result.data.rate).toBe(5.125);
  });

  it("accepts all valid rates for 15-year term", () => {
    expect(validateMortgageRate("15", "4.625", allowableRates).ok).toBe(true);
    expect(validateMortgageRate("15", "5.625", allowableRates).ok).toBe(true);
  });

  it("accepts all valid rates for 20-year term", () => {
    expect(validateMortgageRate("20", "4.65", allowableRates).ok).toBe(true);
    expect(validateMortgageRate("20", "5.65", allowableRates).ok).toBe(true);
  });

  it("accepts all valid rates for 30-year term", () => {
    expect(validateMortgageRate("30", "5.125", allowableRates).ok).toBe(true);
    expect(validateMortgageRate("30", "6.125", allowableRates).ok).toBe(true);
  });

  it("rejects invalid term", () => {
    const result = validateMortgageRate("25", "5.125", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("term");
    expect(result.errors[0].message).toBe("Invalid term. Must be 15, 20, or 30");
  });

  it("rejects rate not in allowable list for term", () => {
    const result = validateMortgageRate("30", "4.625", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("rate");
    expect(result.errors[0].message).toBe("Invalid rate for 30-year term");
  });

  it("rejects non-numeric term", () => {
    const result = validateMortgageRate("abc", "5.125", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("term");
  });

  it("rejects non-numeric rate", () => {
    const result = validateMortgageRate("30", "abc", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("rate");
    expect(result.errors[0].message).toBe("Rate must be a number");
  });

  it("rejects empty term", () => {
    const result = validateMortgageRate("", "5.125", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("term");
  });

  it("rejects empty rate", () => {
    const result = validateMortgageRate("30", "", allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("rate");
  });

  it("handles rates with floating point precision", () => {
    // Ensure 5.125 matches even if passed as string
    const result = validateMortgageRate("30", "5.125", allowableRates);
    expect(result.ok).toBe(true);
    expect(result.data.rate).toBe(5.125);
  });
});

describe("validatePropertyTax", () => {
  // Property tax options: 5 to 30.5 in 0.5 increments
  it("accepts minimum valid tax (5)", () => {
    const result = validatePropertyTax("5");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(5);
  });

  it("accepts maximum valid tax (30.5)", () => {
    const result = validatePropertyTax("30.5");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(30.5);
  });

  it("accepts valid tax with 0.5 increment (15.5)", () => {
    const result = validatePropertyTax("15.5");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(15.5);
  });

  it("accepts whole number tax in range (10)", () => {
    const result = validatePropertyTax("10");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(10);
  });

  it("rejects tax below minimum", () => {
    const result = validatePropertyTax("4.5");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
    expect(result.errors[0].message).toBe("Invalid property tax rate");
  });

  it("rejects tax above maximum", () => {
    const result = validatePropertyTax("31");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
    expect(result.errors[0].message).toBe("Invalid property tax rate");
  });

  it("rejects tax not on 0.5 increment (7.3)", () => {
    const result = validatePropertyTax("7.3");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
    expect(result.errors[0].message).toBe("Invalid property tax rate");
  });

  it("rejects non-numeric tax", () => {
    const result = validatePropertyTax("abc");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
    expect(result.errors[0].message).toBe("Property tax must be a number");
  });

  it("rejects empty string", () => {
    const result = validatePropertyTax("");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
  });
});

describe("validateNonNegative", () => {
  it("accepts positive numbers", () => {
    const result = validateNonNegative("100", "tax");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(100);
  });

  it("accepts zero", () => {
    const result = validateNonNegative("0", "tax");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(0);
  });

  it("accepts decimals", () => {
    const result = validateNonNegative("15.50", "tax");
    expect(result.ok).toBe(true);
    expect(result.data).toBe(15.5);
  });

  it("rejects negative numbers", () => {
    const result = validateNonNegative("-5", "tax");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("tax");
    expect(result.errors[0].message).toBe("Must be non-negative");
  });

  it("rejects non-numeric strings", () => {
    const result = validateNonNegative("abc", "insurance");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("insurance");
    expect(result.errors[0].message).toBe("Must be a number");
  });

  it("uses provided field name in errors", () => {
    const result = validateNonNegative("-1", "hoaFee");
    expect(result.errors[0].field).toBe("hoaFee");
  });
});

describe("validateCalculatorInput", () => {
  // Allowable rates passed as parameter (simulates API-fetched rates)
  const allowableRates = {
    "15": [4.625, 5.625],
    "20": [4.65, 5.65],
    "30": [5.125, 6.125],
  };

  const validInput = {
    price: "2000",
    term: "30",
    rate: "6.125",  // Must be a valid rate for term 30
    tax: "15",
    insurance: "50",
    hoaFee: "0",
    principalBuydown: "0",
  };

  it("accepts valid complete input", () => {
    const result = validateCalculatorInput(validInput, allowableRates);
    expect(result.ok).toBe(true);
    expect(result.data.price).toBe(2000);
    expect(result.data.term).toBe(30);
    expect(result.data.rate).toBe(6.125);
    expect(result.data.tax).toBe(15);
    expect(result.data.insurance).toBe(50);
    expect(result.data.hoaFee).toBe(0);
    expect(result.data.principalBuydown).toBe(0);
  });

  it("returns all validation errors at once", () => {
    const result = validateCalculatorInput({
      price: "",
      term: "25",        // invalid term
      rate: "invalid",   // invalid rate
      tax: "4",          // invalid (below 5)
      insurance: "50",
      hoaFee: "0",
      principalBuydown: "0",
    }, allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3); // price, term, tax at minimum
  });

  it("identifies which fields have errors", () => {
    const result = validateCalculatorInput({
      ...validInput,
      price: "",
      rate: "9.99",  // invalid rate for term 30
    }, allowableRates);
    const errorFields = result.errors.map((e) => e.field);
    expect(errorFields).toContain("price");
    expect(errorFields).toContain("rate");
    expect(errorFields).not.toContain("term");
  });

  it("handles missing fields gracefully", () => {
    const result = validateCalculatorInput({
      price: "1000",
      term: "30",
      rate: "6.125",
      // missing tax, insurance, hoaFee, principalBuydown
    }, allowableRates);
    expect(result.ok).toBe(false);
  });

  it("validates term and rate together", () => {
    // Valid rate for term 15, but using term 30
    const result = validateCalculatorInput({
      ...validInput,
      term: "30",
      rate: "4.625",  // Valid for 15-year, invalid for 30-year
    }, allowableRates);
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.field === "rate")).toBe(true);
  });
});
