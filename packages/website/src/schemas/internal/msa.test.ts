import { describe, it, expect } from "vitest";
import { decodeMsaLookupSchema, type MsaLookSchemaType } from "./msa";
import { Either } from "effect";

describe("Decoding MSA Lookup Schema", () => {
  it("parses valid MSA lookup data with all fields", () => {
    const mockData = {
      thirty_year_rate: "6.5",
      twenty_year_rate: "6.25",
      fifteen_year_rate: "5.75",
      created_at: "2024-01-15T10:30:00Z",
      address: "123 Main St, New York, NY 10001",
      msaMedianFamilyIncome: 75000,
      tractMedianFamilyIncome: 65000,
      tractPercentOfMsa: 0.87,
      year: 2024,
    };
    const result = decodeMsaLookupSchema(mockData);

    expect(Either.isRight(result)).toBeTruthy();
    if (Either.isRight(result)) {
      expect(result.right.thirty_year_rate).toBe(6.5);
      expect(result.right.twenty_year_rate).toBe(6.25);
      expect(result.right.fifteen_year_rate).toBe(5.75);
      expect(result.right.created_at).toBeInstanceOf(Date);
      expect(result.right.address).toBe("123 Main St, New York, NY 10001");
      expect(result.right.msaMedianFamilyIncome).toBe(75000);
      expect(result.right.tractMedianFamilyIncome).toBe(65000);
      expect(result.right.tractPercentOfMsa).toBe(0.87);
      expect(result.right.year).toBe(2024);
    }
  });

  it("parses valid MSA lookup data without created_at", () => {
    const mockData = {
      thirty_year_rate: "6.5",
      twenty_year_rate: "6.25",
      fifteen_year_rate: "5.75",
      address: "123 Main St, New York, NY 10001",
      msaMedianFamilyIncome: 75000,
      tractMedianFamilyIncome: 65000,
      tractPercentOfMsa: 0.87,
      year: 2024,
    };
    const result = decodeMsaLookupSchema(mockData);

    expect(Either.isRight(result)).toBeTruthy();
    if (Either.isRight(result)) {
      expect(result.right.thirty_year_rate).toBe(6.5);
      expect(result.right.twenty_year_rate).toBe(6.25);
      expect(result.right.fifteen_year_rate).toBe(5.75);
      expect(result.right.created_at).toBeUndefined();
      expect(result.right.address).toBe("123 Main St, New York, NY 10001");
      expect(result.right.msaMedianFamilyIncome).toBe(75000);
      expect(result.right.tractMedianFamilyIncome).toBe(65000);
      expect(result.right.tractPercentOfMsa).toBe(0.87);
      expect(result.right.year).toBe(2024);
    }
  });

  it("ignores extra key value pairs", () => {
    const mockData = {
      thirty_year_rate: "6.5",
      twenty_year_rate: "6.25",
      fifteen_year_rate: "5.75",
      created_at: "2024-01-15T10:30:00Z",
      address: "123 Main St, New York, NY 10001",
      msaMedianFamilyIncome: 75000,
      tractMedianFamilyIncome: 65000,
      tractPercentOfMsa: 0.87,
      year: 2024,
      extra_field: "some value",
      another_field: 123,
    };
    const result = decodeMsaLookupSchema(mockData);

    expect(Either.isRight(result)).toBeTruthy();
  });

  it("fails parsing when one required field is missing", () => {
    const mockData = {
      thirty_year_rate: "6.5",
      twenty_year_rate: "6.25",
      fifteen_year_rate: "5.75",
      created_at: "2024-01-15T10:30:00Z",
      // address is missing
      msaMedianFamilyIncome: 75000,
      tractMedianFamilyIncome: 65000,
      tractPercentOfMsa: 0.87,
      year: 2024,
    };
    const result = decodeMsaLookupSchema(mockData);

    expect(Either.isLeft(result)).toBeTruthy();
  });
});
