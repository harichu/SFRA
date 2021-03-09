"use strict";

var BasketMgr             = require("dw/order/BasketMgr");
var InventoryCheckService = require("*/cartridge/scripts/services/InventoryCheckService");
var ProductImageDIS       = require("*/cartridge/scripts/helpers/ProductImageDIS");
var ProductMgr            = require("dw/catalog/ProductMgr");
var Resource              = require("dw/web/Resource");
var StoreTimeService      = require("*/cartridge/scripts/services/StoreTimeService");
var Site                  = require("dw/system/Site");
var Transaction           = require("dw/system/Transaction");
var URLUtils              = require("dw/web/URLUtils");
var StoreMgr              = require("dw/catalog/StoreMgr");
var Logger                = require("dw/system/Logger");

var currentSite                    = Site.current;
var isInventoryCheckServiceEnabled = currentSite.preferences.custom.enableOmsInventoryCheckService;

/**
 * Given a product id and a quantity, returns the line item id in the basket.
 * @param {dw.order.Basket} basket
 * @param {String} pid
 * @param {Number} quantity
 */
function getUUIDFromPid(basket, pid, quantity) {
    var lineItems = basket.getAllProductLineItems().iterator();

    while (lineItems.hasNext()) {
        var item = lineItems.next();
        if (pid == item.productID && quantity == item.quantityValue) {
            return item.UUID;
        }
    }
}

function getStoresTimeForBasket(basket, req) {
    var geolocationData        = getGeolocationData(basket, req);
    var storeInventoryResponse = checkStoreInventories(basket, geolocationData);

    if (storeInventoryResponse.Message) {
        return {
            isOOSmessage       : true,
            productsOutOfStock : storeInventoryResponse.UnavailableLines.UnavailableLine
        };
    } else if (storeInventoryResponse) {
        return storeInventoryResponse;
    } else {
        return null;
    }
}

function extractHourFromDate(date) {
    return date ? date.substring(11, 13) : null;
}

function getAvailableStores(req, lineItemList) {
    var basket          = BasketMgr.getCurrentBasket();
    var geolocationData = getGeolocationData(basket, req);

    var serviceResponse = InventoryCheckService.getStorePickupCandidates(
        geolocationData.lat,
        geolocationData.lng,
        currentSite.preferences.custom.storelocatorRadius,
        lineItemList,
        geolocationData.city
    );

    if (serviceResponse.object.Message) {
        return {
            isOOSmessage       : true,
            productsOutOfStock : serviceResponse.object.UnavailableLines.UnavailableLine
        };
    }

    return serviceResponse.object.Store;
}

/**
 * Obtains geolocation from a basket
 * @param {*} basket A basket from which to obtain geolocation
 */
function getGeolocationData(basket, req) {
    var address = basket.defaultShipment.shippingAddress;
    var lat     = null;
    var lng     = null;
    var city    = null;
    var zoneId  = session.custom.mainStore;
    var zone    = StoreMgr.getStore(zoneId);

    if (req) {
        var isZero = req.querystring.lat == 0 && req.querystring.long == 0;
        lat = req.querystring.lat && !isZero ? req.querystring.lat  : req.geolocation.latitude;
        lng = req.querystring.long && !isZero ? req.querystring.long : req.geolocation.longitude;
        city = req.querystring.city && !isZero ? req.querystring.city : request.getGeolocation().city;
    } else if (!empty(address) && !empty(address.custom.latitude)) {
        lat = address.custom.latitude;
        lng = address.custom.longitude;
        city = address.city;
    } else {
        if (!empty(zone)) {
            lat = zone.latitude;
            lng = zone.longitude;
            city = zone.city;
        }
    }

    return {
        lat : lat,
        lng : lng,
        city: city
    };
}

function checkStoreInventories(basket, geoLocationData) {
    var result = null;

    var serviceResponse = InventoryCheckService.getStorePickupCandidates(
        geoLocationData.lat,
        geoLocationData.lng,
        currentSite.preferences.custom.storelocatorRadius,
        basket.productLineItems
    );

    if (serviceResponse.object.Message) {
        result = serviceResponse.object;
    } else {
        var storeMapList = [];
        var stores = serviceResponse.object.Store;

        for (var i = 0; i < stores.length; i++) {
            storeMapList.push(stores[i].StoreID);
        }

        result = storeMapList;
    }

    return result;
}

