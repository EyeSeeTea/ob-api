/* Rejects with the abort reason as soon as the signal aborts, even when `promise` never settles. */
export function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(signal.reason);

    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
    });
}

/* Resolves after `ms` milliseconds, or rejects with the abort reason when the signal aborts first. */
export function delay(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.reject(signal.reason);

    return new Promise<void>((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", onAbort);
            resolve();
        }, ms);
        signal.addEventListener("abort", onAbort, { once: true });
    });
}

/* A signal that aborts with its parent, and also on its own `abort()`. */
export function childAbortController(parent: AbortSignal): AbortController {
    const child = new AbortController();
    if (parent.aborted) {
        child.abort(parent.reason);
        return child;
    }

    const onParentAbort = () => child.abort(parent.reason);
    parent.addEventListener("abort", onParentAbort, { once: true });
    child.signal.addEventListener(
        "abort",
        () => parent.removeEventListener("abort", onParentAbort),
        { once: true }
    );
    return child;
}
