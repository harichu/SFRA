"use strict";

var PaymentStatusCodes = require("dw/order/PaymentStatusCodes");
var Transaction        = require("dw/system/Transaction");
var PaymentMgr         = require("dw/order/PaymentMgr");
var Resource           = require("dw/web/Resource");

var collections      = require("*/cartridge/scripts/util/collections");
var transbankService = require("*/cartridge/scripts/services/TransBankService");
/**
 * Creates a token. This should be replaced by utilizing a tokenization provider
 * @returns {string} a token
 */
function createMockToken() {
    return Math.random().toString(36).substr(2);
}

/***
 * Formats the credit card month
 * @param {dw.web.FormGroup}
 * @return {String}
 */
function getCreditCardMonth(cardsFields) {
    if (cardsFields.expirationMonth.htmlValue.length  > 1) {
        return cardsFields.expirationMonth.htmlValue;
    }
    return "0" + cardsFields.expirationMonth.htmlValue;
}

/**
 * Verifies that entered credit card information is a valid card. If the information is valid a
 * credit card payment instrument is created
 * @param {dw.order.Basket} basket Current users's basket
 * @param {Object} paymentInformation - the payment information
 * @return {Object} returns an error object
 */
function Handle(basket, paymentInformation, paymentMethodID) {
    var currentBasket    = basket;
    var cardErrors       = {};
    var cardNumber       = paymentInformation.cardNumber.value;
    var cardSecurityCode = paymentInformation.securityCode.value;
    var expirationMonth  = paymentInformation.expirationMonth.value;
    var expirationYeartoValidate = paymentInformation.expirationYear.htmlValue.length == 2 ? "20" + paymentInformation.expirationYear.value : paymentInformation.expirationYear.value ;
    var expirationYear   = paymentInformation.expirationYear.value ;
    var serverErrors     = [];
    var creditCardStatus;

    var cardType    = paymentInformation.cardType.value || "Visa";
    var paymentCard = PaymentMgr.getPaymentCard(cardType);
    var fullname    = paymentInformation.firstname.value + " " + paymentInformation.lastname.value;
    if (!paymentInformation.creditCardToken) {
        if (paymentCard) {
            creditCardStatus = paymentCard.verify(
                expirationMonth,
                expirationYeartoValidate,
                cardNumber,
                cardSecurityCode
            );
        } else {
            cardErrors[paymentInformation.cardNumber.htmlName] = Resource.msg("error.invalid.card.number", "creditCard", null);

            return {
                fieldErrors  : [cardErrors],
                serverErrors : serverErrors,
                error: true
            };
        }

        if (creditCardStatus.error) {
            collections.forEach(creditCardStatus.items, function (item) {
                switch (item.code) {
                    case PaymentStatusCodes.CREDITCARD_INVALID_CARD_NUMBER:
                        cardErrors[paymentInformation.cardNumber.htmlName] = Resource.msg("error.invalid.card.number", "creditCard", null);
                        break;

                    case PaymentStatusCodes.CREDITCARD_INVALID_EXPIRATION_DATE:
                        cardErrors[paymentInformation.expirationMonth.htmlName] = Resource.msg("error.expired.month.credit.card", "creditCard", null);
                        cardErrors[paymentInformation.expirationYear.htmlName]  = Resource.msg("error.expired.year.credit.card", "creditCard", null);
                        break;

                    case PaymentStatusCodes.CREDITCARD_INVALID_SECURITY_CODE:
                        cardErrors[paymentInformation.securityCode.htmlName] = Resource.msg("error.invalid.security.code", "creditCard", null);
                        break;
                    default:
                        serverErrors.push(Resource.msg("error.card.information.error", "creditCard", null));
                }
            });

            return {
                fieldErrors  : [cardErrors],
                serverErrors : serverErrors,
                error: true
            };
        }
    }


    Transaction.wrap(function () {
        //This cartridge does not support payment with multiple tenders as of now.
        var paymentInstruments = currentBasket.getPaymentInstruments();
        collections.forEach(paymentInstruments, function (item) {
            if (!item.giftCertificateID) {
                currentBasket.removePaymentInstrument(item);
            }
        });
        var paymentInstrument = currentBasket.createPaymentInstrument(paymentMethodID, currentBasket.totalGrossPrice);
        paymentInstrument.setCreditCardHolder(fullname);
        paymentInstrument.setCreditCardNumber(cardNumber);
        paymentInstrument.setCreditCardType(cardType);
        paymentInstrument.setCreditCardExpirationMonth(expirationMonth);
        paymentInstrument.setCreditCardExpirationYear(expirationYear);
        paymentInstrument.setCreditCardToken(paymentInformation.creditCardToken ? paymentInformation.creditCardToken : createMockToken());
    });
    return {
        fieldErrors  : cardErrors,
        serverErrors : serverErrors,
        error: false
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
function Authorize(orderNumber, paymentInstrument, paymentProcessor, paymentInformation) {
    var serverErrors = [];
    var fieldErrors  = {};
    var error = false;
    var order = require("dw/order/OrderMgr").getOrder(orderNumber);


    var cardsFields;

    switch (paymentInstrument.getPaymentMethod()) {
        case "DEBIT_CARD":
            cardsFields = paymentInformation.debitCardFields;
            break;
        case "CREDIT_CARD":
            cardsFields = paymentInformation.creditCardFields;
            break;
    }

    var object = {
        orderNo     : orderNumber,
        totalAmount : order.getTotalGrossPrice().value,
        buyOrder    : orderNumber,
        transactionType: "FULL",
        cardDetail : {
            cardNumber: cardsFields.cardNumber.value,
            cardExpirationDate: cardsFields.expirationYear.value + "/" + getCreditCardMonth(cardsFields),
            cvv: cardsFields.securityCode.value
        },
        shareNumber: order.custom.tbkInstallmentQuantity
    };

    try {
        var executionReturn = transbankService.execute(object);
        var detailsOutPut   = executionReturn ? executionReturn.getDetailsOutput() : null;
        if (detailsOutPut != null && detailsOutPut.size() > 0  && detailsOutPut.get(0).getAuthorizationCode() != 0) {
            Transaction.wrap(function () {
                order.custom.tbkTransbankCode = detailsOutPut.get(0).getAuthorizationCode();
                paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
                paymentInstrument.paymentTransaction.setPaymentProcessor(paymentProcessor);
            });
        } else {
            error = true;
            serverErrors.push(Resource.msg("checkout.authorization.denied", "checkout", null));
        }
    } catch (e) {
        error = true;
        serverErrors.push(
            Resource.msg("error.technical", "checkout", null)
        );
    }

    return {
        fieldErrors  : fieldErrors,
        serverErrors : serverErrors,
        error: error
    };
}



exports.Handle = Handle;
exports.Authorize = Authorize;
exports.createMockToken = createMockToken;

