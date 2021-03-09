"use strict";

var log  = dw.system.Logger.getLogger("RemoveAddresses", "RemoveAddresses");
var customersSORWithoutCoordinates = [];

function callback(profile) {
    var customer            = profile.customer;
    var customerAddressBook = customer.getAddressBook();
    var Transaction         = require("dw/system/Transaction");

    // returns null if this customer has no profile, such as for an anonymous customer. (doc)
    if (!empty(customerAddressBook)) {
        var customerAddresses = customerAddressBook.getAddresses().toArray();
        var customerHasSOR    = !empty(profile.custom.hasSmartOrderRefill) && profile.custom.hasSmartOrderRefill;

        if (!empty(customerAddresses)) {
            var addressesToBeRemoved = customerAddresses.filter(function (address) {
                var addressWithoutLatLng = empty(address.custom.latitude) && empty(address.custom.longitude);

                if (customerHasSOR && addressWithoutLatLng) {
                    customersSORWithoutCoordinates.push(profile.customerNo);
                    return false;
                }

                return addressWithoutLatLng;
            });

            // Remove addresses without lat and long from the Customer's AddressBook
            addressesToBeRemoved.map(function (address) {
                Transaction.wrap(function () {
                    customerAddressBook.removeAddress(address);
                });
            });
        }
    }
}

function deleteCustomersWithoutCoordinates() {
    var CustomerMgr = require("dw/customer/CustomerMgr");

    CustomerMgr.processProfiles(callback, "");
}

function execute(pdict) {
    if (empty(pdict.FileFolder || pdict.FileName)) {
        log.error("Missing some of (FileFolder, FileName) parameters");
        return new dw.system.Status(dw.system.Status.ERROR, "ERROR");
    }

    var fileName   = pdict.FileName + ".csv";
    var fileFolder = pdict.FileFolder;
    var folder     = new dw.io.File(dw.io.File.IMPEX + dw.io.File.SEPARATOR + "src" + dw.io.File.SEPARATOR + fileFolder);

    if (!folder.exists()) {
        folder.mkdirs();
    }

    var file       = new dw.io.File(folder.fullPath + dw.io.File.SEPARATOR + fileName);
    var fileWriter = null;
    var csvWriter  = null;

    try {
        fileWriter = new dw.io.FileWriter(file);
        csvWriter  = new dw.io.CSVStreamWriter(fileWriter);

        deleteCustomersWithoutCoordinates();

        csvWriter.writeNext("Customers");

        // Save customers with SOR and Address without coordinates 
        customersSORWithoutCoordinates.map(function (customerNo) {
            csvWriter.writeNext(customerNo);
        });

    } catch (error) {
        log.error("Error fille writting proccess. Error message: " + error);

        return new dw.system.Status(dw.system.Status.ERROR, "ERROR");
    } finally {
        if (csvWriter) csvWriter.close();
        if (fileWriter) fileWriter.close();
    }
}

exports.execute = execute;
