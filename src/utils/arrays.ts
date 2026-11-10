export function chunk<T>(items: ReadonlyArray<T>, size: number): ReadonlyArray<ReadonlyArray<T>> {
    if (!Number.isInteger(size) || size < 1) {
        throw new Error(`Chunk size must be a positive integer, got ${size}`);
    }

    const chunkCount = Math.ceil(items.length / size);
    return Array.from({ length: chunkCount }, (_, index) =>
        items.slice(index * size, (index + 1) * size)
    );
}
