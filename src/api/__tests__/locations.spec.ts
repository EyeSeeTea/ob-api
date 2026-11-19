import { afterEach, describe, expect, it, vi } from "vitest";
import { bodyOf, emptyResponse, httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { locationBody } from "./endpointFixtures";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

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

    it("rejects a location type code that OpenBoxes does not have", async () => {
        stubServer(() =>
            jsonResponse({
                data: [
                    locationBody({
                        locationType: { id: "9", name: "Odd", locationTypeCode: "NOPE" },
                    }),
                ],
            })
        );

        const error = await httpErrorOf(api().locations.list().getData());

        expect(error.message).toContain("locationTypeCode");
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

describe("locations.get, create, update and delete", () => {
    it("reads one location with the fields of the list", async () => {
        const calls = stubServer(() => jsonResponse({ data: locationBody() }));

        const location = await api().locations.get("loc-1").getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/locations/loc-1`,
        ]);
        expect(location.locationType.locationTypeCode).toEqual("DEPOT");
    });

    it("posts a new depot and returns it with its new id", async () => {
        const calls = stubServer(() =>
            jsonResponse({ data: locationBody({ id: "loc-9", name: "District depot" }) })
        );

        const location = await api()
            .locations.create({ name: "District depot", locationType: { id: "lt-depot" } })
            .getData();

        const [create] = requestsAfterLogin(calls());
        expect(create?.url).toEqual(`${API_URL}/locations`);
        expect(create?.init.method).toEqual("POST");
        expect(bodyOf(create)).toEqual({
            name: "District depot",
            locationType: { id: "lt-depot" },
        });
        expect(location.id).toEqual("loc-9");
    });

    it("posts only the given fields of an update", async () => {
        const calls = stubServer(() => jsonResponse({ data: locationBody({ active: false }) }));

        const location = await api().locations.update("loc-1", { active: false }).getData();

        const [update] = requestsAfterLogin(calls());
        expect(update?.url).toEqual(`${API_URL}/locations/loc-1`);
        expect(update?.init.method).toEqual("POST");
        expect(bodyOf(update)).toEqual({ active: false });
        expect(location.active).toBe(false);
    });

    it("deletes a location and resolves with no value", async () => {
        const calls = stubServer(() => emptyResponse(204));

        const result = await api().locations.delete("loc-1").getData();

        expect(requestsAfterLogin(calls()).map(call => call.init.method)).toEqual(["DELETE"]);
        expect(result).toBeUndefined();
    });

    it("rejects with the response when OpenBoxes refuses the delete", async () => {
        const answer = {
            errorMessage: "You cannot delete zone that is assigned to a bin location",
        };
        stubServer(() => jsonResponse(answer, { status: 500 }));

        const error = await httpErrorOf(api().locations.delete("zone-1").getData());

        expect(error.response?.data).toEqual(answer);
    });
});

describe("locations.locationTypes", () => {
    it("requests the location types and gives defaults for absent fields", async () => {
        const calls = stubServer(() =>
            jsonResponse({
                data: [
                    {
                        id: "lt-depot",
                        name: "Depot",
                        description: null,
                        locationTypeCode: "DEPOT",
                        supportedActivities: ["MANAGE_INVENTORY"],
                    },
                    { id: "lt-x", name: "Custom", description: null, locationTypeCode: null },
                ],
            })
        );

        const result = await api().locations.locationTypes().getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/locations/locationTypes`,
        ]);
        expect(result.objects).toEqual([
            {
                id: "lt-depot",
                name: "Depot",
                description: undefined,
                locationTypeCode: "DEPOT",
                supportedActivities: ["MANAGE_INVENTORY"],
            },
            {
                id: "lt-x",
                name: "Custom",
                description: undefined,
                locationTypeCode: undefined,
                supportedActivities: [],
            },
        ]);
    });
});
