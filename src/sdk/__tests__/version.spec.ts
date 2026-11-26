import { describe, expect, it } from "vitest";
import {
    compareVersions,
    isAtLeast,
    OBServerVersion,
    parseVersion,
    toCapabilities,
} from "../version";
import { isInRange, selectMapper, VersionMapperTable } from "../versionMappers";

const version = (appVersion: string): OBServerVersion => {
    const parsed = parseVersion(appVersion);
    if (!parsed) throw new Error(`Test version without numbers: ${appVersion}`);
    return parsed;
};

describe("parseVersion", () => {
    it("reads the numbers and ignores a suffix", () => {
        expect(parseVersion("0.9.7-SNAPSHOT")).toEqual({
            appVersion: "0.9.7-SNAPSHOT",
            major: 0,
            minor: 9,
            patch: 7,
        });
    });

    it("reads numbers with more than 1 digit", () => {
        expect(parseVersion("0.8.22")).toMatchObject({ minor: 8, patch: 22 });
    });

    it.each([undefined, "", "unknown", "0.9", "v0.9.7"])("gives no version for %j", value => {
        expect(parseVersion(value)).toBeUndefined();
    });
});

describe("compareVersions and isAtLeast", () => {
    it("compares the numbers, not the text", () => {
        expect(compareVersions(version("0.8.22"), version("0.8.3"))).toBeGreaterThan(0);
        expect(compareVersions(version("0.9.7-SNAPSHOT"), version("0.9.7"))).toEqual(0);
    });

    it("is false for a capability that starts after the server version", () => {
        expect(isAtLeast(version("0.8.22"), "0.9.0")).toBe(false);
    });

    it("is true from the first version that has the capability", () => {
        expect(isAtLeast(version("0.9.0"), "0.9.0")).toBe(true);
        expect(isAtLeast(version("1.0.0"), "0.9.0")).toBe(true);
    });
});

describe("toCapabilities", () => {
    it("has no capability yet", () => {
        expect(toCapabilities(version("0.9.7"))).toEqual({});
    });
});

describe("selectMapper", () => {
    const OLD_SHAPE: VersionMapperTable<{ ouMode: string }, { total: number }> = [
        {
            versions: { from: "0.8.0", to: "0.9.0" },
            toRequest: request => ({ ...request, ouMode: request.ouMode.toLowerCase() }),
            fromResponse: response => ({ total: response.total * 10 }),
        },
    ];

    it("uses the mapper whose range has the version", () => {
        const mapper = selectMapper(OLD_SHAPE, version("0.8.22"));

        expect(mapper.toRequest({ ouMode: "ALL" })).toEqual({ ouMode: "all" });
        expect(mapper.fromResponse({ total: 2 })).toEqual({ total: 20 });
    });

    it("keeps the reference shapes outside every range", () => {
        const mapper = selectMapper(OLD_SHAPE, version("0.9.7"));

        expect(mapper.toRequest({ ouMode: "ALL" })).toEqual({ ouMode: "ALL" });
        expect(mapper.fromResponse({ total: 2 })).toEqual({ total: 2 });
    });

    it("includes `from` and excludes `to`", () => {
        const range = { from: "0.8.0", to: "0.9.0" } as const;

        expect(isInRange(version("0.8.0"), range)).toBe(true);
        expect(isInRange(version("0.8.99"), range)).toBe(true);
        expect(isInRange(version("0.9.0"), range)).toBe(false);
        expect(isInRange(version("0.7.9"), range)).toBe(false);
    });

    it("has no limit for a missing bound", () => {
        expect(isInRange(version("0.1.0"), { to: "0.9.0" })).toBe(true);
        expect(isInRange(version("9.0.0"), { from: "0.9.0" })).toBe(true);
    });
});
