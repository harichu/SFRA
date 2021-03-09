"use strict";

var server = require("server");

var Transaction = require("dw/system/Transaction");
var OrderMgr    = require("dw/order/OrderMgr");
var Order       = require("dw/order/Order");
var Resource    = require("dw/web/Resource");
var URLUtils    = require("dw/web/URLUtils");
var Site        = require("dw/system/Site");
var LoggerUtils = require("*/cartridge/scripts/utils/LoggerUtils");
var COHelpers   = require("*/cartridge/scripts/checkout/checkoutHelpers");
var MercadoPago = require("*/cartridge/scripts/library/libMercadoPago");

var customPreferences = Site.current.preferences.custom;

server.post("MercadoPagoPaymentNotification", function (req, res, next) {
    var paymentInfo;
    var orderNo;
    var orderToken = req.querystring.token ? req.querystring.token : null;
    var order;
    var orderStatus;
    var isPaymentAuthorized = true;
    var localeID = req.locale.id;

    // In case any problem occur during this steps the catch should return a invalid response for subsequent retries from mercado pago
    // For success cases the script will return a 200 request as it completes
    try {
        var notificationData = JSON.parse(request.httpParameterMap.requestBodyAsString);
        var isPaymentCreatedOrUpdated = !empty(notificationData) && "action" in notificationData && (notificationData.action === "payment.created" || notificationData.action === "payment.updated");

        //Payment notification action is not supported
        if (isPaymentCreatedOrUpdated) {
            Transaction.wrap(function () {
                var MP      = new MercadoPago();

                //Get current payment info for updated status
                paymentInfo = MP.getPaymentInfo(notificationData.data.id);

                if (!empty(paymentInfo)) {
                    orderNo = paymentInfo.external_reference;
                    order   = OrderMgr.getOrder(orderNo, orderToken);

                    if (!empty(order)) {
                        //Check the status with defined conditions
                        orderStatus = MP.parseOrderStatus(paymentInfo.status);

                        // Updates transaction statuses to be seen in BM
                        order.custom.transactionStatus = paymentInfo.status + " - " + Resource.msg("status." + paymentInfo.status, "mercadoPago", null);
                        order.custom.transactionReport = paymentInfo.status_detail ? paymentInfo.status_detail : "";

                        var approvedOrderStatuses = customPreferences.approvedOrderStatuses;

                        if (customPreferences.enableOrderPendingPage) {
                            isPaymentAuthorized = approvedOrderStatuses.indexOf(paymentInfo.status) >= 0;
                        }

                        //Then if authorized updated the payment
                        if (isPaymentAuthorized) {
                            order.paymentStatus = Order.PAYMENT_STATUS_PAID;
                            order.exportStatus  = Order.EXPORT_STATUS_READY;
                        }
                    }
                }
            });

            if (!empty(paymentInfo) && !empty(order) && paymentInfo.payment_method_id == "pse") {
                handlePSEResponse(order, orderStatus, localeID, { isPaymentAuthorized : isPaymentAuthorized});
            }

            if (isPaymentAuthorized && !order.custom.isEmailSent && paymentInfo.payment_method_id !== "pse") {
                COHelpers.sendConfirmationEmail(order, localeID);
                Transaction.wrap(function () {
                    order.custom.isEmailSent = true;
                });
            }
        } else {
            LoggerUtils.standardError("MercadoPago.js - MercadoPagoPaymentNotification\nThe action attribute is invalid: " + JSON.stringify(notificationData, null, 4));
        }
    } catch (e) {
        LoggerUtils.standardError("MercadoPago.js - MercadoPagoPaymentNotification\nAn error occurred with this method: " + e.message + "\n\n" + e.stack);
        response.setStatus(500);
    }

    res.json({});

    next();
});

