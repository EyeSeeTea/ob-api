export type Maybe<T> = T | undefined;

export function isDefined<T>(value: Maybe<T>): value is T {
    return value !== undefined;
}
