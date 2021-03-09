"use strict";

var server = require("server");
var cache = require("*/cartridge/scripts/middleware/cache");
var storeHelpers = require("*/cartridge/scripts/helpers/storeHelpers");
var consentTracking = require("*/cartridge/scripts/middleware/consentTracking");
var Site = require("dw/system/Site");
var StoreMgr = require("dw/catalog/StoreMgr");
var LoggerUtils = require("*/cartridge/scripts/utils/LoggerUtils");

var preferences              = Site.getCurrent().getPreferences().getCustom();
var isZoneCityMappingEnabled = Site.current.getCustomPreferenceValue("enableCityZoneMapping");

server.extend(module.superModule);

server.replace("Find", server.middleware.https, cache.applyDefaultCache, consentTracking.consent, function (req, res, next) {
    var pageMetaHelper = require("*/cartridge/scripts/helpers/pageMetaHelper");

    var radius = preferences.storelocatorRadius;
    var postalCode = req.querystring.postalCode;
    var lat = req.querystring.lat;
    var long = req.querystring.long;
    var showMap = req.querystring.showMap || "true";
    var horizontalView = req.querystring.horizontalView || "true";
    var isForm = req.querystring.isForm || "true";
    var defaultLat = Site.getCurrent().getCustomPreferenceValue("defaultLatitude");
    var defaultLong = Site.getCurrent().getCustomPreferenceValue("defaultLongitude");
    var stores = storeHelpers.getStores(radius, postalCode, lat, long, req.geolocation, showMap);
    var viewData = {
        isStoreLocatorPage : true,
        stores: stores,
        horizontalView: horizontalView,
        isForm: isForm,
        showMap: showMap,
        defaultLat: defaultLat,
        defaultLong: defaultLong
    };

    pageMetaHelper.setPageMetaData(req.pageMetaData, {
        pageTitle       : preferences.storesPageTitle,
        pageDescription : preferences.storesPageDescription
    });

    res.render("storeLocator/storeLocator", viewData);
    next();
});

server.post("SetMainStoreByZone", function (req, res, next) {
    var zoneId        = req.form.zone;
    var store         = null;
    var defaultZoneId = Site.current.getCustomPreferenceValue("zoneId");

    if (isZoneCityMappingEnabled) {
        var cityName  = req.form.cityName;
        var stateName = req.form.stateName;
        var storeData = storeHelpers.setMainStoreId(zoneId);

        if (zoneId) {
            store = StoreMgr.getStore(zoneId);

            if (!empty(store)) {
                storeHelpers.setMainStoreId(store.ID);
            } else {
                store = StoreMgr.getStore(defaultZoneId);
                cityName  = store.city;
                stateName = store.stateCode;
                storeHelpers.setMainStoreId(store.ID);
            }

            res.json({
                needReload : true,
                stateName  : stateName,
                cityName   : cityName,
                url        : require("dw/web/URLUtils").url("Stores-Find", "lat", store.latitude, "long", store.longitude, "delsrch", true).toString()
            });

            return next();
        }
    } else {
        var zoneName = req.form.zoneName;

        if (zoneId) {
            store = StoreMgr.getStore(zoneId);

            if (!empty(store)) {
                storeHelpers.setMainStoreId(store.ID);
            } else {
                store = StoreMgr.getStore(defaultZoneId);
                zoneName  = store.city;
                storeHelpers.setMainStoreId(store.ID);
            }

            res.json({
                needReload : true,
                cityName   : zoneName,
                url        : require("dw/web/URLUtils").url("Stores-Find", "lat", store.latitude, "long", store.longitude, "delsrch", true).toString()
            });

            return next();
        }
    }

    res.json({
        needReload : (zoneId !== undefined) && storeData
    });

    next();
});

