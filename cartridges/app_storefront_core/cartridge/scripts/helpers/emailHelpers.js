"use strict";

var base = module.superModule;

/**
 * Checks if the email value entered is correct format
 * @param {string} email - email string to check if valid
 * @returns {boolean} Whether email is valid
 */
function validateEmail(email) {
    var regex = /^[\w.%+-]+@[\w.-]+\.[\w]{2,}$/;
    return regex.test(email);
}

module.exports = {
    send          : base.send,
    sendEmail     : base.sendEmail,
    emailTypes    : base.emailTypes,
    validateEmail : validateEmail
};
