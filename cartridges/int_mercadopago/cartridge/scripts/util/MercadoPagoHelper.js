"use strict";

var Site = require("dw/system/Site");
var Resource = require("dw/web/Resource");

/** @constructs MercadoPagoHelper */
function MercadoPagoHelper() {}

/**
 * @description General wrapper for JSON.parse(...) with error catching
 * @param {String} stringified - the string object representation to parse
 * @param {Object} defaultObject
 * @returns {Object}
 */
MercadoPagoHelper.prototype.parseJson = function (stringified, defaultObject) {
    var Logger = require("dw/system/Logger");
    var parsed = {};

    if (empty(stringified)) return defaultObject;

    try {
        parsed = JSON.parse(stringified);
    } catch (e) {
        Logger.debug("MercadoPagoHelper.js: JSON object parse failed");
        return defaultObject;
    }

    return parsed;
};

/**
 * @description Get grouped payment methods
 * @returns {Object} groupedPaymentMethods
 */
MercadoPagoHelper.prototype.getGroupedPaymentMethods = function () {
    var MercadoPago = require("*/cartridge/scripts/library/libMercadoPago");
    var MP = new MercadoPago();
    var availablePaymentMethods = MP.getPaymentMethods();
    var disabledPaymentMethods = Site.current.getCustomPreferenceValue("mercadoPagoDisabledPaymentMethods");

    if (!empty(disabledPaymentMethods)) {
        availablePaymentMethods = availablePaymentMethods.filter(function (item) {
            return disabledPaymentMethods.indexOf(item.id) === -1;
        });
    }

    var groupedPaymentMethods = MP.groupPaymentMethods(availablePaymentMethods);

    return groupedPaymentMethods;
};

/**
 * @description Get available payment methods
 * @returns {Object} availablePaymentMethods
 */
MercadoPagoHelper.prototype.getAvailablePaymentMethods = function () {
    var MercadoPago = require("*/cartridge/scripts/library/libMercadoPago");
    var MP = new MercadoPago();

    return MP.getPaymentMethods();
};

/**
 * @description Get available PSE financial institutions
 * @returns {Array<Object>} pseFinancialInstitutions
 */
MercadoPagoHelper.prototype.getPseFinancialInstitutions = function (paymentMethods) {
    var psePaymentMethodID = "pse";
    var pseFinancialInstitutions = [];

    var psePaymentMethod = paymentMethods.filter(function (method) { return method.id == psePaymentMethodID; });
    if (psePaymentMethod.length && psePaymentMethod[0]) {
        pseFinancialInstitutions = psePaymentMethod[0].financial_institutions.map(function (item) {
            return {
                "name": item.description,
                "id": item.id
            };
        });
    }

    return pseFinancialInstitutions;
};

/**
 * @description Get custom preferences
 * @returns {Object}
 */
MercadoPagoHelper.prototype.getPreferences = function () {
    var currentSite = Site.getCurrent();

    return {
        publicKey: currentSite.getCustomPreferenceValue("mercadoPagoPublicKey"),
        enableInstallments: currentSite.getCustomPreferenceValue("mercadoPagoEnableInstallments"),
        enableDocTypeNumber: currentSite.getCustomPreferenceValue("mercadoPagoEnableDocTypeNumber")
    };
};

/**
 * @description Get error messages
 * @returns {Object}
 */
MercadoPagoHelper.prototype.getErrorMessages = function () {
    return {
        "205": Resource.msg("error.205", "mercadoPago", null),
        "208": Resource.msg("error.208", "mercadoPago", null),
        "209": Resource.msg("error.209", "mercadoPago", null),
        "212": Resource.msg("error.212", "mercadoPago", null),
        "213": Resource.msg("error.213", "mercadoPago", null),
        "214": Resource.msg("error.214", "mercadoPago", null),
        "220": Resource.msg("error.220", "mercadoPago", null),
        "221": Resource.msg("error.221", "mercadoPago", null),
        "224": Resource.msg("error.224", "mercadoPago", null),
        "E301": Resource.msg("error.E301", "mercadoPago", null),
        "E302": Resource.msg("error.E302", "mercadoPago", null),
        "316": Resource.msg("error.316", "mercadoPago", null),
        "322": Resource.msg("error.322", "mercadoPago", null),
        "323": Resource.msg("error.323", "mercadoPago", null),
        "324": Resource.msg("error.324", "mercadoPago", null),
        "325": Resource.msg("error.325", "mercadoPago", null),
        "326": Resource.msg("error.326", "mercadoPago", null),
        "E203": Resource.msg("error.E203", "mercadoPago", null),
        "default": Resource.msg("error.default", "mercadoPago", null),
        "email": Resource.msg("error.email", "mercadoPago", null),
        "phone": Resource.msg("error.phone", "mercadoPago", null),
        "installments": Resource.msg("error.installments", "mercadoPago", null),
        "issuer": Resource.msg("error.issuer", "mercadoPago", null),
    };
};

