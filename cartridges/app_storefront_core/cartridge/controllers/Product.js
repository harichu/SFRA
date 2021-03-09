"use strict";

var server         = require("server");
var base           = module.superModule;
var URLUtils       = require("dw/web/URLUtils");
var ProductFactory = require("*/cartridge/scripts/factories/product");
var productHelper  = require("*/cartridge/scripts/helpers/productHelpers");

server.extend(base);

server.append("Show", function (req, res, next) {
    var viewData = res.getViewData();
    var productID = !empty(viewData.product.master) ? viewData.product.master.getID() : viewData.product.id;
    viewData.product.brandSearch = viewData.product.brand ? viewData.product.brand.replace(/\s/g, "+") : "";
    [viewData.canonicalLink] = URLUtils.https("Product-Show", "pid", productID).toString().split("?");

    var quantitiesWrapper = [];
    if (viewData.product.quantities && viewData.product.quantities.length > 0) {
        quantitiesWrapper = productHelper.createQuantitiesWrapper(
            viewData.product.id,
            viewData.product.quantities[0].url
        );
    }

    viewData.product.quantitiesWrapper = quantitiesWrapper;

    res.setViewData(viewData);

    next();
});

server.append("Variation", function (req, res, next) {
    var viewData = res.getViewData();

    var quantitiesWrapper = [];
    if (viewData.product.quantities && viewData.product.quantities.length > 0) {
        quantitiesWrapper = productHelper.createQuantitiesWrapper(
            viewData.product.id,
            viewData.product.quantities[0].url,
            viewData.product.selectedQuantity
        );
    }

    viewData.product.quantitiesWrapper = quantitiesWrapper;

    res.setViewData(viewData);

    next();
});

server.post("GuestSor", function (req, res, next) {
    var pid = req.querystring.pid;

    session.custom.redirectToPageAfterLoginOrRegister = URLUtils.https("Product-Show", "pid", pid).toString();

    res.redirect(URLUtils.url("Login-Show"));
    next();
});

server.get("Nocache", function (req, res, next) {
    var isQuickView = req.querystring.isQuickView === "true";
    var pid         = req.querystring.pid;
    var template    = req.querystring.template;
    var product     = ProductFactory.get({ pid : pid });

    var quantitiesWrapper = [];
    if (product.quantities && product.quantities.length > 0) {
        quantitiesWrapper = productHelper.createQuantitiesWrapper(
            product.id,
            product.quantities[0].url
        );
    }
    product.quantitiesWrapper = quantitiesWrapper;

    res.render("product/components/" + template, {
        isQuickView : isQuickView,
        product     : product
    });

    return next();
});

server.get("Recommendation", function (req, res, next) {
    var ProductMgr = require("dw/catalog/ProductMgr");
    var currentSite = require("dw/system/Site").current;
    var isMobileRecommendationModalOnAddCartEnabled = currentSite.getCustomPreferenceValue("isMobileRecommendationModalOnAddCartEnabled");
    var pid = req.querystring.pid;
    var product = ProductMgr.getProduct(pid);

    if (product && isMobileRecommendationModalOnAddCartEnabled) {
        var recommendations = product.getRecommendations();
        res.setViewData({
            pid : pid,
            isMobileRecommendationModalOnAddCartEnabled: product.custom.isMobileRecommendationModalOnAddCartEnabled,
            recommendations: recommendations
        });
    }

    res.render("product/components/productCarouselAddToCart");

    next();
});

module.exports = server.exports();
