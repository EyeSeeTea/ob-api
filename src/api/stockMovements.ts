import { array, Codec, exactly, GetType, number, string } from "purify-ts";
import { CancelableResponse, rejectedResponse } from "../repositories/CancelableResponse";
import { HttpError, HttpRequest } from "../repositories/HttpClientRepository";
import { joinPath } from "../utils/connection";
import { Maybe } from "../utils/ts-utils";
import type { OBApi } from "./OBApi";
import { getChecked, nullish } from "./responseCheck";
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

export type OBStockMovement = Readonly<{
    id: string;
    identifier: string;
    name: string;
    description: Maybe<string>;
    /* A string, not a union: OpenBoxes sends values outside its own list, for example ISSUED. */
    statusCode: string;
    shipmentStatus: Maybe<OBShipmentStatus>;
    shipmentId: Maybe<string>;
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
    documents: ReadonlyArray<OBStockMovementDocument>;
}>;

/* A movement from `list()`: OpenBoxes sends no documents in the list, so use `get(id)` for them. */
export type OBStockMovementSummary = Omit<OBStockMovement, "documents">;

export type StockMovementListParams = Readonly<{
    direction?: OBStockMovementDirection;
    origin?: string;
    destination?: string;
    receiptStatusCodes?: ReadonlyArray<OBShipmentStatus>;
    max?: number;
    offset?: number;
}>;

export type StockMovements = Readonly<{
    list(params?: StockMovementListParams): CancelableResponse<Paginated<OBStockMovementSummary>>;
    get(id: string): CancelableResponse<OBStockMovement>;
    uploadDocument(id: string, file: Blob, fileName: string): CancelableResponse<void>;
    /* Only for a URI on the OpenBoxes server, so the session cookie goes nowhere else. */
    downloadDocument(uri: string): CancelableResponse<Blob>;
}>;

type StockMovementApi = Pick<OBApi, "request" | "post" | "baseUrl" | "apiPath">;

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
            shipment: nullish(Codec.interface({ id: string })),
            documents: nullish(array(documentCodec)),
        })
    ),
});

const stockMovementListCodec = Codec.interface({
    data: array(stockMovementCodec),
    totalCount: number,
});

const stockMovementDetailCodec = Codec.interface({ data: stockMovementCodec });

export function createStockMovements(api: StockMovementApi): StockMovements {
    function list(
        params: StockMovementListParams = {}
    ): CancelableResponse<Paginated<OBStockMovementSummary>> {
        const query = {
            direction: params.direction,
            origin: params.origin,
            destination: params.destination,
            receiptStatusCode: params.receiptStatusCodes,
            max: params.max,
            offset: params.offset,
        };
        return getChecked(api, "/stockMovements", query, stockMovementListCodec).map(
            ({ data }) => ({
                objects: data.data.map(toStockMovementSummary),
                total: data.totalCount,
            })
        );
    }

    function get(id: string): CancelableResponse<OBStockMovement> {
        return getChecked(
            api,
            `/stockMovements/${encodeURIComponent(id)}`,
            undefined,
            stockMovementDetailCodec
        ).map(({ data }) => toStockMovement(data.data));
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
        return api.request<unknown>({ ...request, skipApiPrefix: true }).map(response => {
            if (response.data instanceof Blob) return response.data;
            throw new HttpError(`GET ${path} did not return a file`, { request, response });
        });
    }

    return { list, get, uploadDocument, downloadDocument };
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
    return {
        ...toStockMovementSummary(movement),
        documents: (movement.associations?.documents ?? []).map(toDocument),
    };
}

function toStockMovementSummary(
    movement: GetType<typeof stockMovementCodec>
): OBStockMovementSummary {
    const { associations } = movement;
    return {
        id: movement.id,
        identifier: movement.identifier,
        name: movement.name,
        description: movement.description ?? undefined,
        statusCode: movement.statusCode,
        shipmentStatus: movement.shipmentStatus ?? undefined,
        shipmentId: associations?.shipment?.id,
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
