import { untilAborted } from "../utils/abort";

export type LocationLock = Readonly<{
    /* Runs the task after every earlier task has settled. A task aborted while it waits never runs. */
    run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T>;
}>;

/*
 * The session holds 1 location for each client, so the workflows that change it must not overlap.
 * Holds the tail of the queue in one closure, as the session holds its login promise.
 */
export function createLocationLock(): LocationLock {
    let tail: Promise<void> = Promise.resolve();

    function run<T>(task: () => Promise<T>, signal: AbortSignal): Promise<T> {
        const previous = tail;
        const result = untilAborted(previous, signal).then(task);
        // A task aborted while it waits settles early, but the next task still waits for the earlier ones.
        tail = previous.then(() => result.then(ignore, ignore));
        return result;
    }

    return { run };
}

function ignore(): void {}
