"use strict";

/**
 * @module CybersourceFraudScoreServiceDefinition
 */

var getFraudScore = {
    createRequest: function (service, params) {
        service.setRequestMethod("POST");
        service.addHeader("Content-Type", "text/xml");
        return params;
    },

    parseResponse: function (service, response) {
        return response;
    },

    mockFull: function () {
        var response = {
            text : "<soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\">" +
            "<soap:Header>" +
               "<wsse:Security xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\">" +
                  "<wsu:Timestamp xmlns:wsu=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd\" wsu:Id=\"Timestamp-2017522950\">" +
                     "<wsu:Created>2019-03-28T14:36:20.259Z</wsu:Created>" +
                  "</wsu:Timestamp>" +
               "</wsse:Security>" +
            "</soap:Header>" +
            "<soap:Body>" +
               "<c:replyMessage xmlns:c=\"urn:schemas-cybersource-com:transaction-data-1.141\">" +
                  "<c:requestID>5537837799766876604012</c:requestID>" +
                  "<c:decision>ACCEPT</c:decision>" +
                  "<c:reasonCode>102</c:reasonCode>" +
                  "<c:invalidField>c:billTo/c:phoneNumber</c:invalidField>" +
                  "<c:requestToken>AhhBbwSTLDTwGipzecZsJiN/Rm0ky9GK9beIFQAA5Czj</c:requestToken>" +
               "</c:replyMessage>" +
            "</soap:Body>" +
         "</soap:Envelope>"
        };
        return response;
    }

};

module.exports = {
    getFraudScore: getFraudScore
};
