"use strict";

var LocalServiceRegistry = require("dw/svc/LocalServiceRegistry");
var LoggerUtils          = require("*/cartridge/scripts/utils/LoggerUtils");

var SERVICE_NAME = "difarma.oms";

/**
 * Callback function to parse a service response
 * @param {dw.svc.Service} service the service instance
 * @param {Object} output the output object returned by the API call
 */
function parseResponse(_service, output) {
    return JSON.parse(output.text);
}

function getMockOrders() {
    var OrderMgr = require("dw/order/OrderMgr");
    var Order = require("dw/order/Order");

    var orders = OrderMgr.searchOrders(
        "status!={0}",
        "creationDate desc",
        Order.ORDER_STATUS_REPLACED
    );

    var ordersArray = [];
    var i = 0;

    // TODO: This can be very costy;
    while (orders.hasNext()) {
        i++;

        if (i > 10) {
            break;
        }
        var order = orders.next();

        if (order.customer.profile) {
            ordersArray.push({
                OrderNo: order.orderNo,
                CustomerEmailID: order.customer.profile.email,
                OrderDate: "2019-01-0" + i,
                Status: order.status.value,
                CustomerFirstName: order.customer.profile.firstName,
                CustomerLastName: "Silva",
                PriceInfo: {
                    TotalAmount: order.totalGrossPrice.value
                },
                PaymentMethods: [{
                    PaymentType: order.paymentInstrument.paymentMethod,
                    PaymentReference2: "Mercado Pago"
                }],
                CustomerZipCode: "70123230",
                HeaderTaxesHeaderTax: [{
                    tax: 0,
                    taxName: "Tax description"
                }],
                HeaderChargesHeaderCharge: [{
                    ChargeAmount: 100,
                    ChargeCategory: "SHIPPING",
                    ChargeName: "Charge name"
                }],
                OrderLines: {
                    OrderLine : [
                        {
                            Item: {
                                ItemID: order.allProductLineItems[0].productID,
                                ItemShortDesc: order.allProductLineItems[0].productName,
                                UnitCost: order.allProductLineItems[0].price.value,
                            },
                            OrderedQty: order.allProductLineItems[0].quantity.value,
                            DeliveryMethod: "SHP",
                            ShipNode: "1000",
                            PersonInfoShipTo: {
                                AddressLine1: order.billingAddress.address1,
                                AddressLine2: order.billingAddress.address2,
                                City: order.billingAddress.city,
                                Country: "Chile",
                                DayPhone: "(+56)955593370",
                                EmailID: order.customerEmail,
                                FirstName: order.customer.profile.firstName,
                                LastName: order.customer.profile.lastName,
                                Latitude: "4.556",
                                Longitude: "-14.556",
                                State: "Santiago"
                            },
                            LineCharges: [{
                                ChargeName: "Charge name",
                                ChargePerUnit: 10
                            }],
                            PersonInfoBillTo: {
                                AddressLine1: order.billingAddress.address1,
                                AddressLine2: order.billingAddress.address2,
                                City: order.billingAddress.city,
                                Country: "Chile",
                                DayPhone: "(+56)955593370",
                                EmailID: order.customerEmail,
                                FirstName: order.customer.profile.firstName,
                                Latitude: "4.556",
                                Longitude: "-14.556",
                                State: "Santiago"
                            }
                        }]
                }
            });
        }
    }

    return {
        Output : {
            OrderList : {
                Order: ordersArray
            }
        }
    };
}

var GetCustomerOrdersService = function () {
    var serviceObj = LocalServiceRegistry.createService(SERVICE_NAME, {
        createRequest : function (service, params) {
            var url  = service.URL + "DifarmaOrderHistoryLookupService";
            var body = {
                "Page": {
                    "Refresh"            : "Y",
                    "PageSize"           : "50",
                    "PageNumber"         : "1",
                    "PaginationStrategy" : "GENERIC",
                    "API"                : {
                        "Input"  : {
                            "Order": {
                                "OrderBy" : {
                                    "Attribute" : {
                                        "Desc" : "Y",
                                        "Name" : "OrderDate"
                                    }
                                },
                                "CustomerEMailID"        : params.email,
                                "CustomerEMailIDQryType" : "FLIKE",
                                "DocumentType"           : "0001",
                                "DraftOrderFlag"         : "N"
                            }
                        },
                        "IsFlow" : "Y",
                        "Name"   : "DifarmaSFCCGetOrderList"
                    }
                }
            };

            service.setURL(url);
            service.setRequestMethod("POST");
            LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - GetCustomerOrdersService createRequest(service, params);" +
                "method: POST;" +
                "url: " + url + ";");
            return JSON.stringify(body);
        },
        parseResponse : parseResponse,
        mockFull      : function (_service, _client) {
            return getMockOrders();
        }
    });

    this.post = function (data) {
        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - GetCustomerOrdersService post(data);" +
            "data: " + data + ";");
        return serviceObj.call(data);
    };
};

var GetOrderDetailsService = function () {
    var serviceObj = LocalServiceRegistry.createService(SERVICE_NAME, {
        createRequest: function (service, params) {
            var url  = service.URL + "DifarmaOrderDetailsService";
            var body = {
                "Order" : {
                    "OrderNo"        : params.orderNo,
                    "DocumentType"   : "0001",
                    "EnterpriseCode" : "FCVChile"
                }
            };

            service.setURL(url);
            service.setRequestMethod("POST");
            LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - GetOrderDetailsService createRequest(service, params);" +
                "method: POST;" +
                "url: " + url + ";");
            return JSON.stringify(body);
        },
        parseResponse: parseResponse,
        mockFull: function (_service, _client) {
            return getMockOrders()[0];
        }
    });

    this.post = function (data) {
        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - GetOrderDetailsService post(data);" +
            "data: " + data + ";");
        return serviceObj.call(data);
    };
};

/**
 * Gets customer orders
 * @param {String} email customer e-mail
 */
module.exports.getCustomerOrders = function (email) {
    try {
        var serviceResponse = new GetCustomerOrdersService().post({ email: email });
        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - getCustomerOrders(email);" +
            "result: " + JSON.stringify(serviceResponse.object));
        return serviceResponse.object;
    } catch (e) {
        LoggerUtils.serviceError("Error on " + SERVICE_NAME + ";" +
            "params: " + email + ";" +
            "Error: " + e.errorMessage);
    }
};

/**
 * Gets order details
 * @param {String} orderNo
 */
module.exports.getOrderDetails = function (orderNo) {
    try {
        var serviceResponse = new GetOrderDetailsService().post({ orderNo: orderNo });
        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - getOrderDetails(orderNo);" +
            "result: " + JSON.stringify(serviceResponse.object));
        return serviceResponse.object.Order[0];
    } catch (e) {
        LoggerUtils.serviceError("Error on " + SERVICE_NAME + ";" +
            "params: " + orderNo + ";" +
            "Error: " + e.errorMessage);
    }
};
