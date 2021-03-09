"use strict";

var server = require("server");

var Resource = require("dw/web/Resource");
var URLUtils = require("dw/web/URLUtils");
var csrfProtection = require("*/cartridge/scripts/middleware/csrf");
var Site = require("dw/system/Site");

server.extend(module.superModule);

server.replace(
    "CreateAccount",
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var OrderMgr = require("dw/order/OrderMgr");

        var formErrors = require("*/cartridge/scripts/formErrors");

        var passwordForm = server.forms.getForm("newPasswords");
        var newPassword = passwordForm.newpassword.htmlValue;
        var confirmPassword = passwordForm.newpasswordconfirm.htmlValue;
        if (newPassword !== confirmPassword) {
            passwordForm.valid = false;
            passwordForm.newpasswordconfirm.valid = false;
            passwordForm.newpasswordconfirm.error =
                Resource.msg("error.message.mismatch.newpassword", "forms", null);
        }

        var orderHelpers = require("*/cartridge/scripts/order/orderHelpers");
        var order = orderHelpers.getApiOrderSecurily(req);

        if (empty(order)) {
            res.json({
                error: [Resource.msg("error.message.unable.to.create.account", "login", null)]
            });
            return next();
        }

        res.setViewData({ orderID: req.querystring.ID });
        var registrationObj = {
            firstName: order.billingAddress.firstName,
            lastName: order.billingAddress.lastName,
            phone: order.billingAddress.phone,
            email: order.customerEmail,
            password: newPassword
        };

        if (passwordForm.valid) {
            res.setViewData(registrationObj);

            this.on("route:BeforeComplete", function (req, res) { // eslint-disable-line no-shadow
                var CustomerMgr = require("dw/customer/CustomerMgr");
                var Transaction = require("dw/system/Transaction");
                var accountHelpers = require("*/cartridge/scripts/helpers/accountHelpers");

                var registrationData = res.getViewData();

                var login = registrationData.email;
                var password = registrationData.password;
                var newCustomer;
                var authenticatedCustomer;
                var newCustomerProfile;
                var errorObj = {};

                delete registrationData.email;
                delete registrationData.password;

                // attempt to create a new user and log that user in.
                try {
                    Transaction.wrap(function () {
                        var error = {};
                        newCustomer = CustomerMgr.createCustomer(login, password);

                        var authenticateCustomerResult = CustomerMgr.authenticateCustomer(login, password);
                        if (authenticateCustomerResult.status !== "AUTH_OK") {
                            error = { authError: true, status: authenticateCustomerResult.status };
                            throw error;
                        }

                        authenticatedCustomer = CustomerMgr.loginCustomer(authenticateCustomerResult, false);

                        if (!authenticatedCustomer) {
                            error = { authError: true, status: authenticateCustomerResult.status };
                            throw error;
                        } else {
                            var clubCruzVerdeGroup = Site.current.getCustomPreferenceValue("clubCruzVerdeGroup");
                            CustomerMgr.getCustomerGroup(clubCruzVerdeGroup).assignCustomer(newCustomer);

                            // assign values to the profile
                            newCustomerProfile = newCustomer.getProfile();

                            newCustomerProfile.firstName = registrationData.firstName;
                            newCustomerProfile.lastName = registrationData.lastName;
                            newCustomerProfile.phoneMobile = registrationData.phone;
                            newCustomerProfile.email = login;
                            newCustomerProfile.custom.difarmaRunRutNit = order.custom.difarmaRunRutNit;

                            order.setCustomer(newCustomer);
                        }
                    });
                } catch (e) {
                    errorObj.error = true;
                    errorObj.errorMessage = e.authError
                        ? Resource.msg("error.message.unable.to.create.account", "login", null)
                        : Resource.msg("error.message.password.constraints.not.matched", "forms", null);
                }

                if (errorObj.error) {
                    res.json({ error: [errorObj.errorMessage] });

                    return;
                }

                accountHelpers.sendCreateAccountEmail(authenticatedCustomer.profile);

                res.json({
                    success: true,
                    redirectUrl: URLUtils.url("Account-Show", "registration", "submitted").toString()
                });
            });
        } else {
            res.json({
                fields: formErrors.getFormErrors(passwordForm)
            });
        }

        return next();
    }
);

module.exports = server.exports();
