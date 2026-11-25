import { describe, expect, it } from "vitest";
import { errorOf } from "../../__tests__/fetchStub";
import { isCancel } from "../../repositories/CancelableResponse";
import { createLocationLock } from "../locationLock";
import { awaitResponse } from "../workflow";
import { fakeRequest, flushPromises } from "./fakeResponse";

const NO_ABORT = new AbortController().signal;

describe("createLocationLock", () => {
    it("starts the second task only after the first one ends", async () => {
        const lock = createLocationLock();
        const requestA = fakeRequest<string>();
        const requestB = fakeRequest<string>();

        const resultA = lock.run(() => awaitResponse(requestA.response, NO_ABORT), NO_ABORT);
        const resultB = lock.run(() => awaitResponse(requestB.response, NO_ABORT), NO_ABORT);
        await flushPromises();
        const startedBWhileARuns = requestB.isStarted();
        requestA.resolve("A");
        await flushPromises();
        requestB.resolve("B");

        expect(startedBWhileARuns).toBe(false);
        expect(await resultA).toEqual("A");
        expect(await resultB).toEqual("B");
    });

    it("runs the next task when the first one fails", async () => {
        const lock = createLocationLock();
        const failure = new Error("403");

        const resultA = errorOf(lock.run(() => Promise.reject(failure), NO_ABORT));
        const resultB = lock.run(() => Promise.resolve("B"), NO_ABORT);

        expect(await resultA).toBe(failure);
        expect(await resultB).toEqual("B");
    });

    it("never runs a task that is aborted while it waits, and keeps the order of the others", async () => {
        const lock = createLocationLock();
        const requestA = fakeRequest<string>();
        const requestB = fakeRequest<string>();
        const requestC = fakeRequest<string>();
        const controllerB = new AbortController();

        const resultA = lock.run(() => awaitResponse(requestA.response, NO_ABORT), NO_ABORT);
        const resultB = errorOf(
            lock.run(() => awaitResponse(requestB.response, NO_ABORT), controllerB.signal)
        );
        const resultC = lock.run(() => awaitResponse(requestC.response, NO_ABORT), NO_ABORT);
        controllerB.abort();
        const errorB = await resultB;
        await flushPromises();
        const startedCWhileARuns = requestC.isStarted();
        requestA.resolve("A");
        await flushPromises();
        requestC.resolve("C");

        expect(isCancel(errorB)).toBe(true);
        expect(requestB.isStarted()).toBe(false);
        expect(startedCWhileARuns).toBe(false);
        expect(await resultA).toEqual("A");
        expect(await resultC).toEqual("C");
    });
});
