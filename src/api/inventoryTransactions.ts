import { array, Codec, exactly, GetType, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import { getChecked, nullish, postChecked, RequestApi } from "./responseCheck";
import { ListResult } from "./results";

/* TransactionCode */
export const OB_TRANSACTION_CODES = ["DEBIT", "CREDIT", "INVENTORY", "PRODUCT_INVENTORY"] as const;

export type OBTransactionCode = (typeof OB_TRANSACTION_CODES)[number];

export type OBTransactionType = Readonly<{
    id: string;
    name: string;
    transactionCode: OBTransactionCode;
}>;

export type OBInventory = Readonly<{
    id: string;
    /* The location that owns the inventory. */
    warehouseId: Maybe<string>;
}>;

export type TransactionEntryInput = Readonly<{
    inventoryItemId: string;
    productId: string;
    quantity: number;
    binLocationId?: string;
}>;

export type TransactionInput = Readonly<{
    transactionTypeId: string;
    inventoryId: string;
    transactionDate: Date;
    entries: ReadonlyArray<TransactionEntryInput>;
    transactionNumber?: string;
    comment?: string;
    confirmed?: boolean;
}>;

export type TransactionTypes = Readonly<{
    list(): CancelableResponse<ListResult<OBTransactionType>>;
}>;

export type Inventories = Readonly<{
    list(): CancelableResponse<ListResult<OBInventory>>;
}>;

export type Transactions = Readonly<{
    create(transaction: TransactionInput): CancelableResponse<Readonly<{ id: string }>>;
}>;

const transactionTypeCodec = Codec.interface({
    id: string,
    name: string,
    transactionCode: Codec.interface({ name: exactly(...OB_TRANSACTION_CODES) }),
});

const inventoryCodec = Codec.interface({
    id: string,
    warehouse: nullish(Codec.interface({ id: string })),
});

const transactionTypeListCodec = Codec.interface({ data: array(transactionTypeCodec) });

const inventoryListCodec = Codec.interface({ data: array(inventoryCodec) });

const createdCodec = Codec.interface({ data: Codec.interface({ id: string }) });

export function createTransactionTypes(api: RequestApi): TransactionTypes {
    return {
        list: () =>
            getChecked(api, "/generic/TransactionType", undefined, transactionTypeListCodec).map(
                ({ data }) => ({ objects: data.data.map(toTransactionType) })
            ),
    };
}

export function createInventories(api: RequestApi): Inventories {
    return {
        list: () =>
            getChecked(api, "/generic/inventory", undefined, inventoryListCodec).map(
                ({ data }) => ({
                    objects: data.data.map(toInventory),
                })
            ),
    };
}

export function createTransactions(api: RequestApi): Transactions {
    return {
        create: transaction =>
            postChecked(
                api,
                "/generic/transaction",
                toTransactionBody(transaction),
                createdCodec
            ).map(({ data }) => ({ id: data.data.id })),
    };
}

function toTransactionType(type: GetType<typeof transactionTypeCodec>): OBTransactionType {
    return { id: type.id, name: type.name, transactionCode: type.transactionCode.name };
}

function toInventory(inventory: GetType<typeof inventoryCodec>): OBInventory {
    return { id: inventory.id, warehouseId: inventory.warehouse?.id };
}

function toTransactionBody(transaction: TransactionInput): object {
    return {
        transactionType: { id: transaction.transactionTypeId },
        inventory: { id: transaction.inventoryId },
        transactionDate: transaction.transactionDate.toISOString(),
        transactionNumber: transaction.transactionNumber,
        comment: transaction.comment,
        confirmed: transaction.confirmed,
        transactionEntries: transaction.entries.map(entry => ({
            inventoryItem: { id: entry.inventoryItemId },
            product: { id: entry.productId },
            quantity: entry.quantity,
            ...(entry.binLocationId ? { binLocation: { id: entry.binLocationId } } : {}),
        })),
    };
}
