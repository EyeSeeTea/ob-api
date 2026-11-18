import { array, boolean, Codec, exactly, GetType, number, string } from "purify-ts";
import { CancelableResponse, resolvedResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { OBIdRef } from "./refs";
import { nullish } from "./responseCheck";
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
    inventoryItem: OBIdRef;
    product: OBIdRef;
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
    location: OBIdRef;
    /* One request for all ids: keep the list short (for example 50), so the URL stays under the server limit. */
    product: Readonly<{ id: ReadonlyArray<string> }>;
}>;

export type AvailableItemsQuery = Readonly<{
    "location.id": string;
    "product.id": ReadonlyArray<string>;
}>;

export type Products = Readonly<{
    list(params?: ProductListParams): CancelableResponse<Paginated<OBProduct>>;
    availableItems(params: AvailableItemsParams): CancelableResponse<ListResult<OBAvailableItem>>;
}>;

const productCodec = Codec.interface({
    id: string,
    productCode: string,
    name: string,
    description: nullish(string),
    unitOfMeasure: nullish(string),
    active: boolean,
    lotAndExpiryControl: boolean,
});

export const productListCodec = Codec.interface({
    data: array(productCodec),
    totalCount: number,
});

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

export const availableItemListCodec = Codec.interface({ data: array(availableItemCodec) });

export function createProducts(api: EndpointApi): Products {
    function list(params: ProductListParams = {}): CancelableResponse<Paginated<OBProduct>> {
        return api
            .request({ method: "get", path: "/products", params })
            .map(({ data }) => ({ objects: data.data.map(toProduct), total: data.totalCount }));
    }

    function availableItems(
        params: AvailableItemsParams
    ): CancelableResponse<ListResult<OBAvailableItem>> {
        // OpenBoxes answers 500 when the request has no `product.id`.
        if (params.product.id.length === 0) return resolvedResponse({ objects: [] });

        const query: AvailableItemsQuery = {
            "location.id": params.location.id,
            "product.id": params.product.id,
        };
        return api
            .request({ method: "get", path: "/products/availableItems", params: query })
            .map(({ data }) => ({ objects: data.data.map(toAvailableItem) }));
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
        inventoryItem: { id: item["inventoryItem.id"] },
        product: { id: item.product.id },
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
