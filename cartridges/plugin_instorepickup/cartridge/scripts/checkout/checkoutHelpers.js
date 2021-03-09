"use strict";

var base = module.superModule;
var Logger      = require("dw/system/Logger");
var collections = require("*/cartridge/scripts/util/collections");

/**
 * Copies a raw address object to the basket billing address
 * @param {Object} address - an address-similar Object (firstName, ...)
 * @param {Object} basket - the current shopping basket
 */
function copyBillingAddressToBasket(address, basket) {
    var Transaction = require("dw/system/Transaction");
    var billingAddress = basket.billingAddress;
    // Only do copy when defaultShipment is not storepickup
    var storepickup = basket.defaultShipment.custom.shipmentType === "instore";
    if (!storepickup) {
        Transaction.wrap(function () {
            if (!billingAddress) {
                billingAddress = basket.createBillingAddress();
            }

            billingAddress.setFirstName(address.firstName);
            billingAddress.setLastName(address.lastName);
            billingAddress.setAddress1(address.address1);
            billingAddress.setAddress2(address.address2);
            billingAddress.setCity(address.city);
            billingAddress.setPostalCode(address.postalCode);
            billingAddress.setStateCode(address.stateCode);
            billingAddress.setCountryCode(address.countryCode.value);
            if (!billingAddress.phone) {
                billingAddress.setPhone(address.phone);
            }
        });
    }
}

/**
 * Loop through all shipments and make sure all not null
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket
 * @param {Boolean}               [isLogError]
 * @returns {boolean} - allValid
 */
function ensureValidShipments(lineItemContainer, isLogError) {
    var shipments = lineItemContainer.shipments;
    var isStoreAddress = true;
    var allValid = collections.every(shipments, function (shipment) {
        if (shipment) {
            var hasStoreID = shipment.custom && shipment.custom.fromStoreId;
            if (shipment.shippingMethod && shipment.shippingMethod.custom && shipment.shippingMethod.custom.storePickupEnabled && !hasStoreID) {
                isStoreAddress = false;
            }
            var address = shipment.shippingAddress;
            var result  = address && address.address1 && isStoreAddress;

            if (!result && isLogError) {
                Logger.getLogger("Checkout", "shipment").info("Invalid shipment: " + JSON.stringify({
                    shippingMethod  : shipment.shippingMethod.ID,
                    isPickup        : shipment.shippingMethod.custom.storePickupEnabled,
                    storeID         : hasStoreID,
                    shipmentAddress : address && address.address1,
                    isStoreAddress  : isStoreAddress
                }));
            }

            return result;
        }
        return false;
    });
    return allValid;
}

/**
 * Copies a CustomerAddress to a Shipment as its Shipping Address
 * @param {Object} whoTakesInfo - Info about who takes the products from store
 * @param {dw.order.Shipment} [shipmentOrNull] - The target shipment
 */
function setWhoTakes(whoTakesInfo, shipmentOrNull) {
    var BasketMgr = require("dw/order/BasketMgr");
    var Transaction = require("dw/system/Transaction");
    var currentBasket = BasketMgr.getCurrentBasket();
    var shipment = shipmentOrNull || currentBasket.defaultShipment;
    var shippingAddress = shipment.shippingAddress;

    Transaction.wrap(function () {
        if (shippingAddress === null) {
            shippingAddress = shipment.createShippingAddress();
        }
        shippingAddress.custom.whotakesRut = whoTakesInfo.rut;
        shippingAddress.custom.whotakesName = whoTakesInfo.name;
        shippingAddress.custom.whoTakesCedula = whoTakesInfo.cedula;
        shippingAddress.custom.whoTakesCelular = whoTakesInfo.celular;
    });
}

/**
 * Get list of departamentos and municipios from site pref
 * @param {Object} whoTakesInfo - Info about who takes the products from store
 * @returns {Object} - data
 */
function getDepartamentosAndMunicipios() {
    var Site = require("dw/system/Site");

    var isZoneCityMappingEnabled = Site.current.getCustomPreferenceValue("enableCityZoneMapping");

    var dmPref = null;
    var data   = {
        departamentos : [],
        municipios    : ""
    };

    if (isZoneCityMappingEnabled) {
        dmPref = JSON.parse(Site.current.getCustomPreferenceValue("departamentosMunicipios"));
        dmPref.States.forEach(function (departamento) {
            data.departamentos.push(departamento);
        });
        data.municipios = JSON.stringify(dmPref);
    } else {
        dmPref = JSON.parse(Site.current.getCustomPreferenceValue("simpleDepartamentosMunicipios"));
        dmPref.States.forEach(function (departamento) {
            data.departamentos.push(departamento);
        });
        data.municipios = JSON.stringify(dmPref);
    }

    return data;
}

/**
 * Send an email to notify the user that the order was failed
 * @param {obj} order - object that contains order information.
 */
function sendOrderFailedEmail(order, locale) {
    var OrderModel = require("*/cartridge/models/order");
    var emailHelpers = require("*/cartridge/scripts/helpers/emailHelpers");
    var Site = require("dw/system/Site");
    var Resource = require("dw/web/Resource");
    var Locale = require("dw/util/Locale");
    var template = "mail/orderFailed";

    var currentLocale = Locale.getLocale(locale);
    var orderModel = new OrderModel(order, { countryCode: currentLocale.country });

    var orderObject = {
        order: orderModel,
        standardProductLineItems: orderModel.items.items
    };

    var emailObj = {
        to: order.customerEmail,
        subject: Resource.msg("subject.order.failed.email", "order", null),
        from: Site.current.getCustomPreferenceValue("customerServiceEmail") || "no-reply@salesforce.com"
    };

    emailHelpers.sendEmail(emailObj, template, orderObject);
}

module.exports = {
    prepareShippingForm: base.prepareShippingForm,
    prepareBillingForm: base.prepareBillingForm,
    validateShippingForm: base.validateShippingForm,
    isShippingAddressInitialized: base.isShippingAddressInitialized,
    copyCustomerAddressToShipment: base.copyCustomerAddressToShipment,
    copyCustomerAddressToBilling: base.copyCustomerAddressToBilling,
    copyShippingAddressToShipment: base.copyShippingAddressToShipment,
    getFirstNonDefaultShipmentWithProductLineItems: base.getFirstNonDefaultShipmentWithProductLineItems,
    ensureValidShipments: ensureValidShipments,
    ensureNoEmptyShipments: base.ensureNoEmptyShipments,
    recalculateBasket: base.recalculateBasket,
    getProductLineItem: base.getProductLineItem,
    validateFields: base.validateFields,
    validateBillingForm: base.validateBillingForm,
    validateCreditCard: base.validateCreditCard,
    calculatePaymentTransaction: base.calculatePaymentTransaction,
    validatePayment: base.validatePayment,
    createOrder: base.createOrder,
    handlePayments: base.handlePayments,
    sendConfirmationEmail: base.sendConfirmationEmail,
    placeOrder: base.placeOrder,
    savePaymentInstrumentToWallet: base.savePaymentInstrumentToWallet,
    getRenderedPaymentInstruments: base.getRenderedPaymentInstruments,
    copyBillingAddressToBasket: copyBillingAddressToBasket,
    setGift: base.setGift,
    setWhoTakes: setWhoTakes,
    getDepartamentosAndMunicipios: getDepartamentosAndMunicipios,
    sendOrderFailedEmail: sendOrderFailedEmail

};
