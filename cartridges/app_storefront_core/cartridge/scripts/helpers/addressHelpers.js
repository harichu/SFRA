"use strict";

/**
 * Gets customer address list;
 * 
 * @param {String} customerNo 
 * @param {String} [sortingAttr] 
 * @param {String} [sortingOrder] 
 */
function getCustomerAddressList(customerNo, sortingAttr, sortingOrder) {
    var CustomerMgr  = require("dw/customer/CustomerMgr");
    var AddressModel = require("*/cartridge/models/address");
    var collections  = require("*/cartridge/scripts/util/collections");

    var customer       = CustomerMgr.getCustomerByCustomerNumber(customerNo);
    var rawAddressBook = customer.addressBook.getAddresses();
    var addressBook    = collections.map(rawAddressBook, function (rawAddress) {
        var addressModel = new AddressModel(rawAddress);
        addressModel.address.UUID = rawAddress.UUID;
        return addressModel;
    });

    if (sortingAttr) {
        var order = sortingOrder || "asc";

        addressBook.sort(function (item1, item2) {
            if (order === "asc") {

                if (item1.address.addressId < item2.address.addressId) {
                    return -1;
                }
                
                return 1;
            } else if (order === "desc") {
                if (item1.address.addressId > item2.address.addressId) {
                    return -1;
                }
                
                return 1;
            }
        });
    }

    return addressBook;
}

module.exports = {
    getCustomerAddressList : getCustomerAddressList
};
