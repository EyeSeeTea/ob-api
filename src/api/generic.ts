import type { EndpointApi } from "./endpoints";
import {
    createInventories,
    createTransactions,
    createTransactionTypes,
    Inventories,
    Transactions,
    TransactionTypes,
} from "./inventoryTransactions";
import { createPeople, People } from "./people";
import { createGenericProductPackages, GenericProductPackages } from "./productPackages";
import { createGenericProducts, GenericProducts } from "./products";
import { createGenericOrders, GenericOrders } from "./purchaseOrders";

/* The resources that ob-api reads and writes through the OpenBoxes generic API (`/generic/{resource}`). */
export type Generic = Readonly<{
    transactionTypes: TransactionTypes;
    inventories: Inventories;
    transactions: Transactions;
    people: People;
    products: GenericProducts;
    productPackages: GenericProductPackages;
    orders: GenericOrders;
}>;

export function createGeneric(api: EndpointApi): Generic {
    return {
        transactionTypes: createTransactionTypes(api),
        inventories: createInventories(api),
        transactions: createTransactions(api),
        people: createPeople(api),
        products: createGenericProducts(api),
        productPackages: createGenericProductPackages(api),
        orders: createGenericOrders(api),
    };
}
