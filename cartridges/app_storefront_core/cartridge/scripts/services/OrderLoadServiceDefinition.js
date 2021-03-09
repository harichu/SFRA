"use strict";

var Site = require("dw/system/Site");
var LocalServiceRegistry = require("dw/svc/LocalServiceRegistry");

/**
 * Builds the inner header taxes object
 * @param {dw.order.Order} order
 * @returns {Object[]} an array of header taxes
 */
function getHeaderTaxes(order) {
    var products = order.getAllProductLineItems();
    var taxes = null;
    if (!empty(products)) {
        taxes = [];
        for (var i = 0; i < products.length; i++) {
            taxes.push({
                ChargeCategory: "HANDLING",
                Tax: products[i].tax.available ? products[i].tax.value : 0,
                TaxName: products[i].taxClassID
            });
        }
    }
    return taxes;
}

/**
 * Builds the inner line taxes object
 * @param {dw.order.Order} order
 */
function getLineTaxes(order) {
    var lineTaxes = getHeaderTaxes(order) || [];
    return lineTaxes.map(function (tax) {
        return {
            ChargeCategory: "Handling",
            ChargeName: tax.TaxName,
            Tax: tax.Tax,
            TaxName: tax.TaxName,
            TaxableFlag: "Y"
        };
    });
}

/**
 * Builds the inner header charges object
 * @param {dw.order.Order} order
 * @returns {Object[]} an array of header charges
 */
function getHeaderCharges(order) {
    var charges = [];
    var shipping = order.shippingTotalPrice;
    var adjustments = order.priceAdjustments;
    if (shipping.available) {
        charges.push({
            ChargeAmount: shipping.value,
            ChargeCategory: "SHIPPING",
            ChargeName: "Shipping Total",
            Reference: null
        });
    }
    if (!empty(adjustments)) {
        for (var i = 0; i < adjustments.length; i++) {
            charges.push({
                ChargeAmount: adjustments[i].priceValue,
                ChargeCategory: "DISCOUNT",
                ChargeName: "Discount Total",
                Reference: adjustments[i].promotionID
            });
        }
    }
    return charges;
}

/**
 * Builds the inner line charges object
 * @param {dw.order.Order} order
 */
function getLineCharges(order) {
    var charges = getHeaderCharges(order) || [];
    return charges.map(function (charge) {
        return {
            ChargeCategory: charge.ChargeCategory,
            ChargeName: charge.ChargeName,
            ChargePerUnit: charge.ChargeAmount,
            IsManual: "N"
        };
    });
}

/**
 * Builds the inner payment details object
 * @param {dw.order.Order} order
 */
function getPaymentDetails(order) {
    return {
        AuthCode: null,
        AuthorizationExpirationDate: "2500-01-01",
        AuthorizationID: order.paymentTransaction.getTransactionID(),
        ChargeType: "CHARGE",
        ProcessedAmount: order.adjustedMerchandizeTotalGrossPrice,
        RequestAmount: order.adjustedMerchandizeTotalGrossPrice,
        RequestProcessed: "Y"
    };
}

/**
 * Builds the inner payment methods object
 * @param {dw.order.Order} order
 * @returns {Object[]} an array of payment methods
 */
function getPaymentMethods(order) {
    var paymentInstruments = order.paymentInstruments || [];
    return paymentInstruments.toArray().map(function (paymentInstrument) {
        var cardHolder = paymentInstrument.creditCardHolder;
        return {
            ChargeSequence: paymentInstrument.paymentMethod == "001" ? 1 : 2,
            CreditCardExpDate: paymentInstrument.creditCardExpirationYear + paymentInstrument.creditCardExpirationMonth,
            CreditCardName: paymentInstrument.creditCardHolder,
            CreditCardNo: paymentInstrument.creditCardNumber,
            CreditCardType: paymentInstrument.creditCardType,
            DisplayCreditCardNo: paymentInstrument.maskedCreditCardNumber,
            FristName: cardHolder ? cardHolder.split(" ")[0] : "",
            LastName: cardHolder ? cardHolder.replace(cardHolder.split(" ")[0], "").trim() : "",
            MaxChargeLimit: order.adjustedMerchandizeTotalGrossPrice,
            PaymentReference2: null,
            PaymentType: "CREDIT_CARD",
            UnlimitedCharges: "N",
            PersonInfoBillTo: getBillingAddress(order),
            PaymentDetails: getPaymentDetails(order)
        };
    });
}

/**
 * Builds the order lines inner object
 * @param {dw.order.Order} order
 * @returns {Object[]}
 */
