import { array, Codec, exactly, GetType, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { OBIdRef } from "./refs";
import { nullish } from "./responseCheck";
import { ListResult } from "./results";

/* TransactionCode */
export const OB_TRANSACTION_CODES = ["DEBIT", "CREDIT", "INVENTORY", "PRODUCT_INVENTORY"] as const;

export type OBTransactionCode = (typeof OB_TRANSACTION_CODES)[number];

export type OBTransactionType = Readonly<{
    id: string;
    name: string;
    transactionCode: Readonly<{ name: OBTransactionCode }>;
}>;

export type OBInventory = Readonly<{
    id: string;
    /* The location that owns the inventory. */
    warehouse: Maybe<OBIdRef>;
}>;

export type TransactionEntryInput = Readonly<{
    inventoryItem: OBIdRef;
    product: OBIdRef;
    quantity: number;
    binLocation?: OBIdRef;
}>;

export type TransactionInput = Readonly<{
    transactionType: OBIdRef;
    inventory: OBIdRef;
    transactionDate: Date;
    transactionEntries: ReadonlyArray<TransactionEntryInput>;
    transactionNumber?: string;
    comment?: string;
    confirmed?: boolean;
}>;

export type TransactionBody = Omit<TransactionInput, "transactionDate"> &
    Readonly<{ transactionDate: string }>;

export type TransactionTypes = Readonly<{
    list(): CancelableResponse<ListResult<OBTransactionType>>;
}>;

export type Inventories = Readonly<{
    list(): CancelableResponse<ListResult<OBInventory>>;
}>;

export type Transactions = Readonly<{
    create(transaction: TransactionInput): CancelableResponse<OBIdRef>;
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

export const transactionTypeListCodec = Codec.interface({ data: array(transactionTypeCodec) });

export const inventoryListCodec = Codec.interface({ data: array(inventoryCodec) });

export const createdCodec = Codec.interface({ data: Codec.interface({ id: string }) });

export function createTransactionTypes(api: EndpointApi): TransactionTypes {
    return {
        list: () =>
            api
                .request({ method: "get", path: "/generic/TransactionType" })
                .map(({ data }) => ({ objects: data.data.map(toTransactionType) })),
    };
}

export function createInventories(api: EndpointApi): Inventories {
    return {
        list: () =>
            api
                .request({ method: "get", path: "/generic/inventory" })
                .map(({ data }) => ({ objects: data.data.map(toInventory) })),
    };
}

export function createTransactions(api: EndpointApi): Transactions {
    return {
        create: transaction =>
            api
                .request({
                    method: "post",
                    path: "/generic/transaction",
                    data: {
                        ...transaction,
                        transactionDate: transaction.transactionDate.toISOString(),
                    },
                })
                .map(({ data }) => ({ id: data.data.id })),
    };
}

function toTransactionType(type: GetType<typeof transactionTypeCodec>): OBTransactionType {
    return {
        id: type.id,
        name: type.name,
        transactionCode: { name: type.transactionCode.name },
    };
}

function toInventory(inventory: GetType<typeof inventoryCodec>): OBInventory {
    const { warehouse } = inventory;
    return { id: inventory.id, warehouse: warehouse ? { id: warehouse.id } : undefined };
}
