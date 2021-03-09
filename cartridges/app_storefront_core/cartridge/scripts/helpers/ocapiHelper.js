"use strict";

var Status = require("dw/system/Status");

/**
 * Finds the OCAPI document product item associated with a product line item from a basket.
 * @param {dw.orer.ProductLineItem} lineItem A product line item from a basket.
 * @param {Array.<ProductItem>} docItems An OCAPI basket document's product items.
 */
function findItem(lineItem, docItems) {
    for (var i = 0; i < docItems.length; i++) {
        var docItem = docItems[i];
        if (docItem.item_id == lineItem.UUID) {
            return docItem;
        }
    }
    return null;
}

/**
 * Finds the prorated values for items in the basket and fills in the values in the OCAPI response.
 * @param {dw.order.Basket} basket The basket with the items to prorate.
 * @param {Object} basketDoc The object sent as the OCAPI response.
 */
function modifyResponse(basket, basketDoc) {
    var lineItems = basket.getAllProductLineItems().iterator();
    while (lineItems.hasNext()) {
        var lineItem            = lineItems.next();
        var docItem             = findItem(lineItem, basketDoc.product_items);
        docItem.c_proratedPrice = lineItem.getProratedPrice().valueOrNull;
    }

    return new Status(Status.OK);
}

exports.modifyGETResponse  = modifyResponse;
exports.modifyPOSTResponse = modifyResponse;
