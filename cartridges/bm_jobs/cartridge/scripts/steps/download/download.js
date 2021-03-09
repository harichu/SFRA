"use strict";

var SFTPUtils = require("~/cartridge/scripts/util/SFTPUtils");
var Status = require("dw/system/Status");
var File = require("dw/io/File");
var Logger = require("dw/system/Logger");

/**
 * Download files from SFTP
 */
module.exports.execute = function (params) {
    var downloaded = downloadFilesFromSFTP(params);
    if (!downloaded.error) {
        return new Status(Status.OK, null, "Files successfully downloaded.");
    } else {
        return new Status(Status.ERROR, null, "Error downloading files: " + downloaded.msg);
    }
};

/**
 * Download files from SFTP
 */
function downloadFilesFromSFTP(params) {
    try {
        Logger.info("download.js - Connecting SFTP");
        var sftpClient = SFTPUtils.SFTPConnect();
        var filePattern = params.filePattern;
        var sourcePath = params.sourcePath;
        var afterDownloadOption = params.afterDownloadOption;
        var targetPath  = File.IMPEX + File.SEPARATOR + "src" + File.SEPARATOR + params.targetPath;

        if (sftpClient.getConnected()) {
            Logger.info("download.js - Downloading files from SFTP");
            var result = SFTPUtils.downloadFilesFromSFTP(sftpClient, sourcePath, targetPath, filePattern, afterDownloadOption);
            if (result == true) {
                Logger.info("download.js - Files successfully downloaded");
            } else if (!result.status) {
                Logger.info("download.js - SFTP file " + sourcePath + " not found");
                sftpClient.disconnect();
                return {error : true};
            }
        } else {
            throw new Error("Could not connect to SFTP");
        }

        sftpClient.disconnect();
        return {error : false};
    } catch (e) {
        Logger.error("download.js - " + e.toString());
        return {
            error : true,
            msg   : e.toString()
        };
    }
}
