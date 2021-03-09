"use strict";

var server = require("server");
var base = module.superModule;

var csrfProtection    = require("*/cartridge/scripts/middleware/csrf");
var validation        = require("*/cartridge/scripts/account/validation");
var Resource          = require("dw/web/Resource");
var Site              = require("dw/system/Site");
var accountHelpers    = require("*/cartridge/scripts/helpers/accountHelpers");
var validationHelpers = require("*/cartridge/scripts/helpers/validationHelpers");
var AccountModel      = require("*/cartridge/models/account");
var emailHelpers      = require("*/cartridge/scripts/helpers/emailHelpers");

server.extend(base);

/**
 * Sanitizes a fullName, removing trailing and extra spaces
 * @param {String} fullName the full name to sanitize
 */
function normalizeFullName(fullName) {
    return fullName.trim().replace(/\s\s+/g, " ");
}

/**
 * Formats the given phone number to be saved in a profile
 * @param {String} phoneNumber a valid phone number
 */
function formatPhoneNumber(phoneNumber) {
    return phoneNumber.replace(/[\s]+/, "").split(")").join(") ");
}

/**
 * Sets the proper attributes for the new customer
 * @param {dw.customer.Customer} customer the customer instance
 * @param {Object} data a validated form data
 */
function setupNewProfile(customer, data) {
    var documentNumber = data.identificationNumber;
    var newCustomerProfile = customer.getProfile();
    var fullName = normalizeFullName(data.fullName);
    var [firstName] = fullName.split(/[\s]+/);
    var lastName = fullName.replace(firstName + " ", "");
    var [day, month, year] = data.birth.split(/[\s-/]/);

    newCustomerProfile.firstName = firstName;
    newCustomerProfile.lastName = !empty(lastName) ? lastName : firstName;
    newCustomerProfile.phoneMobile = formatPhoneNumber(data.phone);
    newCustomerProfile.email = data.email;
    newCustomerProfile.birthday = new Date(year, (+month - 1), day);
    newCustomerProfile.gender = parseInt(data.gender, 10);

    accountHelpers.setProfileDocumentsData(newCustomerProfile, data.document, documentNumber);
}

/**
 * Creates an account model for the current customer
 * @param {Object} req - local instance of request object
 * @returns {Object} a plain object of the current customer's account
 */
function getAccountModel(req) {
    if (!req.currentCustomer.profile) {
        return null;
    }

    return new AccountModel(req.currentCustomer, null, null);
}

/**
 * Returns ajax content with the error fields
 */
server.replace("ValidateFacebookInfo", server.middleware.https, function (req, res, next) {
    var form = req.form;
    var errors = {};

    var cedulaError = validationHelpers.validateDocument(form.document, form.cedula);
    if (cedulaError) {
        errors.cedula = cedulaError;
    } else {
        var alreadyTakenError = validationHelpers.documentAlreadyRegistered(form.document, form.cedula);

        if (alreadyTakenError) {
            errors.cedula = alreadyTakenError;
        }
    }

    res.json({
        fields: errors
    });
    next();
});

