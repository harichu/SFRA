"use strict";

var SFTPUtils = require("~/cartridge/scripts/util/SFTPUtils");
var Status = require("dw/system/Status");
var File = require("dw/io/File");
var Logger = require("dw/system/Logger");

/**
 * Uploads files to SFTP
 */
module.exports.execute = function (params) {
    var uploaded = uploadFilesToSFTP(params);
    if (!uploaded.error) {
        return new Status(Status.OK, null, "Files successfully uploaded.");
    } else {
        return new Status(Status.ERROR, null, "Error uploading files: " + uploaded.msg);
    }
};

/**
 * Upload files to SFTP
 */
function uploadFilesToSFTP(params) {
    try {
        Logger.info("upload.js - Connecting SFTP");
        var sftpClient = SFTPUtils.SFTPConnect();
        var filePattern = params.filePattern;
        var sourcePath = File.IMPEX + File.SEPARATOR + "src" + File.SEPARATOR + params.sourcePath;
        var afterUploadOption = params.afterUploadOption;
        var targetPath  = params.targetPath;

        if (sftpClient.getConnected()) {
            Logger.info("upload.js - Uploading files from SFTP");
            sftpClient.mkdir(targetPath);
            var result = SFTPUtils.uploadFilesToSFTP(sftpClient, sourcePath, targetPath, filePattern, afterUploadOption);
            if (result == true) {
                Logger.info("upload.js - Files successfully uploaded");
            } else if (!result.status) {
                Logger.info("upload.js - SFTP file " + targetPath + " not found");
                sftpClient.disconnect();
                return {error : true};
            }
        } else {
            throw new Error("Could not connect to SFTP");
        }

        sftpClient.disconnect();
        return {error : false};
    } catch (e) {
        Logger.error("upload.js - " + e.toString());
        return {
            error : true,
            msg   : e.toString()
        };
    }
}
