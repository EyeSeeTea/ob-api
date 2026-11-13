import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, jsonResponse } from "../../__tests__/fetchStub";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("people.search", () => {
    it("posts an ilike email search and returns the people", async () => {
        const calls = stubServer(() =>
            jsonResponse({
                data: [
                    {
                        id: "u1",
                        name: "Nina Nurse",
                        firstName: "Nina",
                        lastName: "Nurse",
                        email: "nurse@example.org",
                        username: "nina",
                        roles: [],
                    },
                ],
            })
        );

        const result = await api().people.search({ email: "nurse@example.org" }).getData();

        const [search] = requestsAfterLogin(calls());
        expect(search?.url).toEqual(`${API_URL}/generic/person/search`);
        expect(search?.init.method).toEqual("POST");
        expect(bodyOf(search)).toEqual({
            searchAttributes: [
                { property: "email", operator: "ilike", value: "nurse@example.org" },
            ],
        });
        expect(result).toEqual({
            objects: [{ id: "u1", name: "Nina Nurse", email: "nurse@example.org" }],
        });
    });

    it("returns no people when nothing matches", async () => {
        stubServer(() => jsonResponse({ data: [] }));

        const result = await api().people.search({ email: "nobody@example.org" }).getData();

        expect(result).toEqual({ objects: [] });
    });
});
