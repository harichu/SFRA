"use strict";

function execute(params) {

    var oldValue = params.oldValue;
    var newValue = params.newValue;

    function callback(profile) {
        var addresses = profile.addressBook.getAddresses();

        addresses.toArray().filter(function (address) {
            if (address.getStateCode() === oldValue) {
                dw.system.Logger.info("Updating address with ID '" + address.ID + "' for customer '" + profile.customerNo + "'.");

                updateAddress(address, newValue);
            }
        });
    }

    try {
        dw.customer.CustomerMgr.processProfiles(callback, "");
    } catch (error) {
        dw.system.Logger.error("StateCodeUpdate - Error: ", error.toString());
    }
}

function updateAddress(address, newValue) {
    dw.system.Transaction.wrap(function () {
        address.setStateCode(newValue);
    });
}

exports.execute = execute;
