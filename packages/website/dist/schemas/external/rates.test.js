import { describe, it, expect } from "vitest";
import { decodeNacaMortgageRates, NacaMortgageRatesEquivalence, } from "./rates";
import { Either } from "effect";
describe("Decoding NACA Mortgage Rates", () => {
    it("parses valid mortgage rates with all fields", () => {
        const mockRates = {
            thirty_year_rate: "6.5",
            twenty_year_rate: "6.25",
            fifteen_year_rate: "5.75",
            created_at: "2024-01-15T10:30:00Z",
        };
        const result = decodeNacaMortgageRates(mockRates);
        expect(Either.isRight(result)).toBeTruthy();
        if (Either.isRight(result)) {
            expect(result.right.thirty_year_rate).toBe(6.5);
            expect(result.right.twenty_year_rate).toBe(6.25);
            expect(result.right.fifteen_year_rate).toBe(5.75);
            expect(result.right.created_at).toBeInstanceOf(Date);
        }
    });
    it("parses valid mortgage rates without created_at", () => {
        const mockRates = {
            thirty_year_rate: "6.5",
            twenty_year_rate: "6.25",
            fifteen_year_rate: "5.75",
        };
        const result = decodeNacaMortgageRates(mockRates);
        expect(Either.isRight(result)).toBeTruthy();
        if (Either.isRight(result)) {
            expect(result.right.thirty_year_rate).toBe(6.5);
            expect(result.right.twenty_year_rate).toBe(6.25);
            expect(result.right.fifteen_year_rate).toBe(5.75);
            expect(result.right.created_at).toBeUndefined();
        }
    });
    it("parses valid mortgage rates with extra key-value pairs", () => {
        const mockRates = {
            thirty_year_rate: "6.5",
            twenty_year_rate: "6.25",
            fifteen_year_rate: "5.75",
            created_at: "2024-01-15T10:30:00Z",
            extra_field: "some value",
            another_field: 123,
        };
        const result = decodeNacaMortgageRates(mockRates);
        expect(Either.isRight(result)).toBeTruthy();
        if (Either.isRight(result)) {
            expect(result.right.thirty_year_rate).toBe(6.5);
            expect(result.right.twenty_year_rate).toBe(6.25);
            expect(result.right.fifteen_year_rate).toBe(5.75);
            expect(result.right.extra_field).toBe("some value");
            expect(result.right.another_field).toBe(123);
        }
    });
    it("fails parsing when one rate value is missing", () => {
        const mockRates = {
            thirty_year_rate: "6.5",
            twenty_year_rate: "6.25",
            // fifteen_year_rate is missing
            created_at: "2024-01-15T10:30:00Z",
        };
        const result = decodeNacaMortgageRates(mockRates);
        expect(Either.isLeft(result)).toBeTruthy();
    });
});
describe("NacaMortgageRates Equivalence", () => {
    it("considers rates equal when rate values match, even with different created_at and extra properties", () => {
        const rate1 = {
            thirty_year_rate: 6.5,
            twenty_year_rate: 6.25,
            fifteen_year_rate: 5.75,
            created_at: new Date("2024-01-15T10:30:00Z"),
            extra_field: "value1",
            another_prop: 123,
        };
        const rate2 = {
            thirty_year_rate: 6.5,
            twenty_year_rate: 6.25,
            fifteen_year_rate: 5.75,
            created_at: new Date("2024-02-20T14:45:00Z"), // Different date
            extra_field: "value2", // Different value
            another_prop: 456, // Different value
        };
        expect(NacaMortgageRatesEquivalence(rate1, rate2)).toBe(true);
    });
    it("considers rates not equal when any rate value differs", () => {
        const rate1 = {
            thirty_year_rate: 6.5,
            twenty_year_rate: 6.25,
            fifteen_year_rate: 5.75,
            created_at: new Date("2024-01-15T10:30:00Z"),
        };
        const rate2 = {
            thirty_year_rate: 6.5,
            twenty_year_rate: 6.25,
            fifteen_year_rate: 5.8, // Different rate
            created_at: new Date("2024-01-15T10:30:00Z"), // Same date
        };
        expect(NacaMortgageRatesEquivalence(rate1, rate2)).toBe(false);
    });
});
