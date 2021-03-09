"use strict";

var Money        = require("dw/value/Money");
var DefaultPrice = require("*/cartridge/models/price/default");
var PriceBookMgr = require("dw/catalog/PriceBookMgr");
var priceHelper  = require("*/cartridge/scripts/helpers/pricing");
var RangePrice   = require("*/cartridge/models/price/range");
var TieredPrice  = require("*/cartridge/models/price/tiered");
var Site         = require("dw/system/Site");
var PromotionMgr = require("dw/campaign/PromotionMgr");

var currentSite = Site.current;

/**
 * Gets a price for a product, given a price book.
 * @param {dw.catalog.Product} product The product from which to get a price.
 * @param {Object} currentOptionModel The current option model for the product.
 * @param {Array.<dw.campaign.Promotion>} promotions The promotions to consider.
 * @param {String} priceBook The price book to use.
 * @return {dw.value.Money} The price of the product for the given pricebook.
 */
function getPricebookPrice(product, currentOptionModel, promotions, priceBook) {
    var price = Money.NOT_AVAILABLE; //NOSONAR
    PriceBookMgr.setApplicablePriceBooks(priceBook);

    var promotionPrice = priceHelper.getPromotionPrice(product, promotions, currentOptionModel);
    var priceBookPrice = promotionPrice.available ? promotionPrice : product.getPriceModel().getPrice();

    if (priceBookPrice.available) {
        return priceBookPrice;
    }

    return price;
}

/**
 * Retrieves Price instance.
 *
 * @param {dw.catalog.Product|dw.catalog.productSearchHit} inputProduct - API object for a product
 * @param {string} currency - Current session currencyCode
 * @param {boolean} useSimplePrice - Flag as to whether a simple price should be used, used for
 *     product tiles and cart line items.
 * @param {dw.util.Collection<dw.campaign.Promotion>} promotions - Promotions that apply to this
 *                                                                 product
 * @param {dw.catalog.ProductOptionModel} currentOptionModel - The product's option model
 * @return {TieredPrice|RangePrice|DefaultPrice} - The product's price
 */
function getPrice(inputProduct, currency, useSimplePrice, promotions, currentOptionModel) {
    var pricebookHelpers = require("*/cartridge/scripts/checkout/priceBooksHelpers");
    
    var rangePrice;
    var product = inputProduct;
    var priceModel = currentOptionModel ? product.getPriceModel(currentOptionModel) : product.getPriceModel();
    var priceTable = priceModel.getPriceTable();

    // TIERED
    if (priceTable.quantities.length > 1) {
        return new TieredPrice(priceTable, useSimplePrice);
    }

    // RANGE
    if ((product.master || product.variationGroup) && priceModel.priceRange) {
        rangePrice = new RangePrice(priceModel.minPrice, priceModel.maxPrice);

        if (rangePrice && rangePrice.min.sales.value !== rangePrice.max.sales.value) { //NOSONAR
            return rangePrice;
        }
    }

    if ((product.master || product.variationGroup) && product.variationModel.variants.length > 0) {
        product = product.variationModel.variants[0];
    }

    var listPriceBook = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("listPriceDefault"));
    var salePriceBook = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("salesPriceDefault"));
    var clubPriceBook = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("specialPriceBook"));

    var originalListPrice = product.priceModel.getPriceBookPrice(listPriceBook.ID);

    // List pricebook;
    var promotionList        = PromotionMgr.activeCustomerPromotions.getProductPromotions(inputProduct);
    var promotionalListPrice = getPricebookPrice(product, currentOptionModel, promotionList, listPriceBook);

    var isCustomerHaveClubPromotion = pricebookHelpers.checkIfCustomerHasClubPromotion(product);
    
    var finalSalePrice = getFinalSalePrice(product, salePriceBook, promotionList, isCustomerHaveClubPromotion, promotionalListPrice);
    var finalClubPrice = getFinalClubPrice(product, clubPriceBook, promotionList, isCustomerHaveClubPromotion, promotionalListPrice);

    // Prices with the same value shouldn't be displayed;
    if (finalClubPrice.value >= finalSalePrice.value && finalSalePrice.value >= originalListPrice.value) {
        finalClubPrice = Money.NOT_AVAILABLE;
        finalSalePrice = Money.NOT_AVAILABLE;
    }
    
    if (finalClubPrice.value >= finalSalePrice.value && finalSalePrice.available) {
        finalClubPrice = Money.NOT_AVAILABLE;
    }

    if (finalClubPrice.value >= originalListPrice.value) {
        finalClubPrice = Money.NOT_AVAILABLE;
    }

    if (finalSalePrice.value >= originalListPrice.value) {
        finalSalePrice = Money.NOT_AVAILABLE;
    }

    var priceObj = new DefaultPrice(finalSalePrice, originalListPrice, finalClubPrice);

    priceObj.promotionless = getRawPrice(product);

    return priceObj;
}

