/* eslint-disable */
'use strict';

var FileReader = require('dw/io/FileReader');
var XMLStreamReader = require('dw/io/XMLStreamReader');
var Status = require('dw/system/Status');
var File = require('dw/io/File');
var Logger = require('dw/system/Logger');
var OrderMgr = require('dw/order/OrderMgr');
var Order = require('dw/order/Order');
var Transaction = require('dw/system/Transaction');
var WebDAVUtils = require('~/cartridge/scripts/util/WebDAVUtils');
var XMLStreamConstants = require('dw/io/XMLStreamConstants');
/**
 * Update using a XML file stored on webdav in Sites/Impex/src/ folder.
 */
module.exports.execute = function(params) {
    var folder = File.IMPEX + File.SEPARATOR + 'src' + File.SEPARATOR + params.folder;
    var filePattern = params.filePattern;
    var afterImportOption = params.afterImportOption;

    Logger.info("Order Import - Getting local file");
    var files = WebDAVUtils.getFilesInLocalFolder(folder, filePattern);
    if (empty(files)) {
        return new Status(Status.OK, 'NO_FILES', 'No files to import in folder ' + folder);
    }

    files.toArray().forEach(function(file) {
        try {
            Logger.info("Order Import - Working with file " + file.name);
            var order = null;
            var shipments = null;
            var shipmentIndex = 0;
            var fileReader = new FileReader(file, "UTF-8");
            var xmlStreamReader = new XMLStreamReader(fileReader);
            while (xmlStreamReader.hasNext()) {
                Transaction.begin();
                xmlStreamReader.next();
                if (xmlStreamReader.getEventType() === XMLStreamConstants.START_ELEMENT) {
                    if (xmlStreamReader.getLocalName() === "order") {
                        var orderNumber = xmlStreamReader.getAttributeValue(null, "order-no");
                        if (!empty(orderNumber)) {
                            order = OrderMgr.getOrder(orderNumber);
                            shipments = order.getShipments();
                        }
                        if (!order) {
                            Logger.error("Couldn't find order with order number ", orderNumber);
                            return new Status(Status.ERROR, 'ERROR', 'Could not find order ' + orderNumber);
                        }
                    } else if (!empty(order) && xmlStreamReader.getLocalName() === "shipping-status") {
                        var shippingStatus =  xmlStreamReader.getElementText();
                        order.setShippingStatus(getShippingStatusValue(shippingStatus));
                    } else if (!empty(order) && xmlStreamReader.getLocalName() === "order-status") {
                        var orderStatus =  xmlStreamReader.getElementText();
                        order.setStatus(getOrderStatusValue(orderStatus));
                    } else if (!empty(order) && !empty(shipments) && xmlStreamReader.getLocalName() === "shipment") {
                        var shipmentObject = xmlStreamReader.readXMLObject();
                        var ns = shipmentObject.namespace();
                        var shipment = shipments[shipmentIndex++];

                        var shippingStatusXML = shipmentObject.ns::status;
                        var trackingNumber = shipmentObject.ns::["tracking-number"].toString();

                        var shippingStatusString = shippingStatusXML.ns::["shipping-status"].toString();

                        if (!empty(shippingStatusString)) {
                            shipment.setShippingStatus(getShippingStatusValue(shippingStatusString));
                        }

                        if (!empty(trackingNumber)) {
                            shipment.setTrackingNumber(trackingNumber);
                        }
                    }
                }
                Transaction.commit();
            }
        } catch (e) {
            Logger.error("Order Import - " + e.toString());
            Transaction.rollback();
            return new Status(Status.ERROR, 'ERROR', e.toString());
        } finally {
            xmlStreamReader.close();
            fileReader.close();
        }
        // delete source file
        if (afterImportOption === 'DELETE') {
            file.remove();
        // archive source file
        } else if (afterImportOption === 'ARCHIVE') {
            var archiveFolder = new File(folder + File.SEPARATOR + 'archive');
            if (!archiveFolder.exists()) {
                archiveFolder.mkdirs();
            }
            var archiveFile = new File(archiveFolder.fullPath + File.SEPARATOR + file.name);
            file.renameTo(archiveFile);
        // zip and archive source file
        } else if (afterImportOption === 'ZIP') {
            var archiveFolder = new File(folder + File.SEPARATOR + 'archive');
            if (!archiveFolder.exists()) {
                archiveFolder.mkdirs();
            }
            var archiveZipFile = new File(archiveFolder.fullPath + File.SEPARATOR + file.name + '.zip');
            file.zip(archiveZipFile);
            file.remove();
        }
    });

    return new Status(Status.OK, 'OK', 'Orders import has been successfully finished');
}

function getShippingStatusValue(status) {
    switch(status) {
        case "NOT_SHIPPED":
            return Order.SHIPPING_STATUS_NOTSHIPPED;
        case "PART_SHIPPED":
            return Order.SHIPPING_STATUS_PARTSHIPPED;
        case "SHIPPED":
            return Order.SHIPPING_STATUS_SHIPPED;
        default:
            return '';
    }
}

function getOrderStatusValue(status) {
    switch(status) {
        case "CREATED":
            return Order.ORDER_STATUS_CREATED;
        case "NEW":
            return Order.ORDER_STATUS_NEW;
        case "OPEN":
            return Order.ORDER_STATUS_OPEN;
        case "CANCELLED":
            return Order.ORDER_STATUS_CANCELLED;
        case "COMPLETED":
            return Order.ORDER_STATUS_COMPLETED;
        case "REPLACED":
            return Order.ORDER_STATUS_REPLACED;
        case "FAILED":
            return Order.ORDER_STATUS_FAILED;
        default:
            return '';
    }
}