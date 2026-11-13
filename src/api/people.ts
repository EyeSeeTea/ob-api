import { array, Codec, GetType, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import { nullish, postChecked, RequestApi } from "./responseCheck";
import { ListResult } from "./results";

export type OBPerson = Readonly<{ id: string; name: Maybe<string>; email: Maybe<string> }>;

export type PeopleSearchParams = Readonly<{ email: string }>;

export type People = Readonly<{
    /* A POST that only reads: OpenBoxes takes the search attributes as a JSON body. */
    search(params: PeopleSearchParams): CancelableResponse<ListResult<OBPerson>>;
}>;

const personCodec = Codec.interface({ id: string, name: nullish(string), email: nullish(string) });

const personListCodec = Codec.interface({ data: array(personCodec) });

export function createPeople(api: RequestApi): People {
    return {
        search: ({ email }) =>
            postChecked(
                api,
                "/generic/person/search",
                { searchAttributes: [{ property: "email", operator: "ilike", value: email }] },
                personListCodec
            ).map(({ data }) => ({ objects: data.data.map(toPerson) })),
    };
}

function toPerson(person: GetType<typeof personCodec>): OBPerson {
    return { id: person.id, name: person.name ?? undefined, email: person.email ?? undefined };
}
