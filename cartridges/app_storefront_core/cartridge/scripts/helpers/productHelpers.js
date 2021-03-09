"use strict";

var base = module.superModule;
var Resource = require("dw/web/Resource");
var collections = require("*/cartridge/scripts/util/collections");
var ProductMgr = require("dw/catalog/ProductMgr");
var storeHelpers = require("*/cartridge/scripts/helpers/storeHelpers");

/**
 * Creates the breadcrumbs object
 * @param {string} cgid - category ID from navigation and search
 * @param {string} pid - product ID
 * @param {Array} breadcrumbs - array of breadcrumbs object
 * @returns {Array} an array of breadcrumb objects
 */
function getAllBreadcrumbs(cgid, pid, breadcrumbs) {
    var URLUtils = require("dw/web/URLUtils");
    var CatalogMgr = require("dw/catalog/CatalogMgr");

    var category;
    var product;
    if (pid) {
        product = ProductMgr.getProduct(pid);
        category = product.variant
            ? product.masterProduct.primaryCategory
            : product.primaryCategory;
    } else if (cgid) {
        category = CatalogMgr.getCategory(cgid);
    }

    if (category) {
        if (product) {
            breadcrumbs.push({
                htmlValue: product.name.replace(/ .*/, ""),
                url: ""
            });
        }
        breadcrumbs.push({
            htmlValue: category.displayName,
            url: URLUtils.url("Search-Show", "cgid", category.ID)
        });

        if (category.parent && category.parent.ID !== "root") {
            return getAllBreadcrumbs(category.parent.ID, null, breadcrumbs);
        } else {
            breadcrumbs.push({
                htmlValue: Resource.msg("global.home", "common", null),
                url: URLUtils.url("Home-Show")
            });
        }
    }

    return breadcrumbs;
}

/**
 * Renders the Product Details Page
 * @param {Object} querystring - query string parameters
 * @param {Object} reqPageMetaData - request pageMetaData object
 * @returns {Object} contain information needed to render the product page
 */
var showProductPageBase = base.showProductPage;
function showProductPage(querystring, reqPageMetaData) {
    var productPage = showProductPageBase.call(this, querystring, reqPageMetaData);
    productPage.breadcrumbs = getAllBreadcrumbs(null, productPage.product.id, []).reverse();

    return productPage;
}

/**
 * Organize all variation attributes from the product to be more easily to manipulate later on.
 * @param {Object} variationModel variationModel from the Tile Product.
 * @return {Object} an Object containing all variation attributes organized.
 */
function organizeVariationAttributes(quatity, variationModel, params) {
    var decorators = require("*/cartridge/models/product/decorators/index");
    var tempObj = {selectedQuantity: quatity};

    decorators.variationAttributes(tempObj, variationModel, {
        attributes: "*",
        endPoint: "Variation",
        selectedOptionsQueryParams: params
    });

    if (tempObj.variationAttributes != null) {
        var variationAttributes = tempObj.variationAttributes;
        var baseAttributes = [];
        var customAttributes = [];
        var colorAttr = null;
        for (var i = 0; i < variationAttributes.length; i++) {
            var attribute = variationAttributes[i];
            if (attribute.id === "color") {
                baseAttributes.push(attribute);
                colorAttr = attribute;
            } else {
                customAttributes.push(attribute);
            }
        }

        return {
            baseAttributes: baseAttributes,
            customAttributes : customAttributes,
            colorAttribute: colorAttr
        };
    } else {
        return null;
    }
}

function getVariationProduct(variants, params) {
    var selectedProduct = null;
    if (variants && variants[0].variationModel.productVariationAttributes.length > Object.keys(params).length) {
        return;
    }

    for (var i = 0; i < variants.length; i++) {
        var variantProduct = variants[i];
        var foundProd = true;
        for (var param in params) {
            if (variantProduct.custom[param] != params[param].value) {
                foundProd = false;
                break;
            }
        }

        if (foundProd) {
            selectedProduct = variantProduct;
            break;
        }
    }

    return selectedProduct;
}

/**
 * Method to receive a product or id of a product and return the availability model based on the zone
 * @param {dw.catalog.Product|String} apiProduct - Product from the API or id of the product
 * @returns {ProductAvailabilityModel} - Product Availability model of the product based on the zone.
 */
function getAvailabilityModel(product) {
    //If the method receive a productId it will search for the product and continue the flow.
    if (typeof product != "object") {
        product = ProductMgr.getProduct(product);
    }
    var zoneInvetory = storeHelpers.getZoneInventory();

    //Return Product Availability model of the product based on the zone if it is possible.
    if (zoneInvetory) {
        return product.getAvailabilityModel(zoneInvetory);
    } else {
        return product.getAvailabilityModel();
    }
}

