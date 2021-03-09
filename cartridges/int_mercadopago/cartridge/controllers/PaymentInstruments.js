"use strict";

var base = module.superModule;

var server = require("server");
server.extend(base);

var csrfProtection = require("*/cartridge/scripts/middleware/csrf");
var userLoggedIn = require("*/cartridge/scripts/middleware/userLoggedIn");
var mercadoPagoHelper = require("*/cartridge/scripts/util/MercadoPagoHelper");
var accountHelpers = require("*/cartridge/scripts/helpers/accountHelpers");
var Resource = require("dw/web/Resource");

/**
 * Creates an object from form values
 * @param {Object} paymentForm - form object
 * @returns {Object} a plain object of payment instrument
 */
function getDetailsObject(paymentForm) {
    return {
        name: paymentForm.cardOwner.value,
        cardNumber: paymentForm.cardNumber.value,
        cardType: paymentForm.cardType.value,
        expirationMonth: paymentForm.expirationMonth.value,
        expirationYear: paymentForm.expirationYear.value,
        paymentForm: paymentForm
    };
}

/**
 * Extending route to add customer cards retrieved from Mercado Pago,
 * the cards will have the same format as of SFRA default for Account
 */
server.append("List", function (req, res, next) {
    var viewData = res.getViewData();
    viewData.customerCards = mercadoPagoHelper.getAccountCreditCards(req.currentCustomer);
    viewData.isMercadoPagoEnabled = mercadoPagoHelper.isMercadoPagoEnabled();
    res.setViewData(viewData);
    next();
});

/**
 * Extending route to provide additional customer data to be used by Mercado Pago services
 */
server.append("AddPayment", function (req, res, next) {
    var customer = req.currentCustomer.raw;
    var viewData = res.getViewData();
    var customerDocument = {};
    if (!empty(customer.profile)) {
        if (!empty(customer.profile.custom.ccDocument)) {
            customerDocument.docType = Resource.msg("CC.docType", "mercadoPagoPreferences", null);
            customerDocument.docNumber = customer.profile.custom.ccDocument;
        } else if (!empty(customer.profile.custom.ceDocument)) {
            customerDocument.docType = Resource.msg("CE.docType", "mercadoPagoPreferences", null);
            customerDocument.docNumber = customer.profile.custom.ceDocument;
        } else if (!empty(customer.profile.custom.passport)) {
            customerDocument.docType = Resource.msg("Otro.docType", "mercadoPagoPreferences", null);
            customerDocument.docNumber = customer.profile.custom.passport;
        }
    }
    viewData.customerDocument = customerDocument;
    viewData.mpMessages = mercadoPagoHelper.getErrorMessages();
    res.setViewData(viewData);
    next();
});

/**
 * Overriding endpoint to delete cards on Mercado Pago side instead
 */
server.replace("DeletePayment", userLoggedIn.validateLoggedInAjax, function (req, res, next) {
    if (mercadoPagoHelper.isMercadoPagoEnabled()) {
        var customerID = req.querystring.customerID;
        var cardID = req.querystring.cardID;
        var deletedCard = mercadoPagoHelper.deleteCustomerCard(customerID, cardID);

        if (deletedCard.id === cardID) {
            accountHelpers.sendAccountEditedEmail(customer.profile);
            res.json({
                success: true,
                cardID: deletedCard.id
            });
        } else {
            res.json({
                error: true,
                cardID: cardID
            });
        }
    } else {
        var array = require("*/cartridge/scripts/util/array");

        var data = res.getViewData();
        if (data && !data.loggedin) {
            res.json();
            return next();
        }

        var UUID = req.querystring.UUID;
        var paymentInstruments = req.currentCustomer.wallet.paymentInstruments;
        var paymentToDelete = array.find(paymentInstruments, function (item) {
            return UUID === item.UUID;
        });
        res.setViewData(paymentToDelete);

        this.on("route:BeforeComplete", function () { // eslint-disable-line no-shadow
            var CustomerMgr = require("dw/customer/CustomerMgr");
            var Transaction = require("dw/system/Transaction");

            var payment = res.getViewData();
            var customer = CustomerMgr.getCustomerByCustomerNumber(
                req.currentCustomer.profile.customerNo
            );
            var wallet = customer.getProfile().getWallet();
            Transaction.wrap(function () {
                wallet.removePaymentInstrument(payment.raw);
            });

            // Send account edited email
            accountHelpers.sendAccountEditedEmail(customer.profile);

            res.json({
                success : true,
                cardID  : UUID
            });
        });
    }

    next();
});

