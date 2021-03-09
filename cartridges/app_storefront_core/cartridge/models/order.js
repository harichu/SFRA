"use strict";

var base = module.superModule;
var Calendar = require("dw/util/Calendar");
var StringUtils = require("dw/util/StringUtils");

/**
 * Extending model to add a proper formatted date
 */
function OrderModel(lineItemContainer, options) {
    base.call(this, lineItemContainer, options);

    var orderPlacedDate = new Date(this.creationDate);
    var orderPlacedDateObj = new Calendar();
    var basketHasHomeDeliveryOnlyProducts = false;
    var basketHasStorePickupOnlyProducts  = false;
    var basketHasNonOrderableProducts     = false;

    orderPlacedDateObj.setTime(orderPlacedDate);
    orderPlacedDateObj.setTimeZone(require("dw/system/Site").getCurrent().getTimezone());

    var iterator = lineItemContainer.allProductLineItems.iterator();
    while (iterator.hasNext()) {
        var lineItem = iterator.next();
        if (lineItem.custom.hasSmartOrderRefill) {
            this.hasSorProduct = true;
        }

        if (lineItem.product.custom.homeDelivery && !lineItem.product.custom.storePickup) {
            basketHasHomeDeliveryOnlyProducts = true;
        }

        if (lineItem.product.custom.storePickup && !lineItem.product.custom.homeDelivery) {
            basketHasStorePickupOnlyProducts = true;
        }

        if (!lineItem.product.custom.storePickup && !lineItem.product.custom.homeDelivery) {
            basketHasNonOrderableProducts = true;
        }
    }

    if (basketHasNonOrderableProducts) {
        basketHasHomeDeliveryOnlyProducts = true;
        basketHasStorePickupOnlyProducts  = true;
    }

    this.hasHomeDeliveryOnlyProducts = basketHasHomeDeliveryOnlyProducts;
    this.hasStorePickupOnlyProducts  = basketHasStorePickupOnlyProducts;

    this.formattedDate = StringUtils.formatCalendar(orderPlacedDateObj, "EEEE dd/MM/YYYY · kk:mm");
    this.UUID = lineItemContainer.getUUID();
}

module.exports = OrderModel;
