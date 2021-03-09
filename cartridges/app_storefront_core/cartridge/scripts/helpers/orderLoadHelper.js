"use strict";

var Calendar    = require("dw/util/Calendar");
var currentSite = require("dw/system/Site").current;
var server      = require("server");
var Transaction = require("dw/system/Transaction");

var booleanToText = {
    NO  : "N",
    YES : "Y"
};

var fulfillmentTypes = {
    PICKUP_IN_STORE       : "PICKUP_IN_STORE",
    SHIP_TO_HOME          : "SHIP_TO_HOME",
    PICKUP_IN_STORE_NIGHT : "PICKUP_IN_STORE_NIGHT",
    SHIP_TO_HOME_NIGHT    : "SHIP_TO_HOME_NIGHT"
};

var lineItemDiscounts = {
    CHARGE_CATEGORY : "DISCOUNT",
    CHARGE_NAME     : "PDT_DISCOUNT"
};

var lineItemTaxes = {
    CHARGE_CATEGORY : "TAX",
    CHARGE_NAME     : "SALES_TAX",
    TAX_NAME        : "SalesTax"
};

var paymentRules = {};

paymentRules.ruleID = currentSite.ID === "Colombia" ? 
    "FCVCOL_WEB_CARD_RULE" : "FCVCH_WEB_CARD_RULE" ;

var serviceLevels = {
    SAME_DAY : "SameDay",
    NEXT_DAY : "NextDay"
};

var shipmentCharges = {
    CHARGE_CATEGORY : "SHIPPING",
    CHARGE_NAME     : "SHIPPING_CHARGE"
};

var shipmentDiscounts = {
    CHARGE_CATEGORY : "DISCOUNT",
    CHARGE_NAME     : "SHIP_DISCOUNT"
};

var shipmentTaxes = {
    CHARGE_CATEGORY : "TAX",
    CHARGE_NAME     : "SHIPPING_TAX",
    TAX_NAME        : "SHIPPING_TAX"
};

var sites = {
    Chile : {
        enterpriseCode             : "FCVChile",
        sellerOrganizationCode     : "FCV.CL",
        ExtnIsPrescriptionVerified : booleanToText.NO
    },
    Colombia : {
        enterpriseCode             : "FCVColombia",
        sellerOrganizationCode     : "FCV.CO",
        ExtnIsPrescriptionVerified : booleanToText.YES
    },
    MaicaoChile : {
        enterpriseCode             : "MaicaoChile",
        sellerOrganizationCode     : "Maicao.CL",
        ExtnIsPrescriptionVerified : booleanToText.NO
    }
};

var mercadoPagoGateways = {
    CREDIT_CARD : "MPAGO_CREDIT",
    DEBIT_CARD  : "MPAGO_DEBIT"
};

/**
 * Parses the shipping datetime from one timezone to another.
 * @param {String} datetime The shipping datetime.
 * @return {String} The same shipping datetime, but in the timezone of the site.
 */
function parseDatetime(datetime) {
    var offsetInHours = currentSite.timezoneOffset / 3600000; // Site.timezoneOffset is in milliseconds.
    var calendar = new Calendar();
    calendar.parseByFormat(datetime, "yyyy-MM-dd'T'HH:mm:ss");
    var date = calendar.getTime();
    date.setHours(date.getHours() + offsetInHours);
    var offsetInText = (offsetInHours > 0 ? "+" : "-") + ("0" + Math.abs(offsetInHours)).substr(-2) + ":00";
    var result = date.toISOString().replace(".000Z", offsetInText);
    return result;
}

/**
 * Fills in an order ith the data required by the OMS system.
 * @param {dw.order.Order} order The order to be filled in.
 */
