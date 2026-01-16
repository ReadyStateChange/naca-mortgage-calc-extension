import { describe, it, expect } from "bun:test";
import { calculateMortgage, recalculateMortgage, formatCurrency, calculateInterestRateBuydown } from "../js/mortgageService.js";

describe("calculateMortgage", () => {
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
      "price"
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
        rate: "6.125",
        tax: "15",
        insurance: "50",
        hoaFee: "0",
        principalBuydown: "0",
      },
      "price"
    );

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data.purchasePrice).toBe(300000);
    expect(typeof result.data.monthlyPayment).toBe("number");
  });
});

describe("recalculateMortgage", () => {
  it("calculates without validation", () => {
    const result = recalculateMortgage(
      {
        price: 300000,
        term: 30,
        rate: 5.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      },
      "price"
    );

    expect(result.purchasePrice).toBe(300000);
    expect(typeof result.monthlyPayment).toBe("number");
  });
});

describe("calculateInterestRateBuydown", () => {
  it("calculates buydown cost", () => {
    const cost = calculateInterestRateBuydown(300000, 6.5, 6.0, 30);
    expect(typeof cost).toBe("number");
    expect(cost).toBeGreaterThan(0);
  });

  it("returns 0 when desired rate equals original rate", () => {
    const cost = calculateInterestRateBuydown(300000, 6.5, 6.5, 30);
    expect(cost).toBe(0);
  });
});

describe("formatCurrency", () => {
  it("formats numbers as currency", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });
});
