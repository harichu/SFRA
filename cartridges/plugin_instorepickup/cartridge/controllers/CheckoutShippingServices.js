"use strict";

var server = require("server");
var Resource = require("dw/web/Resource");
var validation = require("*/cartridge/scripts/helpers/validationHelpers");

server.extend(module.superModule);

/**
 * Validates form
 * @param {String} form form to be validated
 * @returns {Object|undefined} the object with fields with errors
 */
function validateFields(form, fieldsToValidate) {
    var fields = {};
    if (form["select-who-takes"] != "me") {
        fieldsToValidate = fieldsToValidate || {};
        if (fieldsToValidate.fullName && !validation.validateFullName(form.whoTakesName)) {
            fields.whoTakesName = Resource.msg("checkout.login.name.error", "checkout", null);
        }
        if (fieldsToValidate.rut && !validation.validateRut(form.whoTakesRut)) {
            fields.whoTakesRut = Resource.msg("checkout.login.rut.error", "checkout", null);
        }
        if (fieldsToValidate.cedula && !validation.validateCE(form.whoTakesCedula)) {
            fields.whoTakesCedula = Resource.msg("checkout.login.cedula.error", "checkout", null);
        }
    }
    if (Object.keys(fields).length) {
        return fields;
    } else {
        return undefined;
    }
}

server.append("SubmitShipping", function (req, res, next) {
    var BasketMgr = require("dw/order/BasketMgr");
    var Resource = require("dw/web/Resource");
    var Transaction = require("dw/system/Transaction");
    var ShippingHelper = require("*/cartridge/scripts/checkout/shippingHelpers");

    var currentBasket = BasketMgr.getCurrentBasket();
    var shipmentUUID = req.querystring.shipmentUUID || req.form.shipmentUUID;
    var shipment;

    if (shipmentUUID) {
        shipment = ShippingHelper.getShipmentByUUID(currentBasket, shipmentUUID);
    } else {
        shipment = currentBasket.defaultShipment;
    }

    var oldHandler = this.listeners("route:BeforeComplete");
    this.off("route:BeforeComplete");

    var shippingMethodID = req.form.dwfrm_shipping_shippingAddress_shippingMethodID;
    Transaction.wrap(function () {
        ShippingHelper.selectShippingMethod(shipment, shippingMethodID);
    });

    if (shipment.shippingMethod.custom.storePickupEnabled) {
        if (!req.form.storeId) {
            res.setStatusCode(500);
            res.json({
                error: true,
                errorMessage: Resource.msg("error.no.store.selected", "storeLocator", null)
            });
        } else {
            var viewData = res.getViewData();
            delete viewData.fieldErrors;
            var fieldErrors = validateFields(req.form, viewData.fieldsToValidate);
            if (fieldErrors) {
                this.off("route:BeforeComplete");
                res.setStatusCode(500);
                res.json({
                    error: true,
                    fields: fieldErrors
                });
                return next();
            }
            viewData.error = false;
            viewData.shipmentUUID = req.form.shipmentUUID;
            viewData.storeId = req.form.storeId;
            viewData.shippingMethod = shipment.shippingMethodID;
            viewData.whoTakesName = req.form.whoTakesName || "";
            viewData.whoTakesRut = req.form.whoTakesRut || "";
            viewData.whoTakesCedula = req.form.whoTakesCedula || "";
            viewData.whoTakesCelular = req.form.whoTakesCelular || "";
            res.setViewData(viewData);

            this.off("route:BeforeComplete");
            /* eslint-disable no-shadow */
            this.on("route:BeforeComplete", function (req, res) {
                var StoreMgr = require("dw/catalog/StoreMgr");
                var Locale = require("dw/util/Locale");
                var OrderModel = require("*/cartridge/models/order");
                var AccountModel = require("*/cartridge/models/account");
                var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");

                var viewData = res.getViewData();

                var storeId = viewData.storeId;
                var store = StoreMgr.getStore(storeId);
                var viewDataShipmentUUID = viewData.shipmentUUID;
                var viewDataShipment = viewDataShipmentUUID ? ShippingHelper.getShipmentByUUID(currentBasket, viewDataShipmentUUID) : currentBasket.defaultShipment;

                if (storeId) {
                    ShippingHelper.markShipmentForPickup(viewDataShipment, storeId);

                    Transaction.wrap(function () {
                        var storeAddress = {
                            address: {
                                firstName: req.form.dwfrm_shipping_shippingAddress_addressFields_firstName,
                                lastName: req.form.dwfrm_shipping_shippingAddress_addressFields_lastName,
                                address1: store.address1,
                                address2: store.address2,
                                city: store.city,
                                stateCode: store.stateCode,
                                postalCode: store.postalCode,
                                countryCode: store.countryCode.value,
                                phone: store.phone
                            },
                            shippingMethod: viewData.shippingMethod
                        };
                        COHelpers.copyShippingAddressToShipment(storeAddress, viewDataShipment);

                        var whoTakes = {
                            name: viewData.whoTakesName,
                            rut: viewData.whoTakesRut,
                            cedula: viewData.whoTakesCedula,
                            celular: viewData.whoTakesCelular
                        };
                        COHelpers.setWhoTakes(whoTakes, viewDataShipment);

                        COHelpers.setGift(viewDataShipment, false, null);
                    });
                }

                COHelpers.recalculateBasket(currentBasket);

                var usingMultiShipping = req.session.privacyCache.get("usingMultiShipping");
                if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
                    req.session.privacyCache.set("usingMultiShipping", false);
                    usingMultiShipping = false;
                }

                var currentLocale = Locale.getLocale(req.locale.id);
                var basketModel = new OrderModel(
                    currentBasket,
                    {
                        usingMultiShipping: usingMultiShipping,
                        shippable: true,
                        countryCode: currentLocale.country,
                        containerView: "basket"
                    }
                );

                res.json({
                    customer: new AccountModel(req.currentCustomer),
                    order: basketModel,
                    form: server.forms.getForm("shipping")
                });
            });
            /* eslint-enable no-shadow */
        }
    }

    this.on("route:BeforeComplete", (function (req1, res1) {
        if (!empty(oldHandler[0])) {
            for (var i = 0; i < oldHandler.length; i++) {
                oldHandler[i].call(this, req1, res1);
            }
        }
    }).bind(this));

    next();
});

server.append("ToggleMultiShip", server.middleware.https, function (req, res, next) {
    var BasketMgr = require("dw/order/BasketMgr");
    var collections = require("*/cartridge/scripts/util/collections");
    var ShippingHelper = require("*/cartridge/scripts/checkout/shippingHelpers");

    var viewData = res.getViewData();
    var currentBasket = BasketMgr.getCurrentBasket();

    var order = viewData.order;

    collections.forEach(currentBasket.shipments, function (shipment) {
        ShippingHelper.markShipmentForShipping(shipment);
    });

    order.shipping.forEach(function (shipment) {
        if (shipment.custom && shipment.custom.fromStoreId) {
            delete shipment.custom.fromStoreId;
        }
        shipment.productLineItems.items.forEach(function (lineItem) {
            if (lineItem.custom && lineItem.custom.fromStoreId) {
                delete lineItem.custom.fromStoreId;
            }
        });
    });

    res.setViewData({
        customer: viewData.customer,
        order: order
    });

    next();
});

module.exports = server.exports();
