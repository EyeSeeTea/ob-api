import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { partialReceiptBody, partialReceiptItemBody } from "./endpointFixtures";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

const receiptWithItem = (item: Record<string, unknown>) =>
    partialReceiptBody({ containers: [{ "container.id": null, shipmentItems: [item] }] });

describe("partialReceipts.get", () => {
    it("requests the receipt of the shipment and nests the dotted keys", async () => {
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
            containers: [
                {
                    container: undefined,
                    shipmentItems: [
                        {
                            receiptItemId: undefined,
                            shipmentItemId: "si-1",
                            container: undefined,
                            product: {
                                id: "prod-1",
                                productCode: "AMOX500",
                                name: "Amoxicillin 500mg",
                            },
                            lotNumber: "LOT-1",
                            expirationDate: "05/27/2027",
                            binLocation: { id: "bin-1", name: "Shelf A" },
                            recipient: undefined,
                            quantityShipped: 10,
                            quantityReceived: 0,
                            quantityCanceled: 0,
                            quantityRemaining: 10,
                            quantityReceiving: undefined,
                            cancelRemaining: false,
                            comment: undefined,
                        },
                    ],
                },
            ],
        });
    });

    it("keeps the containers and their items in order", async () => {
        const container = (shipmentItemId: string, containerId: string) => ({
            "container.id": containerId,
            "container.name": `Box ${containerId}`,
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

        expect(
            receipt.containers.map(({ container, shipmentItems }) => [
                container,
                shipmentItems.map(item => item.shipmentItemId),
            ])
        ).toEqual([
            [{ id: "c1", name: "Box c1" }, ["si-1"]],
            [{ id: "c2", name: "Box c2" }, ["si-2"]],
        ]);
    });

    it("gives an undefined container and keeps the items when the container has no id", async () => {
        stubServer(() => jsonResponse({ data: partialReceiptBody() }));

        const [container] = (await api().partialReceipts.get("sh-1").getData()).containers;

        expect(container?.container).toBeUndefined();
        expect(container?.shipmentItems).toHaveLength(1);
    });

    it("gives undefined for an item without a bin location", async () => {
        const item = partialReceiptItemBody({ "binLocation.id": null, "binLocation.name": null });
        stubServer(() => jsonResponse({ data: receiptWithItem(item) }));

        const receipt = await api().partialReceipts.get("sh-1").getData();

        expect(receipt.containers[0]?.shipmentItems[0]?.binLocation).toBeUndefined();
    });

    it("gives an undefined name for a bin location without a name", async () => {
        const item = partialReceiptItemBody({ "binLocation.name": null });
        stubServer(() => jsonResponse({ data: receiptWithItem(item) }));

        const receipt = await api().partialReceipts.get("sh-1").getData();

        expect(receipt.containers[0]?.shipmentItems[0]?.binLocation).toEqual({
            id: "bin-1",
            name: undefined,
        });
    });

    it("nests the recipient", async () => {
        const item = partialReceiptItemBody({ "recipient.id": "u1", "recipient.name": "Ana" });
        stubServer(() => jsonResponse({ data: receiptWithItem(item) }));

        const receipt = await api().partialReceipts.get("sh-1").getData();

        expect(receipt.containers[0]?.shipmentItems[0]?.recipient).toEqual({
            id: "u1",
            name: "Ana",
        });
    });

    it("rejects an unknown receipt status", async () => {
        stubServer(() => jsonResponse({ data: partialReceiptBody({ receiptStatus: "LOST" }) }));

        const error = await httpErrorOf(api().partialReceipts.get("sh-1").getData());

        expect(error.message).toMatch(/unexpected response.*receiptStatus/);
    });
});

/* PartialReceivingApiController.update answers a COMPLETED save with an empty object. */
const COMPLETED_RESPONSE = { data: {} };

const DATE_DELIVERED = new Date("2026-06-24T06:40:00Z");

