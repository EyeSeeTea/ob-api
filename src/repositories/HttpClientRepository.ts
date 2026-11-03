import { CancelableResponse } from "./CancelableResponse";

export interface HttpClientRepository {
    request<Data>(options: HttpRequest): CancelableResponse<Data>;
}

export type Method = "get" | "post" | "put" | "patch" | "delete";

export type ParamValue = string | number | boolean | undefined;

export type Params = Readonly<Record<string, ParamValue | ReadonlyArray<ParamValue>>>;

export type HttpRequest = Readonly<{
    method: Method;
    url: string;
    params?: Params;
    data?: unknown;
    requestBodyType?: "json" | "raw";
    responseDataType?: "json" | "raw";
    validateStatus?(status: number): boolean;
    timeout?: number;
    headers?: Readonly<Record<string, string>>;
}>;

export type HttpClientResponse<Data> = Readonly<{
    status: number;
    data: Data;
    headers: Readonly<Record<string, string>>;
}>;

export type Credentials = Readonly<{
    username: string;
    password: string;
}>;

export type ConstructorOptions = Readonly<{
    baseUrl?: string;
    timeout?: number;
}>;

type HttpErrorOptions = Readonly<{
    request: HttpRequest;
    response?: HttpClientResponse<unknown>;
}>;

export class HttpError extends Error implements HttpErrorOptions {
    readonly request: HttpRequest;
    readonly response?: HttpClientResponse<unknown>;

    constructor(message: string, options: HttpErrorOptions) {
        super(message);
        this.name = "HttpError";
        this.request = options.request;
        this.response = options.response;
    }
}

export function getBody(
    dataType: HttpRequest["requestBodyType"],
    data: unknown
): BodyInit | undefined {
    if (data === undefined) return undefined;
    if (dataType !== "raw") return JSON.stringify(data);
    if (isBodyInit(data)) return data;
    throw new Error("Raw request body must be a string, Blob, FormData, URLSearchParams or buffer");
}

function isBodyInit(data: unknown): data is BodyInit {
    return (
        typeof data === "string" ||
        data instanceof Blob ||
        data instanceof FormData ||
        data instanceof URLSearchParams ||
        data instanceof ArrayBuffer ||
        ArrayBuffer.isView(data)
    );
}
