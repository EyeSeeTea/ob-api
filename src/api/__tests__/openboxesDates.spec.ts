import { describe, expect, it } from "vitest";
import { formatOptionalDate, toOpenBoxesDate, toOpenBoxesDateTime } from "../openboxesDates";

describe("toOpenBoxesDateTime", () => {
    it("pads month, day, hours and minutes", () => {
        expect(toOpenBoxesDateTime(new Date("2026-06-04T06:05:00Z"))).toEqual("06/04/2026 06:05 Z");
    });

    it("uses UTC, not the local time zone", () => {
        expect(toOpenBoxesDateTime(new Date("2026-06-24T23:30:00-03:00"))).toEqual(
            "06/25/2026 02:30 Z"
        );
    });
});

describe("toOpenBoxesDate", () => {
    it("gives MM/dd/yyyy of the UTC day", () => {
        expect(toOpenBoxesDate(new Date("2026-06-24T23:30:00-03:00"))).toEqual("06/25/2026");
    });
});

describe("formatOptionalDate", () => {
    it("formats a given date with the given format", () => {
        expect(formatOptionalDate(new Date("2026-06-04T06:05:00Z"), toOpenBoxesDate)).toEqual(
            "06/04/2026"
        );
    });

    it("gives undefined for an absent date", () => {
        expect(formatOptionalDate(undefined, toOpenBoxesDate)).toBeUndefined();
    });
});
