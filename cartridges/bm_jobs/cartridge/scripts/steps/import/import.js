"use strict";

var Status = require("dw/system/Status");
var File = require("dw/io/File");
var Logger = require("dw/system/Logger");
var WebDAVUtils = require("~/cartridge/scripts/util/WebDAVUtils");

/**
 * Update using a XML file stored on webdav in Sites/Impex/src/ folder.
 */
module.exports.execute = function (params) {
    try {
        var folder = File.IMPEX + File.SEPARATOR + "src" + File.SEPARATOR + params.folder;
        var pipeline = params.pipeline;
        var filePattern = params.filePattern;
        var afterImportOption = params.afterImportOption;
        var numberOfAttempts = Number(params.numberOfAttempts);
        Logger.info("Import " + pipeline + " - Getting local file");
        var files = WebDAVUtils.getFilesInLocalFolder(folder, filePattern);
        if (empty(files)) {
            return new Status(Status.OK, "NO_FILES", "No files to import in folder " + folder);
        }

        files.toArray().forEach(function (file) {
            var attemptsCount = 1;
            var success = false;
            // run while number of attempts is greater or equal than attempts count and while import is not successful
            while ((attemptsCount <= numberOfAttempts) && !success) {
                Logger.info("Import - " + pipeline + " - Working with file " + file.name + ", attempt number " + attemptsCount);
                var result = dw.system.Pipeline.execute("PipeletWrapper-" + pipeline, {
                    ImportFile : params.folder + File.SEPARATOR + file.name,
                    ImportMode : params.importMode
                });
                
                if (result.Status.status === 0) {
                    success = true;
                    if (result.Status.details.DataErrorCount === 0 && result.Status.details.DataWarningCount === 0) {
                        Logger.info("Import - " + pipeline + " - Pipeline executed without errors. More information in " + result.Status.details.LogFileName);
                    } else {
                        Logger.info("Import - " + pipeline + " - Pipeline executed with errors and/or warnings. More information in " + result.Status.details.LogFileName);
                    }
                } else {
                    Logger.error("Import - " + pipeline + " - Pipeline executed with errors. More information in " + result.Status.details.LogFileName);
                }
                attemptsCount++;
            }

            if (success) {
                // delete source file
                if (afterImportOption === "DELETE") {
                    file.remove();
                // archive source file
                } else if (afterImportOption === "ARCHIVE") {
                    var archiveFolder = new File(folder + File.SEPARATOR + "archive");
                    if (!archiveFolder.exists()) {
                        archiveFolder.mkdirs();
                    }
                    var archiveFile = new File(archiveFolder.fullPath + File.SEPARATOR + file.name);
                    file.renameTo(archiveFile);
                // zip and archive source file
                } else if (afterImportOption === "ZIP") {
                    var zipArchiveFolder = new File(folder + File.SEPARATOR + "archive");
                    if (!zipArchiveFolder.exists()) {
                        zipArchiveFolder.mkdirs();
                    }
                    var archiveZipFile = new File(zipArchiveFolder.fullPath + File.SEPARATOR + file.name + ".zip");
                    file.zip(archiveZipFile);
                    file.remove();
                }
            } else {
                return new Status(Status.ERROR, "ERROR", "XML file could not be imported");
            }
        });

        return new Status(Status.OK, "OK", "Import has been successfully finished");
    } catch (e) {
        Logger.error("Import - " + pipeline + " - " + e.toString());
        return new Status(Status.ERROR, "ERROR", e.toString());
    }
};
