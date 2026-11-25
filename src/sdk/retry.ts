import { CancelableResponse } from "../repositories/CancelableResponse";
import { HttpError } from "../repositories/HttpClientRepository";
import { delay } from "../utils/abort";
import { awaitResponse } from "./workflow";

/* `attempts` counts the first request too, so `attempts: 1` turns the retries off. */
export type RetryPolicy = Readonly<{ attempts: number; delayMs: number }>;

export const DEFAULT_RETRY_POLICY: RetryPolicy = { attempts: 3, delayMs: 500 };

const TEMPORARY_STATUSES: ReadonlySet<number> = new Set([429, 502, 503, 504]);

/*
 * Sends the request again after a temporary failure of a GET, and waits longer before each new
 * attempt. A write is never sent again: a POST that failed may have changed the server.
 */
export function withRetry<T>(
    send: () => CancelableResponse<T>,
    policy: RetryPolicy,
    signal: AbortSignal
): Promise<T> {
    const attempt = (number: number): Promise<T> =>
        awaitResponse(send(), signal).catch(async (error: unknown) => {
            if (number >= policy.attempts || !isTemporaryReadFailure(error)) throw error;
            await delay(policy.delayMs * 2 ** (number - 1), signal);
            return attempt(number + 1);
        });

    return attempt(1);
}

/* A network error or a timeout is an HttpError without a response. An abort is not an HttpError. */
export function isTemporaryReadFailure(error: unknown): boolean {
    if (!(error instanceof HttpError) || error.request.method !== "get") return false;

    const status = error.response?.status;
    return status === undefined || TEMPORARY_STATUSES.has(status);
}
