"use strict";

var Site        = require("dw/system/Site");
var preferences = Site.getCurrent().getPreferences().getCustom();

/**
 * Callback function to mock the Loyalty Response.
 * To be used inside the mockFull callback
 */
function mockFull() {
    return {
        "Customer": [{
            "ID Type"              : "RUT",
            "Identificationnumber" : "16340221-K",
            "Name"                 : "Pedro ",
            "Name2"                : "Sebastian",
            "lastName"             : "Hernandez",
            "lastName2"            : "Bustamante",
            "email"                : "phernandez@difarma.cl",
            "phoneNumber"          : 561975813502,
            "birthday"             : "12/02/1988",
            "createdFrom"          : "ECOMM",
            "Createtime"           : "25/06/2019 13:00:00",
            "gender"               : "M"
        }],
        "Address": [{
            "streetAddress" : "Camino el roble 1578",
            "city"          : "Santiago",
            "Location"      : "Huechuraba",
            "State"         : "RM",
            "Country"       : "Chile"
        }],
        "Program": [{
            "programAffiliation" : "Cardiovascular",
            "healthInstitution"  : "CruzBlanca",
            "totalSaved"         : "$5.356",
            "clubLevel"          : "SILVER"
        }],
        "Channel": [{
            "channel" : "CVCH"
        }]
    };
}

/**
 * Sets up the proper header values.
 * To be used inside the createRequest callback
 * @param {dw.svc.Service} service an instance of the service
 */
function setHeaders(service) {
    service.addHeader("X-IBM-Client-Id", preferences.authorizationheader);
    service.addHeader("Channel",         preferences.siteChannel);
    service.addHeader("Content-Type",    "application/json");
}

/**
 * Callback function to parse a service response
 * @param {dw.svc.Service} service the service instance
 * @param {Object} output the output object returned by the API call
 */
function parseResponse(_service, output) {
    return JSON.parse(output.text);
}

/**
 * Gets the customer's document data used as key for the Loyalty Service
 *
 * @param {dw.customer.Customer} apiCustomer
 * @returns {Object} An object with the customer's document data
 */
function getDocumentData(apiCustomer) {
    return {
        docType   : "RUT",
        docNumber : apiCustomer.profile.custom.difarmaRunRutNit
    };
}

/**
 * Gets an object with customer data in the format expected by the Loyalty Service
 *
 * @param {dw.customer.Customer} apiCustomer
 * @returns {Object} The object with the customer data
 */
function getFormattedCustomerDataForService(apiCustomer) {
    var apiProfile        = apiCustomer.profile;
    var birthdayDate      = apiProfile.birthday || new Date(0);
    var formattedBirthday = birthdayDate.toISOString().substring(0, 10).split("-").reverse().join("-");
    var customerData      = {
        "Customer": {
            "Name"        : apiProfile.firstName,
            "lastName"    : apiProfile.lastName,
            "lastName2"   : apiProfile.suffix || apiProfile.lastName,
            "email"       : apiProfile.email,
            "phoneNumber" : apiProfile.phoneMobile.replace(/\D/g, ""),
            "birthday"    : formattedBirthday,
            "gender"      : apiProfile.gender.value === 2 ? "M" : "F"
        },
        "Program": {
            "healthInstitution" : apiProfile.custom.pensionHealthInstitution.displayValue
        }
    };

    return customerData;
}

module.exports = {
    mockFull        : mockFull,
    setHeaders      : setHeaders,
    parseResponse   : parseResponse,
    getDocumentData : getDocumentData,
    getFormattedCustomerDataForService : getFormattedCustomerDataForService
};
