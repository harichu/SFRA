"use strict";

/**
 * @module StoreTimeService
 *
 * @see {@link https://osfsupport.atlassian.net/wiki/spaces/FIFVC/pages/816120923/Inventory+real+time+checks}
 */

var LocalServiceRegistry = require("dw/svc/LocalServiceRegistry");
var LoggerUtils          = require("*/cartridge/scripts/utils/LoggerUtils");
var Resource             = require("dw/web/Resource");
var serviceRequest       = require("*/cartridge/scripts/util/createOmsServiceRequest");

var SERVICE_NAME = "difarma.oms";

var StoreTimeService = function () {
    function createRequest(service, params) {
        var url = service.getURL() + "DifarmaCalculateDelPickTime";
        service.setURL(url);
        service.setRequestMethod("POST");
        var data = serviceRequest.createRequestBody(params, false, true);
        
        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - createRequest(service, params);" +
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
                "NextDayTime"    : "XXXXXXXXXXX11XXXXXXXX",
                "CurrentDayTime" : "XXXXXXXXXXX01XXXXXXXX",
                "Distance"       : 10
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
 * Gets store pickup candidates;
 */
module.exports.getStoreTimes = function (params) {

    try {
        var serviceResponse = new StoreTimeService().post(params);

        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - getStoreTimes(params);" +
            "result: " + JSON.stringify(serviceResponse.object) + ";");
        return serviceResponse;
    } catch (e) {
        LoggerUtils.serviceError("Error on " + SERVICE_NAME + ";" +
            "params: " + JSON.stringify(params) + ";" +
            "Error: " + e.errorMessage);
    }
};
