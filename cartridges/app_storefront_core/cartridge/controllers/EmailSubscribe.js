"use strict";

var Resource        = require("dw/web/Resource");
var NewsletterUtils = require("*/cartridge/scripts/util/NewsletterUtils");
var emailHelpers    = require("*/cartridge/scripts/helpers/emailHelpers");
var server          = require("server");

var base = module.superModule;

server.extend(base);

server.get("Form", function (req, res, next) {
    var Site              = require("dw/system/Site");
    var newsletterOptions = Site.current.getCustomPreferenceValue("NewsletterOptions");
    
    res.render("components/footer/newsletter", {
        newsletterOptions : newsletterOptions
    });

    next();
});

server.post("SaveNewsletterOptions", function (req, res, next) {
    var email   = req.form.email;
    var options = req.form.options;

    if (email && emailHelpers.validateEmail(email)) {
        if (NewsletterUtils.saveNewsletterOptions(email, options)) {
            res.json({
                success : true
            });
        } else {
            res.json({
                success : false,
                msg     : Resource.msg("newsletter.error.alreadytaken", "registration", null)
            });
        }
    } else {
        res.json({
            success : false,
            msg     : Resource.msg("newsletter.error.invalidemail", "registration", null)
        });
    }

    next();
});

server.replace("Subscribe", function (req, res, next) {
    var hooksHelper = require("*/cartridge/scripts/helpers/hooks");

    var email = req.form.emailId;
    var isValidEmailid;
    if (email) {
        isValidEmailid = emailHelpers.validateEmail(email);

        if (isValidEmailid) {
            hooksHelper("app.mailingList.subscribe", "subscribe", [email], function () {});
            res.json({
                success: true,
                msg: Resource.msg("subscribe.email.success", "homePage", null)
            });
        } else {
            res.json({
                error: true,
                msg: Resource.msg("subscribe.email.invalid", "homePage", null)
            });
        }
    } else {
        res.json({
            error: true,
            msg: Resource.msg("subscribe.email.invalid", "homePage", null)
        });
    }

    next();
});

module.exports = server.exports();
