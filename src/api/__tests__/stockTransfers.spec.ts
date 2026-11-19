import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, emptyResponse, jsonResponse } from "../../__tests__/fetchStub";
import { stockTransferBody, stockTransferItemBody } from "./endpointFixtures";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

const ITEM = {
    product: { id: "p1" },
    inventoryItem: { id: "ii-1" },
    originBinLocation: { id: "bin-1" },
    destinationBinLocation: { id: "bin-2" },
    quantity: 4,
};

/* Order.toJson(TRANSFER_ORDER), the shape of the list. */
const summaryBody = (overrides: Record<string, unknown> = {}) => ({
    id: "st-1",
    status: "PENDING",
    orderNumber: "ST-1",
    name: "ST-1",
    createdBy: "Ana Admin",
    dateCreated: "2026-06-24T10:00:00Z",
    origin: "Central depot",
    destination: "Central depot",
    orderItemsCount: 1,
    ...overrides,
});

describe("stockTransfers.list", () => {
    it("requests the transfers of the location and returns the summaries and the server total", async () => {
        const calls = stubServer(() => jsonResponse({ data: [summaryBody()], totalCount: 12 }));

        const result = await api().stockTransfers.list({ location: "loc-1", max: 10 }).getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/stockTransfers?location=loc-1&max=10`,
        ]);
        expect(result).toEqual({
            objects: [
                {
                    id: "st-1",
                    orderNumber: "ST-1",
                    name: "ST-1",
                    status: "PENDING",
                    origin: "Central depot",
                    destination: "Central depot",
                    createdBy: "Ana Admin",
                    dateCreated: "2026-06-24T10:00:00Z",
                    orderItemsCount: 1,
                },
            ],
            total: 12,
        });
    });

    it("gives undefined for a summary without a creator", async () => {
        stubServer(() => jsonResponse({ data: [summaryBody({ createdBy: null })], totalCount: 1 }));

        const [transfer] = (await api().stockTransfers.list({ location: "loc-1" }).getData())
            .objects;

        expect(transfer?.createdBy).toBeUndefined();
    });
});

describe("stockTransfers.get fields", () => {
    it("nests the dotted keys and gives undefined for the empty strings", async () => {
        stubServer(() => jsonResponse({ data: stockTransferBody() }));

        const transfer = await api().stockTransfers.get("st-1").getData();

        expect(transfer).toEqual({
            id: "st-1",
            stockTransferNumber: "ST-1",
            status: "PENDING",
            description: undefined,
            origin: { id: "loc-1", name: "Central depot" },
            destination: { id: "loc-1", name: "Central depot" },
            type: "TRANSFER_ORDER",
            dateCreated: "June 24, 2026",
            dateShipped: undefined,
            orderedBy: "Ana Admin",
            stockTransferItems: [
                {
                    id: "sti-1",
                    product: { id: "p1", productCode: "AMOX500", name: "Amoxicillin 500mg" },
                    inventoryItem: { id: "ii-1" },
                    lotNumber: "LOT-1",
                    expirationDate: "05/27/2027",
                    originBinLocation: { id: "bin-1", name: "A1" },
                    destinationBinLocation: { id: "bin-2", name: undefined },
                    quantity: 4,
                    quantityOnHand: 10,
                    status: "PENDING",
                },
            ],
        });
    });

    it("gives undefined for an item without bins", async () => {
        const item = stockTransferItemBody({
            "originBinLocation.id": null,
            "originBinLocation.name": null,
        });
        stubServer(() => jsonResponse({ data: stockTransferBody({ stockTransferItems: [item] }) }));

        const transfer = await api().stockTransfers.get("st-1").getData();

        expect(transfer.stockTransferItems[0]?.originBinLocation).toBeUndefined();
    });
});

describe("stockTransfers.get, create and update", () => {
    it("reads one transfer", async () => {
        const calls = stubServer(() => jsonResponse({ data: stockTransferBody() }));

        const transfer = await api().stockTransfers.get("st-1").getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/stockTransfers/st-1`,
        ]);
        expect(transfer.stockTransferNumber).toEqual("ST-1");
    });

    it("posts a transfer between bins and returns the new transfer", async () => {
        const calls = stubServer(() => jsonResponse({ data: stockTransferBody({ id: "st-9" }) }));

        const transfer = await api()
            .stockTransfers.create({ description: "Move to shelf B", stockTransferItems: [ITEM] })
            .getData();

        const [create] = requestsAfterLogin(calls());
        expect(create?.url).toEqual(`${API_URL}/stockTransfers`);
        expect(create?.init.method).toEqual("POST");
        expect(bodyOf(create)).toEqual({
            description: "Move to shelf B",
            stockTransferItems: [ITEM],
        });
        expect(transfer.id).toEqual("st-9");
    });

    it("puts the update with the id in the body, the status and dateShipped as MM/dd/yyyy", async () => {
        const calls = stubServer(() =>
            jsonResponse({ data: stockTransferBody({ status: "COMPLETED" }) })
        );

        const transfer = await api()
            .stockTransfers.update("st-1", {
                status: "COMPLETED",
                dateShipped: new Date("2026-06-24T10:00:00Z"),
            })
            .getData();

        const [update] = requestsAfterLogin(calls());
        expect(update?.url).toEqual(`${API_URL}/stockTransfers/st-1`);
        expect(update?.init.method).toEqual("PUT");
        expect(bodyOf(update)).toEqual({
            status: "COMPLETED",
            dateShipped: "06/24/2026",
            id: "st-1",
        });
        expect(transfer.status).toEqual("COMPLETED");
    });
});

describe("stockTransfers.delete, sendShipment and rollback", () => {
    it("sends each call and resolves with no value", async () => {
        const calls = stubServer(call => emptyResponse(call.init.method === "DELETE" ? 204 : 200));

        const results = [
            await api().stockTransfers.sendShipment("st-1").getData(),
            await api().stockTransfers.rollback("st-1").getData(),
            await api().stockTransfers.delete("st-1").getData(),
        ];

        expect(results).toEqual([undefined, undefined, undefined]);
        expect(requestsAfterLogin(calls()).map(call => [call.init.method, call.url])).toEqual([
            ["POST", `${API_URL}/stockTransfers/st-1/sendShipment`],
            ["POST", `${API_URL}/stockTransfers/st-1/rollback`],
            ["DELETE", `${API_URL}/stockTransfers/st-1`],
        ]);
    });
});

/* Compile-time check: `yarn typecheck` fails if this line has no type error. */
export function typeErrors(client: ReturnType<typeof api>) {
    // @ts-expect-error: OpenBoxes answers 400 without a location
    client.stockTransfers.list({ max: 10 });
}
