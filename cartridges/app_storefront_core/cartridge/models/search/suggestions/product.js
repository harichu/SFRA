"use strict";

var URLUtils = require("dw/web/URLUtils");
var PromotionMgr = require("dw/campaign/PromotionMgr");
var ACTION_ENDPOINT = "Product-Show";
var ProductImageDIS = require("*/cartridge/scripts/helpers/ProductImageDIS");
var priceFactory = require("*/cartridge/scripts/factories/price");

/**
 * Get Image URL
 *
 * @param {dw.catalog.Product} product - Suggested product
 * @return {string} - Image URL
 */
function getImageUrl(product) {
    var imageProduct = product;

    if (product.master) {
        imageProduct = product.variationModel.defaultVariant;
    }

    var imgObj = new ProductImageDIS(imageProduct, "suggestions", 0);

    return imgObj.getURL().toString();
}

/**
 * Compile a list of relevant suggested products
 *
 * @param {dw.util.Iterator.<dw.suggest.SuggestedProduct>} suggestedProducts - Iterator to retrieve
 *                                                                             SuggestedProducts
*  @param {number} maxItems - Maximum number of products to retrieve
 * @return {Object[]} - Array of suggested products
 */
function getProducts(suggestedProducts, maxItems) {
    var product = null;
    var products = [];

    for (var i = 0; i < maxItems; i++) {
        if (suggestedProducts.hasNext()) {
            product = suggestedProducts.next().productSearchHit.product;
            products.push({
                name: product.name,
                imageUrl: getImageUrl(product),
                url: URLUtils.url(ACTION_ENDPOINT, "pid", product.ID)
            });
        }
    }

    return products;
}

/**
 * Compile a list of relevant suggested phrases
 *
 * @param {dw.util.Iterator.<dw.suggest.SuggestedPhrase>} suggestedPhrases - Iterator to retrieve
 *                                                                           SuggestedPhrases
 * @param {number} maxItems - Maximum number of phrases to retrieve
 * @return {SuggestedPhrase[]} - Array of suggested phrases
 */
function getPhrases(suggestedPhrases, maxItems) {
    var phrase = null;
    var phrases = [];

    for (var i = 0; i < maxItems; i++) {
        if (suggestedPhrases.hasNext()) {
            phrase = suggestedPhrases.next();
            phrases.push({
                exactMatch: phrase.exactMatch,
                value: phrase.phrase
            });
        }
    }

    return phrases;
}

/**
* Tests whether the value is unique for the given array
* @param {Object[]} list an array of objects with at least id as attribute
* @param {String} id the id of the object to search for
*/
function valueExists(list, id) {
    return list.some(function (obj) {
        return obj.id === id;
    });
}

/**
 * Gets the brands and categories from the given suggested products
 * @param {dw.util.Iterator} suggestedProducts an iterator of dw.suggest.SuggestedProduct
 * @param {Number} maxItems The max number of items
 * @return {Object} Object containing the product info
 */
function getProductInfo(suggestedProducts, maxItems) {
    var info = {
        brands : [],
        categories : []
    };

    if (!empty(suggestedProducts)) {
        while (suggestedProducts.hasNext() && info.brands.length < maxItems && info.categories.length < maxItems) {
            var product = suggestedProducts.next().productSearchHit.product;

            if (!empty(product.brand) && info.brands.length < maxItems && !valueExists(info.brands, product.brand)) {
                info.brands.push({
                    "id" : product.brand,
                    "name" : product.brand,
                    "url" : URLUtils.url("Search-Show", "q", product.brand).toString()
                });
            }

            var category = product.variant ? product.masterProduct.primaryCategory : product.primaryCategory;

            if (!empty(category) && info.categories.length < maxItems && !valueExists(info.categories, category.ID)) {
                info.categories.push({
                    "id" : category.ID,
                    "name" : category.displayName,
                    "url" : URLUtils.url("Search-Show", "cgid", category.ID).toString()
                });
            }
        }
    }

    return info;
}

/**
 * Enrich the current products with more necessary informations that are being used on the suggestion template.
 * @param {Array} products
 * @param {dw.util.Iterator} suggestedProducts
 */
function enrichProducts(products, suggestedProducts) {
    for (var i = 0; i < products.length && suggestedProducts.hasNext(); i++) {
        var suggestedProduct = suggestedProducts.next().productSearchHit.product;
        var product = products[i];

        product.brand = suggestedProduct.brand;
        product.price = priceFactory.getPrice(suggestedProduct);
        product.hasClubPromotionAdjusment = false;
        product.hasPromotionWithBadge = false;

        var promotions = PromotionMgr.activeCustomerPromotions.getProductPromotions(suggestedProduct);

        product.promotions = promotions;

        if (promotions) {
            promotions.toArray().forEach(function (promotion) {
                if (promotion.custom.isClubPromotion) {
                    product.hasClubPromotionAdjusment = true;
                }

                if (promotion.custom.promotionPriceBadge) {
                    product.hasPromotionWithBadge = true;
                }
            });
        }
    }
}
/**
 * Extending to add dynamic suggestions based on the suggested products
 * @constructor
 * @classdesc ProductSuggestions class
 *
 * @param {dw.suggest.SuggestModel} suggestions - Suggest Model
 * @param {number} maxItems - Maximum number of items to retrieve
 */
function ProductSuggestions(suggestions, maxItems) {
    var productSuggestions = suggestions.productSuggestions;

    if (!productSuggestions) {
        this.available = false;
        this.phrases = [];
        this.products = [];
        return;
    }

    var searchPhrasesSuggestions = productSuggestions.searchPhraseSuggestions;

    this.available = productSuggestions.hasSuggestions();
    this.phrases = getPhrases(searchPhrasesSuggestions.suggestedPhrases, maxItems);
    this.products = getProducts(productSuggestions.suggestedProducts, maxItems);

    enrichProducts(this.products, suggestions.productSuggestions.suggestedProducts);
    var productInfo = getProductInfo(suggestions.productSuggestions.suggestedProducts, maxItems);

    this.brands = productInfo.brands;
    this.availableBrands = this.brands && this.brands.length > 0;
    this.categories = productInfo.categories;
    this.availableCategories = this.categories && this.categories.length > 0;
}

module.exports = ProductSuggestions;
