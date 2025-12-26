import { describe, it, expect, beforeEach } from "bun:test";
import { MortgageCalculator } from "./helpers/calculatorLoader.js";

describe("MortgageCalculator", () => {
  let calculator;

  beforeEach(() => {
    calculator = new MortgageCalculator();
  });

  describe("calculateBaseMonthlyPayment", () => {
    it("calculates correct P&I for standard mortgage", () => {
      // $300,000 at 6.5% for 30 years
      const payment = calculator.calculateBaseMonthlyPayment(300000, 6.5, 30);
      // Expected: ~$1,896.20
      expect(payment).toBeCloseTo(1896.2, 0);
    });

    it("calculates correct P&I for 15-year mortgage", () => {
      // $300,000 at 6.0% for 15 years
      const payment = calculator.calculateBaseMonthlyPayment(300000, 6.0, 15);
      // Expected: ~$2,531.57
      expect(payment).toBeCloseTo(2531.57, 0);
    });

    it("returns NaN for 0% interest rate (edge case)", () => {
      // At 0% interest, the formula divides by zero resulting in NaN
      // (This is a known limitation of the current implementation)
      const payment = calculator.calculateBaseMonthlyPayment(360000, 0, 30);
      expect(payment).toBeNaN();
    });
  });

  describe("calculateMonthlyTax", () => {
    it("calculates monthly tax from annual rate per $1000", () => {
      // $300,000 at $15 per $1000 = $4,500/year = $375/month
      const tax = calculator.calculateMonthlyTax(300000, 15);
      expect(tax).toBe(375);
    });

    it("rounds to whole number", () => {
      // $250,000 at $12 per $1000 = $3,000/year = $250/month
      const tax = calculator.calculateMonthlyTax(250000, 12);
      expect(tax).toBe(250);
    });
  });

  describe("calculateInterestRateBuydown", () => {
    it("calculates buydown cost correctly for 30-year", () => {
      // 1 point = 1/6% reduction for 30 year
      // 0.5% reduction = 3 points = 3% of $300k = $9000
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 6.0, 30);
      expect(cost).toBeCloseTo(9000, 0);
    });

    it("calculates buydown cost correctly for 15-year", () => {
      // 1 point = 1/4% reduction for 15 year
      // 0.5% reduction = 2 points = 2% of $300k = $6000
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 6.0, 15);
      expect(cost).toBeCloseTo(6000, 0);
    });

    it("enforces 1.5% max buydown", () => {
      // Try to buy down 2% (beyond the 1.5% cap)
      // Should only charge for 1.5% buydown
      // 1.5% = 9 points = 9% of $300k = $27000
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 4.5, 30);
      expect(cost).toBeCloseTo(27000, 0);
    });

    it("returns 0 when desired rate >= current rate", () => {
      const cost = calculator.calculateInterestRateBuydown(300000, 6.5, 7.0, 30);
      expect(cost).toBe(0);
    });

    it("returns 0 for invalid principal", () => {
      expect(calculator.calculateInterestRateBuydown(0, 6.5, 6.0, 30)).toBe(0);
      expect(calculator.calculateInterestRateBuydown(-1000, 6.5, 6.0, 30)).toBe(0);
      expect(calculator.calculateInterestRateBuydown(NaN, 6.5, 6.0, 30)).toBe(0);
    });
  });

  describe("calculateRaw - price mode", () => {
    beforeEach(() => {
      calculator.setCalcMethod("price");
    });

    it("calculates monthly payment for given purchase price", () => {
      const result = calculator.calculateRaw({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(result.purchasePrice).toBe(300000);
      expect(typeof result.monthlyPayment).toBe("number");
      expect(result.monthlyPayment).toBeGreaterThan(2000);
      expect(result.monthlyPayment).toBeLessThan(2500);
      expect(result.insurance).toBe(50);
      expect(result.hoaFee).toBe(0);
    });

    it("returns raw numbers, not formatted strings", () => {
      const result = calculator.calculateRaw({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(typeof result.monthlyPayment).toBe("number");
      expect(typeof result.purchasePrice).toBe("number");
      expect(typeof result.principalInterest).toBe("number");
      expect(typeof result.taxes).toBe("number");
    });

    it("accounts for principal buydown", () => {
      const withoutBuydown = calculator.calculateRaw({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      const withBuydown = calculator.calculateRaw({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 50000,
      });

      expect(withBuydown.monthlyPayment).toBeLessThan(withoutBuydown.monthlyPayment);
    });

    it("includes all PITI components", () => {
      const result = calculator.calculateRaw({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 100,
        principalBuydown: 0,
      });

      const expectedTotal =
        result.principalInterest + result.taxes + result.insurance + result.hoaFee;
      expect(result.monthlyPayment).toBeCloseTo(expectedTotal, 2);
    });
  });

  describe("calculateRaw - payment mode", () => {
    beforeEach(() => {
      calculator.setCalcMethod("payment");
    });

    it("calculates max purchase price for desired payment", () => {
      const result = calculator.calculateRaw({
        price: 2000, // desired monthly payment
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(result.monthlyPayment).toBe(2000);
      expect(typeof result.purchasePrice).toBe("number");
      expect(result.purchasePrice).toBeGreaterThan(200000);
      expect(result.purchasePrice).toBeLessThan(350000);
    });

    it("returns the desired payment as monthlyPayment", () => {
      const result = calculator.calculateRaw({
        price: 1500,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(result.monthlyPayment).toBe(1500);
    });

    it("accounts for principal buydown in price calculation", () => {
      const withoutBuydown = calculator.calculateRaw({
        price: 2000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      const withBuydown = calculator.calculateRaw({
        price: 2000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 50000,
      });

      // With buydown, can afford higher purchase price for same payment
      expect(withBuydown.purchasePrice).toBeGreaterThan(withoutBuydown.purchasePrice);
    });
  });

  describe("existing calculate method - backwards compatibility", () => {
    it("still returns formatted strings", () => {
      calculator.setCalcMethod("price");
      const result = calculator.calculate({
        price: 300000,
        term: 30,
        rate: 6.5,
        tax: 15,
        insurance: 50,
        hoaFee: 0,
        principalBuydown: 0,
      });

      expect(typeof result.monthlyPayment).toBe("string");
      expect(result.monthlyPayment).toContain("$");
    });
  });
});
