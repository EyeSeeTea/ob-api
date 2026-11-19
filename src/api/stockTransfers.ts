import { array, Codec, GetType, number, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { formatOptionalDate, toOpenBoxesDate } from "./openboxesDates";
import { OBIdRef, OBRef, toRef } from "./refs";
import { emptyToUndefined, nullish } from "./responseCheck";
import { Paginated } from "./results";

export type OBStockTransferItem = Readonly<{
    id: string;
    product: Readonly<{ id: string; productCode: string; name: string }>;
    inventoryItem: Maybe<OBIdRef>;
    lotNumber: Maybe<string>;
    expirationDate: Maybe<string>;
    originBinLocation: Maybe<OBRef>;
    destinationBinLocation: Maybe<OBRef>;
    quantity: number;
    quantityOnHand: Maybe<number>;
    status: Maybe<string>;
}>;

export type OBStockTransfer = Readonly<{
    id: string;
    stockTransferNumber: string;
    status: string;
    description: Maybe<string>;
    origin: Maybe<OBRef>;
    destination: Maybe<OBRef>;
    /* The order type code, for example TRANSFER_ORDER or RETURN_ORDER. */
    type: Maybe<string>;
    /* Dates as OpenBoxes sends them: "MMMM dd, yyyy" for dateCreated, MM/dd/yyyy for dateShipped. */
    dateCreated: Maybe<string>;
    dateShipped: Maybe<string>;
    /* The name of the user. */
    orderedBy: Maybe<string>;
    stockTransferItems: ReadonlyArray<OBStockTransferItem>;
}>;

/* Order.toJson(TRANSFER_ORDER): the list has a summary, with location and user names. */
export type OBStockTransferSummary = Readonly<{
    id: string;
    orderNumber: string;
    name: string;
    status: string;
    origin: Maybe<string>;
    destination: Maybe<string>;
    createdBy: Maybe<string>;
    dateCreated: Maybe<string>;
    orderItemsCount: number;
}>;

/* OpenBoxes answers 400 without `location`. */
export type StockTransferListParams = Readonly<{
    location: string;
    max?: number;
    offset?: number;
}>;

export type StockTransferItemInput = Readonly<{
    id?: string;
    product: OBIdRef;
    inventoryItem: OBIdRef;
    originBinLocation: OBIdRef;
    destinationBinLocation: OBIdRef;
    quantity: number;
}>;

/* Without origin and destination, OpenBoxes uses the location of the session. */
export type StockTransferInput = Readonly<{
    description?: string;
    status?: string;
    origin?: OBIdRef;
    destination?: OBIdRef;
    dateShipped?: Date;
    stockTransferItems?: ReadonlyArray<StockTransferItemInput>;
}>;

/* `id` is set only by `update`: OpenBoxes reads the transfer id from the body, not the path. */
export type StockTransferBody = Omit<StockTransferInput, "dateShipped"> &
    Readonly<{ id?: string; dateShipped?: string }>;

export type StockTransfers = Readonly<{
    list(params: StockTransferListParams): CancelableResponse<Paginated<OBStockTransferSummary>>;
    get(id: string): CancelableResponse<OBStockTransfer>;
    /* The session must have a location. */
    create(transfer: StockTransferInput): CancelableResponse<OBStockTransfer>;
    /* `status: "COMPLETED"` completes the transfer. The session must have a location. */
    update(id: string, transfer: StockTransferInput): CancelableResponse<OBStockTransfer>;
    delete(id: string): CancelableResponse<void>;
    sendShipment(id: string): CancelableResponse<void>;
    rollback(id: string): CancelableResponse<void>;
}>;

const stockTransferItemCodec = Codec.interface({
    id: string,
    "product.id": string,
    "product.productCode": string,
    "product.name": string,
    "inventoryItem.id": nullish(string),
    lotNumber: nullish(string),
    expirationDate: nullish(string),
    "originBinLocation.id": nullish(string),
    "originBinLocation.name": nullish(string),
    "destinationBinLocation.id": nullish(string),
    "destinationBinLocation.name": nullish(string),
    quantity: number,
    quantityOnHand: nullish(number),
    status: nullish(string),
});

const stockTransferCodec = Codec.interface({
    id: string,
    stockTransferNumber: string,
    status: string,
    description: nullish(string),
    "origin.id": nullish(string),
    "origin.name": nullish(string),
    "destination.id": nullish(string),
    "destination.name": nullish(string),
    type: nullish(string),
    dateCreated: nullish(string),
    dateShipped: nullish(string),
    orderedBy: nullish(string),
    stockTransferItems: array(stockTransferItemCodec),
});

const stockTransferSummaryCodec = Codec.interface({
    id: string,
    orderNumber: string,
    name: string,
    status: string,
    origin: nullish(string),
    destination: nullish(string),
    createdBy: nullish(string),
    dateCreated: nullish(string),
    orderItemsCount: number,
});

export const stockTransferListCodec = Codec.interface({
    data: array(stockTransferSummaryCodec),
    totalCount: number,
});

export const stockTransferDetailCodec = Codec.interface({ data: stockTransferCodec });

export function createStockTransfers(api: EndpointApi): StockTransfers {
    const toTransferResult = ({ data }: { data: GetType<typeof stockTransferDetailCodec> }) =>
        toStockTransfer(data.data);

    return {
        list: params =>
            api.request({ method: "get", path: "/stockTransfers", params }).map(({ data }) => ({
                objects: data.data.map(toStockTransferSummary),
                total: data.totalCount,
            })),
        get: id =>
            api
                .request({ method: "get", path: "/stockTransfers/{id}", pathParams: { id } })
                .map(toTransferResult),
        create: transfer =>
            api
                .request({ method: "post", path: "/stockTransfers", data: toBody(transfer) })
                .map(toTransferResult),
        update: (id, transfer) =>
            api
                .request({
                    method: "put",
                    path: "/stockTransfers/{id}",
                    pathParams: { id },
                    data: { ...toBody(transfer), id },
                })
                .map(toTransferResult),
        delete: id =>
            api
                .request({ method: "delete", path: "/stockTransfers/{id}", pathParams: { id } })
                .map(() => undefined),
        sendShipment: id =>
            api
                .request({
                    method: "post",
                    path: "/stockTransfers/{id}/sendShipment",
                    pathParams: { id },
                })
                .map(() => undefined),
        rollback: id =>
            api
                .request({
                    method: "post",
                    path: "/stockTransfers/{id}/rollback",
                    pathParams: { id },
                })
                .map(() => undefined),
    };
}

function toBody(transfer: StockTransferInput): StockTransferBody {
    const { dateShipped, ...rest } = transfer;
    return { ...rest, dateShipped: formatOptionalDate(dateShipped, toOpenBoxesDate) };
}

function toStockTransferSummary(
    transfer: GetType<typeof stockTransferSummaryCodec>
): OBStockTransferSummary {
    return {
        ...transfer,
        origin: transfer.origin ?? undefined,
        destination: transfer.destination ?? undefined,
        createdBy: transfer.createdBy ?? undefined,
        dateCreated: transfer.dateCreated ?? undefined,
    };
}

function toStockTransfer(transfer: GetType<typeof stockTransferCodec>): OBStockTransfer {
    return {
        id: transfer.id,
        stockTransferNumber: transfer.stockTransferNumber,
        status: transfer.status,
        description: emptyToUndefined(transfer.description),
        origin: toRef(transfer["origin.id"], transfer["origin.name"]),
        destination: toRef(transfer["destination.id"], transfer["destination.name"]),
        type: emptyToUndefined(transfer.type),
        dateCreated: emptyToUndefined(transfer.dateCreated),
        dateShipped: emptyToUndefined(transfer.dateShipped),
        orderedBy: emptyToUndefined(transfer.orderedBy),
        stockTransferItems: transfer.stockTransferItems.map(toStockTransferItem),
    };
}

function toStockTransferItem(item: GetType<typeof stockTransferItemCodec>): OBStockTransferItem {
    const inventoryItemId = item["inventoryItem.id"];
    return {
        id: item.id,
        product: {
            id: item["product.id"],
            productCode: item["product.productCode"],
            name: item["product.name"],
        },
        inventoryItem: inventoryItemId ? { id: inventoryItemId } : undefined,
        lotNumber: emptyToUndefined(item.lotNumber),
        expirationDate: emptyToUndefined(item.expirationDate),
        originBinLocation: toRef(item["originBinLocation.id"], item["originBinLocation.name"]),
        destinationBinLocation: toRef(
            item["destinationBinLocation.id"],
            item["destinationBinLocation.name"]
        ),
        quantity: item.quantity,
        quantityOnHand: item.quantityOnHand ?? undefined,
        status: emptyToUndefined(item.status),
    };
}
