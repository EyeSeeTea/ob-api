import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, emptyResponse, httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

const orderBody = (overrides: Record<string, unknown> = {}) => ({
    id: "po-1",
    orderNumber: "PO-1",
    name: "Gloves",
    status: "PENDING",
    ...overrides,
});

describe("purchaseOrders.list", () => {
    it("requests the orders and returns the server total", async () => {
        const calls = stubServer(() =>
            jsonResponse({
                data: [
                    orderBody({ origin: "Supplier (SUP)", destination: null, dateOrdered: null }),
                ],
                totalPrice: 0,
                totalCount: 7,
            })
        );

        const result = await api().purchaseOrders.list({ max: 1 }).getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/purchaseOrders?max=1`,
        ]);
        expect(result).toEqual({
            objects: [
                {
                    id: "po-1",
                    orderNumber: "PO-1",
                    name: "Gloves",
                    status: "PENDING",
                    origin: "Supplier (SUP)",
                    destination: undefined,
                    dateOrdered: undefined,
                },
            ],
            total: 7,
        });
    });
});

/* Order.toJson, as GET /purchaseOrders/{id} and the generic create send it: status is the enum. */
const orderDetailBody = (overrides: Record<string, unknown> = {}) =>
    orderBody({
        status: { enumType: "org.pih.warehouse.order.OrderStatus", name: "PENDING" },
        ...overrides,
    });

describe("purchaseOrders.get, delete and rollback", () => {
    it("reads one order", async () => {
        stubServer(() => jsonResponse({ data: orderDetailBody({ orderItems: [] }) }));

        const order = await api().purchaseOrders.get("po-1").getData();

        expect(order).toEqual({
            id: "po-1",
            orderNumber: "PO-1",
            name: "Gloves",
            status: { name: "PENDING" },
        });
    });

    it("deletes and rolls back an order, with no value", async () => {
        const calls = stubServer(call => emptyResponse(call.init.method === "DELETE" ? 204 : 200));

        const results = [
            await api().purchaseOrders.rollback("po-1").getData(),
            await api().purchaseOrders.delete("po-1").getData(),
        ];

        expect(results).toEqual([undefined, undefined]);
        expect(requestsAfterLogin(calls()).map(call => [call.init.method, call.url])).toEqual([
            ["POST", `${API_URL}/purchaseOrders/po-1/rollback`],
            ["DELETE", `${API_URL}/purchaseOrders/po-1`],
        ]);
    });

    it("rejects with the response when OpenBoxes refuses to delete a placed order", async () => {
        const answer = { errorMessages: ["Cannot delete order PO-1"] };
        stubServer(() => jsonResponse(answer, { status: 400 }));

        const error = await httpErrorOf(api().purchaseOrders.delete("po-1").getData());

        expect([error.response?.status, error.response?.data]).toEqual([400, answer]);
    });
});

describe("generic.orders.create", () => {
    it("posts the order to the generic order path and returns it", async () => {
        const calls = stubServer(() =>
            jsonResponse(
                { data: orderDetailBody({ id: "po-9", orderNumber: null }) },
                { status: 201 }
            )
        );

        const order = await api()
            .generic.orders.create({
                name: "Gloves",
                orderType: { id: "PURCHASE_ORDER" },
                origin: { id: "sup-1" },
                destination: { id: "loc-1" },
                orderedBy: { id: "u1" },
                dateOrdered: new Date("2026-06-24T10:00:00Z"),
            })
            .getData();

        const [create] = requestsAfterLogin(calls());
        expect(create?.url).toEqual(`${API_URL}/generic/order`);
        expect(bodyOf(create)).toEqual({
            name: "Gloves",
            orderType: { id: "PURCHASE_ORDER" },
            origin: { id: "sup-1" },
            destination: { id: "loc-1" },
            orderedBy: { id: "u1" },
            dateOrdered: "06/24/2026 10:00 Z",
        });
        expect([order.id, order.orderNumber]).toEqual(["po-9", undefined]);
    });
});
