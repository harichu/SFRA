"use strict";

var Site = require("dw/system/Site");

var currentSite = Site.current;

/**
 * Creates the request body of current web service.
 * 
 * @param {Object} params A plain object with the parameters to use.
 * @return {Object} The request body for the web service, as an object.
 */
function createServiceRequest(params, isShip, isStoreTime) {
    var serviceRequest =  {};
    var promiseLine = [];
    var productLineItemList = params.lineItemList;

    if (!empty(productLineItemList)) {
        for (var i = 0; i < productLineItemList.length; i++) {
            var lineItem = productLineItemList[i];

            promiseLine.push({
                "DeliveryMethod"       : isShip ? "SHP" : "PICK",
                "IsProcurementAllowed" : "Y",
                "LineId"               : i + 1,
                "UnitOfMeasure"        : "EACH",
                "RequiredQty"          : lineItem.quantityValue,
                "ProductClass"         : "REGULAR",
                "ItemID"               : lineItem.product.ID
            });
        }
    }

    serviceRequest.Promise = {
        "ShipToAddress"         : {
            "Latitude"  : params.lat,
            "Longitude" : params.lng
        },
        "DeliveryMethod"        : isShip ? "SHP" : "PICK",
        "CheckInventory"        : "Y",
        "DistanceUOMToConsider" : "KM",
        "OrganizationCode"      : currentSite.getCustomPreferenceValue("organizationCode"),
        "MaximumRecords"        : "10",
        "DistanceToConsider"    : params.distance,
        "PromiseLines"          : {
            "PromiseLine" : promiseLine
        },
        "EnterpriseCode"        : currentSite.getCustomPreferenceValue("organizationCode"),
        "IsNightFulfillment"    : "N",
        "CheckCapacity"         : isShip ? "N" : "Y"
    };

    if (currentSite.getCustomPreferenceValue("omsSendCityValue") && !empty(params.city)) {
        serviceRequest.Promise["ShipToAddress"]["City"] = params.city;
    }

    if (isStoreTime) {
        serviceRequest.Promise["ShipNode"] = params.storeID;
    }

    return JSON.stringify(serviceRequest);
}

module.exports = {
    createRequestBody : createServiceRequest
};
