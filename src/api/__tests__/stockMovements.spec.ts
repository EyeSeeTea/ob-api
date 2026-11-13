import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE_URL, errorOf, httpErrorOf, jsonResponse, stubFetch } from "../../__tests__/fetchStub";
import { OBApi } from "../OBApi";
import { stockMovementBody } from "./endpointFixtures";
import { API_URL, AUTH, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("stockMovements.list", () => {
    it("sends the filters, with one receiptStatusCode for each status", async () => {
        const calls = stubServer(() => jsonResponse({ data: [], totalCount: 0 }));

        await api()
            .stockMovements.list({
                direction: "INBOUND",
                destination: "1",
                receiptStatusCodes: ["SHIPPED", "PENDING"],
                max: 20,
                offset: 0,
            })
            .getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/stockMovements?direction=INBOUND&destination=1&receiptStatusCode=SHIPPED&receiptStatusCode=PENDING&max=20&offset=0`,
        ]);
    });

    it("returns the movements of the page and the server total", async () => {
        stubServer(() =>
            jsonResponse({
                data: [stockMovementBody(), stockMovementBody({ id: "sm-2" })],
                totalCount: 35,
            })
        );

        const result = await api().stockMovements.list().getData();

        expect(result.total).toEqual(35);
        expect(result.objects.map(movement => movement.id)).toEqual(["sm-1", "sm-2"]);
        expect(result.objects[0]?.shipmentId).toEqual("sh-1");
    });

    it("returns no documents, because OpenBoxes sends none in the list", async () => {
        stubServer(() => jsonResponse({ data: [stockMovementBody()], totalCount: 1 }));

        const result = await api().stockMovements.list().getData();

        expect(result.objects[0]).not.toHaveProperty("documents");
    });
});

describe("stockMovements.get", () => {
    it("requests one movement and maps its fields", async () => {
        const calls = stubServer(() => jsonResponse({ data: stockMovementBody() }));

        const movement = await api().stockMovements.get("sm-1").getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${API_URL}/stockMovements/sm-1`,
        ]);
        expect(movement).toEqual({
            id: "sm-1",
            identifier: "SM-1",
            name: "SM-1.Central depot.District depot",
            description: "Vaccines",
            statusCode: "DISPATCHED",
            shipmentStatus: "SHIPPED",
            shipmentId: "sh-1",
            origin: { id: "loc-1", name: "Central depot", locationNumber: undefined },
            destination: { id: "loc-2", name: "District depot", locationNumber: undefined },
            shipmentType: { id: "1", name: "Land" },
            requestedBy: { id: "u1", name: "Ana Admin" },
            trackingNumber: undefined,
            dateRequested: "06/24/2026",
            dateShipped: "06/24/2026 06:39 Z",
            expectedDeliveryDate: "06/24/2026 00:00 Z",
            lastUpdated: "2026-06-24T06:39:37Z",
            documents: [
                {
                    name: "Export Stock Movement Items",
                    uri: "https://ob.example.org/openboxes/stockMovement/exportCsv/sm-1",
                    documentType: "EXPORT",
                    contentType: "text/csv",
                },
            ],
        });
    });

    it("accepts a status code outside the OpenBoxes list", async () => {
        stubServer(() => jsonResponse({ data: stockMovementBody({ statusCode: "ISSUED" }) }));

        const movement = await api().stockMovements.get("sm-1").getData();

        expect(movement.statusCode).toEqual("ISSUED");
    });

    it("rejects an unknown shipment status", async () => {
        stubServer(() => jsonResponse({ data: stockMovementBody({ shipmentStatus: "LOST" }) }));

        const error = await httpErrorOf(api().stockMovements.get("sm-1").getData());

        expect(error.message).toMatch(/unexpected response.*shipmentStatus/);
    });

    it("gives no documents and no shipment id when the associations are missing", async () => {
        stubServer(() =>
            jsonResponse({ data: stockMovementBody({ associations: { documents: null } }) })
        );

        const movement = await api().stockMovements.get("sm-1").getData();

        expect(movement.documents).toEqual([]);
        expect(movement.shipmentId).toBeUndefined();
    });
});

describe("stockMovements.uploadDocument", () => {
    it("posts the file as fileContents outside the API path", async () => {
        const calls = stubServer(() => new Response("ok"));

        const result = await api()
            .stockMovements.uploadDocument("sm-1", new Blob(["pdf"]), "delivery-note.pdf")
            .getData();

        const [upload] = requestsAfterLogin(calls());
        expect(result).toBeUndefined();
        expect(upload?.url).toEqual(`${BASE_URL}/openboxes/stockMovement/uploadDocument/sm-1`);
        expect(upload?.init.method).toEqual("POST");
        const body = upload?.init.body;
        const file = body instanceof FormData ? body.get("fileContents") : undefined;
        expect(file instanceof File ? file.name : file).toEqual("delivery-note.pdf");
    });

    it("posts under the web app path of a custom apiPath", async () => {
        const calls = stubFetch(() => jsonResponse({}));
        const customApi = new OBApi({ baseUrl: BASE_URL, auth: AUTH, apiPath: "ob/api" });

        await customApi.stockMovements.uploadDocument("sm-1", new Blob(["pdf"]), "a.pdf").getData();

        const [upload] = requestsAfterLogin(calls());
        expect(upload?.url).toEqual(`${BASE_URL}/ob/stockMovement/uploadDocument/sm-1`);
    });
});

describe("stockMovements.downloadDocument", () => {
    it("requests a document on the OpenBoxes server and returns its bytes", async () => {
        const calls = stubServer(
            () => new Response("a,b\n1,2", { headers: { "Content-Type": "text/csv" } })
        );

        const blob = await api()
            .stockMovements.downloadDocument(`${BASE_URL}/openboxes/stockMovement/exportCsv/sm-1`)
            .getData();

        expect(requestsAfterLogin(calls()).map(call => call.url)).toEqual([
            `${BASE_URL}/openboxes/stockMovement/exportCsv/sm-1`,
        ]);
        expect(await blob.text()).toEqual("a,b\n1,2");
    });

    it("rejects a document on another server without a request", async () => {
        const calls = stubServer(() => new Response("x"));

        const error = await errorOf(
            api().stockMovements.downloadDocument("https://other.example.org/file.pdf").getData()
        );

        expect(String(error)).toMatch(/https:\/\/other\.example\.org\/file\.pdf/);
        expect(calls()).toEqual([]);
    });

    it("rejects a URI that only starts with the same host name", async () => {
        const calls = stubServer(() => new Response("x"));

        const error = await errorOf(
            api().stockMovements.downloadDocument(`${BASE_URL}.evil.org/file.pdf`).getData()
        );

        expect(String(error)).toMatch(/not on the OpenBoxes server/);
        expect(calls()).toEqual([]);
    });
});
