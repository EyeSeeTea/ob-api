import { Mock, vi } from "vitest";
import { HttpError } from "../repositories/HttpClientRepository";

export const BASE_URL = "https://ob.example.org";
export const JSON_HEADERS = { "Content-Type": "application/json" };
export const SESSION_SET_COOKIE = "JSESSIONID=abc; Path=/openboxes; HttpOnly";

export type FetchCall = Readonly<{ url: string; init: RequestInit }>;

type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

export type Respond = (
    call: FetchCall,
    previousCalls: ReadonlyArray<FetchCall>
) => Promise<Response> | Response;

/* Returns a getter for every fetch call so far; `respond` also gets the calls before the current one. */
export function stubFetch(respond: Respond): () => ReadonlyArray<FetchCall> {
    const fetchMock: Mock<FetchFunction> = vi.fn(async (url: string, init: RequestInit) =>
        respond({ url, init }, fetchMock.mock.calls.slice(0, -1).map(toCall))
    );
    vi.stubGlobal("fetch", fetchMock);
    return () => fetchMock.mock.calls.map(toCall);
}

function toCall([url, init]: [string, RequestInit]): FetchCall {
    return { url, init };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: JSON_HEADERS, ...init });
}

export function hangUntilAborted({ init }: FetchCall): Promise<Response> {
    return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    });
}

export function headersOf(call: FetchCall | undefined): Record<string, string> {
    return Object.fromEntries(new Headers(call?.init.headers));
}

export function bodyOf(call: FetchCall | undefined): unknown {
    return typeof call?.init.body === "string" ? JSON.parse(call.init.body) : undefined;
}

export function errorOf(promise: Promise<unknown>): Promise<unknown> {
    return promise.then(
        () => undefined,
        (error: unknown) => error
    );
}

export async function httpErrorOf(promise: Promise<unknown>): Promise<HttpError> {
    const error = await errorOf(promise);
    if (!(error instanceof HttpError)) throw new Error(`Expected an HttpError, got: ${error}`);
    return error;
}
