"use strict";

var emailHelper = require("*/cartridge/scripts/helpers/emailHelpers");
var CustomerMgr = require("dw/customer/CustomerMgr");
var Resource = require("dw/web/Resource");

// This constant defines the minimum age allowed in birthdate
var MINIMUM_AGE = 15;

/**
 * Returns whether an email address is valid
 * @param {String} emailAddress the email address to be validated
 * @returns {Boolean}
 */
function validateEmail(emailAddress) {
    return !empty(emailAddress) ? emailHelper.validateEmail(emailAddress) : false;
}

/**
 * Returns whether the provided email is already registered
 * @param {String} emailAddress the email address to check its existence
 * @returns {Boolean} returns false if the email is already registered
 */
function validateUniqueEmail(emailAddress) {
    return !empty(emailAddress) && empty(CustomerMgr.getCustomerByLogin(emailAddress));
}

/**
 * Verifies the validity of a RUT number
 * @param {String} rut the RUT identification number
 * @returns {Boolean}
 */
function validateRut(rut) {
    var rutRegex = /\d{1,3}(?:(\.?)\d{3}){2}(-?)[\dkK]/;

    if (empty(rut) || !rutRegex.test(rut)) {
        return false;
    }
    rut = rut.replace(/^0+|[^0-9kK]+/g, "").toUpperCase();
    var t = parseInt(rut.slice(0, -1), 10);
    var m = 0;
    var remainder = 1;

    if (!validateSequentialUp(rut, 5) || !validateSequentialDown(rut, 5)) {
        return false;
    }

    while (t > 0) {
        remainder = (remainder + (t % 10) * (9 - m++ % 6)) % 11;
        t = Math.floor(t / 10);
    }
    var digit = remainder > 0 ? "" + (remainder - 1) : "K";
    return digit === rut.slice(-1);
}

//Validate string, preventing increasing sequential numbers of length provided by parameter (Ex: prevent 12345+ when maxSeq=5)
function validateSequentialUp(str, maxSeq) {
    for (let i = 0; i < str.length; i++) {
        let seq = 1;
        for (let j = 1; j <= maxSeq; j++) {
            if ((str[i+j])) {
                if (Number(str[i])+j == Number(str[i+j])) {
                    seq++;
                    if (maxSeq == seq) {
                        return false;
                    }
                }
                else {
                    break;
                }
            }
        }
    }
    return true;
}

//Validate string, preventing decreasing sequential numbers of length provided by parameter (Ex: prevent +54321 when maxSeq=5)
function validateSequentialDown(str, maxSeq) {
    for (let i = 0; i < str.length; i++) {
        let seq = 1;
        for (let j = 1; j <= maxSeq; j++) {
            if ((str[i+j])) {
                if (Number(str[i])-j == Number(str[i+j])) {
                    seq++;
                    if (maxSeq == seq) {
                        return false;
                    }
                }
                else {
                    break;
                }
            }
        }
    }
    return true;
}

/**
 * Validates fullName
 * @param {String} fullName the fullName to be validated
 * @returns {Boolean}
 */
function validateFullName(fullName) {
    var fullNameRegex = /^[a-zA-ZáÁéÉíÍñÑóÓúÚüÜ]([-']?[a-zA-ZáÁéÉíÍñÑóÓúÚüÜ]+)*( [a-zA-ZáÁéÉíÍñÑóÓúÚüÜ]([-']?[a-zA-ZáÁéÉíÍñÑóÓúÚüÜ]+)*\s*)+$/;
    return !empty(fullName) && fullNameRegex.test(fullName);
}

/**
 * Validates phone numbers
 * @param {String} phoneNumber the phone number to be validated
 * @returns {Boolean}
 */
function validatePhoneNumber(phoneNumber) {
    var phoneRegex = /^([(][+][\d]{1,3}[)]|[+][\d]{1,3})[\s]?[\d]{7,10}$/;
    return !empty(phoneNumber) && phoneRegex.test(phoneNumber);
}

/**
 * Validates colombian phone numbers
 * @param {String} phoneNumber the phone number to be validated
 * @returns {Boolean}
 */
