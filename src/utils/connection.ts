import { ParamValue, Params } from "../repositories/HttpClientRepository";
import { isDefined, Maybe } from "./ts-utils";

export function joinPath(...parts: ReadonlyArray<Maybe<string>>): string {
    const presentParts = parts.filter((part): part is string => Boolean(part));
    const lastIndex = presentParts.length - 1;

    return presentParts
        .map((part, index) => {
            // Keep the scheme slashes of the first part and a trailing slash on the last one.
            const withoutLeading = index === 0 ? part : part.replace(/^\/+/, "");
            return index === lastIndex ? withoutLeading : withoutLeading.replace(/\/+$/, "");
        })
        .filter(part => part !== "")
        .join("/");
}

/* Adds the parameters to the URL, after the query string the URL already has, if any. */
export function appendQueryString(url: string, params: Params = {}): string {
    const entries = Object.entries(params).flatMap(([key, value]) =>
        toArray(value)
            .filter(isDefined)
            .map((item): [string, string] => [key, String(item)])
    );
    const query = new URLSearchParams(entries).toString();
    if (!query) return url;

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${query}`;
}

function toArray(value: ParamValue | ReadonlyArray<ParamValue>): ReadonlyArray<ParamValue> {
    return isParamArray(value) ? value : [value];
}

// Array.isArray does not narrow a ReadonlyArray union member.
function isParamArray(
    value: ParamValue | ReadonlyArray<ParamValue>
): value is ReadonlyArray<ParamValue> {
    return Array.isArray(value);
}
