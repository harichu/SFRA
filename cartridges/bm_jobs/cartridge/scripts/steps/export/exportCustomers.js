"use strict";

var Status = require("dw/system/Status");
var File = require("dw/io/File");
var CustomerMgr = require("dw/customer/CustomerMgr");
var StringUtils = require("dw/util/StringUtils");
var Calendar = require("dw/util/Calendar");
var Logger = require("dw/system/Logger");
var Transaction = require("dw/system/Transaction");
var ArrayList = require("dw/util/ArrayList");

/**
 * Export customers to file
 */
module.exports.execute = function (params) {
    Logger.info("Starting Customers Export job...");
    try {
        Transaction.begin();
        var filepath = params.filepath;
        var calendar = new Calendar();
        var profilesToExport = new ArrayList();
        var currentSiteID = dw.system.Site.getCurrent().getID();
        var exportOnlyModified = !!params.exportOnlyModified;

        CustomerMgr.processProfiles(function (profile) {
            var lastProfileChangeTimestamp = profile.custom.lastProfileChangeTimestamp || new Date(0);
            var lastExportTimestamp = profile.custom.lastExportTimestamp || new Date(0);
            var modifiedRecently = lastProfileChangeTimestamp >= lastExportTimestamp;
            if ((exportOnlyModified && modifiedRecently) || !exportOnlyModified) {
                if (profile.getLastModified() > profile.custom.lastExportTimestamp) {
                    profilesToExport.add(profile);
                    profile.custom.lastExportTimestamp = new Date();
                }
            }
        }, params.searchQuery, null);
        filepath = filepath + File.SEPARATOR + "Customers" + "_" + currentSiteID + "_" + StringUtils.formatCalendar(calendar, "yyyyMMddHHmmssSSS") + ".xml";

        Logger.info("Exporting to file " + filepath);
        var result = dw.system.Pipeline.execute("PipeletWrapper-ExportCustomers", {
            ExportFile : filepath,
            Customers : profilesToExport.iterator()
        });

        if (result.ErrorCode === 0) {
            Logger.info("Pipeline executed without errors");
            Transaction.commit();
        } else {
            Logger.error("Export customer error - " + result.ErrorMsg);
            Transaction.rollback();
            return new Status(Status.ERROR, "ERROR", result.ErrorMsg);
        }

        return new Status(Status.OK, "OK", "Export has been successfully finished");
    } catch (e) {
        Logger.error("Export customer error - " + e.toString());
        Transaction.rollback();
        return new Status(Status.ERROR, "ERROR", e.toString());
    }
};
