import { FetchHttpClientRepository } from "../data/FetchHttpClientRepository";
import { CancelableResponse } from "../repositories/CancelableResponse";
import {
    Credentials,
    HttpClientRepository,
    HttpRequest,
    Params,
} from "../repositories/HttpClientRepository";
import { joinPath } from "../utils/connection";
import { createSession, Session } from "./session";

export type OBApiOptions = Readonly<{
    baseUrl: string;
    auth: Credentials;
    locationId?: string;
    timeout?: number;
    apiPath?: string;
    /* Replaces the default fetch client, for example with a fake one in tests. */
    httpClient?: HttpClientRepository;
}>;

/* `skipApiPrefix: true` makes the URL relative to `baseUrl`, for paths outside `apiPath`. */
export type OBApiRequest = HttpRequest & Readonly<{ skipApiPrefix?: boolean }>;

const DEFAULT_API_PATH = "openboxes/api";

const PATCH_HEADERS = { "Content-Type": "application/json-patch+json" };

export class OBApi {
    readonly baseUrl: string;
    readonly apiPath: string;
    private readonly session: Session;

    constructor(options: OBApiOptions) {
        const { baseUrl, auth, locationId, timeout, apiPath = DEFAULT_API_PATH } = options;
        const httpClient =
            options.httpClient ?? new FetchHttpClientRepository({ baseUrl, timeout });

        this.baseUrl = baseUrl;
        this.apiPath = apiPath;
        this.session = createSession({
            httpClient,
            auth,
            locationId,
            loginUrl: joinPath(apiPath, "login"),
        });
    }

    /* Logs in again, even with a valid session. A given location is also used by later logins. */
    login(locationId?: string): Promise<void> {
        return this.session.login(locationId);
    }

    request<Data>(options: OBApiRequest): CancelableResponse<Data> {
        const { skipApiPrefix, ...request } = options;
        const url = skipApiPrefix ? request.url : joinPath(this.apiPath, request.url);
        return this.session.send({ ...request, url });
    }

    get<Data>(url: string, params?: Params): CancelableResponse<Data> {
        return this.request<Data>({ method: "get", url, params });
    }

    post<Data>(
        url: string,
        params?: Params,
        data?: object,
        request?: Partial<OBApiRequest>
    ): CancelableResponse<Data> {
        return this.request<Data>({ method: "post", url, params, data, ...request });
    }

    put<Data>(url: string, params?: Params, data?: object): CancelableResponse<Data> {
        return this.request<Data>({ method: "put", url, params, data });
    }

    patch<Data>(url: string, params?: Params, data?: object): CancelableResponse<Data> {
        return this.request<Data>({ method: "patch", url, params, data, headers: PATCH_HEADERS });
    }

    delete<Data>(url: string, params?: Params): CancelableResponse<Data> {
        return this.request<Data>({ method: "delete", url, params });
    }
}
