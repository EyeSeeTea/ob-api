import {
    array,
    boolean,
    Codec,
    exactly,
    GetType,
    Left,
    number,
    oneOf,
    Right,
    string,
} from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { HttpError, HttpRequest } from "../repositories/HttpClientRepository";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { toOpenBoxesDateTime } from "./openboxesDates";
import { OBIdRef, OBRef, toRef } from "./refs";
import { nullish } from "./responseCheck";

/* PartialReceiptStatus */
export const OB_PARTIAL_RECEIPT_STATUSES = [
    "PENDING",
    "CHECKING",
    "COMPLETED",
    "ROLLBACK",
] as const;

export type OBPartialReceiptStatus = (typeof OB_PARTIAL_RECEIPT_STATUSES)[number];

export type OBPartialReceiptItem = Readonly<{
    receiptItemId: Maybe<string>;
    shipmentItemId: string;
    container: Maybe<OBRef>;
    product: Readonly<{ id: string; productCode: string; name: string }>;
    lotNumber: Maybe<string>;
    /* MM/dd/yyyy, as OpenBoxes sends it. */
    expirationDate: Maybe<string>;
    binLocation: Maybe<OBRef>;
    recipient: Maybe<OBRef>;
    quantityShipped: number;
    quantityReceived: number;
    quantityCanceled: number;
    quantityRemaining: number;
    quantityReceiving: Maybe<number>;
    cancelRemaining: boolean;
    comment: Maybe<string>;
}>;

export type OBPartialReceiptContainer = Readonly<{
    container: Maybe<OBRef>;
    shipmentItems: ReadonlyArray<OBPartialReceiptItem>;
}>;

export type OBPartialReceipt = Readonly<{
    receiptId: Maybe<string>;
    receiptStatus: OBPartialReceiptStatus;
    shipmentId: string;
    dateShipped: Maybe<string>;
    dateDelivered: Maybe<string>;
    containers: ReadonlyArray<OBPartialReceiptContainer>;
}>;

export type PartialReceiptItemInput = Readonly<{
    shipmentItemId: string;
    quantityReceiving: number;
    cancelRemaining: boolean;
    receiptItemId?: string;
    product?: OBIdRef;
    lotNumber?: string;
    expirationDate?: string;
    binLocation?: Readonly<{ id: string; name?: string }>;
    recipient?: OBIdRef;
    comment?: string;
}>;

export type PartialReceiptContainerInput = Readonly<{
    shipmentItems: ReadonlyArray<PartialReceiptItemInput>;
}>;

export type PartialReceiptInput = Readonly<{
    dateDelivered: Date;
    containers: ReadonlyArray<PartialReceiptContainerInput>;
    receiptId?: string;
}>;

/* OpenBoxes needs `null`, not a missing key, to clear these fields. */
type PartialReceiptItemBody = Readonly<{
    receiptItemId: string | null;
    shipmentItemId: string;
    product?: OBIdRef;
    lotNumber: string | null;
    expirationDate: string | null;
    quantityReceiving: number;
    cancelRemaining: boolean;
    comment?: string;
    binLocation?: Readonly<{ id: string; name?: string }>;
    recipient?: OBIdRef;
}>;

export type PartialReceiptBody = Readonly<{
    receiptId: string | null;
    receiptStatus: Extract<OBPartialReceiptStatus, "PENDING" | "COMPLETED">;
    /* MM/dd/yyyy HH:mm Z: the only format OpenBoxes accepts here. */
    dateDelivered: string;
    containers: ReadonlyArray<Readonly<{ shipmentItems: ReadonlyArray<PartialReceiptItemBody> }>>;
}>;

export type PartialReceipts = Readonly<{
    get(shipmentId: string): CancelableResponse<OBPartialReceipt>;
    /* Saves the quantities as PENDING; the result has the receiptItemId values that `complete` needs. */
    savePending(
        shipmentId: string,
        receipt: PartialReceiptInput
    ): CancelableResponse<OBPartialReceipt>;
    /* Completes the receipt. OpenBoxes answers `{ data: {} }`, so there is no receipt to return. */
    complete(shipmentId: string, receipt: PartialReceiptInput): CancelableResponse<void>;
}>;

const itemCodec = Codec.interface({
    receiptItemId: nullish(string),
    shipmentItemId: string,
    "container.id": nullish(string),
    "container.name": nullish(string),
    "product.id": string,
    "product.productCode": string,
    "product.name": string,
    lotNumber: nullish(string),
    expirationDate: nullish(string),
    "binLocation.id": nullish(string),
    "binLocation.name": nullish(string),
    "recipient.id": nullish(string),
    "recipient.name": nullish(string),
    quantityShipped: number,
    quantityReceived: number,
    quantityCanceled: number,
    quantityRemaining: number,
    quantityReceiving: nullish(number),
    cancelRemaining: boolean,
    comment: nullish(string),
});

const containerCodec = Codec.interface({
    "container.id": nullish(string),
    "container.name": nullish(string),
    shipmentItems: array(itemCodec),
});

const receiptCodec = Codec.interface({
    receiptId: nullish(string),
    receiptStatus: exactly(...OB_PARTIAL_RECEIPT_STATUSES),
    shipmentId: string,
    dateShipped: nullish(string),
    dateDelivered: nullish(string),
    containers: array(containerCodec),
});

