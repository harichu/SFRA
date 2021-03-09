"use strict";

var Logger              = require("dw/system/Logger");
var ProductInventoryMgr = require("dw/catalog/ProductInventoryMgr");
var Resource            = require("dw/web/Resource");
var Site                = require("dw/system/Site");
var StoreMgr            = require("dw/catalog/StoreMgr");
var Transaction         = require("dw/system/Transaction");

/**
 * Sets the store and its inventory list for the given product line item.
 * @param {string} storeId - The store id
 * @param {dw.order.ProductLineItem} productLineItem - The ProductLineItem object
 */
function setStoreInProductLineItem(storeId, productLineItem) {
    Transaction.wrap(function () {
        if (storeId) {
            var store = StoreMgr.getStore(storeId);
            if (!empty(store)) {
                var inventoryListId = ("inventoryListId" in store.custom) ?
                    store.custom.inventoryListId : null;
                if (store && inventoryListId) {
                    var storeinventory = ProductInventoryMgr.getInventoryList(inventoryListId);
                    if (storeinventory) {
                        if (storeinventory.getRecord(productLineItem.productID)
                        && storeinventory.getRecord(productLineItem.productID).ATS.value
                        >= productLineItem.quantityValue) {
                            productLineItem.custom.fromStoreId = store.ID;
                            // no-param-reassign
                            productLineItem.setProductInventoryList(storeinventory);
                        }
                    }
                }
            } else {
                Logger.error("No store with ID " + storeId + "could be found.");
                throw new Error(Resource.msg("subheading.error.general", "error", null));
            }
        }
    });
}

/**
 * Returns the available to sell value for the product at the specified store.
 * @param {Object} storeId - the store ID to lookup the inventory
 * @param {Object} productId - the product ID to lookup the inventory
 * @returns {number} - the available to sell value
 */
function getStoreInventory(storeId, productId) {
    var availableToSellValue = 0;

    var store = StoreMgr.getStore(storeId);
    var inventoryListId = ("inventoryListId" in store.custom) ? store.custom.inventoryListId : null;
    if (inventoryListId) {
        var storeInventory = ProductInventoryMgr.getInventoryList(inventoryListId);
        if (storeInventory && storeInventory.getRecord(productId)) {
            availableToSellValue = storeInventory.getRecord(productId).ATS.value;
        }
    }

    return availableToSellValue;
}

function getPickUpInStoreDateAndTime(creationDate) {
    var currentSite   = Site.current;
    var offsetInHours = currentSite.timezoneOffset / 3600000;

    var orderPlacedDate = new Date(creationDate);
    orderPlacedDate.setHours(orderPlacedDate.getHours() + offsetInHours);

    var pickUpDateAndTimeObj = new dw.util.Calendar();
    pickUpDateAndTimeObj.setTime(orderPlacedDate);
    pickUpDateAndTimeObj.setTimeZone(currentSite.getTimezone());

    var pickUpDateAndTime = new Date(require("dw/util/StringUtils").formatCalendar(pickUpDateAndTimeObj));

    var creationDateHours   = pickUpDateAndTime.getHours();
    var creationDateMinutes = pickUpDateAndTime.getMinutes();

    var minHour = 11 + offsetInHours;
    var maxHour = 19 + offsetInHours;
    var hoursForPickUp = currentSite.getCustomPreferenceValue("hoursForPickUp");
    
    // If business time;
    if (creationDateHours >= minHour - hoursForPickUp && creationDateHours < maxHour - hoursForPickUp || (creationDateHours == maxHour - hoursForPickUp && creationDateMinutes == 0)) {
        pickUpDateAndTime.setHours(creationDateHours + hoursForPickUp);
        session.custom.isPickupToday = true;

    // If after business time;
    } else if (creationDateHours > maxHour - hoursForPickUp || (creationDateHours == maxHour - hoursForPickUp && creationDateMinutes > 0)) {
        pickUpDateAndTime.setHours(minHour);
        pickUpDateAndTime.setMinutes(0);
        pickUpDateAndTime.setSeconds(0);
        pickUpDateAndTime.setDate(creationDate.getDate() + 1);
        session.custom.isPickupToday = false;

    // If before business time;
    } else if (creationDateHours >= 0 && creationDateHours < minHour - hoursForPickUp) {
        pickUpDateAndTime.setHours(minHour);
        pickUpDateAndTime.setMinutes(0);
        pickUpDateAndTime.setSeconds(0);
        session.custom.isPickupToday = true;
    }

    return pickUpDateAndTime;
}

module.exports = {
    setStoreInProductLineItem: setStoreInProductLineItem,
    getStoreInventory: getStoreInventory,
    getPickUpInStoreDateAndTime: getPickUpInStoreDateAndTime
};
