import type { OBApi } from "../api/OBApi";
import { HttpError } from "../repositories/HttpClientRepository";
import { Maybe } from "../utils/ts-utils";
import { LocationLock } from "./locationLock";
import { RetryPolicy, withRetry } from "./retry";
import { OBServerVersion, parseVersion } from "./version";

export type ServerVersionOptions = Readonly<{
    /* `getAppContext` needs a session location: with it, the read chooses this location first. */
    locationId?: string;
}>;

export type ReadServerVersion = (options?: ServerVersionOptions) => Promise<OBServerVersion>;

export type ServerVersionDeps = Readonly<{
    api: Pick<OBApi, "appContext" | "chooseLocation">;
    lock: LocationLock;
    retry: RetryPolicy;
    /* A version from the caller: the SDK uses it and sends no request. */
    version?: string;
}>;

/*
 * Reads the server version once and keeps it. Calls at the same time share the read, and a failed read
 * is cleared so the next call reads again, as the session does with its login.
 */
export function createServerVersionReader(deps: ServerVersionDeps): ReadServerVersion {
    const { api, lock, retry, version } = deps;
    // Parsed on each call: a rejected promise made here, with no caller yet, is an unhandled rejection.
    if (version !== undefined) return () => toServerVersion(version);

    // Never aborted: callers share the read, so 1 caller must not stop it for the others.
    const signal = new AbortController().signal;
    let kept: Maybe<Promise<OBServerVersion>>;

    const readAppVersion = () =>
        withRetry(() => api.appContext.get(), retry, signal).then(
            context => toServerVersion(context.appVersion),
            (error: unknown) => Promise.reject(toVersionReadError(error))
        );

    const read = ({ locationId }: ServerVersionOptions): Promise<OBServerVersion> =>
        locationId === undefined
            ? readAppVersion()
            : lock.run(async () => {
                  await withRetry(() => api.chooseLocation(locationId), retry, signal);
                  return readAppVersion();
              }, signal);

    const readAndKeep = (options: ServerVersionOptions): Promise<OBServerVersion> => {
        const promise = read(options).catch((error: unknown) => {
            if (kept === promise) kept = undefined;
            throw error;
        });
        kept = promise;
        return promise;
    };

    // The shared read may have no location; a caller that gives one reads again with it after a failure.
    const shareRead = (
        shared: Promise<OBServerVersion>,
        options: ServerVersionOptions
    ): Promise<OBServerVersion> =>
        options.locationId === undefined
            ? shared
            : shared.catch(() => kept ?? readAndKeep(options));

    return (options = {}) => (kept ? shareRead(kept, options) : readAndKeep(options));
}

function toServerVersion(appVersion: Maybe<string>): Promise<OBServerVersion> {
    const version = parseVersion(appVersion);
    return version
        ? Promise.resolve(version)
        : Promise.reject(
              new Error(
                  `OpenBoxes version without major.minor.patch numbers: ${JSON.stringify(appVersion)}`
              )
          );
}

/* OpenBoxes answers 500 for getAppContext when the session has no location. */
function toVersionReadError(error: unknown): unknown {
    if (!(error instanceof HttpError) || error.response?.status !== 500) return error;

    return new Error(
        "OpenBoxes answered 500 for getAppContext. The likely cause is a session without a location: " +
            "give a locationId to serverVersion, or log in with a location.",
        { cause: error }
    );
}
