"use strict";

var Status = require("dw/system/Status");
var File = require("dw/io/File");
var Logger = require("dw/system/Logger");
var Site = require("dw/system/Site");
var daysToKeep;

/**
 * Export orders to file
 */
module.exports.execute = function (params) {
    try {
        var foldersToClean = Site.getCurrent().getPreferences().custom.webdavFoldersToClean;
        daysToKeep = params.Days;
        
        for (var i = 0; i < foldersToClean.length; i++) {
            var folder = foldersToClean[i];
            var directory = new File(File.IMPEX + File.SEPARATOR + folder);
            if (directory && directory.isDirectory()) {
                var oldFiles = directory.listFiles(filterOldFiles);
                oldFiles.toArray().forEach(function (file) {
                    file.remove();
                });
            }
        }

        Logger.info("Folders cleanup done successfully");

        return new Status(Status.OK, "OK", "Files Cleanup has been successfully finished");
    } catch (e) {
        Logger.error("clean/CleanupFiles.js - " + e.toString());
        return new Status(Status.ERROR, "ERROR", e.toString());
    }
};

/**
 * Filter files olden than dateLimit setting
 */
function filterOldFiles(file) {
    var dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - daysToKeep);
    return file.isFile() && file.lastModified() < dateLimit;
}
