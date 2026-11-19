import { HttpClientResponse } from "./HttpClientRepository";
import { Maybe } from "../utils/ts-utils";

export type Canceler = (message?: string) => void;

export class CancelableResponse<Data> {
    constructor(
        public readonly cancel: Canceler,
        public readonly response: () => Promise<HttpClientResponse<Data>>
    ) {}

    static build<BuildData>(options: {
        cancel?: Canceler;
        response: () => Promise<HttpClientResponse<BuildData>>;
    }): CancelableResponse<BuildData> {
        return new CancelableResponse(options.cancel ?? noop, options.response);
    }

    getData(): Promise<Data> {
        return this.response().then(({ data }) => data);
    }

    map<MappedData>(
        mapper: (response: HttpClientResponse<Data>) => MappedData
    ): CancelableResponse<MappedData> {
        const { cancel, response } = this;
        const mappedResponse = () =>
            response().then(response_ => ({ ...response_, data: mapper(response_) }));
        return new CancelableResponse(cancel, mappedResponse);
    }

    flatMap<MappedData>(
        mapper: (response: HttpClientResponse<Data>) => CancelableResponse<MappedData>
    ): CancelableResponse<MappedData> {
        const { cancel, response } = this;
        // Set once the first response arrives, so cancel() can also stop the second request.
        let cancelSecond: Maybe<Canceler>;
        // Kept so a cancel that comes before the second request starts still stops it.
        let cancelRequest: Maybe<Readonly<{ message?: string }>>;

        const mappedResponse = () =>
            response().then(response_ => {
                const second = mapper(response_);
                cancelSecond = second.cancel;
                if (cancelRequest) second.cancel(cancelRequest.message);
                return second.response();
            });

        const cancelAll: Canceler = message => {
            cancelRequest = { message };
            cancel(message);
            cancelSecond?.(message);
        };

        return new CancelableResponse(cancelAll, mappedResponse);
    }
}

export function isCancel(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError"
    );
}

/* An AbortError that keeps the cancel message; without a message, the default abort reason is used. */
export function toAbortReason(message?: string): Maybe<DOMException> {
    return message === undefined ? undefined : new DOMException(message, "AbortError");
}

const noop: Canceler = () => {};

/* A response that needs no request, for example the result of an empty list of ids. */
export function resolvedResponse<Data>(data: Data): CancelableResponse<Data> {
    return CancelableResponse.build({
        response: () => Promise.resolve({ status: 200, headers: {}, data }),
    });
}

/* A response that fails before any request, for example for an input the client refuses. */
export function rejectedResponse<Data>(error: Error): CancelableResponse<Data> {
    return CancelableResponse.build({ response: () => Promise.reject(error) });
}
