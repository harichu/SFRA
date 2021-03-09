"use strict";

var server = require("server");

// SFCC classes
var Order       = require("dw/order/Order");
var OrderMgr    = require("dw/order/OrderMgr");
var PaymentMgr  = require("dw/order/PaymentMgr");
var Resource    = require("dw/web/Resource");
var Transaction = require("dw/system/Transaction");
var URLUtils    = require("dw/web/URLUtils");

// Files present in the app_storefront_base cartridge
var COHelpers   = require("*/cartridge/scripts/checkout/checkoutHelpers");
var collections = require("*/cartridge/scripts/util/collections");

// Files from this cartridge
var webpayPlusService = require("~/cartridge/scripts/services/WebpayPlus");
var Constants         = require("~/cartridge/scripts/Constants");

server.post("ReturnURL", function (req, res, next) {
    var token_ws            = req.form.token_ws;
    var transactionResponse = webpayPlusService.getTransactionResult(token_ws);

    if (transactionResponse.errorMessage) {
        return CheckoutError(res, order, next);
    }

    var orderNumber = req.querystring.orderNo; // the full URL to return to was informed to Transbank in initTransaction.
    var order       = OrderMgr.getOrder(orderNumber);

    webpayPlusService.acknowledgeTransaction(token_ws);

    var transactionResult = transactionResponse.transactionResult;
    var detailOutput      = transactionResult.getDetailOutput();
    var authorizationCode = detailOutput.get(0).getAuthorizationCode();

    if (detailOutput.size() > 0 && authorizationCode != Constants.transbank.resultCodes.FAILED) {
        var paymentTypeCode = detailOutput.get(0).getPaymentTypeCode();
        var responseCode    = detailOutput.get(0).getResponseCode() + "";
        var vci             = transactionResult.getVCI();

        Transaction.wrap(function () {
            updatePaymentType(order, detailOutput.get(0));
            order.custom.tbkAuthorizationCode      = authorizationCode;
            order.custom.tbkAuthorizationResult    = Constants.transbank.tables.vci[vci] || Constants.transbank.authorizationResult.AUTHENTICATION_FAILED;
            order.custom.tbkPaymentType            = Constants.transbank.tables.paymentTypes[paymentTypeCode] || Constants.transbank.paymentType.CREDIT_NO_INTEREST;
            order.custom.tbkQuantityOfInstallments = detailOutput.get(0).getSharesNumber();
            order.custom.tbkResponseCode           = Constants.transbank.tables.responseCodes[responseCode] || Constants.transbank.responseCode.UNAUTHORIZED;
            order.custom.tbkToken                  = token_ws;
            order.custom.tbkTotal                  = detailOutput.get(0).getAmount();

            order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
        });

        var placeOrderResult = COHelpers.placeOrder(order, { status : detailOutput[0].responseCode, transbankPlus : true });
        if (placeOrderResult.error) {
            return CheckoutError(res, order, next);
        }
    } else {
        return CheckoutError(res, order, next);
    }

    COHelpers.sendConfirmationEmail(order);
    res.render("checkout/transbankForm", {
        redirectUrl:transactionResult.urlRedirection,
        token:token_ws,
        orderNo:order.orderNo
    });

    next();
});

server.post("finalURL", function (req, res, next) {
    var order = OrderMgr.getOrder(req.querystring.orderNo);
    if (order.custom.tbkTransbankToken) {
        var orderNumber = encodeURIComponent(order.orderNo);
        var token       = encodeURIComponent(order.orderToken);
        var url         = URLUtils.https("Order-Confirm", "ID", orderNumber, "token", token);
        res.redirect(url);
        return next();
    } else {
        return CheckoutError(res, order, next);
    }
});

/**
 * Check if we got an error during the transaction.
 * @param {Object} res response object.
 * @param {dw.Order.Order} order current order.
 * @param {Object} next next route.
 */
function CheckoutError(res, order, next) {
    Transaction.wrap(function () {
        OrderMgr.failOrder(order);
    });

    res.setViewData({
        error               : true,
        errorMessage        : Resource.msg("error.technical", "checkout", null),
        generalErrorMessage : true
    });
    
    var url = URLUtils.https("Checkout-Begin", "stage", "payment");
    res.redirect(url);
    return next();
}

/**
 *Updates the payment type on the order.
 * @param {dw.Order.order} order The order for which to update the payment type.
 * @param {Object} detailOutput An object obtained through Webpay Plus's web service through the getTransactionResult endpoint.
 */
function updatePaymentType(order, detailOutput) {
    var paymentInstruments = order.getPaymentInstruments();
    var paymentProcessor   = PaymentMgr.getPaymentMethod(Constants.debitCard).paymentProcessor;
    collections.forEach(paymentInstruments, function (item) {
        if (!item.giftCertificateID) {
            order.removePaymentInstrument(item);
        }
    });
    var paymentInstrument = null;

    if (detailOutput.getPaymentTypeCode() == "VD") {
        paymentInstrument = order.createPaymentInstrument(
            Constants.debitCard, order.totalGrossPrice
        );
    } else {
        paymentInstrument = order.createPaymentInstrument(
            Constants.creditCard, order.totalGrossPrice
        );
    }
    paymentInstrument.paymentTransaction.setTransactionID(order.orderNo);
    paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
}

module.exports = server.exports();
