"use strict";

var base = module.superModule;
var StoreMgr = require("dw/catalog/StoreMgr");
var Site = require("dw/system/Site");
var ProductInventoryMgr = require("dw/catalog/ProductInventoryMgr");
var LoggerUtils         = require("*/cartridge/scripts/utils/LoggerUtils");
var Transaction         = require("dw/system/Transaction");
/**
 * Searches for stores and creates a plain object of the stores returned by the search from Base cartridge
 * @param {string} radius - selected radius
 * @param {string} postalCode - postal code for search
 * @param {string} lat - latitude for search by latitude
 * @param {string} long - longitude for search by longitude
 * @param {Object} geolocation - geloaction object with latitude and longitude
 * @param {boolean} showMap - boolean to show map
 * @param {dw.web.URL} url - a relative url
 * @param {dw.order.Basket} [basket] basket to filter stores via inventories;
 * @returns {Object} a plain object containing the results of the search
 */
function getStoresBase(radius, postalCode, lat, long, geolocation, showMap, url, zone, serviceStores, basket) {
    var StoresModel = require("*/cartridge/models/stores");
    var Site = require("dw/system/Site");
    var URLUtils = require("dw/web/URLUtils");
    var ArrayList = require("dw/util/ArrayList");
    var storesList = new ArrayList();
    var isOOSmessage = false;
    
    if (!empty(serviceStores) && serviceStores.isOOSmessage) {
        isOOSmessage = true;
    }
    
    for (var i = 0; !empty(serviceStores) && serviceStores.length > i; i++) {
        var serviceStore     = serviceStores[i];
        var storeServiceInfo = {};
        
        storeServiceInfo.store          = StoreMgr.getStore(serviceStore.StoreID);
        storeServiceInfo.distance       = serviceStore.Distance;
        storeServiceInfo.currentDayTime = serviceStore.CurrentDayTime;
        storeServiceInfo.nextDayTime    = serviceStore.NextDayTime;
        storesList.push(storeServiceInfo);
    }
    
    var countryCode = geolocation.countryCode;
    var distanceUnit = countryCode === "US" ? "mi" : "km";
    var resolvedRadius = radius ? parseInt(radius, 10) : 300;
    var searchKey = {};
    var storeMgrResult = null;
    var location = {};

    if (postalCode && postalCode !== "") { //NOSONAR
        // find by postal code
        searchKey = postalCode;
        storeMgrResult = StoreMgr.searchStoresByPostalCode(
            countryCode,
            searchKey,
            distanceUnit,
            resolvedRadius
        );
        searchKey = { postalCode: searchKey };
    } else {
        // find by coordinates (detect location)
        if (lat && long || (parseFloat(lat) === 0 && parseFloat(long) === 0)) {
            location.lat = parseFloat(lat);
            location.long = parseFloat(long);
        } else {
            location.lat = geolocation.latitude;
            location.long = geolocation.longitude;
        }
        storeMgrResult = StoreMgr.searchStoresByCoordinates(location.lat, location.long, distanceUnit, resolvedRadius);
        searchKey = { lat: location.lat, long: location.long };
    }

    var actionUrl = url || URLUtils.url("Stores-FindStores", "showMap", showMap).toString();
    var apiKey = Site.getCurrent().getCustomPreferenceValue("mapAPI");
    var stores = new StoresModel(storeMgrResult, searchKey, resolvedRadius, actionUrl, apiKey, zone, storesList.length ? storesList : null, basket);

    if (isOOSmessage) {
        stores.stores = [];
    }

    return stores;
}

/**
 * Searches for stores and creates a plain object of the stores returned by the search
 * @param {string} radius - selected radius
 * @param {string} postalCode - postal code for search
 * @param {string} lat - latitude for search by latitude
 * @param {string} long - longitude for search by longitude
 * @param {Object} geolocation - geloaction object with latitude and longitude
 * @param {boolean} showMap - boolean to show map
 * @param {dw.web.URL} url - a relative url
 * @param {[Object]} products - an array of product ids to quantities that needs to be filtered by.
 * @param {dw.order.Basket} [basket] basket to filter stores via inventories;
 * @returns {Object} a plain object containing the results of the search
 */
function getStores(radius, postalCode, lat, long, geolocation, showMap, url, products, zone, serviceStores, basket) {
    var Resource = require("dw/web/Resource");

    var storesModel = getStoresBase(radius, postalCode, lat, long, geolocation, showMap, url, zone, serviceStores, basket);
    var isStoresAround = (storesModel.stores && storesModel.stores.length);

    if (!isStoresAround) {
        storesModel.storesNoFoundMsg = Resource.msg("error.no.stores.around", "storeLocator", null);
    } else {
        storesModel.storesNoFoundMsg = Resource.msg("error.no.stores.around.with.matching.stock", "storeLocator", null);
    }

    return storesModel;
}

function getZoneId(req) {
    var requestZoneId = req && req.querystring.zone;
    var sessionZoneId = session.custom.mainStore;
    var defaultZoneId = Site.current.getCustomPreferenceValue("zoneId");
        
    return requestZoneId || sessionZoneId || defaultZoneId;
}

function setMainStoreId(mainStore) {
    var apiStore        = !empty(mainStore) && StoreMgr.getStore(mainStore);
    var isExistingStore = !empty(apiStore);
    var zoneId          = mainStore;

    if (isExistingStore) {
        if (!empty(apiStore.custom.zoneId)) {
            var storeName = apiStore.name;
            
            zoneId   = apiStore.custom.zoneId;
            apiStore = StoreMgr.getStore(apiStore.custom.zoneId);
            LoggerUtils.zoneSelectorInfo("Store '" + mainStore + "' (" + storeName + ") was passed as parameter, but using it's zone instead: '" + zoneId + "' (" + apiStore.name + ").");
        }

        session.custom.mainStore = mainStore;

        if (session.customer && !empty(session.customer) && !empty(session.customer.profile) && session.customer.authenticated) {
            Transaction.wrap(function () {
                session.customer.profile.custom.mainStore = mainStore;
            });
        }
        LoggerUtils.zoneSelectorInfo("Store '" + zoneId + "' (" + apiStore.name + ") is now the current zone.");
    } else {
        LoggerUtils.zoneSelectorInfo("Tried to set current zone to '" + mainStore + "', but could not find a zone with this ID.");
    }

    return isExistingStore;
}

function initZoneForFirstSiteAccess() {
    var zoneId   = Site.current.getCustomPreferenceValue("zoneId");
    var apiStore = StoreMgr.getStore(zoneId);
    var result   = {};
    
    if (apiStore) {
        setMainStoreId(zoneId);

        result = {
            zone  : zoneId,
            city  : apiStore.city, 
            state : apiStore.stateCode
        };
    }

    return result;
}

function isMainStoreSet() {
    return !!session.custom.mainStore;
}

function getZoneInventory() {
    var zoneId = getZoneId();
    var zone = StoreMgr.getStore(zoneId);
    var inventoryRecordFromZone;
    if (zone && zone.custom && zone.custom.inventoryListId) {
        var listID = zone.custom.inventoryListId;
        inventoryRecordFromZone = ProductInventoryMgr.getInventoryList(listID);
    }
    return inventoryRecordFromZone;
}

module.exports = exports = {
    createStoresResultsHtml: base.createStoresResultsHtml,
    initZoneForFirstSiteAccess : initZoneForFirstSiteAccess,
    getStores: getStores,
    getZoneId: getZoneId,
    setMainStoreId: setMainStoreId,
    isMainStoreSet : isMainStoreSet,
    getZoneInventory: getZoneInventory
};
