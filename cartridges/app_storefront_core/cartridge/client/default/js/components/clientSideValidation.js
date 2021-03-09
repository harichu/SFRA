"use strict";

/**
 * Validate whole form. Requires `this` to be set to form object
 * @param {jQuery.event} event - Event to be canceled if form is invalid.
 * @returns {boolean} - Flag to indicate if form is valid
 */
function validateForm(event) {
    var valid = true;
    if (this.checkValidity && !this.checkValidity()) {
        // safari
        valid = false;
        if (event) {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        }
        $(this).find("input, select").each(function () {
            if (!this.validity.valid) {
                $(this).trigger("invalid", this.validity);
            }
        });
    }
    return valid;
}

function validateInput() {
    if (!this.checkValidity()) {
        $(this).trigger("invalid", this.validity);
    } else {
        clearInput(this);
    }
}

/**
 * Remove all validation. Should be called every time before revalidating form
 * @param {element} form - Form to be cleared
 * @returns {void}
 */
function clearForm(form) {
    $(form).find(".form-control.is-invalid").removeClass("is-invalid");
}

/**
 * Remove all validation. Should be called every time before revalidating form
 * @param {element} form - Form to be cleared
 * @returns {void}
 */
function clearInput(input) {
    $(input).removeClass("is-invalid");
}

/**
 * @function
 * @description Validates the birtday field, making sure the user is over 15
 */
function validateBirthday() {
    var oDate = $(this).val().split("/");
    var elDate = new Date(`${oDate[1]}/${oDate[0]}/${oDate[2]}`);
    var today = new Date();
    var mili_dif = Math.abs(today.getTime() - elDate.getTime());
    var age = (mili_dif / (1000 * 3600 * 24 * 365.25));
    var errorType;

    if ($(this).hasClass("required") && !$(this).val()) {
        errorType = "dateMissing";
    } else {
        if (age) {
            if (age < 15.0) {
                errorType = "ageInvalid";
            }

            if (age > 99.0) {
                errorType = "dateInvalid";
            }
        } else {
            errorType = "dateInvalid";
        }
    }

    if (errorType == "ageInvalid") {
        $(this).addClass("is-invalid").parents(".form-group").find(".invalid-feedback").text($(this).data("minimum-error"));
    } else if (errorType == "dateInvalid") {
        $(this).addClass("is-invalid").parents(".form-group").find(".invalid-feedback").text($(this).data("pattern-mismatch"));
    } else if (errorType == "dateMissing") {
        $(this).addClass("is-invalid").parents(".form-group").find(".invalid-feedback").text($(this).data("missing-error"));
    } else {
        clearInput($(this));
    }
}

/**
 * Verifies the validity of a RUT number
 * @param {String} rut the RUT identification number
 * @returns {Boolean}
 */
function validateDocument(docValue, docType) {
    var repeatRegex = /(\d)\1\1\1\1/;

    if (docType == "rut") {
        var rutRegex = /\d{1,3}(?:(\.?)\d{3}){2}(-?)[\dkK]/;

        if (!rutRegex.test(docValue)) {
            return false;
        }
        docValue = docValue.replace(/^0+|[^0-9kK]+/g, "").toUpperCase();
        var t = parseInt(docValue.slice(0, -1), 10);
        var m = 0;
        var remainder = 1;

        if (!validateSequentialUp(docValue, 5) || !validateSequentialDown(docValue, 5)) {
            return false;
        }

        while (t > 0) {
            remainder = (remainder + (t % 10) * (9 - m++ % 6)) % 11;
            t = Math.floor(t / 10);
        }
        var digit = remainder > 0 ? "" + (remainder - 1) : "K";
        return digit === docValue.slice(-1);

    } else if (docType == "cedula") {
        var cedulaRegex = /^[0-9]*$/;

        if (!cedulaRegex.test(docValue)) {
            return false;
        }

        if (repeatRegex.test(docValue) || !validateSequentialUp(docValue, 5) || !validateSequentialDown(docValue, 5)) {
            return false;
        }

        return true;

    } else if (docType == "pasaporte") {
        repeatRegex = /(\d|\w)\1\1\1\1/;

        if (repeatRegex.test(docValue) || !validateSequentialUp(docValue, 5) || !validateSequentialDown(docValue, 5) || !validateSequentialLetters(docValue)) {
            return false;
        }

        return true;
    }
}

/**
 * Validate string, preventing increasing sequential numbers of length provided by parameter (Ex: prevent 12345+ when maxSeq=5)
 */
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

