import { Maybe } from "../utils/ts-utils";

export type OBServerVersion = Readonly<{
    /* As OpenBoxes sends it, for example "0.9.7-SNAPSHOT". */
    appVersion: string;
    major: number;
    minor: number;
    patch: number;
}>;

export type OBVersionString = `${number}.${number}.${number}`;

/* The reference version: the SDK inputs and results have its shapes on every server. */
export const OB_REFERENCE_VERSION: OBVersionString = "0.9.7";

/*
 * 1 boolean for each capability: `true` when the server version is the same as, or later than, the first
 * OpenBoxes version that has it (`isAtLeast(version, "x.y.z")`). No workflow of the SDK depends on the
 * server version yet, so there is no capability.
 */
export type OBCapabilities = Readonly<Record<never, boolean>>;

const VERSION_NUMBERS = /^(\d+)\.(\d+)\.(\d+)/;

/* Reads `major.minor.patch` at the start; a suffix such as `-SNAPSHOT` does not change the numbers. */
export function parseVersion(appVersion: Maybe<string>): Maybe<OBServerVersion> {
    const match = appVersion?.match(VERSION_NUMBERS);
    if (!appVersion || !match) return undefined;

    const [, major, minor, patch] = match.map(Number);
    if (major === undefined || minor === undefined || patch === undefined) return undefined;
    return { appVersion, major, minor, patch };
}

/* Negative when `a` is older than `b`, 0 when they are the same, positive when `a` is newer. */
export function compareVersions(a: OBServerVersion, b: OBServerVersion): number {
    return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

export function isAtLeast(version: OBServerVersion, minimum: OBVersionString): boolean {
    const parsedMinimum = parseVersion(minimum);
    return parsedMinimum !== undefined && compareVersions(version, parsedMinimum) >= 0;
}

export function toCapabilities(_version: OBServerVersion): OBCapabilities {
    return {};
}