/**
 * Sets order load data into the basket, for later XML assembly when the order is placed.
 * @param {dw.order.Basket} basket The basket to fill with order load data.
 * @param {Object} store The store that will fulfill the order.
 */
function setOrderLoadData(basket, store) {
    if (!isInventoryCheckServiceEnabled) {
        return;
    }
    Transaction.wrap(function () {
        basket.getShipments()[0].custom.fromStoreId = store.StoreID;
        basket.custom.difarmaTodayTime    = store.CurrentDayTime;
        basket.custom.difarmaTomorrowTime = store.NextDayTime;
    });
}

function getStoreTime(storeID, req, lineItemList) {
    var basket          = BasketMgr.getCurrentBasket();
    var geoLocationData = getGeolocationData(basket, req);
    var currentDayHour  = null;
    var nextDayHour     = null;

    var serviceResponse = StoreTimeService.getStoreTimes({
        lng          : geoLocationData.lng,
        lat          : geoLocationData.lat,
        distance     : currentSite.preferences.custom.storelocatorRadius,
        storeID      : storeID,
        lineItemList : lineItemList
    });

    if (serviceResponse.object) {
        var store      = serviceResponse.object.Store[0];
        currentDayHour = extractHourFromDate(store.CurrentDayTime);
        nextDayHour    = extractHourFromDate(store.NextDayTime);

        setOrderLoadData(basket, store);
    }

    return {
        storeID        : storeID,
        currentDayHour : currentDayHour,
        nextDayHour    : nextDayHour
    };
}

function getHomeDeliveryStoreData(latitudeParam, longitudeParam, city) {
    var GeolocationUtils = require("*/cartridge/scripts/utils/GeolocationUtils");

    var basket          = BasketMgr.getCurrentBasket();
    var geolocation     = GeolocationUtils.getFallbackGeolocation(latitudeParam, longitudeParam);
    var storeID         = null;
    var currentDayHour  = null;
    var nextDayHour     = null;
    var errorResponse   = null;
    var serviceResponse = InventoryCheckService.getHomeDeliverySourceStore(
        geolocation.lat,
        geolocation.lng,
        currentSite.preferences.custom.storelocatorRadius,
        basket.productLineItems,
        null,
        city
    );

    if (!serviceResponse.Message) {
        var store      = serviceResponse.sourceStore;
        storeID        = store.StoreID;
        currentDayHour = extractHourFromDate(store.CurrentDayTime);
        nextDayHour    = extractHourFromDate(store.NextDayTime);

        setOrderLoadData(basket, store);
    } else {
        var logMessage   = serviceResponse.Message;
        var errorResponse = serviceResponse
        if (geolocation.isOtherThanStorefrontCountry) {
            logMessage = "It seems you are in a country other than the storefront default country. A technical error was displayed " +
            "in the storefront because the client-side didn't send to the server the longitude/latitude of the shipment address" +
            "(Likely the Google Places API is not working because of has reached the free requests limit). \nAs the OMS Inventory Check Service " + 
            "is enabled, and that geolocation was not sent from the client-side, a fallback to get the longitude/latitude from the request was used. " +
            "As you are in a country other than the storefront default country, your current geolocation is passed to the OMS service, which is not able to " + 
            "determine a store with inventory available for the product nearby your coordinates within the radius used (" + 
            "Latitude: " + geolocation.lat + " | Longitude: " + geolocation.lng + " | Radius: " + currentSite.preferences.custom.storelocatorRadius + ").\n" +
            "Please use a VPN with the country set to the storefront default country in order to the fallback to be able to get geolocation from that country and try again.\n" + 
            "This is not a real issue, but an edge case, because you are trying to place an order outside the storefront country";
        } 
            
        Logger.getLogger("Checkout", "shipment").warn(logMessage);
    }

    return {
        StoreID        : storeID,
        currentDayHour : currentDayHour,
        nextDayHour    : nextDayHour, 
        errorResponse  : errorResponse
    };
}

