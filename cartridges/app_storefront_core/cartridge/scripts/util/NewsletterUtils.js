"use strict";

/**
 * @module NewsletterUtils
 *
 * Newsletter Utils
 * 
 */

var CustomObjectMgr = require("dw/object/CustomObjectMgr");
var Transaction     = require("dw/system/Transaction");

var CUSTOM_OBJ_NAME = "NewsletterSubscription";

/**
 * Saves customer newsletter options;
 *
 * @param {String} email   customer e-mail
 * @param {String} options newsletter options
 * @return {Boolean} true if an email was successfully registered; Otherwise false.
 */
module.exports.saveNewsletterOptions = function (email, options) {
    var isNewEmail = false;
    Transaction.wrap(function () {
        var subscription = CustomObjectMgr.getCustomObject(CUSTOM_OBJ_NAME, email);
        if (!subscription) {
            subscription = CustomObjectMgr.createCustomObject(CUSTOM_OBJ_NAME, email);
            subscription.custom.options = options;
            isNewEmail = true;
        }
    });
    return isNewEmail;
};
