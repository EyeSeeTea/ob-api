import { array, Codec, exactly, GetType, number, string } from "purify-ts";
import { CancelableResponse, rejectedResponse } from "../repositories/CancelableResponse";
import { HttpError, HttpRequest } from "../repositories/HttpClientRepository";
import { joinPath } from "../utils/connection";
import { Maybe } from "../utils/ts-utils";
import type { OBApi } from "./OBApi";
import type { EndpointApi } from "./endpoints";
import { OBIdRef } from "./refs";
import { formatOptionalDate, toOpenBoxesDate, toOpenBoxesDateTime } from "./openboxesDates";
import { nullish } from "./responseCheck";
import { Paginated } from "./results";

/* ShipmentStatusCode. Other values in receiptStatusCode make OpenBoxes answer 500. */
export const OB_SHIPMENT_STATUSES = [
    "CREATED",
    "PENDING",
    "SHIPPED",
    "PARTIALLY_RECEIVED",
    "RECEIVED",
] as const;

export type OBShipmentStatus = (typeof OB_SHIPMENT_STATUSES)[number];

export type OBStockMovementDirection = "INBOUND" | "OUTBOUND";

export type OBLocationRef = Readonly<{ id: string; name: string; locationNumber: Maybe<string> }>;

export type OBNamedRef = Readonly<{ id: string; name: string }>;

export type OBStockMovementDocument = Readonly<{
    name: string;
    /* An absolute URL on the OpenBoxes server. Download it with `downloadDocument`. */
    uri: string;
    documentType: Maybe<string>;
    contentType: Maybe<string>;
}>;

export type OBStockMovementAssociations = Readonly<{
    shipment: Maybe<OBIdRef>;
    documents: ReadonlyArray<OBStockMovementDocument>;
}>;

export type OBStockMovement = Readonly<{
    id: string;
    identifier: string;
    name: string;
    description: Maybe<string>;
    /* A string, not a union: OpenBoxes sends values outside its own list, for example ISSUED. */
    statusCode: string;
    shipmentStatus: Maybe<OBShipmentStatus>;
    origin: OBLocationRef;
    destination: OBLocationRef;
    shipmentType: Maybe<OBNamedRef>;
    requestedBy: Maybe<OBNamedRef>;
    trackingNumber: Maybe<string>;
    /* Dates as OpenBoxes sends them: MM/dd/yyyy, MM/dd/yyyy HH:mm Z or ISO 8601. */
    dateRequested: Maybe<string>;
    dateShipped: Maybe<string>;
    expectedDeliveryDate: Maybe<string>;
    lastUpdated: Maybe<string>;
    associations: OBStockMovementAssociations;
}>;

/* A movement from `list()`: OpenBoxes sends no documents in the list, so use `get(id)` for them. */
export type OBStockMovementSummary = Omit<OBStockMovement, "associations"> &
    Readonly<{ associations: Maybe<Omit<OBStockMovementAssociations, "documents">> }>;

/* OpenBoxes answers 400 without `direction`, without at least one of `origin` and `destination`, or when they are the same. */
export type StockMovementListParams = Readonly<{
    direction: OBStockMovementDirection;
    receiptStatusCode?: ReadonlyArray<OBShipmentStatus>;
    max?: number;
    offset?: number;
}> &
    (
        | Readonly<{ origin: string; destination?: string }>
        | Readonly<{ origin?: string; destination: string }>
    );

/* RequisitionStatus: the statuses that `updateStatus` accepts. */
export const OB_REQUISITION_STATUSES = [
    "CREATED",
    "EDITING",
    "PENDING_APPROVAL",
    "APPROVED",
    "REJECTED",
    "VERIFYING",
    "PICKING",
    "PICKED",
    "PENDING",
    "CHECKING",
    "ISSUED",
    "RECEIVED",
    "CANCELED",
    "DELETED",
    "ERROR",
    "DISPATCHED",
    "REQUESTED",
] as const;

export type OBRequisitionStatus = (typeof OB_REQUISITION_STATUSES)[number];

