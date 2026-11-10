import { array, boolean, Codec, exactly, GetType, number, string } from "purify-ts";
import { CancelableResponse, resolvedResponse } from "../repositories/CancelableResponse";
import { chunk } from "../utils/arrays";
import { Maybe } from "../utils/ts-utils";
import { getChecked, nullish, RequestApi } from "./responseCheck";
import { ListResult, Paginated } from "./results";

export const OB_AVAILABLE_ITEM_STATUSES = [
    "AVAILABLE",
    "PICKED",
    "RECALLED",
    "HOLD",
    "NOT_AVAILABLE",
] as const;

export type OBAvailableItemStatus = (typeof OB_AVAILABLE_ITEM_STATUSES)[number];

export type OBProduct = Readonly<{
    id: string;
    productCode: string;
    name: string;
    description: Maybe<string>;
    unitOfMeasure: Maybe<string>;
    active: boolean;
    lotAndExpiryControl: boolean;
}>;

export type OBBinLocation = Readonly<{
    id: string;
    name: string;
    locationNumber: Maybe<string>;
}>;

export type OBAvailableItem = Readonly<{
    inventoryItemId: string;
    productId: string;
    productCode: string;
    lotNumber: Maybe<string>;
    /* As OpenBoxes sends it: MM/dd/yyyy, without a time zone. */
    expirationDate: Maybe<string>;
    binLocation: Maybe<OBBinLocation>;
    quantityAvailable: number;
    quantityOnHand: number;
    status: OBAvailableItemStatus;
}>;

export type ProductListParams = Readonly<{
    max?: number;
    offset?: number;
    /* Search text: OpenBoxes matches it against the name, the code and other fields. */
    q?: string;
}>;

export type AvailableItemsParams = Readonly<{
    locationId: string;
    productIds: ReadonlyArray<string>;
}>;

export type Products = Readonly<{
    list(params?: ProductListParams): CancelableResponse<Paginated<OBProduct>>;
    availableItems(params: AvailableItemsParams): CancelableResponse<ListResult<OBAvailableItem>>;
}>;

const PRODUCTS_PER_REQUEST = 50;

const productCodec = Codec.interface({
    id: string,
    productCode: string,
    name: string,
    description: nullish(string),
    unitOfMeasure: nullish(string),
    active: boolean,
    lotAndExpiryControl: boolean,
});

const productListCodec = Codec.interface({ data: array(productCodec), totalCount: number });

const availableItemCodec = Codec.interface({
    "inventoryItem.id": string,
    product: Codec.interface({ id: string }),
    productCode: string,
    lotNumber: nullish(string),
    expirationDate: nullish(string),
    binLocation: nullish(
        Codec.interface({ id: string, name: string, locationNumber: nullish(string) })
    ),
    quantityAvailable: number,
    quantityOnHand: number,
    status: exactly(...OB_AVAILABLE_ITEM_STATUSES),
});

const availableItemListCodec = Codec.interface({ data: array(availableItemCodec) });

export function createProducts(api: RequestApi): Products {
    function list(params: ProductListParams = {}): CancelableResponse<Paginated<OBProduct>> {
        return getChecked(api, "/products", params, productListCodec).map(({ data }) => ({
            objects: data.data.map(toProduct),
            total: data.totalCount,
        }));
    }

    function availableItems(
        params: AvailableItemsParams
    ): CancelableResponse<ListResult<OBAvailableItem>> {
        const [firstIds, ...otherIds] = chunk(params.productIds, PRODUCTS_PER_REQUEST);
        if (!firstIds) return resolvedResponse({ objects: [] });

        const getChunk = (productIds: ReadonlyArray<string>) =>
            getChecked(
                api,
                "/products/availableItems",
                { "location.id": params.locationId, "product.id": productIds },
                availableItemListCodec
            ).map(({ data }) => data.data.map(toAvailableItem));

        // One request after another: each flatMap starts the next chunk when the previous one ends.
        return otherIds
            .reduce(
                (previous, productIds) =>
                    previous.flatMap(({ data: items }) =>
                        getChunk(productIds).map(({ data }) => [...items, ...data])
                    ),
                getChunk(firstIds)
            )
            .map(({ data }) => ({ objects: data }));
    }

    return { list, availableItems };
}

function toProduct(product: GetType<typeof productCodec>): OBProduct {
    return {
        id: product.id,
        productCode: product.productCode,
        name: product.name,
        description: product.description ?? undefined,
        unitOfMeasure: product.unitOfMeasure ?? undefined,
        active: product.active,
        lotAndExpiryControl: product.lotAndExpiryControl,
    };
}

function toAvailableItem(item: GetType<typeof availableItemCodec>): OBAvailableItem {
    const { binLocation } = item;
    return {
        inventoryItemId: item["inventoryItem.id"],
        productId: item.product.id,
        productCode: item.productCode,
        lotNumber: item.lotNumber ?? undefined,
        expirationDate: item.expirationDate ?? undefined,
        binLocation: binLocation
            ? {
                  id: binLocation.id,
                  name: binLocation.name,
                  locationNumber: binLocation.locationNumber ?? undefined,
              }
            : undefined,
        quantityAvailable: item.quantityAvailable,
        quantityOnHand: item.quantityOnHand,
        status: item.status,
    };
}