server.replace("SaveFacebookInfo", 
    function (req, res, next) {
        var Transaction  = require("dw/system/Transaction");
        var CustomerMgr  = require("dw/customer/CustomerMgr");
        var Logger       = require("dw/system/Logger");
        var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");
        
        var form = req.form;
        var customer = CustomerMgr.getCustomerByCustomerNumber(
            req.currentCustomer.profile.customerNo
        );
        var errors = {};
        if (!customer.authenticated) {
            res.json({
                success: false
            });
            return next();
        }
        if (!form.firstName || !form.lastName) {
            errors.name = Resource.msg("error.missing.name", "forms", null);
        }

        var cedulaError = validationHelpers.validateDocument(form.document, form.cedula);
        if (cedulaError) {
            errors.cedula = cedulaError;
        } else {
            var alreadyTakenError = validationHelpers.documentAlreadyRegistered(form.document, form.cedula);
    
            if (alreadyTakenError) {
                errors.cedula = alreadyTakenError;
            }
        }

        if (Object.keys(errors).length) {
            res.json({
                success: false,
                fields: errors
            });
        } else {
            Transaction.wrap(function () {
                customer.profile.setFirstName(form.firstName);
                customer.profile.setLastName(form.lastName);
                customer.profile.setEmail(form.email);
                customer.profile.setPhoneMobile(form.phone);
                accountHelpers.setProfileDocumentsData(customer.profile, form.document, form.cedula);
            });

            var loyaltyCustomer = LoyaltyUtils.getOrCreateCustomer(customer);
            LoyaltyUtils.updateSfccLoyaltyData(loyaltyCustomer);

            try {
                accountHelpers.sendCreateAccountEmail(customer.profile);
            } catch (e) {
                Logger.error("It was not possible to send create account email to the user: " + form.email);
            }

            var guestData = {
                document : form.document,
                number   : form.cedula
            };

            res.json({
                success: true,
                guestData : guestData,
                customerProfile: customer.profile
            });
        }
        return next();
    }
);

/**
 * Sets up the profile data to an object with its custom attributes
 * @param {dw.customer.Profile} profile the Profile instance
 * @returns {Object} the object with the attributes
 */
function getProfileModel(profile) {
    var birthdate;
    if (profile.birthday) {
        birthdate = profile.birthday.toISOString().split("T")[0].split("-").reverse().join("/");
    }
    var profileModel = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: profile.firstName + " " + profile.lastName,
        email: profile.email,
        ccDocument: profile.custom.ccDocument,
        ceDocument: profile.custom.ceDocument,
        passport: profile.custom.passport,
        phone: profile.phoneMobile,
        gender: profile.gender.value,
        birthdate: birthdate,
    };
    if (profileModel.firstName === profileModel.lastName) {
        profileModel.fullName = profileModel.fullName.split(" ")[0];
    }
    return profileModel;
}
/**
 * Extending endpoint to add the new Profile information
 */
server.append("Show", function (req, res, next) {
    if (!empty(req.currentCustomer)) {
        var viewData     = res.getViewData();
        viewData.profile = getProfileModel(req.currentCustomer.raw.profile);

        var accountModel = getAccountModel(req);
        var profileForm = server.forms.getForm("profile");
        profileForm.clear();
        profileForm.customer.firstname.value = accountModel.profile.firstName;
        profileForm.customer.lastname.value  = accountModel.profile.lastName;
        profileForm.customer.phone.value     = accountModel.profile.phone;
        profileForm.customer.email.value     = accountModel.profile.email;
        viewData.profileForm                 = profileForm;

        res.setViewData(viewData);
    }
    next();
});

/**
 * Returns ajax content with the error fields
 */
server.post("Validate", server.middleware.https, function (req, res, next) {
    var errors = validation.validateFilledFields(req.form);
    res.json({
        fields: errors
    });
    next();
});

/**
 * Replacing the default SFRA route to handle the new attributes for Customer
 * and getting the date from a standard form
 */
server.replace("SubmitRegistration", server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    var CustomerMgr = require("dw/customer/CustomerMgr");

    var form = req.form;
    form.email = form.dwfrm_profile_customer_email;
    var errors = validation.validate(form);
    
    if (!empty(errors) && !empty(errors.email)) {
        errors.dwfrm_profile_customer_email = errors.email;
        delete errors.email;
    }

    res.setViewData(form);

    if (empty(errors)) {

        this.on("route:BeforeComplete", function (req, res) { // eslint-disable-line no-shadow
            var Transaction = require("dw/system/Transaction");
            var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");

            var authenticatedCustomer;
            var serverError;

            var form = res.getViewData();
                
            if (empty(errors)) {
                var login = form.email;
                var password = form.password;
                var newCustomer = null;

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
                            setupNewProfile(newCustomer, form);
                            accountHelpers.sendCreateAccountEmail(newCustomer.profile);
                        }
                    });

                    LoyaltyUtils.createCustomer(newCustomer);
                } catch (e) {
                    if (e.authError) {
                        serverError = true;
                    }
                }
            }

            if (serverError) {
                res.setStatusCode(500);
                res.json({
                    success: false,
                    errorMessage: Resource.msg("error.message.unable.to.create.account", "login", null)
                });

                return;
            }

            if (empty(errors)) {
                res.setViewData({ authenticatedCustomer: authenticatedCustomer });
                res.json({
                    success: true,
                    redirectUrl: accountHelpers.getLoginRedirectURL(req.querystring.rurl, req.session.privacyCache, true)
                });

                req.session.privacyCache.set("args", null);
            } else {
                res.json({
                    fields: errors
                });
            }
        });
        this.on("route:Complete", function (req, res) {
            var Transaction = require("dw/system/Transaction");
            var viewData = res.getViewData();
            if (viewData.success && customer.authenticated) {
                Transaction.wrap(function () {
                    customer.profile.custom.lastProfileChangeTimestamp = new Date();
                });
            }
        });
    } else {
        res.json({
            fields: errors
        });
    }

    return next();
}
);

