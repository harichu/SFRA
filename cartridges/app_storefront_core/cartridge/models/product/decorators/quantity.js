"use strict";

var preferences = require("*/cartridge/config/preferences");
var productHelper = require("*/cartridge/scripts/helpers/productHelpers");
var DEFAULT_MAX_ORDER_QUANTITY = preferences.maxOrderQty || 10;

module.exports = function (object, product, quantity) {
    var availabilityModel = productHelper.getAvailabilityModel(object.id); 
    var productMaxOrder = availabilityModel.inventoryRecord && availabilityModel.inventoryRecord.allocation.value;
    if (productMaxOrder || productMaxOrder === 0) {
        productMaxOrder = Math.min(productMaxOrder, DEFAULT_MAX_ORDER_QUANTITY);
    }
    Object.defineProperty(object, "selectedQuantity", {
        enumerable: true,
        value: parseInt(quantity, 10) || (product && product.minOrderQuantity ? product.minOrderQuantity.value : 1)
    });
    Object.defineProperty(object, "minOrderQuantity", {
        enumerable: true,
        value: product && product.minOrderQuantity ? product.minOrderQuantity.value : 1
    });
    Object.defineProperty(object, "maxOrderQuantity", {
        enumerable: true,
        value: productMaxOrder
    });
};
