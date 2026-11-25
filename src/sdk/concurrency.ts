import { childAbortController } from "../utils/abort";

type Indexed<R> = readonly [number, R];

/*
 * Maps the items with at most `limit` calls of `fn` at the same time, and keeps the order of the items.
 * On the first failure, it aborts the signal of the calls in progress and starts no new call.
 */
export async function mapWithConcurrency<T, R>(
    items: ReadonlyArray<T>,
    limit: number,
    fn: (item: T, signal: AbortSignal) => Promise<R>,
    signal: AbortSignal
): Promise<ReadonlyArray<R>> {
    const controller = childAbortController(signal);
    // The workers share 1 iterator, so each item goes to the first free worker.
    const entries = items.entries();

    const worker = async (): Promise<ReadonlyArray<Indexed<R>>> => {
        if (controller.signal.aborted) throw controller.signal.reason;
        const next = entries.next();
        if (next.done) return [];

        const [index, item] = next.value;
        const result = await fn(item, controller.signal);
        return [[index, result], ...(await worker())];
    };

    const workerCount = Math.max(1, Math.min(limit, items.length));
    try {
        const results = await Promise.all(Array.from({ length: workerCount }, worker));
        // `sort` changes only the new array from `flat`; `toSorted` needs ES2023.
        return results
            .flat()
            .sort(([a], [b]) => a - b)
            .map(([, result]) => result);
    } catch (error) {
        controller.abort();
        throw error;
    }
}
