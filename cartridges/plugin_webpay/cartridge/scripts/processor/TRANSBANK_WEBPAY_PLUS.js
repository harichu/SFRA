"use strict";

// SFCC Classes
var Transaction        = require("dw/system/Transaction");
var Resource           = require("dw/web/Resource");
var OrderMgr           = require("dw/order/OrderMgr");
var PaymentInstrument  = require("dw/order/PaymentInstrument");
var Logger             = require("dw/system/Logger");

// Files in this cartridge
var webpayPlusService  = require("~/cartridge/scripts/services/WebpayPlus");

// Files from SFRA
var collections        = require("*/cartridge/scripts/util/collections");
/**
 * Creates a token. This should be replaced by utilizing a tokenization provider.
 * @returns {string} a randomly generated token.
 */
function createMockToken() {
    return Math.random().toString(36).substr(2);
}

/**
 * Verifies that the payment information provided is valid.
 * @param {dw.order.Basket} basket The current customer's basket.
 * @param {Object} paymentInformation The payment information.
 * @return {Object} An object detailing any errors that may be present in the handling of the payment information.
 */
function Handle(basket, paymentInformation) {
    var currentBasket = basket;
    var cardErrors    = {};
    var serverErrors  = [];

    Transaction.wrap(function () {
        var paymentMethod = paymentInformation.paymentMethod.toString();

        //This cartridge does not support payment with multiple tenders as of now.
        var paymentInstruments = currentBasket.getPaymentInstruments();
        collections.forEach(paymentInstruments, function (item) {
            if (!item.giftCertificateID) {
                currentBasket.removePaymentInstrument(item);
            }
        });

        var paymentInstrument = currentBasket.createPaymentInstrument(paymentInformation.paymentMethod.toString(), currentBasket.totalGrossPrice);

        if (PaymentInstrument.METHOD_CREDIT_CARD.equals(paymentMethod)) {
            var cardType = paymentInformation.cardType.value || "Visa";
            paymentInstrument.setCreditCardType(cardType);
        }

        if (paymentInformation.firstname.value != null && paymentInformation.lastname.value != null) {
            var cardHolderFullname = paymentInformation.firstname.value + " " + paymentInformation.lastname.value;
            paymentInstrument.setCreditCardHolder(cardHolderFullname);
        } else {
            paymentInstrument.setCreditCardHolder(currentBasket.billingAddress.fullName);
        }

        paymentInstrument.setCreditCardToken(paymentInformation.creditCardToken ? paymentInformation.creditCardToken : createMockToken());
    });

    return {
        error: false,
        fieldErrors  : cardErrors,
        serverErrors : serverErrors
    };
}

/**
 * Authorizes a payment using a credit card. Customizations may use other processors and custom
 *      logic to authorize credit card payment.
 * @param {number} orderNumber - The current order's number
 * @param {dw.order.PaymentInstrument} paymentInstrument -  The payment instrument to authorize
 * @param {dw.order.PaymentProcessor} paymentProcessor -  The payment processor of the current
 *      payment method
 * @return {Object} returns an error object
 */
function Authorize(orderNumber, paymentInstrument, paymentProcessor) {
    var serverErrors = [];
    var fieldErrors  = {};
    var error        = false;
    var order        = OrderMgr.getOrder(orderNumber);
    var url          = null;

    try {
        url = webpayPlusService.initTransaction({
            orderNo     : orderNumber,
            totalAmount : order.getTotalGrossPrice().value
        });
        Transaction.wrap(function () {
            paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
            paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
        });
    } catch (e) {
        error            = true;
        var errorMessage = Resource.msg("error.technical", "checkout", null);
        Logger.error(errorMessage  + " - " + e.message);
        serverErrors.push(errorMessage);
    }

    return {
        error           : error,
        fieldErrors     : fieldErrors,
        isTransbankPlus : true,
        serverErrors    : serverErrors,
        transbankURL    :  url
    };
}

exports.Handle = Handle;
exports.Authorize = Authorize;
exports.createMockToken = createMockToken;
