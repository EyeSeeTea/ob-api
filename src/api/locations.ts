import { array, boolean, Codec, exactly, GetType, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { OBIdRef } from "./refs";
import { nullish } from "./responseCheck";
import { ListResult } from "./results";

/* LocationTypeCode (the same in v0.9.7 and develop). Admins can add location types, but each type has one of these codes. Other values make OpenBoxes answer 500. */
export const OB_LOCATION_TYPE_CODES = [
    "DEFAULT",
    "DEPOT",
    "ZONE",
    "BIN_LOCATION",
    "INTERNAL",
    "DISPENSARY",
    "WARD",
    "SUPPLIER",
    "DONOR",
    "CONSUMER",
    "DISTRIBUTOR",
    "DISPOSAL",
    "VIRTUAL",
] as const;

export type OBLocationTypeCode = (typeof OB_LOCATION_TYPE_CODES)[number];

export type OBLocationType = Readonly<{
    id: string;
    name: string;
    locationTypeCode: OBLocationTypeCode;
}>;

export type OBLocation = Readonly<{
    id: string;
    name: string;
    active: boolean;
    locationNumber: Maybe<string>;
    locationType: OBLocationType;
    parentLocation: Maybe<Readonly<{ id: string; name: string }>>;
}>;

export type LocationListParams = Readonly<{ locationTypeCode?: OBLocationTypeCode }>;

/* A type of location that an admin defined, with its OpenBoxes code. */
export type OBLocationTypeDetail = Readonly<{
    id: string;
    name: string;
    description: Maybe<string>;
    locationTypeCode: Maybe<OBLocationTypeCode>;
    supportedActivities: ReadonlyArray<string>;
}>;

export type LocationInput = Readonly<{
    name: string;
    locationType: OBIdRef;
    locationNumber?: string;
    /* OpenBoxes requires it for most location types (for example a depot), but not for a bin location. */
    organization?: OBIdRef;
    parentLocation?: OBIdRef;
    active?: boolean;
    supportedActivities?: ReadonlyArray<string>;
}>;

export type Locations = Readonly<{
    /* OpenBoxes returns the locations the user can see, without paging. */
    list(params?: LocationListParams): CancelableResponse<ListResult<OBLocation>>;
    get(id: string): CancelableResponse<OBLocation>;
    create(location: LocationInput): CancelableResponse<OBLocation>;
    /* Sends only the given fields. */
    update(id: string, fields: Partial<LocationInput>): CancelableResponse<OBLocation>;
    delete(id: string): CancelableResponse<void>;
    locationTypes(): CancelableResponse<ListResult<OBLocationTypeDetail>>;
}>;

const locationCodec = Codec.interface({
    id: string,
    name: string,
    active: boolean,
    locationNumber: nullish(string),
    locationType: Codec.interface({
        id: string,
        name: string,
        locationTypeCode: exactly(...OB_LOCATION_TYPE_CODES),
    }),
    parentLocation: nullish(Codec.interface({ id: string, name: string })),
});

export const locationListCodec = Codec.interface({ data: array(locationCodec) });

export const locationDetailCodec = Codec.interface({ data: locationCodec });

const locationTypeDetailCodec = Codec.interface({
    id: string,
    name: string,
    description: nullish(string),
    locationTypeCode: nullish(exactly(...OB_LOCATION_TYPE_CODES)),
    supportedActivities: nullish(array(string)),
});

export const locationTypeListCodec = Codec.interface({ data: array(locationTypeDetailCodec) });

export function createLocations(api: EndpointApi): Locations {
    function list(params: LocationListParams = {}): CancelableResponse<ListResult<OBLocation>> {
        return api
            .request({ method: "get", path: "/locations", params })
            .map(({ data }) => ({ objects: data.data.map(toLocation) }));
    }

    const toLocationResult = ({ data }: { data: GetType<typeof locationDetailCodec> }) =>
        toLocation(data.data);

    return {
        list,
        get: id =>
            api
                .request({ method: "get", path: "/locations/{id}", pathParams: { id } })
                .map(toLocationResult),
        create: location =>
            api
                .request({ method: "post", path: "/locations", data: location })
                .map(toLocationResult),
        update: (id, fields) =>
            api
                .request({
                    method: "post",
                    path: "/locations/{id}",
                    pathParams: { id },
                    data: fields,
                })
                .map(toLocationResult),
        delete: id =>
            api
                .request({ method: "delete", path: "/locations/{id}", pathParams: { id } })
                .map(() => undefined),
        locationTypes: () =>
            api
                .request({ method: "get", path: "/locations/locationTypes" })
                .map(({ data }) => ({ objects: data.data.map(toLocationTypeDetail) })),
    };
}

function toLocation(location: GetType<typeof locationCodec>): OBLocation {
    const { locationType, parentLocation } = location;
    return {
        id: location.id,
        name: location.name,
        active: location.active,
        locationNumber: location.locationNumber ?? undefined,
        locationType: {
            id: locationType.id,
            name: locationType.name,
            locationTypeCode: locationType.locationTypeCode,
        },
        parentLocation: parentLocation
            ? { id: parentLocation.id, name: parentLocation.name }
            : undefined,
    };
}

function toLocationTypeDetail(type: GetType<typeof locationTypeDetailCodec>): OBLocationTypeDetail {
    return {
        id: type.id,
        name: type.name,
        description: type.description ?? undefined,
        locationTypeCode: type.locationTypeCode ?? undefined,
        supportedActivities: type.supportedActivities ?? [],
    };
}
