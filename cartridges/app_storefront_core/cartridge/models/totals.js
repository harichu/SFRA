"use strict";

var collections  = require("*/cartridge/scripts/util/collections");
var PriceBookMgr = require("dw/catalog/PriceBookMgr");
var Site         = require("dw/system/Site");
var Transaction  = require("dw/system/Transaction");
var Resource     = require("dw/web/Resource");

var base = module.superModule;

/**
 * Adds a discount title to a discount titles object
 * @param {dw.util.Collection} collection - a collection of price adjustments
 * @param {Object} discounts - an object of discount titles
 * @param {Object} keyName - key name to be added to the object of discount titles
 * @returns {Object} an object of discount titles
 */
function createDiscountTitle(collection, discounts, keyName) {
    var discountCallOut  = Resource.msg("label.genericDiscount", "common", null);
    var discountCallOuts = [];

    collections.forEach(collection, function (item) {
        var hasCallOutMessage = item.promotion && item.promotion.calloutMsg && item.promotion.calloutMsg.markup;

        if (hasCallOutMessage) {
            discountCallOuts.push(item.promotion.calloutMsg.markup);
        }
    });

    if (discountCallOuts.length) {
        discountCallOut = Resource.msgf("label.titleDiscount", "common", null, discountCallOuts.join(" + "));
    }

    discounts[keyName] = discountCallOut;

    return discounts;
}

/**
 * creates an object with all discounts titles applied to the basket.
 * @param {dw.order.LineItemCtnr} lineItemContainer - the current line item container
 * @returns {Object} an object of discount titles
 */
function getDiscountsTitles(lineItemContainer) {
    var discountTitles = {};

    discountTitles = createDiscountTitle(lineItemContainer.priceAdjustments, discountTitles, "orderLevel");
    discountTitles = createDiscountTitle(lineItemContainer.allShippingPriceAdjustments, discountTitles, "shippingLevel");

    return discountTitles;
}

/**
 * Extending model to inject club total prices.
 * @param {Object} lineItemContainer The current basket.
 */
function totals(lineItemContainer) {
    var basketCalculationHelpers = require("*/cartridge/scripts/helpers/basketCalculationHelpers");
    var LoyaltyUtils             = require("*/cartridge/scripts/utils/LoyaltyUtils");
    var currentSite              = Site.current;

    var isMember       = LoyaltyUtils.isClubMember();
    var salesPriceBook = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("salesPriceDefault"));
    var clubPriceBook  = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("specialPriceBook"));
    var listPriceBook  = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("listPriceDefault"));
    var listSourceCode = currentSite.getCustomPreferenceValue("listSourceCode");
    var isAccountModel = !empty(session.custom.isAccountModel) ? session.custom.isAccountModel : false;

    var clubTotal, clubGrandTotal;

    if (!isAccountModel) {
        session.setSourceCode(null); // Passing a non-null source code does not clear the current one from session, and we need a cleanup here.
        session.setSourceCode(listSourceCode);
        PriceBookMgr.setApplicablePriceBooks(clubPriceBook, salesPriceBook, listPriceBook);

        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(lineItemContainer);
        });
        base.call(this, lineItemContainer);
        if (this.grandTotal !== "-") {
            clubTotal      = this.subTotal;
            clubGrandTotal = this.grandTotal;
        }

        if (this.totalShippingCost !== "-") {
            this.clubTotalValue = lineItemContainer.getAdjustedMerchandizeTotalPrice(false).value;
        }

        session.setSourceCode(listSourceCode);
        PriceBookMgr.setApplicablePriceBooks(salesPriceBook, listPriceBook);
        Transaction.wrap(function () {
            basketCalculationHelpers.calculateTotals(lineItemContainer);
        });
        base.call(this, lineItemContainer);

        if (this.grandTotal !== "-") {
            this.guestTotal      = this.subTotal;
            this.guestGrandTotal = this.grandTotal;
        }

        if (this.totalShippingCost !== "-") {
            this.guestTotalValue = lineItemContainer.getAdjustedMerchandizeTotalPrice(false).value;
        }

        var displayGuestPriceMaxDiff   = currentSite.preferences.custom.displayGuestPriceMaxDiff;
        var isDisplayGuestPriceEnabled = currentSite.preferences.custom.enableDisplayGuestPrice;

        this.shouldDisplayGuestTotalPrice = !customer.authenticated || (isDisplayGuestPriceEnabled && this.guestTotalValue - this.clubTotalValue >= displayGuestPriceMaxDiff);
        this.displayGuestPriceMaxDiff     = displayGuestPriceMaxDiff;

        if (isMember) {
            session.setSourceCode(null);
            session.setSourceCode(listSourceCode);
            PriceBookMgr.setApplicablePriceBooks(clubPriceBook, salesPriceBook, listPriceBook);
            Transaction.wrap(function () {
                basketCalculationHelpers.calculateTotals(lineItemContainer);
            });
            base.call(this, lineItemContainer);
        }

        if (!empty(clubTotal)) {
            this.clubGrandTotal = clubGrandTotal;
            this.clubTotal      = clubTotal;
        }

        this.discountsTitles = getDiscountsTitles(lineItemContainer);
    }
}

module.exports = totals;
