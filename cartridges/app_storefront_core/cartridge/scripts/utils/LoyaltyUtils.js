"use strict";

var Transaction = require("dw/system/Transaction");
var Site = require("dw/system/Site");
var LoyaltyService = require("*/cartridge/scripts/services/LoyaltyService");
var LoyaltyServiceHelpers = require("*/cartridge/scripts/helpers/loyaltyServiceHelpers");

var currentSite = Site.current;
var isLoyaltyServiceEnabled = currentSite.preferences.custom.enableLoyaltyService;
var SERVICE_NAME = currentSite.preferences.custom.loyaltyServiceName;

/**
 * Updates SFCC Loyalty data;
 * 
 * @param {Object} loyaltyServiceResponse 
 */
function updateSfccLoyaltyData(loyaltyServiceResponse) {
    if (loyaltyServiceResponse &&
        loyaltyServiceResponse.Program &&
        loyaltyServiceResponse.Program.length > 0
    ) {
        Transaction.wrap(function () {
            customer.profile.custom.difarmaLoyaltyRegistered = true;
            customer.profile.custom.difarmaLoyaltyProgram = loyaltyServiceResponse.Program[0].programAffiliation;
            customer.profile.custom.difarmaLoyaltyTotalSaved = loyaltyServiceResponse.Program[0].totalSaved;
            customer.profile.custom.difarmaLoyaltyInstitute = loyaltyServiceResponse.Program[0].healthInstitution;
            customer.profile.custom.difarmaLoyaltyClubLevel = loyaltyServiceResponse.Program[0].clubLevel;
        });
    }
}

/**
 * Creates Loyalty customer;
 * @param {dw.customer.Customer} apiCustomer 
 * @return customer
 */
function createCustomer(apiCustomer) {
    if (isLoyaltyServiceEnabled) {
        var Logger = require("dw/system/Logger");

        try {
            var docData = LoyaltyServiceHelpers.getDocumentData(apiCustomer);
            var docNumber = docData.docNumber;
            var customerData = LoyaltyServiceHelpers.getFormattedCustomerDataForService(apiCustomer);

            var isCustomerCreated = LoyaltyService.createCustomer(docNumber, customerData);

            if (isCustomerCreated) {
                var loyaltyCustomer = LoyaltyService.getCustomer(docNumber);
                updateSfccLoyaltyData(loyaltyCustomer);
                return loyaltyCustomer;
            }
        } catch (err) {
            Logger.error("Could not create Loyalty customer: " + err);
        }
    }

    return null;
}

/**
 * Gets or creates loyalty customer;
 * @param {dw.customer.Customer} apiCustomer
 */
function getOrCreateCustomer(apiCustomer) {
    if (isLoyaltyServiceEnabled && apiCustomer && apiCustomer.profile) {
        var docData = LoyaltyServiceHelpers.getDocumentData(apiCustomer);

        if (docData.docNumber) {
            var loyaltyCustomer = LoyaltyService.getCustomer(docData.docNumber);

            if (!loyaltyCustomer) {
                createCustomer(apiCustomer);
                loyaltyCustomer = LoyaltyService.getCustomer(docData.docNumber);
            }

            return loyaltyCustomer;
        } else {
            var LoggerUtils = require("*/cartridge/scripts/utils/LoggerUtils");
            LoggerUtils.serviceInfo("'" + SERVICE_NAME + "' service: Customer '" + apiCustomer.profile.email + "' has no document.");
        }
    }

    return null;
}

/**
 * Gets or creates loyalty customer;
 * @param {String} docNumber
 */
function getCustomer(docNumber) {
    return LoyaltyService.getCustomer(docNumber);
}

/**
 * Checks whether current customer is a Club Cruz Verde member;
 * @return {Boolean}
 */
function isClubMember() {
    var Logger = require("dw/system/Logger");
    Logger.info("Customer information - Profile: " + customer.getProfile());
    Logger.info("Customer information - ID: " + customer.getID());
    var clubCruzVerdeGroup = currentSite.getCustomPreferenceValue("clubCruzVerdeGroup");
    return (customer.isAuthenticated() && customer.isMemberOfCustomerGroup(clubCruzVerdeGroup)) || session.custom.isGuestLoyaltyCustomer;
}

/**
 * Sets whether customer is guest loyalty member on session;
 * @param {Boolean} isLoyaltyMember 
 */
function setGuestLoyaltyMember(isLoyaltyMember) {
    session.custom.isGuestLoyaltyCustomer = isLoyaltyMember;
}

/**
 * Checks and sets whether customer is guest loyalty member on session;
 * @param {String} docNumber 
 */
function checkAndSetGuestLoyaltyMember(docNumber) {
    if (isLoyaltyServiceEnabled) {
        var loyaltyCustomer = LoyaltyService.getCustomer(docNumber);
        setGuestLoyaltyMember(!!loyaltyCustomer);
    } else {
        setGuestLoyaltyMember(false);
    }
}

/**
 * Checks is customer is a top loyalty customer;
 * @param {dw.customer.Customer} apiCustomer 
 */
function isTopLoyaltyCustomer(apiCustomer) {
    var serviceClubLevel = apiCustomer.profile.custom.difarmaLoyaltyClubLevel || "";
    var clubLevel = serviceClubLevel.toLowerCase();
    var topLoyaltyLevel = currentSite.getCustomPreferenceValue("highestLoyaltyLevel").toLowerCase();

    return clubLevel === topLoyaltyLevel;
}

function setSpecificCustomerGroup(isValidDocument) {
    session.custom.validCustomerGroupDocument = isValidDocument;
}

/**
 * Check if the document is part of the document list to apply the customer group
 * @param {String} document
 */
function checkAndSetSpecificCustomerGroup(document) {
    if (currentSite.getCustomPreferenceValue("CustomerGroupDocumentCheck")) {
        var validDocuments = currentSite.getCustomPreferenceValue("CustomerGroupDocumentsList");

        if (!empty(validDocuments)) {
            for (var index in validDocuments) {
                if (validDocuments[index] === document) {
                    setSpecificCustomerGroup(true);
                    return;
                }
            }
        }
    }

    setSpecificCustomerGroup(false);
}

module.exports = {
    createCustomer: createCustomer,
    getCustomer: getCustomer,
    getOrCreateCustomer: getOrCreateCustomer,
    updateSfccLoyaltyData: updateSfccLoyaltyData,
    isClubMember: isClubMember,
    setGuestLoyaltyMember: setGuestLoyaltyMember,
    checkAndSetGuestLoyaltyMember: checkAndSetGuestLoyaltyMember,
    isTopLoyaltyCustomer: isTopLoyaltyCustomer,
    setSpecificCustomerGroup: setSpecificCustomerGroup,
    checkAndSetSpecificCustomerGroup: checkAndSetSpecificCustomerGroup
};
