"use strict";

var Logger = require("dw/system/Logger");

var SERVICE_FILE_NAME_PREFIX      = "services";
var SERVICE_CATEGORY              = "service";
var ZONE_SELECTOR_NAME_PREFIX     = "zoneselector";
var ZONE_SELECTOR_CATEGORY        = "zoneselector";
var BASKET_VALIDATION_NAME_PREFIX = "basketvalidation";
var BASKET_VALIDATION_CATEGORY    = "basketvalidation";
var SESSION_NAME_PREFIX           = "session";
var SESSION_CATEGORY              = "session";

/**
 * Append a log file for services;
 * @param message String 
 */
function serviceInfo(message) {
    var formattedMessage = "\n\nSession ID: " + session.sessionID + "\n" + message;
    Logger.getLogger(SERVICE_FILE_NAME_PREFIX, SERVICE_CATEGORY).info(formattedMessage);
}

/**
 * Append a log file for zone selection;
 * @param message String 
 */
function zoneSelectorInfo(message) {
    var formattedMessage = "\n\nSession ID: " + session.sessionID + "\n" + message;
    Logger.getLogger(ZONE_SELECTOR_NAME_PREFIX, ZONE_SELECTOR_CATEGORY).info(formattedMessage);
}

/**
 * Append a log file for session;
 * @param message String 
 */
function sessionInfo(message) {
    var formattedMessage = "\n\nSession ID: " + session.sessionID + "\n" + message;
    Logger.getLogger(SESSION_NAME_PREFIX, SESSION_CATEGORY).info(formattedMessage);
}

/**
 * Append a log file for session;
 * @param message String 
 */
function sessionError(message) {
    var formattedMessage = "\n\nSession ID: " + session.sessionID + "\n" + message;
    Logger.getLogger(SESSION_NAME_PREFIX, SESSION_CATEGORY).error(formattedMessage);
}

/**
 * Append a log file for basket validation;
 * @param message String 
 */
function basketValidationInfo(message) {
    var formattedMessage = "\n\nSession ID: " + session.sessionID + "\n" + message;
    Logger.getLogger(BASKET_VALIDATION_NAME_PREFIX, BASKET_VALIDATION_CATEGORY).info(formattedMessage);
}

/**
 * Append a log file for basket validation;
 * @param message String 
 */
function basketValidationError(message) {
    var formattedMessage = "\n\nSession ID: " + session.sessionID + "\n" + message;
    Logger.getLogger(BASKET_VALIDATION_NAME_PREFIX, BASKET_VALIDATION_CATEGORY).error(formattedMessage);
}

/**
 * Append a log file for services;
 * @param message String 
 */
function serviceError(message) {
    var formattedMessage = "\n\nSession ID: " + session.sessionID + "\n" + message;
    Logger.getLogger(SERVICE_FILE_NAME_PREFIX, SERVICE_CATEGORY).error(formattedMessage);
}

/**
 * Append a log file for services;
 * @param message String 
 */
function standardInfo(message) {
    var formattedMessage = "\n\nSession ID: " + session.sessionID + "\n" + message;
    Logger.info(formattedMessage);
}

/**
 * Append a log file for services;
 * @param message String 
 */
function standardError(message) {
    var formattedMessage = "\n\nSession ID: " + session.sessionID + "\n" + message;
    Logger.error(formattedMessage);
}

module.exports = {
    serviceInfo           : serviceInfo,
    zoneSelectorInfo      : zoneSelectorInfo,
    basketValidationInfo  : basketValidationInfo,
    sessionInfo           : sessionInfo,
    serviceError          : serviceError,
    basketValidationError : basketValidationError,
    sessionError          : sessionError,
    standardInfo          : standardInfo,
    standardError         : standardError
};
