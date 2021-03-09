"use strict";

var base = module.superModule;
var server = require("server");
server.extend(base);
server.append("PlaceOrder", function (_req, _res, next) {
    var OrderMgr = require("dw/order/OrderMgr");
    this.on("route:BeforeComplete", function (_req1, res1) { 
        var viewData = res1.getViewData();
        if (!viewData.error) {
            var order = OrderMgr.getOrder(viewData.orderID);
            if (!empty(order) && !empty(order.custom.transactionNote)) {
                var isPsePayment = false;
                order.getPaymentInstruments().toArray().forEach(function (paymentInstrument) {
                    if (paymentInstrument.creditCardType == "pse") {
                        isPsePayment = true;
                    }
                });
                if (isPsePayment) {
                    viewData.newTab = false;
                    viewData.continueUrl = order.custom.transactionNote;
                } else {
                    viewData.newTab = order.custom.transactionNote;
                }
            }
        }
        res1.setViewData(viewData);
    });
    next();
});

module.exports = server.exports();
