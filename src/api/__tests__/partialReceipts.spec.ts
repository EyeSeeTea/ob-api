import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { partialReceiptBody, partialReceiptItemBody } from "./endpointFixtures";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("partialReceipts.get", () => {
    it("requests the receipt of the shipment and renames the dotted keys", async () => {
        const calls = stubServer(() => jsonResponse({ data: partialReceiptBody() }));

        const receipt = await api().partialReceipts.get("sh-1").getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/partialReceiving/sh-1`,
        ]);
        expect(receipt).toEqual({
            receiptId: undefined,
            receiptStatus: "PENDING",
            shipmentId: "sh-1",
            dateShipped: "06/24/2026 06:39 Z",
            dateDelivered: "06/24/2026 06:40 Z",
            items: [
                {
                    receiptItemId: undefined,
                    shipmentItemId: "si-1",
                    containerId: undefined,
                    productId: "prod-1",
                    productCode: "AMOX500",
                    productName: "Amoxicillin 500mg",
                    lotNumber: "LOT-1",
                    expirationDate: "05/27/2027",
                    binLocation: { id: "bin-1", name: "Shelf A" },
                    recipientId: undefined,
                    quantityShipped: 10,
                    quantityReceived: 0,
                    quantityCanceled: 0,
                    quantityRemaining: 10,
                    quantityReceiving: undefined,
                    cancelRemaining: false,
                    comment: undefined,
                },
            ],
        });
    });

    it("joins the items of all containers in order", async () => {
        const container = (shipmentItemId: string, containerId: string) => ({
            "container.id": containerId,
            shipmentItems: [
                partialReceiptItemBody({ shipmentItemId, "container.id": containerId }),
            ],
        });
        stubServer(() =>
            jsonResponse({
                data: partialReceiptBody({
                    containers: [container("si-1", "c1"), container("si-2", "c2")],
                }),
            })
        );

        const receipt = await api().partialReceipts.get("sh-1").getData();

        expect(receipt.items.map(item => [item.shipmentItemId, item.containerId])).toEqual([
            ["si-1", "c1"],
            ["si-2", "c2"],
        ]);
    });

    it("gives undefined for an item without a bin location", async () => {
        const item = partialReceiptItemBody({ "binLocation.id": null, "binLocation.name": null });
        stubServer(() =>
            jsonResponse({ data: partialReceiptBody({ containers: [{ shipmentItems: [item] }] }) })
        );

        const receipt = await api().partialReceipts.get("sh-1").getData();

        expect(receipt.items[0]?.binLocation).toBeUndefined();
    });

    it("gives an undefined name for a bin location without a name", async () => {
        const item = partialReceiptItemBody({ "binLocation.name": null });
        stubServer(() =>
            jsonResponse({ data: partialReceiptBody({ containers: [{ shipmentItems: [item] }] }) })
        );

        const receipt = await api().partialReceipts.get("sh-1").getData();

        expect(receipt.items[0]?.binLocation).toEqual({ id: "bin-1", name: undefined });
    });

    it("rejects an unknown receipt status", async () => {
        stubServer(() => jsonResponse({ data: partialReceiptBody({ receiptStatus: "LOST" }) }));

        const error = await httpErrorOf(api().partialReceipts.get("sh-1").getData());

        expect(error.message).toMatch(/unexpected response.*receiptStatus/);
    });
});

/* PartialReceivingApiController.update answers a COMPLETED save with an empty object. */
const COMPLETED_RESPONSE = { data: {} };

describe("partialReceipts.savePending and complete", () => {
    it("completes the receipt when OpenBoxes answers with an empty object", async () => {
        const calls = stubServer(() => jsonResponse(COMPLETED_RESPONSE));

        const result = await api()
            .partialReceipts.complete("sh-1", {
                receiptId: "r1",
                dateDelivered: new Date("2026-06-24T06:40:00Z"),
                items: [],
            })
            .getData();

        const [completion] = requestsAfterLogin(calls());
        expect(result).toBeUndefined();
        expect(completion?.url).toEqual(`${API_URL}/partialReceiving/sh-1`);
        expect(bodyOf(completion)).toMatchObject({ receiptId: "r1", receiptStatus: "COMPLETED" });
    });

    it("posts the OpenBoxes body with a UTC date and null for absent fields", async () => {
        const calls = stubServer(() => jsonResponse({ data: partialReceiptBody() }));

        await api()
            .partialReceipts.savePending("sh-1", {
                dateDelivered: new Date("2026-06-24T06:40:00Z"),
                recipientId: "u1",
                items: [
                    {
                        shipmentItemId: "si-1",
                        productId: "p1",
                        quantityReceiving: 5,
                        cancelRemaining: false,
                    },
                ],
            })
            .getData();

        const [save] = requestsAfterLogin(calls());
        expect(save?.url).toEqual(`${API_URL}/partialReceiving/sh-1`);
        expect(save?.init.method).toEqual("POST");
        expect(bodyOf(save)).toEqual({
            receiptId: null,
            receiptStatus: "PENDING",
            dateDelivered: "06/24/2026 06:40 Z",
            containers: [
                {
                    shipmentItems: [
                        {
                            receiptItemId: null,
                            shipmentItemId: "si-1",
                            product: { id: "p1" },
                            lotNumber: null,
                            expirationDate: null,
                            quantityReceiving: 5,
                            cancelRemaining: false,
                            recipient: { id: "u1" },
                        },
                    ],
                },
            ],
        });
    });

    it("sends the receipt ids, lot, expiry, bin location and comment when given", async () => {
        const calls = stubServer(() => jsonResponse(COMPLETED_RESPONSE));

        await api()
            .partialReceipts.complete("sh-1", {
                receiptId: "r1",
                dateDelivered: new Date("2026-06-24T06:40:00Z"),
                items: [
                    {
                        receiptItemId: "ri-1",
                        shipmentItemId: "si-1",
                        lotNumber: "LOT-1",
                        expirationDate: "05/27/2027",
                        binLocation: { id: "bin-1", name: "Shelf A" },
                        comment: "Box damaged",
                        quantityReceiving: 5,
                        cancelRemaining: true,
                    },
                ],
            })
            .getData();

        expect(bodyOf(requestsAfterLogin(calls())[0])).toEqual({
            receiptId: "r1",
            receiptStatus: "COMPLETED",
            dateDelivered: "06/24/2026 06:40 Z",
            containers: [
                {
                    shipmentItems: [
                        {
                            receiptItemId: "ri-1",
                            shipmentItemId: "si-1",
                            lotNumber: "LOT-1",
                            expirationDate: "05/27/2027",
                            binLocation: { id: "bin-1", name: "Shelf A" },
                            comment: "Box damaged",
                            quantityReceiving: 5,
                            cancelRemaining: true,
                        },
                    ],
                },
            ],
        });
    });

    it("sends a bin location without a name as only its id", async () => {
        const calls = stubServer(() => jsonResponse({ data: partialReceiptBody() }));
        const item = {
            shipmentItemId: "si-1",
            binLocation: { id: "bin-1", name: undefined },
            quantityReceiving: 5,
            cancelRemaining: false,
        };

        await api()
            .partialReceipts.savePending("sh-1", {
                dateDelivered: new Date("2026-06-24T06:40:00Z"),
                items: [item],
            })
            .getData();

        expect(bodyOf(requestsAfterLogin(calls())[0])).toMatchObject({
            containers: [{ shipmentItems: [{ binLocation: { id: "bin-1" } }] }],
        });
    });

    it("returns the receipt from the response", async () => {
        stubServer(() => jsonResponse({ data: partialReceiptBody({ receiptId: "r1" }) }));

        const receipt = await api()
            .partialReceipts.savePending("sh-1", {
                dateDelivered: new Date(),
                items: [],
            })
            .getData();

        expect(receipt.receiptId).toEqual("r1");
    });
});
