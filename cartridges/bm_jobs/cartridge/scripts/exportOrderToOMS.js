"use strict";

/* Global exports require */
var OrderMgr = require("dw/order/OrderMgr");
var Order    = require("dw/order/Order");
var Logger   = require("dw/system/Logger");

// Script Includes
var orderLoadService = require("app_storefront_core/cartridge/scripts/services/OrderLoadService");

exports.execute = function () {
    try {
        var queryString = "status != {0} AND status != {1} AND exportStatus = {2} AND exportStatus = {3}";
        var failedExportOrders = OrderMgr.searchOrders(queryString, "creationDate desc", Order.ORDER_STATUS_CANCELLED, Order.ORDER_STATUS_FAILED, Order.EXPORT_STATUS_NOTEXPORTED);

        while (failedExportOrders.hasNext()) {
            var order = failedExportOrders.next();
            orderLoadService.INT_CH_SFCC_CreateOrder(order);
        }
    } catch (er) {
        var message = "Order export to OMS failed. Error: " + er;
        Logger.error(message);
    }
};
