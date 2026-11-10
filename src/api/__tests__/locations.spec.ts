import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse } from "../../__tests__/fetchStub";
import { locationBody } from "./endpointFixtures";
import { API_URL, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("locations.list", () => {
    it("requests all locations and returns one object for each", async () => {
        const calls = stubServer(() =>
            jsonResponse({ data: [locationBody(), locationBody({ id: "loc-2" })] })
        );

        const result = await api().locations.list().getData();

        expect(calls().map(call => call.url)).toEqual([`${API_URL}/login`, `${API_URL}/locations`]);
        expect(result.objects.map(location => location.id)).toEqual(["loc-1", "loc-2"]);
        expect(result.objects[0]).toEqual({
            id: "loc-1",
            name: "Central depot",
            active: true,
            locationNumber: "CD-01",
            locationType: { id: "2", name: "Depot", locationTypeCode: "DEPOT" },
            parentLocation: undefined,
        });
    });

    it("filters by location type", async () => {
        const calls = stubServer(() => jsonResponse({ data: [] }));

        await api().locations.list({ locationTypeCode: "DEPOT" }).getData();

        expect(calls()[1]?.url).toEqual(`${API_URL}/locations?locationTypeCode=DEPOT`);
    });

    it("gives undefined for a null location number and keeps a parent location", async () => {
        stubServer(() =>
            jsonResponse({
                data: [
                    locationBody({
                        locationNumber: null,
                        parentLocation: locationBody({ id: "parent-1", name: "Region" }),
                    }),
                ],
            })
        );

        const [location] = (await api().locations.list().getData()).objects;

        expect(location?.locationNumber).toBeUndefined();
        expect(location?.parentLocation).toEqual({ id: "parent-1", name: "Region" });
    });
});