/**
 * Validate string, preventing decreasing sequential numbers of length provided by parameter (Ex: prevent +54321 when maxSeq=5)
 */
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
 * Validate string, preventing sequential letters of 4
 */
function validateSequentialLetters(str) {
    if (str) {
        var test = (x) => !isNaN(x);
        // eslint-disable-next-line
        var check = (x, y, i) => x + i === y; // NOSONAR

        for (var i = 0; i < str.length - 3; i++) {
            if (!test(str[i + 1]) && !test(str[i + 2]) && !test(str[i + 3]) && !test(str[i + 4])) {
                if (check(str.charCodeAt(i), str.charCodeAt(i + 1), 1) &&
                    check(str.charCodeAt(i), str.charCodeAt(i + 2), 2) &&
                    check(str.charCodeAt(i), str.charCodeAt(i + 3), 3) &&
                    check(str.charCodeAt(i), str.charCodeAt(i + 4), 4)) {
                    return false;
                }
            }
        }
    }

    return true;
}


/**
 * Invalidates field - adds invalid classes and displayes error message
 */
function invalidateField($element) {
    $element.parents(".form-group").find(".invalid-feedback").text($element.data("pattern-mismatch"));
    $element.addClass("is-invalid");
}

module.exports = {
    invalid: function () {
        $("form input, form select").on("invalid", function (e) {
            e.preventDefault();
            this.setCustomValidity("");
            if (!this.validity.valid) {
                var validationMessage = this.validationMessage;
                $(this).addClass("is-invalid");
                if (this.validity.patternMismatch && $(this).data("pattern-mismatch")) {
                    validationMessage = $(this).data("pattern-mismatch");
                }
                if ((this.validity.rangeOverflow || this.validity.rangeUnderflow)
                    && $(this).data("range-error")) {
                    validationMessage = $(this).data("range-error");
                }
                if ((this.validity.tooLong || this.validity.tooShort)
                    && $(this).data("range-error")) {
                    validationMessage = $(this).data("range-error");
                }
                if (this.validity.valueMissing && $(this).data("missing-error")) {
                    validationMessage = $(this).data("missing-error");
                }
                $(this).parents(".form-group").find(".invalid-feedback")
                    .text(validationMessage);
            }
        });
    },

    focusout: function () {
        $(document).on("blur", "form input:not(.custom-validation), form select:not(.custom-validation)", function () {
            return validateInput.call(this);
        });
    },

    dateValidation: function () {
        $(document).on("change blur", "#datefield", function () {
            return validateBirthday.call(this);
        });
    },

    submit: function () {
        $("form").on("submit", function (e) {
            return validateForm.call(this, e);
        });
    },

    buttonClick: function () {
        $("form button[type=\"submit\"], form input[type=\"submit\"]").on("click", function () {
            // clear all errors when trying to submit the form
            clearForm($(this).parents("form"));

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push($(this).data("gtm"));
        });
    },

    validateInput: function () {
        $(document).on("validateInput", "form input:not(.custom-validation), form select:not(.custom-validation)", function () {
            return validateInput.call(this);
        });
    },

    initializeDocValidation: function () {
        // Initializing custom  RUT validation for Chile
        $(document).on("focusout", ".js-document-validation", function () {
            var $this = $(this);
            var docValue = $this.val();

            if (docValue.length && !validateDocument(docValue, $this.data("type"))) {
                invalidateField($this);
            }
        });
    },

    watchIdentificationNumber: function () {
        $("#registration-document").on("change", function () {
            var numberField = $(".js-document-validation");
            var patternError = "";

            // Redefine the error variable when document oprions is changed
            if ($(this).val() === "Pasaporte") {
                patternError = numberField.data("passport-error");
                numberField.data("type", "pasaporte");
            } else if ($(this).val() === "C.E") {
                patternError = numberField.data("ce-error");
            } else {
                patternError = numberField.data("cc-error");
            }

            numberField.data("pattern-mismatch", patternError);

            if ($(this).val() === "Pasaporte") {
                numberField.attr("maxlength", 50).attr("pattern", ".{6,50}");
            } else {
                numberField.attr("maxlength", 10).attr("pattern", ".{6,10}");
            }
        });
    },

    functions: {
        validateForm: function (form, event) {
            validateForm.call($(form), event || null);
        },
        clearForm: clearForm,
        validateDocument: function (docValue, docType) {
            if (validateDocument(docValue, docType)) {
                return true;
            }
        },
        invalidateField: function ($element) {
            invalidateField($element);
        }
    }
};
