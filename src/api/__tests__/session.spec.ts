import { afterEach, describe, expect, it, vi } from "vitest";
import { isCancel } from "../../repositories/CancelableResponse";
import {
    BASE_URL,
    bodyOf,
    errorOf,
    FetchCall,
    hangUntilAborted,
    headersOf,
    httpErrorOf,
    JSON_HEADERS,
    jsonResponse,
    SESSION_SET_COOKIE,
    Respond,
    stubFetch,
} from "../../__tests__/fetchStub";
import { OBApi } from "../OBApi";

const AUTH = { username: "user", password: "secret" };
const LOGIN_URL = `${BASE_URL}/openboxes/api/login`;
const PRODUCTS_URL = `${BASE_URL}/openboxes/api/products`;
const UNAUTHORIZED = () => jsonResponse({ errorMessage: "Unauthorized" }, { status: 401 });

const newApi = (locationId?: string) => new OBApi({ baseUrl: BASE_URL, auth: AUTH, locationId });

function loginResponse(): Response {
    return jsonResponse({}, { headers: { ...JSON_HEADERS, "Set-Cookie": SESSION_SET_COOKIE } });
}

function stubServer(respond: Respond) {
    return stubFetch((call, previousCalls) =>
        call.url === LOGIN_URL ? loginResponse() : respond(call, previousCalls)
    );
}

/* Answers the first `count` non-login requests with 401, then 200. */
function expireFirst(count: number): Respond {
    return (_call, previousCalls) =>
        previousCalls.filter(call => call.url !== LOGIN_URL).length < count
            ? UNAUTHORIZED()
            : jsonResponse({ ok: true });
}

const urlsOf = (fetchCalls: ReadonlyArray<FetchCall>) => fetchCalls.map(call => call.url);
const loginsIn = (fetchCalls: ReadonlyArray<FetchCall>) =>
    fetchCalls.filter(call => call.url === LOGIN_URL);

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("Lazy login", () => {
    it("sends no request when the client is created", () => {
        const calls = stubServer(() => jsonResponse({}));

        newApi();

        expect(calls()).toEqual([]);
    });

    it("logs in before the first request", async () => {
        const calls = stubServer(() => jsonResponse({}));

        await newApi().get("/products").getData();

        expect(urlsOf(calls())).toEqual([LOGIN_URL, PRODUCTS_URL]);
        expect(calls()[0]?.init.method).toEqual("POST");
        expect(bodyOf(calls()[0])).toEqual({ username: "user", password: "secret" });
    });

    it("sends the location with the login", async () => {
        const calls = stubServer(() => jsonResponse({}));

        await newApi("L1").get("/products").getData();

        expect(bodyOf(calls()[0])).toEqual({
            username: "user",
            password: "secret",
            location: "L1",
        });
    });

    it("does not log in again for later requests", async () => {
        const calls = stubServer(() => jsonResponse({}));
        const api = newApi();

        await api.get("/products").getData();
        await api.get("/products").getData();

        expect(urlsOf(calls())).toEqual([LOGIN_URL, PRODUCTS_URL, PRODUCTS_URL]);
    });

    it("sends one login for concurrent first requests", async () => {
        const calls = stubServer(() => jsonResponse({}));
        const api = newApi();

        await Promise.all([1, 2, 3].map(() => api.get("/products").getData()));

        expect(urlsOf(calls())).toEqual([LOGIN_URL, PRODUCTS_URL, PRODUCTS_URL, PRODUCTS_URL]);
    });

    it("sends the session cookie from the login response", async () => {
        const calls = stubServer(() => jsonResponse({}));

        await newApi().get("/products").getData();

        expect(headersOf(calls()[1])["cookie"]).toEqual("JSESSIONID=abc");
    });
});

describe("Explicit login", () => {
    it("logs in with a new location and keeps it for later logins", async () => {
        const calls = stubServer(expireFirst(1));
        const api = newApi("L1");

        await api.login("L2");
        await api.get("/products").getData();

        const locations = loginsIn(calls()).map(call => bodyOf(call));
        expect(locations).toEqual([
            { username: "user", password: "secret", location: "L2" },
            { username: "user", password: "secret", location: "L2" },
        ]);
    });

    it("refreshes a valid session with the current location", async () => {
        const calls = stubServer(() => jsonResponse({}));
        const api = newApi("L1");

        await api.get("/products").getData();
        await api.login();

        expect(urlsOf(calls())).toEqual([LOGIN_URL, PRODUCTS_URL, LOGIN_URL]);
        expect(bodyOf(calls()[2])).toEqual({
            username: "user",
            password: "secret",
            location: "L1",
        });
    });
});

