"use strict";

var basketCalculationHelpers = require("*/cartridge/scripts/helpers/basketCalculationHelpers");
var baseValidator            = require("app_storefront_base/cartridge/scripts/hooks/validateBasket.js");
var PriceBookMgr             = require("dw/catalog/PriceBookMgr");
var Transaction              = require("dw/system/Transaction");
var LoyaltyUtils             = require("*/cartridge/scripts/utils/LoyaltyUtils");

var currentSite = require("dw/system/Site").current;

/**
 * validates the current users basket
 * @param {dw.order.Basket} basket The current user's basket
 * @param {boolean} validateTax Determines whether or not to validate taxes.
 * @returns {Object} an error object
 */
function validateBasket(basket, validateTax) {
    var salesPriceBook     = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("salesPriceDefault"));
    var clubPriceBook      = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("specialPriceBook"));
    var listPriceBook      = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("listPriceDefault"));

    if (LoyaltyUtils.isClubMember()) {
        PriceBookMgr.setApplicablePriceBooks(clubPriceBook, salesPriceBook, listPriceBook);
    } else {
        PriceBookMgr.setApplicablePriceBooks(salesPriceBook, listPriceBook);
    }

    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(basket);
    });
    baseValidator.validateBasket(basket, validateTax);
}

exports.validateBasket = validateBasket;
