import { CancelableResponse } from "../../repositories/CancelableResponse";

export type FakeRequest<T> = Readonly<{
    response: CancelableResponse<T>;
    isStarted(): boolean;
    isCanceled(): boolean;
    resolve(data: T): void;
    reject(error: unknown): void;
}>;

/* A request that the test answers by hand; it records whether it started and whether it was canceled. */
export function fakeRequest<T>(): FakeRequest<T> {
    const state = { started: false, canceled: false };
    const settle: { resolve?: (data: T) => void; reject?: (error: unknown) => void } = {};
    const promise = new Promise<T>((resolve, reject) => {
        settle.resolve = resolve;
        settle.reject = reject;
    });

    const response = CancelableResponse.build({
        cancel: () => {
            state.canceled = true;
        },
        response: () => {
            state.started = true;
            return promise.then(data => ({ status: 200, headers: {}, data }));
        },
    });

    return {
        response,
        isStarted: () => state.started,
        isCanceled: () => state.canceled,
        resolve: data => settle.resolve?.(data),
        reject: error => settle.reject?.(error),
    };
}

/* Lets the pending promise callbacks run. */
export function flushPromises(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
}
