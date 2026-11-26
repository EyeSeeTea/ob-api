import { afterEach, describe, expect, it, vi } from "vitest";
import { httpErrorOf, jsonResponse } from "../../__tests__/fetchStub";
import { API_URL, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

const TEST_SERVER_CONTEXT = {
    data: {
        appVersion: "0.9.7-SNAPSHOT",
        buildNumber: "e475522",
        buildDate: null,
        user: { id: "u-1" },
    },
};

describe("appContext.get", () => {
    it("requests the application context and returns only its version fields", async () => {
        const calls = stubServer(() => jsonResponse(TEST_SERVER_CONTEXT));

        const context = await api().appContext.get().getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/getAppContext`,
        ]);
        expect(context).toEqual({
            appVersion: "0.9.7-SNAPSHOT",
            buildNumber: "e475522",
            buildDate: undefined,
        });
    });

    it("rejects with the HTTP error when the session has no location", async () => {
        stubServer(() => jsonResponse({ errorCode: 500 }, { status: 500 }));

        const error = await httpErrorOf(api().appContext.get().getData());

        expect(error.response?.status).toEqual(500);
    });

    it("is a typed endpoint of the request", async () => {
        stubServer(() => jsonResponse(TEST_SERVER_CONTEXT));

        const response = await api().request({ method: "get", path: "/getAppContext" }).getData();

        expect(response.data.appVersion).toEqual("0.9.7-SNAPSHOT");
    });
});