type ReceiptData = GetType<typeof receiptCodec>;

type EmptyObject = Readonly<Record<string, never>>;

/* Only `{}`: a broken receipt must not pass as the COMPLETED answer. */
const emptyObjectCodec = Codec.custom<EmptyObject>({
    decode: input =>
        isEmptyObject(input)
            ? Right(input)
            : Left(`Expected {}, but received ${JSON.stringify(input)}`),
    encode: input => input,
});

export const receiptResponseCodec = Codec.interface({ data: receiptCodec });

/* PENDING answers the receipt; COMPLETED answers `{ data: {} }`. */
export const receiptSaveResponseCodec = oneOf([
    receiptResponseCodec,
    Codec.interface({ data: emptyObjectCodec }),
]);

export function createPartialReceipts(api: EndpointApi): PartialReceipts {
    function get(shipmentId: string): CancelableResponse<OBPartialReceipt> {
        return api
            .request({
                method: "get",
                path: "/partialReceiving/{shipmentId}",
                pathParams: { shipmentId },
            })
            .map(({ data }) => toReceipt(data.data));
    }

    function save(
        shipmentId: string,
        receipt: PartialReceiptInput,
        status: "PENDING" | "COMPLETED"
    ) {
        return api.request({
            method: "post",
            path: "/partialReceiving/{shipmentId}",
            pathParams: { shipmentId },
            data: toReceiptBody(receipt, status),
        });
    }

    function savePending(
        shipmentId: string,
        receipt: PartialReceiptInput
    ): CancelableResponse<OBPartialReceipt> {
        return save(shipmentId, receipt, "PENDING").map(response => {
            const { data } = response.data;
            if (isReceipt(data)) return toReceipt(data);

            const request: HttpRequest = {
                method: "post",
                url: `/partialReceiving/${encodeURIComponent(shipmentId)}`,
            };
            throw new HttpError(`POST ${request.url} answered a PENDING save without a receipt`, {
                request,
                response,
            });
        });
    }

    function complete(shipmentId: string, receipt: PartialReceiptInput): CancelableResponse<void> {
        return save(shipmentId, receipt, "COMPLETED").map(() => undefined);
    }

    return { get, savePending, complete };
}

function isEmptyObject(input: unknown): input is EmptyObject {
    return (
        typeof input === "object" &&
        input !== null &&
        !Array.isArray(input) &&
        Object.keys(input).length === 0
    );
}

function isReceipt(data: ReceiptData | EmptyObject): data is ReceiptData {
    return "receiptStatus" in data;
}

function toReceiptBody(
    receipt: PartialReceiptInput,
    receiptStatus: PartialReceiptBody["receiptStatus"]
): PartialReceiptBody {
    return {
        receiptId: receipt.receiptId ?? null,
        receiptStatus,
        dateDelivered: toOpenBoxesDateTime(receipt.dateDelivered),
        containers: receipt.containers.map(container => ({
            shipmentItems: container.shipmentItems.map(toItemBody),
        })),
    };
}

function toItemBody(item: PartialReceiptItemInput): PartialReceiptItemBody {
    return {
        receiptItemId: item.receiptItemId ?? null,
        shipmentItemId: item.shipmentItemId,
        ...(item.product === undefined ? {} : { product: item.product }),
        lotNumber: item.lotNumber ?? null,
        expirationDate: item.expirationDate ?? null,
        quantityReceiving: item.quantityReceiving,
        cancelRemaining: item.cancelRemaining,
        ...(item.comment === undefined ? {} : { comment: item.comment }),
        ...(item.binLocation === undefined ? {} : { binLocation: item.binLocation }),
        ...(item.recipient === undefined ? {} : { recipient: item.recipient }),
    };
}

function toReceipt(receipt: ReceiptData): OBPartialReceipt {
    return {
        receiptId: receipt.receiptId ?? undefined,
        receiptStatus: receipt.receiptStatus,
        shipmentId: receipt.shipmentId,
        dateShipped: receipt.dateShipped ?? undefined,
        dateDelivered: receipt.dateDelivered ?? undefined,
        containers: receipt.containers.map(container => ({
            container: toRef(container["container.id"], container["container.name"]),
            shipmentItems: container.shipmentItems.map(toItem),
        })),
    };
}

function toItem(item: GetType<typeof itemCodec>): OBPartialReceiptItem {
    return {
        receiptItemId: item.receiptItemId ?? undefined,
        shipmentItemId: item.shipmentItemId,
        container: toRef(item["container.id"], item["container.name"]),
        product: {
            id: item["product.id"],
            productCode: item["product.productCode"],
            name: item["product.name"],
        },
        lotNumber: item.lotNumber ?? undefined,
        expirationDate: item.expirationDate ?? undefined,
        binLocation: toRef(item["binLocation.id"], item["binLocation.name"]),
        recipient: toRef(item["recipient.id"], item["recipient.name"]),
        quantityShipped: item.quantityShipped,
        quantityReceived: item.quantityReceived,
        quantityCanceled: item.quantityCanceled,
        quantityRemaining: item.quantityRemaining,
        quantityReceiving: item.quantityReceiving ?? undefined,
        cancelRemaining: item.cancelRemaining,
        comment: item.comment ?? undefined,
    };
}
