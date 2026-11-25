import type { OBApi } from "../api/OBApi";
import { Paginated } from "../api/results";
import { OBStockMovement, StockMovementListParams } from "../api/stockMovements";
import { CancelableResponse } from "../repositories/CancelableResponse";
import { mapWithConcurrency } from "./concurrency";
import { RetryPolicy, withRetry } from "./retry";
import { runWorkflow } from "./workflow";

export type SdkStockMovements = Readonly<{
    /*
     * Lists 1 page, then reads each movement of the page for its documents: 1 + page size requests.
     * When 1 read fails, the call fails.
     */
    listWithDocuments(
        params: StockMovementListParams
    ): CancelableResponse<Paginated<OBStockMovement>>;
}>;

export type SdkStockMovementsDeps = Readonly<{
    api: Pick<OBApi, "stockMovements">;
    retry: RetryPolicy;
    concurrency: number;
}>;

export function createSdkStockMovements(deps: SdkStockMovementsDeps): SdkStockMovements {
    const { api, retry, concurrency } = deps;

    function listWithDocuments(
        params: StockMovementListParams
    ): CancelableResponse<Paginated<OBStockMovement>> {
        return runWorkflow(async ({ signal }) => {
            const page = await withRetry(() => api.stockMovements.list(params), retry, signal);
            const objects = await mapWithConcurrency(
                page.objects,
                concurrency,
                (movement, readSignal) =>
                    withRetry(() => api.stockMovements.get(movement.id), retry, readSignal),
                signal
            );
            return { objects, total: page.total };
        });
    }

    return { listWithDocuments };
}
