import { afterEach, describe, expect, it, vi } from "vitest";
import {
    bodyOf,
    errorOf,
    FetchCall,
    hangUntilAborted,
    httpErrorOf,
    jsonResponse,
} from "../../__tests__/fetchStub";
import { stubServer } from "../../api/__tests__/endpointServer";
import { partialReceiptBody, partialReceiptItemBody } from "../../api/__tests__/endpointFixtures";
import { OBPartialReceipt, OBPartialReceiptItem } from "../../api/partialReceipts";
import { isCancel } from "../../repositories/CancelableResponse";
import { ReceiveShipmentInput, toCompletedInput, toPendingInput } from "../shipments";
import { flushPromises } from "./fakeResponse";
import { emptyOk, routeKey, sentRoutes, stubRoutes, testSdk } from "./sdkServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

const DATE_DELIVERED = new Date("2026-06-24T06:40:00Z");

const receiptItem = (
    shipmentItemId: string,
    overrides: Partial<OBPartialReceiptItem> = {}
): OBPartialReceiptItem => ({
    receiptItemId: undefined,
    shipmentItemId,
    container: undefined,
    product: { id: `prod-${shipmentItemId}`, productCode: "AMOX500", name: "Amoxicillin" },
    lotNumber: "LOT-1",
    expirationDate: "12/31/2027",
    binLocation: { id: "bin-1", name: "Shelf A" },
    recipient: undefined,
    quantityShipped: 10,
    quantityReceived: 0,
    quantityCanceled: 0,
    quantityRemaining: 10,
    quantityReceiving: undefined,
    cancelRemaining: false,
    comment: undefined,
    ...overrides,
});

const receipt = (
    containers: OBPartialReceipt["containers"],
    receiptId?: string
): OBPartialReceipt => ({
    receiptId,
    receiptStatus: "PENDING",
    shipmentId: "sh-1",
    dateShipped: undefined,
    dateDelivered: undefined,
    containers,
});

const container = (id: string, ...items: ReadonlyArray<string>) => ({
    container: { id, name: undefined },
    shipmentItems: items.map(item => receiptItem(item)),
});

const shippedItemIds = (input: {
    containers: ReadonlyArray<{ shipmentItems: ReadonlyArray<{ shipmentItemId: string }> }>;
}) => input.containers.map(c => c.shipmentItems.map(item => item.shipmentItemId));

describe("toPendingInput", () => {
    it("copies the product, the lot and the expiry from the receipt", () => {
        const input = toPendingInput(receipt([container("c1", "si-1")]), {
            dateDelivered: DATE_DELIVERED,
            items: [{ shipmentItemId: "si-1", quantityReceiving: 5 }],
        });

        expect(input).toEqual({
            dateDelivered: DATE_DELIVERED,
            receiptId: undefined,
            containers: [
                {
                    shipmentItems: [
                        {
                            shipmentItemId: "si-1",
                            receiptItemId: undefined,
                            product: { id: "prod-si-1" },
                            lotNumber: "LOT-1",
                            expirationDate: "12/31/2027",
                            quantityReceiving: 5,
                            cancelRemaining: false,
                            binLocation: { id: "bin-1" },
                            recipient: undefined,
                            comment: undefined,
                        },
                    ],
                },
            ],
        });
    });

    it("keeps the receiptId and receiptItemId of a receipt that is already PENDING", () => {
        const pendingReceipt = receipt(
            [
                {
                    container: undefined,
                    shipmentItems: [receiptItem("si-1", { receiptItemId: "ri-1" })],
                },
            ],
            "r-1"
        );

        const input = toPendingInput(pendingReceipt, {
            dateDelivered: DATE_DELIVERED,
            items: [{ shipmentItemId: "si-1", quantityReceiving: 5 }],
        });

        expect(input.receiptId).toEqual("r-1");
        expect(input.containers[0]?.shipmentItems[0]?.receiptItemId).toEqual("ri-1");
    });

    it("sends only the given items, in the container order of the receipt", () => {
        const input = toPendingInput(
            receipt([
                container("c1", "si-1", "si-2"),
                container("c2", "si-3"),
                container("c3", "si-4"),
            ]),
            {
                dateDelivered: DATE_DELIVERED,
                items: [
                    { shipmentItemId: "si-4", quantityReceiving: 1 },
                    { shipmentItemId: "si-1", quantityReceiving: 1 },
                ],
            }
        );

        expect(shippedItemIds(input)).toEqual([["si-1"], ["si-4"]]);
    });

    it("uses the bin location and the recipient of the caller when given", () => {
        const input = toPendingInput(receipt([container("c1", "si-1")]), {
            dateDelivered: DATE_DELIVERED,
            items: [
                {
                    shipmentItemId: "si-1",
                    quantityReceiving: 5,
                    cancelRemaining: true,
                    binLocation: { id: "bin-9" },
                    recipient: { id: "u-1" },
                    comment: "Box damaged",
                },
            ],
        });

        expect(input.containers[0]?.shipmentItems[0]).toMatchObject({
            binLocation: { id: "bin-9" },
            recipient: { id: "u-1" },
            cancelRemaining: true,
            comment: "Box damaged",
        });
    });

    it("rejects an item that is not in the receipt, and names it", () => {
        const build = () =>
            toPendingInput(receipt([container("c1", "si-1")]), {
                dateDelivered: DATE_DELIVERED,
                items: [{ shipmentItemId: "si-9", quantityReceiving: 1 }],
            });

        expect(build).toThrow("si-9");
    });
});

