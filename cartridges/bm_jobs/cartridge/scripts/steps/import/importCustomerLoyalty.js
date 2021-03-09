"use strict";

/* Global exports require */
var Logger          = require("dw/system/Logger"),
    File            = require("dw/io/File"),
    Status          = require("dw/system/Status"),
    XMLStreamReader = require("dw/io/XMLStreamReader"),
    FileReader      = require("dw/io/FileReader"),
    XMLStreamWriter = require("dw/io/XMLStreamWriter"),
    FileWriter      = require("dw/io/FileWriter"),
    XMLStreamCons   = require("dw/io/XMLStreamConstants"),
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
                return new Status(Status.OK, "No customer profiles for import in SFTP folder: " + sourceFolder);
            }

            var files = SFTPUtils.getFilesInLocalFolder(webDavFolder);

            if (files.empty) {
                return new Status(Status.OK, "No customer profiles for import in WebDAV folder: " + webDavFolder);
            }

            for (var i = 0; i < files.length; i ++) {
                var file = files[i];

                if (file.directory) {
                    continue;
                }

                var fileReader = new FileReader(file);
                var xmlStreamReader = new XMLStreamReader(fileReader);
                var tempFileFolderPath = File.IMPEX + File.SEPARATOR + "src" + File.SEPARATOR + webDavFolder + File.SEPARATOR + "temp";
                var tempFileFolder = new File(tempFileFolderPath);

                if (!tempFileFolder.exists()) {
                    tempFileFolder.mkdirs();
                }

                // New filtered xml file that will contain only objects that need to be updated
                var tempFile = new File(tempFileFolderPath + File.SEPARATOR + file.name);
                var fileWriter = new FileWriter(tempFile);
                var xmlStreamWriter = new XMLStreamWriter(fileWriter);
                
                xmlStreamWriter.writeStartDocument();
                xmlStreamWriter.writeStartElement("customers");
                xmlStreamWriter.writeDefaultNamespace("http://www.demandware.com/xml/impex/customer/2006-10-31");
                xmlStreamWriter.writeCharacters("");

                try {
                    while (xmlStreamReader.hasNext()) {
                        if (xmlStreamReader.next() === XMLStreamCons.START_ELEMENT && xmlStreamReader.getLocalName() === "customer") {
                            var customerNode = xmlStreamReader.readXMLObject();
                            xmlStreamWriter.writeRaw(customerNode.toXMLString());
                        }
                    }
                    
                    xmlStreamReader.close();
                    fileReader.close();
                    xmlStreamWriter.writeEndElement();
                    xmlStreamWriter.writeEndDocument();
                    xmlStreamWriter.close();
                    fileWriter.close();
                    file.remove();
                } catch (err) {
                    Logger.error("ImportCustomerLoyalty.js: Error processing the file" + file.name + " Error: " + err.message);
                }
            }
            var tempFiles = SFTPUtils.getFilesInLocalFolder("customerimport" + File.SEPARATOR + "temp");

            if (tempFiles.empty) {
                return new Status(Status.OK, "No customer profiles for import in WebDAV temp folder: " + webDavFolder);
            }

            for (var j = 0; j < tempFiles.length; j ++) {
                tempFile = tempFiles[j];
                var tempFilePath = tempFile.getFullPath().split("src" + File.SEPARATOR)[1];
                var Pipelet = require("dw/system/Pipelet");
                var result = new Pipelet("ImportCustomers").execute({
                    ImportMode: "MERGE",
                    ImportFile: tempFilePath
                });

                if (!result || result.ErrorCode !== 0) {
                    return new Status(Status.ERROR, "File import failed.");
                } else {
                    tempFile.remove();
                }
            }
        }
    } catch (er) {
        var message = "Customer Import failed. Error: " + er;
        Logger.error(message);
    } finally {
        if (xmlStreamReader) {
            xmlStreamReader.close();
        }

        if (xmlStreamWriter) {
            xmlStreamWriter.close();
        }

        if (fileWriter) {
            fileWriter.close();
        }

        if (fileReader) {
            fileReader.close();
        }
    }

    return new Status(Status.OK, "Customer import successfully done.");
};
