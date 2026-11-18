import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchCall, httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { availableItemBody, productBody } from "./endpointFixtures";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

const AVAILABLE_ITEMS_URL = `${API_URL}/products/availableItems`;

function productIdsOf(call: FetchCall): ReadonlyArray<string> {
    return new URL(call.url).searchParams.getAll("product.id");
}

function ids(count: number, from = 0): ReadonlyArray<string> {
    return Array.from({ length: count }, (_, index) => `p${from + index}`);
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("products.list", () => {
    it("logs in, then requests a page with the parameters", async () => {
        const calls = stubServer(() => jsonResponse({ data: [], totalCount: 0 }));

        await api().products.list({ max: 2, offset: 0, q: "AMOX" }).getData();

        expect(calls().map(call => call.url)).toEqual([
            `${API_URL}/login`,
            `${API_URL}/products?max=2&offset=0&q=AMOX`,
        ]);
    });

    it("returns the products and the server total", async () => {
        stubServer(() =>
            jsonResponse({ data: [productBody(), productBody({ id: "prod-2" })], totalCount: 16 })
        );

        const result = await api().products.list({ max: 2 }).getData();

        expect(result.total).toEqual(16);
        expect(result.objects.map(product => product.id)).toEqual(["prod-1", "prod-2"]);
        expect(result.objects[0]).toEqual({
            id: "prod-1",
            productCode: "AMOX500",
            name: "Amoxicillin 500mg",
            description: "Capsules",
            unitOfMeasure: "EA",
            active: true,
            lotAndExpiryControl: true,
        });
    });

    it("gives undefined for a null description", async () => {
        stubServer(() =>
            jsonResponse({ data: [productBody({ description: null })], totalCount: 1 })
        );

        const [product] = (await api().products.list().getData()).objects;

        expect(product?.description).toBeUndefined();
    });

    it("rejects a product without productCode with an HTTP error that keeps the response", async () => {
        const body = { data: [productBody({ productCode: undefined })], totalCount: 1 };
        stubServer(() => jsonResponse(body));

        const error = await httpErrorOf(api().products.list().getData());

        expect(error.message).toMatch(
            /^GET \/products returned an unexpected response: .*productCode/
        );
        expect(error.response?.data).toEqual(JSON.parse(JSON.stringify(body)));
    });
});

describe("products.availableItems", () => {
    it("requests the items of the products at the location, in 1 request", async () => {
        const calls = stubServer(() => jsonResponse({ data: [] }));

        await api()
            .products.availableItems({ location: { id: "1" }, product: { id: ["p1", "p2"] } })
            .getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${AVAILABLE_ITEMS_URL}?location.id=1&product.id=p1&product.id=p2`,
        ]);
    });

    it("nests the dotted inventory item key and keeps the nested product", async () => {
        stubServer(() => jsonResponse({ data: [availableItemBody()] }));

        const result = await api()
            .products.availableItems({ location: { id: "1" }, product: { id: ["prod-1"] } })
            .getData();

        expect(result.objects).toEqual([
            {
                inventoryItem: { id: "inv-1" },
                product: { id: "prod-1" },
                productCode: "AMOX500",
                lotNumber: "LOT-1",
                expirationDate: "05/27/2026",
                binLocation: { id: "bin-1", name: "Shelf A", locationNumber: "A-01" },
                quantityAvailable: 990,
                quantityOnHand: 1000,
                status: "AVAILABLE",
            },
        ]);
    });

    it("gives undefined for an item without a bin location or lot", async () => {
        stubServer(() =>
            jsonResponse({
                data: [
                    availableItemBody({ binLocation: null, lotNumber: null, expirationDate: null }),
                ],
            })
        );

        const [item] = (
            await api()
                .products.availableItems({ location: { id: "1" }, product: { id: ["prod-1"] } })
                .getData()
        ).objects;

        expect(item?.binLocation).toBeUndefined();
        expect(item?.lotNumber).toBeUndefined();
        expect(item?.expirationDate).toBeUndefined();
    });

    it("rejects an unknown status", async () => {
        stubServer(() => jsonResponse({ data: [availableItemBody({ status: "LOST" })] }));

        const error = await httpErrorOf(
            api()
                .products.availableItems({ location: { id: "1" }, product: { id: ["prod-1"] } })
                .getData()
        );

        expect(error.message).toContain("status");
    });

    it("sends no request and gives no items for an empty list of product ids", async () => {
        const calls = stubServer(() => jsonResponse({ data: [availableItemBody()] }));

        const result = await api()
            .products.availableItems({ location: { id: "1" }, product: { id: [] } })
            .getData();

        expect(requestsAfterLogin(calls())).toEqual([]);
        expect(result.objects).toEqual([]);
    });

    it("sends all the product ids in 1 request", async () => {
        const calls = stubServer(call =>
            jsonResponse({
                data: productIdsOf(call).map(id =>
                    availableItemBody({ "inventoryItem.id": `inv-${id}`, product: { id } })
                ),
            })
        );

        const result = await api()
            .products.availableItems({ location: { id: "1" }, product: { id: ids(120) } })
            .getData();

        expect(requestsAfterLogin(calls()).map(call => productIdsOf(call).length)).toEqual([120]);
        expect(result.objects.map(item => item.product.id)).toEqual(ids(120));
    });
});
