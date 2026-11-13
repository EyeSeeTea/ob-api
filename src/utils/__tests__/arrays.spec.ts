import { describe, expect, it } from "vitest";
import { chunk } from "../arrays";

describe("chunk", () => {
    it("returns no chunks for an empty array", () => {
        expect(chunk([], 2)).toEqual([]);
    });

    it("splits an exact multiple into full chunks", () => {
        expect(chunk([1, 2, 3, 4], 2)).toEqual([
            [1, 2],
            [3, 4],
        ]);
    });

    it("puts the remainder in a last, shorter chunk", () => {
        expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    });

    it("rejects a size that is not a positive integer", () => {
        expect(() => chunk([1], 0)).toThrow("Chunk size must be a positive integer, got 0");
    });
});