/**
 * @description Get resource messages
 * @returns {Object}
 */
MercadoPagoHelper.prototype.getResourceMessages = function () {
    return {
        defaultIssuer: Resource.msg("select.default.issuer", "forms", null),
        defaultInstallments: Resource.msg("select.default.installments", "forms", null),
        docNumberLabel: Resource.msg("label.input.payment.docNumber", "forms", null),
        docNumberLabelDNI: Resource.msg("label.input.payment.docNumber.DNI", "forms", null),
        docNumberLabelOther: Resource.msg("label.input.payment.docNumber.other", "forms", null),
        docNumberTooltip: Resource.msg("tooltip.docNumber", "creditCard", null)
    };
};

/**
 * @description Get customer cards
 * @param {Object} currentCustomer
 * @returns {Array}
 */
MercadoPagoHelper.prototype.getCustomerCards = function (currentCustomer) {
    var MercadoPago = require("*/cartridge/scripts/library/libMercadoPago");
    var MP = new MercadoPago();

    return MP.getCustomerCards(currentCustomer);
};

/**
 * Saves a credit card on Mercado Pago side based on its token
 * @param {String} customerEmail the customer email on Mercadopago side
 * @param {String} cardToken the card token generated by MP SDK
 */
MercadoPagoHelper.prototype.createCustomerCard = function (customerEmail, cardToken) {
    var MercadoPago = require("*/cartridge/scripts/library/libMercadoPago");
    var array = require("*/cartridge/scripts/util/array");
    var MP = new MercadoPago();
    var customerSearch = MP.searchCustomer({email: customerEmail});
    var foundCustomer = array.find(customerSearch.results, function (customer) {
        return customer.email === customerEmail;
    });
    if (empty(foundCustomer)) {
        foundCustomer = MP.createCustomer({email: customerEmail});
    }
    return MP.createCustomerCard(foundCustomer.id, cardToken);
};

/**
 * @description Deletes a customer credit card from the MP API
 * @param {String} customerID the customer ID within MP API
 * @param {String} cardID the card id within MP API
 */
MercadoPagoHelper.prototype.deleteCustomerCard = function (customerID, cardID) {
    var MercadoPago = require("*/cartridge/scripts/library/libMercadoPago");
    var MP = new MercadoPago();

    return MP.deleteCustomerCard(customerID, cardID);
};

/**
 * @description Gets customer cards from Mercado Pago with proper format to be shown in storefront
 * @param {Object} currentCustomer
 * @returns {Array}
 */
MercadoPagoHelper.prototype.getAccountCreditCards = function (currentCustomer) {
    var formattedCreditCards = null;
    if (!empty(currentCustomer.raw.profile)) {
        var cards = this.getCustomerCards(currentCustomer) || [];
        formattedCreditCards = cards.map(function (card) {
            return {
                creditCardHolder: card.cardholder.name,
                lastFourDigits: card.last_four_digits,
                maskedCreditCardNumber: Resource.msgf("payment.card.masked", "mercadoPagoPreferences", null, card.last_four_digits),
                creditCardType: card.issuer.name,
                creditCardExpirationMonth: card.expiration_month,
                creditCardExpirationYear: card.expiration_year,
                customerID: card.customer_id,
                cardID: card.id
            };
        });
    }
    return formattedCreditCards;
};

/**
 * @description Get configuration resources
 * @returns {Object}
 */
MercadoPagoHelper.prototype.getConfiguration = function () {
    return {
        paymentMethodId: Resource.msg("payment.method.id", "mercadoPagoPreferences", null),
        defaultCardType: Resource.msg("default.card.type", "mercadoPagoPreferences", null),
        otherPaymentMethod:  Resource.msg("other.payment.method", "mercadoPagoPreferences", null),
        docTypeDNI:  Resource.msg("DNI.docType", "mercadoPagoPreferences", null),
        defaultIssuer:  Resource.msg("default.issuer", "mercadoPagoPreferences", null)
    };
};

/**
 * checks if license is valid
 * @returns {Boolean}
 */
MercadoPagoHelper.prototype.isLicenseValid = function () {
    const OSFLicenseManager = require("*/cartridge/scripts/OSFLicenseManager");
    try {
        return OSFLicenseManager.getLicenseStatus("DWIMP").isValid;
    } catch (error) {
        return false;
    }
};

/**
 * @description Check for mercado pago configuration and licensing
 * @returns {Boolean} Wheter the cartridge can be used or not
 */
MercadoPagoHelper.prototype.isMercadoPagoEnabled = function () {
    var Site      = require("dw/system/Site");
    let mpEnabled = Site.getCurrent().getCustomPreferenceValue("mercadoPagoEnableMercadoPago");

    if (mpEnabled && this.isLicenseValid()) {
        return true;
    } else {
        return false;
    }
};

module.exports = new MercadoPagoHelper();
