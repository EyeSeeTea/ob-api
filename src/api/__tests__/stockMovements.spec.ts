import { afterEach, describe, expect, it, vi } from "vitest";
import {
    BASE_URL,
    bodyOf,
    emptyResponse,
    errorOf,
    httpErrorOf,
    jsonResponse,
    stubFetch,
} from "../../__tests__/fetchStub";
import { OBApi } from "../OBApi";
import { stockMovementBody } from "./endpointFixtures";
import { API_URL, AUTH, requestsAfterLogin, stubServer, testApi as api } from "./endpointServer";

const INBOUND_TO_DEPOT = { direction: "INBOUND", destination: "1" } as const;

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
                receiptStatusCode: ["SHIPPED", "PENDING"],
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

        const result = await api().stockMovements.list(INBOUND_TO_DEPOT).getData();

        expect(result.total).toEqual(35);
        expect(result.objects.map(movement => movement.id)).toEqual(["sm-1", "sm-2"]);
        expect(result.objects[0]?.associations).toEqual({ shipment: { id: "sh-1" } });
    });

    it("returns no documents, because OpenBoxes sends none in the list", async () => {
        stubServer(() => jsonResponse({ data: [stockMovementBody()], totalCount: 1 }));

        const result = await api().stockMovements.list(INBOUND_TO_DEPOT).getData();

        expect(result.objects[0]?.associations).not.toHaveProperty("documents");
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
            origin: { id: "loc-1", name: "Central depot", locationNumber: undefined },
            destination: { id: "loc-2", name: "District depot", locationNumber: undefined },
            shipmentType: { id: "1", name: "Land" },
            requestedBy: { id: "u1", name: "Ana Admin" },
            trackingNumber: undefined,
            dateRequested: "06/24/2026",
            dateShipped: "06/24/2026 06:39 Z",
            expectedDeliveryDate: "06/24/2026 00:00 Z",
            lastUpdated: "2026-06-24T06:39:37Z",
            associations: {
                shipment: { id: "sh-1" },
                documents: [
                    {
                        name: "Export Stock Movement Items",
                        uri: "https://ob.example.org/openboxes/stockMovement/exportCsv/sm-1",
                        documentType: "EXPORT",
                        contentType: "text/csv",
                    },
                ],
            },
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

    it("gives empty documents and no shipment when the associations have none", async () => {
        stubServer(() =>
            jsonResponse({ data: stockMovementBody({ associations: { documents: null } }) })
        );

        const movement = await api().stockMovements.get("sm-1").getData();

        expect(movement.associations).toEqual({ shipment: undefined, documents: [] });
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

describe("stockMovements.create and updateItems", () => {
    it("posts a new movement with dateRequested as MM/dd/yyyy and returns it", async () => {
        const calls = stubServer(() =>
            jsonResponse({ data: stockMovementBody({ id: "sm-9" }) }, { status: 201 })
        );

        const movement = await api()
            .stockMovements.create({
                origin: { id: "sup-1" },
                destination: { id: "loc-2" },
                requestedBy: { id: "u1" },
                dateRequested: new Date("2026-06-24T10:00:00Z"),
                description: "Vaccines",
            })
            .getData();

        const [create] = requestsAfterLogin(calls());
        expect(create?.url).toEqual(`${API_URL}/stockMovements`);
        expect(create?.init.method).toEqual("POST");
        expect(bodyOf(create)).toEqual({
            origin: { id: "sup-1" },
            destination: { id: "loc-2" },
            requestedBy: { id: "u1" },
            dateRequested: "06/24/2026",
            description: "Vaccines",
        });
        expect(movement.id).toEqual("sm-9");
    });

    it("gives no shipment for a new movement, whose shipment id is null", async () => {
        const body = stockMovementBody({
            associations: { shipment: { id: null, shipmentNumber: null }, documents: null },
        });
        stubServer(() => jsonResponse({ data: body }, { status: 201 }));

        const movement = await api()
            .stockMovements.create({
                origin: { id: "sup-1" },
                destination: { id: "loc-2" },
                requestedBy: { id: "u1" },
                dateRequested: new Date("2026-06-24T10:00:00Z"),
            })
            .getData();

        expect(movement.associations).toEqual({ shipment: undefined, documents: [] });
    });

    it("posts the line items with the movement id", async () => {
        const calls = stubServer(() => jsonResponse({ data: stockMovementBody() }));
        const lineItems = [
            { product: { id: "p1" }, quantityRequested: 10, lotNumber: "LOT-1", sortOrder: 100 },
            { product: { id: "p2" }, quantityRequested: 5, sortOrder: 200 },
        ];

        await api().stockMovements.updateItems("sm-1", { lineItems }).getData();

        const [update] = requestsAfterLogin(calls());
        expect(update?.url).toEqual(`${API_URL}/stockMovements/sm-1/updateItems`);
        expect(bodyOf(update)).toEqual({ id: "sm-1", lineItems });
    });
});

describe("stockMovements.updateRequisition and updateShipment", () => {
    it("returns the movement that OpenBoxes answers after the requisition update", async () => {
        const calls = stubServer(() => jsonResponse({ data: stockMovementBody({ id: "sm-1" }) }));

        const movement = await api()
            .stockMovements.updateRequisition("sm-1", { description: "Vaccines (urgent)" })
            .getData();

        const [update] = requestsAfterLogin(calls());
        expect(update?.url).toEqual(`${API_URL}/stockMovements/sm-1/updateRequisition`);
        expect(bodyOf(update)).toEqual({ description: "Vaccines (urgent)" });
        expect(movement.id).toEqual("sm-1");
    });

    it("sends dateShipped in UTC as MM/dd/yyyy HH:mm Z and resolves with no value", async () => {
        const calls = stubServer(() => emptyResponse());

        const result = await api()
            .stockMovements.updateShipment("sm-1", {
                shipmentType: { id: "1" },
                dateShipped: new Date("2026-06-24T06:39:00Z"),
            })
            .getData();

        const [update] = requestsAfterLogin(calls());
        expect(update?.url).toEqual(`${API_URL}/stockMovements/sm-1/updateShipment`);
        expect(bodyOf(update)).toEqual({
            shipmentType: { id: "1" },
            dateShipped: "06/24/2026 06:39 Z",
        });
        expect(result).toBeUndefined();
    });

    it("rejects a JSON answer where OpenBoxes sends no body", async () => {
        stubServer(() => jsonResponse({ data: {} }));

        const error = await httpErrorOf(
            api().stockMovements.updateShipment("sm-1", { trackingNumber: "T1" }).getData()
        );

        expect(error.message).toMatch(
            /^POST \/stockMovements\/sm-1\/updateShipment returned an unexpected response/
        );
    });
});

describe("stockMovements status, picklist and delete", () => {
    it("posts the status", async () => {
        const calls = stubServer(() => emptyResponse());

        await api().stockMovements.updateStatus("sm-1", { status: "DISPATCHED" }).getData();

        const [update] = requestsAfterLogin(calls());
        expect(update?.url).toEqual(`${API_URL}/stockMovements/sm-1/status`);
        expect(update?.init.method).toEqual("POST");
        expect(bodyOf(update)).toEqual({ status: "DISPATCHED" });
    });

    it("creates and validates the picklist with GET, as OpenBoxes maps them", async () => {
        const calls = stubServer(() => emptyResponse());

        await api().stockMovements.createPicklist("sm-1").getData();
        await api().stockMovements.validatePicklist("sm-1").getData();

        expect(requestsAfterLogin(calls()).map(call => [call.init.method, call.url])).toEqual([
            ["GET", `${API_URL}/stockMovements/createPickList/sm-1`],
            ["GET", `${API_URL}/stockMovements/sm-1/validatePicklist`],
        ]);
    });

    it("deletes the movement and resolves with no value on 204", async () => {
        const calls = stubServer(() => emptyResponse(204));

        const result = await api().stockMovements.delete("sm-1").getData();

        const [deletion] = requestsAfterLogin(calls());
        expect(deletion?.init.method).toEqual("DELETE");
        expect(deletion?.url).toEqual(`${API_URL}/stockMovements/sm-1`);
        expect(result).toBeUndefined();
    });

    it("rejects with the response when the movement does not exist", async () => {
        const answer = { errorMessage: "Stockmovement with id sm-0 does not exist" };
        stubServer(() => jsonResponse(answer, { status: 404 }));

        const error = await httpErrorOf(api().stockMovements.delete("sm-0").getData());

        expect(error.response?.status).toEqual(404);
        expect(error.response?.data).toEqual(answer);
    });
});
