import { describe, it, expect } from "bun:test";
import { calculateMortgage, formatCurrency } from "../js/mortgageService.js";

describe("calculateMortgage", () => {
  // Allowable rates passed as parameter (simulates API-fetched rates)
  const allowableRates = {
    "15": [4.625, 5.625],
    "20": [4.65, 5.65],
    "30": [5.125, 6.125],
  };

  it("returns validation errors for invalid input", () => {
    const result = calculateMortgage(
      {
        price: "",
        term: "30",
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors[0].field).toBe("price");
  });

  it("returns calculated results for valid input", () => {
    const result = calculateMortgage(
      {
        price: "300000",
        term: "30",
        rate: "6.125",  // Valid rate for 30-year
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.purchasePrice).toBe(300000);
    expect(typeof result.data.monthlyPayment).toBe("number");
  });

  it("respects calcMethod parameter - price mode", () => {
    const result = calculateMortgage(
      {
        price: "300000",
        term: "30",
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    expect(result.data.purchasePrice).toBe(300000);
    // Monthly payment should be calculated
    expect(result.data.monthlyPayment).toBeGreaterThan(2000);
  });

  it("respects calcMethod parameter - payment mode", () => {
    const result = calculateMortgage(
      {
        price: "2000",
        term: "30",
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "payment",
      allowableRates
    );

    expect(result.data.monthlyPayment).toBe(2000);
    // Purchase price should be calculated
    expect(result.data.purchasePrice).toBeGreaterThan(200000);
  });

  it("returns all errors for multiple invalid fields", () => {
    const result = calculateMortgage(
      {
        price: "",
        term: "25",        // invalid term
        rate: "abc",       // invalid rate
        tax: "4",          // invalid (below 5)
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3); // price, term, tax at minimum
  });

  it("handles principal buydown correctly", () => {
    const withoutBuydown = calculateMortgage(
      {
        price: "300000",
        term: "30",
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    const withBuydown = calculateMortgage(
      {
        price: "300000",
        term: "30",
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "50000",
      },
      "price",
      allowableRates
    );

    expect(withBuydown.data.monthlyPayment).toBeLessThan(
      withoutBuydown.data.monthlyPayment
    );
  });

  it("rejects rate not valid for the specified term", () => {
    const result = calculateMortgage(
      {
        price: "300000",
        term: "30",
        rate: "4.625",  // Valid for 15-year, invalid for 30-year
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price",
      allowableRates
    );

    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.field === "rate")).toBe(true);
  });
});

describe("formatCurrency", () => {
  it("formats numbers as currency", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("adds commas for thousands", () => {
    expect(formatCurrency(1234567.89)).toBe("$1,234,567.89");
  });

  it("handles whole numbers", () => {
    expect(formatCurrency(1000)).toBe("$1,000.00");
  });

  it("returns empty string for NaN", () => {
    expect(formatCurrency(NaN)).toBe("");
  });

  it("respects decimal parameter", () => {
    expect(formatCurrency(1234.5678, 0)).toBe("$1,235");
    expect(formatCurrency(1234.5678, 3)).toBe("$1,234.568");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("handles negative numbers", () => {
    expect(formatCurrency(-1234.56)).toBe("$-1,234.56");
  });
});