/* A stock request is a stock movement with a requisition: OpenBoxes has no separate stock request API. */
export type StockMovementInput = Readonly<{
    origin: OBIdRef;
    destination: OBIdRef;
    requestedBy: OBIdRef;
    dateRequested: Date;
    description?: string;
    stocklist?: OBIdRef;
}>;

export type StockMovementBody = Omit<StockMovementInput, "dateRequested"> &
    Readonly<{ dateRequested: string }>;

export type StockMovementRequisitionBody = Partial<StockMovementBody>;

export type StockMovementLineItemInput = Readonly<{
    id?: string;
    product: OBIdRef;
    quantityRequested: number;
    lotNumber?: string;
    /* MM/dd/yyyy, as OpenBoxes sends it. */
    expirationDate?: string;
    recipient?: OBIdRef;
    sortOrder?: number;
}>;

export type StockMovementItemsInput = Readonly<{
    lineItems: ReadonlyArray<StockMovementLineItemInput>;
    removeEmptyItems?: boolean;
}>;

export type StockMovementItemsBody = StockMovementItemsInput & Readonly<{ id: string }>;

export type StockMovementShipmentInput = Readonly<{
    destination?: OBIdRef;
    shipmentType?: OBIdRef;
    dateShipped?: Date;
    expectedDeliveryDate?: Date;
    trackingNumber?: string;
    driverName?: string;
    comments?: string;
}>;

export type StockMovementShipmentBody = Omit<
    StockMovementShipmentInput,
    "dateShipped" | "expectedDeliveryDate"
> &
    Readonly<{ dateShipped?: string; expectedDeliveryDate?: string }>;

export type StockMovementStatusBody = Readonly<{
    status: OBRequisitionStatus;
    rollback?: boolean;
    statusOnly?: boolean;
    clearPicklist?: boolean;
}>;

export type StockMovements = Readonly<{
    list(params: StockMovementListParams): CancelableResponse<Paginated<OBStockMovementSummary>>;
    get(id: string): CancelableResponse<OBStockMovement>;
    create(movement: StockMovementInput): CancelableResponse<OBStockMovement>;
    updateItems(id: string, items: StockMovementItemsInput): CancelableResponse<OBStockMovement>;
    updateRequisition(
        id: string,
        fields: Partial<StockMovementInput>
    ): CancelableResponse<OBStockMovement>;
    updateShipment(id: string, fields: StockMovementShipmentInput): CancelableResponse<void>;
    updateStatus(id: string, body: StockMovementStatusBody): CancelableResponse<void>;
    /* OpenBoxes maps it to GET, but it creates the picklist. */
    createPicklist(id: string): CancelableResponse<void>;
    /* OpenBoxes maps it to GET, but it changes the picklist. */
    validatePicklist(id: string): CancelableResponse<void>;
    delete(id: string): CancelableResponse<void>;
    uploadDocument(id: string, file: Blob, fileName: string): CancelableResponse<void>;
    /* Only for a URI on the OpenBoxes server, so the session cookie goes nowhere else. */
    downloadDocument(uri: string): CancelableResponse<Blob>;
}>;

type StockMovementApi = EndpointApi &
    Pick<OBApi, "requestUntyped" | "post" | "baseUrl" | "apiPath">;

const locationRefCodec = Codec.interface({
    id: string,
    name: string,
    locationNumber: nullish(string),
});

const namedRefCodec = Codec.interface({ id: string, name: string });

const documentCodec = Codec.interface({
    name: string,
    uri: string,
    documentType: nullish(string),
    contentType: nullish(string),
});

const stockMovementCodec = Codec.interface({
    id: string,
    identifier: string,
    name: string,
    description: nullish(string),
    statusCode: string,
    shipmentStatus: nullish(exactly(...OB_SHIPMENT_STATUSES)),
    origin: locationRefCodec,
    destination: locationRefCodec,
    shipmentType: nullish(namedRefCodec),
    requestedBy: nullish(namedRefCodec),
    trackingNumber: nullish(string),
    dateRequested: nullish(string),
    dateShipped: nullish(string),
    expectedDeliveryDate: nullish(string),
    lastUpdated: nullish(string),
    associations: nullish(
        Codec.interface({
            /* A new movement has `{ id: null }`: OpenBoxes creates the shipment later. */
            shipment: nullish(Codec.interface({ id: nullish(string) })),
            documents: nullish(array(documentCodec)),
        })
    ),
});