// This function handles the response from webpay once it returns from mercadopago
server.get("ReturnURLWebpay", function (req, res, next) {
    // Gets the parameters sent by mercadopago with the response and captures the order
    var orderNumber = req.querystring.orderID;
    var orderToken = req.querystring.orderToken;
    var paymentStatus = req.querystring.payment_status;
    var payment_id = req.querystring.payment_id;
    var order = OrderMgr.getOrder(orderNumber);

    if (empty(paymentStatus) || empty(payment_id) || empty(order) || order.orderToken !== orderToken) {
        LoggerUtils.standardError("MercadoPago.js - Error in ReturnURLWebpay(): missing paramaters or the tokens do not match.");

        // It redirects to the home page
        res.redirect(URLUtils.url("Home-Show"));

        return next();
    }

    try {
        // Gets current payment info for updated status
        var MP          = new MercadoPago();
        var paymentInfo = MP.getPaymentInfo(payment_id);
        var isPaymentAuthorized = true;
        var approvedOrderStatuses = customPreferences.approvedOrderStatuses;

        if (!empty(paymentInfo) && "status" in paymentInfo && customPreferences.enableOrderPendingPage) {
            isPaymentAuthorized = approvedOrderStatuses.indexOf(paymentInfo.status) >= 0;
        }

        // the payment_status can be either approved or rejected
        if (!empty(paymentInfo) && "status" in paymentInfo && paymentInfo.status === paymentStatus && isPaymentAuthorized) {
            // sets the payment status as paid only if it was approved by mercadopago
            Transaction.wrap(function () {
                order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
            });

            var placeOrderResult = COHelpers.placeOrder(order, { status : paymentStatus }, { isPaymentAuthorized : isPaymentAuthorized });

            if (placeOrderResult.error) {
                return CheckoutError(res, order, next);
            }

            // It redirects to the confirmation page
            var url = URLUtils.https("Order-Confirm", "ID", encodeURIComponent(orderNumber), "token", encodeURIComponent(orderToken), "isPaymentAuthorized", isPaymentAuthorized);

            res.redirect(url);
        } else {
            return CheckoutWebpayError(res, order, next);
        }
    } catch (e) {
        LoggerUtils.standardError("MercadoPago.js - Error in ReturnURLWebpay() with details: " + e.message);
        res.redirect(URLUtils.https("Checkout-Begin", "stage", "payment"));
    }

    return next();
});

/**
 * Fails the order done with through webpay once is returned from MercadoPago
 * @param {Object} res
 * @param {dw.order.Order} order The order to receive payment data.
 * @param {Object} next
 */
function CheckoutWebpayError(res, order, next) {
    // sets the session variable as true so the error message can be displayed in the checkout
    session.custom.hasWebPayError = true;

    Transaction.wrap(function () {
        OrderMgr.failOrder(order);
    });

    // it redirects the customer back to the payment step in the checkout
    res.redirect(URLUtils.https("Checkout-Begin", "stage", "payment"));

    return next();
}

// This function executes when MercadoPago notifies us about updated to PSE payments
function handlePSEResponse(order, orderStatus, localeID, paymentStatus) {
    if (order.custom.mercadoPagoPsePaymentStatus != "pending" || order.status != Order.ORDER_STATUS_CREATED) {
        // Mercado pago can fire the same event more than once
        // In the case the change was already done, don't change anything
        return;
    }

    Transaction.wrap(function () {
        order.custom.mercadoPagoPsePaymentStatus = orderStatus;
    });

    try {
        var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");
        // possible orderStatus are "authorized", "declined" and "pending"
        // if we have "declined" or "pending", we will not do anything here
        // for "authorized", we will place the order and depending of the result, send a confirmation or failed email
        if (orderStatus == "authorized") {
            var placeOrderResult = COHelpers.placeOrder(order, { status : true }, paymentStatus);

            if (placeOrderResult.error) {
                COHelpers.sendOrderFailedEmail(order, localeID);
            }
        }
    } catch (e) {
        LoggerUtils.standardError("MercadoPago.js - Error in handlePSEResponse() with details: {0}", e.message);
    }
}

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

// This function handles the response from PSE once it returns from mercadopago
server.get("PSEReturnURL", function (req, res, next) {
    var OrderMgr = require("dw/order/OrderMgr");
    var Order = require("dw/order/Order");
    var order = OrderMgr.getOrder(req.querystring.ID);
    var token = req.querystring.token ? req.querystring.token : null;

    if (!order || !token || token !== order.orderToken || order.customer.ID !== req.currentCustomer.raw.ID) {
        res.render("/error", {
            message: Resource.msg("error.confirmation.error", "confirmation", null)
        });
        return next();
    }

    var pseStatus = order.custom.mercadoPagoPsePaymentStatus;

    if (pseStatus == "declined" && order.status == Order.ORDER_STATUS_CREATED) {
        var failOrderStatus = null;
        dw.system.Transaction.wrap(function () {
            failOrderStatus = OrderMgr.failOrder(order, true);
        });
        session.custom.hasPSEPaymentError = true;
        res.redirect(URLUtils.https("Checkout-Begin", "stage", "payment"));
    } else {
        // authorize, pending or other unhandled status
        var approvedOrderStatuses = customPreferences.approvedOrderStatuses;
        var isPaymentAuthorized   = true;

        if (customPreferences.enableOrderPendingPage) {
            isPaymentAuthorized = approvedOrderStatuses.indexOf(pseStatus) >= 0;
        }

        res.redirect(URLUtils.https("Order-Confirm", "ID", order.orderNo, "token", order.orderToken, "isPaymentAuthorized", isPaymentAuthorized));
    }
    return next();
});

module.exports = server.exports();
