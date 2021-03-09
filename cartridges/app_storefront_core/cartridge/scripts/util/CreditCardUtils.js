"use strict";

/**
 * @module CreditCardUtils
 *
 * Credit Card Utils
 * 
 */

function getCardType(cardNum) {

    if (!luhnCheck(cardNum)) {
        return "";
    }

    var payCardType = "";
    var regexMap = [
        {regEx: /^4[0-9]{5}/ig, cardType: "VISA"},
        {regEx: /^5[1-5][0-9]{4}/ig, cardType: "MASTERCARD"},
        {regEx: /^3[47][0-9]{3}/ig, cardType: "AMEX"},
        {regEx: /^(5[06-8]\d{4}|6\d{5})/ig, cardType: "MAESTRO"}
    ];
    
    for (var j = 0; j < regexMap.length; j++) {
        if (cardNum.match(regexMap[j].regEx)) {
            payCardType = regexMap[j].cardType;
            break;
        }
    }

    if (cardNum.indexOf("50") === 0 || cardNum.indexOf("60") === 0 || cardNum.indexOf("65") === 0) {
        var g = "508500-508999|606985-607984|608001-608500|652150-653149";
        var i = g.split("|");
        for (var d = 0; d < i.length; d++) {
            var c = parseInt(i[d].split("-")[0], 10);
            var f = parseInt(i[d].split("-")[1], 10);
            if ((cardNum.substr(0, 6) >= c && cardNum.substr(0, 6) <= f) && cardNum.length >= 6) {
                payCardType = "RUPAY";
                break;
            }
        }
    }
    return payCardType;
	
}
	
	
function luhnCheck(cardNum) {
    // Luhn Check Code from https://gist.github.com/4075533
    // accept only digits, dashes or spaces
    var numericDashRegex = /^[\d\-\s]+$/;
    if (!numericDashRegex.test(cardNum)) return false;

    // The Luhn Algorithm. It's so pretty.
    var nCheck = 0, nDigit = 0, bEven = false;
    var strippedField = cardNum.replace(/\D/g, "");

    for (var n = strippedField.length - 1; n >= 0; n--) {
        var cDigit = strippedField.charAt(n);
        nDigit = parseInt(cDigit, 10);
        if (bEven) {
            if ((nDigit *= 2) > 9) nDigit -= 9;
        }

        nCheck += nDigit;
        bEven = !bEven;
    }

    return (nCheck % 10) === 0;
}

/**
 * Checks if a credit card is valid or not
 * @param {Object} card - plain object with card details
 * @param {Object} form - form object
 * @returns {boolean} a boolean representing card validation
 */
module.exports.verifyCard = function (card, form) {
    var collections = require("*/cartridge/scripts/util/collections");
    var Resource = require("dw/web/Resource");
    var PaymentMgr = require("dw/order/PaymentMgr");
    var PaymentStatusCodes = require("dw/order/PaymentStatusCodes");

    var cardType  = getCardType(card.cardNumber);
    card.cardType = cardType.charAt(0).toUpperCase() + cardType.slice(1).toLowerCase();

    var paymentCard = PaymentMgr.getPaymentCard(card.cardType);
    var error = false;
    var cardNumber = card.cardNumber;
    var creditCardStatus;
    var formCardNumber = form.cardNumber;

    if (paymentCard) {
        creditCardStatus = paymentCard.verify(
            card.expirationMonth,
            card.expirationYear,
            cardNumber
        );
    } else {
        formCardNumber.valid = false;
        formCardNumber.error =
            Resource.msg("error.message.creditnumber.invalid", "forms", null);
        error = true;
    }

    if (creditCardStatus && creditCardStatus.error) {
        collections.forEach(creditCardStatus.items, function (item) {
            switch (item.code) {
                case PaymentStatusCodes.CREDITCARD_INVALID_CARD_NUMBER:
                    formCardNumber.valid = false;
                    formCardNumber.error =
                        Resource.msg("error.message.creditnumber.invalid", "forms", null);
                    error = true;
                    break;

                case PaymentStatusCodes.CREDITCARD_INVALID_EXPIRATION_DATE:
                    var expirationMonth = form.expirationMonth;
                    var expirationYear = form.expirationYear;
                    expirationMonth.valid = false;
                    expirationMonth.error =
                        Resource.msg("error.message.creditexpiration.expired", "forms", null);
                    expirationYear.valid = false;
                    error = true;
                    break;
                default:
                    error = true;
            }
        });
    }
    return error;
};
