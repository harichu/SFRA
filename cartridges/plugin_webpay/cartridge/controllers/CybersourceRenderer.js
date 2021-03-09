"use strict";

/**
 * Controller for rendering the device fingerprint
 */

// API includes
var server = require("server");
var Site   = require("dw/system/Site");

// Cybersource data
var sitePreferences          = Site.getCurrent().getPreferences().getCustom();
var merchantID               = sitePreferences.tbkCybersourceMerchantId;
var organizationID           = sitePreferences.tbkCybersourceOrganizationID;
var location                 = sitePreferences.tbkCybersourceDeviceFingerprintJetmetrixLocation;
var devicefingerprintTTL     = sitePreferences.tbkCybersourceDeviceFingerprintTTL;
var deviceFingerprintEnabled = sitePreferences.tbkCybersourceDeviceFingerprintEnabled;

/**
 * Check if we have DFD (DeviceFingerprintData) and, if yes, grab it
 * @returns {Object} Object with all DFD Data.
 */
function getDeviceFingerPrintData() {
    var dateNow              = new Date().valueOf();
    var getDeviceFingerprint = false;
    if (deviceFingerprintEnabled) {
        if (empty(session.custom.deviceFingerprintTime)) {
            session.custom.deviceFingerprintTime = dateNow;
            getDeviceFingerprint = true;
        } else {
            var timeSinceLastFingerprint = dateNow - session.custom.deviceFingerprintTime;
            if (timeSinceLastFingerprint > devicefingerprintTTL) {
                session.custom.deviceFingerprintTime = dateNow;
                getDeviceFingerprint = true;
            }
        }
    }

    var url = location + "/fp/tags.js?org_id=" + organizationID + "&session_id=" + merchantID + session.sessionID;

    return {
        url: url,
        getDeviceFingerprint: getDeviceFingerprint
    };
}


server.get("GetFingerprint", function (req, res, next) {
    var deviceFingerPrintData = getDeviceFingerPrintData();
    res.cacheExpiration(0);
    res.render("common/deviceFingerPrint", deviceFingerPrintData);
    next();
});

server.get("GetFingerprintHead", function (req, res, next) {
    var url = location + "/fp/tags.js?org_id=" + organizationID + "&session_id=" + merchantID + session.sessionID;
    res.cacheExpiration(0);
    res.render("common/deviceFingerPrintHead", {url: url});
    next();
});

module.exports = server.exports();