/**
 * Fills in data for products that are out of stock.
 * @param {Object} productsOutOfStock The inventory check service's response.
 * @return {Array.<Object>} An array of plain objects with data regarding products that are out of stock.
 */
function getOutOfStockProductData(productsOutOfStock) {
    var basket = BasketMgr.getCurrentOrNewBasket();
    var result = productsOutOfStock.map(function (lineItem) {
        var sku        = lineItem.ItemID;
        var apiProduct = ProductMgr.getProduct(sku);
        var uuid       = getUUIDFromPid(basket, sku, lineItem.RequiredQty);
        var image      = new ProductImageDIS(apiProduct, "small");
        return {
            productID       : sku,
            requested       : lineItem.RequiredQty,
            available       : lineItem.AssignedQty,
            brand           : apiProduct.brand,
            description     : apiProduct.name,
            image           : image.getURL().toString(),
            displayQuantity : Resource.msg("label.quantity", "common", null) + ": " + lineItem.RequiredQty,
            deleteLink      : URLUtils.https("Cart-RemoveProductLineItem", "pid", sku, "uuid", uuid).toString()
        };
    });

    return result;
}

/**
 * Gets list of unavailable products which are in the basket;
 */
function getListOfUnavailableProducts(isHomeDelivery, city) {
    var basket                 = BasketMgr.getCurrentOrNewBasket();
    var geoLocationData        = getGeolocationData(basket);
    var unavailableProductList = [];

    if (!isInventoryCheckServiceEnabled) {
        return getListOfUnavailableProductsOnSfcc(basket);
    }

    var requestGeolocation = request.getGeolocation();
    var lat  = geoLocationData.lat || session.custom.storeSearchLatitude  || requestGeolocation.latitude;
    var long = geoLocationData.lng || session.custom.storeSearchLongitude || requestGeolocation.longitude;

    var data = InventoryCheckService.getHomeDeliverySourceStore(
        lat,
        long,
        currentSite.preferences.custom.storelocatorRadius,
        basket.productLineItems,
        isHomeDelivery,
        city
    );

    if (data.UnavailableLines) {
        unavailableProductList = getOutOfStockProductData(data.UnavailableLines.UnavailableLine);
    }

    return unavailableProductList;
}

function getListOfUnavailableProductsOnSfcc(basket) {
    var ProductInventoryMgr = require("dw/catalog/ProductInventoryMgr");
    var StoreMgr            = require("dw/catalog/StoreMgr");

    var currentStore           = StoreMgr.getStore(session.custom.mainStore);
    var unavailableProductList = [];

    if (currentStore) {
        Logger.getLogger("Checkout", "shipment").info("Checking store '" + currentStore.ID + "' inventory.");
    } else {
        Logger.getLogger("Checkout", "shipment").info("Invalid inventory check: No current store defined.");
    }

    var inventoryID = currentStore.custom.inventoryListId;

    if (inventoryID) {
        Logger.getLogger("Checkout", "shipment").info("Checking inventory '" + inventoryID + "'.");
    } else {
        Logger.getLogger("Checkout", "shipment").info("Invalid inventory check: No inventory is set for store " + currentStore.ID + ".");
    }

    var inventory = ProductInventoryMgr.getInventoryList(inventoryID);

    if (!inventory) {
        Logger.getLogger("Checkout", "shipment").info("Invalid inventory check: Store " + currentStore.ID + " has inventory set to " + inventoryID + ", but no such inventory exists.");
    }

    basket
        .allProductLineItems
        .toArray()
        .forEach(function (lineItem) {
            var availabilityModel = lineItem.product.getAvailabilityModel(inventory);

            if (!availabilityModel.inStock) {
                var sku        = lineItem.product.ID;
                var apiProduct = ProductMgr.getProduct(sku);
                var uuid       = getUUIDFromPid(basket, sku, lineItem.quantityValue);
                var image      = new ProductImageDIS(apiProduct, "small");

                unavailableProductList.push({
                    productID       : sku,
                    requested       : lineItem.quantityValue,
                    available       : availabilityModel.availability,
                    brand           : apiProduct.brand,
                    description     : apiProduct.name,
                    image           : image.getURL().toString(),
                    displayQuantity : Resource.msg("label.quantity", "common", null) + ": " + lineItem.quantityValue,
                    deleteLink      : URLUtils.https("Cart-RemoveProductLineItem", "pid", sku, "uuid", uuid).toString()
                });
            }
        });

    return unavailableProductList;
}

