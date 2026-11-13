import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

const transactionTypeBody = (overrides: Record<string, unknown> = {}) => ({
    id: "tt-1",
    sortOrder: 1,
    dateCreated: "2026-01-01T00:00:00Z",
    lastUpdated: "2026-01-01T00:00:00Z",
    name: "Consumption",
    description: null,
    transactionCode: { enumType: "org.pih.warehouse.inventory.TransactionCode", name: "DEBIT" },
    ...overrides,
});

describe("transactionTypes.list", () => {
    it("requests the generic TransactionType list and takes the code name", async () => {
        const calls = stubServer(() => jsonResponse({ data: [transactionTypeBody()] }));

        const result = await api().transactionTypes.list().getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/generic/TransactionType`,
        ]);
        expect(result).toEqual({
            objects: [{ id: "tt-1", name: "Consumption", transactionCode: "DEBIT" }],
        });
    });

    it("rejects an unknown transaction code", async () => {
        stubServer(() =>
            jsonResponse({ data: [transactionTypeBody({ transactionCode: { name: "GIFT" } })] })
        );

        const error = await httpErrorOf(api().transactionTypes.list().getData());

        expect(error.message).toMatch(/unexpected response.*transactionCode/);
    });
});

describe("inventories.list", () => {
    it("requests the generic inventory list and takes the warehouse id", async () => {
        const calls = stubServer(() =>
            jsonResponse({
                data: [
                    {
                        id: "inv-1",
                        dateCreated: "x",
                        lastUpdated: "x",
                        warehouse: { id: "loc-1" },
                        configuredProducts: [],
                    },
                    { id: "inv-2", warehouse: null },
                ],
            })
        );

        const result = await api().inventories.list().getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/generic/inventory`,
        ]);
        expect(result).toEqual({
            objects: [
                { id: "inv-1", warehouseId: "loc-1" },
                { id: "inv-2", warehouseId: undefined },
            ],
        });
    });
});

describe("transactions.create", () => {
    it("posts the OpenBoxes body and returns the new id", async () => {
        const calls = stubServer(() =>
            jsonResponse({ data: { id: "tx-1", transactionNumber: "T1" } }, { status: 201 })
        );

        const result = await api()
            .transactions.create({
                transactionTypeId: "tt-1",
                inventoryId: "inv-1",
                transactionDate: new Date("2026-06-24T06:40:00Z"),
                comment: "DHIS2 consumption",
                confirmed: true,
                entries: [{ inventoryItemId: "ii-1", productId: "p1", quantity: 3 }],
            })
            .getData();

        const [create] = requestsAfterLogin(calls());
        expect(create?.url).toEqual(`${API_URL}/generic/transaction`);
        expect(create?.init.method).toEqual("POST");
        expect(bodyOf(create)).toEqual({
            transactionType: { id: "tt-1" },
            inventory: { id: "inv-1" },
            transactionDate: "2026-06-24T06:40:00.000Z",
            comment: "DHIS2 consumption",
            confirmed: true,
            transactionEntries: [
                { inventoryItem: { id: "ii-1" }, product: { id: "p1" }, quantity: 3 },
            ],
        });
        expect(result).toEqual({ id: "tx-1" });
    });

    it("sends the bin location and the transaction number when given", async () => {
        const calls = stubServer(() => jsonResponse({ data: { id: "tx-1" } }, { status: 201 }));

        await api()
            .transactions.create({
                transactionTypeId: "tt-1",
                inventoryId: "inv-1",
                transactionDate: new Date("2026-06-24T06:40:00Z"),
                transactionNumber: "T1",
                entries: [
                    {
                        inventoryItemId: "ii-1",
                        productId: "p1",
                        quantity: 3,
                        binLocationId: "bin-1",
                    },
                ],
            })
            .getData();

        expect(bodyOf(requestsAfterLogin(calls())[0])).toMatchObject({
            transactionNumber: "T1",
            transactionEntries: [{ binLocation: { id: "bin-1" } }],
        });
    });
});
