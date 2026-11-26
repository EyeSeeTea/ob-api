import { CancelableResponse, toAbortReason } from "../repositories/CancelableResponse";
import { untilAborted } from "../utils/abort";

export type WorkflowContext = Readonly<{
    signal: AbortSignal;
    /* Sends the request and waits for its data. An abort of `signal` cancels the request. */
    step<T>(response: CancelableResponse<T>): Promise<T>;
}>;

/* Sends the request only when the signal is not aborted yet, and cancels it on abort. */
export function awaitResponse<T>(response: CancelableResponse<T>, signal: AbortSignal): Promise<T> {
    if (signal.aborted) return Promise.reject(signal.reason);

    const cancel = () => response.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    return untilAborted(response.getData(), signal).finally(() =>
        signal.removeEventListener("abort", cancel)
    );
}

/*
 * Runs a workflow of several requests as one CancelableResponse, the type of the low-level layer.
 * A cancel aborts the signal of the workflow: the request in progress is canceled, and the next
 * `step` rejects without a request.
 */
export function runWorkflow<T>(
    body: (context: WorkflowContext) => Promise<T>
): CancelableResponse<T> {
    const controller = new AbortController();
    const { signal } = controller;
    const step: WorkflowContext["step"] = response => awaitResponse(response, signal);

    const response = async () => {
        if (signal.aborted) throw signal.reason;
        const data = await untilAborted(body({ signal, step }), signal);
        return { status: 200, headers: {}, data };
    };

    const cancel = (message?: string) => controller.abort(toAbortReason(message));
    return CancelableResponse.build({ cancel, response });
}
