/* Shapes copied from a real OpenBoxes server (0.9.7-SNAPSHOT); the values are made up. */

export function productBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: "prod-1",
        productCode: "AMOX500",
        name: "Amoxicillin 500mg",
        description: "Capsules",
        category: "Medicines",
        unitOfMeasure: "EA",
        pricePerUnit: null,
        dateCreated: "04/02/2026 10:00:00",
        lastUpdated: "04/02/2026 10:00:00",
        updatedBy: "Admin",
        color: null,
        handlingIcons: [],
        lotAndExpiryControl: true,
        active: true,
        displayNames: { default: null },
        ...overrides,
    };
}

export function availableItemBody(
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        "inventoryItem.id": "inv-1",
        "product.name": "Amoxicillin 500mg",
        product: productBody(),
        productCode: "AMOX500",
        lotNumber: "LOT-1",
        expirationDate: "05/27/2026",
        binLocation: locationBody({ id: "bin-1", name: "Shelf A", locationNumber: "A-01" }),
        zone: null,
        quantityAvailable: 990,
        quantityOnHand: 1000,
        status: "AVAILABLE",
        pickedRequisitionNumbers: "",
        "binLocation.id": "bin-1",
        "binLocation.name": "Shelf A",
        ...overrides,
    };
}

export function locationBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: "loc-1",
        name: "Central depot",
        description: null,
        locationNumber: "CD-01",
        locationGroup: null,
        parentLocation: null,
        locationType: { id: "2", name: "Depot", description: null, locationTypeCode: "DEPOT" },
        sortOrder: 0,
        hasBinLocationSupport: true,
        hasPackingSupport: true,
        hasPartialReceivingSupport: true,
        hasCentralPurchasingEnabled: false,
        organizationName: "Example Health",
        organizationCode: "EXH",
        backgroundColor: "FFFFFF",
        zoneName: null,
        zoneId: null,
        active: true,
        organization: { id: "org-1", name: "Example Health" },
        manager: null,
        address: null,
        supportedActivities: ["MANAGE_INVENTORY"],
        ...overrides,
    };
}

export function stockMovementBody(
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    const locationRef = (id: string, name: string) => ({
        id,
        name,
        locationNumber: null,
        locationType: { id: "2", name: "Depot", description: null, locationTypeCode: "DEPOT" },
        locationGroup: null,
        organizationName: "Example Health",
    });
    return {
        id: "sm-1",
        name: "SM-1.Central depot.District depot",
        description: "Vaccines",
        statusCode: "DISPATCHED",
        displayStatus: { name: "DISPATCHED", label: "Dispatched", variant: "success" },
        identifier: "SM-1",
        origin: locationRef("loc-1", "Central depot"),
        destination: locationRef("loc-2", "District depot"),
        order: null,
        dateRequested: "06/24/2026",
        dateCreated: "06/24/2026",
        dateShipped: "06/24/2026 06:39 Z",
        expectedDeliveryDate: "06/24/2026 00:00 Z",
        lastUpdated: "2026-06-24T06:39:37Z",
        shipmentType: { id: "1", name: "Land", description: null, displayName: "Land" },
        currentStatus: "DISPATCHED",
        shipmentStatus: "SHIPPED",
        trackingNumber: null,
        driverName: null,
        comments: null,
        requestedBy: {
            id: "u1",
            name: "Ana Admin",
            firstName: "Ana",
            lastName: "Admin",
            email: "ana@example.org",
            username: "ana",
            roles: [],
        },
        lineItems: [],
        lineItemCount: 1,
        associations: {
            requisition: null,
            shipment: { id: "sh-1", shipmentNumber: "SM-1", status: "SHIPPED" },
            shipments: [],
            documents: [
                {
                    name: "Export Stock Movement Items",
                    documentType: "EXPORT",
                    contentType: "text/csv",
                    stepNumber: 2,
                    uri: "https://ob.example.org/openboxes/stockMovement/exportCsv/sm-1",
                    hidden: false,
                },
            ],
        },
        isReceived: false,
        isPartiallyReceived: false,
        ...overrides,
    };
}

export function partialReceiptItemBody(
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        receiptItemId: null,
        shipmentItemId: "si-1",
        "container.id": null,
        "container.name": null,
        "parentContainer.id": null,
        "parentContainer.name": null,
        "product.id": "prod-1",
        "product.productCode": "AMOX500",
        "product.name": "Amoxicillin 500mg",
        "product.lotAndExpiryControl": true,
        lotNumber: "LOT-1",
        expirationDate: "05/27/2027",
        "binLocation.id": "bin-1",
        "binLocation.name": "Shelf A",
        "recipient.id": null,
        quantityShipped: 10,
        quantityReceived: 0,
        quantityCanceled: 0,
        quantityReceiving: null,
        quantityRemaining: 10,
        cancelRemaining: false,
        quantityOnHand: 0,
        comment: null,
        unitOfMeasure: null,
        packSize: null,
        packsRequested: 1,
        ...overrides,
    };
}

export function partialReceiptBody(
    overrides: Record<string, unknown> = {}
): Record<string, unknown> {
    return {
        receiptId: null,
        receiptStatus: "PENDING",
        shipmentId: "sh-1",
        "shipment.name": "SM-1",
        "shipment.shipmentNumber": "SM-1",
        shipmentStatus: "SHIPPED",
        "origin.id": "loc-1",
        "origin.name": "Central depot",
        "destination.id": "loc-2",
        "destination.name": "District depot",
        dateShipped: "06/24/2026 06:39 Z",
        dateDelivered: "06/24/2026 06:40 Z",
        containers: [
            {
                "container.id": null,
                "container.name": "Unpacked",
                shipmentItems: [partialReceiptItemBody()],
            },
        ],
        requisition: null,
        description: "Vaccines",
        recipient: null,
        isShipmentFromPurchaseOrder: false,
        ...overrides,
    };
}
