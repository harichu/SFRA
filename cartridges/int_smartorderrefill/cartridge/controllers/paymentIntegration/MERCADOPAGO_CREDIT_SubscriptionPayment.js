"use strict";

var MercadoPago     = require("*/cartridge/scripts/library/libMercadoPago");
var OrderMgr        = require("dw/order/OrderMgr");
var OrderLoadHelper = require("*/cartridge/scripts/helpers/orderLoadHelper");

function CheckInitialPaymentApproval(initialOrder) {
    return true;
}

/**
 * Processes payment for an order from a subscription.
 * @param {dw.order.Order} order The order to be payed for.
 * @param {dw.order.Basket} basket The basket related to the order.
 * @param {String} subscriptionToken A subscription token.
 * @param {String} originalOrderNo The number of the original order.
 * @return {Object} An object detailing the success or failure of the payment.
 */
function Authorize(order, basket, subscriptionToken, originalOrderNo) {
    var mp            = new MercadoPago();
    var customerObj   = mp.searchCustomer({ email : order.customerEmail }).results[0];
    var originalOrder = OrderMgr.getOrder(originalOrderNo);
    var cardToken     = mp.getCardToken(originalOrder.custom.SorCardId);

    order.paymentInstruments[0].setCreditCardToken(cardToken.id);

    var paymentData = mp.createPaymentData(order, order.customer, 1, 0, customerObj.id);

    if (empty(paymentData.payment_method_id)) {
        paymentData.payment_method_id = mp.getCustomerCardType(customerObj.id, cardToken.card_id);
    }

    var paymentResponse = mp.createPayment(paymentData);
    var parsedResponse  = mp.parseOrderStatus(paymentResponse.status);
    var orderLoadData   = mp.prepareDataForOrderLoad(paymentResponse);
    OrderLoadHelper.fillPaymentData(order, orderLoadData);

    return { error : parsedResponse != "authorized", transactionID : paymentResponse.id };
}

module.exports = {
    Authorize                   : Authorize,
    CheckInitialPaymentApproval : CheckInitialPaymentApproval
};