function getOrderLines(order) {
    var orderLines = [];
    var lineItems = order.getAllProductLineItems();
    if (!empty(lineItems)) {
        for (var i = 0; i < lineItems.length; i++) {
            orderLines.push({
                DeliveryMethod: order.defaultShipment.shippingMethodID === "005" ? "PICK" : "SHP",
                FulfillmentType: order.defaultShipment.shippingMethodID === "005" ? "PICKUP_IN_STORE" : "SHIP_TO_HOME",
                IsFirmPredefinedNode: "Y",
                IsProcurementAllowed: "Y",
                ItemGroupCode: "PROD",
                LevelOfService: null,
                OrderedQty: lineItems[i].getQuantityValue(),
                PrimeLineNo: lineItems[i].getPosition(),
                ShipNode: null,
                SubLineNo: 1,
                Item: {
                    CostCurrency: order.getCurrencyCode(),
                    ItemID: lineItems[i].productID,
                    ItemShortDesc: lineItems[i].product.getShortDescription(),
                    ProductClass: "GOOD",
                    UnitCost: lineItems[i].basePrice.value,
                    UnitOfMeasure: lineItems[i].product.getUnit()
                },
                LinePriceInfo: {
                    IsPriceLocked: "Y",
                    UnitPrice: lineItems[i].basePrice.value
                },
                PersonInfoShipTo: {
                    IsCommercialAddress: null,
                    Latitude: null,
                    Longitude: null
                },
                PersonInfoMarkFor: order.defaultShipment.shippingMethodID !== "005" ? null : {
                    MiddleName: null,
                    MobilePhone: null
                },
                OrderLineSourcingControl: {
                    Node: null,
                    SupressNodeCapacity: "Y"
                },
                LineTaxes: getLineTaxes(order),
                LineCharges: getLineCharges(order)
            });
        }
    }
    return orderLines;
}

/**
 * Gets the prescriptions from a given order instance
 * @param {dw.order.Order} order 
 */
function getPrescriptions(order) {
    var lineItems = order.getAllProductLineItems().toArray();
    return lineItems.map(function (lineItem) {
        return {
            Name: lineItem.custom.difarmaPrescriptionId,
            Value: null
        };
    });
}

/**
 * Returns the order address with proper attributes for the payload
 * @param {dw.order.Order} order
 */
function getBillingAddress(order) {
    var billingAddress = order.getBillingAddress();
    return {
        AddressLine1: billingAddress.address1,
        AddressLine2: billingAddress.address2,
        City: billingAddress.city,
        Country: billingAddress.countryCode ? billingAddress.countryCode.displayValue : null,
        DayPhone: billingAddress.phone,
        FirstName: billingAddress.firstName,
        LastName: billingAddress.lastName,
        State: billingAddress.stateCode ? billingAddress.stateCode.displayValue : null
    };
}
/**
 * Creates a mocked order
 */
function createMockedOrder() {
    return {
        CustomerEmailID: "john@doe.com",
        DocumentType: "001",
        EnterpriseCode: "FCVChile",
        EntryType: "CustomerOnWeb",
        OrderData:  "2019-11-06T19:44:11.903Z",
        OrderNo:  "13216185498",
        PaymentRuleID: "FCVCH_CL_PAY_RULE",
        SellerOrganizationCode: "FCV.CL",
        PriceInfo: {
            Currency: "CLP"
        },
        PersonInfoBillTo: {
            AddressLine1: "Avenida Carrera",
            AddressLine2: "",
            City: "Santiago",
            Country: "Chile",
            DayPhone: "(+56)955593370",
            FirstName: "John",
            LastName: "Doe",
            State: ""
        },
        HeaderTaxes: [{
            ChargeCategory: "HANDLING",
            Tax: 100,
            TaxName: "standard"
        }],
        HeaderCharges: [{
            ChargeAmount: 1000,
            ChargeCategory: "SHIPPING",
            ChargeName: "Shipping Total",
            Reference: null
        }],
        PaymentMethods: [{
            
        }],
        OrderLines: [{
            
        }],
        Extn: {
            ExtnCustomerRUTID: "93298276"
        },
        References: [{
            Name: "dummy name",
            Value: "dummy value"
        }]
    };
}

/**
 * Creates the whole order object and callbacks functions for the OMS service call
 * @param {dw.order.Order} order
 */
function createOrder(order) {
    var enterpriseCodes = {
        Colombia: "FCVChile",
        Chile: "FCVColombia",
        Maicao: "MaicaoChile",
        Ecuador: ""
    };
    var organizationCodes = {
        Colombia: "FCV.CL",
        Chile: "FCV.CO",
        Maicao: "Maicao.CL",
        Ecuador: ""
    };
    var payload = {
        CustomerEmailID: order.getCustomerEmail(),
        DocumentType: "001",
        EnterpriseCode: enterpriseCodes[Site.getCurrent().getID()],
        EntryType: "CustomerOnWeb",
        OrderData:  order.getCreationDate().toISOString(),
        OrderNo:  order.getOrderNo(),
        PaymentRuleID: "FCVCH_CL_PAY_RULE",
        SellerOrganizationCode: organizationCodes[Site.getCurrent().getID()],
        PriceInfo: {
            Currency: order.getCurrencyCode()
        },
        PersonInfoBillTo: getBillingAddress(order),
        HeaderTaxes: getHeaderTaxes(order),
        HeaderCharges: getHeaderCharges(order),
        PaymentMethods: getPaymentMethods(order),
        OrderLines: getOrderLines(order),
        Extn: {
            ExtnCustomerRUTID: order.getCustomer().profile.custom.difarmaRunRutNit
        },
        References: getPrescriptions(order)
    };
    var callbacks = {
        createRequest: function (service, params) {
            service.setRequestMethod("POST");
            return JSON.stringify(params.payload);
        },
        parseResponse: function (_service, output) {
            return JSON.parse(output.text);
        },
        mockFull: function (_service, _client) {
            return {
                statusCode: 201,
                statusMessage: "Success",
                text: JSON.stringify(createMockedOrder())
            };
        }
    };
    var localService = LocalServiceRegistry.createService("difarma.oms", callbacks);
    return localService.call({payload: payload}).object;
}

module.exports = {
    createOrder: createOrder
};
