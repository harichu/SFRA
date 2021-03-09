'use strict';

/**
 * Call the  CyberSource API to Authorize CC using details entered by shopper.
 */
var libCybersource    = require('int_cybersource/cartridge/scripts/cybersource/libCybersource'),
    CommonHelper      = require('int_cybersource/cartridge/scripts/helper/CommonHelper'),
    csReference       = webreferences.CyberSourceTransaction,
    CybersourceHelper = libCybersource.getCybersourceHelper(),
    OrderMgr          = require('dw/order/OrderMgr'),
    SORLogger         = dw.system.Logger.getLogger('SORLogger', 'SORLogger');

function Authorize(args) {

    var serviceRequest = new csReference.RequestMessage(),
        currencyCode   = args.Order.currencyCode,
        totalPrice     = args.Basket.getTotalGrossPrice().getValue(),
        orderNo        = args.Order.orderNo,
        subscriptionID = args.SubscriptionID,
        purchaseTotal  = CommonHelper.CreateCyberSourcePurchaseTotalsObject_UserData(currencyCode, totalPrice).purchaseTotals,
        items          = CommonHelper.CreateCybersourceItemObject(args.Basket).items;

    addOnDemandSubscriptionInfo(subscriptionID, serviceRequest, purchaseTotal, orderNo, items);

    var originalOrder = OrderMgr.getOrder(args.OriginalOrder);

    serviceRequest.billTo = setBillTo(originalOrder);
    serviceRequest.card = setCard(originalOrder);

    var serviceResponse = null;
    // send request
    try {
        var service = CreateService();
        serviceResponse = service.call(serviceRequest);

    } catch(e) {
        return {
            error    : true,
            errorMsg : e.message
        };
    }

    if (serviceResponse && serviceResponse.status == 'OK' && serviceResponse.object && serviceResponse.object.decision == "ACCEPT") {
        SORLogger.info('CyberSource response: {0}', JSON.stringify({
            success           : true,
            transactionID     : serviceResponse.object.requestID,
            amount            : serviceResponse.object.ccAuthReply.amount,
            authorizationCode : serviceResponse.object.ccAuthReply.authorizationCode,
            reasonCode        : serviceResponse.object.reasonCode
        }));

        return {
            success           : true,
            transactionID     : serviceResponse.object.requestID,
            requestToken      : serviceResponse.object.requestToken,
            amount            : serviceResponse.object.ccAuthReply.amount,
            authorizationCode : serviceResponse.object.ccAuthReply.authorizationCode,
            reasonCode        : serviceResponse.object.reasonCode
        };
    }
    return {error : true};
}

function CreateService() {
    var SOAPUtil = require('dw/rpc/SOAPUtil'),
        HashMap  = require('dw/util/HashMap');

    return dw.svc.LocalServiceRegistry.createService("cybersource.soap.transactionprocessor.generic", {
        initServiceClient : function(svc) {
            svc.serviceClient = csReference.getDefaultService();
            return svc.serviceClient;
        },
        execute : function(svc, parameter) {
            var userName    = svc.getConfiguration().getCredential().getUser(),
                password    = dw.system.Site.getCurrent().getCustomPreferenceValue("CsSecurityKey"),
                secretsMap  = new HashMap(),
                requestCfg  = new HashMap(),
                responseCfg = new HashMap();

            secretsMap.put(userName, password);

            requestCfg.put(SOAPUtil.WS_ACTION, SOAPUtil.WS_USERNAME_TOKEN);
            requestCfg.put(SOAPUtil.WS_USER, userName);
            requestCfg.put(SOAPUtil.WS_PASSWORD_TYPE, SOAPUtil.WS_PW_TEXT);
            requestCfg.put(SOAPUtil.WS_SECRETS_MAP, secretsMap);

            responseCfg.put(SOAPUtil.WS_ACTION, SOAPUtil.WS_TIMESTAMP);

            SOAPUtil.setWSSecurityConfig(svc.serviceClient, requestCfg, responseCfg);

            return svc.serviceClient.runTransaction(parameter);
        },
        parseResponse : function(service, response) {
            return response;
        }
    });
}

