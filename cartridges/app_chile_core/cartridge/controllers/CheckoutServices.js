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
                viewData.continueUrl = order.custom.transactionNote;
                viewData.newTab = true;

                var sameTabPaymentMethods = dw.system.Site.getCurrent().getCustomPreferenceValue("sameTabPaymentMethods");

                if (!empty(sameTabPaymentMethods)) {
                    order.getPaymentInstruments().toArray().forEach(function (paymentInstrument) {
                        if (sameTabPaymentMethods.indexOf(paymentInstrument.creditCardType) > -1) {
                            viewData.newTab = false;
                        }
                    });
                }
            }
        }
        res1.setViewData(viewData);
    });

    next();
});

module.exports = server.exports();