describe("toCompletedInput", () => {
    const pendingInput = toPendingInput(receipt([container("c1", "si-1")]), {
        dateDelivered: DATE_DELIVERED,
        items: [{ shipmentItemId: "si-1", quantityReceiving: 5 }],
    });

    it("sends the receiptId and receiptItemId values of the PENDING answer", () => {
        const pending = receipt(
            [
                {
                    container: undefined,
                    shipmentItems: [receiptItem("si-1", { receiptItemId: "ri-1" })],
                },
            ],
            "r-1"
        );

        const input = toCompletedInput(pending, pendingInput);

        expect(input.receiptId).toEqual("r-1");
        expect(input.containers[0]?.shipmentItems[0]).toMatchObject({
            shipmentItemId: "si-1",
            receiptItemId: "ri-1",
            quantityReceiving: 5,
            lotNumber: "LOT-1",
        });
    });

    it("rejects an item without a receiptItemId in the PENDING answer, and names it", () => {
        const pending = receipt([container("c1", "si-1")], "r-1");

        expect(() => toCompletedInput(pending, pendingInput)).toThrow("si-1");
    });
});

const RECEIVE_INPUT: ReceiveShipmentInput = {
    shipmentId: "sh-1",
    locationId: "loc-2",
    dateDelivered: DATE_DELIVERED,
    items: [
        { shipmentItemId: "si-1", quantityReceiving: 5 },
        { shipmentItemId: "si-2", quantityReceiving: 3 },
    ],
};

const serverReceipt = (receiptId: string | null, itemIds: ReadonlyArray<string>) =>
    partialReceiptBody({
        receiptId,
        containers: [
            {
                "container.id": null,
                shipmentItems: itemIds.map((shipmentItemId, index) =>
                    partialReceiptItemBody({
                        shipmentItemId,
                        receiptItemId: receiptId ? `ri-${index + 1}` : null,
                    })
                ),
            },
        ],
    });

function receiptStatusOf(call: FetchCall): unknown {
    const body = bodyOf(call);
    return typeof body === "object" && body !== null && "receiptStatus" in body
        ? body.receiptStatus
        : undefined;
}

/* OpenBoxes answers a PENDING save with the receipt and its ids, and a completion with `{}`. */
const saveRoute = (pendingAnswer: Record<string, unknown>) => (call: FetchCall) =>
    jsonResponse({ data: receiptStatusOf(call) === "PENDING" ? pendingAnswer : {} });

const RECEIVE_ROUTES = {
    "GET /chooseLocation/loc-2": emptyOk,
    "GET /partialReceiving/sh-1": () =>
        jsonResponse({ data: serverReceipt(null, ["si-1", "si-2"]) }),
    "POST /partialReceiving/sh-1": saveRoute(serverReceipt("r-1", ["si-1", "si-2"])),
};

const receiptStatuses = (calls: ReadonlyArray<FetchCall>) =>
    calls.filter(call => routeKey(call) === "POST /partialReceiving/sh-1").map(receiptStatusOf);

