import type { OBApi } from "../api/OBApi";
import {
    OBPartialReceipt,
    OBPartialReceiptItem,
    PartialReceiptInput,
    PartialReceiptItemInput,
} from "../api/partialReceipts";
import { OBIdRef } from "../api/refs";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import { LocationLock } from "./locationLock";
import { RetryPolicy, withRetry } from "./retry";
import { runWorkflow } from "./workflow";

/* The caller decides which items to receive and how many; the SDK copies the rest from the receipt. */
export type ReceiveItemInput = Readonly<{
    shipmentItemId: string;
    quantityReceiving: number;
    cancelRemaining?: boolean;
    /* Replaces the bin location of the receipt item. */
    binLocation?: OBIdRef;
    /* Replaces the recipient of the receipt item. */
    recipient?: OBIdRef;
    comment?: string;
}>;

export type ReceiveShipmentInput = Readonly<{
    shipmentId: string;
    /* The destination of the shipment: the session needs it for the permissions of the save. */
    locationId: string;
    dateDelivered: Date;
    items: ReadonlyArray<ReceiveItemInput>;
}>;

export type SdkShipments = Readonly<{
    /*
     * Chooses the location, reads the receipt, saves it as PENDING, then completes it with the
     * receiptItemId values of the PENDING answer. The session stays at `locationId` after it.
     */
    receive(input: ReceiveShipmentInput): CancelableResponse<void>;
}>;

export type SdkShipmentsDeps = Readonly<{
    api: Pick<OBApi, "chooseLocation" | "partialReceipts">;
    lock: LocationLock;
    retry: RetryPolicy;
}>;

export function createSdkShipments(deps: SdkShipmentsDeps): SdkShipments {
    const { api, lock, retry } = deps;

    function receive(input: ReceiveShipmentInput): CancelableResponse<void> {
        const { shipmentId, locationId } = input;

        return runWorkflow(async ({ signal, step }) => {
            if (input.items.length === 0) {
                throw new Error(`receive of shipment ${shipmentId} needs at least 1 item`);
            }
            const repeatedIds = repeated(input.items.map(item => item.shipmentItemId));
            if (repeatedIds.length > 0) {
                throw new Error(
                    `Shipment items given more than once for shipment ${shipmentId}: ${repeatedIds.join(", ")}`
                );
            }

            return lock.run(async () => {
                await withRetry(() => api.chooseLocation(locationId), retry, signal);
                const receipt = await withRetry(
                    () => api.partialReceipts.get(shipmentId),
                    retry,
                    signal
                );
                const pendingInput = toPendingInput(receipt, input);
                const pending = await step(
                    api.partialReceipts.savePending(shipmentId, pendingInput)
                );
                const completedInput = toCompletedInput(pending, pendingInput);
                await step(api.partialReceipts.complete(shipmentId, completedInput));
            }, signal);
        });
    }

    return { receive };
}

/*
 * The PENDING save, built from the `get` receipt: OpenBoxes receives the stock into the lot of the
 * body, so the lot and expiry come from the receipt. The receiptId and receiptItemId values of a
 * receipt that is already PENDING are kept, so OpenBoxes adds no duplicate receipt items.
 */
export function toPendingInput(
    receipt: OBPartialReceipt,
    input: Pick<ReceiveShipmentInput, "dateDelivered" | "items">
): PartialReceiptInput {
    const givenItems = new Map(input.items.map(item => [item.shipmentItemId, item]));
    const receiptItemIds = new Set(
        receipt.containers.flatMap(container =>
            container.shipmentItems.map(item => item.shipmentItemId)
        )
    );
    const unknownIds = input.items
        .map(item => item.shipmentItemId)
        .filter(id => !receiptItemIds.has(id));
    if (unknownIds.length > 0) {
        throw new Error(
            `Shipment items not in the receipt of shipment ${receipt.shipmentId}: ${unknownIds.join(", ")}`
        );
    }

    const containers = receipt.containers
        .map(container => ({
            shipmentItems: container.shipmentItems.flatMap(receiptItem => {
                const given = givenItems.get(receiptItem.shipmentItemId);
                return given ? [toPendingItem(receiptItem, given)] : [];
            }),
        }))
        .filter(container => container.shipmentItems.length > 0);

    return { dateDelivered: input.dateDelivered, receiptId: receipt.receiptId, containers };
}

/* The completion: the same items, with the receiptId and receiptItemId values of the PENDING answer. */
export function toCompletedInput(
    pending: OBPartialReceipt,
    pendingInput: PartialReceiptInput
): PartialReceiptInput {
    const pendingItemIds = new Map(
        pending.containers.flatMap(container =>
            container.shipmentItems.map(item => [item.shipmentItemId, item.receiptItemId] as const)
        )
    );
    const sentItems = pendingInput.containers.flatMap(container => container.shipmentItems);
    const missingIds = sentItems
        .map(item => item.shipmentItemId)
        .filter(id => !pendingItemIds.get(id));
    if (missingIds.length > 0) {
        throw new Error(
            `The PENDING receipt of shipment ${pending.shipmentId} has no receiptItemId for: ${missingIds.join(", ")}`
        );
    }

    return {
        ...pendingInput,
        receiptId: pending.receiptId,
        containers: pendingInput.containers.map(container => ({
            shipmentItems: container.shipmentItems.map(item => ({
                ...item,
                receiptItemId: pendingItemIds.get(item.shipmentItemId),
            })),
        })),
    };
}

function toPendingItem(
    receiptItem: OBPartialReceiptItem,
    given: ReceiveItemInput
): PartialReceiptItemInput {
    return {
        shipmentItemId: receiptItem.shipmentItemId,
        receiptItemId: receiptItem.receiptItemId,
        product: { id: receiptItem.product.id },
        lotNumber: receiptItem.lotNumber,
        expirationDate: receiptItem.expirationDate,
        quantityReceiving: given.quantityReceiving,
        cancelRemaining: given.cancelRemaining ?? false,
        binLocation: given.binLocation ?? toIdRef(receiptItem.binLocation),
        recipient: given.recipient ?? toIdRef(receiptItem.recipient),
        comment: given.comment,
    };
}

function toIdRef(ref: Maybe<OBIdRef>): Maybe<OBIdRef> {
    return ref && { id: ref.id };
}

function repeated(values: ReadonlyArray<string>): ReadonlyArray<string> {
    return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}
