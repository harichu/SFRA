"use strict";

var server = require("server");
server.extend(module.superModule);

/**
 * Populate viewData with additional data specific for MercadoPago
 */
server.append("SubmitShipping", function (req, res, next) {
    // Guard clause
    var MercadoPagoHelper = require("*/cartridge/scripts/util/MercadoPagoHelper");
    if (!MercadoPagoHelper.isMercadoPagoEnabled()) {
        return next();
    }

    this.on("route:BeforeComplete", function (req, res) {
        var viewData = res.getViewData();

        if (req.currentCustomer.raw.authenticated && viewData.order) {
            viewData.order.orderEmail = req.currentCustomer.profile.email;
        }

        res.setViewData(viewData);
    });

    return next();
});

module.exports = server.exports();
