"use strict";

var renderTemplateHelper = require("*/cartridge/scripts/renderTemplateHelper");
var storeHelpers = require("*/cartridge/scripts/helpers/storeHelpers");
var StoreModel = require("*/cartridge/models/store");
var Logger = require("dw/system/Logger");

/**
 * Adding the store inventory list to an existing list of current stores.
 * @param {Array} currentStores - an array of objects that contains store information
 * @param {dw.util.Set} apiStores - a set of <dw.catalog.Store> objects
 * @returns {currentStores} an array of objects that contains store information
 */
function addInventroyList(currentStores, apiStores) {
    Object.keys(apiStores).forEach(function (key) {
        var apiStore = apiStores[key];
        currentStores.forEach(function (store) {
            if (apiStore.ID === store.ID) {
                if (apiStore.inventoryListID ||
                    (apiStore.custom && apiStore.custom.inventoryListId)) {
                    store.inventoryListId = apiStore.inventoryListID ||
                                            apiStore.custom.inventoryListId;
                }
            }
        });
    });
    return currentStores;
}

/**
 * Creates an array of objects containing store information
 * @param {dw.util.LinkedHashSet} storesObject - a set of <dw.catalog.Store> objects
 * @param {dw.order.Basket} [basket] basket to filter stores via inventories;
 * @returns {Array} an array of objects that contains store information
 */
function createStoresObject(storesObject, basket) {
    var ProductInventoryMgr = require("dw/catalog/ProductInventoryMgr");

    var keysObject     = storesObject.keySet();
    var storeModelList = [];
    var lineItemList   = [];

    if (!empty(basket)) {
        lineItemList = basket.allProductLineItems.toArray();
    }
    
    Object.keys(keysObject).forEach(function (key) {
        var store = keysObject[key];
        if (!empty(store.custom.zoneId)) {
            var storeModel     = new StoreModel(store);
            var storeInventory = ProductInventoryMgr.getInventoryList(store.custom.inventoryListId);
    
            storeModel.distance = parseInt(storesObject.get(store)); // eslint-disable-line
            storeModel.isOpenTodayTill = isOpenTodayTill(store.custom.storeHoursData);
            storeModel.custom = {
                zoneId: store.custom.zoneId
            };
    
            if (!empty(basket)) {
                for (let i = 0; i < lineItemList.length; i++) {
                    var lineItem = lineItemList[i];
    
                    if (!storeInventory) {
                        return;
                    }
    
                    var inventoryRecord  = storeInventory.getRecord(lineItem.product);
                    var isProductInStock = inventoryRecord && inventoryRecord.ATS.value >= lineItem.quantityValue;
    
                    if (!isProductInStock) {
                        return;
                    }
                }
            }
    
            storeModelList.push(storeModel);
        }
    });

    return storeModelList;
}

/**
 * Creates an array of objects containing store information from service call
 * @param {Array} an array of stores information
 * @returns {Array} an array of objects that contains store information
 */
function createStoresObj(storesObject) {
    return Object.keys(storesObject)
        .filter(function (key) {
            var storeData = storesObject[key];
            return !!storeData.store;
        })
        .map(function (key) {
            var storeData = storesObject[key];
            var storeModel = new StoreModel(storeData.store);
            storeModel.distance = storeData.distance;
            storeModel.isOpenTodayTill = isOpenTodayTill(storeData.store.custom.storeHoursData);
            storeModel.currentDayTime = getDayPickUpTime(storeData.currentDayTime);
            storeModel.nextDayTime = getDayPickUpTime(storeData.nextDayTime);
            storeModel.custom = {
                zoneId: storeData.store.custom.zoneId
            };
            return storeModel;
        });
}

/**
 * Creates an array of objects containing the coordinates of the store's returned by the search
 * @param {dw.util.LinkedHashSet} storesObject - a set of <dw.catalog.Store> objects
 * @returns {Array} an array of coordinates objects with store info
 */
