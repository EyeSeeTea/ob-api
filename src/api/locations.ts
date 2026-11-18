import { array, boolean, Codec, exactly, GetType, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
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

export type Locations = Readonly<{
    /* OpenBoxes returns the locations the user can see, without paging. */
    list(params?: LocationListParams): CancelableResponse<ListResult<OBLocation>>;
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

export function createLocations(api: EndpointApi): Locations {
    function list(params: LocationListParams = {}): CancelableResponse<ListResult<OBLocation>> {
        return api
            .request({ method: "get", path: "/locations", params })
            .map(({ data }) => ({ objects: data.data.map(toLocation) }));
    }

    return { list };
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
