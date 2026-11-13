import { describe, expect, it, vi } from "vitest";
import { CancelableResponse, isCancel } from "../CancelableResponse";
import { HttpClientResponse } from "../HttpClientRepository";

function responseOf<Data>(data: Data): HttpClientResponse<Data> {
    return { status: 200, data, headers: {} };
}

function buildResponse<Data>(data: Data, cancel = vi.fn()) {
    return CancelableResponse.build({ cancel, response: () => Promise.resolve(responseOf(data)) });
}

describe("CancelableResponse", () => {
    it("returns the response data", async () => {
        expect(await buildResponse({ id: "1" }).getData()).toEqual({ id: "1" });
    });

    it("maps the response data and keeps the status", async () => {
        const mapped = buildResponse(2).map(({ data }) => data * 10);

        expect(await mapped.response()).toEqual({ status: 200, data: 20, headers: {} });
    });

    it("chains a second response with flatMap", async () => {
        const chained = buildResponse("a").flatMap(({ data }) => buildResponse(`${data}b`));

        expect(await chained.getData()).toEqual("ab");
    });

    it("cancels both responses of a flatMap", async () => {
        const cancelFirst = vi.fn();
        const cancelSecond = vi.fn();
        const chained = buildResponse(1, cancelFirst).flatMap(() => buildResponse(2, cancelSecond));

        await chained.getData();
        chained.cancel();

        expect(cancelFirst).toHaveBeenCalledTimes(1);
        expect(cancelSecond).toHaveBeenCalledTimes(1);
    });
});

describe("isCancel", () => {
    it("accepts an AbortError", () => {
        expect(isCancel(new DOMException("aborted", "AbortError"))).toBe(true);
    });

    it("rejects other errors", () => {
        expect(isCancel(new Error("boom"))).toBe(false);
        expect(isCancel(undefined)).toBe(false);
    });
});
