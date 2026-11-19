import { Codec, GetType, number, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { formatOptionalDate, toOpenBoxesDateTime } from "./openboxesDates";
import { OBIdRef } from "./refs";
import { nullish } from "./responseCheck";

export type ProductSupplierPackageInput = Readonly<{
    productSupplier: OBIdRef;
    uom: OBIdRef;
    productPackageQuantity: number;
    minOrderQuantity?: number;
    productPackagePrice?: number;
    contractPricePrice?: number;
    contractPriceValidUntil?: Date;
    tieredPricing?: boolean;
}>;

export type ProductSupplierPackageBody = Omit<
    ProductSupplierPackageInput,
    "contractPriceValidUntil"
> &
    Readonly<{ contractPriceValidUntil?: string }>;

export type OBProductPackage = Readonly<{
    id: string;
    name: Maybe<string>;
    description: Maybe<string>;
    quantity: number;
    uom: Readonly<{ id: string; name: string; code: string }>;
    productPrice: Maybe<Readonly<{ id: string; price: Maybe<number> }>>;
}>;

export type ProductPackageInput = Readonly<{
    product: OBIdRef;
    uom: OBIdRef;
    quantity: number;
    name?: string;
    description?: string;
    gtin?: string;
}>;

export type ProductPackages = Readonly<{
    /* The package of a product supplier. OpenBoxes answers with the product supplier, not the package. */
    create(command: ProductSupplierPackageInput): CancelableResponse<OBIdRef>;
}>;

/* `/productPackages` has only a create: read, update and delete exist only in the generic API. */
export type GenericProductPackages = Readonly<{
    get(id: string): CancelableResponse<OBProductPackage>;
    create(productPackage: ProductPackageInput): CancelableResponse<OBProductPackage>;
    /* Sends only the given fields. */
    update(id: string, fields: Partial<ProductPackageInput>): CancelableResponse<OBProductPackage>;
    delete(id: string): CancelableResponse<void>;
}>;

export const productSupplierResponseCodec = Codec.interface({
    data: Codec.interface({ id: string }),
});

/* ProductPackage.toJson */
const productPackageCodec = Codec.interface({
    id: string,
    name: nullish(string),
    description: nullish(string),
    quantity: number,
    uom: Codec.interface({ id: string, name: string, code: string }),
    productPrice: nullish(Codec.interface({ id: nullish(string), price: nullish(number) })),
});

export const productPackageResponseCodec = Codec.interface({ data: productPackageCodec });

export function createProductPackages(api: EndpointApi): ProductPackages {
    return {
        create: command => {
            const { contractPriceValidUntil, ...rest } = command;
            const data: ProductSupplierPackageBody = {
                ...rest,
                contractPriceValidUntil: formatOptionalDate(
                    contractPriceValidUntil,
                    toOpenBoxesDateTime
                ),
            };
            return api
                .request({ method: "post", path: "/productPackages", data })
                .map(({ data: response }) => ({ id: response.data.id }));
        },
    };
}

export function createGenericProductPackages(api: EndpointApi): GenericProductPackages {
    const toResult = ({ data }: { data: GetType<typeof productPackageResponseCodec> }) =>
        toProductPackage(data.data);

    return {
        get: id =>
            api
                .request({
                    method: "get",
                    path: "/generic/productPackage/{id}",
                    pathParams: { id },
                })
                .map(toResult),
        create: productPackage =>
            api
                .request({ method: "post", path: "/generic/productPackage", data: productPackage })
                .map(toResult),
        update: (id, fields) =>
            api
                .request({
                    method: "put",
                    path: "/generic/productPackage/{id}",
                    pathParams: { id },
                    data: fields,
                })
                .map(toResult),
        delete: id =>
            api
                .request({
                    method: "delete",
                    path: "/generic/productPackage/{id}",
                    pathParams: { id },
                })
                .map(() => undefined),
    };
}

function toProductPackage(productPackage: GetType<typeof productPackageCodec>): OBProductPackage {
    const { uom, productPrice } = productPackage;
    return {
        id: productPackage.id,
        name: productPackage.name ?? undefined,
        description: productPackage.description ?? undefined,
        quantity: productPackage.quantity,
        uom: { id: uom.id, name: uom.name, code: uom.code },
        productPrice: productPrice?.id
            ? { id: productPrice.id, price: productPrice.price ?? undefined }
            : undefined,
    };
}
