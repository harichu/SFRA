"use strict";

var server = require("server");
var base = module.superModule;
var csrfProtection = require("*/cartridge/scripts/middleware/csrf");
var validation = require("*/cartridge/scripts/account/validation");
var Resource = require("dw/web/Resource");
var Site = require("dw/system/Site");
var accountHelpers = require("*/cartridge/scripts/helpers/accountHelpers");
var validationHelpers = require("*/cartridge/scripts/helpers/validationHelpers");
var emailHelpers = require("*/cartridge/scripts/helpers/emailHelpers");

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
    newCustomerProfile.custom.difarmaRunRutNit = validationHelpers.formatRUTNumber(data.rut);
    newCustomerProfile.custom.pensionHealthInstitution = parseInt(data.pensionHealthInstitution, 10);
}

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
        difarmaRunRutNit: profile.custom.difarmaRunRutNit,
        pensionHealthInstitution: profile.custom.pensionHealthInstitution.value,
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
        var viewData = res.getViewData();
        viewData.profile = getProfileModel(req.currentCustomer.raw.profile);
        res.setViewData(viewData);
    }
    next();
});

/**
 * Replacing the default SFRA route to handle the new attributes for Customer
 * and getting the date from a standard form
 */
server.replace("SubmitRegistration", server.middleware.https, csrfProtection.validateAjaxRequest, function (req1, res1, next) {
    var CustomerMgr = require("dw/customer/CustomerMgr");

    var form1 = req1.form;
    form1.email = form1.dwfrm_profile_customer_email;
    var errors = validation.validate(form1);

    if (!empty(errors) && !empty(errors.email)) {
        errors.dwfrm_profile_customer_email = errors.email;
        delete errors.email;
    }
    res1.setViewData(form1);

    if (empty(errors)) {

        this.on("route:BeforeComplete", function (req, res) { // eslint-disable-line no-shadow
            var Transaction  = require("dw/system/Transaction");
            var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");
            var authenticatedCustomer;
            var serverError;

            var form = res.getViewData();
                
            if (empty(errors)) {
                var login = form.email;
                var password = form.password;

                // attempt to create a new user and log that user in.
                try {
                    var newCustomer = null;

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
                    var viewData = res.getViewData();
                    viewData.success = false;
                    res.setViewData(viewData);
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
        this.on("route:Complete", function (_req2, res2) {
            var Transaction = require("dw/system/Transaction");
            var viewData = res2.getViewData();
            if (viewData.success && customer && customer.authenticated) {
                Transaction.wrap(function () {
                    customer.profile.custom.lastProfileChangeTimestamp = new Date();
                });
            }
        });
    } else {
        res1.json({
            success: empty(errors),
            fields: errors
        });
    }

    return next();
});

/**
 * Extending endpoint to add profile data
 */
server.append("EditProfile", function (req, res, next) {
    if (!empty(req.currentCustomer)) {
        var customer = req.currentCustomer.raw;
        var viewData = res.getViewData();
        viewData.profile = getProfileModel(customer.profile);
        viewData.profile.phone = viewData.profile.phone.replace(/[\s]/g, "").trim();
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
    if (Resource.msg("error.rut.registered", "forms", null) === fields.rut) {
        delete fields.rut;
    }
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
});


/**
 * Validates the given rut number and returns the proper erro message, if any
 * @param {String} rutNumber the RUT number to be validated
 */
function validateRut(rutNumber) {
    var errorMessage = null;
    if (empty(rutNumber)) {
        errorMessage = Resource.msg("error.missing", "forms", null);
    } else if (!validationHelpers.validateRut(rutNumber)) {
        errorMessage = Resource.msg("error.rut.invalid", "forms", null);
    } else if (validationHelpers.rutAlreadyRegistered(validationHelpers.formatRUTNumber(rutNumber))) {
        errorMessage = Resource.msg("error.rut.registered", "forms", null);    
    }
    return errorMessage;
}

/**
 * Returns ajax content with the error fields
 */
server.replace("ValidateFacebookInfo", server.middleware.https, function (req, res, next) {
    var form = req.form;
    var errors = {};
    var rutError = validateRut(form.rut);
    
    if (!empty(rutError)) {
        errors.rut = rutError;
    }
    
    if (empty(form.phone)) {
        errors.phone = Resource.msg("error.missing", "forms", null);
    } else if (!validationHelpers.validateChileanPhoneNumber(form.phone)) {
        errors.phone = Resource.msg("error.parse.phone", "forms", null);
    }

    if (Object.keys(errors).length === 0) {
        res.json({
            success: true
        });
    } else {
        res.json({
            fields: errors
        });
    }
    next();
});

/**
 * Updates SFCC Loyalty Data;
 */
server.append("Login",
    function (req, res, next) {
        this.on("route:BeforeComplete", function (req1, res1) {
            var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");
            var viewData     = res1.getViewData();

            if (viewData.authenticatedCustomer) {
                var loyaltyCustomer = LoyaltyUtils.getOrCreateCustomer(viewData.authenticatedCustomer);
                LoyaltyUtils.updateSfccLoyaltyData(loyaltyCustomer);
            }
        });

        return next();
    }
);

server.replace("SaveFacebookInfo",
    function (req, res, next) {
        var form = req.form;
        var Transaction = require("dw/system/Transaction");
        var CustomerMgr = require("dw/customer/CustomerMgr");
        var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");

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

        var rutError = validateRut(form.rut);
        if (!empty(rutError)) {
            errors.rut = rutError;
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
                customer.profile.custom.difarmaRunRutNit = validationHelpers.formatRUTNumber(form.rut);

                var clubCruzVerdeGroup = Site.current.getCustomPreferenceValue("clubCruzVerdeGroup");
                CustomerMgr.getCustomerGroup(clubCruzVerdeGroup).assignCustomer(customer);
            });

            var loyaltyCustomer = LoyaltyUtils.getOrCreateCustomer(customer);
            LoyaltyUtils.updateSfccLoyaltyData(loyaltyCustomer);

            try {
                accountHelpers.sendCreateAccountEmail(customer.profile);
            } catch (e) {
                var Logger = require("dw/system/Logger");
                Logger.error("It was not possible to send create account email to the user: " + form.email);
            }
            res.json({
                success: true,
                customerProfile: customer.profile
            });
        }
        return next();
    }
);

module.exports = server.exports();
