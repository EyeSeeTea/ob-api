import { Codec, Left, nullable, optional, Right } from "purify-ts";
import { HttpClientResponse, HttpError, HttpRequest } from "../repositories/HttpClientRepository";
import { Maybe } from "../utils/ts-utils";

/* purify-ts puts the whole received object in its message; the full body stays in the error response. */
const MAX_PROBLEM_LENGTH = 300;

/* OpenBoxes sends `null` for absent values. Convert them to `undefined` when building the public type. */
export function nullish<T>(codec: Codec<T>) {
    return optional(nullable(codec));
}

/* Some OpenBoxes JSON (for example StockTransfer.toJson) sends `""` for an absent string. */
export function emptyToUndefined(value: Maybe<string | null>): Maybe<string> {
    return value || undefined;
}

/* The fetch client gives `""` for an answer without a body (status 204, or `render status: 200`). */
export const emptyResponseCodec = Codec.custom<"">({
    decode: input =>
        input === ""
            ? Right("")
            : Left(`Expected an empty body, but received ${JSON.stringify(input)}`),
    encode: input => input,
});

export function checkResponse<T>(
    decoder: Pick<Codec<T>, "decode">,
    request: HttpRequest,
    response: HttpClientResponse<unknown>
): T {
    return decoder.decode(response.data).caseOf({
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
