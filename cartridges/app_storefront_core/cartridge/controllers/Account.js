"use strict";
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
var server = require("server");
var csrfProtection = require("*/cartridge/scripts/middleware/csrf");
var consentTracking = require("*/cartridge/scripts/middleware/consentTracking");
var reCaptcha = require("*/cartridge/scripts/helpers/reCaptchaHelpers"); // eslint-disable-line no-unused-vars
var validationHelpers = require("*/cartridge/scripts/helpers/validationHelpers"); // eslint-disable-line no-unused-vars
var Resource = require("dw/web/Resource");
var Site = require("dw/system/Site");
var BasketMgr = require("dw/order/BasketMgr");
var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");
var PBHelpers = require("*/cartridge/scripts/checkout/priceBooksHelpers");
var accountHelpers = require("*/cartridge/scripts/helpers/accountHelpers");
var Logger = require("dw/system/Logger");
var validation = require("*/cartridge/scripts/account/validation");

var base = module.superModule;

server.extend(base);

/**
 * Sanitizes a fullName, removing trailing and extra spaces
 * @param {String} fullName the full name to sanitize
 */
function normalizeFullName(fullName) {
    return fullName.trim().replace(/\s\s+/g, " ");
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
    newCustomerProfile.phoneMobile = data.phone;
    newCustomerProfile.email = data.email;
    newCustomerProfile.birthday = new Date(year, (+month - 1), day);
    newCustomerProfile.gender = parseInt(data.gender, 10);
    newCustomerProfile.custom.difarmaRunRutNit = data.rut;
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
        [birthdate] = profile.birthday.toISOString().split("T");
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
    var formatMoney  = require("dw/util/StringUtils").formatMoney;
    var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");
    var Money        = require("dw/value/Money");

    var currency = Site.current.getDefaultCurrency();

    req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

    if (!empty(req.currentCustomer)) {
        var viewData = res.getViewData();

        var loyalty = {
            isMember              : false,
            becomeABlackMemberUrl : Site.current.getCustomPreferenceValue("becomeABlackMemberURL"),
            isEnabled             : Site.current.getCustomPreferenceValue("enableLoyaltyService")
        };

        var clubLevel             = customer.profile.custom.difarmaLoyaltyClubLevel;
        var topGroupName          = Site.current.getCustomPreferenceValue("highestLoyaltyLevel");
        var formattedTopGroupName = topGroupName.charAt(0).toUpperCase() + topGroupName.slice(1).toLowerCase();
        var totalSaved            = customer.profile.custom.difarmaLoyaltyTotalSaved || 0;

        loyalty.isMember      = true;
        loyalty.level         = clubLevel;
        loyalty.isTopCustomer = LoyaltyUtils.isTopLoyaltyCustomer(customer);
        loyalty.topGroupName  = formattedTopGroupName;
        loyalty.savings       = formatMoney(new Money(0, currency));

        if (!isNaN(totalSaved)) {
            loyalty.savings = formatMoney(new Money(totalSaved, currency));
        } else if (typeof totalSaved === "string" && totalSaved.indexOf("$") >= 0) {
            loyalty.savings = totalSaved;
        }

        viewData.loyalty = loyalty;

        viewData.profile = getProfileModel(req.currentCustomer.raw.profile);

        res.setViewData(viewData);
    }
    this.on("route:BeforeComplete", function (req1, res1) {
        var profile = customer.profile;

        var viewData2 = res1.getViewData();
        viewData2.isCreated = req1.querystring.isCreated != "false";
        viewData2.isMissingDocumentData = !empty(profile) &&
            empty(profile.custom.ccDocument) &&
            empty(profile.custom.ceDocument) &&
            empty(profile.custom.passport) &&
            empty(profile.custom.difarmaRunRutNit);

        viewData2.profileForm = server.forms.getForm("profile");

        res1.setViewData(viewData2);
    });
    next();
});

/**
 * Enpoint was added as SFRA does not have a separate registration page anymore
 */