/**
 * Overriding endpoint to save cards on Mercado Pago side instead
 */
server.replace("SavePayment", csrfProtection.validateAjaxRequest, function (_req, res, next) {
    var formErrors      = require("*/cartridge/scripts/formErrors");
    var accountHelpers  = require("*/cartridge/scripts/helpers/accountHelpers");
    var creditCardUtils = require("*/cartridge/scripts/util/CreditCardUtils");
    var paymentForm     = server.forms.getForm("creditCard");

    if (mercadoPagoHelper.isMercadoPagoEnabled()) {
        var cardToken = paymentForm.cardToken.value;

        if (paymentForm.valid && !empty(cardToken)) {
            res.setViewData(getDetailsObject(paymentForm));
            this.on("route:BeforeComplete", function (req1, res1) {
                var URLUtils = require("dw/web/URLUtils");
                var CustomerMgr = require("dw/customer/CustomerMgr");

                var customer = CustomerMgr.getCustomerByCustomerNumber(
                    req1.currentCustomer.profile.customerNo
                );
                var customerCards = mercadoPagoHelper.getCustomerCards(req1.currentCustomer) || [];
                var newCard = mercadoPagoHelper.createCustomerCard(customer.profile.email, cardToken);
                var isNewCard = !empty(newCard) && customerCards.filter(function (card) {
                    return card.id === newCard.id;
                }).length === 0;
                if (!empty(newCard) && isNewCard) {
                    accountHelpers.sendAccountEditedEmail(customer.profile);
                    res1.json({
                        success: true,
                        redirectUrl: URLUtils.url("PaymentInstruments-List").toString()
                    });
                } else {
                    paymentForm.valid = false;
                    paymentForm.cardNumber.valid = false;
                    paymentForm.cardNumber.error = Resource.msg("error.card.alreadyexists", "creditCard", null);
                    res1.json({
                        success: false,
                        fields: formErrors.getFormErrors(paymentForm)
                    });
                }
            });
        } else {
            res.json({
                success: false,
                fields: formErrors.getFormErrors(paymentForm)
            });
        }
    } else {
        var HookMgr = require("dw/system/HookMgr");
        var PaymentMgr = require("dw/order/PaymentMgr");
        var dwOrderPaymentInstrument = require("dw/order/PaymentInstrument");

        var result = getDetailsObject(paymentForm);

        if (paymentForm.valid && !creditCardUtils.verifyCard(result, paymentForm)) {
            res.setViewData(result);
            this.on("route:BeforeComplete", function (req, res) { // eslint-disable-line no-shadow
                var URLUtils = require("dw/web/URLUtils");
                var CustomerMgr = require("dw/customer/CustomerMgr");
                var Transaction = require("dw/system/Transaction");

                var formInfo = res.getViewData();
                var customer = CustomerMgr.getCustomerByCustomerNumber(
                    req.currentCustomer.profile.customerNo
                );
                var wallet = customer.getProfile().getWallet();

                Transaction.wrap(function () {
                    var paymentInstrument = wallet.createPaymentInstrument(dwOrderPaymentInstrument.METHOD_CREDIT_CARD);
                    paymentInstrument.setCreditCardHolder(formInfo.name);
                    paymentInstrument.setCreditCardNumber(formInfo.cardNumber);
                    paymentInstrument.setCreditCardType(formInfo.cardType);
                    paymentInstrument.setCreditCardExpirationMonth(formInfo.expirationMonth);
                    paymentInstrument.setCreditCardExpirationYear(formInfo.expirationYear);

                    var processor = PaymentMgr.getPaymentMethod(dwOrderPaymentInstrument.METHOD_CREDIT_CARD).getPaymentProcessor();
                    var token = HookMgr.callHook(
                        "app.payment.processor." + processor.ID.toLowerCase(),
                        "createToken"
                    );

                    paymentInstrument.setCreditCardToken(token);
                });

                // Send account edited email
                accountHelpers.sendAccountEditedEmail(customer.profile);

                res.json({
                    success: true,
                    redirectUrl: URLUtils.url("PaymentInstruments-List").toString()
                });
            });
        } else {
            res.json({
                success: false,
                fields: formErrors.getFormErrors(paymentForm)
            });
        }
    }

    next();
});

module.exports = server.exports();
