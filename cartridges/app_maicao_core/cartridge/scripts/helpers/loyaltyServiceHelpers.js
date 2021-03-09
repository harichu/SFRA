"use strict";

var base = module.superModule;

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
            "channel" : "Maicao"
        }]
    };
}

module.exports = {
    mockFull        : mockFull,
    setHeaders      : base.setHeaders,
    parseResponse   : base.parseResponse,
    getDocumentData : base.getDocumentData,
    getFormattedCustomerDataForService : base.getFormattedCustomerDataForService
};
