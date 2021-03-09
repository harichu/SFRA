"use strict";

var PriceBookMgr = require("dw/catalog/PriceBookMgr");
var Site         = require("dw/system/Site");
var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");

var currentSite  = Site.current;

/**
 * Function to update the Price Books that should be applicable to the basket calculation.
 * It tests if the user is logged in and if he belongs to the Club Cruz Verde Customer Group.
 * If both are true, it gets all price books of the current Site and set them as applicable.
 * If not, it gets only sales and list price books, excluding the Club Cruz Verde price book.
 */

function updatePriceBooks() {
    var priceBooks = [];

    if (LoyaltyUtils.isClubMember()) {
        priceBooks = PriceBookMgr.getSitePriceBooks().toArray();
    } else {
        var listPriceBookID  = currentSite.getCustomPreferenceValue("listPriceDefault");
        var salesPriceBookID = currentSite.getCustomPreferenceValue("salesPriceDefault");
        var listPriceBook    = PriceBookMgr.getPriceBook(listPriceBookID);
        var salesPriceBook   = PriceBookMgr.getPriceBook(salesPriceBookID);
        priceBooks.push(listPriceBook, salesPriceBook);
    }

    PriceBookMgr.setApplicablePriceBooks(priceBooks);
}

function checkIfCustomerHasClubPromotion(product) {
    var PromotionMgr = require("dw/campaign/PromotionMgr");
    
    var promotionList = PromotionMgr.activeCustomerPromotions.getProductPromotions(product);
    var iterator      = promotionList.iterator();

    while (iterator.hasNext()) {
        var promotion = iterator.next();
        
        if (promotion.custom.isClubPromotion) {
            return true;
        }
    }

    return false;
}

function applyListPriceBook() {
    var listPriceBook  = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("listPriceDefault"));

    PriceBookMgr.setApplicablePriceBooks(listPriceBook);
}

module.exports = {
    updatePriceBooks                : updatePriceBooks,
    applyListPriceBook              : applyListPriceBook,
    checkIfCustomerHasClubPromotion : checkIfCustomerHasClubPromotion
};
