"use strict";

var base = module.superModule;

/**
 * Callback function to mock the Loyalty Response.
 * To be used inside the mockFull callback
 */
function mockFull() {
    return {
        "Program": [
            {
                "totalSaved": null,
                "programAffiliation": null,
                "clubLevel": null,
                "healthInstitution": null
            }
        ],
        "Address": [
            {
                "streetAddress": "opcional",
                "city": "",
                "State": "",
                "Country": "COLOMBIA",
                "Location": ""
            }
        ],
        "Customer": [
            {
                "birthday": "1980-12-15",
                "lastName": "MANCILLA",
                "phoneNumber": "56977668022",
                "ID Type": "CC",
                "createdFrom": null,
                "gender": "",
                "Createtime": null,
                "Identificationnumber": "1234567654888",
                "lastName2": "OPCIONAL",
                "email": "correoa@gmail.com",
                "Name": "DAVID",
                "Name2": "OPCIONAL"
            }
        ],
        "Channel": [
            {
                "channel": "FCV"
            }
        ]
    };
}

/**
 * Gets the customer's document data used as key for the Loyalty Service
 *
 * @param {dw.customer.Customer} apiCustomer
 * @returns {Object} An object with the customer's document data
 */
function getDocumentData(apiCustomer) {
    var docType    = null;
    var docNumber  = null;
    var customData = apiCustomer.profile.custom;

    if (customData.ceDocument) {
        docType   = "CE";
        docNumber = customData.ceDocument;
    }

    if (customData.ccDocument) {
        docType   = "CC";
        docNumber = customData.ccDocument;
    }

    if (customData.passport) {
        docType   = "PAS";
        docNumber = customData.passport;
    }

    return {
        docType   : docType,
        docNumber : docNumber
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
    var docData           = getDocumentData(apiCustomer);
    var customerData      = {
        "Customer": [
            {
                "birthday"             : formattedBirthday,
                "lastName"             : apiProfile.lastName,
                "phoneNumber"          : apiProfile.phoneMobile.replace(/\D/g, ""),
                "Identificationnumber" : docData.docNumber,
                "ID Type"              : docData.docType,
                "email"                : apiProfile.email,
                "Name"                 : apiProfile.firstName
            }
        ]
    };

    return customerData;
}

module.exports = {
    mockFull        : mockFull,
    setHeaders      : base.setHeaders,
    parseResponse   : base.parseResponse,
    getDocumentData : getDocumentData,
    getFormattedCustomerDataForService : getFormattedCustomerDataForService
};
