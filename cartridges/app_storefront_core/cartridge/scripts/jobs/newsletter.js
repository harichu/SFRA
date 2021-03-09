"use strict";

var Status          = require("dw/system/Status");
var File            = require("dw/io/File");
var Logger          = require("dw/system/Logger");
var CustomObjectMgr = require("dw/object/CustomObjectMgr");
var Transaction     = require("dw/system/Transaction");
var Site            = require("dw/system/Site");
var FileWriter      = require("dw/io/FileWriter");
var SFTPUtils       = require("~/cartridge/scripts/util/SFTPUtils");

var CUSTOM_OBJ_NAME = "NewsletterSubscription";

/**
 * Appends new newsletter data to an existing file.
 * @param {dw.io.File} impexFile The file to append to.
 * @param {String} impexDir The path to the directory where the file is located, necessary to create it should it be absent.
 */
function addCustomObjectDataToFile(impexFile, impexDir) {
    var directory = new File(impexDir);
    if (!directory.exists()) {
        directory.mkdir();
    }
    if (!impexFile.exists()) {
        impexFile.createNewFile();
    }

    var customObjIterator = CustomObjectMgr.getAllCustomObjects(CUSTOM_OBJ_NAME);
    var fileWriter        = new FileWriter(impexFile, "UTF-8", true);

    while (customObjIterator.hasNext()) {
        var newsletterOptionsObj = customObjIterator.next();
        fileWriter.writeLine(newsletterOptionsObj.custom.email + ",\"" + newsletterOptionsObj.custom.options + "\"");
        CustomObjectMgr.remove(newsletterOptionsObj);
    }

    fileWriter.close();
}

/**
 * Export orders to file
 */
module.exports.execute = function (params) {
    var currentSite   = Site.current;
    var siteName      = currentSite.name;
    var sftpTargetDir = params.sftpTargetDir;
    var filename      = "newsletter-" + siteName + ".csv";
    var impexDir      = File.IMPEX + File.SEPARATOR + "newsletter";
    var impexPath     = impexDir + File.SEPARATOR + filename;

    Logger.info("Starting Export " + siteName + " Newsletter Options job.");

    try {
        Transaction.wrap(function () {
            var sftpClient = SFTPUtils.SFTPConnect();

            if (sftpClient.getConnected()) {
                var filesInfo = sftpClient.list(sftpTargetDir);
                var result    = false;

                if (!empty(filesInfo)) {
                    Logger.info(siteName + " Newsletter - Downloading files from SFTP");
                    result = SFTPUtils.downloadFilesFromSFTP(sftpClient, sftpTargetDir, impexDir, filename);
                }
    
                if (result) {
                    var downloadedFile = new File(impexPath);
                    addCustomObjectDataToFile(downloadedFile, impexDir);

                } else if (!result.status) {
                    Logger.info(siteName + " Newsletter - SFTP file " + sftpTargetDir + File.SEPARATOR + filename + " not found");
                    sftpClient.disconnect();
                    throw new Error(siteName + " Newsletter - SFTP file " + sftpTargetDir + File.SEPARATOR + filename + " not found");
                }

                SFTPUtils.uploadFilesToSFTP(sftpClient, impexDir, sftpTargetDir, filename);
        
                sftpClient.disconnect();
            } else {
                throw new Error(siteName + " Newsletter - Could not connect to SFTP");
            }
        });

        return new Status(Status.OK, "OK", "Export has been successfully finished.");
    } catch (e) {
        Logger.error("Newsletter - Export " + siteName + " Newsletter Options error - " + e.toString());
        return new Status(Status.ERROR, "ERROR", e.toString());
    }
};
