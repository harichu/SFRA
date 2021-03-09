"use strict";

var server = require("server");
var mercadoPagoHelper = require("*/cartridge/scripts/util/MercadoPagoHelper");

server.extend(module.superModule);

/**
 * Populate viewData with additional data specific for MercadoPago
 */
server.append("SubmitPayment", function (req, res, next) {
    // Guard clause
    var viewData = res.getViewData();
    if (viewData.error) {
        return next();
    }

    // Guard clause
    var Resource = require("dw/web/Resource");
    if (viewData.paymentMethod.value !== Resource.msg("payment.method.id", "mercadoPagoPreferences", null)) {
        return next();
    }

    var paymentForm = server.forms.getForm("billing");
    var saveCard = paymentForm.mercadoPagoCreditCard.saveCard;
    var cardToken = paymentForm.mercadoPagoCreditCard.token;
    if (saveCard.valid && saveCard.checked && cardToken.valid) {
        mercadoPagoHelper.createCustomerCard(req.currentCustomer.profile.email, cardToken.value);
    }
    var cardTypeField = paymentForm.mercadoPagoCreditCard.cardType;
    var docType       = null;
    var docNumber     = null;

    if (cardTypeField.value == "pse") {
        docType = paymentForm.mercadoPagoCreditCard.pseDocType.value;
        docNumber = paymentForm.mercadoPagoCreditCard.pseDocNumber.value;
    } else {
        docType = paymentForm.mercadoPagoCreditCard.docType.value;
        docNumber = paymentForm.mercadoPagoCreditCard.docNumber.value;
    }
    viewData.paymentInformation.mercadoPago = {
        cardType: {
            value: cardTypeField.value,
            htmlName: cardTypeField.htmlName
        },
        cardNumber: {
            value: paymentForm.mercadoPagoCreditCard.cardNumber.value,
            htmlName: paymentForm.mercadoPagoCreditCard.cardNumber.htmlName
        },
        expirationMonth: {
            value: paymentForm.mercadoPagoCreditCard.expirationMonth.value,
            htmlName: paymentForm.mercadoPagoCreditCard.expirationMonth.htmlName
        },
        expirationYear: {
            value: paymentForm.mercadoPagoCreditCard.expirationYear.value,
            htmlName: paymentForm.mercadoPagoCreditCard.expirationYear.htmlName
        },
        token: {
            value: paymentForm.mercadoPagoCreditCard.token.value,
            htmlName: paymentForm.mercadoPagoCreditCard.token.htmlName
        },
        identification: {
            docType   : { value : docType },
            docNumber : { value : docNumber }
        },
        cardId : {
            value    : paymentForm.mercadoPagoCreditCard.cardId.value,
            htmlName : paymentForm.mercadoPagoCreditCard.cardId.htmlName,
        }
    };

    viewData.mercadoPago = {
        email: {value: paymentForm.mercadoPagoCreditCard.email.value},
        phone: {value: paymentForm.mercadoPagoCreditCard.phone.value}
    };

    res.setViewData(viewData);

    this.on("route:BeforeComplete", function (req, res) {
        var BasketMgr = require("dw/order/BasketMgr");
        var Transaction = require("dw/system/Transaction");

        var billingForm = server.forms.getForm("billing");
        var billingData = res.getViewData();
        var currentBasket = BasketMgr.getCurrentBasket();
        var billingAddress = currentBasket.billingAddress;

        // Clear sensitive data
        billingForm.mercadoPagoCreditCard.cardNumber.htmlValue = "";
        billingForm.mercadoPagoCreditCard.securityCode.htmlValue = "";

        Transaction.wrap(function () {
            var Locale = require("dw/util/Locale");
            var OrderModel = require("*/cartridge/models/order");

            // Set email and phone
            if (req.currentCustomer.raw.authenticated
                && req.currentCustomer.raw.registered
            ) {
                billingAddress.setPhone(req.currentCustomer.raw.profile.phoneMobile);
                currentBasket.setCustomerEmail(req.currentCustomer.profile.email);
            } else {
                billingAddress.setPhone(billingData.phone.value);
                currentBasket.setCustomerEmail(billingData.mercadoPago.email.value);
            }

            // Create new Order model with email and phone populated
            var basketModel = new OrderModel(
                currentBasket,
                {
                    usingMultiShipping: req.session.privacyCache.get("usingMultiShipping"),
                    countryCode: Locale.getLocale(req.locale.id).country,
                    containerView: "basket"
                }
            );

            res.json({
                order: basketModel
            });
        });
    });

    return next();
});

module.exports = server.exports();
