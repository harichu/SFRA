"use strict";

var base = module.superModule;

var ShippingMgr = require("dw/order/ShippingMgr");
var collections = require("*/cartridge/scripts/util/collections");
/**
 * Plain JS object that represents a DW Script API dw.order.ShippingMethod object
 * @param {dw.order.Shipment} shipment - the target Shipment
 * @param {Object} [address] - optional address object
 * @returns {dw.util.Collection} an array of ShippingModels
 */
function getApplicableShippingMethods(shipment, address) {
    var ShippingMethodModel = require("*/cartridge/models/shipping/shippingMethod");
    var Site = require("dw/system/Site");

    var sitePreferences                       = Site.current.preferences.custom;
    var isOmsEnabled                          = sitePreferences.enableOmsInventoryCheckService;
    var basketHasDespachoVolumetricoProducts  = checkIfBasketHasProductWithDespachoVolumetrico();

    if (!shipment) return null;

    var shipmentShippingModel = ShippingMgr.getShipmentShippingModel(shipment);

    var shippingMethods;
    if (address) {
        shippingMethods = shipmentShippingModel.getApplicableShippingMethods(address);
    } else {
        shippingMethods = shipmentShippingModel.getApplicableShippingMethods();
    }

    // Move Pickup in store method to the end of the list
    var pickupInstoreMethod = collections.find(shippingMethods, function (method) {
        return method.custom.storePickupEnabled;
    });
    if (pickupInstoreMethod) {
        shippingMethods.remove(pickupInstoreMethod);
        shippingMethods.add(pickupInstoreMethod);
    }

    return shippingMethods
        .toArray()
        .filter(function (shippingMethod) {
            var shouldReturnShippingMethod = false;

            if (basketHasDespachoVolumetricoProducts) {
                shouldReturnShippingMethod = shippingMethod.custom.isDespachoVolumetrico;
            } else if (!shippingMethod.custom.isDespachoVolumetrico) {
                shouldReturnShippingMethod = (shippingMethod.custom.isOms && isOmsEnabled) || (!shippingMethod.custom.isOms && !isOmsEnabled) || shippingMethod.custom.storePickupEnabled;
            }

            return shouldReturnShippingMethod;
        }).map(function (shippingMethod) {
            return new ShippingMethodModel(shippingMethod, shipment);
        });
}

/**
 * Mark a shipment to be picked up instore
 * @param {dw.order.Shipment} shipment - line item container to be marked for pickup instore
 * @param {string} storeId - Id of the store for shipment to be picked up from.
 */
function markShipmentForPickup(shipment, storeId) {
    var StoreMgr = require("dw/catalog/StoreMgr");
    var ProductInventoryMgr = require("dw/catalog/ProductInventoryMgr");
    var Transaction = require("dw/system/Transaction");

    var store = StoreMgr.getStore(storeId);
    var storeInventory = ProductInventoryMgr.getInventoryList(
        store.custom.inventoryListId
    );
    Transaction.wrap(function () {
        collections.forEach(shipment.productLineItems, function (lineItem) {
            lineItem.custom.fromStoreId = storeId;
            lineItem.setProductInventoryList(storeInventory);
        });
        shipment.custom.fromStoreId = storeId;
    });
}

/**
 * Remove pickup instore indicators from the shipment
 * @param {dw.order.Shipment} shipment - Shipment to be marked
 */
function markShipmentForShipping(shipment) {
    var Transaction = require("dw/system/Transaction");

    Transaction.wrap(function () {
        collections.forEach(shipment.productLineItems, function (lineItem) {
            lineItem.custom.fromStoreId = null;
            lineItem.setProductInventoryList(null);
        });
        shipment.custom.fromStoreId = null;
    });
}

/**
 * Sets the default ShippingMethod for a Shipment, if absent.
 * When the order has products flagged as despacho volumetrico ensures that the shippingMethod is a despacho volumetrico one
 * @param {dw.order.Shipment} shipment - the target Shipment object
 */
function ensureShipmentHasMethod(shipment) {    
    base.ensureShipmentHasMethod(shipment);

    var shippingMethod                       = shipment.shippingMethod;
    var basketHasDespachoVolumetricoProducts = checkIfBasketHasProductWithDespachoVolumetrico();

    if (basketHasDespachoVolumetricoProducts && !shippingMethod.custom.isDespachoVolumetrico) {
        setShippingMethodForDespachoVolumetrico(shipment);
    }    
}

/**
 * Verifies if there is some product in the basket which has the isDespachoVolumetrico set as true
 *
 * @returns {Boolean} a boolean that indicates if there is some product in the basket flagged as despacho volumetrico
 */
function checkIfBasketHasProductWithDespachoVolumetrico() {
    var BasketMgr = require("dw/order/BasketMgr");

    var currentBasket = BasketMgr.getCurrentBasket();

    if (currentBasket) {
        var hasDespachoVolumetrico = currentBasket.getAllProductLineItems().toArray().some(function (pli) {
            return pli.product && pli.product.custom && pli.product.custom.isDespachoVolumetrico;
        });
    
        return hasDespachoVolumetrico;
    }

    return false;    
}

/**
 * Sets the ShippingMethod of a Shipment for Despacho Volumetrico
 * @param {dw.order.Shipment} shipment - the target Shipment object
 */
function setShippingMethodForDespachoVolumetrico(shipment) {
    var shippingMethods = ShippingMgr.getShipmentShippingModel(shipment).applicableShippingMethods;

    var despachoVolumetricoMethod = collections.find(shippingMethods, function (method) {
        return method.custom.isDespachoVolumetrico;
    });

    if (despachoVolumetricoMethod) {
        shipment.setShippingMethod(despachoVolumetricoMethod);
    }
}

module.exports = {
    getShippingModels            : base.getShippingModels,
    selectShippingMethod         : base.selectShippingMethod,
    ensureShipmentHasMethod      : ensureShipmentHasMethod,
    getShipmentByUUID            : base.getShipmentByUUID,
    getAddressFromRequest        : base.getAddressFromRequest,
    getApplicableShippingMethods : getApplicableShippingMethods,
    markShipmentForPickup        : markShipmentForPickup,
    markShipmentForShipping      : markShipmentForShipping
};

