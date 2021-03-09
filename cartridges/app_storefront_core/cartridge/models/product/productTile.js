"use strict";

var base = module.superModule;
var decorators = require("*/cartridge/models/product/decorators/index");
var productHelper = require("*/cartridge/scripts/helpers/productHelpers");
var inStorePickup = require("*/cartridge/models/product/decorators/availableForInStorePickup");

/**
 * Decorate product with product tile information
 * @param {Object} product - Product Model to be decorated
 * @param {dw.catalog.Product} apiProduct - Product information returned by the script API
 * @param {string} productType - Product type information
 *
 * @returns {Object} - Decorated product model
 */
function productTile(product, apiProduct, productType) {
    var tile = base.call(this, product, apiProduct, productType);
    var params = {
        pid : tile.id,
        ratings : false,
        swatches : true
    };
    var options = productHelper.getConfig(apiProduct, params);

    decorators.quantity(tile, apiProduct, options.quantity);
    decorators.availability(tile, options.quantity, apiProduct.minOrderQuantity.value, productHelper.getAvailabilityModel(apiProduct));

    var tempObj = {};
    for (var prop in tile) {
        if (prop != "images" && prop != "variationAttributes" && prop != "price") {
            tempObj[prop] = tile[prop];
        }
    }
    tile = tempObj;
    tile.variationAttributes = productHelper.organizeVariationAttributes(tile.selectedQuantity, options.variationModel);
    decorators.images(tile, apiProduct, { types: ["medium"], quantity: "single" });

    decorators.price(tile, apiProduct, options.promotions, false, options.optionModel);

    decorators.quantitySelector(tile, apiProduct.stepQuantity.value, options.variables, options.options);
    decorators.promotions(tile, options.promotions);
    decorators.custom(tile, apiProduct);
    decorators.readyToOrder(tile, options.variationModel);
    decorators.online(tile, apiProduct);
    inStorePickup(tile, apiProduct, null);

    return tile;
}

module.exports = productTile;
