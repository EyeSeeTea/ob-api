import { BASE_URL, FetchCall, jsonResponse, Respond, stubFetch } from "../../__tests__/fetchStub";
import { OBApi } from "../OBApi";

export const AUTH = { username: "user", password: "secret" };
export const API_URL = `${BASE_URL}/openboxes/api`;

export const testApi = () => new OBApi({ baseUrl: BASE_URL, auth: AUTH });

/* A fetch stub that accepts every login and answers the other requests with `respond`. */
export function stubServer(respond: Respond) {
    return stubFetch((call, previousCalls) =>
        call.url === `${API_URL}/login` ? jsonResponse({}) : respond(call, previousCalls)
    );
}

export function requestsAfterLogin(fetchCalls: ReadonlyArray<FetchCall>): ReadonlyArray<FetchCall> {
    return fetchCalls.filter(call => !call.url.endsWith("/login"));
}
