"use strict";

var validation = require("*/cartridge/scripts/helpers/validationHelpers");
var Resource = require("dw/web/Resource");
var CustomerMgr = require("dw/customer/CustomerMgr");


/**
 * Validates the required fields that the user typed something
 * @param {Object} form an object with the forms values
 * @returns {Object} an object with attributes named as the fields with errors
 */
function validateFilledFields(form) {
    var errors = {};
    var isRutValid = validation.validateRut(form.rut);
    if (!isRutValid) {
        errors.rut = Resource.msg("error.rut.invalid", "forms", null);
    }
    if (!empty(form.fullName) && empty(form.fullName.trim())) {
        errors.fullName = Resource.msg("error.missing.name", "forms", null);
    }
    if (!empty(form.phone) && !validation.validateChileanPhoneNumber(form.phone)) {
        errors.phone = Resource.msg("error.parse.phone", "forms", null);
    }
    if (!empty(form.email) && !validation.validateEmail(form.email)) {
        errors.email = Resource.msg("error.parse.email", "forms", null);
    }
    if (!empty(form.password) && !validation.validatePassword(form.password)) {
        errors.password = Resource.msg("error.password", "forms", null);
    }
    if (!empty(form.password) && form.password !== form.passwordConfirm) {
        errors.passwordConfirm = Resource.msg("error.password-mismatch", "forms", null);
    }
    if (!CustomerMgr.isAcceptablePassword(form.password)) {
        errors.password = Resource.msg("error.password", "forms", null);

        var constraintsPassword = CustomerMgr.getPasswordConstraints();

        if (form.password.length < 8) {
            errors.password = Resource.msg("error.short.password", "forms", null);
        }
        // eslint-disable-next-line
        if (constraintsPassword.minSpecialChars && !(/[!@#$%*()_+\-\=\[\]{}|~,.\/?]/.test(form.password))) {
            errors.password = Resource.msg("error.special.characters", "forms", null);
        }
        if (constraintsPassword.forceMixedCase && !(/[A-Z]/.test(form.password))) {
            errors.password = Resource.msg("error.uppercase", "forms", null);
        }
        if (constraintsPassword.forceMixedCase && !(/[a-z]/.test(form.password))) {
            errors.password = Resource.msg("error.lowercase", "forms", null);
        }
        if (constraintsPassword.forceNumbers && !(/\d/.test(form.password))) {
            errors.password = Resource.msg("error.numbers", "forms", null);
        }
        if (/\s/g.test(form.password)) {
            errors.password = Resource.msg("error.spaces", "forms", null);
        }
    }
    if (!empty(form.birth) && !validation.hasMinimumAge(form.birth, validation.MINIMUM_AGE)) {
        errors.birth = Resource.msg("error.birth.minimum.age", "forms", null);
    } else if (!empty(form.birth) && !validation.validateBirthdate(form.birth)) {
        errors.birth = Resource.msg("error.birth", "forms", null);
    }
    return errors;
}

/**
 * Validates all fields for the registration form
 * @param {Object} form an object with the forms values
 * @returns {Object} an object with attributes named as the fields with errors
 */
function validate(form) {
    var fields = ["rut", "fullName", "phone", "gender", "birth", "email", "password", "passwordConfirm", "termsAndConditions"];
    var errors = validateFilledFields(form);
    fields.forEach(function (field) {
        if (empty(errors[field]) && empty(form[field])) {
            errors[field] = Resource.msg("error.missing", "forms", null);
        }
    });
    if (Object.keys(errors).length > 0) {
        return errors;
    }
    return null;
}

module.exports = {
    validate: validate,
    validateFilledFields: validateFilledFields
};