function validateColombianPhoneNumber(phoneNumber) {
    var phoneRegex = /^[\(\+57\)(\d)(\d){7,12}|(\d){3}(-)(\d){4}(-)(\d){3}]{15,}$/; // eslint-disable-line no-useless-escape
    return !empty(phoneNumber) && phoneRegex.test(phoneNumber);
}

/**
 * Validates chilean phone numbers
 * @param {String} phoneNumber the phone number to be validated
 * @returns {Boolean}
 */
function validateChileanPhoneNumber(phoneNumber) {
    var phoneRegex = /^[\(\+56\)(\d)(\d){7,12}|\s(\d){3}(-)(\d){4}(-)(\d){3}]{14,}$/; // eslint-disable-line no-useless-escape
    return !empty(phoneNumber) && phoneRegex.test(phoneNumber);
}

/**
 * Checks if a given birthdate has at least the minimum age
 * @param {Date} birthdate a date instance of the birthdate
 * @param {Number} minimumAge the mininum age to test against
 * @returns {Boolean}
 */
function _hasMinimumAge(birthdate, minimumAge) {
    var birthdate1 = new Date(birthdate);
    birthdate1.setFullYear(birthdate1.getFullYear() + minimumAge);
    return birthdate1 <= (new Date());
}

/**
 * Checks if a given birthdate has at least the minimum age
 * @param {String} birthdate a string of the birthdate
 * @param {Number} minimumAge the mininum age to test against
 * @returns {Boolean}
 */
function hasMinimumAge(birthdate, minimumAge) {
    var [day, month, year] = birthdate.split(/[\s-/]/);
    var birth = new Date(year, (+month - 1), day);
    return _hasMinimumAge(birth, minimumAge);
}

/**
 * Validates a birthdate considering the following restrictions:
 * 1: the string comes in the format YYYY/MM/DD
 * 2: it cannot go further than January of 99 years ago from the current date
 * 3: it cannot be younger than the minimum age
 * @param {String} dateString the date string to be validated
 * @returns {Boolean}
 */
function validateBirthdate(dateString) {
    var [day, month, year] = dateString.split(/[\s-/]/);
    var birth = new Date(year, (+month - 1), day);
    var now = new Date();
    if (!isNaN(birth)) {
        var difference = now.getFullYear() - birth.getFullYear();
        if (difference === 99) {
            return birth.getMonth() !== 0;
        }
        return _hasMinimumAge(birth, MINIMUM_AGE) && difference < 99;
    }
    return false;
}

/**
 * Validates the given password
 * @param {String} password the password string to be validated
 * @returns {Boolean}
 */
function validatePassword(password) {
    return !empty(password) && CustomerMgr.isAcceptablePassword(password);
}
/**
 * Verifies whether a given string has repeated values in sequence like 77777 or AAAAA, for the whole string
 * @param {String} value the value to test against
 * @returns {Boolean}
 */
function hasRepeatedCharacters(value) {
    return (/^([\d\w])\1+$/i).test(value);
}

/**
 * Verifies whether a given string has characters in sequence (at least 4). e.g ABCDE, 987654
 * @param {String} value the value to test against
 * @returns {Boolean}
 */
function hasSequenceOfCharacters(value) {
    var repeatedCharsRegex = /1{3,}|(-1){3,}/i;
    var charCodes = "";
    for (var i = 0; i < value.length - 1; i++) {
        charCodes += (value[i + 1].toLowerCase().charCodeAt(0) - value[i].toLowerCase().charCodeAt(0));
    }
    return repeatedCharsRegex.test(charCodes);
}

/**
 * Validates the given passport number
 * @param {String} passport the passport number to be validated
 * @returns {Boolean}
 */
function validatePassport(passport) {
    var passportRegex = /^[\s\w]{1,50}$/;
    var repeatedLettersRegex = /([\d\w])\1{3,}/i;
    return passportRegex.test(passport) && !repeatedLettersRegex.test(passport) && !hasSequenceOfCharacters(passport);
}

/**
 * Validates a C.E document number
 * @param {Number} number the document number to be validated
 * @returns {Boolean}
 */
function validateCE(number) {
    var ceRegex = /^[\d]{6,10}$/;
    return ceRegex.test(number) && !hasSequenceOfCharacters(number) && !hasRepeatedCharacters(number);
}

