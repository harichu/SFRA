"use strict";

/**
 * @module InventoryCheckService
 *
 * @see {@link https://osfsupport.atlassian.net/wiki/spaces/FIFVC/pages/816120923/Inventory+real+time+checks}
 */

var LocalServiceRegistry = require("dw/svc/LocalServiceRegistry");
var LoggerUtils          = require("*/cartridge/scripts/utils/LoggerUtils");
var Resource             = require("dw/web/Resource");
var serviceRequest       = require("app_storefront_core/cartridge/scripts/util/createOmsServiceRequest");

var SERVICE_NAME = "difarma.oms";

var InventoryService = function () {
    function createRequest(service, params) {
        var url = service.getURL() + "DifarmaInventoryLookupService";
        service.setURL(url);
        service.setRequestMethod("POST");
        var data = serviceRequest.createRequestBody(params, params.isHomeDelivery, null);
        
        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - POST createRequest(service, params);" +
            "method: POST;" +
            "url: " + url + ";" +
            "data: " + data + ";");
        return data;
    }

    function parseResponse(service, response) {
        var result;

        try {
            var responseText = response.text;
            result = JSON.parse(responseText);
        } catch (error) {
            result = {};
            result.serviceOutput = null;
            result.errorMessage  = Resource.msg("generic.error", "service", null) + " : " + error;
        }
    
        return result;
    }

    function mockFull() {
        return {
            "Store" : [{
                "StoreID"        : "mock-store",
                "Distance"       : 10,
                "CurrentDayTime" : "2020-05-16T20:00:00+00:00",
                "NextDayTime"    : "2020-05-15T11:00:00+00:00"
            }]
        };
    }

    function configure() {
        var serviceObj = LocalServiceRegistry.createService(SERVICE_NAME, {
            createRequest : createRequest,
            parseResponse : parseResponse,
            mockFull      : mockFull
        });

        return serviceObj;
    }

    this.post = function (data) {
        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - post(data);" +
            "data: " + data + ";");
        
        var serviceObj = configure();
        return serviceObj.call(data);
    };
};

/**
 * Gets home delivery source store;
 */
module.exports.getHomeDeliverySourceStore = function (lat, lng, distance, lineItemList, isHomeDelivery, city) {
    try {
        var result          = {};
        var requestPayload  = {
            lng            : lng, 
            lat            : lat, 
            distance       : distance,
            lineItemList   : lineItemList,
            isHomeDelivery : isHomeDelivery != null ? isHomeDelivery : true,
            city           : city
        };
        var serviceResponse = new InventoryService().post(requestPayload);

        var isServiceDisabled = !empty(serviceResponse.unavailableReason) && serviceResponse.unavailableReason == "DISABLED";

        if (serviceResponse.object) {
            if (serviceResponse.object.Store && serviceResponse.object.Store.length > 0) {
                result.sourceStore = serviceResponse.object.Store[0];
            } else if (serviceResponse.object.UnavailableLines) {
                result = serviceResponse.object;
            }
        } else if (!isServiceDisabled) {
            var logMessage = [
                "getHomeDeliverySourceStore Error - Request:",
                JSON.stringify(requestPayload),
                "Response:",
                serviceResponse.error,
                serviceResponse.msg,
                serviceResponse.errorMessage
            ].join(" ");
            LoggerUtils.standardError(logMessage);
            var errorMessage = Resource.msg("error.technical", "checkout", null);
            throw new Error(errorMessage);
        }

        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - getHomeDeliverySourceStore(lat, lng, distance, lineItemList);" +
            "result: " + JSON.stringify(result));

        return result;
    } catch (e) {
        LoggerUtils.serviceError("Error on " + SERVICE_NAME + ";" +
            "params: " + lng + ", " + lat + ", " + distance + ", " + lineItemList + ";" +
            "Error: " + e.errorMessage);
        throw e;
    }
};

/**
 * Gets store pickup candidates;
 */
module.exports.getStorePickupCandidates = function (lat, lng, distance, lineItemList, city) {
    try {
        var serviceResponse = new InventoryService().post({
            lng            : lng, 
            lat            : lat,
            distance       : distance, 
            lineItemList   : lineItemList,
            isHomeDelivery : false,
            city           : city
        });

        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - getStorePickupCandidates(lat, lng, distance, lineItemList);" +
            "result: " + JSON.stringify(serviceResponse.object) + ";");

        return serviceResponse;
    } catch (e) {
        LoggerUtils.serviceError("Error on " + SERVICE_NAME + ";" +
            "params: " + lng + ", " + lat + ", " + distance + ", " + lineItemList + ";" +
            "Error: " + e.errorMessage);
    }
};
