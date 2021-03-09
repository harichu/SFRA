"use strict";

var Resource            = require("dw/web/Resource");
var validationHelpers   = require("*/cartridge/scripts/helpers/basketValidationHelpers");
var LoggerUtils         = require("*/cartridge/scripts/utils/LoggerUtils");

/**
 * validates the current users basket
 * @param {dw.order.Basket} basket - The current user's basket
 * @param {boolean} validateTax - boolean that determines whether or not to validate taxes
 * @returns {Object} an error object
 */
function validateOrder(basket, validateTax) {
    var result = { error: false, message: null };

    if (!basket) {
        result.error = true;
        result.message = Resource.msg("error.cart.expired", "cart", null);
    } else {
        var productExistence = validationHelpers.validateProducts(basket);
        var validCoupons = validationHelpers.validateCoupons(basket);
        var validShipments = validationHelpers.validateShipments(basket, true);
        var totalTax = true;

        if (validateTax) {
            totalTax = basket.totalTax.available;
        }

        if (productExistence.error || !productExistence.hasInventory) {
            LoggerUtils.basketValidationError("Basket has issues with products.");
            result.error = true;
            result.message = Resource.msg("error.cart.or.checkout.error", "cart", null);
        } else if (validCoupons.error) {
            LoggerUtils.basketValidationError("Basket has invalid coupons.");
            result.error = true;
            result.message = Resource.msg("error.invalid.coupon", "cart", null);
        } else if (basket.productLineItems.getLength() === 0) {
            LoggerUtils.basketValidationError("Basket has no product line items.");
            result.error = true;
        } else if (!basket.merchandizeTotalPrice.available) { //NOSONAR
            LoggerUtils.basketValidationError("Basket merchandized total price is not available.");
            result.error = true; //NOSONAR
            result.message = Resource.msg("error.cart.or.checkout.error", "cart", null); //NOSONAR
        } else if (!totalTax) { // NOSONAR
            LoggerUtils.basketValidationError("Basket has no total tax.");
            result.error = true; // NOSONAR
            result.message = Resource.msg("error.invalid.tax", "cart", null); // NOSONAR
        } else if (!validShipments) {
            result.error = true;
            result.message = Resource.msg("error.card.invalid.shipments", "cart", null);
        }
    }

    return result;
}

exports.validateOrder = validateOrder;
