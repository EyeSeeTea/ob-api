import { describe, expect, it } from "vitest";
import { errorOf } from "../../__tests__/fetchStub";
import { isCancel } from "../../repositories/CancelableResponse";
import { runWorkflow } from "../workflow";
import { fakeRequest, flushPromises } from "./fakeResponse";

describe("runWorkflow", () => {
    it("returns the result of the workflow body", async () => {
        const first = fakeRequest<number>();
        const second = fakeRequest<number>();
        const workflow = runWorkflow(async ({ step }) => {
            const a = await step(first.response);
            const b = await step(second.response);
            return a + b;
        });

        const result = workflow.getData();
        first.resolve(2);
        await flushPromises();
        second.resolve(3);

        expect(await result).toEqual(5);
    });

    it("cancels the request in progress and starts no later request", async () => {
        const first = fakeRequest<number>();
        const second = fakeRequest<number>();
        const third = fakeRequest<number>();
        const workflow = runWorkflow(async ({ step }) => {
            await step(first.response);
            await step(second.response);
            return step(third.response);
        });

        const result = errorOf(workflow.getData());
        first.resolve(1);
        await flushPromises();
        workflow.cancel();
        const error = await result;
        await flushPromises();

        expect(second.isCanceled()).toBe(true);
        expect(third.isStarted()).toBe(false);
        expect(isCancel(error)).toBe(true);
    });

    it("keeps the cancel message in the abort error", async () => {
        const first = fakeRequest<number>();
        const workflow = runWorkflow(({ step }) => step(first.response));

        const result = errorOf(workflow.getData());
        await flushPromises();
        workflow.cancel("user left");

        expect(await result).toMatchObject({ name: "AbortError", message: "user left" });
    });

    it("sends no request after a cancel before the start", async () => {
        const first = fakeRequest<number>();
        const workflow = runWorkflow(({ step }) => step(first.response));

        workflow.cancel();
        const error = await errorOf(workflow.getData());

        expect(isCancel(error)).toBe(true);
        expect(first.isStarted()).toBe(false);
    });
});
