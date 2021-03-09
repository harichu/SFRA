"use strict";

var Site = require("dw/system/Site");
var ServiceRegistry = require("*/cartridge/scripts/helpers/servicesHelpers");

/**
 * Function responsible for validating the User ReCaptcha input
 * @param {Object} data - the form that was submitted by the user
 * @returns {Object} - the result of the API call
 */

function sendCaptchaValidation(data) {
    var result;

    var params = {
        secret: Site.getCurrent().getCustomPreferenceValue("recaptchaSiteSecret"),
        response: data["g-recaptcha-response"]
    };

    var service = ServiceRegistry.Get("reCAPTCHA", {
        createRequest: function (svc, params) {
            svc.setRequestMethod("GET");
            for (var name in params) {
                svc.addParam(name, params[name]);
            }
        },
        parseResponse: function (svc, output) {
            return output;
        }
    });

    result = service.call(params);

    return result;
}

module.exports = {
    sendCaptchaValidation: sendCaptchaValidation
};
