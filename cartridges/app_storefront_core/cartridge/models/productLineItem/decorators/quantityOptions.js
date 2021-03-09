"use strict";

var ProductInventoryMgr = require("dw/catalog/ProductInventoryMgr");
var preferences = require("*/cartridge/config/preferences");
var productHelper = require("*/cartridge/scripts/helpers/productHelpers");
var DEFAULT_MAX_ORDER_QUANTITY = preferences.maxOrderQty || 10;

/**
 * get the min and max numbers to display in the quantity drop down.
 * @param {Object} productLineItem - a line item of the basket.
 * @param {number} quantity - number of items for this product
 * @returns {Object} The minOrderQuantity and maxOrderQuantity to display in the quantity drop down.
 */
function baseGetMinMaxQuantityOptions(productLineItem, quantity) {
    var availabilityModel = productHelper.getAvailabilityModel(productLineItem.product);

    if (!availabilityModel.inventoryRecord) {
        return {
            minOrderQuantity: 0,
            maxOrderQuantity: 0
        };
    }

    var availableToSell = availabilityModel.inventoryRecord.ATS.value;
    var perpetual       = availabilityModel.inventoryRecord.perpetual;
    var max;

    if (productLineItem.productInventoryListID) {
        var inventoryList = ProductInventoryMgr.getInventoryList(productLineItem.productInventoryListID);
        var inventoryRecord = inventoryList.getRecord(productLineItem.product.ID);
        availableToSell = inventoryRecord && inventoryRecord.ATS.value;
        perpetual       = inventoryRecord && inventoryRecord.perpetual;
    }

    if (perpetual) {
        max = Math.max(DEFAULT_MAX_ORDER_QUANTITY, quantity);
    } else {
        max = Math.max(Math.min(availableToSell, DEFAULT_MAX_ORDER_QUANTITY), quantity);
    }

    return {
        minOrderQuantity: productLineItem.product.minOrderQuantity.value || 1,
        maxOrderQuantity: max
    };
}

/**
 * get the min and max numbers to set as the minimum and maximum value to be in the quantity input.
 * @param {Object} productLineItem - a line item of the basket.
 * @param {number} quantity - number of items for this product
 * @returns {Object} The minOrderQuantity and maxOrderQuantity to set as the minimum and maximum value to be in the quantity input.
 */
function baseConstructor(object, productLineItem, quantity) {
    Object.defineProperty(object, "quantityOptions", {
        enumerable: true,
        value: baseGetMinMaxQuantityOptions(productLineItem, quantity)
    });
}

/**
 * get the min and max numbers to set as the minimum and maximum value to be in the quantity input.
 * @param {Object} productLineItem - a line item of the basket.
 * @param {number} quantity - number of items for this product
 * @returns {Object} The minOrderQuantity and maxOrderQuantity to set as the minimum and maximum value to be in the quantity input.
 */
function getMinMaxQuantityOptions(object, productLineItem, quantity) {
    baseConstructor.call(this, object, productLineItem, quantity);
    var inventoryRecord = productHelper.getAvailabilityModel(productLineItem.product).inventoryRecord;
    object.quantityOptions.maxOrderQuantity = inventoryRecord ? inventoryRecord.ATS.value : 0;
    return object;
}

module.exports = getMinMaxQuantityOptions;