describe("Login failure", () => {
    it("rejects the waiting request and does not retry", async () => {
        const calls = stubFetch(call =>
            call.url === LOGIN_URL ? UNAUTHORIZED() : jsonResponse({})
        );

        const error = await httpErrorOf(newApi().get("/products").getData());

        expect(error.response?.status).toEqual(401);
        expect(error.request.url).toEqual("openboxes/api/login");
        expect(urlsOf(calls())).toEqual([LOGIN_URL]);
    });

    it("hides the password in the login error", async () => {
        stubFetch(() => UNAUTHORIZED());

        const error = await httpErrorOf(newApi().login());

        expect(JSON.stringify(error.request)).not.toContain(AUTH.password);
    });

    it("tries to log in again on the next request", async () => {
        const calls = stubFetch((call, previousCalls) => {
            if (call.url !== LOGIN_URL) return jsonResponse({});
            return loginsIn(previousCalls).length === 0 ? UNAUTHORIZED() : loginResponse();
        });
        const api = newApi();

        await errorOf(api.get("/products").getData());
        await api.get("/products").getData();

        expect(urlsOf(calls())).toEqual([LOGIN_URL, LOGIN_URL, PRODUCTS_URL]);
    });
});

describe("Retry after an expired session", () => {
    it("logs in again and repeats the request once", async () => {
        const calls = stubServer(expireFirst(1));

        const data = await newApi().get("/products").getData();

        expect(data).toEqual({ ok: true });
        expect(urlsOf(calls())).toEqual([LOGIN_URL, PRODUCTS_URL, LOGIN_URL, PRODUCTS_URL]);
    });

    it("rejects after a second 401 and does not try again", async () => {
        const calls = stubServer(UNAUTHORIZED);

        const error = await httpErrorOf(newApi().get("/products").getData());

        expect(error.response?.status).toEqual(401);
        expect(urlsOf(calls())).toEqual([LOGIN_URL, PRODUCTS_URL, LOGIN_URL, PRODUCTS_URL]);
    });

    it("retries every method", async () => {
        const api = newApi();
        const sends = [
            () => api.post("/products", undefined, {}),
            () => api.put("/products/1", undefined, {}),
            () => api.patch("/products/1", undefined, []),
            () => api.delete("/products/1"),
        ];

        const results = await sends.reduce<Promise<ReadonlyArray<unknown>>>(
            async (previous, send) => {
                const done = await previous;
                stubServer(expireFirst(1));
                return [...done, await send().getData()];
            },
            Promise.resolve([])
        );

        expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }, { ok: true }]);
    });

    it("sends one login when several requests expire together", async () => {
        const calls = stubServer(expireFirst(3));
        const api = newApi();
        await api.login();

        await Promise.all([1, 2, 3].map(() => api.get("/products").getData()));

        expect(loginsIn(calls())).toHaveLength(2);
        expect(urlsOf(calls()).filter(url => url === PRODUCTS_URL)).toHaveLength(6);
    });

    it("rejects with a cancellation when canceled during the re-login", async () => {
        const calls = stubFetch(call => {
            const logins = loginsIn(calls()).length;
            if (call.url === LOGIN_URL)
                return logins === 1 ? loginResponse() : hangUntilAborted(call);
            return UNAUTHORIZED();
        });
        const response = newApi().get("/products");

        const pending = errorOf(response.getData());
        await vi.waitFor(() => expect(loginsIn(calls())).toHaveLength(2));
        response.cancel();

        expect(isCancel(await pending)).toBe(true);
    });

    it("keeps the cancel message when canceled during the login", async () => {
        stubFetch(call => (call.url === LOGIN_URL ? hangUntilAborted(call) : jsonResponse({})));
        const response = newApi().get("/products");

        const pending = errorOf(response.getData());
        response.cancel("Page closed");
        const error = await pending;

        expect(isCancel(error)).toBe(true);
        expect(error instanceof Error && error.message).toEqual("Page closed");
    });
});
