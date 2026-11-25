import { describe, expect, it } from "vitest";
import { errorOf } from "../../__tests__/fetchStub";
import { mapWithConcurrency } from "../concurrency";
import { awaitResponse } from "../workflow";
import { fakeRequest, FakeRequest, flushPromises } from "./fakeResponse";

const NO_ABORT = new AbortController().signal;

const fakeRequests = (count: number): ReadonlyArray<FakeRequest<string>> =>
    Array.from({ length: count }, () => fakeRequest<string>());

const startedCount = (requests: ReadonlyArray<FakeRequest<string>>) =>
    requests.filter(request => request.isStarted()).length;

const awaitEach = (request: FakeRequest<string>, signal: AbortSignal) =>
    awaitResponse(request.response, signal);

describe("mapWithConcurrency", () => {
    it("starts at most `limit` calls, and a new one when a call ends", async () => {
        const requests = fakeRequests(10);

        const result = mapWithConcurrency(requests, 4, awaitEach, NO_ABORT);
        await flushPromises();
        const startedFirst = startedCount(requests);
        requests[0]?.resolve("r0");
        await flushPromises();
        const startedAfterOne = startedCount(requests);
        requests.forEach((request, index) => request.resolve(`r${index}`));
        await result;

        expect(startedFirst).toEqual(4);
        expect(startedAfterOne).toEqual(5);
    });

    it("keeps the order of the items when the calls end in another order", async () => {
        const requests = fakeRequests(3);

        const result = mapWithConcurrency(requests, 3, awaitEach, NO_ABORT);
        await flushPromises();
        requests[2]?.resolve("c");
        requests[0]?.resolve("a");
        requests[1]?.resolve("b");

        expect(await result).toEqual(["a", "b", "c"]);
    });

    it("returns an empty list for no items", async () => {
        expect(await mapWithConcurrency([], 4, awaitEach, NO_ABORT)).toEqual([]);
    });

    it("rejects on the first failure, cancels the calls in progress and starts no new one", async () => {
        const requests = fakeRequests(6);
        const failure = new Error("404");

        const result = errorOf(mapWithConcurrency(requests, 2, awaitEach, NO_ABORT));
        await flushPromises();
        requests[1]?.reject(failure);
        const error = await result;
        await flushPromises();

        expect(error).toBe(failure);
        expect(requests[0]?.isCanceled()).toBe(true);
        expect(startedCount(requests)).toEqual(2);
    });
});
