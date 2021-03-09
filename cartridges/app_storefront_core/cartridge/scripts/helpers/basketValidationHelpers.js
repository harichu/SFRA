"use strict";

var collections         = require("*/cartridge/scripts/util/collections");
var ProductInventoryMgr = require("dw/catalog/ProductInventoryMgr");
var COHelpers           = require("*/cartridge/scripts/checkout/checkoutHelpers");
var StoreMgr            = require("dw/catalog/StoreMgr");
var productHelper       = require("*/cartridge/scripts/helpers/productHelpers");
var LoggerUtils         = require("*/cartridge/scripts/utils/LoggerUtils");

var base = module.superModule;
/**
 * validates that the product line items exist, are online, and have available inventory.
 * @param {dw.order.Basket} basket - The current user's basket
 * @returns {Object} an error object
 */
function validateProducts(basket) {
    var result = {
        error: false,
        hasInventory: true
    };
    if (!basket) {
        LoggerUtils.basketValidationError("No basket available.");
        return {
            error: true,
            hasInventory: false
        };
    }
    var productLineItems = basket.productLineItems;
    var isBasketEmpty    = true;

    collections.forEach(productLineItems, function (item) {
        isBasketEmpty = false;
        if (item.product === null || !item.product.online) {
            result.error = true;
            LoggerUtils.basketValidationError("Product line item has no corresponding product: " + item.productID + ".");
            return;
        }

        if (Object.hasOwnProperty.call(item.custom, "fromStoreId")
            && item.custom.fromStoreId) {
            var store = StoreMgr.getStore(item.custom.fromStoreId);
            var storeInventory = ProductInventoryMgr.getInventoryList(store.custom.inventoryListId);

            result.hasInventory = result.hasInventory
                && storeInventory 
                && (storeInventory.getRecord(item.productID)
                && storeInventory.getRecord(item.productID).ATS.value >= item.quantityValue);

            if (!result.hasInventory) {
                LoggerUtils.basketValidationError("Product not available.\n" + 
                    "Store ID: "           + item.custom.fromStoreId + "\n" +
                    "Inventory ID: "       + storeInventory.ID + "\n" +
                    "Product ID: "         + item.productID + "\n" +
                    "Available Quantity: " + (storeInventory ? storeInventory.getRecord(item.productID).ATS.value : "-") + "\n" +
                    "Requested quantity: " + item.quantityValue
                );
            }
        } else {
            var availabilityLevels = productHelper.getAvailabilityModel(item.product)
                .getAvailabilityLevels(item.quantityValue);
            result.hasInventory = result.hasInventory
                && (availabilityLevels.notAvailable.value === 0);
        }
    });

    if (isBasketEmpty) {
        LoggerUtils.basketValidationError("Basket is empty.");
        result.error = true;
    }
    return result;
}

module.exports = {
    validateProducts: validateProducts,
    validateCoupons: base.validateCoupons,
    validateShipments: COHelpers.ensureValidShipments
};