describe("partialReceipts.savePending and complete", () => {
    it("completes the receipt when OpenBoxes answers with an empty object", async () => {
        const calls = stubServer(() => jsonResponse(COMPLETED_RESPONSE));

        const result = await api()
            .partialReceipts.complete("sh-1", {
                receiptId: "r1",
                dateDelivered: DATE_DELIVERED,
                containers: [],
            })
            .getData();

        const [completion] = requestsAfterLogin(calls());
        expect(result).toBeUndefined();
        expect(completion?.url).toEqual(`${API_URL}/partialReceiving/sh-1`);
        expect(bodyOf(completion)).toMatchObject({ receiptId: "r1", receiptStatus: "COMPLETED" });
    });

    it("rejects a completion answer that is neither a receipt nor an empty object", async () => {
        stubServer(() => jsonResponse({ data: { receiptStatus: "LOST" } }));

        const error = await httpErrorOf(
            api()
                .partialReceipts.complete("sh-1", { dateDelivered: DATE_DELIVERED, containers: [] })
                .getData()
        );

        expect(error.message).toMatch(
            /^POST \/partialReceiving\/sh-1 returned an unexpected response/
        );
    });

    it("posts the OpenBoxes body with a UTC date and null for absent fields", async () => {
        const calls = stubServer(() => jsonResponse({ data: partialReceiptBody() }));

        await api()
            .partialReceipts.savePending("sh-1", {
                dateDelivered: DATE_DELIVERED,
                containers: [
                    {
                        shipmentItems: [
                            {
                                shipmentItemId: "si-1",
                                product: { id: "p1" },
                                recipient: { id: "u1" },
                                quantityReceiving: 5,
                                cancelRemaining: false,
                            },
                        ],
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

    it("sends the containers in order, and the receipt ids, lot, expiry, bin location and comment when given", async () => {
        const calls = stubServer(() => jsonResponse(COMPLETED_RESPONSE));
        const item = (shipmentItemId: string) => ({
            receiptItemId: `r-${shipmentItemId}`,
            shipmentItemId,
            lotNumber: "LOT-1",
            expirationDate: "05/27/2027",
            binLocation: { id: "bin-1", name: "Shelf A" },
            comment: "Box damaged",
            quantityReceiving: 5,
            cancelRemaining: true,
        });

        await api()
            .partialReceipts.complete("sh-1", {
                receiptId: "r1",
                dateDelivered: DATE_DELIVERED,
                containers: [{ shipmentItems: [item("si-1")] }, { shipmentItems: [item("si-2")] }],
            })
            .getData();

        expect(bodyOf(requestsAfterLogin(calls())[0])).toEqual({
            receiptId: "r1",
            receiptStatus: "COMPLETED",
            dateDelivered: "06/24/2026 06:40 Z",
            containers: [{ shipmentItems: [item("si-1")] }, { shipmentItems: [item("si-2")] }],
        });
    });

    it("sends a bin location without a name as only its id", async () => {
        const calls = stubServer(() => jsonResponse({ data: partialReceiptBody() }));

        await api()
            .partialReceipts.savePending("sh-1", {
                dateDelivered: DATE_DELIVERED,
                containers: [
                    {
                        shipmentItems: [
                            {
                                shipmentItemId: "si-1",
                                binLocation: { id: "bin-1", name: undefined },
                                quantityReceiving: 5,
                                cancelRemaining: false,
                            },
                        ],
                    },
                ],
            })
            .getData();

        expect(bodyOf(requestsAfterLogin(calls())[0])).toMatchObject({
            containers: [{ shipmentItems: [{ binLocation: { id: "bin-1" } }] }],
        });
    });

    it("returns the receipt from the response", async () => {
        stubServer(() => jsonResponse({ data: partialReceiptBody({ receiptId: "r1" }) }));

        const receipt = await api()
            .partialReceipts.savePending("sh-1", { dateDelivered: DATE_DELIVERED, containers: [] })
            .getData();

        expect(receipt.receiptId).toEqual("r1");
    });

    it("rejects a pending save that OpenBoxes answers without a receipt", async () => {
        stubServer(() => jsonResponse(COMPLETED_RESPONSE));

        const error = await httpErrorOf(
            api()
                .partialReceipts.savePending("sh-1", {
                    dateDelivered: DATE_DELIVERED,
                    containers: [],
                })
                .getData()
        );

        expect(error.message).toContain("without a receipt");
        expect(error.response?.data).toEqual(COMPLETED_RESPONSE);
    });
});
