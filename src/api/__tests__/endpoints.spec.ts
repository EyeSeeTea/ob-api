import { afterEach, describe, expect, it, vi } from "vitest";
import { httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { stockMovementBody } from "./endpointFixtures";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("typed request", () => {
    it("requests the path with its parameters and returns the body as OpenBoxes sends it", async () => {
        const body = { data: stockMovementBody({ id: "sm-1", description: null }) };
        const calls = stubServer(() => jsonResponse(body));

        const response = await api()
            .request({ method: "get", path: "/stockMovements/{id}", pathParams: { id: "sm-1" } })
            .getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/stockMovements/sm-1`,
        ]);
        expect(response.data.id).toEqual("sm-1");
        expect(response.data.description).toBeNull();
    });

    it("encodes the path parameters", async () => {
        const calls = stubServer(() => jsonResponse({ data: stockMovementBody() }));

        await api()
            .request({ method: "get", path: "/stockMovements/{id}", pathParams: { id: "a/b c" } })
            .getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/stockMovements/a%2Fb%20c`,
        ]);
    });

    it("sends the query parameters", async () => {
        const calls = stubServer(() => jsonResponse({ data: [], totalCount: 0 }));

        await api()
            .request({ method: "get", path: "/products", params: { max: 5, q: "AMOX" } })
            .getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/products?max=5&q=AMOX`,
        ]);
    });

    it("rejects a response that does not match the endpoint", async () => {
        stubServer(() => jsonResponse({ data: [{ id: "prod-1" }], totalCount: 1 }));

        const error = await httpErrorOf(
            api().request({ method: "get", path: "/products" }).getData()
        );

        expect(error.message).toContain("GET /products");
        expect(error.message).toContain("productCode");
    });

    /* JavaScript callers can reach these checks: the types stop TypeScript callers. */
    it("rejects a path that has no typed endpoint, without a request", async () => {
        const calls = stubServer(() => jsonResponse({}));
        const options = { method: "get", path: "/customModel" } as never;

        await expect(api().request(options).getData()).rejects.toThrow(
            "No typed endpoint for get /customModel"
        );
        expect(requestsAfterLogin(calls())).toEqual([]);
    });

    it("rejects a request without its path parameters, without a request", async () => {
        const calls = stubServer(() => jsonResponse({}));
        const options = { method: "get", path: "/stockMovements/{id}" } as never;

        await expect(api().request(options).getData()).rejects.toThrow(
            "Missing path parameters for get /stockMovements/{id}: id"
        );
        expect(requestsAfterLogin(calls())).toEqual([]);
    });
});

describe("requestUntyped", () => {
    it("sends a request to an endpoint that is not typed and returns the data as received", async () => {
        const calls = stubServer(() => jsonResponse({ anything: [1, 2] }));

        const data = await api()
            .requestUntyped<unknown>({ method: "get", url: "/customModel" })
            .getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/customModel`,
        ]);
        expect(data).toEqual({ anything: [1, 2] });
    });
});

/* Compile-time checks: `yarn typecheck` fails if one of these lines has no type error. */
export function typeErrors(client: ReturnType<typeof api>) {
    // @ts-expect-error: unknown path
    client.request({ method: "get", path: "/stockMovments" });
    // @ts-expect-error: no DELETE endpoint for the path
    client.request({ method: "delete", path: "/stockMovements" });
    // @ts-expect-error: methods are lowercase
    client.request({ method: "GET", path: "/stockMovements" });
    // @ts-expect-error: unknown query parameter
    client.request({ method: "get", path: "/products", params: { color: "red" } });
    // @ts-expect-error: a GET endpoint takes no body
    client.request({ method: "get", path: "/products", data: { name: "Gloves" } });
    // @ts-expect-error: missing pathParams
    client.request({ method: "get", path: "/stockMovements/{id}" });
    // @ts-expect-error: wrong path parameter name
    client.request({ method: "get", path: "/stockMovements/{id}", pathParams: { sm: "1" } });
    // @ts-expect-error: pathParams on a path without parameters
    client.request({ method: "get", path: "/products", pathParams: { id: "1" } });
    // @ts-expect-error: missing required query parameters
    client.request({ method: "get", path: "/products/availableItems" });
    client.request({
        method: "post",
        path: "/generic/person/search",
        // @ts-expect-error: unknown search operator
        data: { searchAttributes: [{ property: "email", operator: "contains", value: "a" }] },
    });
    client.request({
        method: "post",
        path: "/generic/transaction",
        // @ts-expect-error: wrong body field
        data: { transactionTypeId: "tt-1" },
    });
}
