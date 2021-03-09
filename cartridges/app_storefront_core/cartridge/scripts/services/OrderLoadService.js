"use strict";

// API includes
var Resource    = require("dw/web/Resource"),
    Order       = require("dw/order/Order"),
    Site        = require("dw/system/Site"),
    Transaction = require("dw/system/Transaction");

// Script Includes
var orderLoadServiceDefinition = require("app_storefront_core/cartridge/scripts/services/OrderLoadServiceDefinition");
var emailHelpers               = require("app_storefront_base/cartridge/scripts/helpers/emailHelpers");

/**
 * Creates an order on the OMS service side
 * @param {dw.order.Order} order an SFCC order instance
 */
function INT_CH_SFCC_CreateOrder(order) {
    var result = null;
    if (!empty(order)) {
        try {
            result = orderLoadServiceDefinition.createOrder(order);
            
            if (result) {
                Transaction.wrap(function () {
                    order.setExportStatus(Order.EXPORT_STATUS_EXPORTED);
                });
            }
        } catch (e) {
            order.setExportStatus(Order.EXPORT_STATUS_FAILED);
            sendErrorEmail(order.getOrderNo(), e.toString());
            throw new Error(Resource.msg("subheading.error.general", "error", null));
        }
    }
    return result;
}

/**
 * Sends e-mail with an error message
 * @param {string} orderNo order number
 * @param {string} errorMessage error message
 */
function sendErrorEmail(orderNo, errorMessage) {
    var emailObject = {
        to: Site.current.getCustomPreferenceValue("customerServiceEmailTo"),
        from: Site.current.getCustomPreferenceValue("customerServiceEmail"),
        subject: Resource.msg("general.error", "error", null)
    };
    emailHelpers.sendEmail(emailObject, "mail/omserror", {orderNo: orderNo, errorMessage: errorMessage});
}

module.exports = {
    INT_CH_SFCC_CreateOrder: INT_CH_SFCC_CreateOrder
};
