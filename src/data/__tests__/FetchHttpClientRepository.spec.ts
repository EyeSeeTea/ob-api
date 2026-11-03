import { afterEach, describe, expect, it, vi } from "vitest";
import { isCancel } from "../../repositories/CancelableResponse";
import { HttpError, HttpRequest } from "../../repositories/HttpClientRepository";
import {
    BASE_URL,
    errorOf,
    hangUntilAborted,
    headersOf,
    httpErrorOf,
    JSON_HEADERS,
    jsonResponse,
    SESSION_SET_COOKIE,
    stubFetch,
} from "../../__tests__/fetchStub";
import { FetchHttpClientRepository } from "../FetchHttpClientRepository";

function getRequest(overrides: Partial<HttpRequest> = {}): HttpRequest {
    return { method: "get", url: "openboxes/api/products", ...overrides };
}

const repository = () => new FetchHttpClientRepository({ baseUrl: BASE_URL });

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("FetchHttpClientRepository requests", () => {
    it("builds the full URL with the query string", async () => {
        const calls = stubFetch(() => Promise.resolve(jsonResponse([])));

        await repository()
            .request(getRequest({ params: { max: 10, id: ["1", "2"] } }))
            .getData();

        expect(calls()[0]?.url).toEqual(`${BASE_URL}/openboxes/api/products?max=10&id=1&id=2`);
    });

    it("sends a JSON body with its content type", async () => {
        const calls = stubFetch(() => Promise.resolve(jsonResponse({})));

        await repository()
            .request(getRequest({ method: "post", data: { name: "Gloves" } }))
            .getData();

        expect(calls()[0]?.init.method).toEqual("POST");
        expect(calls()[0]?.init.body).toEqual('{"name":"Gloves"}');
        expect(headersOf(calls()[0])["content-type"]).toEqual("application/json;charset=UTF-8");
    });

    it("upper-cases the patch method and lets custom headers win", async () => {
        const calls = stubFetch(() => Promise.resolve(jsonResponse({})));
        const headers = { "Content-Type": "application/json-patch+json" };

        await repository()
            .request(getRequest({ method: "patch", data: [], headers }))
            .getData();

        expect(calls()[0]?.init.method).toEqual("PATCH");
        expect(headersOf(calls()[0])["content-type"]).toEqual("application/json-patch+json");
    });

    it("includes browser credentials", async () => {
        const calls = stubFetch(() => Promise.resolve(jsonResponse({})));

        await repository().request(getRequest()).getData();

        expect(calls()[0]?.init.credentials).toEqual("include");
    });

    it("parses a JSON body and keeps a text body as text", async () => {
        stubFetch(({ url }) =>
            Promise.resolve(
                url.endsWith("json") ? jsonResponse({ data: [1] }) : new Response("plain text")
            )
        );

        expect(
            await repository()
                .request(getRequest({ url: "json" }))
                .getData()
        ).toEqual({
            data: [1],
        });
        expect(
            await repository()
                .request(getRequest({ url: "text" }))
                .getData()
        ).toEqual("plain text");
    });

    it("returns status and headers", async () => {
        stubFetch(() => Promise.resolve(jsonResponse({}, { status: 201 })));

        const response = await repository().request(getRequest()).response();

        expect(response.status).toEqual(201);
        expect(response.headers["content-type"]).toEqual("application/json");
    });
});

describe("FetchHttpClientRepository session cookie", () => {
    it("sends the cookie from an earlier response", async () => {
        const calls = stubFetch(() =>
            Promise.resolve(
                jsonResponse({}, { headers: { ...JSON_HEADERS, "Set-Cookie": SESSION_SET_COOKIE } })
            )
        );
        const client = repository();

        await client.request(getRequest({ url: "login", method: "post" })).getData();
        await client.request(getRequest()).getData();

        expect(headersOf(calls()[0])["cookie"]).toBeUndefined();
        expect(headersOf(calls()[1])["cookie"]).toEqual("JSESSIONID=abc");
    });

    it("sends no cookie header when no cookie was readable, as in the browser", async () => {
        const calls = stubFetch(() => Promise.resolve(jsonResponse({})));
        const client = repository();

        await client.request(getRequest()).getData();
        await client.request(getRequest()).getData();

        expect(headersOf(calls()[1])["cookie"]).toBeUndefined();
    });

    it("works in a browser without getSetCookie", async () => {
        const calls = stubFetch(() => {
            const response = jsonResponse({ ok: true });
            Object.defineProperty(response.headers, "getSetCookie", { value: undefined });
            return Promise.resolve(response);
        });
        const client = repository();

        const data = await client.request(getRequest()).getData();
        await client.request(getRequest()).getData();

        expect(data).toEqual({ ok: true });
        expect(headersOf(calls()[1])["cookie"]).toBeUndefined();
    });
});

describe("FetchHttpClientRepository errors", () => {
    it("rejects a non-2xx response with an HTTP error that holds the response", async () => {
        stubFetch(() => Promise.resolve(jsonResponse({ errorMessage: "boom" }, { status: 500 })));
        const request = getRequest();

        const error = await httpErrorOf(repository().request(request).getData());

        expect(error.request).toEqual(request);
        expect(error.response?.status).toEqual(500);
        expect(error.response?.data).toEqual({ errorMessage: "boom" });
    });

    it("rejects a body that is not valid JSON with an HTTP error that keeps the status", async () => {
        stubFetch(() =>
            Promise.resolve(new Response("<html>Login</html>", { headers: JSON_HEADERS }))
        );

        const error = await httpErrorOf(repository().request(getRequest()).getData());

        expect(error.message).toEqual(
            "GET openboxes/api/products returned invalid JSON with status 200"
        );
        expect(error.response?.status).toEqual(200);
        expect(error.response?.data).toEqual("<html>Login</html>");
    });

    it("rejects a network failure with an HTTP error without a response", async () => {
        stubFetch(() => Promise.reject(new TypeError("fetch failed")));

        const error = await httpErrorOf(repository().request(getRequest()).getData());

        expect(error.message).toEqual("openboxes/api/products: fetch failed");
        expect(error.response).toBeUndefined();
    });

    it("aborts a slow request after the timeout with an HTTP error", async () => {
        const calls = stubFetch(hangUntilAborted);
        const client = new FetchHttpClientRepository({ baseUrl: BASE_URL, timeout: 10 });

        const error = await httpErrorOf(client.request(getRequest()).getData());

        expect(calls()[0]?.init.signal?.aborted).toBe(true);
        expect(error.message).toEqual("openboxes/api/products: request timed out");
        expect(isCancel(error)).toBe(false);
    });

    it("rejects a canceled request with a cancellation", async () => {
        stubFetch(hangUntilAborted);
        const response = repository().request(getRequest());

        const pending = errorOf(response.getData());
        response.cancel();
        const error = await pending;

        expect(isCancel(error)).toBe(true);
        expect(error).not.toBeInstanceOf(HttpError);
    });

    it("keeps the cancel message", async () => {
        stubFetch(hangUntilAborted);
        const response = repository().request(getRequest());

        const pending = errorOf(response.getData());
        response.cancel("Page closed");
        const error = await pending;

        expect(isCancel(error)).toBe(true);
        expect(error instanceof Error && error.message).toEqual("Page closed");
    });
});
