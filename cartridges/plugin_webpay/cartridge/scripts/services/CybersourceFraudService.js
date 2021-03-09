"use strict";

/**
 * @module CybersourceFraudService
 */

var LocalServiceRegistry     = require("dw/svc/LocalServiceRegistry");
var serviceDefinition        = require("~/cartridge/scripts/services/CybersourceFraudScoreServiceDefinition");
var StringWriter             = require("dw/io/StringWriter");
var XMLIndentingStreamWriter = require("dw/io/XMLIndentingStreamWriter");

/**
 * This function receives an XML object and call the Cybersource risk evaluation service with it, returning the result.
 *
 * @param {Object} params - an XML object representing the body of the service call.
 */
function getFraudScore(params) {
    var serviceName   = "transbank.cybersource.fraud";
    var service       = LocalServiceRegistry.createService(serviceName, serviceDefinition.getFraudScore);
    var serviceResult = service.call(convertToXML(params));

    return serviceResult;
}

/**
 * Get all payment informations and create a XML file to be used later.
 * @param {Object} paymentInfo Contains all payment information
 */
function convertToXML(paymentInfo) {
    var body = new StringWriter();
    var xsw  = new XMLIndentingStreamWriter(body);

    xsw.writeStartDocument();
    xsw.writeStartElement("soapenv:Envelope");
    xsw.writeAttribute("xmlns:soapenv", "http://schemas.xmlsoap.org/soap/envelope/");
    xsw.writeAttribute("xmlns:urn", "urn:schemas-cybersource-com:transaction-data-1.141");

    xsw.writeStartElement("soapenv:Header");
    xsw.writeStartElement("wsse:Security");
    xsw.writeAttribute("soapenv:mustUnderstand", "1");
    xsw.writeAttribute("xmlns:wsse", "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd");

    xsw.writeStartElement("wsse:UsernameToken");
    xsw.writeStartElement("wsse:Username");
    xsw.writeCharacters(paymentInfo.merchantID);
    xsw.writeEndElement();
    xsw.writeStartElement("wsse:Password");
    xsw.writeAttribute("Type", "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wssusername-token-profile-1.0#PasswordText");
    xsw.writeCharacters(paymentInfo.transactionKey);
    xsw.writeEndElement();
    xsw.writeEndElement();
    xsw.writeEndElement();
    xsw.writeEndElement();

    xsw.writeStartElement("soapenv:Body");
    xsw.writeStartElement("urn:requestMessage");
    xsw.writeStartElement("urn:merchantID");
    xsw.writeCharacters(paymentInfo.merchantID);
    xsw.writeEndElement();

    xsw.writeStartElement("urn:merchantReferenceCode");
    xsw.writeCharacters(paymentInfo.merchantReferenceCode);
    xsw.writeEndElement();

    xsw.writeStartElement("urn:billTo");
    xsw.writeStartElement("urn:firstName");
    xsw.writeCharacters(paymentInfo.billTo.firstName);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:lastName");
    xsw.writeCharacters(paymentInfo.billTo.lastName);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:street1");
    xsw.writeCharacters(paymentInfo.billTo.street1);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:street2");
    xsw.writeCharacters(paymentInfo.billTo.street2);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:city");
    xsw.writeCharacters(paymentInfo.billTo.city);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:state");
    xsw.writeCharacters(paymentInfo.billTo.state);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:country");
    xsw.writeCharacters(paymentInfo.billTo.country);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:phoneNumber");
    xsw.writeCharacters(paymentInfo.billTo.phoneNumber);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:email");
    xsw.writeCharacters(paymentInfo.customerData.email);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:ipAddress");
    xsw.writeCharacters(paymentInfo.billTo.ipAddress);
    xsw.writeEndElement();
    xsw.writeEndElement();

    if (paymentInfo.shipTo) {
        xsw.writeStartElement("urn:shipTo");
        if (paymentInfo.shipTo.firstName) {
            xsw.writeStartElement("urn:firstName");
            xsw.writeCharacters(paymentInfo.shipTo.firstName);
            xsw.writeEndElement();
        }
        if (paymentInfo.shipTo.lastName) {
            xsw.writeStartElement("urn:lastName");
            xsw.writeCharacters(paymentInfo.shipTo.lastName);
            xsw.writeEndElement();
        }
        xsw.writeStartElement("urn:street1");
        xsw.writeCharacters(paymentInfo.shipTo.street1);
        xsw.writeEndElement();
        xsw.writeStartElement("urn:street2");
        xsw.writeCharacters(paymentInfo.shipTo.street2);
        xsw.writeEndElement();
        xsw.writeStartElement("urn:city");
        xsw.writeCharacters(paymentInfo.shipTo.city);
        xsw.writeEndElement();
        xsw.writeStartElement("urn:state");
        xsw.writeCharacters(paymentInfo.shipTo.state);
        xsw.writeEndElement();
        xsw.writeStartElement("urn:country");
        xsw.writeCharacters(paymentInfo.shipTo.country);
        xsw.writeEndElement();
        xsw.writeStartElement("urn:email");
        xsw.writeCharacters(paymentInfo.customerData.email);
        xsw.writeEndElement();
        xsw.writeStartElement("urn:shippingMethod");
        xsw.writeCharacters(paymentInfo.shipTo.shippingMethod);
        xsw.writeEndElement();
        xsw.writeEndElement();
    }

    for (var itemCounter in paymentInfo.items) {
        var item = paymentInfo.items[itemCounter];
        xsw.writeStartElement("urn:item");
        xsw.writeAttribute("id", itemCounter);
        xsw.writeStartElement("urn:unitPrice");
        xsw.writeCharacters(item.getAdjustedPrice().getDecimalValue());
        xsw.writeEndElement();
        xsw.writeStartElement("urn:quantity");
        xsw.writeCharacters(item.getQuantityValue());
        xsw.writeEndElement();
        xsw.writeStartElement("urn:productCode");
        xsw.writeCharacters(item.getProductID());
        xsw.writeEndElement();
        xsw.writeStartElement("urn:productName");
        xsw.writeCharacters(item.getProductName());
        xsw.writeEndElement();
        xsw.writeStartElement("urn:productSKU");
        xsw.writeCharacters(item.getProductID());
        xsw.writeEndElement();
        xsw.writeEndElement();
    }

    xsw.writeStartElement("urn:purchaseTotals");
    xsw.writeStartElement("urn:currency");
    xsw.writeCharacters(paymentInfo.purchaseTotals.currency);
    xsw.writeEndElement();
    xsw.writeEndElement();

    var card     = paymentInfo.card.paymentMethod.htmlValue == "CREDIT_CARD" ? paymentInfo.card.creditCardFields : paymentInfo.card.debitCardFields;
    var fullName = card.firstname.htmlValue + " " + card.lastname.htmlValue;

    xsw.writeStartElement("urn:card");
    xsw.writeStartElement("urn:fullName");
    xsw.writeCharacters(fullName);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:accountNumber");
    xsw.writeCharacters(card.cardNumber.htmlValue);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:expirationMonth");
    xsw.writeCharacters(card.expirationMonth.htmlValue);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:expirationYear");
    xsw.writeCharacters(card.expirationYear.htmlValue);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:cvNumber");
    xsw.writeCharacters(card.securityCode.htmlValue);
    xsw.writeEndElement();
    xsw.writeEndElement();

    xsw.writeStartElement("urn:merchantDefinedData");
    if (paymentInfo.numberInstallments) {
        xsw.writeStartElement("urn:mddField");
        xsw.writeAttribute("id", "3");
        xsw.writeCharacters(paymentInfo.numberInstallments);
        xsw.writeEndElement();
    }
    xsw.writeStartElement("urn:mddField");
    xsw.writeAttribute("id", "5");
    xsw.writeCharacters(paymentInfo.domain);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:mddField");
    xsw.writeAttribute("id", "2");
    xsw.writeCharacters(paymentInfo.customerData.isGuest);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:mddField");
    xsw.writeAttribute("id", "7");
    xsw.writeCharacters(paymentInfo.customerData.numberOrders);
    xsw.writeEndElement();
    xsw.writeStartElement("urn:mddField");
    xsw.writeAttribute("id", "8");
    xsw.writeCharacters(paymentInfo.customerData.contactNumber);
    xsw.writeEndElement();
    if (paymentInfo.shipTo) {
        if (paymentInfo.shipTo.estimatedDate) {
            xsw.writeStartElement("urn:mddField");
            xsw.writeAttribute("id", "9");
            xsw.writeCharacters(paymentInfo.shipTo.estimatedDate);
            xsw.writeEndElement();
        }
    }
    if (paymentInfo.shipTo) {
        xsw.writeStartElement("urn:mddField");
        xsw.writeAttribute("id", "10");
        xsw.writeCharacters(paymentInfo.shipTo.shippingMethod);
        xsw.writeEndElement();
    }
    xsw.writeStartElement("urn:mddField");
    xsw.writeAttribute("id", "11");
    xsw.writeCharacters("N");
    xsw.writeEndElement();
    if (paymentInfo.couponCode) {
        xsw.writeStartElement("urn:mddField");
        xsw.writeAttribute("id", "13");
        xsw.writeCharacters(paymentInfo.couponCode);
        xsw.writeEndElement();
    }
    xsw.writeEndElement();

    xsw.writeStartElement("urn:afsService");
    xsw.writeAttribute("run", "true");
    xsw.writeEndElement();
    xsw.writeStartElement("urn:deviceFingerprintID");
    xsw.writeCharacters(paymentInfo.billTo.deviceFingerPrintId);
    xsw.writeEndElement();
    xsw.writeEndElement();
    xsw.writeEndElement();
    xsw.writeEndElement();
    xsw.writeEndDocument();

    xsw.close();
    body.close();

    return body.toString();
}

module.exports = {
    getFraudScore: getFraudScore
};