server.get(
    "StartRegister",
    consentTracking.consent,
    server.middleware.https,
    csrfProtection.generateToken,
    function (req, res, next) {
        var URLUtils = require("dw/web/URLUtils");

        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

        var rememberMe = false;
        var userName = "";
        var rurl = req.querystring.rurl;
        var navTabValue = req.querystring.action;
        var actionUrl;
        var isLoyaltyEnabled = Site.current.preferences.custom.enableLoyaltyService;

        if (rurl) {
            actionUrl = URLUtils.url("Account-SubmitRegistration", "rurl", rurl);
        } else {
            actionUrl = URLUtils.url("Account-SubmitRegistration");
        }

        if (req.currentCustomer.credentials) {
            rememberMe = true;
            userName = req.currentCustomer.credentials.username;
        }

        var breadcrumbs = [
            {
                htmlValue: Resource.msg("global.home", "common", null),
                url: URLUtils.home().toString()
            }
        ];

        var profileForm = server.forms.getForm("profile");
        profileForm.clear();

        res.render("/account/register", {
            navTabValue: navTabValue || "login",
            rememberMe: rememberMe,
            userName: userName,
            createAccountUrl: actionUrl,
            profileForm: profileForm,
            breadcrumbs: breadcrumbs,
            oAuthReentryEndpoint: 1,
            isLoyaltyEnabled : isLoyaltyEnabled
        });

        next();
    }
);

/**

 * Replacing the default SFRA route to handle the new attributes for Customer
 * and getting the date from a standard form
 */
