"use strict";

var server = require("server");
server.extend(module.superModule);

/**
 * Populate viewData with additional data specific for MercadoPago
 */
server.append("Begin", function (req, res, next) {
    var Resource = require("dw/web/Resource");

    // Guard clause
    var profile = req.currentCustomer.raw.profile;
    var MercadoPagoHelper    = require("*/cartridge/scripts/util/MercadoPagoHelper");
    var isMercadoPagoEnabled = MercadoPagoHelper.isMercadoPagoEnabled();
    if (!isMercadoPagoEnabled) {
        return next();
    }

    var BasketMgr = require("dw/order/BasketMgr");

    var currentBasket = BasketMgr.getCurrentBasket();

    // Remove name attribute for card number and security code fields
    var form = server.forms.getForm("billing").mercadoPagoCreditCard;
    Object.keys(form).forEach(function (key) {
        if (key !== "cardNumber" && key !== "securityCode") {
            return;
        }

        Object.defineProperty(form[key], "attributesWithoutName", {
            get: function () {
                return form[key].attributes.replace(/(name="){1}(\w)+("){1}(\s){1}/, "");
            }
        });
    });
    
    var viewData = res.getViewData();
    var profileForm = server.forms.getForm("profile");
    if (!empty(profile) && req.currentCustomer.raw.authenticated) {
        form.docNumber.value = profile.custom.ccDocument || profile.custom.ceDocument || profile.custom.difarmaRunRutNit;
        viewData.customerHasCC        = !empty(profile.custom.ccDocument);
        viewData.customerHasCE        = !empty(profile.custom.ceDocument);
        viewData.customerHasPasaporte = !empty(profile.custom.passport);
        viewData.customerHasRut       = !empty(profile.custom.difarmaRunRutNit);
        form.pseDocNumber.value = form.docNumber.value || profile.custom.passport;
    } else {
        var cedula = !empty(profileForm) ? profileForm.customer.cedula.value : "";
        form.docNumber.value = cedula;
        var docType = profileForm.customer.document.value;
        viewData.customerHasCC        = docType === Resource.msg("label.input.document.type.cc", "forms", null);
        viewData.customerHasCE        = docType === Resource.msg("label.input.document.type.ce", "forms", null);
        viewData.customerHasPasaporte = docType === Resource.msg("label.input.document.type.passport", "forms", null);
        viewData.customerHasRut       = docType === Resource.msg("label.input.document.type.rut", "forms", null);
        form.pseDocNumber.value = cedula;
    }
    if (req.currentCustomer.raw.authenticated && !viewData.order.orderEmail) {
        viewData.order.orderEmail = req.currentCustomer.profile.email;
    }

    var mpAvailablePaymentMethods = MercadoPagoHelper.getAvailablePaymentMethods();

    viewData.mercadoPago = {
        enable: isMercadoPagoEnabled,
        form: form,
        groupedPaymentMethods: MercadoPagoHelper.getGroupedPaymentMethods(),
        availablePaymentMethods: mpAvailablePaymentMethods,
        pseFinancialInstitutions: MercadoPagoHelper.getPseFinancialInstitutions(mpAvailablePaymentMethods),
        customerCards: req.currentCustomer.raw.authenticated && req.currentCustomer.raw.registered ? MercadoPagoHelper.getCustomerCards(req.currentCustomer) : [],
        preferences: MercadoPagoHelper.getPreferences(),
        errorMessages: MercadoPagoHelper.getErrorMessages(),
        resourceMessages: MercadoPagoHelper.getResourceMessages(),
        configuration: MercadoPagoHelper.getConfiguration(),
        orderTotal: currentBasket.totalGrossPrice.value
    };

    res.setViewData(viewData);
    return next();
});

module.exports = server.exports();