function getAvailabilityModelByZone(product) {
    //If the method receive a productId it will search for the product and continue the flow.
    if (typeof product != "object") {
        product = ProductMgr.getProduct(product);
    }
    var zoneInvetory = storeHelpers.getZoneInventory();
    var zoneId       = storeHelpers.getZoneId(null);
    //Return Product Availability model of the product based on the zone if it is possible.
    if (zoneId) {
        if (zoneInvetory) {
            return product.getAvailabilityModel(zoneInvetory);
        } else {
            return null;
        }

    } else {
        return product.getAvailabilityModel();
    }
}

/**
 * If a product is master and only have one variant for a given attribute - auto select it
 * @param {dw.catalog.Product} apiProduct - Product from the API
 * @param {Object} params - Parameters passed by querystring
 * @returns {Object} - Object with selected parameters
 */
function normalizeSelectedAttributes(apiProduct, params) {
    if (!apiProduct.master) {
        return params.variables;
    }

    var variables = params.variables || {};
    if (apiProduct.variationModel) {
        collections.forEach(apiProduct.variationModel.productVariationAttributes, function (attribute) {
            var allValues = apiProduct.variationModel.getAllValues(attribute);
            if (allValues.length === 1) {
                variables[attribute.ID] = {
                    id: apiProduct.ID,
                    value: allValues.get(0).ID
                };
            }
        });
    }

    return Object.keys(variables) ? variables : null; //NOSONAR
}

/**
 * Get information for model creation
 * @param {dw.catalog.Product} apiProduct - Product from the API
 * @param {Object} params - Parameters passed by querystring
 *
 * @returns {Object} - Config object
 */
var getVariationModelBase = base.getVariationModel;
var getCurrentOptionModelBase = base.getCurrentOptionModel;
var getProductTypeBase = base.getProductType;
function getConfig(apiProduct, params) {
    var variables = normalizeSelectedAttributes(apiProduct, params);
    var variationModel = getVariationModelBase.call(this, apiProduct, variables);
    if (variationModel) {
        apiProduct = variationModel.selectedVariant || apiProduct; // eslint-disable-line
    }
    var PromotionMgr = require("dw/campaign/PromotionMgr");
    var promotions = PromotionMgr.activeCustomerPromotions.getProductPromotions(apiProduct);
    var optionsModel = getCurrentOptionModelBase.call(this, apiProduct.optionModel, params.options);
    var options = {
        variationModel: variationModel,
        options: params.options,
        optionModel: optionsModel,
        promotions: promotions,
        quantity: params.quantity,
        variables: variables,
        apiProduct: apiProduct,
        rawParams: params,
        productType: getProductTypeBase.call(this, apiProduct)
    };

    return options;
}

/**
 * Find the stock quantity of a product and wrap it in an object with other information.
 * @param {String} productID the product ID
 * @param {String} url the url related to the quantity of products chosen
 * @param {Integer} selectedQuantity the quantity of product selected
 * @returns {Object} the object with availability data
 */
function createQuantitiesWrapper(productID, url, selectedQuantity) {
    var availabilityModel = getAvailabilityModel(productID);

    if (availabilityModel.inventoryRecord) {
        var maxQuantity = require("dw/system/Site").getCurrent().getCustomPreferenceValue("difarmaMaxQtyVal");
        var count = Math.min(availabilityModel.inventoryRecord.ATS, maxQuantity);
        var quantitiesWrapper = [];

        if (!selectedQuantity) {
            selectedQuantity = 1;
        }

        for (var i = 1; i <= count; i++) {
            quantitiesWrapper.push({
                value: i.toString(),
                selected: i == selectedQuantity ? true : false,
                url: url.replace(/quantity=\d+/g, "quantity=" + i)
            });
        }

        return quantitiesWrapper;
    }
    return null;
}
/**
 * Returns whether unavailable products are present in the current basket
 * @returns {Boolean}
 */
function basketHasUnavailableProducts() {
    var BasketMgr = require("dw/order/BasketMgr");

    var basket = BasketMgr.getCurrentOrNewBasket();
    var productLineItems = basket.getAllProductLineItems().toArray();
    return productLineItems.some(function (item) {
        var availabilityModel = getAvailabilityModel(item.product.getID());
        return !empty(availabilityModel) && !availabilityModel.isInStock();
    });
}

base.showProductPage = showProductPage;
base.getAllBreadcrumbs = getAllBreadcrumbs;
base.getConfig = getConfig;
base.organizeVariationAttributes = organizeVariationAttributes;
base.getVariationProduct = getVariationProduct;
base.getAvailabilityModel = getAvailabilityModel;
base.createQuantitiesWrapper = createQuantitiesWrapper;
base.getAvailabilityModelByZone = getAvailabilityModelByZone;
base.basketHasUnavailableProducts = basketHasUnavailableProducts;

module.exports = base;