function createGeoLocationObject(storesArr) {
    var context;
    var template = "storeLocator/storeInfoWindow";
    return storesArr.reduce(function (acc, storeModel) {
        context = { store: storeModel };
        acc.push({
            name: storeModel.name,
            latitude: storeModel.latitude,
            longitude: storeModel.longitude,
            infoWindowHtml: renderTemplateHelper.getRenderedHtml(context, template)
        });
        return acc;
    }, []);
}

/**
 * If there is an api key creates the url to include the google maps api else returns null
 * @param {string} apiKey - the api key or null
 * @returns {string|Null} return the api
 */
function getGoogleMapsApi(apiKey) {
    var googleMapsApi;
    if (apiKey) {
        googleMapsApi = "https://maps.googleapis.com/maps/api/js?key=" + apiKey;
    } else {
        googleMapsApi = null;
    }

    return googleMapsApi;
}

/**
 * 
 * @param {String} storeHoursString 
 * @returns {String|Undefined|Null} return the hour in string if the store is open now
 */
function isOpenTodayTill(storeHoursString) {
    var storeHoursData;
    var nowDate = new Date();
    if (!storeHoursString) {
        return undefined;
    }

    try {
        storeHoursData = JSON.parse(storeHoursString);
    } catch (e) {
        Logger.error("It was not possible to convert storeHoursString");
        return undefined;
    }

    var todayOpenHours = storeHoursData.days[""+nowDate.getDay()];
    var setDateTime = function (date, str) {
        var sp = str.split(":");
        date.setHours(parseInt(sp[0], 10));
        date.setMinutes(parseInt(sp[1], 10));
        date.setSeconds(sp[2] ? parseInt(sp[2], 10) : 0);
        return date;
    };
    var nowTime = nowDate.getTime()
        , start = setDateTime(new Date(), todayOpenHours.start)
        , end = setDateTime(new Date(), todayOpenHours.end);
    return (nowTime > start.getTime() && nowTime < end.getTime()) ? todayOpenHours.end : null;
}

/**
 * 
 * @param {String} pickUpDayTime 
 * @returns {String|Undefined|Null} returns the pick-up hour in string for the store's pick-up
 */
function getDayPickUpTime(pickUpDayTime) {
    if (!pickUpDayTime) {
        return null;
    }
    
    var newDayTime = pickUpDayTime.split("T")[1];
    return newDayTime;
}

function filterStores(stores, zone) {
    //Exclude zones from the returned stores
    stores = stores.filter(function (store) {
        return store.custom.zoneId;
    });

    //filter by zone
    if (zone && stores) {
        stores = stores.reduce(function (acc, store) {
            if (store.custom.zoneId == zone) {
                acc.push(store);
            }
            return acc;
        }, []);
    }
    return stores;
}

/**
 * @constructor
 * @classdesc The stores model
 * @param {dw.util.LinkedHashMap} storesResultsObject - Map of values and keys from stores
 * @param {Object} searchKey - what the user searched by (location or postal code)
 * @param {number} searchRadius - the radius used in the search
 * @param {dw.web.URL} actionUrl - a relative url
 * @param {string} apiKey - the google maps api key that is set in site preferences
 * @param {dw.order.Basket} [basket] basket to filter stores via inventories;
 */
function stores(storesResultsObject, searchKey, searchRadius, actionUrl, apiKey, zone, storesList, basket) {
    var keysObjectStore = storesResultsObject.keySet();
    this.zone = zone;

    if (storesList) {
        this.stores = createStoresObj(storesList);
    } else {
        this.stores = createStoresObject(storesResultsObject, basket);

        if (empty(basket)) {
            this.stores = filterStores(this.stores, zone);
        }
    } 

    this.locations = JSON.stringify(createGeoLocationObject(this.stores));
    this.searchKey = searchKey;
    this.radius = searchRadius;
    this.actionUrl = actionUrl;
    this.googleMapsApi = getGoogleMapsApi(apiKey);
    this.radiusOptions = [300];
    this.storesResultsHtml = this.stores ? storeHelpers.createStoresResultsHtml(this.stores) : null;
    this.stores = addInventroyList(this.stores, keysObjectStore);
}

module.exports = stores;
