"use strict";

var base = module.superModule;
var decorators = require("*/cartridge/models/product/decorators/index");
var productHelper = require("*/cartridge/scripts/helpers/productHelpers");

/**
 * Decorate product with product fullProduct information
 * @returns {Object} - Decorated product model
 */
function fullProduct(product, apiProduct, options) {
    var fullProductItem = base.call(this, product, apiProduct, options);

    /*TODO: The "delete" operator is not working here because this is an object from
      the underlying Java layer, not a digital script object.
      Logic: We must delete property "variationAttributes" to be able to
      call the 'decorators.variationAttributes' again.*/
    var tempObj = {};
    for (var prop in fullProductItem) {
        if (prop != "images" && prop != "variationAttributes") {
            tempObj[prop] = fullProductItem[prop];
        }
    }
    fullProductItem = tempObj;
    if (options.variationModel) {
        decorators.images(fullProductItem, options.variationModel, { types: ["pdplarge", "medium", "small"], quantity: "all" });
    } else {
        decorators.images(fullProductItem, apiProduct, { types: ["pdplarge", "medium", "small"], quantity: "all" });
    }

    fullProductItem.variationAttributes = productHelper.organizeVariationAttributes(fullProductItem.selectedQuantity, options.variationModel, options.rawParams);
    fullProductItem.master = apiProduct.variant ? apiProduct.getMasterProduct() : null;
    decorators.custom(fullProductItem, apiProduct);
    decorators.availability(fullProductItem, options.quantity, apiProduct.minOrderQuantity.value, productHelper.getAvailabilityModel(apiProduct));
    return fullProductItem;
}

module.exports = fullProduct;
