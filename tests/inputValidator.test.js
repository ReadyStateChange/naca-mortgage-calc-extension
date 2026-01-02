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

  it("accepts valid 15-year term", () => {
    const result = validateMortgageRate("15", "5.5");
    expect(result.ok).toBe(true);
    expect(result.data.term).toBe(15);
  });

  it("accepts valid 20-year term", () => {
    const result = validateMortgageRate("20", "5.5");
    expect(result.ok).toBe(true);
    expect(result.data.term).toBe(20);
  });

  it("rejects non-numeric term", () => {
    const result = validateMortgageRate("abc", "5.125");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("term");
  });

  it("rejects empty term", () => {
    const result = validateMortgageRate("", "5.125");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("term");
  });

  it("rejects empty rate", () => {
    const result = validateMortgageRate("30", "");
    expect(result.ok).toBe(false);
    expect(result.errors[0].field).toBe("rate");
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
  const validInput = {
    price: "2000",
    term: "30",
    rate: "6.125",
    tax: "15",
    insurance: "50",
    hoaFee: "0",
    principalBuydown: "0",
  };

  it("accepts valid complete input", () => {
    const result = validateCalculatorInput(validInput);
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
    });
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3); // price, term, tax at minimum
  });

  it("identifies which fields have errors", () => {
    const result = validateCalculatorInput({
      ...validInput,
      price: "",
      rate: "0",  // invalid rate (zero)
    });
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
    });
    expect(result.ok).toBe(false);
  });

  it("validates term correctly", () => {
    const result = validateCalculatorInput({
      ...validInput,
      term: "25",  // invalid term
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.field === "term")).toBe(true);
  });
});
