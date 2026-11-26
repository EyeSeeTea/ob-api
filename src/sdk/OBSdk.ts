import type { OBApi } from "../api/OBApi";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { createLocationLock } from "./locationLock";
import { DEFAULT_RETRY_POLICY, RetryPolicy } from "./retry";
import {
    createServerVersionReader,
    ReadServerVersion,
    ServerVersionOptions,
} from "./serverVersion";
import { createSdkShipments, SdkShipments } from "./shipments";
import { createSdkStockMovements, SdkStockMovements } from "./stockMovements";
import { OBCapabilities, OBServerVersion, toCapabilities } from "./version";
import { runWorkflow } from "./workflow";

export type OBSdkOptions = Readonly<{
    /* The SDK sends every request through this client, so it uses its session. */
    api: OBApi;
    /* The OpenBoxes version, for example "0.9.7". The SDK then sends no request to read it. */
    version?: string;
    retry?: Partial<RetryPolicy>;
    /* The most reads of 1 workflow at the same time. */
    concurrency?: number;
}>;

const DEFAULT_CONCURRENCY = 4;

/*
 * The SDK layer: workflows of several OpenBoxes requests, on top of the low-level `OBApi`. The inputs
 * and results have the shapes of the reference version (`OB_REFERENCE_VERSION`) on every server.
 */
export class OBSdk {
    readonly stockMovements: SdkStockMovements;
    readonly shipments: SdkShipments;
    private readonly readServerVersion: ReadServerVersion;

    constructor(options: OBSdkOptions) {
        const { api, version, concurrency = DEFAULT_CONCURRENCY } = options;
        const retry = { ...DEFAULT_RETRY_POLICY, ...options.retry };
        checkOptions(retry, concurrency);
        // 1 lock for each SDK: the workflows that change the session location run one at a time.
        const lock = createLocationLock();

        this.readServerVersion = createServerVersionReader({ api, lock, retry, version });
        this.stockMovements = createSdkStockMovements({ api, retry, concurrency });
        this.shipments = createSdkShipments({ api, lock, retry });
    }

    /*
     * Read once and kept. The callers share the read: a cancel stops only the wait of its caller, and
     * the read continues for the others.
     */
    serverVersion(options?: ServerVersionOptions): CancelableResponse<OBServerVersion> {
        return runWorkflow(() => this.readServerVersion(options));
    }

    capabilities(options?: ServerVersionOptions): CancelableResponse<OBCapabilities> {
        return runWorkflow(() => this.readServerVersion(options).then(toCapabilities));
    }
}

/* A `NaN` attempts count retries without end, and a `NaN` concurrency drops every item. */
function checkOptions(retry: RetryPolicy, concurrency: number): void {
    if (!Number.isInteger(retry.attempts) || retry.attempts < 1) {
        throw new RangeError(`retry.attempts must be an integer of 1 or more: ${retry.attempts}`);
    }
    if (!Number.isFinite(retry.delayMs) || retry.delayMs < 0) {
        throw new RangeError(`retry.delayMs must be a number of 0 or more: ${retry.delayMs}`);
    }
    if (!Number.isInteger(concurrency) || concurrency < 1) {
        throw new RangeError(`concurrency must be an integer of 1 or more: ${concurrency}`);
    }
}