export const stockMovementListCodec = Codec.interface({
    data: array(stockMovementCodec),
    totalCount: number,
});

export const stockMovementDetailCodec = Codec.interface({ data: stockMovementCodec });

export function createStockMovements(api: StockMovementApi): StockMovements {
    function list(
        params: StockMovementListParams
    ): CancelableResponse<Paginated<OBStockMovementSummary>> {
        return api.request({ method: "get", path: "/stockMovements", params }).map(({ data }) => ({
            objects: data.data.map(toStockMovementSummary),
            total: data.totalCount,
        }));
    }

    function get(id: string): CancelableResponse<OBStockMovement> {
        return api
            .request({ method: "get", path: "/stockMovements/{id}", pathParams: { id } })
            .map(({ data }) => toStockMovement(data.data));
    }

    function create(movement: StockMovementInput): CancelableResponse<OBStockMovement> {
        return api
            .request({ method: "post", path: "/stockMovements", data: toMovementBody(movement) })
            .map(({ data }) => toStockMovement(data.data));
    }

    function updateItems(
        id: string,
        items: StockMovementItemsInput
    ): CancelableResponse<OBStockMovement> {
        return api
            .request({
                method: "post",
                path: "/stockMovements/{id}/updateItems",
                pathParams: { id },
                data: { ...items, id },
            })
            .map(({ data }) => toStockMovement(data.data));
    }

    /* OpenBoxes answers with a redirect to the movement, and fetch follows it. */
    function updateRequisition(
        id: string,
        fields: Partial<StockMovementInput>
    ): CancelableResponse<OBStockMovement> {
        const { dateRequested, ...rest } = fields;
        return api
            .request({
                method: "post",
                path: "/stockMovements/{id}/updateRequisition",
                pathParams: { id },
                data: {
                    ...rest,
                    dateRequested: formatOptionalDate(dateRequested, toOpenBoxesDate),
                },
            })
            .map(({ data }) => toStockMovement(data.data));
    }

    function updateShipment(
        id: string,
        fields: StockMovementShipmentInput
    ): CancelableResponse<void> {
        const { dateShipped, expectedDeliveryDate, ...rest } = fields;
        return api
            .request({
                method: "post",
                path: "/stockMovements/{id}/updateShipment",
                pathParams: { id },
                data: {
                    ...rest,
                    dateShipped: formatOptionalDate(dateShipped, toOpenBoxesDateTime),
                    expectedDeliveryDate: formatOptionalDate(
                        expectedDeliveryDate,
                        toOpenBoxesDateTime
                    ),
                },
            })
            .map(() => undefined);
    }

    function updateStatus(id: string, body: StockMovementStatusBody): CancelableResponse<void> {
        return api
            .request({
                method: "post",
                path: "/stockMovements/{id}/status",
                pathParams: { id },
                data: body,
            })
            .map(() => undefined);
    }

    function createPicklist(id: string): CancelableResponse<void> {
        return api
            .request({
                method: "get",
                path: "/stockMovements/createPickList/{id}",
                pathParams: { id },
            })
            .map(() => undefined);
    }

    function validatePicklist(id: string): CancelableResponse<void> {
        return api
            .request({
                method: "get",
                path: "/stockMovements/{id}/validatePicklist",
                pathParams: { id },
            })
            .map(() => undefined);
    }

    function deleteMovement(id: string): CancelableResponse<void> {
        return api
            .request({ method: "delete", path: "/stockMovements/{id}", pathParams: { id } })
            .map(() => undefined);
    }

    function uploadDocument(id: string, file: Blob, fileName: string): CancelableResponse<void> {
        const formData = new FormData();
        formData.append("fileContents", file, fileName);
        const path = `stockMovement/uploadDocument/${encodeURIComponent(id)}`;
        const url = joinPath(contextPath(api.apiPath), path);

        return api
            .post<unknown>(url, undefined, formData, {
                skipApiPrefix: true,
                responseDataType: "raw",
            })
            .map(() => undefined);
    }

    function downloadDocument(uri: string): CancelableResponse<Blob> {
        const path = pathOnServer(api.baseUrl, uri);
        if (path === undefined) {
            return rejectedResponse(
                new Error(`Document URL is not on the OpenBoxes server ${api.baseUrl}: ${uri}`)
            );
        }

        const request: HttpRequest = { method: "get", url: path, responseDataType: "raw" };
        return api.requestUntyped<unknown>({ ...request, skipApiPrefix: true }).map(response => {
            if (response.data instanceof Blob) return response.data;
            throw new HttpError(`GET ${path} did not return a file`, { request, response });
        });
    }

    return {
        list,
        get,
        create,
        updateItems,
        updateRequisition,
        updateShipment,
        updateStatus,
        createPicklist,
        validatePicklist,
        delete: deleteMovement,
        uploadDocument,
        downloadDocument,
    };
}

