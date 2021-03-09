"use strict";

var CustomObjectMgr = require("dw/object/CustomObjectMgr");


function getMarketingCloudEnabled() {
    var CUSTOM_OBJ_NAME = "CommunicationHandlers";
    var instanceType = getInstanceType();
    var commHandlerObj = CustomObjectMgr.getCustomObject(CUSTOM_OBJ_NAME, instanceType);
    var commHandlerJsonConfig = JSON.parse(commHandlerObj.custom.configJson);
    var isMarketingCloudEnabled = commHandlerJsonConfig.int_marketing_cloud.enabled;
    return isMarketingCloudEnabled;
}

function buildCart(basket) {
    var CartModel = require("*/cartridge/models/cart");
    var URLUtils = require("dw/web/URLUtils");
    var marketingCloudCart = {};
    var basketModel = new CartModel(basket);
    if (customer.profile) {
        marketingCloudCart.user = customer.profile.email;
        marketingCloudCart.name = customer.profile.firstName;
        marketingCloudCart.subKey = customer.profile.custom.ccDocument || customer.profile.custom.ceDocument || customer.profile.custom.passport || customer.profile.custom.difarmaRunRutNit;
    }
    marketingCloudCart.basket = basket.UUID;
    marketingCloudCart.date = new Date();
    marketingCloudCart.cart = [];
    marketingCloudCart.cart.length = 0;
    basketModel.items.forEach(function (lineItem) {
        var cartItem = {};
        cartItem.item = lineItem.productName;
        cartItem.unique_id = lineItem.id;
        cartItem.productUrl = URLUtils.https("Product-Show", "pid", lineItem.id).toString();
        cartItem.brand = lineItem.brand;
        cartItem.price = lineItem.priceTotal.value;
        cartItem.quantity = lineItem.quantity;
        cartItem.imgUrl = lineItem.images.small[0].url;
        marketingCloudCart.cart.push(cartItem);
    });

    return marketingCloudCart;
}

function getInstanceType() {
    var System = require("dw/system/System");
    var instanceType;
    switch (System.instanceType) {
        case System.PRODUCTION_SYSTEM:
            instanceType = "production";
            break;
        case System.STAGING_SYSTEM:
            instanceType = "staging";
            break;
        case System.DEVELOPMENT_SYSTEM:
        default:
            instanceType = "development";
            break;
    }
    return instanceType;
}

module.exports = {
    getMarketingCloudEnabled: getMarketingCloudEnabled,
    buildCart: buildCart
};