/**
 * Extending endpoint to add profile data
 */
server.append("EditProfile", function (req, res, next) {
    if (!empty(req.currentCustomer)) {
        var customer = req.currentCustomer.raw;
        var viewData = res.getViewData();
        viewData.profile = getProfileModel(customer.profile);
        viewData.profile.phone = viewData.profile.phone.replace(/[\s]/g, "");
        res.setViewData(viewData);
    }
    next();
});

/**
 * Replacing endpoint to match the new form and saving with the custom attributes
 */
server.replace("SaveProfile", server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    var Transaction = require("dw/system/Transaction");
    var CustomerMgr = require("dw/customer/CustomerMgr");
    var URLUtils = require("dw/web/URLUtils");

    var fields = validation.validate(req.form, true);
    delete fields.termsAndConditions;
    delete fields.passwordConfirm;
    var errors = null;
    if (!empty(fields) && Object.keys(fields).length > 0) {
        errors = fields;
    }
    
    var profileForm = server.forms.getForm("profile");

    // form validation
    if (profileForm.customer.email.value.toLowerCase()
        !== profileForm.customer.emailconfirm.value.toLowerCase()) {
        errors = errors || {};
        errors.dwfrm_profile_customer_emailconfirm = Resource.msg("error.message.mismatch.email", "forms", null);
    }

    if (empty(errors)) {
        res.setViewData(req.form);
        this.on("route:BeforeComplete", function (req, res) { // eslint-disable-line no-shadow
            var formInfo = res.getViewData();
            var customer = CustomerMgr.getCustomerByCustomerNumber(
                req.currentCustomer.profile.customerNo
            );
            var profile = customer.getProfile();
            var customerLogin;
            var status;

            formInfo.email = formInfo.dwfrm_profile_customer_email;

            Transaction.wrap(function () {
                status = profile.credentials.setPassword(
                    formInfo.password,
                    formInfo.password,
                    true
                );

                if (status.error) {
                    errors = errors || {};
                    errors.password = Resource.msg("error.password", "forms", null);
                } else {
                    customerLogin = profile.credentials.setLogin(
                        formInfo.email,
                        formInfo.password
                    );
                }
            });
            if (customerLogin) {
                Transaction.wrap(function () {
                    setupNewProfile(customer, formInfo);
                });

                res.json({
                    success: true,
                    redirectUrl: URLUtils.url("Account-Show").toString()
                });
            } else {
                res.json({
                    success: false,
                    fields: errors
                });
            }
        });
        this.on("route:Complete", function (req, res) {
            var viewData = res.getViewData();
            if (viewData.success && customer.authenticated) {
                Transaction.wrap(function () {
                    customer.profile.custom.lastProfileChangeTimestamp = new Date();
                });
                
                accountHelpers.sendAccountEditedEmail(req.currentCustomer.profile, emailHelpers.emailTypes.accountEdited);
            }
        });
    } else {
        res.json({
            success: false,
            fields: errors
        });
    }
    return next();
}
);

module.exports = server.exports();
