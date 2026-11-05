import { CancelableResponse, toAbortReason } from "../repositories/CancelableResponse";
import {
    Credentials,
    HttpClientRepository,
    HttpClientResponse,
    HttpError,
    HttpRequest,
} from "../repositories/HttpClientRepository";
import { Maybe } from "../utils/ts-utils";

export type Session = Readonly<{
    send<Data>(request: HttpRequest): CancelableResponse<Data>;
    login(locationId?: string): Promise<void>;
}>;

export type SessionOptions = Readonly<{
    httpClient: HttpClientRepository;
    loginUrl: string;
    auth: Credentials;
    locationId?: string;
}>;

/*
 * Holds the mutable session state in one closure: the login in progress (or done) and the location
 * of the last successful login.
 * Requests that need a login share the same promise, so concurrent requests cause one login.
 */
export function createSession(options: SessionOptions): Session {
    const { httpClient, loginUrl, auth } = options;
    let locationId = options.locationId;
    let loginPromise: Maybe<Promise<void>>;

    function startLogin(loginLocationId = locationId): Promise<void> {
        const request: HttpRequest = {
            method: "post",
            url: loginUrl,
            data: {
                username: auth.username,
                password: auth.password,
                ...(loginLocationId ? { location: loginLocationId } : {}),
            },
        };

        const promise: Promise<void> = httpClient
            .request<unknown>(request)
            .response()
            .then(
                // Keep the location only when the server accepted it, so a failed change does not
                // break later automatic logins.
                () => {
                    locationId = loginLocationId;
                },
                (error: unknown) => {
                    // Clear the failed login so the next request tries again.
                    if (loginPromise === promise) loginPromise = undefined;
                    throw withoutPassword(error);
                }
            );

        loginPromise = promise;
        return promise;
    }

    function sendOnce<Data>(
        request: HttpRequest,
        signal: AbortSignal
    ): Promise<HttpClientResponse<Data>> {
        if (signal.aborted) return Promise.reject(signal.reason);

        const inner = httpClient.request<Data>(request);
        const cancelInner = () => inner.cancel();
        signal.addEventListener("abort", cancelInner, { once: true });

        return untilAborted(inner.response(), signal).finally(() =>
            signal.removeEventListener("abort", cancelInner)
        );
    }

    function send<Data>(request: HttpRequest): CancelableResponse<Data> {
        const controller = new AbortController();
        const { signal } = controller;

        const response = async (): Promise<HttpClientResponse<Data>> => {
            const usedLogin = loginPromise ?? startLogin();
            await untilAborted(usedLogin, signal);

            try {
                return await sendOnce<Data>(request, signal);
            } catch (error) {
                if (!isUnauthorized(error)) throw error;

                // Reuse a newer login started by another expired request; never retry twice.
                const relogin =
                    loginPromise !== undefined && loginPromise !== usedLogin
                        ? loginPromise
                        : startLogin();
                await untilAborted(relogin, signal);
                return sendOnce<Data>(request, signal);
            }
        };

        const cancel = (message?: string) => controller.abort(toAbortReason(message));
        return CancelableResponse.build({ cancel, response });
    }

    function login(newLocationId?: string): Promise<void> {
        return startLogin(newLocationId);
    }

    return { send, login };
}

function isUnauthorized(error: unknown): boolean {
    return error instanceof HttpError && error.response?.status === 401;
}

function withoutPassword(error: unknown): unknown {
    if (!(error instanceof HttpError)) return error;

    const request = { ...error.request, data: "[login body hidden]" };
    return new HttpError(error.message, { request, response: error.response });
}

/* Rejects with the abort reason as soon as the signal aborts, even when `promise` never settles. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(signal.reason);

    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
    });
}
