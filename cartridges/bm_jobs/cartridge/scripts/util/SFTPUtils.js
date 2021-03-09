"use strict";

var File = require("dw/io/File");
var SFTPClient = require("dw/net/SFTPClient");
var Site = require("dw/system/Site");
var Logger = require("dw/system/Logger");

/**
 * @function SFTPConnect
 * @description connects to (s)ftp server
 */
exports.SFTPConnect = function () {
    var SitePrefs = Site.getCurrent().getPreferences();
    var sftp = new SFTPClient();
    sftp.setTimeout(SitePrefs.custom.sftpTimeout);
    sftp.connect(SitePrefs.custom.sftpUrl, Number(SitePrefs.custom.sftpPort), SitePrefs.custom.sftpUsername, SitePrefs.custom.sftpPassword);
    return sftp;
};

/**
 * @function downloadFilesFromSFTP
 * @description Download files from SFTP
 * @param{Object} sftpClient
 * @param{String} sourceFolder
 * @param{String} targetFolder
 * @param{String} filePattern
 * @param{String} afterDownloadOption, defines what will be done with the original file after download
  */
exports.downloadFilesFromSFTP = function (sftpClient, sourceFolder, targetFolder, filePattern, afterDownloadOption) {
    var filesInfo     = sftpClient.list(sourceFolder);
    var foundFilesQty = 0;

    if (empty(filesInfo)) {
        Logger.info("SFTPUtils.js - SFTP file " + sourceFolder + File.SEPARATOR + filePattern + " not found");
        return false;
    }

    var regExp = new RegExp(filePattern);
    for (var i in filesInfo) {
        var fileInfo = filesInfo[i];
        if (fileInfo.directory || !regExp.test(fileInfo.name)) {
            continue;
        }
        var directory = new File(targetFolder);
        if (!directory.exists()) {
            directory.mkdirs();
        }
        var file = new File(directory.fullPath + File.SEPARATOR + fileInfo.name);

        if (!empty(file)) {
            foundFilesQty += 1;
        }

        if (sftpClient.getBinary(sourceFolder + File.SEPARATOR + fileInfo.name, file)) {
            Logger.info("SFTPUtils.js - downloaded file " + sourceFolder + File.SEPARATOR + fileInfo.name);
            // delete source file
            if (afterDownloadOption === "DELETE") {
                sftpClient.del(sourceFolder + File.SEPARATOR + fileInfo.name);
                Logger.info("SFTPUtils.js - after download deleted file " + sourceFolder + File.SEPARATOR + fileInfo.name);
            // archive source file
            } else if (afterDownloadOption === "ARCHIVE") {
                sftpClient.mkdir(sourceFolder + File.SEPARATOR + "archive");
                if (sftpClient.putBinary(sourceFolder + File.SEPARATOR + "archive" + File.SEPARATOR + fileInfo.name, file)) {
                    sftpClient.del(sourceFolder + File.SEPARATOR + fileInfo.name);
                    Logger.info("SFTPUtils.js - after download archived file " + sourceFolder + File.SEPARATOR + fileInfo.name);
                }
            // zip and archive source file
            } else if (afterDownloadOption === "ZIP") {
                sftpClient.mkdir(sourceFolder + File.SEPARATOR + "archive");
                var zipFile = new File(directory.fullPath + File.SEPARATOR + fileInfo.name + ".zip");
                file.zip(zipFile);
                if (sftpClient.putBinary(sourceFolder + File.SEPARATOR + "archive" + File.SEPARATOR + fileInfo.name + ".zip", zipFile)) {
                    sftpClient.del(sourceFolder + File.SEPARATOR + fileInfo.name);
                    zipFile.remove();
                    Logger.info("SFTPUtils.js - after download archived file " + sourceFolder + File.SEPARATOR + fileInfo.name);
                }
            }
        } else {
            return false;
        }
    }

    if (foundFilesQty === 0) {
        Logger.info("SFTPUtils.js - No files found on SFTP under " + sourceFolder + ".");
        return false;
    }

    return true;
};

/**
 * @function uploadFilesToSFTP
 * @description upload files to SFTP
 * @param{Object} sftpClient
 * @param{String} sourceFolder
 * @param{String} targetFolder
 * @param{String} filePattern
 * @param{String} afterUploadOption, defines what will happen with original file after upload
  */
exports.uploadFilesToSFTP = function (sftpClient, sourceFolder, targetFolder, filePattern, afterUploadOption) {
    var uploadedFilesList = [];
    var directory = new File(sourceFolder);

    if (!directory.exists()) {
        return false;
    }
    var files = new dw.util.ArrayList();
    files.addAll(directory.listFiles());

    if (empty(files)) {
        Logger.info("SFTPUtils.js - No files to be exported.");
        return true;
    }
    var regExp = new RegExp(filePattern);
    for (var i in files) {
        var file = files[i];
        if (!file.isFile() || !regExp.test(file.name)) {
            continue;
        }

        if (sftpClient.putBinary(targetFolder + File.SEPARATOR + file.name, file)) {
            uploadedFilesList.push(file);
            // delete source file
            if (afterUploadOption === "DELETE") {
                var localFilePath = sourceFolder + File.SEPARATOR + file.name;
                file.remove();
                Logger.info("SFTPUtils.js - after upload deleted file " + localFilePath);
            // archive source file
            } else if (afterUploadOption === "ARCHIVE") {
                var archiveFolder = new File(file.fullPath.replace(file.name, "") + "archive");
                if (!archiveFolder.exists()) {
                    archiveFolder.mkdirs();
                }
                var archiveFile = new File(archiveFolder.fullPath + File.SEPARATOR + file.name);
                file.renameTo(archiveFile);
                Logger.info("SFTPUtils.js - after upload archived file " + archiveFolder.fullPath + File.SEPARATOR + file.name);
            // zip and archive source file
            } else if (afterUploadOption === "ZIP") {
                var zipArchiveFolder = new File(file.fullPath.replace(file.name, "") + "archive");
                if (!zipArchiveFolder.exists()) {
                    zipArchiveFolder.mkdirs();
                }
                var zipArchiveFile = new File(zipArchiveFolder.fullPath + File.SEPARATOR + file.name + ".zip");
                file.zip(zipArchiveFile);
                file.remove();
                Logger.info("SFTPUtils.js - after upload archived file " + zipArchiveFolder.fullPath + File.SEPARATOR + file.name + ".zip");
            }
        }
    }

    return {
        "status"   : uploadedFilesList.length > 0,
        "fileList" : uploadedFilesList
    };
};

/**
 * @function getFilesInLocalFolder
 * @description retrieves all files from defined path that match pattern
 * @param{String} path
 */
exports.getFilesInLocalFolder = function (path) {
    var directory = new File(File.IMPEX + File.SEPARATOR + "src" + File.SEPARATOR + path);

    if (!directory.exists()) {
        return null;
    }
    
    var files = new dw.util.ArrayList();
    files.addAll(directory.listFiles());
    return files;
};
