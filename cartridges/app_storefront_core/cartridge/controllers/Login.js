"use strict";

var server = require("server");

var consentTracking = require("*/cartridge/scripts/middleware/consentTracking");
var accountHelpers = require("*/cartridge/scripts/helpers/accountHelpers");

server.extend(module.superModule);

server.append("Show", function (req, res, next) {
    var Site = require("dw/system/Site");

    req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

    next();
});

server.replace("OAuthLogin", server.middleware.https, consentTracking.consent, function (req, res, next) {
    var oauthLoginFlowMgr = require("dw/customer/oauth/OAuthLoginFlowMgr");
    var Resource = require("dw/web/Resource");
    var endpoints = require("*/cartridge/config/oAuthRenentryRedirectEndpoints");

    var targetEndPoint = req.querystring.oauthLoginTargetEndPoint
        ? parseInt(req.querystring.oauthLoginTargetEndPoint, 10)
        : null;

    if (targetEndPoint && endpoints[targetEndPoint]) {
        req.session.privacyCache.set(
            "oauthLoginTargetEndPoint",
            endpoints[targetEndPoint]
        );
    } else {
        res.render("/error", {
            message: Resource.msg("error.oauth.login.failure", "login", null)
        });

        return next();
    }

    if (req.querystring.oauthProvider) {
        var oauthProvider = req.querystring.oauthProvider;
        var result = oauthLoginFlowMgr.initiateOAuthLogin(oauthProvider);

        if (result) {
            res.redirect(result.location);
        } else {
            res.render("/error", {
                message: Resource.msg("error.oauth.login.failure", "login", null)
            });

            return next();
        }
    } else {
        res.render("/error", {
            message: Resource.msg("error.oauth.login.failure", "login", null)
        });

        return next();
    }

    return next();
});

server.replace("OAuthReentry", server.middleware.https, consentTracking.consent, function (req, res, next) {
    var URLUtils = require("dw/web/URLUtils");
    var oauthLoginFlowMgr = require("dw/customer/oauth/OAuthLoginFlowMgr");
    var CustomerMgr = require("dw/customer/CustomerMgr");
    var Transaction = require("dw/system/Transaction");
    var Resource = require("dw/web/Resource");
    var validationHelpers = require("*/cartridge/scripts/helpers/validationHelpers");
    var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");

    var destination = req.session.privacyCache.store.oauthLoginTargetEndPoint;

    var finalizeOAuthLoginResult = oauthLoginFlowMgr.finalizeOAuthLogin();
    if (!finalizeOAuthLoginResult) {
        res.redirect(URLUtils.url("Login-Show"));
        return next();
    }

    if (finalizeOAuthLoginResult.userInfoResponse == null) {
        var loginDestination = destination.indexOf("Checkout") != -1 ? "Checkout-Login" : "Login-Show";
        res.redirect(URLUtils.url(loginDestination));
        return next();
    }
    var response = finalizeOAuthLoginResult.userInfoResponse.userInfo;
    var oauthProviderID = finalizeOAuthLoginResult.accessTokenResponse.oauthProviderId;

    if (!oauthProviderID) {
        res.render("/error", {
            message: Resource.msg("error.oauth.login.failure", "login", null)
        });

        return next();
    }

    if (!response) {
        res.render("/error", {
            message: Resource.msg("error.oauth.login.failure", "login", null)
        });

        return next();
    }

    var externalProfile = JSON.parse(response);
    if (!externalProfile) {
        res.render("/error", {
            message: Resource.msg("error.oauth.login.failure", "login", null)
        });

        return next();
    }

    var userID = externalProfile.id || externalProfile.uid;
    if (!userID) {
        res.render("/error", {
            message: Resource.msg("error.oauth.login.failure", "login", null)
        });

        return next();
    }

    var authenticatedCustomerProfile = CustomerMgr.getExternallyAuthenticatedCustomerProfile(
        oauthProviderID,
        userID
    );
    var isCreated = true;
    if (!authenticatedCustomerProfile) {
        isCreated = false;
        // Create new profile
        Transaction.wrap(function () {
            var newCustomer = CustomerMgr.createExternallyAuthenticatedCustomer(
                oauthProviderID,
                userID
            );

            authenticatedCustomerProfile = newCustomer.getProfile();
            var firstName;
            var lastName;
            var email;

            // Google comes with a 'name' property that holds first and last name.
            if (typeof externalProfile.name === "object") {
                firstName = externalProfile.name.givenName;
                lastName = externalProfile.name.familyName;
            } else {
                // The other providers use one of these, GitHub has just a 'name'.
                firstName = externalProfile["first-name"]
                    || externalProfile.first_name
                    || externalProfile.name;

                lastName = externalProfile["last-name"]
                    || externalProfile.last_name
                    || externalProfile.name;
            }

            email = externalProfile["email-address"] || externalProfile.email;

            if (!email) {
                var emails = externalProfile.emails;

                if (emails && emails.length) {
                    email = externalProfile.emails[0].value;
                }
            }

            authenticatedCustomerProfile.setFirstName(firstName);
            authenticatedCustomerProfile.setLastName(lastName);
            authenticatedCustomerProfile.setEmail(email);
        });
    }

    var credentials = authenticatedCustomerProfile.getCredentials();
    if (credentials.isEnabled()) {
        Transaction.wrap(function () {
            var Site = require("dw/system/Site");

            var clubCruzVerdeGroup = Site.current.getCustomPreferenceValue("clubCruzVerdeGroup");
            CustomerMgr.getCustomerGroup(clubCruzVerdeGroup).assignCustomer(authenticatedCustomerProfile.customer);
            CustomerMgr.loginExternallyAuthenticatedCustomer(oauthProviderID, userID, false);
        });
    } else {
        res.render("/error", {
            message: Resource.msg("error.oauth.login.failure", "login", null)
        });

        return next();
    }

    var profileForm = server.forms.getForm("profile");
    profileForm.customer.firstname.value = authenticatedCustomerProfile.firstName;
    profileForm.customer.lastname.value = authenticatedCustomerProfile.lastName;
    profileForm.customer.email.value = authenticatedCustomerProfile.email;

    req.session.privacyCache.clear();
    res.redirect(URLUtils.url(destination, "isCreated", isCreated));

    //This will treat to do not send a email where there is a fb modal.
    if (destination != "Checkout-Begin" || validationHelpers.validateEmail(authenticatedCustomerProfile.email)) {
        accountHelpers.sendCreateAccountEmail(authenticatedCustomerProfile);
    }

    var apiCustomer     = authenticatedCustomerProfile.customer;
    var loyaltyCustomer = LoyaltyUtils.getOrCreateCustomer(apiCustomer);
    LoyaltyUtils.updateSfccLoyaltyData(loyaltyCustomer);

    return next();
});

server.replace("Logout", function (req, res, next) {
    var URLUtils    = require("dw/web/URLUtils");
    var CustomerMgr = require("dw/customer/CustomerMgr");
    var LoggerUtils = require("*/cartridge/scripts/utils/LoggerUtils");
    
    LoggerUtils.sessionInfo("Customer logged out: " + customer.profile.email);

    CustomerMgr.logoutCustomer(false);
    res.redirect(URLUtils.url("Home-Show"));

    next();
});

module.exports = server.exports();