function CheckInitialPaymentApproval(initialOrder) {
    var decision = initialOrder.paymentTransaction.custom.decision;
    if (decision == 'ACCEPT') {
        return true;
    } else {
        return false;
    }
}

// Update a Card Account Number.
function UpdateCard(serviceRequest, creditCardForm, orderNo, subscriptionID) {
    serviceRequest.merchantID = CybersourceHelper.getMerchantID();

    setClientData(serviceRequest, orderNo);

    var order = OrderMgr.getOrder(orderNo);

    serviceRequest.billTo = setBillTo(order);

    if (creditCardForm != null) {
        addCardInfo(serviceRequest, creditCardForm);
    }

    var request_recurringSubscriptionInfo = new csReference.RecurringSubscriptionInfo();
    request_recurringSubscriptionInfo["subscriptionID"] = subscriptionID;
    serviceRequest.recurringSubscriptionInfo = request_recurringSubscriptionInfo;

    serviceRequest.paySubscriptionUpdateService = new csReference.PaySubscriptionUpdateService();
    serviceRequest.paySubscriptionUpdateService.run = true;
}

// Charge a Cancelation Fee
function ChargeFee(subsList, cancelationFee) {
    var csReference    = webreferences.CyberSourceTransaction,
        serviceRequest = new csReference.RequestMessage();

    var PurchaseTotals = require('int_cybersource/cartridge/scripts/cybersource/Cybersource_PurchaseTotals_Object');
        purchaseTotal  = new PurchaseTotals();
        Item_Object    = require('int_cybersource/cartridge/scripts/cybersource/Cybersource_Item_Object'),
        itemObject     = new Item_Object(),
        items          = new dw.util.ArrayList();
        feeValue       = dw.util.StringUtils.formatNumber(cancelationFee,"000000.00","en_US"),
        originalOrder  = OrderMgr.getOrder(subsList.originalOrder);

    serviceRequest.billTo = setBillTo(originalOrder);
    serviceRequest.card = setCard(originalOrder);

    purchaseTotal.setCurrency(dw.system.Site.getCurrent().getDefaultCurrency());
    purchaseTotal.setGrandTotalAmount(feeValue);

    itemObject.setId(1);
    itemObject.setUnitPrice(feeValue);
    itemObject.setQuantity(1);
    itemObject.setProductCode(dw.web.Resource.msg('account.addressbook.addressinclude.default', 'account', null));
    itemObject.setProductSKU(dw.web.Resource.msg('smartorderrefill.subscription.cancelationfee', 'smartorderrefill', null));
    itemObject.setProductName(dw.web.Resource.msg('smartorderrefill.subscription.cancelationfee', 'smartorderrefill',null));
    items.add(itemObject);

    addOnDemandSubscriptionInfo(subsList.creditCardToken, serviceRequest, purchaseTotal, subsList.originalOrder, items);

    var service         = CreateService(),
        serviceResponse = service.call(serviceRequest);

    if (serviceResponse && serviceResponse.status == 'OK' && serviceResponse.object && serviceResponse.object.decision == 'ACCEPT') {
        return {
            success           : true,
            transactionID     : serviceResponse.object.requestID,
            requestToken      : serviceResponse.object.requestToken,
            amount            : serviceResponse.object.ccAuthReply.amount,
            authorizationCode : serviceResponse.object.ccAuthReply.authorizationCode,
            reasonCode        : serviceResponse.object.reasonCode
        };
    }
}



