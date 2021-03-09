"use strict";

var base = module.superModule;

/**
 * Determine if the basket has item(s) to be picked up in store.
 * @param {dw.order.Basket} basket - Current users's basket
 * @return {boolean} returns true if basket contains pickup in store line item, false otherwise
 */
function hasPickupInstoreItem(basket) {
    var hasPickupInstore = false;

    if (basket) {
        for (var i = 0; i < basket.productLineItems.length; i++) {
            if (basket.productLineItems[i].productInventoryListID) {
                hasPickupInstore = true;
                break;
            }
        }
    }

    return hasPickupInstore;
}

/**
 * @constructor
 * @classdesc CartModel class that represents the current basket
 *
 * @param {dw.order.Basket} basket - Current users's basket
 */
function CartModel(basket) {
    var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");

    base.call(this, basket);
    this.disableShippingMethod = "";
    if (hasPickupInstoreItem(basket)) {
        this.disableShippingMethod = "disabled";
    }

    this.isMemberOfClubVerde = LoyaltyUtils.isClubMember();
}

CartModel.prototype = Object.create(base.prototype);

module.exports = CartModel;
