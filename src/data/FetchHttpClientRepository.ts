import { CancelableResponse, isCancel, toAbortReason } from "../repositories/CancelableResponse";
import {
    ConstructorOptions,
    getBody,
    HttpClientRepository,
    HttpClientResponse,
    HttpError,
    HttpRequest,
    isJsonBody,
} from "../repositories/HttpClientRepository";
import { appendQueryString, joinPath } from "../utils/connection";
import { Cookies, mergeSetCookies, toCookieHeader } from "../utils/cookies";

/*
 * One code path for Node and the browser. In Node, getSetCookie() returns the session cookie,
 * so it is stored and sent back. In the browser it returns nothing (scripts cannot read Set-Cookie),
 * or does not exist (browsers from before 2023), and credentials: "include" lets the browser
 * handle the cookie.
 */
export class FetchHttpClientRepository implements HttpClientRepository {
    private cookies: Cookies = new Map();

    constructor(private readonly options: ConstructorOptions) {}

    request<Data>(options: HttpRequest): CancelableResponse<Data> {
        const controller = new AbortController();
        const timeout = options.timeout ?? this.options.timeout;

        const response = async (): Promise<HttpClientResponse<Data>> => {
            const timeoutReason = new Error(`Request timed out after ${timeout} ms`);
            const timeoutId = timeout
                ? setTimeout(() => controller.abort(timeoutReason), timeout)
                : undefined;

            try {
                const res = await fetch(this.getUrl(options), this.getInit(options, controller));
                this.cookies = mergeSetCookies(this.cookies, res.headers.getSetCookie?.() ?? []);
                return await this.toResponse<Data>(options, res);
            } catch (error) {
                throw toRequestError(options, error, controller.signal.reason === timeoutReason);
            } finally {
                clearTimeout(timeoutId);
            }
        };

        const cancel = (message?: string) => controller.abort(toAbortReason(message));
        return CancelableResponse.build({ cancel, response });
    }

    private getUrl(options: HttpRequest): string {
        return appendQueryString(joinPath(this.options.baseUrl, options.url), options.params);
    }

    private getInit(options: HttpRequest, controller: AbortController): RequestInit {
        const { method, data, requestBodyType = "json", headers = {} } = options;
        const cookieHeader = toCookieHeader(this.cookies);

        return {
            // fetch upper-cases get/post/put/delete itself, but sends "patch" as written.
            method: method.toUpperCase(),
            signal: controller.signal,
            body: getBody(requestBodyType, data),
            credentials: "include",
            headers: {
                Accept: "application/json, text/plain",
                ...(isJsonBody(requestBodyType, data)
                    ? { "Content-Type": "application/json;charset=UTF-8" }
                    : {}),
                ...(cookieHeader ? { Cookie: cookieHeader } : {}),
                ...headers,
            },
        };
    }

    private async toResponse<Data>(
        options: HttpRequest,
        res: Response
    ): Promise<HttpClientResponse<Data>> {
        const { responseDataType = "json", validateStatus = isStatus2xx } = options;
        const { data, isInvalidJson } = await getResponseData(res, responseDataType);
        const response = { status: res.status, data, headers: Object.fromEntries(res.headers) };
        const requestName = `${options.method.toUpperCase()} ${options.url}`;

        if (!validateStatus(res.status)) {
            const message = `${requestName} failed with status ${res.status}`;
            throw new HttpError(message, { request: options, response });
        }
        if (isInvalidJson) {
            const message = `${requestName} returned invalid JSON with status ${res.status}`;
            throw new HttpError(message, { request: options, response });
        }

        // The caller states the response type; see .est_ai/rules/project/http-boundary-cast.md.
        return { ...response, data: response.data as Data };
    }
}

function toRequestError(options: HttpRequest, error: unknown, isTimeout: boolean): unknown {
    if (error instanceof HttpError) return error;
    if (isTimeout) {
        return new HttpError(`${options.url}: request timed out`, { request: options });
    }
    if (isCancel(error)) return error;

    const message = error instanceof Error ? error.message : String(error);
    return new HttpError(`${options.url}: ${message}`, { request: options });
}

type ResponseData = Readonly<{ data: unknown; isInvalidJson: boolean }>;

/* A body that claims to be JSON but does not parse is kept as text, so the error can show it. */
async function getResponseData(
    res: Response,
    dataType: HttpRequest["responseDataType"]
): Promise<ResponseData> {
    if (dataType === "raw") return { data: await res.blob(), isInvalidJson: false };

    const text = await res.text();
    const isJson = res.headers.get("Content-Type")?.includes("json") ?? false;
    if (!isJson || !text) return { data: text, isInvalidJson: false };

    try {
        return { data: JSON.parse(text), isInvalidJson: false };
    } catch {
        return { data: text, isInvalidJson: true };
    }
}

function isStatus2xx(status: number): boolean {
    return status >= 200 && status < 300;
}
