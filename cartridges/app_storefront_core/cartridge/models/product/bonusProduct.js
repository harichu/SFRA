"use strict";

var decorators = require("*/cartridge/models/product/decorators/index");
var productHelper = require("*/cartridge/scripts/helpers/productHelpers");

/**
 * Overriding model to make a correct call of the bonusUnitPrice decorator
 * and add the price decorator
 */
module.exports = function bonusProduct(product, apiProduct, options, duuid) {
    decorators.base(product, apiProduct, options.productType);
    decorators.images(product, apiProduct, { types: ["pdplarge", "small"], quantity: "all" });
    decorators.quantity(product, apiProduct, options.quantity);
    decorators.variationAttributes(product, options.variationModel, {
        attributes: "*",
        endPoint: "Variation"
    });
    decorators.attributes(product, apiProduct.attributeModel);
    decorators.availability(product, options.quantity, apiProduct.minOrderQuantity.value, productHelper.getAvailabilityModel(apiProduct));
    decorators.options(product, options.optionModel, options.variables, options.quantity);
    decorators.quantitySelector(product, apiProduct.stepQuantity.value, options.variables, options.options);
    decorators.readyToOrder(product, options.variationModel);
    decorators.bonusUnitPrice(product, apiProduct, duuid);
    decorators.price(product, apiProduct, options.promotions, false, options.options);
    return product;
};
