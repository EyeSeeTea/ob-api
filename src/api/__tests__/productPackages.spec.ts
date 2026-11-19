import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, emptyResponse, jsonResponse } from "../../__tests__/fetchStub";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

const packageBody = (overrides: Record<string, unknown> = {}) => ({
    id: "pp-1",
    name: "Box of 100",
    description: null,
    productPrice: { id: "price-1", price: 12.5 },
    quantity: 100,
    uom: { id: "BX", name: "Box", code: "BX" },
    ...overrides,
});

describe("productPackages.create", () => {
    it("posts the package of a product supplier and returns the supplier id", async () => {
        const calls = stubServer(() => jsonResponse({ data: { id: "ps-1", name: "Supplier" } }));

        const supplier = await api()
            .productPackages.create({
                productSupplier: { id: "ps-1" },
                uom: { id: "BX" },
                productPackageQuantity: 100,
                contractPriceValidUntil: new Date("2027-01-31T00:00:00Z"),
            })
            .getData();

        const [create] = requestsAfterLogin(calls());
        expect(create?.url).toEqual(`${API_URL}/productPackages`);
        expect(bodyOf(create)).toEqual({
            productSupplier: { id: "ps-1" },
            uom: { id: "BX" },
            productPackageQuantity: 100,
            contractPriceValidUntil: "01/31/2027 00:00 Z",
        });
        expect(supplier).toEqual({ id: "ps-1" });
    });
});

describe("generic.productPackages", () => {
    it("puts the new package size and returns the package", async () => {
        const calls = stubServer(() => jsonResponse({ data: packageBody({ quantity: 50 }) }));

        const updated = await api()
            .generic.productPackages.update("pp-1", { quantity: 50 })
            .getData();

        const [update] = requestsAfterLogin(calls());
        expect([update?.init.method, update?.url]).toEqual([
            "PUT",
            `${API_URL}/generic/productPackage/pp-1`,
        ]);
        expect(bodyOf(update)).toEqual({ quantity: 50 });
        expect(updated).toEqual({
            id: "pp-1",
            name: "Box of 100",
            description: undefined,
            quantity: 50,
            uom: { id: "BX", name: "Box", code: "BX" },
            productPrice: { id: "price-1", price: 12.5 },
        });
    });

    it("gives undefined for a package without a price", async () => {
        stubServer(() =>
            jsonResponse({ data: packageBody({ productPrice: { id: null, price: null } }) })
        );

        const productPackage = await api().generic.productPackages.get("pp-1").getData();

        expect(productPackage.productPrice).toBeUndefined();
    });

    it("creates and deletes a package through the generic paths", async () => {
        const calls = stubServer(call =>
            call.init.method === "DELETE"
                ? emptyResponse(204)
                : jsonResponse({ data: packageBody() }, { status: 201 })
        );
        const input = { product: { id: "p1" }, uom: { id: "BX" }, quantity: 100 };

        const created = await api().generic.productPackages.create(input).getData();
        const deleted = await api().generic.productPackages.delete("pp-1").getData();

        const [create, deletion] = requestsAfterLogin(calls());
        expect([create?.init.method, create?.url]).toEqual([
            "POST",
            `${API_URL}/generic/productPackage`,
        ]);
        expect(bodyOf(create)).toEqual(input);
        expect([deletion?.init.method, deletion?.url]).toEqual([
            "DELETE",
            `${API_URL}/generic/productPackage/pp-1`,
        ]);
        expect([created.id, deleted]).toEqual(["pp-1", undefined]);
    });
});
