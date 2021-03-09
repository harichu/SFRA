"use strict";

var ProductMgr    = require("dw/catalog/ProductMgr");
var ArrayList     = require("dw/util/ArrayList");
var collections   = require("*/cartridge/scripts/util/collections");
var pricingHelper = require("*/cartridge/scripts/helpers/pricing");

/**
 * Gets the correct promotions ribbons applied to the product based on the rank
 * @param {Object} promotions - promotions applied
 * @returns {Array} - an array containing the ID of the properly applied promotions
 */
function productPromotionBadgesAndRibbons(promotions) {
    var rankedPromotions  = [];
    var appliedPromotions = [];

    if (!empty(promotions)) {
        promotions.toArray().forEach(function (promotion) {
            var containsRank = !empty(promotion.rank);

            if (containsRank) {
                rankedPromotions.push(promotion);
            } else {
                appliedPromotions.push(promotion);
            }
        });
    }    

    if (!empty(rankedPromotions)) {
        var promotionLowestRank = rankedPromotions.reduce(function (prev, current) {
            return (prev.rank < current.rank) ? prev : current;
        });

        appliedPromotions.push(promotionLowestRank);
    }
    
    return appliedPromotions.map(function (appliedPromotion) {
        return appliedPromotion.ID;
    });
}

/**
 * Overriding decorator to add the custom attributes
 */
module.exports = function (object, promotions) {
    var updatedPromotionList = new ArrayList();
    var apiProduct           = ProductMgr.getProduct(object.id);
    var originalClubPrice    = object.price.promotionless.club;
    var originalSalePrice    = object.price.promotionless.sales;
    var promotionalPrice     = pricingHelper.getPromotionPrice(apiProduct, promotions);

    var iterator = promotions.iterator();
    while (iterator.hasNext()) {
        var promo                     = iterator.next();
        var isClubPromoLowerThanSale  = (!originalClubPrice.available && originalSalePrice.value !== 0 && promotionalPrice.value < originalSalePrice.value);
        var isApplicableClubPromo     = promo.custom.isClubPromotion  && (((originalClubPrice.value !== 0 && promotionalPrice.value < originalClubPrice.value) || originalClubPrice.available) || isClubPromoLowerThanSale);
        var isApplicableSalePromo     = !promo.custom.isClubPromotion && ((originalSalePrice.value !== 0 && promotionalPrice.value < originalSalePrice.value) || originalSalePrice.value === 0);
        var isClubLowerThanSale       = originalSalePrice.value !== 0 && originalClubPrice.value !== 0 ? originalClubPrice.value < originalSalePrice.value : true;
        
        if (isApplicableSalePromo || (isClubLowerThanSale && isApplicableClubPromo)) {
            updatedPromotionList.add(promo);  
        }
    }

    var promotionBadgesAndRibbonsApplied = productPromotionBadgesAndRibbons(promotions);

    Object.defineProperty(object, "promotions", {
        enumerable: true,
        value: updatedPromotionList.length === 0 ? null : collections.map(updatedPromotionList, function (promotion) {
            return {
                calloutMsg: promotion.calloutMsg ? promotion.calloutMsg.markup : "",
                details: promotion.details ? promotion.details.markup : "",
                enabled: promotion.enabled,
                id: promotion.ID,
                name: promotion.name,
                promotionClass: promotion.promotionClass,
                rank: promotion.rank,
                custom: promotion.custom,
                class: promotion.promotionClass,
                showBadgesAndRibbon: !empty(promotionBadgesAndRibbonsApplied) && promotionBadgesAndRibbonsApplied.indexOf(promotion.ID) > -1
            };
        })
    });
};
