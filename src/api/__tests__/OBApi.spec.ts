import { afterEach, describe, expect, it, vi } from "vitest";
import {
    BASE_URL,
    bodyOf,
    FetchCall,
    headersOf,
    jsonResponse,
    Respond,
    stubFetch,
} from "../../__tests__/fetchStub";
import { OBApi } from "../OBApi";

const AUTH = { username: "user", password: "secret" };
const LOGIN_URL = `${BASE_URL}/openboxes/api/login`;

function stubServer(respond: Respond = () => jsonResponse({})) {
    return stubFetch((call, previousCalls) =>
        call.url === LOGIN_URL ? jsonResponse({}) : respond(call, previousCalls)
    );
}

function requestsAfterLogin(fetchCalls: ReadonlyArray<FetchCall>): ReadonlyArray<FetchCall> {
    return fetchCalls.filter(call => !call.url.endsWith("/login"));
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("OBApi request methods", () => {
    const api = () => new OBApi({ baseUrl: BASE_URL, auth: AUTH });

    it("sends a get with parameters", async () => {
        const calls = stubServer();

        await api().get("/products", { max: 10 }).getData();

        const [request] = requestsAfterLogin(calls());
        expect(request?.init.method).toEqual("GET");
        expect(request?.url).toEqual(`${BASE_URL}/openboxes/api/products?max=10`);
    });

    it("sends a post with parameters and a JSON body", async () => {
        const calls = stubServer();

        await api().post("/products", { lang: "en" }, { name: "Gloves" }).getData();

        const [request] = requestsAfterLogin(calls());
        expect(request?.init.method).toEqual("POST");
        expect(request?.url).toEqual(`${BASE_URL}/openboxes/api/products?lang=en`);
        expect(bodyOf(request)).toEqual({ name: "Gloves" });
    });

    it("sends a put with a JSON body", async () => {
        const calls = stubServer();

        await api().put("/products/1", undefined, { name: "Masks" }).getData();

        const [request] = requestsAfterLogin(calls());
        expect(request?.init.method).toEqual("PUT");
        expect(bodyOf(request)).toEqual({ name: "Masks" });
    });

    it("sends a patch as JSON Patch", async () => {
        const calls = stubServer();
        const operations = [{ op: "replace", path: "/name", value: "X" }];

        await api().patch("/products/1", undefined, operations).getData();

        const [request] = requestsAfterLogin(calls());
        expect(request?.init.method).toEqual("PATCH");
        expect(headersOf(request)["content-type"]).toEqual("application/json-patch+json");
        expect(bodyOf(request)).toEqual(operations);
    });

    it("sends a delete", async () => {
        const calls = stubServer();

        await api().delete("/products/1").getData();

        const [request] = requestsAfterLogin(calls());
        expect(request?.init.method).toEqual("DELETE");
        expect(request?.url).toEqual(`${BASE_URL}/openboxes/api/products/1`);
    });
});

describe("OBApi URLs", () => {
    it("uses a custom API path", async () => {
        const calls = stubFetch(() => jsonResponse({}));
        const api = new OBApi({ baseUrl: `${BASE_URL}/`, auth: AUTH, apiPath: "api" });

        await api.get("products").getData();

        expect(calls().map(call => call.url)).toEqual([
            `${BASE_URL}/api/login`,
            `${BASE_URL}/api/products`,
        ]);
    });
});

describe("OBApi responses", () => {
    it("returns the body as received, without unwrapping data", async () => {
        stubServer(() => jsonResponse({ data: [{ id: "1" }] }));
        const api = new OBApi({ baseUrl: BASE_URL, auth: AUTH });

        expect(await api.get("/products").getData()).toEqual({ data: [{ id: "1" }] });
    });
});
