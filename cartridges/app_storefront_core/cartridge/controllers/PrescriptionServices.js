"use strict";

// API includes
var server      = require("server");
var StringUtils = require("dw/util/StringUtils");
var BasketMgr   = require("dw/order/BasketMgr");
var File        = require("dw/io/File");
var Transaction = require("dw/system/Transaction");
var Logger      = require("dw/system/Logger");
var Resource    = require("dw/web/Resource");

// Script Includes
var csrfProtection    = require("*/cartridge/scripts/middleware/csrf");
var PrescriptionService = require("*/cartridge/scripts/services/PrescriptionService");

var generalUtils = require("app_storefront_core/cartridge/client/default/js/generalUtils.js");

server.post(
    "DeleteImage",
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var success = false;
        var pid = req.form.pid;
        var currentBasket = BasketMgr.getCurrentBasket();
        var productLineItems = currentBasket.getProductLineItems();
        var iterator = productLineItems.iterator();
        Transaction.wrap(function () {
            while (iterator.hasNext() && success == false) {
                var productLineItem = iterator.next();
                if (productLineItem.getUUID() == pid) {
                    productLineItem.custom.difarmaPrescriptionId = null;
                    productLineItem.custom.difarmaPrescriptionFileName = null;
                    success = true;
                }
            }
        });
        res.json({
            success: success
        });
        return next();
    }
);

server.post(
    "ApplyImageToAll",
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var pid = req.form.pid;
        var currentBasket = BasketMgr.getCurrentBasket();
        var productLineItems = currentBasket.getProductLineItems();
        var iterator = productLineItems.iterator();
        var toApply = [];
        var lineItem;
        while (iterator.hasNext() && !lineItem) {
            let productLineItem = iterator.next();
            if (productLineItem.getUUID() == pid) {
                lineItem = productLineItem;
            } else if (productLineItem.product.custom.difarmaPrescriptionModel == "simple" && !productLineItem.custom.difarmaPrescriptionId) {
                toApply.push(productLineItem);
            }
        }
        if (lineItem) {
            Transaction.wrap(function () {
                for (var i in toApply) {
                    let productLineItem = toApply[i];
                    productLineItem.custom.difarmaPrescriptionId = lineItem.custom.difarmaPrescriptionId;
                    productLineItem.custom.difarmaPrescriptionFileName = lineItem.custom.difarmaPrescriptionFileName;
                }
            });
        }
        res.json({
            success: true
        });
        return next();
    }
);

server.post(
    "UploadImage",
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var success = false;
        var pid = req.form.pid;
        var fileName = "";
        var msg = "";
        var hasDiacritics = /[^A-Za-z0-9\s]+/g;

        if (!empty(pid)) {
            var filesMap = request.httpParameterMap.processMultipart(function (field, ct, oname) {
                if (!empty(oname)) {
                    if (oname.match(hasDiacritics)) {
                        oname = generalUtils.removeDiacritics(oname);
                    }

                    // The limit for the file name should be 40 characters, so we need to remove extra characters
                    if (oname.length > 40) {
                        var nameArray = /(.+?)(\.[^.]*$|$)/g.exec(oname);
                        oname = nameArray[1].slice(0, 30) + nameArray[2];
                    }

                    var filePath = StringUtils.format("{0}/{1}", File.IMPEX, oname);
                    /** Checks if upload folder exists, 
                      * Otherwise uploads it to root folder because it is not possible to create folders here */
                    var folder = new File(File.IMPEX + File.SEPARATOR + "upload");
                    if (folder.exists()) {
                        filePath = StringUtils.format("{0}/upload/{1}", File.IMPEX, oname);
                    }
                    return new File(filePath);
                }
            });
            var prescriptionService = new PrescriptionService();
            var AWSResponse = prescriptionService.UploadFile(filesMap.file);
            if (AWSResponse && AWSResponse.status == "OK") {
                var currentBasket = BasketMgr.getCurrentBasket();
                var productLineItems = currentBasket.getProductLineItems();
                var iterator = productLineItems.iterator();
                Transaction.wrap(function () {
                    while (iterator.hasNext() && fileName == "") {
                        var productLineItem = iterator.next();
                        if (productLineItem.getUUID() == pid) {
                            productLineItem.custom.difarmaPrescriptionId = AWSResponse.object.generatedImageCode;
                            productLineItem.custom.difarmaPrescriptionFileName = AWSResponse.object.fileUploadedName;
                            productLineItem.custom.difarmaPrescriptionFileUrl = prescriptionService.GetPrescriptionURL(AWSResponse.object.generatedImageCode);
                            fileName = AWSResponse.object.fileUploadedName;
                        }
                    }
                });
                success = true;
            } else {
                if (AWSResponse.error == 415) {
                    msg = Resource.msg("prescription.invalidformat", "checkout", null);
                } else if (AWSResponse.error == 413) {
                    msg = Resource.msg("prescription.toolarge", "checkout", null);
                }

                Logger.error("Upload prescription file error - " + AWSResponse.errorMessage);
            }
        }
        res.json({
            success: success,
            fileName: fileName,
            msg: msg
        });
        return next();
    }
);

module.exports = server.exports();
