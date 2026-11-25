import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchCall, httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { API_URL, stubServer } from "../../api/__tests__/endpointServer";
import { stockMovementBody } from "../../api/__tests__/endpointFixtures";
import { routeKey, sentRoutes, testSdk } from "./sdkServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

const PARAMS = { direction: "INBOUND", destination: "loc-2" } as const;

const movementIds = (count: number) => Array.from({ length: count }, (_, i) => `sm-${i + 1}`);

/* The list has no documents; the detail of each movement has them. */
const listBody = (ids: ReadonlyArray<string>, total = ids.length) => ({
    data: ids.map(id => stockMovementBody({ id, associations: null })),
    totalCount: total,
});

const detailBody = (id: string) => ({ data: stockMovementBody({ id }) });

const detailId = (call: FetchCall) => call.url.slice(`${API_URL}/stockMovements/`.length);

const isList = (call: FetchCall) => routeKey(call) === "GET /stockMovements";

describe("sdk.stockMovements.listWithDocuments", () => {
    it("reads each movement of the page, in the list order, with the total of the list", async () => {
        const ids = movementIds(3);
        const calls = stubServer(call =>
            isList(call)
                ? jsonResponse(listBody(ids, 12))
                : jsonResponse(detailBody(detailId(call)))
        );

        const result = await testSdk().stockMovements.listWithDocuments(PARAMS).getData();

        expect(result.total).toEqual(12);
        expect(result.objects.map(movement => movement.id)).toEqual(ids);
        expect(result.objects.map(movement => movement.associations.documents.length)).toEqual([
            1, 1, 1,
        ]);
        expect(calls()[1]?.url).toEqual(
            `${API_URL}/stockMovements?direction=INBOUND&destination=loc-2`
        );
    });

    it("has at most 4 reads in progress at the same time", async () => {
        const ids = movementIds(10);
        const inProgress = { now: 0, max: 0 };
        stubServer(async call => {
            if (isList(call)) return jsonResponse(listBody(ids));
            inProgress.now += 1;
            inProgress.max = Math.max(inProgress.max, inProgress.now);
            await new Promise(resolve => setTimeout(resolve, 5));
            inProgress.now -= 1;
            return jsonResponse(detailBody(detailId(call)));
        });

        const result = await testSdk().stockMovements.listWithDocuments(PARAMS).getData();

        expect(result.objects).toHaveLength(10);
        expect(inProgress.max).toEqual(4);
    });

    it("sends no read for an empty page", async () => {
        const calls = stubServer(() => jsonResponse(listBody([], 0)));

        const result = await testSdk().stockMovements.listWithDocuments(PARAMS).getData();

        expect(result).toEqual({ objects: [], total: 0 });
        expect(sentRoutes(calls().filter(call => !call.url.endsWith("/login")))).toEqual([
            "GET /stockMovements",
        ]);
    });

    it("rejects with the error of a failed read and starts no new read", async () => {
        const ids = movementIds(4);
        const calls = stubServer(call => {
            if (isList(call)) return jsonResponse(listBody(ids));
            return detailId(call) === "sm-2"
                ? jsonResponse({ errorMessage: "Not found" }, { status: 404 })
                : jsonResponse(detailBody(detailId(call)));
        });

        const error = await httpErrorOf(
            testSdk({ concurrency: 1 }).stockMovements.listWithDocuments(PARAMS).getData()
        );

        expect(error.response?.status).toEqual(404);
        expect(calls().filter(call => !isList(call) && !call.url.endsWith("/login"))).toHaveLength(
            2
        );
    });
});
