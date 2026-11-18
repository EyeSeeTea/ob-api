import { describe, expect, it } from "vitest";
import { toRef } from "../refs";

describe("toRef", () => {
    it("builds the reference from the dotted id and name", () => {
        expect(toRef("bin-1", "Shelf A")).toEqual({ id: "bin-1", name: "Shelf A" });
    });

    it("gives an undefined name for a null or absent name", () => {
        expect(toRef("bin-1", null)).toEqual({ id: "bin-1", name: undefined });
        expect(toRef("bin-1", undefined)).toEqual({ id: "bin-1", name: undefined });
    });

    it("gives undefined when there is no id, whatever the name is", () => {
        expect(toRef(null, "Unpacked")).toBeUndefined();
        expect(toRef(undefined, undefined)).toBeUndefined();
    });
});
