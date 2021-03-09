"use strict";

var LocalServiceRegistry  = require("dw/svc/LocalServiceRegistry");
var Site                  = require("dw/system/Site");
var LoggerUtils           = require("*/cartridge/scripts/utils/LoggerUtils");
var LoyaltyServiceHelpers = require("*/cartridge/scripts/helpers/loyaltyServiceHelpers");

var preferences  = Site.getCurrent().getPreferences().getCustom();
var SERVICE_NAME = preferences.loyaltyServiceName;

var LoyaltyService = function () {
    this.get = function (data) {
        var serviceObj = LocalServiceRegistry.createService(SERVICE_NAME, {
            createRequest : function (service, params) {
                var url = service.getURL() + params.customerID;
                service.setURL(url);
                service.setRequestMethod("GET");
                LoyaltyServiceHelpers.setHeaders(service);
                LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - createRequest(service, params);" +
                    "method: GET;" +
                    "url: " + url + ";");
            },
            parseResponse : LoyaltyServiceHelpers.parseResponse,
            mockFull      : LoyaltyServiceHelpers.mockFull
        });

        return serviceObj.call(data);
    };

    this.post = function (data) {
        var serviceObj = LocalServiceRegistry.createService(SERVICE_NAME, {
            createRequest : function (service, params) {
                var url = service.getURL() + params.customerID;
                service.setURL(url);
                service.setRequestMethod("POST");
                LoyaltyServiceHelpers.setHeaders(service);
                LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - createRequest(service, params);" +
                    "method: POST;" +
                    "url: " + url + ";");
                return JSON.stringify(params.payload);
            },
            parseResponse : LoyaltyServiceHelpers.parseResponse
        });

        return serviceObj.call(data);
    };

    this.put = function (data) {
        var serviceObj = LocalServiceRegistry.createService(SERVICE_NAME, {
            createRequest : function (service, params) {
                var url = service.getURL() + params.customerID;
                service.setURL(url);
                service.setRequestMethod("PUT");
                LoyaltyServiceHelpers.setHeaders(service);
                LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - createRequest(service, params);" +
                    "method: PUT;" +
                    "url: " + url + ";");
                return JSON.stringify(params.payload);
            },
            parseResponse : LoyaltyServiceHelpers.parseResponse
        });

        return serviceObj.call(data);
    };
};

/**
 * Retrieves a customer given its Identification number
 * @param {String} customerID the Identification number for the customer
 */ 
module.exports.getCustomer = function (customerID) {
    try {
        var formattedCustomerID = customerID.replace(/\./g, "");

        var serviceResponse = new LoyaltyService().get({
            customerID : formattedCustomerID
        });

        var isSuccessful = serviceResponse.ok;

        if (!isSuccessful) {
            throw serviceResponse.errorMessage;
        }

        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - getCustomer(customerID);" +
            "customerID: " + formattedCustomerID + ";" +
            "result: " + JSON.stringify(serviceResponse.object));

        return serviceResponse.object;
    } catch (e) {
        LoggerUtils.serviceError("Error on " + SERVICE_NAME + "; Could not retreive Loyalty customer." +
            "params: " + customerID + ";" +
            "Error: " + e.errorMessage);
    }
};

/**
 * Makes a POST request to loyalty API with the customer object to added and return its value
 * @param {Object} customer the customer object to be created
 */
module.exports.createCustomer = function (customerID, customer) {
    try {
        var formattedCustomerID = customerID.replace(/\./g, "");
        
        var serviceResponse = new LoyaltyService().post({
            customerID : formattedCustomerID,
            payload    : customer
        });

        var isSuccessful = serviceResponse.ok;

        if (!isSuccessful) {
            throw serviceResponse.errorMessage;
        }

        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - createCustomer(customerID, customer);" +
            "customerID: " + formattedCustomerID + ";" +
            "customer:" + JSON.stringify(customer) +
            "result: isSuccessful: " + serviceResponse.ok);

        return true;
    } catch (e) {
        LoggerUtils.serviceError("Error on " + SERVICE_NAME + "; Could not create Loyalty customer." +
            "params: customerID: " + customerID + ", customer:" + JSON.stringify(customer) + ";" +
            "Error: " + e.errorMessage);
    }
};

/**
 * Makes a PUT request and updates a customer in the loyalty API
 * @param {Object} customer the customer object containing the Identificationnumber of the customer you want to update, along with the modified data
 */
module.exports.updateCustomer = function (customerID, customer) {
    try {
        var formattedCustomerID = customerID.replace(/\./g, "");
        
        var serviceResponse = new LoyaltyService().put({
            customerID : formattedCustomerID,
            payload    : customer
        });

        var isSuccessful = serviceResponse.ok;

        if (!isSuccessful) {
            throw serviceResponse.errorMessage;
        }

        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - updateCustomer(customerID, customer);" +
            "customerID: " + formattedCustomerID + ";" +
            "customer:" + JSON.stringify(customer) +
            "result: isSuccessful: " + serviceResponse.ok);

        return true;
    } catch (e) {
        LoggerUtils.serviceError("Error on " + SERVICE_NAME + "; Could not update Loyalty customer." +
            "params: customerID: " + customerID + ", customer:" + JSON.stringify(customer) + ";" +
            "Error: " + e.errorMessage);
    }
};
