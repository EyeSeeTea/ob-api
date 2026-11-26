import { afterEach, describe, expect, it, vi } from "vitest";
import { errorOf, jsonResponse } from "../../__tests__/fetchStub";
import { isCancel } from "../../repositories/CancelableResponse";
import { HttpError } from "../../repositories/HttpClientRepository";
import { flushPromises } from "./fakeResponse";
import { stubServer } from "../../api/__tests__/endpointServer";
import { partialReceiptBody, partialReceiptItemBody } from "../../api/__tests__/endpointFixtures";
import { APP_CONTEXT, emptyOk, sentRoutes, stubRoutes, testSdk } from "./sdkServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("new OBSdk", () => {
    it("sends no request", () => {
        const calls = stubServer(() => jsonResponse({}));

        testSdk();

        expect(calls()).toEqual([]);
    });

    it("makes no unhandled rejection for a version without numbers that is never read", async () => {
        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown) => unhandled.push(reason);
        process.on("unhandledRejection", onUnhandled);

        testSdk({ version: "latest" });
        await new Promise(resolve => setTimeout(resolve, 0));
        process.off("unhandledRejection", onUnhandled);

        expect(unhandled).toEqual([]);
    });

    it.each([
        [{ retry: { attempts: 0 } }, "retry.attempts"],
        [{ retry: { attempts: Number.NaN } }, "retry.attempts"],
        [{ retry: { attempts: 1, delayMs: -1 } }, "retry.delayMs"],
        [{ concurrency: 0 }, "concurrency"],
        [{ concurrency: Number.NaN }, "concurrency"],
    ])("rejects the options %o, and names %s", (options, name) => {
        expect(() => testSdk(options)).toThrow(name);
    });
});