server.post("FindZone", function (req, res, next) {
    var GeolocationUtils = require("*/cartridge/scripts/utils/GeolocationUtils");

    var defaultZoneId = Site.current.getCustomPreferenceValue("zoneId");
    var zoneId        = req.querystring.zone || session.custom.mainStore || defaultZoneId;
    var lat           = null;
    var long          = null;
    var cityName      = null;
    var stateName     = null;
    var apiStore      = null;

    if (isZoneCityMappingEnabled) {
        lat  = Number(req.form.lat) || null;
        long = Number(req.form.long) || null;

        var distanceUnit = req.geolocation.countryCode === "US" ? "mi" : "km";
        var rad          = preferences.storelocatorRadius;
        var geolocation  = GeolocationUtils.getFallbackGeolocation(lat, long);

        if (geolocation.isDefaultLocation) {
            var defaultZone = StoreMgr.getStore(defaultZoneId);
            cityName        = defaultZone.city;
            stateName       = defaultZone.stateCode;
            storeHelpers.setMainStoreId(defaultZoneId);
        } else {
            LoggerUtils.zoneSelectorInfo("Searching for stores around (" + geolocation.lat + ", " + geolocation.lng + ") within " + rad + "km...");
            var apiStoreSet = StoreMgr.searchStoresByCoordinates(Number(geolocation.lat), Number(geolocation.lng), distanceUnit, rad);
            if (apiStoreSet.length > 0) {
                LoggerUtils.zoneSelectorInfo("...Found " + apiStoreSet.length + " stores.");
                for (apiStore in apiStoreSet) {

                    cityName  = apiStore.city;
                    stateName = apiStore.stateCode;
                    storeHelpers.setMainStoreId(apiStore.ID);
                    break;
                }
            } else {
                LoggerUtils.zoneSelectorInfo("...No store found.");
                apiStore   = StoreMgr.getStore(zoneId);
                cityName   = apiStore.city;
                stateName  = apiStore.stateCode;
                storeHelpers.setMainStoreId(apiStore.ID);
            }
        }

        res.json({
            stateName  : stateName,
            cityName   : cityName,
            needReload : true
        });
    } else {
        var radius;
        var showMap = true;
        lat  = req.form.lat;
        long = req.form.long;
        var zone = storeHelpers.getZoneId(req);

        if (zone === undefined) {
            var stores = storeHelpers.getStores(radius, null, lat, long, req.geolocation, showMap, undefined, undefined, zone);
            if (stores.stores.length) {
                if (stores.stores[0].custom.zoneId) {
                    storeHelpers.setMainStoreId(stores.stores[0].ID);
                    res.json({
                        cityName   : cityName,
                        needReload : true
                    });
                    return next();
                }

                res.json({
                    needReload : false
                });
            } else {
                storeHelpers.setMainStoreId(zoneId);
                apiStore = StoreMgr.getStore(zoneId);
                cityName = apiStore.city;

                res.json({
                    cityName   : cityName,
                    needReload : true
                });
            }
        }
    }

    next();
});

server.get("ZoneSelector", function (req, res, next) {
    var SystemObjectMgr = require("dw/object/SystemObjectMgr");
    var COHelpers       = require("*/cartridge/scripts/checkout/checkoutHelpers");

    var dmList                              = COHelpers.getDepartamentosAndMunicipios();
    var isOnSideMenu                        = req.querystring.isOnSideMenu;
    var defaultZoneId                       = Site.current.getCustomPreferenceValue("zoneId");
    var selectedCityName                    = null;
    var selectedStateName                   = null;

    if (isZoneCityMappingEnabled) {
        if (!session.custom.mainStore) {
            var store = StoreMgr.getStore(defaultZoneId);
            selectedCityName  = store.city;
            selectedStateName = store.stateCode;
        }

        res.render("/components/header/zoneSelector", {
            isZoneCityMappingEnabled            : isZoneCityMappingEnabled,
            departamentos                       : dmList.departamentos,
            municipios                          : dmList.municipios,
            zoneId                              : zoneId,
            cityName                            : selectedCityName,
            stateName                           : selectedStateName,
            isOnSideMenu                        : isOnSideMenu
        });

    } else {
        var zoneId      = req.querystring.zone || session.custom.mainStore || defaultZoneId;
        var apiStore    = StoreMgr.getStore(zoneId);
        var zoneOptions = [];
        var keyZones    = {};
        var stores      = {};
        var cityName    = null;

        if (apiStore) {
            cityName = apiStore.city;
            storeHelpers.setMainStoreId(zoneId);
        }

        try {
            var zones = SystemObjectMgr.querySystemObjects("Store", "", "custom.zoneId ASC");
            while (zones.hasNext()) {
                var zone = zones.next();
                if (!zone.custom.zoneId) {
                    stores[zone.ID] = {
                        ID        : zone.ID,
                        name      : zone.name,
                        latitude  : zone.latitude,
                        longitude : zone.longitude
                    };
                } else {
                    keyZones[zone.custom.zoneId] = true;
                }
            }
            for (var i in stores) {
                if (keyZones[i]) {
                    zoneOptions.push(stores[i]);
                }
            }
        } catch (e) {
            zoneOptions = [];
        }

        res.render("/components/header/zoneSelector", {
            isZoneCityMappingEnabled            : isZoneCityMappingEnabled,
            zoneId                              : zoneId,
            cityName                            : cityName,
            zoneOptions                         : zoneOptions,
            isOnSideMenu                        : isOnSideMenu
        });
    }

    next();
});

server.get("StoreTime", function (req, res, next) {
    var BasketMgr        = require("dw/order/BasketMgr");
    var inventoryHelpers = require("*/cartridge/scripts/helpers/inventoryHelpers");

    var basket    = BasketMgr.getCurrentBasket();
    var storeID   = req.querystring.storeID;
    var storeData = inventoryHelpers.getStoreTime(storeID, req, basket.productLineItems);

    res.json({
        storeData : storeData
    });

    next();
});

module.exports = server.exports();
