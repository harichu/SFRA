"use strict";

var base = module.superModule;

var server = require("server");
var mercadoPagoHelper = require("*/cartridge/scripts/util/MercadoPagoHelper");

server.extend(base);

server.append("Show", function (req, res, next) {
    var viewData = res.getViewData();
    var customerCards = mercadoPagoHelper.getAccountCreditCards(req.currentCustomer);
    viewData.paymentCard = !empty(customerCards)? customerCards[0] : null;
    res.setViewData(viewData);
    next();
});

module.exports = server.exports();
