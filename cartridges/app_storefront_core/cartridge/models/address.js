"use strict";

/**
 * creates a plain object that contains address information
 * @param {dw.order.OrderAddress} addressObject - User's address
 * @returns {Object} an object that contains information about the users address
 */
function createAddressObject(addressObject) {
    var result;
    if (addressObject) {
        var isApiObject = !Object.hasOwnProperty.call(addressObject, "raw");

        result = {
            address1: addressObject.address1,
            address2: addressObject.address2,
            city: addressObject.city,
            firstName: addressObject.firstName,
            lastName: addressObject.lastName,
            ID: Object.hasOwnProperty.call(addressObject, "ID")
                ? addressObject.ID : null,
            addressId: Object.hasOwnProperty.call(addressObject, "ID")
                ? addressObject.ID : null,
            phone: addressObject.phone,
            postalCode: addressObject.postalCode,
            stateCode: addressObject.stateCode,
            jobTitle: addressObject.jobTitle,
            postBox: addressObject.postBox,
            salutation: addressObject.salutation,
            secondName: addressObject.secondName,
            companyName: addressObject.companyName,
            suffix: addressObject.suffix,
            suite: addressObject.suite,
            title: addressObject.title,
            barrio: Object.hasOwnProperty.call(addressObject, "barrio")
                ? addressObject.barrio : null,
            whotakesRut: Object.hasOwnProperty.call(addressObject, "whotakesRut")
                ? addressObject.whotakesRut : null,
            whotakesName: Object.hasOwnProperty.call(addressObject, "whotakesName")
                ? addressObject.whotakesName : null,
            latitude  : isApiObject ? addressObject.custom.latitude  : addressObject.raw.custom.latitude,
            longitude : isApiObject ? addressObject.custom.longitude : addressObject.raw.custom.longitude
        };

        if (result.stateCode === "undefined") {
            result.stateCode = "";
        }
        if (Object.hasOwnProperty.call(addressObject, "custom")) {
            if (result.barrio == null && Object.hasOwnProperty.call(addressObject.custom, "barrio")) {
                result.barrio = addressObject.custom.barrio;
            }
            if (result.whotakesRut == null && Object.hasOwnProperty.call(addressObject.custom, "whotakesRut")) {
                result.whotakesRut = addressObject.custom.whotakesRut || "";
            }
            if (result.whotakesName == null && Object.hasOwnProperty.call(addressObject.custom, "whotakesName")) {
                result.whotakesName = addressObject.custom.whotakesName || "";
            }
        }

        if (Object.hasOwnProperty.call(addressObject, "countryCode")) {
            result.countryCode = {
                displayValue: addressObject.countryCode.displayValue,
                value: addressObject.countryCode.value.toUpperCase()
            };
        }
    } else {
        result = null;
    }
    return result;
}

/**
 * Address class that represents an orderAddress
 * @param {dw.order.OrderAddress} addressObject - User's address
 * @constructor
 */
function address(addressObject) {
    this.address = createAddressObject(addressObject);
}

module.exports = address;
