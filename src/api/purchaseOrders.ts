import { array, Codec, GetType, number, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { formatOptionalDate, toOpenBoxesDateTime } from "./openboxesDates";
import { OBIdRef } from "./refs";
import { nullish } from "./responseCheck";
import { Paginated } from "./results";

export type OBPurchaseOrderSummary = Readonly<{
    id: string;
    orderNumber: string;
    name: string;
    status: string;
    /* The location names, as OpenBoxes sends them, with the organization code. */
    origin: Maybe<string>;
    destination: Maybe<string>;
    dateOrdered: Maybe<string>;
}>;

/* Order.toJson: `status` is the OrderStatus enum, as `{ name }`. */
export type OBPurchaseOrder = Readonly<{
    id: string;
    /* OpenBoxes gives the number after the create, so the create answer has none. */
    orderNumber: Maybe<string>;
    name: string;
    status: Readonly<{ name: string }>;
}>;

export type PurchaseOrderListParams = Readonly<{ max?: number; offset?: number }>;

/* OpenBoxes needs an origin and a destination that have an organization. */
export type OrderInput = Readonly<{
    name: string;
    orderType: OBIdRef;
    origin: OBIdRef;
    destination: OBIdRef;
    orderedBy: OBIdRef;
    orderNumber?: string;
    dateOrdered?: Date;
    status?: string;
}>;

export type OrderBody = Omit<OrderInput, "dateOrdered"> & Readonly<{ dateOrdered?: string }>;

export type PurchaseOrders = Readonly<{
    list(params?: PurchaseOrderListParams): CancelableResponse<Paginated<OBPurchaseOrderSummary>>;
    get(id: string): CancelableResponse<OBPurchaseOrder>;
    /* OpenBoxes answers 400 for an order that is not PENDING. */
    delete(id: string): CancelableResponse<void>;
    rollback(id: string): CancelableResponse<void>;
}>;

/* `/purchaseOrders` has no create: it exists only in the generic API (`order`). */
export type GenericOrders = Readonly<{
    create(order: OrderInput): CancelableResponse<OBPurchaseOrder>;
}>;

const purchaseOrderSummaryCodec = Codec.interface({
    id: string,
    orderNumber: string,
    name: string,
    status: string,
    origin: nullish(string),
    destination: nullish(string),
    dateOrdered: nullish(string),
});

export const purchaseOrderListCodec = Codec.interface({
    data: array(purchaseOrderSummaryCodec),
    totalCount: number,
});

/* Order.toJson */
const purchaseOrderCodec = Codec.interface({
    id: string,
    orderNumber: nullish(string),
    name: string,
    status: Codec.interface({ name: string }),
});

export const purchaseOrderResponseCodec = Codec.interface({ data: purchaseOrderCodec });

export function createPurchaseOrders(api: EndpointApi): PurchaseOrders {
    return {
        list: (params = {}) =>
            api.request({ method: "get", path: "/purchaseOrders", params }).map(({ data }) => ({
                objects: data.data.map(toPurchaseOrderSummary),
                total: data.totalCount,
            })),
        get: id =>
            api
                .request({ method: "get", path: "/purchaseOrders/{id}", pathParams: { id } })
                .map(({ data }) => toPurchaseOrder(data.data)),
        delete: id =>
            api
                .request({ method: "delete", path: "/purchaseOrders/{id}", pathParams: { id } })
                .map(() => undefined),
        rollback: id =>
            api
                .request({
                    method: "post",
                    path: "/purchaseOrders/{id}/rollback",
                    pathParams: { id },
                })
                .map(() => undefined),
    };
}

export function createGenericOrders(api: EndpointApi): GenericOrders {
    return {
        create: order => {
            const { dateOrdered, ...rest } = order;
            const data: OrderBody = {
                ...rest,
                dateOrdered: formatOptionalDate(dateOrdered, toOpenBoxesDateTime),
            };
            return api
                .request({ method: "post", path: "/generic/order", data })
                .map(({ data: response }) => toPurchaseOrder(response.data));
        },
    };
}

function toPurchaseOrderSummary(
    order: GetType<typeof purchaseOrderSummaryCodec>
): OBPurchaseOrderSummary {
    return {
        id: order.id,
        orderNumber: order.orderNumber,
        name: order.name,
        status: order.status,
        origin: order.origin ?? undefined,
        destination: order.destination ?? undefined,
        dateOrdered: order.dateOrdered ?? undefined,
    };
}

function toPurchaseOrder(order: GetType<typeof purchaseOrderCodec>): OBPurchaseOrder {
    return {
        id: order.id,
        orderNumber: order.orderNumber ?? undefined,
        name: order.name,
        status: { name: order.status.name },
    };
}
