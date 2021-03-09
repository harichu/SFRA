"use strict";

var server = require("server");
var collections = require("*/cartridge/scripts/util/collections");
var array = require("*/cartridge/scripts/util/array");
var MercadoPago = require("*/cartridge/scripts/library/libMercadoPago");

var Transaction = require("dw/system/Transaction");
var Resource = require("dw/web/Resource");
var Order = require("dw/order/Order");
var OrderMgr = require("dw/order/OrderMgr");

var LoggerUtils     = require("*/cartridge/scripts/utils/LoggerUtils");
var OrderLoadHelper = require("*/cartridge/scripts/helpers/orderLoadHelper");

/**
 * @description Create payment instrument
 * @param {dw.order.Basket} basket Current basket
 * @param {Object} paymentInformation - the payment information
 * @returns {Object}
 */
function Handle(basket, paymentInformation) {
    var currentBasket   = basket;
    var cardType        = paymentInformation.mercadoPago.cardType.value;
    var creditCardToken = paymentInformation.mercadoPago.token.value;
    var docType         = paymentInformation.mercadoPago.identification.docType.value;
    var docNumber       = paymentInformation.mercadoPago.identification.docNumber.value;
    var expirationMonth = paymentInformation.mercadoPago.expirationMonth.value;
    var expirationYear  = paymentInformation.mercadoPago.expirationYear.value;
    var cardId          = paymentInformation.mercadoPago.cardId.value;

    Transaction.wrap(function () {
        currentBasket.custom.SorCardId = cardId;
        collections.forEach(currentBasket.getPaymentInstruments(), function (item) {
            currentBasket.removePaymentInstrument(item);
        });

        var paymentInstrument = currentBasket.createPaymentInstrument(
            Resource.msg("payment.method.id", "mercadoPagoPreferences", null), currentBasket.totalGrossPrice
        );

        /**
         * Credit card data isn't saved
         * It's saved on MercadoPago side
         * Instead token is obtained
         */
        paymentInstrument.setCreditCardExpirationMonth(expirationMonth);
        paymentInstrument.setCreditCardExpirationYear(expirationYear);
        paymentInstrument.setCreditCardType(cardType); // Required always
        creditCardToken && paymentInstrument.setCreditCardToken(creditCardToken); // Required only for credit card payments

        if (docType && docNumber) {
            paymentInstrument.custom.customerDocType = docType;
            paymentInstrument.custom.customerDocNumber = docNumber;
        }

    });

    return { fieldErrors: {}, serverErrors: [], error: false };
}

/**
 * @description Create payment data and make call to API
 * @param {Number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @returns {Object}
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var Site = require("dw/system/Site");

    var customPreferences = Site.current.preferences.custom;
    var pendingOrderStatuses = customPreferences.pendingOrderStatuses;
    var order = OrderMgr.getOrder(orderNumber);
    var MP = new MercadoPago();
    var creditCardForm = server.forms.getForm("billing");
    var serverErrors = [];
    var error = false;
    var authError = false;
    var isPaymentAuthorized = true;

    // Default values
    var installments = 1;
    var issuerId = 0;

    var customerSearch;
    var customerResult;
    var newCustomer;
    var customerID = "";

    var cardData = "";
    var parsedResponse;
    var saveCard = creditCardForm.mercadoPagoCreditCard.saveCard.value;

    // Set installment option
    if (creditCardForm.mercadoPagoCreditCard.installments.value) {
        installments = parseInt(creditCardForm.mercadoPagoCreditCard.installments.value, 10);
    }

    // Set issuer option
    if (creditCardForm.mercadoPagoCreditCard.issuer.value) {
        issuerId = parseInt(creditCardForm.mercadoPagoCreditCard.issuer.value, 10);
    }

    // Get customer ID
    if (customer.authenticated && customer.registered) {
        customerSearch = MP.searchCustomer({email: customer.profile.email});
        if (customerSearch) {
            customerResult = array.find(customerSearch.results, function (result) {
                return result.email === customer.profile.email;
            });
        }

        customerID = customerResult ? customerResult.id : "";
        if (!customerID) {
            newCustomer = MP.createCustomer({email : customer.profile.email});
            customerID = newCustomer ? newCustomer.id : "";
        }
    }

    // Create payment data
    var paymentData = MP.createPaymentData(order, customer, installments, issuerId, customerID);

    // Do payment request
    var paymentResponse = MP.createPayment(paymentData);

    var cardTypes = {
        amex     : "AMEX",
        discover : "DISCOVER",
        master   : "MASTER",
        visa     : "VISA"
    };

    try {
        Transaction.wrap(function () {
            var paymentTransaction = paymentInstrument.paymentTransaction;
            paymentTransaction.setPaymentProcessor(paymentProcessor);

            if (paymentInstrument.creditCardType) {
                cardData = paymentInstrument.creditCardType;
            }

            if (cardData) {
                paymentTransaction.custom.cardType = cardTypes[cardData] || "";
            }

            if (paymentResponse && paymentResponse.status) {
                parsedResponse           = MP.parseOrderStatus(paymentResponse.status);
                var isValidPaymentStatus = parsedResponse == "authorized" || parsedResponse == "pending";

                if (customPreferences.enableOrderPendingPage) {
                    isPaymentAuthorized = pendingOrderStatuses.indexOf(paymentResponse.status) < 0;
                }

                error = empty(parsedResponse) || !isValidPaymentStatus;

                session.custom.ccValidationError = null;
                session.custom.hasPSEPaymentError = null;
                session.custom.hasWebPayError = null;

                // If response is successful, create customer card based on the token
                if (customer.authenticated && isValidPaymentStatus && saveCard) {
                    MP.createCustomerCard(customerID, {token: paymentInstrument.creditCardToken});
                }

                // Updates transaction statuses to be seen in BM
                order.custom.transactionStatus = paymentResponse.status + " - " + Resource.msg("status." + paymentResponse.status, "mercadoPago", null);
                order.custom.transactionReport = paymentResponse.status_detail;

                // Set transaction id
                if (paymentResponse.id) {
                    paymentTransaction.transactionID = paymentResponse.id;

                    if (paymentResponse.transaction_details.external_resource_url) {
                        order.custom.transactionNote = paymentResponse.transaction_details.external_resource_url;
                    }
                }

                // Set order payment status to paid if order is authorized
                if (isValidPaymentStatus) {
                    if (cardData !== "webpay" && cardData !== "pse" && isPaymentAuthorized) {
                        order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                    }
                    if (cardData == "pse") {
                        // save payment status as "pending"
                        order.custom.mercadoPagoPsePaymentStatus = parsedResponse;
                    }

                    var orderLoadData = MP.prepareDataForOrderLoad(paymentResponse);
                    OrderLoadHelper.fillPaymentData(order, orderLoadData);
                }

                if (error) {
                    serverErrors.push(
                        Resource.msg("error.card.information.error", "creditCard", null)
                    );
                }
            } else {
                session.custom.ccValidationError = true;
                error = true;
                authError = true;
                serverErrors.push(
                    Resource.msg("error.card.information.error", "creditCard", null)
                );
            }
        });
    } catch (e) {
        LoggerUtils.standardError(e.message);
        error = true;
        serverErrors.push(
            Resource.msg("error.technical", "checkout", null)
        );
    }

    return {
        isPaymentAuthorized : isPaymentAuthorized,
        serverErrors        : serverErrors, 
        error               : error, 
        authError           : authError
    };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
