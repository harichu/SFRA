"use strict";

var server = require("server"),
    csrfProtection = require("*/cartridge/scripts/middleware/csrf");

server.extend(module.superModule);

/**
 * Endpoint was modified in order to ensure that correct validation would be used on the onStorePickup 
 */
server.append(
    "SubmitShipping",
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req1, res1, next) {
        var viewData = res1.getViewData();

        var isGuest = empty(customer.profile);
        if (isGuest) {
            var profileForm = server.forms.getForm("profile");
            viewData.guestData = {
                document : profileForm.customer.document.value,
                number   : profileForm.customer.cedula.value
            };
        }

        viewData.fieldsToValidate = {fullName: true, cedula: true};
        res1.setViewData(viewData);
        next();
    }
);

module.exports = server.exports();
