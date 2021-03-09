"use strict";

var server = require("server");
var base = module.superModule;

var Resource = require("dw/web/Resource");
var URLUtils = require("dw/web/URLUtils");
var csrfProtection = require("*/cartridge/scripts/middleware/csrf");
var userLoggedIn = require("*/cartridge/scripts/middleware/userLoggedIn");
var consentTracking = require("*/cartridge/scripts/middleware/consentTracking");
server.extend(base);

server.append(
    "List",
    csrfProtection.generateToken,
    userLoggedIn.validateLoggedIn,
    consentTracking.consent,
    function (req, res, next) {
        var Site = require("dw/system/Site");
        var viewData = res.getViewData();

        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

        viewData.breadcrumbs = [
            {
                htmlValue: Resource.msg("global.home", "common", null),
                url: URLUtils.home().toString()
            },
            {
                htmlValue: Resource.msg("label.profile", "account", null),
                url: URLUtils.url("Account-Show").toString()
            },
            {
                htmlValue: Resource.msg("link.header.payments", "account", null),
                url: ""
            }
        ];
        viewData.sidebarCurrent = "mywallet";
        res.setViewData(viewData);
        return next();
    }
);

server.append(
    "AddPayment",
    csrfProtection.generateToken,
    userLoggedIn.validateLoggedIn,
    consentTracking.consent,
    function (req, res, next) {
        var Site = require("dw/system/Site");

        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

        var viewData = res.getViewData();
        viewData.breadcrumbs = [
            {
                htmlValue: Resource.msg("global.home", "common", null),
                url: URLUtils.home().toString()
            },
            {
                htmlValue: Resource.msg("label.profile", "account", null),
                url: URLUtils.url("Account-Show").toString()
            },
            {
                htmlValue: Resource.msg("link.header.payments", "account", null),
                url: ""
            }
        ];
        viewData.sidebarCurrent = "mywallet";
        res.setViewData(viewData);
        return next();
    }
);

module.exports = server.exports();
