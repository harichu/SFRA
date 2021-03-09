"use strict";

var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");

/**
 * Verifies the required information for billing form is provided.
 * @param {Object} req - The request object
 * @param {Object} paymentForm - the payment form
 * @param {Object} viewFormData - object contains billing form data
 * @returns {Object} an object that has error information or payment information
 */
function processForm(req, paymentForm, viewFormData) {
    var array = require("*/cartridge/scripts/util/array");

    var viewData = viewFormData;
    var creditCardErrors = {};
    var isCreditCardSelected = paymentForm.mercadoPagoCreditCard.isCreditCard.value === "true";

    // A customer may register a card at MP through other sites/systems.
    // Such cards would not have a storedPaymentUUID. We check for the card ID in such cases.
    if (isCreditCardSelected && !req.form.storedPaymentUUID && !req.form.dwfrm_billing_mercadoPagoCreditCard_cardId) {
        // verify credit card form data
        creditCardErrors = COHelpers.validateCreditCard(paymentForm);
    }

    var fieldsWithErrors = Object.keys(creditCardErrors);
    if (fieldsWithErrors.length) {
        if (paymentForm.mercadoPagoCreditCard.cardType.value == "pse" 
        && fieldsWithErrors.indexOf("dwfrm_billing_mercadoPagoCreditCard_expirationMonth") >= 0 
        && fieldsWithErrors.indexOf("dwfrm_billing_mercadoPagoCreditCard_expirationYear") >= 0) {
            // ignore CC form fields errors for PSE
        } else {
            return {
                fieldErrors: creditCardErrors,
                error: true
            };
        }
    }

    viewData.paymentMethod = {
        value: paymentForm.paymentMethod.value,
        htmlName: paymentForm.paymentMethod.value
    };

    viewData.paymentInformation = {
        cardType: {
            value: paymentForm.creditCardFields.cardType.value,
            htmlName: paymentForm.creditCardFields.cardType.htmlName
        },
        cardNumber: {
            value: paymentForm.creditCardFields.cardNumber.value,
            htmlName: paymentForm.creditCardFields.cardNumber.htmlName
        },
        securityCode: {
            value: paymentForm.creditCardFields.securityCode.value,
            htmlName: paymentForm.creditCardFields.securityCode.htmlName
        },
        expirationMonth: {
            value: parseInt(
                paymentForm.creditCardFields.expirationMonth.selectedOption,
                10
            ),
            htmlName: paymentForm.creditCardFields.expirationMonth.htmlName
        },
        expirationYear: {
            value: parseInt(paymentForm.creditCardFields.expirationYear.value, 10),
            htmlName: paymentForm.creditCardFields.expirationYear.htmlName
        }
    };

    if (req.form.storedPaymentUUID) {
        viewData.storedPaymentUUID = req.form.storedPaymentUUID;
    }

    viewData.saveCard = paymentForm.creditCardFields.saveCard.checked;

    // process payment information
    if (viewData.storedPaymentUUID
        && req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered
    ) {
        var paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
        var paymentInstrument = array.find(paymentInstruments, function (item) {
            return viewData.storedPaymentUUID === item.UUID;
        });
        if (paymentInstrument) {
            viewData.paymentInformation.cardNumber.value = paymentInstrument.creditCardNumber;
            viewData.paymentInformation.cardType.value = paymentInstrument.creditCardType;
            viewData.paymentInformation.securityCode.value = req.form.securityCode;
            viewData.paymentInformation.expirationMonth.value = paymentInstrument.creditCardExpirationMonth;
            viewData.paymentInformation.expirationYear.value = paymentInstrument.creditCardExpirationYear;
            viewData.paymentInformation.creditCardToken = paymentInstrument.raw.creditCardToken;
        }
    }

    return {
        error: false,
        viewData: viewData
    };
}

/**
 * Save the credit card information to login account if save card option is selected
 * @param {Object} req - The request object
 * @param {dw.order.Basket} basket - The current basket
 * @param {Object} billingData - payment information
 */
function savePaymentInformation(req, basket, billingData) {
    var CustomerMgr = require("dw/customer/CustomerMgr");
    if (!billingData.storedPaymentUUID
        && req.currentCustomer.raw.authenticated
        && req.currentCustomer.raw.registered
        && (billingData.paymentMethod.value === "MercadoPago")
    ) {
        var customer = CustomerMgr.getCustomerByCustomerNumber(
            req.currentCustomer.profile.customerNo
        );

        var saveCardResult = COHelpers.savePaymentInstrumentToWallet(
            billingData,
            basket,
            customer
        );

        req.currentCustomer.wallet.paymentInstruments.push({
            creditCardHolder: saveCardResult.creditCardHolder,
            maskedCreditCardNumber: saveCardResult.maskedCreditCardNumber,
            creditCardType: saveCardResult.creditCardType,
            creditCardExpirationMonth: saveCardResult.creditCardExpirationMonth,
            creditCardExpirationYear: saveCardResult.creditCardExpirationYear,
            UUID: saveCardResult.UUID,
            creditCardNumber: Object.hasOwnProperty.call(
                saveCardResult,
                "creditCardNumber"
            )
                ? saveCardResult.creditCardNumber
                : null,
            raw: saveCardResult
        });
    }
}

/**
 * We are only saving cards on Mercado Pago side
 */
function _savePaymentInformation(_req, _basket, _billingData) {
    return;
}

exports.processForm = processForm;
exports.savePaymentInformation = _savePaymentInformation;
