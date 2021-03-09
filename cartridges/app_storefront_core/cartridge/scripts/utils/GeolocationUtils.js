"use strict";

var Site     = require("dw/system/Site");
var StoreMgr = require("dw/catalog/StoreMgr");

/**
 * Gets geolocation data and handles fallbacks:
 *  - uses param data,    if it is not available,
 *  - uses IP-based data, if it is not available,
 *  - uses custom preference data;
 * 
 * @param {String} latitudeParam 
 * @param {String} longitudeParam
 * @return {Object} An object with a pair of "lat" and "lng" attributes, representing the customer's coordinates.
 */
function getFallbackGeolocation(latitudeParam, longitudeParam) {
    var ipBasedGeolocation = request.getGeolocation();
    var currentSite        = Site.current;
    var result             = {
        isDefaultLocation : false
    };

    if (!empty(latitudeParam) && !empty(longitudeParam)) { // This means browser data has been received.
        result.lat = String(latitudeParam);
        result.lng = String(longitudeParam);
    } else if (ipBasedGeolocation.available && currentSite.getCustomPreferenceValue("isIPGeolocationEnabled")) {
        result.lat                          = String(ipBasedGeolocation.latitude);
        result.lng                          = String(ipBasedGeolocation.longitude);
        result.isOtherThanStorefrontCountry = ipBasedGeolocation.countryCode != currentSite.getCustomPreferenceValue("CountryCode");
    } else {
        var defaultZoneId = currentSite.getCustomPreferenceValue("zoneId");
        var defaultZone   = StoreMgr.getStore(defaultZoneId);
        result.lat = String(defaultZone.latitude);
        result.lng = String(defaultZone.longitude);
        result.isDefaultLocation = true;
    }

    return result;
}

module.exports = {
    getFallbackGeolocation : getFallbackGeolocation
};
