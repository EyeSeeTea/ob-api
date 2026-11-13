import { describe, expect, it } from "vitest";
import { appendQueryString, joinPath } from "../connection";

const BASE_URL = "https://ob.example.org";

describe("joinPath", () => {
    it("joins parts with one slash", () => {
        expect(joinPath(BASE_URL, "openboxes/api", "products")).toEqual(
            `${BASE_URL}/openboxes/api/products`
        );
    });

    it("removes extra leading and trailing slashes between parts", () => {
        expect(joinPath(`${BASE_URL}/`, "/openboxes/api/", "/products")).toEqual(
            `${BASE_URL}/openboxes/api/products`
        );
    });

    it("keeps a trailing slash on the last part", () => {
        expect(joinPath(BASE_URL, "api", "products/")).toEqual(`${BASE_URL}/api/products/`);
    });

    it("skips empty and undefined parts", () => {
        expect(joinPath(BASE_URL, undefined, "", "products")).toEqual(`${BASE_URL}/products`);
    });
});

describe("appendQueryString", () => {
    const URL = "products";

    it("returns the URL unchanged without parameters", () => {
        expect(appendQueryString(URL)).toEqual(URL);
        expect(appendQueryString(URL, {})).toEqual(URL);
        expect(appendQueryString(URL, { q: undefined })).toEqual(URL);
    });

    it("encodes values", () => {
        expect(appendQueryString(URL, { max: 10, q: "a b&c", active: true })).toEqual(
            "products?max=10&q=a+b%26c&active=true"
        );
    });

    it("repeats the key for each array value", () => {
        expect(appendQueryString(URL, { id: ["1", "2"] })).toEqual("products?id=1&id=2");
    });

    it("leaves out undefined values", () => {
        expect(appendQueryString(URL, { q: undefined, max: 5, id: ["1", undefined] })).toEqual(
            "products?max=5&id=1"
        );
    });

    it("adds to a query string already in the URL", () => {
        expect(appendQueryString("products/1/availableItems?location.id=2", { max: 5 })).toEqual(
            "products/1/availableItems?location.id=2&max=5"
        );
    });
});
