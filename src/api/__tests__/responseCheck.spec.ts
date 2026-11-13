import { Codec, number, string } from "purify-ts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE_URL, bodyOf, httpErrorOf, jsonResponse, stubFetch } from "../../__tests__/fetchStub";
import { HttpError, HttpRequest } from "../../repositories/HttpClientRepository";
import { OBApi } from "../OBApi";
import { checkResponse, nullish, postChecked } from "../responseCheck";

const REQUEST: HttpRequest = { method: "get", url: "/products" };
const productCodec = Codec.interface({ id: string, quantity: number, lot: nullish(string) });

function responseWith(data: unknown) {
    return { status: 200, headers: {}, data };
}

function checkErrorOf(data: unknown): HttpError {
    try {
        checkResponse(productCodec, REQUEST, responseWith(data));
    } catch (error) {
        if (error instanceof HttpError) return error;
        throw error;
    }
    throw new Error("Expected the check to fail");
}

describe("checkResponse", () => {
    it("returns the declared fields and drops the others", () => {
        const result = checkResponse(
            productCodec,
            REQUEST,
            responseWith({ id: "1", quantity: 2, lot: "L1", color: "red" })
        );

        expect(result).toEqual({ id: "1", quantity: 2, lot: "L1" });
    });

    it("accepts a nullish field that is null or absent", () => {
        expect(
            checkResponse(productCodec, REQUEST, responseWith({ id: "1", quantity: 2, lot: null }))
        ).toEqual({ id: "1", quantity: 2, lot: null });
        expect(
            checkResponse(productCodec, REQUEST, responseWith({ id: "1", quantity: 2 }))
        ).toEqual({ id: "1", quantity: 2 });
    });

    it("rejects a missing field with an HTTP error that names the request and keeps the response", () => {
        const response = responseWith({ quantity: 2 });
        const error = checkErrorOf(response.data);

        expect(error.message).toMatch(/^GET \/products returned an unexpected response: .*"id"/);
        expect(error.request).toEqual(REQUEST);
        expect(error.response).toEqual(response);
    });

    it("rejects a field with a wrong type", () => {
        expect(checkErrorOf({ id: "1", quantity: "2" }).message).toContain('"quantity"');
    });

    it("cuts a long problem to 300 characters", () => {
        const error = checkErrorOf({ quantity: 2, note: "x".repeat(1000) });
        const problem = error.message.replace(
            "GET /products returned an unexpected response: ",
            ""
        );

        expect(problem).toHaveLength(301);
        expect(problem.endsWith("…")).toBe(true);
    });
});

describe("postChecked", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    const api = () => new OBApi({ baseUrl: BASE_URL, auth: { username: "u", password: "p" } });

    it("posts the body and returns the checked data", async () => {
        const calls = stubFetch(() => jsonResponse({ id: "1", quantity: 2 }, { status: 201 }));

        const result = await postChecked(api(), "/items", { name: "x" }, productCodec).getData();

        const [, request] = calls();
        expect(request?.url).toEqual(`${BASE_URL}/openboxes/api/items`);
        expect(request?.init.method).toEqual("POST");
        expect(bodyOf(request)).toEqual({ name: "x" });
        expect(result).toEqual({ id: "1", quantity: 2 });
    });

    it("rejects a response that fails the check", async () => {
        stubFetch(() => jsonResponse({ quantity: 2 }));

        const error = await httpErrorOf(postChecked(api(), "/items", {}, productCodec).getData());

        expect(error.message).toMatch(/^POST \/items returned an unexpected response/);
    });
});
