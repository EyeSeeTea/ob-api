import { array, boolean, Codec, exactly, GetType, number, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import { toOpenBoxesDateTime } from "./openboxesDates";
import { getChecked, nullish, postChecked, RequestApi } from "./responseCheck";

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
    containerId: Maybe<string>;
    productId: string;
    productCode: string;
    productName: string;
    lotNumber: Maybe<string>;
    /* MM/dd/yyyy, as OpenBoxes sends it. */
    expirationDate: Maybe<string>;
    binLocation: Maybe<Readonly<{ id: string; name: Maybe<string> }>>;
    recipientId: Maybe<string>;
    quantityShipped: number;
    quantityReceived: number;
    quantityCanceled: number;
    quantityRemaining: number;
    quantityReceiving: Maybe<number>;
    cancelRemaining: boolean;
    comment: Maybe<string>;
}>;

export type OBPartialReceipt = Readonly<{
    receiptId: Maybe<string>;
    receiptStatus: OBPartialReceiptStatus;
    shipmentId: string;
    dateShipped: Maybe<string>;
    dateDelivered: Maybe<string>;
    /* The shipment items of all containers, in container order. */
    items: ReadonlyArray<OBPartialReceiptItem>;
}>;

export type PartialReceiptItemInput = Readonly<{
    shipmentItemId: string;
    quantityReceiving: number;
    cancelRemaining: boolean;
    receiptItemId?: string;
    productId?: string;
    lotNumber?: string;
    expirationDate?: string;
    binLocation?: Readonly<{ id: string; name?: string }>;
    comment?: string;
}>;

export type PartialReceiptInput = Readonly<{
    dateDelivered: Date;
    items: ReadonlyArray<PartialReceiptItemInput>;
    receiptId?: string;
    recipientId?: string;
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
    "product.id": string,
    "product.productCode": string,
    "product.name": string,
    lotNumber: nullish(string),
    expirationDate: nullish(string),
    "binLocation.id": nullish(string),
    "binLocation.name": nullish(string),
    "recipient.id": nullish(string),
    quantityShipped: number,
    quantityReceived: number,
    quantityCanceled: number,
    quantityRemaining: number,
    quantityReceiving: nullish(number),
    cancelRemaining: boolean,
    comment: nullish(string),
});

const receiptCodec = Codec.interface({
    receiptId: nullish(string),
    receiptStatus: exactly(...OB_PARTIAL_RECEIPT_STATUSES),
    shipmentId: string,
    dateShipped: nullish(string),
    dateDelivered: nullish(string),
    containers: array(Codec.interface({ shipmentItems: array(itemCodec) })),
});

const receiptResponseCodec = Codec.interface({ data: receiptCodec });

const completedResponseCodec = Codec.interface({ data: Codec.interface({}) });

export function createPartialReceipts(api: RequestApi): PartialReceipts {
    const urlOf = (shipmentId: string) => `/partialReceiving/${encodeURIComponent(shipmentId)}`;

    function get(shipmentId: string): CancelableResponse<OBPartialReceipt> {
        return getChecked(api, urlOf(shipmentId), undefined, receiptResponseCodec).map(({ data }) =>
            toReceipt(data.data)
        );
    }

    function savePending(
        shipmentId: string,
        receipt: PartialReceiptInput
    ): CancelableResponse<OBPartialReceipt> {
        const body = toReceiptBody(receipt, "PENDING");
        return postChecked(api, urlOf(shipmentId), body, receiptResponseCodec).map(({ data }) =>
            toReceipt(data.data)
        );
    }

    function complete(shipmentId: string, receipt: PartialReceiptInput): CancelableResponse<void> {
        const body = toReceiptBody(receipt, "COMPLETED");
        return postChecked(api, urlOf(shipmentId), body, completedResponseCodec).map(
            () => undefined
        );
    }

    return { get, savePending, complete };
}

/* OpenBoxes needs `null`, not a missing key, to clear these fields. */
function toReceiptBody(
    receipt: PartialReceiptInput,
    receiptStatus: Extract<OBPartialReceiptStatus, "PENDING" | "COMPLETED">
): object {
    return {
        receiptId: receipt.receiptId ?? null,
        receiptStatus,
        dateDelivered: toOpenBoxesDateTime(receipt.dateDelivered),
        containers: [
            { shipmentItems: receipt.items.map(item => toItemBody(item, receipt.recipientId)) },
        ],
    };
}

function toItemBody(item: PartialReceiptItemInput, recipientId: Maybe<string>): object {
    return {
        receiptItemId: item.receiptItemId ?? null,
        shipmentItemId: item.shipmentItemId,
        ...(item.productId === undefined ? {} : { product: { id: item.productId } }),
        lotNumber: item.lotNumber ?? null,
        expirationDate: item.expirationDate ?? null,
        quantityReceiving: item.quantityReceiving,
        cancelRemaining: item.cancelRemaining,
        ...(item.comment === undefined ? {} : { comment: item.comment }),
        ...(item.binLocation === undefined ? {} : { binLocation: item.binLocation }),
        ...(recipientId === undefined ? {} : { recipient: { id: recipientId } }),
    };
}

function toReceipt(receipt: GetType<typeof receiptCodec>): OBPartialReceipt {
    return {
        receiptId: receipt.receiptId ?? undefined,
        receiptStatus: receipt.receiptStatus,
        shipmentId: receipt.shipmentId,
        dateShipped: receipt.dateShipped ?? undefined,
        dateDelivered: receipt.dateDelivered ?? undefined,
        items: receipt.containers.flatMap(container => container.shipmentItems.map(toItem)),
    };
}

function toItem(item: GetType<typeof itemCodec>): OBPartialReceiptItem {
    const binLocationId = item["binLocation.id"];
    return {
        receiptItemId: item.receiptItemId ?? undefined,
        shipmentItemId: item.shipmentItemId,
        containerId: item["container.id"] ?? undefined,
        productId: item["product.id"],
        productCode: item["product.productCode"],
        productName: item["product.name"],
        lotNumber: item.lotNumber ?? undefined,
        expirationDate: item.expirationDate ?? undefined,
        binLocation: binLocationId
            ? { id: binLocationId, name: item["binLocation.name"] ?? undefined }
            : undefined,
        recipientId: item["recipient.id"] ?? undefined,
        quantityShipped: item.quantityShipped,
        quantityReceived: item.quantityReceived,
        quantityCanceled: item.quantityCanceled,
        quantityRemaining: item.quantityRemaining,
        quantityReceiving: item.quantityReceiving ?? undefined,
        cancelRemaining: item.cancelRemaining,
        comment: item.comment ?? undefined,
    };
}
