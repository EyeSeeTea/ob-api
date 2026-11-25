import { FetchCall, jsonResponse } from "../../__tests__/fetchStub";
import {
    API_URL,
    requestsAfterLogin,
    stubServer,
    testApi,
} from "../../api/__tests__/endpointServer";
import { OBSdk, OBSdkOptions } from "../OBSdk";

/* `"GET /partialReceiving/sh-1"`: the method and the URL after the API path, without the query. */
export type RouteKey = string;

type Route = (call: FetchCall) => Response | Promise<Response>;

export function routeKey(call: FetchCall): RouteKey {
    const method = (call.init.method ?? "GET").toUpperCase();
    const path = call.url.slice(API_URL.length).split("?")[0] ?? "";
    return `${method} ${path}`;
}

/* Answers each request with its route; a request without a route gets status 404. */
export function stubRoutes(routes: Readonly<Record<RouteKey, Route>>) {
    const calls = stubServer(call => {
        const route = routes[routeKey(call)];
        return route ? route(call) : jsonResponse({ error: routeKey(call) }, { status: 404 });
    });
    return () => requestsAfterLogin(calls());
}

export const sentRoutes = (calls: ReadonlyArray<FetchCall>) => calls.map(routeKey);

export const APP_CONTEXT = { data: { appVersion: "0.9.7-SNAPSHOT", buildNumber: "e475522" } };

export const emptyOk = () => new Response(null, { status: 200 });

/* No retries by default, so a test does not wait for the retry delays. */
export const testSdk = (options: Partial<OBSdkOptions> = {}) =>
    new OBSdk({ api: testApi(), retry: { attempts: 1 }, ...options });
