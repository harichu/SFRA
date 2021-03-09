"use strict";

var server = require("server");
var base = module.superModule;

var Resource = require("dw/web/Resource");
var URLUtils = require("dw/web/URLUtils");
var Site = require("dw/system/Site");
var emailHelper = require("*/cartridge/scripts/helpers/emailHelpers");
var validation = require("*/cartridge/scripts/contactUs/validation");
var ContentMgr = require("dw/content/ContentMgr");
var csrfProtection = require("*/cartridge/scripts/middleware/csrf");

server.extend(base);
var breadcrumbs = [
    {
        htmlValue: Resource.msg("global.home", "common", null),
        url: URLUtils.home().toString()
    },
    {
        htmlValue: Resource.msg("page.title.contact-us", "contactUs", null),
        url: "#"
    }
];

server.append("Landing", csrfProtection.generateToken, function (req, res, next) {
    var viewData = res.getViewData();
    var content = ContentMgr.getContent(req.querystring.cid);
    viewData.breadcrumbs = breadcrumbs;
    viewData.content = content;

    req.pageMetaData.setTitle(content.pageTitle);

    res.setViewData(viewData);
    next();
});

server.replace("Subscribe", server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    var form = req.form;
    var errors = validation.validate(form);
    if (empty(errors)) {
        var emailObject = {
            to: Site.current.getCustomPreferenceValue("customerServiceEmailTo"),
            from: Site.current.getCustomPreferenceValue("customerServiceEmail"),
            subject: Resource.msg("email.subject", "contactUs", null)
        };
        emailHelper.sendEmail(emailObject, "mail/feedback", {form: form});
        res.json({
            success: true,
            msg: Resource.msg("subscribe.to.contact.us.success", "contactUs", null)
        });
    } else {
        res.json({
            msg: Resource.msg("subscribe.to.contact.us.email.invalid", "contactUs", null),
            fields: errors
        });
    }
    next();
});

server.post("Validate", server.middleware.https, function (req, res, next) {
    var errors = validation.validateFilledFields(req.form);
    res.json({
        fields: errors
    });
    next();
});

module.exports = server.exports();
