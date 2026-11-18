import { array, boolean, Codec, GetType, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { nullish } from "./responseCheck";
import { ListResult } from "./results";

export type OBLocationType = Readonly<{
    id: string;
    name: string;
    /* For example SUPPLIER, DEPOT or DISPENSARY. OpenBoxes lets admins add more. */
    locationTypeCode: string;
}>;

export type OBLocation = Readonly<{
    id: string;
    name: string;
    active: boolean;
    locationNumber: Maybe<string>;
    locationType: OBLocationType;
    parentLocation: Maybe<Readonly<{ id: string; name: string }>>;
}>;

export type LocationListParams = Readonly<{ locationTypeCode?: string }>;

export type Locations = Readonly<{
    /* OpenBoxes returns the locations the user can see, without paging. */
    list(params?: LocationListParams): CancelableResponse<ListResult<OBLocation>>;
}>;

const locationCodec = Codec.interface({
    id: string,
    name: string,
    active: boolean,
    locationNumber: nullish(string),
    locationType: Codec.interface({ id: string, name: string, locationTypeCode: string }),
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
