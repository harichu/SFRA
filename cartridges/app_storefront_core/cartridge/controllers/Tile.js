"use strict";

var server = require("server");
server.extend(module.superModule);

server.append("Show", function (req, res, next) {
    var productHelper = require("*/cartridge/scripts/helpers/productHelpers");

    var viewData = res.getViewData();
    // add new variable for tile mode
    viewData.smallTile = req.querystring.smallTile || null;

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

module.exports = server.exports();
