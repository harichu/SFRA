"use strict";

var validation = require("*/cartridge/scripts/helpers/validationHelpers");
var Resource = require("dw/web/Resource");

/**
 * Validates the required fields that the user typed something
 * @param {Object} form an object with the forms values
 */
function validateFilledFields(form) {
    var errors = {};
    var documentErrorMessage = validation.validateDocument(form.contactDocument, form.contactIdentificationNumber);
    if (!empty(documentErrorMessage)) {
        errors.contactIdentificationNumber = documentErrorMessage;
    }
    if (!empty(form.contactEmail) && !validation.validateEmail(form.contactEmail)) {
        errors.contactEmail = Resource.msg("error.message.parse.email", "contactUs", null);
    }
    if (!empty(form.contactPhone) && !validation.validateColombianPhoneNumber(form.contactPhone)) {
        errors.contactPhone = Resource.msg("error.message.parse.phone", "contactUs", null);
    }
    return errors;
}

/**
 * Overriding function to use the proper required fields for Colombia
 * Validates all required fields
 * @param {Object} form an object with the forms values
 */
function validate(form) {
    var requiredFields = ["contactFirstName", "contactLastName", "contactEmail", "contactPhone", "termsAndConditions"];
    var errors = validateFilledFields(form);
    requiredFields.forEach(function (field) {
        if (empty(form[field]) && empty(errors[field])) {
            errors[field] = Resource.msg("error.message.required", "contactUs", null);
        }
    });
    if (!empty(errors.termsAndConditions)) {
        errors.termsAndConditions = Resource.msg("error.message.terms.notaccepted", "contactUs", null);        
    }
    return Object.keys(errors).length > 0 ? errors : null;
}

module.exports = {
    validate: validate,
    validateFilledFields: validateFilledFields
};
