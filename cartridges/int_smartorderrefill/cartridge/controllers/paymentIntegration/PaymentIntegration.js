// CyberSource Functions
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
var mercadoPagoProcessor = require('int_smartorderrefill/cartridge/controllers/paymentIntegration/MERCADOPAGO_CREDIT_SubscriptionPayment.js');

exports.CYBERSOURCE_CREDIT = {
    Authorize : function(Order, Basket, SubscriptionID, OriginalOrder) {
        var args = {
            Order          : Order,
            Basket         : Basket,
            SubscriptionID : SubscriptionID,
            OriginalOrder  : OriginalOrder
        }
        var cyberSourceProcessor = require('int_smartorderrefill/cartridge/controllers/paymentIntegration/CYBERSOURCE_CREDIT_SubscriptionPayment.js');
        return cyberSourceProcessor.Authorize(args);
    },
    
    CheckInitialPaymentApproval : function(initialOrder) {
        var cyberSourceProcessor = require('int_smartorderrefill/cartridge/controllers/paymentIntegration/CYBERSOURCE_CREDIT_SubscriptionPayment.js');
        return cyberSourceProcessor.CheckInitialPaymentApproval(initialOrder);
    },

    CreateService : function() {
        var cyberSourceProcessor = require('int_smartorderrefill/cartridge/controllers/paymentIntegration/CYBERSOURCE_CREDIT_SubscriptionPayment.js');
        return cyberSourceProcessor.CreateService();
    },

    UpdateCard : function(serviceRequest, creditCardForm, orderNo, subscriptionID) {
        var cyberSourceProcessor = require('int_smartorderrefill/cartridge/controllers/paymentIntegration/CYBERSOURCE_CREDIT_SubscriptionPayment.js');
        return cyberSourceProcessor.UpdateCard(serviceRequest, creditCardForm, orderNo, subscriptionID);
    },

    ChargeFee : function(subsList, feeValue) {
        var cyberSourceProcessor = require('int_smartorderrefill/cartridge/controllers/paymentIntegration/CYBERSOURCE_CREDIT_SubscriptionPayment.js');
        return cyberSourceProcessor.ChargeFee(subsList, feeValue);
    },

    UpdatePaymentInstrument : function(paymentInstrument, paymentResponse) {
        paymentInstrument.paymentTransaction.transactionID         = paymentResponse.transactionID;
    }
};

exports.MERCADOPAGO_CREDIT = {
    Authorize: mercadoPagoProcessor.Authorize,
    CheckInitialPaymentApproval: mercadoPagoProcessor.CheckInitialPaymentApproval,
    CreateService: mercadoPagoProcessor.CreateService,
    UpdateCard: mercadoPagoProcessor.UpdateCard,
    ChargeFee: mercadoPagoProcessor.ChargeFee,
    UpdatePaymentInstrument : function (paymentInstrument, paymentResponse) {
        paymentInstrument.paymentTransaction.transactionID = paymentResponse.transactionID;
    }
};