function fillPostPlacementData(order) {
    var siteData = sites[currentSite.ID];

    var paymentInstrument = order.getPaymentInstruments()[0];
    var shipment          = order.getShipments()[0];
    var shippingMethod    = shipment.shippingMethod;
    var shippingAddress   = shipment.shippingAddress;
    var profileForm       = server.forms.getForm("profile");
    var allLines          = order.getAllProductLineItems().iterator();
    var shippingTime      = shippingMethod.custom.isToday ? order.custom.difarmaTodayTime : order.custom.difarmaTomorrowTime;
    var shipDate          = null;

    if (shippingTime) {
        shipDate = parseDatetime(shippingTime);
    }

    var paymentType      = order.custom.difarmaPaymentType;
    var paymentProcessor = paymentInstrument.paymentTransaction.paymentProcessor.ID;
    var gateway          = mercadoPagoGateways[paymentType] || paymentProcessor;

    Transaction.wrap(function () {
        order.custom.difarmaEnterpriseCode         = siteData.enterpriseCode;
        order.custom.difarmaPaymentRuleId          = paymentRules.ruleID;
        order.custom.difarmaSellerOrganizationCode = siteData.sellerOrganizationCode;
        order.custom.difarmaGateway                = gateway;
        order.custom.difarmaRunRutNit              = customer.registered ? customer.profile.custom.difarmaRunRutNit : profileForm.customer.cedula.value;
        order.custom.difarmaCommerceCode           = currentSite.getCustomPreferenceValue("difarmaCommerceCode");
        order.custom.difarmaShipDate               = shipDate;
        order.custom.isPickupAuthPerson            = !empty(shippingAddress.custom.whotakesName);

        // This is an attribute required by the OMS's own address system. It refers to the commune.
        shippingAddress.custom.commune = shippingAddress.city;

        shipment.custom.difarmaShippingCategory  = shipmentCharges.CHARGE_CATEGORY;
        shipment.custom.difarmaShippingName      = shipmentCharges.CHARGE_NAME;

        shipment.custom.difarmaDiscountCategory  = shipmentDiscounts.CHARGE_CATEGORY;
        shipment.custom.difarmaDiscountName      = shipmentDiscounts.CHARGE_NAME;
        shipment.custom.difarmaDiscountAmount    = shipment.shippingTotalPrice.subtract(shipment.adjustedShippingTotalPrice).value;

        shipment.custom.difarmaTaxChargeCategory = shipmentTaxes.CHARGE_CATEGORY;
        shipment.custom.difarmaTaxChargeName     = shipmentTaxes.CHARGE_NAME;
        shipment.custom.difarmaTaxName           = shipmentTaxes.TAX_NAME;
        shipment.custom.difarmaTaxable           = shipment.totalTax.value > 0 ? booleanToText.YES : booleanToText.NO;

        while (allLines.hasNext()) {
            var line = allLines.next();
            line.custom.ExtnIsPrescriptionHoldRequired = !empty(line.custom.difarmaPrescriptionId);
            if (shippingMethod.custom.isToday) {
                if (shippingMethod.custom.storePickupEnabled) {
                    line.custom.difarmaFulfillmentType = order.custom.ExtnIsNightShipping ? fulfillmentTypes.PICKUP_IN_STORE_NIGHT : fulfillmentTypes.PICKUP_IN_STORE;
                } else {
                    line.custom.difarmaFulfillmentType = order.custom.ExtnIsNightShipping ? fulfillmentTypes.SHIP_TO_HOME_NIGHT : fulfillmentTypes.SHIP_TO_HOME;
                }
                line.custom.difarmaLevelOfService  = serviceLevels.SAME_DAY;
            } else {
                line.custom.difarmaFulfillmentType = shippingMethod.custom.storePickupEnabled ? fulfillmentTypes.PICKUP_IN_STORE : fulfillmentTypes.SHIP_TO_HOME;
                line.custom.difarmaLevelOfService  = serviceLevels.NEXT_DAY;
            }

            if (shippingMethod.custom.storePickupEnabled && (!empty(line.product.custom.difarmaPrescriptionModel) && !empty(line.product.custom.difarmaPrescriptionModel.value)) && empty(line.custom.difarmaPrescriptionId)) {
                line.custom.ExtnVerifyPrescriptionAtPick = booleanToText.YES;
            } else {
                line.custom.ExtnVerifyPrescriptionAtPick = booleanToText.NO;
            }

            if (!empty(line.custom.difarmaPrescriptionId)) {
                line.custom.difarmaIsPrescriptionVerified = siteData.ExtnIsPrescriptionVerified;
            } else {
                line.custom.difarmaIsPrescriptionVerified = booleanToText.YES;
            }

            var lineDiscount = line.price.subtract(line.proratedPrice);
            line.custom.difarmaDiscountCategory  = lineItemDiscounts.CHARGE_CATEGORY;
            line.custom.difarmaDiscountName      = lineItemDiscounts.CHARGE_NAME;
            line.custom.difarmaDiscountPerLine   = lineDiscount.value;
            line.custom.difarmaDiscountPerUnit   = lineDiscount.divide(line.quantityValue).value;

            line.custom.difarmaTaxChargeCategory = lineItemTaxes.CHARGE_CATEGORY;
            line.custom.difarmaTaxChargeName     = lineItemTaxes.CHARGE_NAME;
            line.custom.difarmaTaxName           = lineItemTaxes.TAX_NAME;
            line.custom.difarmaTaxable           = line.adjustedTax.value > 0 ? booleanToText.YES : booleanToText.NO;

            line.custom.difarmaAdjustedPrice     = line.proratedPrice;

            line.custom.fromStoreId = shipment.custom.fromStoreId;
        }
    });
}

/**
 * Fills in payment data for the order load, for CC payed orders only.
 * @param {dw.order.Order} order The order to receive payment data.
 * @param {Object} paymentData An object holding CC identification data for the OMS
 */
function fillPaymentData(order, paymentData) {
    var splitName = (!empty(paymentData) && !empty(paymentData.name)) ? paymentData.name.split(" ") : null;
    Transaction.wrap(function () {
        var expirationDate = empty (paymentData.expirationYear) ? null : paymentData.expirationYear + ("0" + paymentData.expirationMonth).substr(-2) + "01";

        order.custom.difarmaCreditCardExpDate        = expirationDate;
        order.custom.difarmaCreditCardName           = paymentData.name || null;
        order.custom.difarmaCreditCardFirstSixDigits = paymentData.firstSixDigits || null;
        order.custom.difarmaCreditCardLastFourDigits = paymentData.lastFourDigits || null;
        order.custom.difarmaPaymentType              = paymentData.paymentType.toUpperCase();
        order.custom.installmentQty                  = Number(paymentData.installmentQty);
        if (!empty(splitName)) {
            order.custom.difarmaCreditCardFirstName = splitName[0];
            splitName.shift();
            order.custom.difarmaCreditCardLastName = splitName.join(" ");
        }
    });
}

module.exports = {
    fillPaymentData       : fillPaymentData,
    fillPostPlacementData : fillPostPlacementData
};
