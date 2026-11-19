import { Maybe } from "../utils/ts-utils";

/* A reference by id only, as OpenBoxes takes it in a body: `{ "product": { "id": "…" } }`. */
export type OBIdRef = Readonly<{ id: string }>;

/* A reference that OpenBoxes sends as dotted keys, for example `"binLocation.id"` and `"binLocation.name"`. */
export type OBRef = OBIdRef & Readonly<{ name: Maybe<string> }>;

/* `undefined` when OpenBoxes sends no id (`null`, absent or `""`): the reference is absent, whatever the name is. */
export function toRef(id: Maybe<string | null>, name: Maybe<string | null>): Maybe<OBRef> {
    return id ? { id, name: name ?? undefined } : undefined;
}
