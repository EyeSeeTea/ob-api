import { FetchHttpClientRepository } from "../data/FetchHttpClientRepository";
import { CancelableResponse } from "../repositories/CancelableResponse";
import {
    Credentials,
    HttpClientRepository,
    HttpRequest,
    Params,
} from "../repositories/HttpClientRepository";
import { joinPath } from "../utils/connection";
import {
    createInventories,
    createTransactions,
    createTransactionTypes,
    Inventories,
    Transactions,
    TransactionTypes,
} from "./inventoryTransactions";
import { createLocations, Locations } from "./locations";
import { createPartialReceipts, PartialReceipts } from "./partialReceipts";
import { createPeople, People } from "./people";
import { createProducts, Products } from "./products";
import { createSession, Session } from "./session";
import { createStockMovements, StockMovements } from "./stockMovements";

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
    readonly products: Products;
    readonly locations: Locations;
    readonly stockMovements: StockMovements;
    readonly partialReceipts: PartialReceipts;
    readonly transactionTypes: TransactionTypes;
    readonly inventories: Inventories;
    readonly transactions: Transactions;
    readonly people: People;
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
        this.products = createProducts(this);
        this.locations = createLocations(this);
        this.stockMovements = createStockMovements(this);
        this.partialReceipts = createPartialReceipts(this);
        this.transactionTypes = createTransactionTypes(this);
        this.inventories = createInventories(this);
        this.transactions = createTransactions(this);
        this.people = createPeople(this);
    }

    /* Logs in again, even with a valid session. A given location is also used by later logins. */
    login(locationId?: string): Promise<void> {
        return this.session.login(locationId);
    }

    /* Keeps the current session; `login(locationId)` logs in again instead. */
    chooseLocation(locationId: string): CancelableResponse<void> {
        return this.session.chooseLocation(locationId);
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