server.replace("SubmitRegistration", server.middleware.https, csrfProtection.validateAjaxRequest, function (req1, res1, next) {
    var CustomerMgr = require("dw/customer/CustomerMgr");

    var form1 = req1.form;
    var errors = validation.validate(form1);
    res1.setViewData(form1);

    if (empty(errors)) {

        this.on("route:BeforeComplete", function (req, res) { // eslint-disable-line no-shadow
            var Transaction = require("dw/system/Transaction");
            var authenticatedCustomer;
            var serverError;

            var form = res.getViewData();

            if (empty(errors)) {
                var login = form.email;
                var password = form.password;

                // attempt to create a new user and log that user in.
                try {
                    Transaction.wrap(function () {
                        var error = {};
                        var newCustomer = CustomerMgr.createCustomer(login, password);

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
        this.on("route:Complete", function (req, res2) {
            var Transaction = require("dw/system/Transaction");
            var viewData = res2.getViewData();
            if (viewData.success && !empty(customer) && customer.authenticated) {
                Transaction.wrap(function () {
                    customer.profile.custom.lastProfileChangeTimestamp = new Date();
                });
            }
        });
    } else {
        res1.json({
            fields: errors
        });
    }

    return next();
});

/**
 * Endpoint was modified to set the corect redirect url on page login complete
 */
server.append("Login",
    server.middleware.https,
    function (req1, res1, next) {
        this.on("route:BeforeComplete", function (req, res) {
            var viewData = res.getViewData();
            var currentBasket = BasketMgr.getCurrentBasket();
            PBHelpers.updatePriceBooks(req);
            if (currentBasket) {
                COHelpers.recalculateBasket(currentBasket);
            }
            if (viewData.success && !empty(session.custom.TargetLocation)) {
                viewData.redirectUrl = session.custom.TargetLocation;
                delete session.custom.TargetLocation;
                res.setViewData(viewData);
            }
        });
        return next();
    }
);

/**
 * Returns ajax content with the error fields
 */
server.post("ValidateFacebookInfo", server.middleware.https, function (req, res, next) {
    var form = req.form;
    var errors = {};

    var cedulaError = validationHelpers.validateDocument(form.document, form.cedula);
    if (cedulaError) {
        errors.cedula = cedulaError;
    }

    res.json({
        fields: errors
    });
    next();
});

server.post("SaveFacebookInfo", function (req, res, next) {
    var form = req.form;
    var Transaction = require("dw/system/Transaction");
    var CustomerMgr = require("dw/customer/CustomerMgr");
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
    if (!form.cedula) {
        errors.cedula = Resource.msg("error.missing", "forms", null);
    } else if (isNaN(form.cedula) || !validationHelpers.validateCE(form.cedula)) {
        errors.cedula = Resource.msg("checkout.login.cedula.error", "checkout", null);
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
            customer.profile.custom.difarmaRunRutNit = form.cedula;
        });
        try {
            accountHelpers.sendCreateAccountEmail(customer.profile);
        } catch (e) {
            Logger.error("It was not possible to send create account email to the user: " + form.email);
        }
        res.json({
            success: true,
            customerProfile: customer.profile
        });
    }
    return next();
});

/**
 * Endpoint was modified to set the correct validate recaptcha without go through the complete flow.
 */
server.replace("Login",
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var CustomerMgr    = require("dw/customer/CustomerMgr");
        var Transaction    = require("dw/system/Transaction");
        var emailHelpers   = require("*/cartridge/scripts/helpers/emailHelpers");
        var hooksHelper    = require("*/cartridge/scripts/helpers/hooks");
        var LoggerUtils    = require("*/cartridge/scripts/utils/LoggerUtils");

        var viewData = {};
        if (Site.getCurrent().getCustomPreferenceValue("recaptchaEnabled") === true) {
            if (!req.form["g-recaptcha-response"]) {
                viewData.success = false;

                if (viewData.error) {
                    viewData.error.push(Resource.msg("error.recaptcha.login.form", "account", null));
                } else {
                    viewData.error = [Resource.msg("error.recaptcha.login.form", "account", null)];
                }
            } else {
                var reCaptchaResults = reCaptcha.sendCaptchaValidation(req.form);

                if (reCaptchaResults.ok !== true) {
                    viewData.success = false;

                    if (viewData.error) {
                        viewData.error.push(Resource.msg("error.recaptcha.login.form", "account", null));
                    } else {
                        viewData.error = [Resource.msg("error.recaptcha.login.form", "account", null)];
                    }
                }
            }
        }
        if (viewData.success == false) {
            res.json(viewData);
            return next();
        }

        var email      = req.form.loginEmail;
        var password   = req.form.loginPassword;
        var rememberMe = req.form.loginRememberMe
            ? (!!req.form.loginRememberMe)
            : false;

        var customerLoginResult = Transaction.wrap(function () {
            var authenticateCustomerResult = CustomerMgr.authenticateCustomer(email, password);

            if (authenticateCustomerResult.status !== "AUTH_OK") {
                var errorCodes = {
                    ERROR_CUSTOMER_DISABLED: "error.message.account.disabled",
                    ERROR_CUSTOMER_LOCKED: "error.message.account.locked",
                    ERROR_CUSTOMER_NOT_FOUND: "error.message.login.form",
                    ERROR_PASSWORD_EXPIRED: "error.message.password.expired",
                    ERROR_PASSWORD_MISMATCH: "error.message.password.mismatch",
                    ERROR_UNKNOWN: "error.message.error.unknown",
                    default: "error.message.login.form"
                };

                var errorMessageKey = errorCodes[authenticateCustomerResult.status] || errorCodes.default;
                var errorMessage = Resource.msg(errorMessageKey, "login", null);

                return {
                    error: true,
                    errorMessage: errorMessage,
                    status: authenticateCustomerResult.status,
                    authenticatedCustomer: null
                };
            }

            return {
                error: false,
                errorMessage: null,
                status: authenticateCustomerResult.status,
                authenticatedCustomer: CustomerMgr.loginCustomer(authenticateCustomerResult, rememberMe)
            };
        });

        if (customerLoginResult.error) {
            if (customerLoginResult.status === "ERROR_CUSTOMER_LOCKED") {
                var context = {
                    customer: CustomerMgr.getCustomerByLogin(email) || null
                };

                var emailObj = {
                    to: email,
                    subject: Resource.msg("subject.account.locked.email", "login", null),
                    from: Site.current.getCustomPreferenceValue("customerServiceEmail") || "no-reply@salesforce.com",
                    type: emailHelpers.emailTypes.accountLocked
                };

                hooksHelper("app.customer.email", "sendEmail", [emailObj, "account/accountLockedEmail", context], function () {});
            }

            res.json({
                error: [customerLoginResult.errorMessage || Resource.msg("error.message.login.form", "login", null)]
            });

            return next();
        }

        if (customerLoginResult.authenticatedCustomer) {
            res.setViewData({ authenticatedCustomer: customerLoginResult.authenticatedCustomer });
            res.json({
                success: true,
                redirectUrl: accountHelpers.getLoginRedirectURL(req.querystring.rurl, req.session.privacyCache, false)
            });

            var customerEmail = customerLoginResult.authenticatedCustomer.profile.email;
            LoggerUtils.sessionInfo("Customer logged in: " + customerEmail);

            Transaction.wrap(function () {
                var profileCustomer    = customerLoginResult.authenticatedCustomer.profile.customer;
                var clubCruzVerdeGroup = Site.current.getCustomPreferenceValue("clubCruzVerdeGroup");
                CustomerMgr.getCustomerGroup(clubCruzVerdeGroup).assignCustomer(profileCustomer);
            });

            req.session.privacyCache.set("args", null);
        } else {
            res.json({ error: [Resource.msg("error.message.login.form", "login", null)] });
        }

        return next();
    }
);

server.append("EditProfile", function (req, res, next) {
    var URLUtils = require("dw/web/URLUtils");
    var viewData = res.getViewData();

    req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

    viewData.breadcrumbs = [
        {
            htmlValue: Resource.msg("global.home", "common", null),
            url: URLUtils.home().toString()
        },
        {
            htmlValue: Resource.msg("label.profile", "account", null),
            url: URLUtils.url("Account-Show").toString()
        },
        {
            htmlValue: Resource.msg("label.profile.title", "account", null),
            url: ""
        }
    ];
    viewData.sidebarCurrent = "mydata";
    res.setViewData(viewData);
    return next();
});

server.append("EditPassword", function (req, res, next) {
    req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));
    var viewData = res.getViewData();
    viewData.sidebarCurrent = "passwordreset";
    res.setViewData(viewData);
    return next();
});

server.replace("PasswordResetDialogForm", server.middleware.https, function (req, res, next) {
    var CustomerMgr = require("dw/customer/CustomerMgr");
    var URLUtils = require("dw/web/URLUtils");
    var emailHelpers = require("*/cartridge/scripts/helpers/emailHelpers");

    var email = req.form.loginEmail;
    var errorMsg;
    var isValid;
    var resettingCustomer;
    var mobile = req.querystring.mobile;
    var receivedMsgHeading = Resource.msg("label.resetpasswordreceived", "login", null);
    var receivedMsgBody = Resource.msg("label.requestedpasswordreset.msg", "login", null);
    var buttonText = Resource.msg("button.text.loginform", "login", null);
    var returnUrl = URLUtils.url("Login-Show").toString();
    if (email) {
        isValid = emailHelpers.validateEmail(email);
        if (isValid) {
            resettingCustomer = CustomerMgr.getCustomerByLogin(email);

            if (!resettingCustomer) {
                var resettingCustomerProfile = CustomerMgr.queryProfile("email = {0}", email);

                if (resettingCustomerProfile) {
                    resettingCustomer = resettingCustomerProfile.customer;
                }
            }

            var isFacebookCustomer = accountHelpers.isFacebookCustomer(resettingCustomer);

            if (resettingCustomer) {
                accountHelpers.sendPasswordResetEmail(email, resettingCustomer);
            }

            if (isFacebookCustomer) {
                receivedMsgHeading = Resource.msg("label.facebook.resetpasswordreceived", "login", null);
                receivedMsgBody    = Resource.msg("label.facebook.requestedpasswordreset.msg", "login", null);
            }

            res.json({
                success: true,
                isFacebookCustomer : isFacebookCustomer,
                receivedMsgHeading: receivedMsgHeading,
                receivedMsgBody: receivedMsgBody,
                buttonText: buttonText,
                mobile: mobile,
                returnUrl: returnUrl
            });
        } else {
            errorMsg = Resource.msg("error.message.passwordreset", "login", null);
            res.json({
                fields: {
                    loginEmail: errorMsg
                }
            });
        }
    } else {
        errorMsg = Resource.msg("error.message.required", "login", null);
        res.json({
            fields: {
                loginEmail: errorMsg
            }
        });
    }
    next();
});

server.get("ValidateID", server.middleware.https, function (req, res, next) {
    var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");

    var docNumber       = req.querystring.docNumber;
    var loyaltyCustomer = LoyaltyUtils.getCustomer(docNumber);

    res.json({
        success           : true,
        isLoyaltyCustomer : !!loyaltyCustomer
    });

    next();
});

server.get("MyPromotions", function (req, res, next) {
    var groupMapping = Site.current.getCustomPreferenceValue("customerGroupsPromotions");
    var promotionsPage = "";
    try {
        groupMapping = groupMapping ? JSON.parse(groupMapping) : {};
    } catch (error) {
        groupMapping = {};
        Logger.error("Error with the custom preference customerGroupsPromotions: {0}", error.message);
    }

    if (Object.keys(groupMapping).length) {
        var customerGroupsItr = req.currentCustomer.raw.customerGroups.iterator();
        while (customerGroupsItr.hasNext()) {
            var customerGroup = customerGroupsItr.next();
            if (Object.prototype.hasOwnProperty.call(groupMapping, customerGroup.ID)) {
                promotionsPage = groupMapping[customerGroup.ID];
                break;
            }
        }
    }

    var URLUtils = require("dw/web/URLUtils");
    if (promotionsPage == "") {
        res.redirect(URLUtils.url("Account-Show"));
    } else {
        res.redirect(URLUtils.url("Page-Show", "cid", promotionsPage));
    }

    next();
});

module.exports = server.exports();