/*Functions to handle OMS response messages in case the product 
does not have coverage or the required quantity */
function responseClientErrorsOMS(UnavailableLine){
    let messages = [];

    const { Message }         = UnavailableLine.Messages;
    const { AssignedQty }     = UnavailableLine;
    const { LineId }          = UnavailableLine;
    const { ItemID }          = UnavailableLine;

    for (let index = 0; index < Message.length; index++) {
        messages.push(Message[index].Text);
    }

    return {
        id            : LineId,
        currentStock  : AssignedQty, 
        messages      : messages,
        idItem        : ItemID
    };
}

function getErrorMessagesOMS(errorReponseOMS){
    let response = [];
    
    const { UnavailableLine } = errorReponseOMS.UnavailableLines;

    if(UnavailableLine.length > 1){
        for (let index = 0; index < UnavailableLine.length; index++) {
            response.push(responseClientErrorsOMS(UnavailableLine[index]));
        }
    }else{
        response.push(responseClientErrorsOMS(UnavailableLine[0]));
    }

    return response;
}

function validateErrorClientOMS(responseError){

    let isOutOfCoverage = false
    let clientMessage   = [];
    
    for (let index = 0; index < responseError.length; index++) {
        for (let j = 0; j < responseError[index].messages.length; j++) {
            if(responseError[index].messages[j] === " No choices generated for the line"){
                isOutOfCoverage = true;
                clientMessage.push("Los productos no están disponible en la dirección ingresada.");
            }
            if(responseError[index].messages[j].indexOf("Ensure inventory capacity for node is available") > -1){
                clientMessage.push("El producto con el SKU: " + responseError[index].idItem + " solo tiene " + responseError[index].currentStock + " unidades en stock.");
            }
        }
    }

    return {
        isOutOfCoverage : isOutOfCoverage,
        messages        : clientMessage,
    };
}

function getAmPmMessage(hour) {
    var omsApproximateTimePrefix = sitePreferences.omsApproximateTimePrefix;
    var amTime                   = Resource.msg("oms.deliverytime.am", "checkout", null);
    var pmTime                   = Resource.msg("oms.deliverytime.pm", "checkout", null);
    var dailyShift               = hour < 12 ? amTime : pmTime;
    var amPmHour                 = hour % 12;

    amPmHour = amPmHour ? amPmHour : 12;

    var formattedTime = amPmHour + ":00 " + dailyShift;

    return "(" + omsApproximateTimePrefix + " " + formattedTime + ")";
}

function getOmsData(storeData) {
    storeData.isInventoryCheckServiceEnabled = true;
    storeData.isOutOfCoverage                = false;

    if (storeData.currentDayHour) {
        storeData.currentDayMessage = getAmPmMessage(storeData.currentDayHour);
    }

    if (storeData.nextDayHour) {
        storeData.nextDayMessage = getAmPmMessage(storeData.nextDayHour);
    }

    if(storeData.errorResponse) {
        let errorMessages                = getErrorMessagesOMS(storeData.errorResponse);
        let { messages, isOutOfCoverage} = validateErrorClientOMS(errorMessages);
        storeData.messages               = messages;
        storeData.errorMessage           = Resource.msg(storeData.messages[0], "error", null);
        storeData.isOutOfCoverage        = isOutOfCoverage;
    }

}


module.exports = {
    getAvailableStores           : getAvailableStores,
    getStoreTime                 : getStoreTime,
    getOmsData                   : getOmsData,
    getHomeDeliveryStoreData     : getHomeDeliveryStoreData,
    getOutOfStockProductData     : getOutOfStockProductData,
    getStoresTimeForBasket       : getStoresTimeForBasket,
    getListOfUnavailableProducts : getListOfUnavailableProducts,
    getGeolocationData           : getGeolocationData
};
