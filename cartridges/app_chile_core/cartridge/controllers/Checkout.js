"use strict";
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
var server = require("server");
var validationHelpers = require("*/cartridge/scripts/helpers/validationHelpers"); // eslint-disable-line no-unused-vars
var Resource = require("dw/web/Resource");
var BasketMgr = require("dw/order/BasketMgr");
var Transaction = require("dw/system/Transaction");
var URLUtils = require("dw/web/URLUtils");

server.extend(module.superModule);

function validateGuestInfo(form) {
    var errors = {};

    if (!validationHelpers.validateRut(form.rut)) {
        errors.rut = Resource.msg("error.rut.invalid", "forms", null);
    }

    if (!form.firstName || !form.lastName) {
        errors.name = Resource.msg("error.missing", "forms", null);
    }
    if (!form.email) {
        errors.email = Resource.msg("error.missing", "forms", null);
    }
    if (!form.phone) {
        errors.phone = Resource.msg("error.missing", "forms", null);
    }

    if (Object.keys(errors).length) {
        return errors;
    } else {
        return undefined;
    }
}

server.replace("GuestInfo",
    function (req, res, next) {
        var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");

        var currentBasket = BasketMgr.getCurrentBasket();
        var form = req.form;
        var profileForm = server.forms.getForm("profile");
        var shipment = currentBasket.defaultShipment;
        var shippingAddress = shipment.shippingAddress;
        var errors = validateGuestInfo(form);
        if (errors) {
            res.json({
                success: false,
                fields: errors
            });
            return next();
        }

        LoyaltyUtils.checkAndSetGuestLoyaltyMember(form.rut);
        LoyaltyUtils.checkAndSetSpecificCustomerGroup(form.rut);

        Transaction.wrap(function () {
            profileForm.customer.firstname.value = form.firstName;
            profileForm.customer.lastname.value = form.lastName;
            profileForm.customer.email.value = form.email;
            profileForm.customer.phone.value = form.phone;
            profileForm.customer.document.value = Resource.msg("label.input.document.type.rut", "forms", null);
            profileForm.customer.cedula.value = form.rut;
            currentBasket.setCustomerEmail(form.email);
            currentBasket.setCustomerName(form.firstName + " " + form.lastName);
            if (shippingAddress === null) {
                shippingAddress = shipment.createShippingAddress();
            }

            shippingAddress.setFirstName(form.firstName);
            shippingAddress.setLastName(form.lastName);
            shippingAddress.setPhone(form.phone);
        });
        res.json({
            success: true,
            redirectURL: URLUtils.url("Checkout-Begin").relative().toString()
        });

        return next();
    }
);

module.exports = server.exports();
