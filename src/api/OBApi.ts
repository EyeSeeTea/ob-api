import { FetchHttpClientRepository } from "../data/FetchHttpClientRepository";
import { CancelableResponse } from "../repositories/CancelableResponse";
import {
    Credentials,
    HttpClientRepository,
    HttpRequest,
    Method,
    Params,
} from "../repositories/HttpClientRepository";
import { joinPath } from "../utils/connection";
import {
    OBEndpointPath,
    OBEndpointRequest,
    OBEndpointResponse,
    requestEndpoint,
} from "./endpoints";
import { AppContext, createAppContext } from "./appContext";
import { Categories, createCategories } from "./categories";
import { createGeneric, Generic } from "./generic";
import { createLocations, Locations } from "./locations";
import { createPartialReceipts, PartialReceipts } from "./partialReceipts";
import { createProductPackages, ProductPackages } from "./productPackages";
import { createProducts, Products } from "./products";
import { createPurchaseOrders, PurchaseOrders } from "./purchaseOrders";
import { createSession, Session } from "./session";
import { createStockMovements, StockMovements } from "./stockMovements";
import { createStockTransfers, StockTransfers } from "./stockTransfers";

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
    readonly appContext: AppContext;
    readonly products: Products;
    readonly productPackages: ProductPackages;
    readonly locations: Locations;
    readonly categories: Categories;
    readonly stockMovements: StockMovements;
    readonly partialReceipts: PartialReceipts;
    readonly stockTransfers: StockTransfers;
    readonly purchaseOrders: PurchaseOrders;
    readonly generic: Generic;
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
            chooseLocationUrl: joinPath(apiPath, "chooseLocation"),
        });
        this.appContext = createAppContext(this);
        this.products = createProducts(this);
        this.productPackages = createProductPackages(this);
        this.locations = createLocations(this);
        this.categories = createCategories(this);
        this.stockMovements = createStockMovements(this);
        this.partialReceipts = createPartialReceipts(this);
        this.stockTransfers = createStockTransfers(this);
        this.purchaseOrders = createPurchaseOrders(this);
        this.generic = createGeneric(this);
    }

    /* Logs in again, even with a valid session. A given location is also used by later logins. */
    login(locationId?: string): Promise<void> {
        return this.session.login(locationId);
    }

    /* Keeps the current session; `login(locationId)` logs in again instead. */
    chooseLocation(locationId: string): CancelableResponse<void> {
        return this.session.chooseLocation(locationId);
    }

    /* A typed OpenBoxes endpoint: `method` and `path` choose the params, the body and the checked response. */
    request<M extends Method, Path extends OBEndpointPath<M>>(
        options: OBEndpointRequest<M, Path>
    ): CancelableResponse<OBEndpointResponse<`${M} ${Path}`>> {
        return requestEndpoint(this, options);
    }

    /* Any request, without a response check: for endpoints that ob-api does not type. */
    requestUntyped<Data>(options: OBApiRequest): CancelableResponse<Data> {
        const { skipApiPrefix, ...request } = options;
        const url = skipApiPrefix ? request.url : joinPath(this.apiPath, request.url);
        return this.session.send({ ...request, url });
    }

    get<Data>(url: string, params?: Params): CancelableResponse<Data> {
        return this.requestUntyped<Data>({ method: "get", url, params });
    }

    post<Data>(
        url: string,
        params?: Params,
        data?: object,
        request?: Partial<OBApiRequest>
    ): CancelableResponse<Data> {
        return this.requestUntyped<Data>({ method: "post", url, params, data, ...request });
    }

    put<Data>(url: string, params?: Params, data?: object): CancelableResponse<Data> {
        return this.requestUntyped<Data>({ method: "put", url, params, data });
    }

    patch<Data>(url: string, params?: Params, data?: object): CancelableResponse<Data> {
        return this.requestUntyped<Data>({
            method: "patch",
            url,
            params,
            data,
            headers: PATCH_HEADERS,
        });
    }

    delete<Data>(url: string, params?: Params): CancelableResponse<Data> {
        return this.requestUntyped<Data>({ method: "delete", url, params });
    }
}
