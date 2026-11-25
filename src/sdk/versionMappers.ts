import { compareVersions, OBServerVersion, OBVersionString, parseVersion } from "./version";

/* `from` is inclusive and `to` is exclusive; a missing bound has no limit. */
export type OBVersionRange = Readonly<{ from?: OBVersionString; to?: OBVersionString }>;

/*
 * Changes the request or the answer of 1 workflow step for a range of server versions, so the caller
 * always sees the shapes of the reference version.
 */
export type VersionMapper<Request, Response> = Readonly<{
    versions: OBVersionRange;
    toRequest?: (request: Request) => Request;
    fromResponse?: (response: Response) => Response;
}>;

export type VersionMapperTable<Request, Response> = ReadonlyArray<VersionMapper<Request, Response>>;

export type SelectedMapper<Request, Response> = Readonly<{
    toRequest: (request: Request) => Request;
    fromResponse: (response: Response) => Response;
}>;

/* The mapper whose range has the version; outside every range, the reference shapes do not change. */
export function selectMapper<Request, Response>(
    table: VersionMapperTable<Request, Response>,
    version: OBServerVersion
): SelectedMapper<Request, Response> {
    const mapper = table.find(entry => isInRange(version, entry.versions));
    return {
        toRequest: mapper?.toRequest ?? identity,
        fromResponse: mapper?.fromResponse ?? identity,
    };
}

export function isInRange(version: OBServerVersion, range: OBVersionRange): boolean {
    const from = parseVersion(range.from);
    const to = parseVersion(range.to);
    return (
        (from === undefined || compareVersions(version, from) >= 0) &&
        (to === undefined || compareVersions(version, to) < 0)
    );
}

function identity<T>(value: T): T {
    return value;
}
