import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorOf, httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { isCancel } from "../../repositories/CancelableResponse";
import { requestsAfterLogin, stubServer, testApi } from "../../api/__tests__/endpointServer";
import { DEFAULT_RETRY_POLICY, withRetry } from "../retry";

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

const OK_BODY = { ok: true };

/* Answers the requests after the login with the given statuses, one each, then 200. */
function stubStatuses(statuses: ReadonlyArray<number>) {
    return stubServer((_call, previousCalls) => {
        const status = statuses[requestsAfterLogin(previousCalls).length];
        return status === undefined
            ? jsonResponse(OK_BODY)
            : jsonResponse({ error: status }, { status });
    });
}

const requestCount = (calls: ReturnType<typeof stubStatuses>) => requestsAfterLogin(calls()).length;

describe("withRetry", () => {
    it("sends a GET again after a temporary failure, after 500 ms", async () => {
        const calls = stubStatuses([503]);
        const api = testApi();
        const signal = new AbortController().signal;

        const result = withRetry(() => api.get("items"), DEFAULT_RETRY_POLICY, signal);
        await vi.advanceTimersByTimeAsync(499);
        const countBeforeDelay = requestCount(calls);
        await vi.advanceTimersByTimeAsync(1);

        expect(countBeforeDelay).toEqual(1);
        expect(await result).toEqual(OK_BODY);
        expect(requestCount(calls)).toEqual(2);
    });

    it("waits 500 ms, then 1000 ms, after 2 temporary failures", async () => {
        const calls = stubStatuses([503, 502]);
        const api = testApi();
        const signal = new AbortController().signal;

        const result = withRetry(() => api.get("items"), DEFAULT_RETRY_POLICY, signal);
        await vi.advanceTimersByTimeAsync(500);
        await vi.advanceTimersByTimeAsync(999);
        const countBeforeSecondDelay = requestCount(calls);
        await vi.advanceTimersByTimeAsync(1);

        expect(countBeforeSecondDelay).toEqual(2);
        expect(await result).toEqual(OK_BODY);
        expect(requestCount(calls)).toEqual(3);
    });

    it("rejects with the last error after the last attempt", async () => {
        const calls = stubStatuses([503, 503, 429]);
        const api = testApi();
        const signal = new AbortController().signal;

        const result = httpErrorOf(withRetry(() => api.get("items"), DEFAULT_RETRY_POLICY, signal));
        await vi.advanceTimersByTimeAsync(1500);

        expect((await result).response?.status).toEqual(429);
        expect(requestCount(calls)).toEqual(3);
    });

    it("does not send a write again", async () => {
        const calls = stubStatuses([503]);
        const api = testApi();
        const signal = new AbortController().signal;

        const error = await httpErrorOf(
            withRetry(() => api.post("items", {}, {}), DEFAULT_RETRY_POLICY, signal)
        );

        expect(error.response?.status).toEqual(503);
        expect(requestCount(calls)).toEqual(1);
    });

    it("does not send a GET again after a client error", async () => {
        const calls = stubStatuses([404]);
        const api = testApi();
        const signal = new AbortController().signal;

        const error = await httpErrorOf(
            withRetry(() => api.get("items"), DEFAULT_RETRY_POLICY, signal)
        );

        expect(error.response?.status).toEqual(404);
        expect(requestCount(calls)).toEqual(1);
    });

    it("sends a GET again after a network error", async () => {
        let failed = false;
        const calls = stubServer(() => {
            if (failed) return jsonResponse(OK_BODY);
            failed = true;
            throw new TypeError("fetch failed");
        });
        const api = testApi();
        const signal = new AbortController().signal;

        const result = withRetry(() => api.get("items"), DEFAULT_RETRY_POLICY, signal);
        await vi.advanceTimersByTimeAsync(500);

        expect(await result).toEqual(OK_BODY);
        expect(requestsAfterLogin(calls()).length).toEqual(2);
    });

    it("turns the retries off with 1 attempt", async () => {
        const calls = stubStatuses([503]);
        const api = testApi();
        const signal = new AbortController().signal;
        const policy = { ...DEFAULT_RETRY_POLICY, attempts: 1 };

        const error = await httpErrorOf(withRetry(() => api.get("items"), policy, signal));

        expect(error.response?.status).toEqual(503);
        expect(requestCount(calls)).toEqual(1);
    });

    it("stops during the wait when the caller cancels", async () => {
        const calls = stubStatuses([503]);
        const api = testApi();
        const controller = new AbortController();

        const result = errorOf(
            withRetry(() => api.get("items"), DEFAULT_RETRY_POLICY, controller.signal)
        );
        await vi.advanceTimersByTimeAsync(100);
        controller.abort();
        await vi.advanceTimersByTimeAsync(1000);

        expect(isCancel(await result)).toBe(true);
        expect(requestCount(calls)).toEqual(1);
    });
});
