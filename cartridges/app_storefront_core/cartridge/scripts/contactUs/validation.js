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
    if (!empty(form.contactRut) && !validation.validateRut(form.contactRut)) {
        errors.contactRut = Resource.msg("error.message.parse.rut", "contactUs", null);
    }
    if (!empty(form.contactPhone) && !validation.validateChileanPhoneNumber(form.contactPhone)) {
        errors.contactPhone = Resource.msg("error.message.parse.phone", "contactUs", null);
    }
    return errors;
}
/**
 * Validates all required fields
 * @param {Object} form an object with the forms values
 */
function validate(form) {
    var requiredFields = ["contactFirstName", "contactLastName", "contactEmail", "contactRut", "contactPhone", "termsAndConditions"];
    var errors = validateFilledFields(form);
    requiredFields.forEach(function (fields) {
        if (empty(form[fields]) && empty(errors[fields])) {
            errors[fields] = Resource.msg("error.message.required", "contactUs", null);
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
