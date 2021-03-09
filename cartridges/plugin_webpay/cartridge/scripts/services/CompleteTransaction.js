"use strict";

// API includes
var Constants            = require("~/cartridge/scripts/Constants");
var LocalServiceRegistry = require("dw/svc/LocalServiceRegistry");
var Order                = require("dw/order/Order");
var Transaction          = require("dw/system/Transaction");

var preferences       = require("dw/system/Site").getCurrent().getPreferences();
var serviceDefinition = require("~/cartridge/scripts/services/TransBankServiceDefinition").full;
var serviceName       = "transbank.webpay.service.full";

/**
 * Acknowledges the result of a transaction, causing it to be committed in Transbank's environment.
 * @param {String} token A token received from Transbank during the complete transaction initialization.
 * @param {Object} [dataToPersist] An order and an authorization result. If passed, the custom attributes of the order will be filled in.
 * @param {dw.order.Order} dataToPersist.order The order in which to persist some custom attributes.
 * @param {Object} dataToPersist.authorizationResponse The return of a call to the authorize method.
 */
function acknowledgeCompleteTransaction(token, dataToPersist) {
    var service = LocalServiceRegistry.createService(serviceName, serviceDefinition.acknowledgeCompleteTransaction);
    var payload = { token : token };

    var serviceResponse = service.call(payload);

    if (serviceResponse.status !== "OK") {
        throw new Error(serviceResponse.error + " : " + serviceResponse.errorMessage);
    }

    if (!empty(dataToPersist) && !empty(dataToPersist.order) && !empty(dataToPersist.authorizationResponse)) {
        var order = dataToPersist.order;
        var auth  = dataToPersist.authorizationResponse;

        Transaction.wrap(function () {
            order.custom.tbkAuthorizationCode      = auth.authorizationCode;
            order.custom.tbkAuthorizationResult    = auth.authorizationResult;
            order.custom.tbkPaymentType            = auth.paymentType;
            order.custom.tbkQuantityOfInstallments = auth.sharesNumber;
            order.custom.tbkResponseCode           = auth.responseCode;
            order.custom.tbkToken                  = auth.token;
            order.custom.tbkTotal                  = auth.total;

            order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
        });
    }
}

/**
 * Initializes a complete transaction with Transbank via Webpay Plus.
 * @param {Object} params a plain object with data regarding the order.
 * @param {Object} params.cardDetail An object containing CC data.
 * @param {Object} params.cardDetail.cardNumber The CC PAN.
 * @param {Object} params.cardDetail.cardExpirationDate The CC expiration date in the "YY/MM" format.
 * @param {Object} params.cardDetail.cvv The CC CVV.
 * @param {String} params.orderNo The order number.
 * @param {Number} params.totalAmount The total amount of the order in the strefront.
 * @return {string} A token to continue the next steps of the transaction.
 */
function initCompleteTransaction(params) {
    var service = LocalServiceRegistry.createService(serviceName, serviceDefinition.initCompleteTransaction);
    var payload = {
        buyOrder           : params.orderNo,
        cardDetail         : params.cardDetail,
        transactionDetails : {
            amount       : params.itemAmount,
            buyOrder     : params.orderNo,
            commerceCode : preferences.custom.tbkCompleteTransactionCode
        }
    };

    var serviceResponse = service.call(payload);
    if (serviceResponse.status !== "OK") {
        throw new Error(serviceResponse.error + " : " + serviceResponse.errorMessage);
    }

    return serviceResponse.object.token;
}

/**
 * Attempts to authorize the payment with Transbank.
 * @param {String} token A token received from Transbank during the complete transaction initialization.
 * @param {dw.order.Order} order The order for which to authorize the payment.
 * @param {Number} [queryShareId] The ID of a queryShare response, representing an installment simulation.
 * @return {Object} An object with details about the authorization.
 */
function authorize(token, order, queryShareId) {
    var service = LocalServiceRegistry.createService(serviceName, serviceDefinition.authorize);
    var payload = {
        orderNo : order.orderNo,
        token   : token
    };

    if (!empty(queryShareId)) {
        payload.queryShareInput = queryShareId;
    }
    var serviceResponse = service.call(payload);

    if (serviceResponse.status !== "OK") {
        throw new Error(serviceResponse.error + " : " + serviceResponse.errorMessage);
    }

    var detailOutput = serviceResponse.object.getDetailOutput().get(0);
    var tables       = Constants.transbank.tables;

    var result = {
        order                 : order,
        authorizationResponse : {
            authorizationCode   : detailOutput.getAuthorizationCode(),
            authorizationResult : tables.vci[detailOutput.getVCI()] || Constants.transbank.authorizationResult.AUTHENTICATION_FAILED,
            paymentType         : tables.paymentTypes[detailOutput.getPaymentTypeCode()] || Constants.transbank.paymentType.CREDIT_NO_INTEREST,
            responseCode        : tables.responseCodes[detailOutput.getResponseCode()] || Constants.transbank.responseCode.UNAUTHORIZED,
            sharesAmount        : detailOutput.getSharesAmount(),
            sharesNumber        : detailOutput.getSharesNumber(),
            token               : token,
            total               : detailOutput.getAmount(),
        }
    };
    return result;
}

/**
 * Simulates an amount of installments.
 * @param {String} token A token received from Transbank during the complete transaction initialization.
 * @param {dw.order.Order} order The order for which to simulate installments.
 * @param {Number} shareNumber A quantity of installments to simulate.
 * @return {Object.<queryId: Number, shareAmount: Number>} An object with the simmulation results. QueryId is the simulation identifier, shareAmount is the value of each installment.
 */
function queryShare(token, order, shareNumber) {
    var service = LocalServiceRegistry.createService(serviceName, serviceDefinition.queryShare);
    var payload = {
        orderNo     : order.orderNo,
        shareNumber : shareNumber,
        token       : token
    };

    var serviceResponse = service.call(payload);

    if (serviceResponse.status !== "OK") {
        throw new Error(serviceResponse.error + " : " + serviceResponse.errorMessage);
    }

    var details = serviceResponse.object;

    var result  = {
        queryId     : details.getQueryId(),
        shareAmount : details.getShareAmount()
    };
    return result;
}

module.exports = {
    acknowledgeCompleteTransaction : acknowledgeCompleteTransaction,
    authorize                      : authorize,
    initCompleteTransaction        : initCompleteTransaction,
    queryShare                     : queryShare
};
