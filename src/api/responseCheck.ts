import { Codec, nullable, optional } from "purify-ts";
import { CancelableResponse } from "../repositories/CancelableResponse";
import {
    HttpClientResponse,
    HttpError,
    HttpRequest,
    Params,
} from "../repositories/HttpClientRepository";
import type { OBApi } from "./OBApi";

/* purify-ts puts the whole received object in its message; the full body stays in the error response. */
const MAX_PROBLEM_LENGTH = 300;

export type RequestApi = Pick<OBApi, "request">;

/* OpenBoxes sends `null` for absent values. Convert them to `undefined` when building the public type. */
export function nullish<T>(codec: Codec<T>) {
    return optional(nullable(codec));
}

export function getChecked<T>(
    api: RequestApi,
    url: string,
    params: Params | undefined,
    codec: Codec<T>
): CancelableResponse<T> {
    return requestChecked(api, { method: "get", url, params }, codec);
}

export function postChecked<T>(
    api: RequestApi,
    url: string,
    data: object,
    codec: Codec<T>
): CancelableResponse<T> {
    return requestChecked(api, { method: "post", url, data }, codec);
}

function requestChecked<T>(
    api: RequestApi,
    request: HttpRequest,
    codec: Codec<T>
): CancelableResponse<T> {
    return api.request<unknown>(request).map(response => checkResponse(codec, request, response));
}

export function checkResponse<T>(
    codec: Codec<T>,
    request: HttpRequest,
    response: HttpClientResponse<unknown>
): T {
    return codec.decode(response.data).caseOf({
        Right: value => value,
        Left: problem => {
            const method = request.method.toUpperCase();
            const message = `${method} ${request.url} returned an unexpected response: ${truncate(problem)}`;
            throw new HttpError(message, { request, response });
        },
    });
}

function truncate(text: string): string {
    return text.length > MAX_PROBLEM_LENGTH ? `${text.slice(0, MAX_PROBLEM_LENGTH)}…` : text;
}
