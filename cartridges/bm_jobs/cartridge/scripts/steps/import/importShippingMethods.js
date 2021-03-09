"use strict";

/* Global exports require */
var Logger          = require("dw/system/Logger"),
    File            = require("dw/io/File"),
    Status          = require("dw/system/Status"),
    SFTPUtils       = require("~/cartridge/scripts/util/SFTPUtils");

exports.execute = function (parameters) {
    try {
        var sourceFolder = parameters.sourceFolder;
        var webDavFolder = parameters.targetFolder;
        var filePattern = parameters.filePattern;
        var afterDownloadOption = parameters.afterDownloadOption;
        var folderPath = File.IMPEX + File.SEPARATOR + "src" + File.SEPARATOR + webDavFolder;
        var folder = new File(folderPath);
        
        if (!folder.exists()) {
            folder.mkdirs();
        }

        var sftpClient = SFTPUtils.SFTPConnect();

        if (sftpClient.connected) {
            var downloadFiles = SFTPUtils.downloadFilesFromSFTP(sftpClient, sourceFolder, folderPath, filePattern, afterDownloadOption);

            if (!downloadFiles) {
                sftpClient.disconnect();
                return new Status(Status.OK, "No shipping methods for import in FTPS folder: " + sourceFolder);
            }

            var files = SFTPUtils.getFilesInLocalFolder(webDavFolder);

            if (files.empty) {
                return new Status(Status.OK, "No shipping methods for import in WebDAV folder: " + webDavFolder);
            }

            for (var i = 0; i < files.length; i ++) {
                var file = files[i];

                if (file.directory) {
                    continue;
                }

                var filePath = file.getFullPath().split("src" + File.SEPARATOR)[1];
                var Pipelet = require("dw/system/Pipelet");
                var result = new Pipelet("ImportShippingMethods").execute({
                    ImportMode : "MERGE",
                    ImportFile : filePath
                });

                if (!result || result.ErrorCode !== 0) {
                    return new Status(Status.ERROR, "File import failed.");
                } else {
                    file.remove();
                }
            }
        }
    } catch (err) {
        var message = "Shipping Methods Import failed. Error: " + err;
        Logger.error(message);
    }

    return new Status(Status.OK, "Customer import successfully done.");
};