/**
 * Validates a C.C document number
 * @param {Number} number the document number to be validated
 * @returns {Boolean}
 */
function validateCC(number) {
    return validateCE(number);
}

/**
 * Validates the a document (C.C, C.E or Passport) based on given document type and number
 * @param {String} documentType the ducument type to be validate (C.C, C.E or Passport)
 * @param {String} identificationNumber the document number to be validated
 * @returns {String} the error message if any, null otherwise
 */
function validateDocument(documentType, identificationNumber) {
    var cc = Resource.msg("label.input.document.type.cc", "forms", null);
    var ce = Resource.msg("label.input.document.type.ce", "forms", null);
    var passport = Resource.msg("label.input.document.type.passport", "forms", null);
    var message = null;
    if (!empty(identificationNumber)) {
        if (documentType === cc && !validateCC(identificationNumber)) {
            message = Resource.msg("error.document.cc", "forms", null);
        } else if (documentType === ce && !validateCE(identificationNumber)) {
            message = Resource.msg("error.document.ce", "forms", null);
        } else if (documentType === passport && !validatePassport(identificationNumber)) {
            message = Resource.msg("error.document.passport", "forms", null);
        }
    }
    return message;
}

/**
 * Checks if document was already registered based on given document type and number
 * @param {String} documentType the ducument type (C.C, C.E or Passport)
 * @param {String} identificationNumber the document number to be checked
 * @returns {String} the error message if document was already registered
 */
function documentAlreadyRegistered(documentType, identificationNumber) {

    var cc = Resource.msg("label.input.document.type.cc", "forms", null);
    var ce = Resource.msg("label.input.document.type.ce", "forms", null);
    var passport = Resource.msg("label.input.document.type.passport", "forms", null);
    var message = null;

    if (!empty(identificationNumber)) {
        var query = null;

        if (documentType === cc) {
            query = "custom.ccDocument={0}";
        } else if (documentType === ce) {
            query = "custom.ceDocument={0}";
        } else if (documentType === passport) {
            query = "custom.passport={0}";
        }

        var profiles = CustomerMgr.searchProfiles(query, null, identificationNumber);

        if (profiles.hasNext()) {
            message = Resource.msg("error.document.registered", "forms", null);
        }
    }
    return message;
}

/**
 * Formats a RUT number to XXXXXXXX-X
 * @param {String} RUTNumber a valid RUT number
 */
function formatRUTNumber(RUTNumber) {
    while (RUTNumber.length < 9) {
        RUTNumber = "0" + RUTNumber;
    }
    if (RUTNumber.indexOf("-") === -1) {
        return (RUTNumber.slice(0, 8) + "-" + RUTNumber[8]).replace(/^[0]+/, "").toUpperCase();
    }
    return RUTNumber.toUpperCase();
}

/**
 * Checks if RUT was already registered
 * @param {String} rut a valid RUT number to be checked
 * @returns {Boolean}
 */
function rutAlreadyRegistered(rut) {
    if (!empty(rut)) {
        var query = "custom.difarmaRunRutNit={0}";
        var profiles = CustomerMgr.searchProfiles(query, null, formatRUTNumber(rut));
        return profiles.hasNext();
    }
    return false;
}

module.exports = {
    validatePhoneNumber: validatePhoneNumber,
    validateRut: validateRut,
    validateEmail: validateEmail,
    validateUniqueEmail: validateUniqueEmail,
    validateColombianPhoneNumber: validateColombianPhoneNumber,
    validateChileanPhoneNumber: validateChileanPhoneNumber,
    validateBirthdate: validateBirthdate,
    validatePassword: validatePassword,
    validateCE: validateCE,
    validateCC: validateCC,
    validatePassport: validatePassport,
    validateDocument: validateDocument,
    documentAlreadyRegistered: documentAlreadyRegistered,
    rutAlreadyRegistered: rutAlreadyRegistered,
    hasMinimumAge: hasMinimumAge,
    validateFullName: validateFullName,
    formatRUTNumber: formatRUTNumber,
    MINIMUM_AGE: MINIMUM_AGE
};