function toMovementBody(movement: StockMovementInput): StockMovementBody {
    return { ...movement, dateRequested: toOpenBoxesDate(movement.dateRequested) };
}

/* The web app path of OpenBoxes: `apiPath` without its last `api` segment ("openboxes/api" → "openboxes"). */
function contextPath(apiPath: string): string {
    return apiPath.replace(/(^|\/+)api\/*$/, "");
}

/* The part of `uri` after `baseUrl`, or undefined when `uri` is on another server. */
function pathOnServer(baseUrl: string, uri: string): Maybe<string> {
    const base = baseUrl.replace(/\/+$/, "");
    return uri.startsWith(`${base}/`) ? uri.slice(base.length) : undefined;
}

function toLocationRef(location: GetType<typeof locationRefCodec>): OBLocationRef {
    return {
        id: location.id,
        name: location.name,
        locationNumber: location.locationNumber ?? undefined,
    };
}

function toNamedRef(ref: Maybe<GetType<typeof namedRefCodec>>): Maybe<OBNamedRef> {
    return ref ? { id: ref.id, name: ref.name } : undefined;
}

function toDocument(document: GetType<typeof documentCodec>): OBStockMovementDocument {
    return {
        name: document.name,
        uri: document.uri,
        documentType: document.documentType ?? undefined,
        contentType: document.contentType ?? undefined,
    };
}

function toStockMovement(movement: GetType<typeof stockMovementCodec>): OBStockMovement {
    const { associations } = movement;
    return {
        ...toStockMovementFields(movement),
        associations: {
            shipment: toShipmentRef(associations?.shipment),
            documents: (associations?.documents ?? []).map(toDocument),
        },
    };
}

function toStockMovementSummary(
    movement: GetType<typeof stockMovementCodec>
): OBStockMovementSummary {
    const { associations } = movement;
    return {
        ...toStockMovementFields(movement),
        associations: associations ? { shipment: toShipmentRef(associations.shipment) } : undefined,
    };
}

function toShipmentRef(shipment: Maybe<{ id?: string | null } | null>): Maybe<OBIdRef> {
    return shipment?.id ? { id: shipment.id } : undefined;
}

function toStockMovementFields(
    movement: GetType<typeof stockMovementCodec>
): Omit<OBStockMovement, "associations"> {
    return {
        id: movement.id,
        identifier: movement.identifier,
        name: movement.name,
        description: movement.description ?? undefined,
        statusCode: movement.statusCode,
        shipmentStatus: movement.shipmentStatus ?? undefined,
        origin: toLocationRef(movement.origin),
        destination: toLocationRef(movement.destination),
        shipmentType: toNamedRef(movement.shipmentType ?? undefined),
        requestedBy: toNamedRef(movement.requestedBy ?? undefined),
        trackingNumber: movement.trackingNumber ?? undefined,
        dateRequested: movement.dateRequested ?? undefined,
        dateShipped: movement.dateShipped ?? undefined,
        expectedDeliveryDate: movement.expectedDeliveryDate ?? undefined,
        lastUpdated: movement.lastUpdated ?? undefined,
    };
}