// Helper Functions
// Add On Demand payment service to request.
function addOnDemandSubscriptionInfo(subscriptionID, request, purchase, refCode, itemsCybersource) {
    request.merchantID = CybersourceHelper.getMerchantID();
    var fingerprint = null;

    if (CybersourceHelper.getDigitalFingerprintEnabled()) {
        fingerprint =  session.sessionID;
    }

    setClientData(request, refCode, fingerprint);

    var request_purchaseTotals = new csReference.PurchaseTotals();
    var value;
    for (var name in purchase) {
        if (name.indexOf("set") === -1 && name.indexOf("get") === -1) {
            value = purchase[name];
            if (value !== "") {
                request_purchaseTotals[name] = value;
            }
        }
    }

    request.purchaseTotals = request_purchaseTotals;

    var request_recurringSubscriptionInfo = new csReference.RecurringSubscriptionInfo();
    request_recurringSubscriptionInfo["subscriptionID"] = subscriptionID;
    request.recurringSubscriptionInfo = request_recurringSubscriptionInfo;

    var items = new Array();
    if (itemsCybersource != null) {
        var iter = itemsCybersource.iterator();
        while (iter.hasNext()) {
            var item         = iter.next(),
                request_item = new csReference.Item(),
                value;
            for (var name in item) {
                if (name.indexOf("set") === -1 && name.indexOf("get") === -1) {
                    value = item[name];
                    if(value !== "") {
                        request_item[name] = value;
                    }
                }
            }
            items.push(request_item);
        }
    }

    request.item = items;

    request.ccAuthService = new csReference.CCAuthService();
    request.ccAuthService.run = true;
} 

// Set Client Data
function setClientData(request, refCode, fingerprint) {
    request.merchantReferenceCode = refCode;
    request.partnerSolutionID     = CybersourceHelper.getPartnerSolutionID();

    var developerID = CybersourceHelper.getDeveloperID();

    if (!empty(developerID)) {
        request.developerID = developerID;
    }

    request.clientLibrary        = 'Salesforce Commerce Cloud';
    request.clientLibraryVersion = '17.2.0';
    request.clientEnvironment    = 'Linux';

    if (fingerprint) {
      request.deviceFingerprintID = fingerprint;
    }
}

// Set Bill To
function setBillTo(order) {
    var billTo = new csReference.BillTo(),
        names  = order.customerName.split(' ');

    billTo.firstName   = names[0];
    billTo.lastName    = (names.length > 1) ? names[1] : '';
    billTo.email       = order.customerEmail;
    billTo.phoneNumber = order.billingAddress.phone;
    billTo.street1     = order.billingAddress.address1;
    billTo.city        = order.billingAddress.city;
    billTo.state       = order.billingAddress.stateCode;
    billTo.country     = order.billingAddress.countryCode;
    billTo.postalCode  = order.billingAddress.postalCode;

    return billTo;
}

// Set Card Info
function setCard(order) {
    var card = new csReference.Card();

    card.expirationMonth = dw.util.StringUtils.formatNumber(order.paymentInstruments[0].creditCardExpirationMonth, '00');
    card.expirationYear  = order.paymentInstruments[0].creditCardExpirationYear;

    return card;
}

// Add Card Info
function addCardInfo(request, creditCardForm) {
    var StringUtils = require('dw/util/StringUtils');
    request.card = new csReference.Card();
    if (typeof creditCardForm.expiration != 'undefined') {
       request.card.expirationMonth = StringUtils.formatNumber(creditCardForm.expiration.month.htmlValue, "00");
       request.card.expirationYear = creditCardForm.expiration.year.value;
    } else {
       request.card.expirationMonth = StringUtils.formatNumber(creditCardForm.month.htmlValue, "00");
       request.card.expirationYear = creditCardForm.year.value;
    }

    if (creditCardForm.number.value.indexOf('X') == -1) {
       request.card.accountNumber = creditCardForm.number.value;
    }

    switch(creditCardForm.type.htmlValue){
       case "Visa":
           request.card.cardType="001";
           break;
       case "Master Card":
           request.card.cardType="002";
           break;
       case "Amex":
           request.card.cardType="003";
           break;
       case "Discover":
           request.card.cardType="004";
           break;
       case "Maestro":
           request.card.cardType="042";
           break;
   }
   return request;
}



exports.Authorize                   = Authorize;
exports.CreateService               = CreateService;
exports.UpdateCard                  = UpdateCard;
exports.ChargeFee                   = ChargeFee;
exports.CheckInitialPaymentApproval = CheckInitialPaymentApproval;
