"use strict";

var Status = require("dw/system/Status");
var File = require("dw/io/File");
var OrderMgr = require("dw/order/OrderMgr");
var StringUtils = require("dw/util/StringUtils");
var Calendar = require("dw/util/Calendar");
var Logger = require("dw/system/Logger");

/**
 * Export orders to file
 */
module.exports.execute = function (params) {
    Logger.info("Starting Orders Export job...");
    try {
        var filepath = params.filepath;
        var calendar = new Calendar();
        var currentSiteID = dw.system.Site.getCurrent().getID();
        var orders = OrderMgr.searchOrders(params.searchQuery, "creationDate desc", null);

        if (orders.count === 0) {
            Logger.info("Pipeline executed without errors");
            return new Status(Status.OK, "OK", "No orders to be exported.");
        }

        var directory = new File("IMPEX/src/" + filepath);
        if (!directory.exists()) {
            directory.mkdirs();
        }

        filepath = filepath + File.SEPARATOR + "OrderExport" + "_" + currentSiteID + "_" + StringUtils.formatCalendar(calendar, "yyyyMMddHHmmssSSS") + ".xml";

        Logger.info("Exporting to file " + filepath);
        var result = dw.system.Pipeline.execute("PipeletWrapper-ExportOrders", {
            ExportFile : filepath,
            Orders     : orders
        });

        // Error 156: "There is no data to export.", it should not raise an error;
        if (result.ErrorCode === 0 || result.ErrorCode === 156) {
            Logger.info("Pipeline executed without errors");
        } else {
            Logger.error("Export order error - " + result.ErrorMsg);
            return new Status(Status.ERROR, "ERROR", result.ErrorMsg);
        }

        return new Status(Status.OK, "OK", "Export has been successfully finished");
    } catch (e) {
        Logger.error("Export order error - " + e.toString());
        return new Status(Status.ERROR, "ERROR", e.toString());
    }
};
