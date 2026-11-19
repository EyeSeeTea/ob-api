/* The result of a list that OpenBoxes does not page. `objects` is the name d2-api uses. */
export type ListResult<T> = Readonly<{ objects: ReadonlyArray<T> }>;

/* `total` is the number of objects that match on the server, not the length of `objects`. */
export type Paginated<T> = ListResult<T> & Readonly<{ total: number }>;