describe("sdk.shipments.receive", () => {
    it("chooses the location, reads the receipt, saves it as PENDING, then completes it", async () => {
        const calls = stubRoutes(RECEIVE_ROUTES);

        const result = await testSdk().shipments.receive(RECEIVE_INPUT).getData();

        expect(result).toBeUndefined();
        expect(sentRoutes(calls())).toEqual([
            "GET /chooseLocation/loc-2",
            "GET /partialReceiving/sh-1",
            "POST /partialReceiving/sh-1",
            "POST /partialReceiving/sh-1",
        ]);
        expect(receiptStatuses(calls())).toEqual(["PENDING", "COMPLETED"]);
        expect(bodyOf(calls()[3])).toMatchObject({
            receiptId: "r-1",
            containers: [
                {
                    shipmentItems: [
                        { shipmentItemId: "si-1", receiptItemId: "ri-1", quantityReceiving: 5 },
                        { shipmentItemId: "si-2", receiptItemId: "ri-2", quantityReceiving: 3 },
                    ],
                },
            ],
        });
    });

    it("stops at a failed PENDING save and does not send the completion", async () => {
        const calls = stubRoutes({
            ...RECEIVE_ROUTES,
            "POST /partialReceiving/sh-1": () =>
                jsonResponse({ error: "Access denied" }, { status: 403 }),
        });

        const error = await httpErrorOf(testSdk().shipments.receive(RECEIVE_INPUT).getData());

        expect(error.response?.status).toEqual(403);
        expect(receiptStatuses(calls())).toEqual(["PENDING"]);
    });

    it("rejects an unknown item after the read and before any save", async () => {
        const calls = stubRoutes(RECEIVE_ROUTES);
        const input = {
            ...RECEIVE_INPUT,
            items: [{ shipmentItemId: "si-9", quantityReceiving: 1 }],
        };

        const error = await errorOf(testSdk().shipments.receive(input).getData());

        expect(String(error)).toContain("si-9");
        expect(sentRoutes(calls())).toEqual([
            "GET /chooseLocation/loc-2",
            "GET /partialReceiving/sh-1",
        ]);
    });

    it("rejects empty items before any request", async () => {
        const calls = stubServer(() => jsonResponse({}));

        const error = await errorOf(
            testSdk()
                .shipments.receive({ ...RECEIVE_INPUT, items: [] })
                .getData()
        );

        expect(String(error)).toContain("at least 1 item");
        expect(calls()).toEqual([]);
    });

    it("rejects an item given more than once before any request, and names it", async () => {
        const calls = stubServer(() => jsonResponse({}));
        const item = { shipmentItemId: "si-1", quantityReceiving: 1 };

        const error = await errorOf(
            testSdk()
                .shipments.receive({ ...RECEIVE_INPUT, items: [item, item] })
                .getData()
        );

        expect(String(error)).toContain("more than once for shipment sh-1: si-1");
        expect(calls()).toEqual([]);
    });

    it("runs the receipts of 2 locations one at a time", async () => {
        const calls = stubRoutes({
            ...RECEIVE_ROUTES,
            "GET /chooseLocation/loc-3": emptyOk,
            "GET /partialReceiving/sh-2": () =>
                jsonResponse({ data: { ...serverReceipt(null, ["si-1"]), shipmentId: "sh-2" } }),
            "POST /partialReceiving/sh-2": saveRoute({
                ...serverReceipt("r-2", ["si-1"]),
                shipmentId: "sh-2",
            }),
        });
        const sdk = testSdk();
        const second: ReceiveShipmentInput = {
            ...RECEIVE_INPUT,
            shipmentId: "sh-2",
            locationId: "loc-3",
            items: [{ shipmentItemId: "si-1", quantityReceiving: 1 }],
        };

        await Promise.all([
            sdk.shipments.receive(RECEIVE_INPUT).getData(),
            sdk.shipments.receive(second).getData(),
        ]);

        expect(sentRoutes(calls())).toEqual([
            "GET /chooseLocation/loc-2",
            "GET /partialReceiving/sh-1",
            "POST /partialReceiving/sh-1",
            "POST /partialReceiving/sh-1",
            "GET /chooseLocation/loc-3",
            "GET /partialReceiving/sh-2",
            "POST /partialReceiving/sh-2",
            "POST /partialReceiving/sh-2",
        ]);
    });

    it("releases the lock when a receipt is canceled during the PENDING save", async () => {
        const calls = stubRoutes({
            ...RECEIVE_ROUTES,
            "POST /partialReceiving/sh-1": hangUntilAborted,
        });
        const sdk = testSdk();

        const first = sdk.shipments.receive(RECEIVE_INPUT);
        const firstResult = errorOf(first.getData());
        // loc-3 has no route: the second receipt fails at chooseLocation, but it runs.
        const secondResult = errorOf(
            sdk.shipments.receive({ ...RECEIVE_INPUT, locationId: "loc-3" }).getData()
        );
        await vi.waitFor(() =>
            expect(sentRoutes(calls())).toContain("POST /partialReceiving/sh-1")
        );
        first.cancel();
        const firstError = await firstResult;
        await secondResult;
        await flushPromises();

        expect(isCancel(firstError)).toBe(true);
        expect(sentRoutes(calls())).toContain("GET /chooseLocation/loc-3");
    });
});
