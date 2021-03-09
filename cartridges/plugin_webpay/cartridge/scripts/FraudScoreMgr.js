"use strict";

/**
 * @module FraudScoreMgr
 */

var Logger                  = require("dw/system/Logger");
var Reader                  = require("dw/io/Reader");
var Site                    = require("dw/system/Site");
var XMLStreamReader         = require("dw/io/XMLStreamReader");
var XMLStreamConstants      = require("dw/io/XMLStreamConstants");
var cybersourceFraudService = require("*/cartridge/scripts/services/CybersourceFraudService");

/**
 * This function receives payment data and returns the corresponding fraud score assessment as a string.
 *
 * @param {dw.order.Order} order The current order.
 * @param {Object} params Contains information needed for the Cybersource API to work correctly. Usually these pieces of information are available in the billing form.
 * @param {Object} params.card An object containing the credit card information.
 * @param {String} params.card.fullName The full name of the card's owner.
 * @param {String} params.card.accountNumber The card PAN.
 * @param {String} params.card.expirationMonth The card expiration month.
 * @param {String} params.card.expirationYear The card expiration year.
 * @param {String} params.card.cvNumber The card CVV.
 * @param {String} params.contactNumber The contact number provided by the user.
 * @param {String} params.orderNumber The number of the order.
 * @param {String} params.customerEmail The email provided by the user.
 * @param {String} params.billingEmail The email provided by the user in the billing form.
 * @param {String} params.billingFirstName The first name provided by the user in the billing form.
 * @param {String} params.billingLastName The last name provided by the user in the billing form.
 * @param {String} params.billingPhone The phone number provided by the user in the billing form.
 * @param {String} params.shipmentEmail The email provided by the user in the shipment form.
 * @param {String} params.shipmentFirstName The first name provided by the user in the shipment form.
 * @param {String} params.shipmentLastName The last name provided by the user in the shipment form.
 * @param {String} params.[numberInstallments] The number of installments that the user choose.
 * @param {String} params.[params.couponCode] The coupon code.
 *
 * @returns {String} The result from the Cybersource fraud score.
 */
function getFraudScore(order, params) {
    var sitePreferences = Site.getCurrent().getPreferences().getCustom();
    var merchantID      = sitePreferences.tbkCybersourceMerchantId;
    var transactionKey  = sitePreferences.tbkCybersourceTransactionKey;
    var orderNumber     = order.orderNo;
    var customer        = order.getCustomer();
    var customerData    = {
        isGuest       : customer.isRegistered() ? "N" : "Y",
        numberOrders  : customer.getOrderHistory().getOrderCount().toString(),
        contactNumber : order.billingAddress.phone,
        email         : order.getCustomerEmail() ? order.getCustomerEmail() : params.customerEmail
    };

    var billingInfo  = order.getBillingAddress();
    var shipmentInfo = order.getDefaultShipment();

    var billTo = {
        email       : params.billingEmail ? params.billingEmail : customerData.email,
        firstName   : billingInfo.getFirstName() ? billingInfo.getFirstName() : shipmentInfo.getShippingAddress().getFirstName(),
        lastName    : billingInfo.getLastName() ? billingInfo.getLastName() : shipmentInfo.getShippingAddress().getLastName(),
        phoneNumber : order.billingAddress.phone,
        ipAddress   : request.httpHeaders["x-is-remote_addr"],
        city        : billingInfo.getCity() ? billingInfo.getCity() : shipmentInfo.getShippingAddress().getCity(),
        state       : billingInfo.getStateCode() ? billingInfo.getStateCode() : shipmentInfo.getShippingAddress().getStateCode(),
        country     : billingInfo.getCountryCode().getValue() != "undefined" ? shipmentInfo.getShippingAddress().getCountryCode().getValue() != "undefined" ? billingInfo.getCountryCode().getValue() : shipmentInfo.getShippingAddress().getCountryCode().getValue() : "CL",
        street1     : billingInfo.getAddress1() ? billingInfo.getAddress1() : shipmentInfo.getShippingAddress().getAddress1(),
        street2     : billingInfo.getAddress2() ? billingInfo.getAddress2() : shipmentInfo.getShippingAddress().getAddress2()
    };

    var shipTo;

    if (shipmentInfo) {
        shipTo = {
            email          : params.shipmentEmail ? params.shipmentEmail : customerData.email,
            firstName      : shipmentInfo.getShippingAddress().getFirstName() ? shipmentInfo.getShippingAddress().getFirstName() : params.shipmentFirstName,
            lastName       : shipmentInfo.getShippingAddress().getLastName() ? shipmentInfo.getShippingAddress().getLastName() : params.shipmentLastName,
            city           : shipmentInfo.getShippingAddress().getCity(),
            state          : shipmentInfo.getShippingAddress().getStateCode(),
            country        : shipmentInfo.getShippingAddress().getCountryCode().getValue() != "undefined" ? shipmentInfo.getShippingAddress().getCountryCode().getValue() : "CL",
            street1        : shipmentInfo.getShippingAddress().getAddress1(),
            street2        : shipmentInfo.getShippingAddress().getAddress2(),
            shippingMethod : shipmentInfo.getShippingMethodID()
        };
    } else {
        shipTo = null;
    }

    var purchaseTotals = {
        currency: "CLP"
    };

    var items = order.getAllProductLineItems();

    var paymentInfo = {
        merchantID            : merchantID,
        domain                : sitePreferences.tbkCybersourceMerchantDomain,
        transactionKey        : transactionKey,
        merchantReferenceCode : orderNumber,
        card                  : params,
        billTo                : billTo,
        shipTo                : shipTo,
        purchaseTotals        : purchaseTotals,
        items                 : items,
        customerData          : customerData,
        numberInstallments    : order.custom.tbkQuantityOfInstallments,
        couponCode            : params.couponCode
    };

    try {
        var serviceResult = cybersourceFraudService.getFraudScore(paymentInfo);

        if (serviceResult.ok != true)
            return new Error("Service Result Error");
    } catch (e) {
        return new Error("Service Request Error");
    }

    var reader = new Reader(serviceResult.object.text);
    var xsr    = new XMLStreamReader(reader);

    // Get the decision and reasonCode elements from the returned XML.
    while (xsr.hasNext()) {
        if (xsr.next() == XMLStreamConstants.START_ELEMENT) {
            if (xsr.getLocalName() == "decision") {
                var decision = xsr.readXMLObject().toString();
            }
            if (xsr.getLocalName() == "reasonCode") {
                var reasonCode = xsr.readXMLObject().toString();
            }
        }
    }

    if (decision === "ERROR") {
        Logger.error("Reason code: {0}" + reasonCode);
    }
    return decision;
}

module.exports = {
    getFraudScore: getFraudScore
};
