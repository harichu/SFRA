"use strict";

// SFCC Classes
var LocalServiceRegistry = require("dw/svc/LocalServiceRegistry");
var URLUtils             = require("dw/web/URLUtils");

// Files in this cartridge.
var serviceDefinition    = require("~/cartridge/scripts/services/TransBankServiceDefinition");

var preferences = require("dw/system/Site").getCurrent().getPreferences();
var serviceName = "transbank.webpay.service.plus";

/**
 * Creates the payload for the Transbank Plus initTransaction endpoint.
 * @param {Object} params Plain object with the data required for transaction initialization.
 * @param {String} params.orderNo The order number.
 * @param {Number} params.totalAmount The total amount of the order in the strefront.
 * @return {Object} The payload to send to Transbank to initialize a transaction.
 */
function createPlusData(params) {
    var key         = preferences.custom.tbkWPPCode;
    var orderNumber = encodeURIComponent(params.orderNo);

    return {
        amount             : params.totalAmount,
        buyOrder           : params.orderNo,
        commerceCode       : key,
        finalURL           : URLUtils.http("Transbank-finalURL", "orderNo", orderNumber),
        orderNumber        : params.orderNo,
        returnURL          : URLUtils.http("Transbank-ReturnURL", "orderNo", orderNumber),
        transactionDetails : {
            amount       : params.totalAmount,
            buyOrder     : params.orderNo,
            commerceCode : key
        }
    };
}

/**
 * Initializes a transaction with Transbank via Webpay Plus.
 * @param {Object} params a plain object with data regarding the order.
 * @param {String} params.orderNo The order number.
 * @param {Number} params.totalAmount The total amount of the order in the strefront.
 * @return {string} A URL to redirect the user, so that payment can continue in Transbank's own environment.
 */
function initTransaction(params) {
    var serviceAction   = serviceDefinition.plus.initTransaction;
    var service         = LocalServiceRegistry.createService(serviceName, serviceAction);
    var plusData        = createPlusData(params);
    var serviceResponse = service.call(plusData);

    if (serviceResponse.status !== "OK") {
        throw new Error(serviceResponse.error + " : " + serviceResponse.errorMessage);
    }

    var url = serviceResponse.object.url;
    url    += url.indexOf("?") == -1 ? "?" : "&";
    url    += "token_ws=" + encodeURIComponent(serviceResponse.object.token);
    return url;
}

/**
 * Gets the result of a transaction, with data on how the client paid for the order in Transbank's site.
 * @param {String} token A token received from Transbank during the transaction initialization.
 * @return {Object} The raw web service response.
 */
function getTransactionResult(token) {
    var serviceAction   = serviceDefinition.plus;
    var service         = LocalServiceRegistry.createService(serviceName, serviceAction.getTransactionResult);
    var serviceResponse = service.call({ token : token });

    var result = {
        errorMessage      : serviceResponse.errorMessage,
        status            : serviceResponse.ok,
        transactionResult : serviceResponse.object
    };
    return result;
}

/**
 * Acknowledges the result of a transaction, which finalizes the process with Transbank.
 * @param {String} token A token received from Transbank during the transaction initialization.
 * @return {Object} The raw web service response. This method is used just for acknowledgment and has no meaningful return by itself. This object is used just to check for the HTTP response (i.e.: 200 OK).
 */
function acknowledgeTransaction(token) {
    var serviceAction   = serviceDefinition.plus;
    var service         = LocalServiceRegistry.createService(serviceName, serviceAction.acknowledgeTransaction);
    var serviceResponse = service.call({ token : token });

    var result = {
        errorMessage      : serviceResponse.errorMessage,
        status            : serviceResponse.ok,
        transactionResult : serviceResponse.object
    };
    return result;
}

module.exports = {
    acknowledgeTransaction : acknowledgeTransaction,
    getTransactionResult   : getTransactionResult,
    initTransaction        : initTransaction
};
