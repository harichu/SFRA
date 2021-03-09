"use strict";

var URLUtils = require("dw/web/URLUtils");
var base = module.superModule;

/**
 * Send an email that would notify the user that account was created
 * @param {obj} registeredUser - object that contains user's email address and name information.
 */
function sendCreateAccountEmail(registeredUser) {
    var emailHelpers = require("*/cartridge/scripts/helpers/emailHelpers");
    var Resource = require("dw/web/Resource");
    var Site = require("dw/system/Site");
    var MarketingCloudUtils = require("*/cartridge/scripts/utils/MarketingCloudUtils");
    var isMarketingCloudEnabled = MarketingCloudUtils.getMarketingCloudEnabled();

    var userObject = {
        email: registeredUser.email,
        firstName: registeredUser.firstName,
        lastName: registeredUser.lastName,
        url: URLUtils.https("Login-Show"),
        login: registeredUser.credentials.login,
        isExternallyAuthenticated: registeredUser.customer.externallyAuthenticated,
    };

    var emailObj = {
        to: registeredUser.email,
        subject: Resource.msg("email.subject.new.registration", "registration", null),
        type: emailHelpers.emailTypes.registration
    };

    if (!isMarketingCloudEnabled) {
        emailObj.from = Site.current.getCustomPreferenceValue("customerServiceEmail") || "no-reply@salesforce.com";
    }

    emailHelpers.sendEmail(emailObj, "checkout/confirmation/accountRegisteredEmail", userObject);
}

/**
 * @param {dw.customer.Profile | dw.order.Order} apiObj 
 * @param {String} docType 
 * @param {Number} docNumber 
 */
function setProfileDocumentsData(apiObj, docType, docNumber) {
    if (apiObj) {
        var Resource = require("dw/web/Resource");

        var ccDocType       = Resource.msg("label.input.document.type.cc", "forms", null);
        var ceDocType       = Resource.msg("label.input.document.type.ce", "forms", null);
        var passportDocType = Resource.msg("label.input.document.type.passport", "forms", null);
        var rutDocType      = Resource.msg("label.input.document.type.rut", "forms", null);

        if (docType === ccDocType) {
            apiObj.custom.ccDocument = docNumber;
        } else if (docType === ceDocType) {
            apiObj.custom.ceDocument = docNumber;
        } else if (docType === passportDocType) {
            apiObj.custom.passport = docNumber;
        } else if (docType === rutDocType) {
            apiObj.custom.difarmaRunRutNit = docNumber;
        }
    }
}

function isFacebookCustomer(customer) {
    var AUTHENTICATION_PROVIDER_LIST = ["Facebook", "FacebookMaicao"];

    if (customer && customer.externallyAuthenticated) {
        for (var i = 0; i < customer.externalProfiles.length; i++) {
            var provider = customer.externalProfiles[i];
            
            if (AUTHENTICATION_PROVIDER_LIST.indexOf(provider.authenticationProviderID) >= 0) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Gets a document number depending on custom attribute filled.
 * @param {dw.customer.Profile} customerProfile 
 */
function getCustomerDocument(customerProfile) {
    if (!empty(customerProfile)) {
        if (customerProfile.custom.ccDocument) {
            return customerProfile.custom.ccDocument + "-1";
        } else if (customerProfile.custom.ceDocument) {
            return customerProfile.custom.ceDocument + "-2";
        } else if (customerProfile.custom.passport) {
            return customerProfile.custom.passport + "-3";
        } else if (customerProfile.custom.difarmaRunRutNit) {
            return customerProfile.custom.difarmaRunRutNit;
        }
    }
}

function getLoginRedirectURL(redirectUrl, privacyCache, newlyRegisteredUser) {
    var url = session.custom.redirectToPageAfterLoginOrRegister ||
        base.getLoginRedirectURL(redirectUrl, privacyCache, newlyRegisteredUser);

    session.custom.redirectToPageAfterLoginOrRegister = null;

    return url;
}

module.exports = {
    getLoginRedirectURL     : getLoginRedirectURL,
    sendCreateAccountEmail  : sendCreateAccountEmail,
    isFacebookCustomer      : isFacebookCustomer,
    sendPasswordResetEmail  : base.sendPasswordResetEmail,
    sendAccountEditedEmail  : base.sendAccountEditedEmail,
    setProfileDocumentsData : setProfileDocumentsData,
    getCustomerDocument     : getCustomerDocument
};