describe("serverVersion", () => {
    it("reads the version from getAppContext", async () => {
        const calls = stubRoutes({ "GET /getAppContext": () => jsonResponse(APP_CONTEXT) });

        const version = await testSdk().serverVersion().getData();

        expect(version).toEqual({ appVersion: "0.9.7-SNAPSHOT", major: 0, minor: 9, patch: 7 });
        expect(sentRoutes(calls())).toEqual(["GET /getAppContext"]);
    });

    it("uses the version of the caller and sends no request", async () => {
        const calls = stubServer(() => jsonResponse(APP_CONTEXT));

        const version = await testSdk({ version: "0.8.22" }).serverVersion().getData();

        expect(version).toMatchObject({ major: 0, minor: 8, patch: 22 });
        expect(calls()).toEqual([]);
    });

    it("rejects a version of the caller without numbers", async () => {
        stubServer(() => jsonResponse(APP_CONTEXT));

        const error = await errorOf(testSdk({ version: "latest" }).serverVersion().getData());

        expect(String(error)).toContain('"latest"');
    });

    it("sends 1 request for calls at the same time, and none for later calls", async () => {
        const calls = stubRoutes({ "GET /getAppContext": () => jsonResponse(APP_CONTEXT) });
        const sdk = testSdk();

        const [first, second] = await Promise.all([
            sdk.serverVersion().getData(),
            sdk.serverVersion().getData(),
        ]);
        const later = await sdk.serverVersion({ locationId: "loc-2" }).getData();

        expect(first).toEqual(second);
        expect(later).toEqual(first);
        expect(sentRoutes(calls())).toEqual(["GET /getAppContext"]);
    });

    it("sends no request before getData", () => {
        const calls = stubRoutes({ "GET /getAppContext": () => jsonResponse(APP_CONTEXT) });

        testSdk().serverVersion();

        expect(calls()).toEqual([]);
    });

    it("stops only the wait of the caller that cancels, and keeps the read for the others", async () => {
        const answer: { send?: () => void } = {};
        const calls = stubRoutes({
            "GET /getAppContext": () =>
                new Promise<Response>(resolve => {
                    answer.send = () => resolve(jsonResponse(APP_CONTEXT));
                }),
        });
        const sdk = testSdk();
        const canceled = sdk.serverVersion();
        const canceledData = canceled.getData();
        const other = sdk.serverVersion().getData();

        await flushPromises();
        canceled.cancel();
        answer.send?.();

        expect(isCancel(await errorOf(canceledData))).toBe(true);
        expect(await other).toMatchObject({ major: 0, minor: 9, patch: 7 });
        expect(sentRoutes(calls())).toEqual(["GET /getAppContext"]);
    });

    it("chooses the location before the read when a locationId is given", async () => {
        const calls = stubRoutes({
            "GET /chooseLocation/loc-2": emptyOk,
            "GET /getAppContext": () => jsonResponse(APP_CONTEXT),
        });

        await testSdk().serverVersion({ locationId: "loc-2" }).getData();

        expect(sentRoutes(calls())).toEqual(["GET /chooseLocation/loc-2", "GET /getAppContext"]);
    });

    it("explains a 500, keeps the HTTP error, and reads again on the next call", async () => {
        const calls = stubRoutes({
            "GET /getAppContext": () => jsonResponse({ errorCode: 500 }, { status: 500 }),
        });
        const sdk = testSdk();

        const error = await errorOf(sdk.serverVersion().getData());
        await errorOf(sdk.serverVersion().getData());

        expect(error).toBeInstanceOf(Error);
        expect(String(error)).toContain("session without a location");
        expect(error instanceof Error && error.cause instanceof HttpError).toBe(true);
        expect(sentRoutes(calls())).toEqual(["GET /getAppContext", "GET /getAppContext"]);
    });

    it("reads again with the location of a caller when the shared read without a location fails", async () => {
        const answers = [
            jsonResponse({ errorCode: 500 }, { status: 500 }),
            jsonResponse(APP_CONTEXT),
        ];
        const calls = stubRoutes({
            "GET /chooseLocation/loc-2": emptyOk,
            "GET /getAppContext": () => answers.shift() ?? jsonResponse(APP_CONTEXT),
        });
        const sdk = testSdk();

        const [withoutLocation, withLocation] = await Promise.allSettled([
            sdk.serverVersion().getData(),
            sdk.serverVersion({ locationId: "loc-2" }).getData(),
        ]);

        expect(withoutLocation.status).toBe("rejected");
        expect(withLocation).toEqual({
            status: "fulfilled",
            value: { appVersion: "0.9.7-SNAPSHOT", major: 0, minor: 9, patch: 7 },
        });
        expect(sentRoutes(calls())).toEqual([
            "GET /getAppContext",
            "GET /chooseLocation/loc-2",
            "GET /getAppContext",
        ]);
    });

    it("rejects an appVersion without numbers, and names it", async () => {
        stubRoutes({ "GET /getAppContext": () => jsonResponse({ data: { appVersion: "dev" } }) });

        const error = await errorOf(testSdk().serverVersion().getData());

        expect(String(error)).toContain('"dev"');
    });
});

describe("capabilities", () => {
    it("has no capability yet", async () => {
        const calls = stubServer(() => jsonResponse(APP_CONTEXT));

        expect(await testSdk({ version: "0.9.7" }).capabilities().getData()).toEqual({});
        expect(calls()).toEqual([]);
    });
});

const PENDING_RECEIPT = partialReceiptBody({
    receiptId: "r-1",
    containers: [
        {
            "container.id": null,
            shipmentItems: [partialReceiptItemBody({ receiptItemId: "ri-1" })],
        },
    ],
});

describe("workflows without version mappers", () => {
    it("send no getAppContext request", async () => {
        const calls = stubRoutes({
            "GET /stockMovements": () => jsonResponse({ data: [], totalCount: 0 }),
            "GET /chooseLocation/loc-2": emptyOk,
            "GET /partialReceiving/sh-1": () => jsonResponse({ data: partialReceiptBody() }),
            "POST /partialReceiving/sh-1": () => jsonResponse({ data: PENDING_RECEIPT }),
        });
        const sdk = testSdk();

        await sdk.stockMovements
            .listWithDocuments({ direction: "INBOUND", destination: "loc-2" })
            .getData();
        await sdk.shipments
            .receive({
                shipmentId: "sh-1",
                locationId: "loc-2",
                dateDelivered: new Date("2026-06-24T06:40:00Z"),
                items: [{ shipmentItemId: "si-1", quantityReceiving: 5 }],
            })
            .getData();

        expect(sentRoutes(calls())).not.toContain("GET /getAppContext");
    });
});
