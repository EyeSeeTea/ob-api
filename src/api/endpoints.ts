import { Either, GetType } from "purify-ts";
import { CancelableResponse, rejectedResponse } from "../repositories/CancelableResponse";
import { HttpRequest, Method } from "../repositories/HttpClientRepository";
import { isDefined } from "../utils/ts-utils";
import {
    createdCodec,
    inventoryListCodec,
    TransactionBody,
    transactionTypeListCodec,
} from "./inventoryTransactions";
import { LocationListParams, locationListCodec } from "./locations";
import type { OBApi } from "./OBApi";
import {
    PartialReceiptBody,
    receiptResponseCodec,
    receiptSaveResponseCodec,
} from "./partialReceipts";
import { OBSearchBody, personListCodec } from "./people";
import {
    AvailableItemsQuery,
    availableItemListCodec,
    ProductListParams,
    productListCodec,
} from "./products";
import { checkResponse } from "./responseCheck";
import {
    StockMovementListParams,
    stockMovementDetailCodec,
    stockMovementListCodec,
} from "./stockMovements";

/* `params` (query) and `data` (body) of each typed endpoint, with the OpenBoxes names. */
type OBEndpointInputs = {
    "get /products": Input<{ params?: ProductListParams }>;
    "get /products/availableItems": Input<{ params: AvailableItemsQuery }>;
    "get /locations": Input<{ params?: LocationListParams }>;
    "get /stockMovements": Input<{ params?: StockMovementListParams }>;
    "get /stockMovements/{id}": NoInput;
    "get /partialReceiving/{shipmentId}": NoInput;
    "post /partialReceiving/{shipmentId}": Input<{ data: PartialReceiptBody }>;
    "get /generic/TransactionType": NoInput;
    "get /generic/inventory": NoInput;
    "post /generic/transaction": Input<{ data: TransactionBody }>;
    "post /generic/person/search": Input<{ data: OBSearchBody }>;
};

/* Every endpoint has both keys, so that `params` or `data` on an endpoint without them is an error. */
type Input<T extends { params?: unknown; data?: unknown }> = Readonly<
    Omit<{ params?: never; data?: never }, keyof T> & T
>;

type NoInput = Input<Record<never, never>>;

/* The response codec of each endpoint: the runtime check and the response type come from it. */
const ENDPOINT_CODECS = {
    "get /products": productListCodec,
    "get /products/availableItems": availableItemListCodec,
    "get /locations": locationListCodec,
    "get /stockMovements": stockMovementListCodec,
    "get /stockMovements/{id}": stockMovementDetailCodec,
    "get /partialReceiving/{shipmentId}": receiptResponseCodec,
    "post /partialReceiving/{shipmentId}": receiptSaveResponseCodec,
    "get /generic/TransactionType": transactionTypeListCodec,
    "get /generic/inventory": inventoryListCodec,
    "post /generic/transaction": createdCodec,
    "post /generic/person/search": personListCodec,
} satisfies Record<keyof OBEndpointInputs, unknown>;

type OBEndpointResponses = {
    [K in keyof typeof ENDPOINT_CODECS]: GetType<(typeof ENDPOINT_CODECS)[K]>;
};

type ResponseDecoder<T> = Readonly<{ decode(input: unknown): Either<string, T> }>;

const OB_ENDPOINTS: { readonly [K in OBEndpointKey]: ResponseDecoder<OBEndpointResponses[K]> } =
    ENDPOINT_CODECS;

/* For example `"get /stockMovements/{id}"`. */
export type OBEndpointKey = keyof OBEndpointResponses;

/* The response body of an endpoint, as OpenBoxes sends it: the `data` envelope, dotted keys, `null`. */
export type OBEndpointResponse<K extends string> = OBEndpointResponses[K & OBEndpointKey];

/* The paths that have an endpoint for the method. */
export type OBEndpointPath<M extends Method> = {
    [K in OBEndpointKey]: K extends `${M} ${infer Path}` ? Path : never;
}[OBEndpointKey];

type PathParamName<Path extends string> = Path extends `${string}{${infer Name}}${infer Rest}`
    ? Name | PathParamName<Rest>
    : never;

type PathParamsInput<Path extends string> = [PathParamName<Path>] extends [never]
    ? Readonly<{ pathParams?: never }>
    : Readonly<{ pathParams: Readonly<Record<PathParamName<Path>, string>> }>;

export type OBEndpointRequest<M extends Method, Path extends string> = Readonly<{
    method: M;
    path: Path;
}> &
    PathParamsInput<Path> &
    OBEndpointInputs[`${M} ${Path}` & OBEndpointKey];

export type EndpointApi = Pick<OBApi, "request">;

type RequestApi = Pick<OBApi, "requestUntyped">;

/* The fields of any endpoint request, read at runtime. */
type AnyEndpointRequest = Readonly<{
    method: Method;
    path: string;
    pathParams?: Readonly<Record<string, string>>;
    params?: HttpRequest["params"];
    data?: object;
}>;

/*
 * The overload gives the caller the endpoint's types. The implementation returns `unknown`, because
 * TypeScript cannot index the codec map with a generic key; the decode of that key's codec is what
 * makes the overload's response type true at runtime.
 */
export function requestEndpoint<M extends Method, Path extends OBEndpointPath<M>>(
    api: RequestApi,
    options: OBEndpointRequest<M, Path>
): CancelableResponse<OBEndpointResponse<`${M} ${Path}`>>;
export function requestEndpoint(
    api: RequestApi,
    options: AnyEndpointRequest
): CancelableResponse<unknown> {
    const key = `${options.method} ${options.path}`;
    if (!isEndpointKey(key)) return rejectedResponse(new Error(`No typed endpoint for ${key}`));

    const pathParams = options.pathParams ?? {};
    const missing = pathParamNames(options.path).filter(name => !(name in pathParams));
    if (missing.length > 0) {
        return rejectedResponse(
            new Error(`Missing path parameters for ${key}: ${missing.join(", ")}`)
        );
    }

    const request: HttpRequest = {
        method: options.method,
        url: toUrl(options.path, pathParams),
        params: options.params,
        data: options.data,
    };
    const decoder: ResponseDecoder<unknown> = OB_ENDPOINTS[key];
    return api
        .requestUntyped<unknown>(request)
        .map(response => checkResponse(decoder, request, response));
}

function isEndpointKey(key: string): key is OBEndpointKey {
    return Object.hasOwn(OB_ENDPOINTS, key);
}

const PATH_PARAM = /\{([^}]+)\}/g;

function pathParamNames(path: string): ReadonlyArray<string> {
    return Array.from(path.matchAll(PATH_PARAM), ([, name]) => name).filter(isDefined);
}

function toUrl(path: string, pathParams: Readonly<Record<string, string>>): string {
    return path.replace(PATH_PARAM, (_match, name: string) =>
        encodeURIComponent(pathParams[name] ?? "")
    );
}
