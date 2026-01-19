import { describe, it, expect } from "vitest";
import { Either } from "effect";
import { decodeCensusGeocodeResponse } from "./census";
describe("Decoding Census Geocode Response", () => {
    it("parses successful geocode response", () => {
        const mockResponse = {
            result: {
                addressMatches: [
                    {
                        coordinates: { x: -71.0589, y: 42.3601 },
                        geographies: {
                            "Census Tracts": [
                                {
                                    GEOID: "25025010405",
                                    TRACT: "010405",
                                    COUNTY: "025",
                                    STATE: "25",
                                },
                            ],
                        },
                        matchedAddress: "125 MAIN STREET, BALTIMORE, MD 22242 ",
                    },
                ],
            },
        };
        const result = decodeCensusGeocodeResponse(mockResponse);
        expect(Either.isRight(result)).toBeTruthy();
    });
    it("rejects invalid response", () => {
        const mockResponse = {
            result: {
                benchmark: {
                    isDefault: true,
                    benchmarkDescription: "Public Address Ranges - Current Benchmark",
                    id: "4",
                    benchmarkName: "Public_AR_Current",
                },
            },
        };
        const result = decodeCensusGeocodeResponse(mockResponse);
        expect(Either.isLeft(result)).toBeTruthy();
    });
});
