import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, emptyResponse, httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

const categoryBody = (overrides: Record<string, unknown> = {}) => ({
    id: "cat-1",
    description: null,
    name: "Medicines",
    version: 0,
    dateCreated: "24/Jun/2026 06:39 AM",
    lastUpdated: "24/Jun/2026 06:39 AM",
    sortOrder: 0,
    deleted: false,
    isRoot: false,
    categories: [],
    ...overrides,
});

describe("categories.list", () => {
    it("requests all categories and returns their fields", async () => {
        const calls = stubServer(() => jsonResponse({ data: [categoryBody()] }));

        const result = await api().categories.list().getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/categories`,
        ]);
        expect(result.objects).toEqual([
            {
                id: "cat-1",
                name: "Medicines",
                description: undefined,
                sortOrder: 0,
                isRoot: false,
                categories: [],
            },
        ]);
    });

    it("keeps the child categories with the same fields", async () => {
        const children = [
            categoryBody({ id: "cat-2", name: "Antibiotics" }),
            categoryBody({ id: "cat-3", name: "Vaccines", categories: null }),
        ];
        stubServer(() => jsonResponse({ data: [categoryBody({ categories: children })] }));

        const [category] = (await api().categories.list().getData()).objects;

        expect(category?.categories.map(child => [child.id, child.categories])).toEqual([
            ["cat-2", []],
            ["cat-3", []],
        ]);
    });

    it("rejects a child category without a name", async () => {
        stubServer(() =>
            jsonResponse({ data: [categoryBody({ categories: [{ id: "cat-2", name: null }] })] })
        );

        const error = await httpErrorOf(api().categories.list().getData());

        expect(error.message).toMatch(/unexpected response.*name/);
    });
});

describe("categories.get, create, update and delete", () => {
    it("posts a new category and reads the answer without a data envelope", async () => {
        const calls = stubServer(() => jsonResponse(categoryBody({ id: "cat-9", name: "Gloves" })));

        const category = await api()
            .categories.create({ name: "Gloves", parentCategory: { id: "cat-1" } })
            .getData();

        const [create] = requestsAfterLogin(calls());
        expect(create?.url).toEqual(`${API_URL}/categories`);
        expect(create?.init.method).toEqual("POST");
        expect(bodyOf(create)).toEqual({ name: "Gloves", parentCategory: { id: "cat-1" } });
        expect([category.id, category.name]).toEqual(["cat-9", "Gloves"]);
    });

    it("reads a category and sends an update as query parameters, which OpenBoxes binds", async () => {
        const calls = stubServer(call =>
            jsonResponse(categoryBody(call.init.method === "PUT" ? { name: "Medicine" } : {}))
        );

        const read = await api().categories.get("cat-1").getData();
        const updated = await api()
            .categories.update("cat-1", { name: "Medicine", parentCategory: { id: "cat-0" } })
            .getData();

        const [get, put] = requestsAfterLogin(calls());
        expect([get?.init.method, get?.url]).toEqual(["GET", `${API_URL}/categories/cat-1`]);
        expect([put?.init.method, put?.url]).toEqual([
            "PUT",
            `${API_URL}/categories/cat-1?name=Medicine&parentCategory.id=cat-0`,
        ]);
        expect(bodyOf(put)).toBeUndefined();
        expect([read.name, updated.name]).toEqual(["Medicines", "Medicine"]);
    });

    it("deletes a category and resolves with no value", async () => {
        stubServer(() => emptyResponse(204));

        const result = await api().categories.delete("cat-9").getData();

        expect(result).toBeUndefined();
    });
});
