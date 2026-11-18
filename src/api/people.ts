import { array, Codec, GetType, string } from "purify-ts";
import { CancelableResponse, rejectedResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { nullish } from "./responseCheck";
import { ListResult } from "./results";

/* The operators of the OpenBoxes generic search (GenericApiService.buildCriterion); others fail. */
export const OB_SEARCH_OPERATORS = ["eq", "like", "ilike"] as const;

export type OBSearchOperator = (typeof OB_SEARCH_OPERATORS)[number];

export type OBSearchAttribute = Readonly<{
    property: string;
    /* `like` and `ilike` take `%` as the wildcard; without it they match the whole value. */
    operator: OBSearchOperator;
    /* `search` rejects an empty value before the request: OpenBoxes answers 500 for it. */
    value: string;
}>;

export type OBSearchBody = Readonly<{ searchAttributes: ReadonlyArray<OBSearchAttribute> }>;

export type OBPerson = Readonly<{ id: string; name: Maybe<string>; email: Maybe<string> }>;

export type People = Readonly<{
    /* A POST that only reads: OpenBoxes takes the search attributes as a JSON body. */
    search(body: OBSearchBody): CancelableResponse<ListResult<OBPerson>>;
}>;

const personCodec = Codec.interface({ id: string, name: nullish(string), email: nullish(string) });

export const personListCodec = Codec.interface({ data: array(personCodec) });

export function createPeople(api: EndpointApi): People {
    function search(body: OBSearchBody): CancelableResponse<ListResult<OBPerson>> {
        const incomplete = body.searchAttributes.filter(isIncomplete);
        if (incomplete.length > 0) {
            const names = incomplete
                .map(attribute => JSON.stringify(attribute.property))
                .join(", ");
            return rejectedResponse(
                new Error(`Search attributes need a property and a value: ${names}`)
            );
        }

        return api
            .request({ method: "post", path: "/generic/person/search", data: body })
            .map(({ data }) => ({ objects: data.data.map(toPerson) }));
    }

    return { search };
}

/* OpenBoxes answers 500 for an empty property or value ("Property and value are required"). */
function isIncomplete(attribute: OBSearchAttribute): boolean {
    return attribute.property === "" || attribute.value === "";
}

function toPerson(person: GetType<typeof personCodec>): OBPerson {
    return { id: person.id, name: person.name ?? undefined, email: person.email ?? undefined };
}