function getFinalClubPrice(product, clubPriceBook, promotionList, isCustomerHaveClubPromotion, promotionalListPrice) {
    var originalCluPrice = product.priceModel.getPriceBookPrice(clubPriceBook.ID);
    var finalClubPrice   = Money.NOT_AVAILABLE;

    // Product has club price;
    if (originalCluPrice.value > 0) {
        
        // Product has promotions, and any of them is "club";
        if (promotionList.length > 0 && isCustomerHaveClubPromotion) {
            // Takes the minimum between club price and promotion price;
            finalClubPrice = promotionalListPrice < originalCluPrice ?
                promotionalListPrice :
                originalCluPrice;
        } else {
            // If product has no promotions at all, display club price;
            // If product has no "club" promotions, it won't affect club price, so display standard club price;
            finalClubPrice = originalCluPrice;
        }


    // Product has no club price;
    } else {
        // Product has promotions, and any of them is "club", display promotion price;
        if (promotionList.length > 0 && isCustomerHaveClubPromotion) {
            finalClubPrice = promotionalListPrice;
        } else {
            // If product has no promotions at all or has no "club" promotion, nothing will be displayed;
        }
    }

    return finalClubPrice;
}

function getFinalSalePrice(product, salesPriceBook, promotionList, isCustomerHaveClubPromotion, promotionalListPrice) {
    var originalSalePrice = product.priceModel.getPriceBookPrice(salesPriceBook.ID);
    var finalSalePrice    = Money.NOT_AVAILABLE;

    // Product has sale price;
    if (originalSalePrice.value > 0) {
        
        // Product has promotions, and none of them is "club";
        if (promotionList.length > 0 && !isCustomerHaveClubPromotion) {
            // Takes the minimum between sale price and promotion price;
            finalSalePrice = promotionalListPrice < originalSalePrice ?
                promotionalListPrice :
                originalSalePrice;
        } else {
            // If product has no promotions at all, display sale price;
            // If product has "club" promotions, it won't affect sale price, so display standard sale price;
            finalSalePrice = originalSalePrice;
        }

    
    // Product has no sale price;
    } else {
        // Product has promotions, and none of them is "club", display promotion price;
        if (promotionList.length > 0 && !isCustomerHaveClubPromotion) {
            finalSalePrice = promotionalListPrice;
        } else {
            // If product has no promotions at all or has "club" promotion, nothing will be displayed;
        }
    }

    return finalSalePrice;
}

/**
 * Get list price for a product
 *
 * @param {dw.catalog.Product} product The product from which to get raw prices.
 * @return {Object} A map of prices.
 */
function getRawPrice(product) {
    var listPriceBookID  = currentSite.getCustomPreferenceValue("listPriceDefault");
    var salesPriceBookID = currentSite.getCustomPreferenceValue("salesPriceDefault");
    var clubPriceBookID  = currentSite.getCustomPreferenceValue("specialPriceBook");

    var listPrice  = product.getPriceModel().getPriceBookPrice(listPriceBookID);
    var salesPrice = product.getPriceModel().getPriceBookPrice(salesPriceBookID);
    var clubPrice  = product.getPriceModel().getPriceBookPrice(clubPriceBookID);

    var result = {
        list  : listPrice.available  ? listPrice  : Money.NOT_AVAILABLE,
        sales : salesPrice.available ? salesPrice : Money.NOT_AVAILABLE,
        club  : clubPrice.available  ? clubPrice  : Money.NOT_AVAILABLE,
    };

    return result;
}

/**
 * Get all three prices for a product.
 * @param {dw.catalog.Product} product The product from which to get prices.
 * @returns {dw.value.Money} The default price for the product.
 */
function getDisplayPrices(product) {
    var prices = getRawPrice(product);

    var listPrice = prices.list;
    var salesPrice = prices.sales;
    var clubPrice = prices.club;

    return new DefaultPrice(salesPrice, listPrice, clubPrice);
}

module.exports = {
    getPrice: getPrice,
    getDisplayPrices: getDisplayPrices
};
