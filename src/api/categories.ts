import { array, boolean, Codec, number, string } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { Maybe } from "../utils/ts-utils";
import type { EndpointApi } from "./endpoints";
import { OBIdRef } from "./refs";
import { nullish } from "./responseCheck";
import { ListResult } from "./results";

export type OBCategory = Readonly<{
    id: string;
    name: string;
    description: Maybe<string>;
    sortOrder: Maybe<number>;
    isRoot: Maybe<boolean>;
    categories: ReadonlyArray<OBCategory>;
}>;

export type CategoryInput = Readonly<{
    name: string;
    description?: string;
    parentCategory?: OBIdRef;
    sortOrder?: number;
}>;

/* CategoryApiController.save binds `params`, not the JSON body, for an update. */
export type CategoryUpdateQuery = Readonly<{
    name?: string;
    description?: string;
    "parentCategory.id"?: string;
    sortOrder?: number;
}>;

export type Categories = Readonly<{
    /* Every category, without paging. */
    list(): CancelableResponse<ListResult<OBCategory>>;
    get(id: string): CancelableResponse<OBCategory>;
    create(category: CategoryInput): CancelableResponse<OBCategory>;
    /* Sends only the given fields, as query parameters: OpenBoxes ignores the body of an update. */
    update(id: string, fields: Partial<CategoryInput>): CancelableResponse<OBCategory>;
    delete(id: string): CancelableResponse<void>;
}>;

/* Category.toJson, with its child categories. */
type CategoryJson = Readonly<{
    id: string;
    name: string;
    description?: string | null;
    sortOrder?: number | null;
    isRoot?: boolean | null;
    categories?: ReadonlyArray<CategoryJson> | null;
}>;

/* Recursive: the decode reads `categoryCodec` when it runs, after the definition. */
export const categoryCodec: Codec<CategoryJson> = Codec.custom<CategoryJson>({
    decode: input =>
        Codec.interface({
            id: string,
            name: string,
            description: nullish(string),
            sortOrder: nullish(number),
            isRoot: nullish(boolean),
            categories: nullish(array(categoryCodec)),
        }).decode(input),
    encode: input => input,
});

export const categoryListCodec = Codec.interface({ data: array(categoryCodec) });

/* CategoryApiController answers a read or a save with the category itself, without `{ data }`. */
export function createCategories(api: EndpointApi): Categories {
    return {
        list: () =>
            api
                .request({ method: "get", path: "/categories" })
                .map(({ data }) => ({ objects: data.data.map(toCategory) })),
        get: id =>
            api
                .request({ method: "get", path: "/categories/{id}", pathParams: { id } })
                .map(({ data }) => toCategory(data)),
        create: category =>
            api
                .request({ method: "post", path: "/categories", data: category })
                .map(({ data }) => toCategory(data)),
        update: (id, fields) =>
            api
                .request({
                    method: "put",
                    path: "/categories/{id}",
                    pathParams: { id },
                    params: toUpdateQuery(fields),
                })
                .map(({ data }) => toCategory(data)),
        delete: id =>
            api
                .request({ method: "delete", path: "/categories/{id}", pathParams: { id } })
                .map(() => undefined),
    };
}

function toUpdateQuery(fields: Partial<CategoryInput>): CategoryUpdateQuery {
    const { parentCategory, ...rest } = fields;
    return parentCategory ? { ...rest, "parentCategory.id": parentCategory.id } : rest;
}

function toCategory(category: CategoryJson): OBCategory {
    return {
        id: category.id,
        name: category.name,
        description: category.description ?? undefined,
        sortOrder: category.sortOrder ?? undefined,
        isRoot: category.isRoot ?? undefined,
        categories: (category.categories ?? []).map(toCategory),
    };
}
