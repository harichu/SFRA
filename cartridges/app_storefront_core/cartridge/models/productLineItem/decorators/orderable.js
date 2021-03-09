"use strict";

var productHelper = require("*/cartridge/scripts/helpers/productHelpers");

module.exports = function (object, product, quantity) {
    Object.defineProperty(object, "isOrderable", {
        enumerable: true,
        value: productHelper.getAvailabilityModel(product).isOrderable(quantity)
    });
};
