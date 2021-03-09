'use strict';
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
/**
 * Controller handling smart order refill.
 * @module controllers/SmartOrderRefillController
 */

/* API Imports */
var Transaction         = require('dw/system/Transaction'),
    URLUtils            = require('dw/web/URLUtils'),
    Resource            = require('dw/web/Resource'),
    CustomerMgr         = require('dw/customer/CustomerMgr'),
    BasketMgr           = require('dw/order/BasketMgr'),
    ProductMgr          = require('dw/catalog/ProductMgr'),
    Site                = require('dw/system/Site'),
    OrderMgr            = require('dw/order/OrderMgr'),
    Logger              = require('dw/system/Logger'),
    CSRFProtection      = require("dw/web/CSRFProtection");


/* Script Modules */
var server              = require('server'),
    sorHelper           = require('int_smartorderrefill/cartridge/scripts/SmartOrderRefillHelper.js'),
    sorConstants        = require('int_smartorderrefill/cartridge/scripts/SmartOrderRefillConstants.js'),
    RefillOptionsModel  = require('int_smartorderrefill/cartridge/models/RefillOptions.js'),
    RefillCustomerModel = require('int_smartorderrefill/cartridge/models/RefillCustomer.js'),
    productHelper = require("*/cartridge/scripts/helpers/productHelpers");


/* Global Variables */
var sorEnabled = Site.current.getCustomPreferenceValue('SorEnabled'),
    params     = request.httpParameterMap,
    forms      = session.forms,
    jsonResponse = {
        "success": false,
        "message": ''
    };

/**
 * Displays Manage Smart Order Refill page
 */
server.get('Manage',
    server.middleware.https,
    validateLoggedIn,
    function (req, res, next) {
        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

    if (sorHelper.verifyLicense() && sorEnabled) {
        var currentCustomer   = CustomerMgr.getCustomerByLogin(customer.profile.email);
        var subscriptionsList = getActiveRefillLists(currentCustomer.profile.custom.SorSubscriptions);
        var ordersList        = getActiveRefillLists(currentCustomer.profile.custom.SorOrders);
        var orderListObject   = {};
        var now               = new Date();

        for (var i = 0; i < ordersList.length; i++) {
            var order = ordersList[i];
            if (!orderListObject.hasOwnProperty(order.subscriptionID)){
                orderListObject[order.subscriptionID] = [];
            }
            orderListObject[order.subscriptionID].push(order);
            for (var j = 0; j < subscriptionsList.length; j++) {
                var subscription = subscriptionsList[j];
                if (subscription.ID == order.subscriptionID) {
                    var orderDate = new Date(order.createdAt);
                    if (orderDate.getTime() > now.getTime()) {
                        subscription.nextUpdate = orderDate;
                        break;
                    }
                }
            }
        }

        var breadcrumbs = [
            {
                htmlValue: Resource.msg("global.home", "common", null),
                url: URLUtils.home().toString()
            },
            {
                htmlValue: Resource.msg("label.profile", "account", null),
                url: URLUtils.url("Account-Show").toString()
            },
            {
                htmlValue: Resource.msg("smartorderrefill.accountmenu.linktitle", "account", null),
                url: ""
            }
        ];
        
        res.render('account/smartorderrefill/managedetails', {
            sorConstants: sorConstants,
            SubscriptionsList : subscriptionsList,
            OrderListObject : orderListObject,
            OrdersList        : ordersList,
            breadcrumbs: breadcrumbs
        });
    } else {
        res.redirect(URLUtils.url('Account-Show'));
    }
    next();
});

/**
 * Root handles all interactions on Manage page
 */

 server.use('ManageRefillList', function (req, res, next) {
    var action = params.action.stringValue;
    
    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : CustomerMgr.getCustomerByLogin(customer.profile.email)
    });

    if (!params.oid.empty) {
        /**
         * Handles orders
         */
        switch (action) {
            case 'view': {
                var context       = refillCustomer.viewOrder(params.oid.stringValue);
                var originalOrder = OrderMgr.getOrder(context.ProductList.originalOrder);
                var sorDeliveryWeekCount = [];
                var sorDeliveryMonthCount = [];

                for (var i = 1; i <= preferences.custom.SorDeliveryWeekCount; i++) {
                    sorDeliveryWeekCount.push(i.toFixed(0));
                }

                for (var j = 1; j <= preferences.custom.SorDeliveryMonthCount; j++) {
                    sorDeliveryMonthCount.push(j.toFixed(0));
                }
                context['ShippingMethodName']    = originalOrder.defaultShipment.shippingMethod.displayName;
                context['ShippingCost']          = originalOrder.getAdjustedShippingTotalPrice().decimalValue.get();
                context['sorDeliveryWeekCount']  = sorDeliveryWeekCount;
                context['sorDeliveryMonthCount'] = sorDeliveryMonthCount;
                res.render('account/smartorderrefill/vieworder', context);
            } break;

            case 'updateQuantity': {
                var quantity  = params.quantity.intValue,
                    productID = params.item.stringValue;

                if (quantity && quantity > 0) {
                    try {
                        refillCustomer.changeOrderProductQtd(params.oid.stringValue, productID, quantity);
                        jsonResponse.success = true;
                    } catch (e) {
                        jsonResponse.success = false;
                    }
                    res.json(jsonResponse);
                } else {
                    jsonResponse.message = (quantity == null || quantity < 0) ? Resource.msg('validate.required', 'forms', null) : Resource.msgf('validate.min', 'forms', null, 1);
                    jsonResponse.success = false;
                    res.json(jsonResponse);
                }
            } break;

            case 'updateAddress' : {
                if (!empty(request.triggeredForm) && request.triggeredForm.triggeredAction.triggered) {
                    if (request.triggeredForm.valid && CSRFProtection.validateRequest()) {
                        refillCustomer.updateOrderAddressFinish(params.oid.stringValue, session.forms.changeaddress, params.addressType.stringValue);
                        jsonResponse.success = true;
                    } else {
                        jsonResponse.success = false;
                    }
                    res.json(jsonResponse);
                } else {
                    var addressObj = refillCustomer.updateOrderAddressStart(params.oid.stringValue, params.addressType.stringValue);
                    addressObj.countryCode.value = addressObj.countryCode.value.toLowerCase();
                    forms.changeaddress.clearFormElement();
                    forms.changeaddress.copyFrom(addressObj);
                    forms.changeaddress.states.copyFrom(addressObj);

                    res.render('account/smartorderrefill/changeaddress', {
                        customerAddresses: refillCustomer.getCustomerAddresses(),
                        ContinueURL : URLUtils.https('SmartOrderRefillController-ManageRefillList', 'addressType', params.addressType.stringValue, 'oid', params.oid.stringValue, 'action', 'updateAddress')
                    });
                }
            } break;

            case 'removeProduct': {
                try {
                    refillCustomer.removeOrderProduct(params.oid.stringValue, params.item.stringValue);
                    jsonResponse.success = true;
                } catch (e) {
                    jsonResponse.success = false;
                }
                res.json(jsonResponse);
            } break;
            
            case sorConstants.STATUS.CANCELED: {
                var lastOrder = refillCustomer.isLastOrder(params.oid.stringValue) 
                var checkCancel = refillCustomer.checkBeforeCancel('order', params.oid.stringValue);
                if (checkCancel.status) {
                    if (!lastOrder.status) {
                        var cancelStatus = refillCustomer.manageOrder({
                            orderId   : params.oid.stringValue,
                            newStatus : sorConstants.STATUS.CANCELED
                        });
                        jsonResponse.success = true;
                    } else {
                        jsonResponse.success = false;
                        jsonResponse.message = lastOrder.message;
                    }
                    
                } else {
                    jsonResponse.success = false;
                    jsonResponse.message = checkCancel.message;
                }
                if (!params.fromEmail.empty && params.fromEmail.booleanValue) {
                    res.redirect(URLUtils.https('SmartOrderRefillController-Manage'))
                } else {
                    res.json(jsonResponse);
                }            
            } break;

            default : {
                var checkPause = refillCustomer.checkBeforeCancel('order', params.oid.stringValue);
                if (!checkPause.status && action == 'paused') {
                    jsonResponse.success = false;
                    jsonResponse.message = checkPause.message;            
                } else {
                    refillCustomer.manageOrder({
                        orderId   : params.oid.stringValue,
                        newStatus : action
                    });
                    jsonResponse.success = true;
                }
                if (!params.fromEmail.empty && params.fromEmail.booleanValue) {
                    res.redirect(URLUtils.https('SmartOrderRefillController-Manage'))
                } else {
                    res.json(jsonResponse);
                }            
                res.json(jsonResponse);
                
            }
        }
    }

    /**
     * Handles subscriptions
     */
    if (!params.sid.empty) {
        switch (action) {
            case sorConstants.STATUS.PAUSED: {
                var checkPause = refillCustomer.checkBeforeCancel('subscription', params.sid.stringValue);
                 if (checkPause.status) {
                    refillCustomer.pauseSubscription(params.sid.stringValue);
                    jsonResponse.success = true;
                 } else {
                    jsonResponse.success = false;
                    jsonResponse.message = checkPause.message;
                 }   
                res.json(jsonResponse);
            } break;

            case sorConstants.STATUS.CANCELED: {
                var checkCancel = refillCustomer.checkBeforeCancel('subscription', params.sid.stringValue);
                if (checkCancel.status) {
                    if (refillCustomer.cancelSubscription(params.sid.stringValue)) {
                        jsonResponse.success = true;
                    } else {
                        jsonResponse.success = false;
                    }
                } else {
                    jsonResponse.success = false;
                    jsonResponse.message = checkCancel.message;
                }
                res.json(jsonResponse);
            } break;

            case 'view' : {
                var preferences   = Site.current.preferences;
                var context       = refillCustomer.viewSubscription(params.sid.stringValue);
                var originalOrder = OrderMgr.getOrder(context.ProductList.originalOrder);
                var sorDeliveryWeekCount = [];
                var sorDeliveryMonthCount = [];

                for (var i = 1; i <= preferences.custom.SorDeliveryWeekCount; i++) {
                    sorDeliveryWeekCount.push(i.toFixed(0));
                }

                for (var j = 1; j <= preferences.custom.SorDeliveryMonthCount; j++) {
                    sorDeliveryMonthCount.push(j.toFixed(0));
                }

                context['ShippingMethodName']    = originalOrder.defaultShipment.shippingMethod.displayName;
                context['ShippingCost']          = originalOrder.getAdjustedShippingTotalPrice().decimalValue.get();
                context['sorDeliveryWeekCount']  = sorDeliveryWeekCount;
                context['sorDeliveryMonthCount'] = sorDeliveryMonthCount;
                res.render('account/smartorderrefill/vieworder', context);
            } break;
            
            case 'cancelRenewal': {
                try {
                    refillCustomer.cancelRenewal(params.sid.stringValue);
                    jsonResponse.success = true;
                } catch (e) {
                    jsonResponse.success = false;                    
                }
                res.json(jsonResponse);
            } break;

            case 'updateAddress': {
                if (!empty(request.triggeredForm) && request.triggeredForm.triggeredAction.triggered) {
                    if (request.triggeredForm.valid && CSRFProtection.validateRequest()) {
                        refillCustomer.updateSubscriptionAddressFinish(params.sid.stringValue, session.forms.changeaddress, params.addressType.stringValue);
                        jsonResponse.success = true;
                    } else {
                        jsonResponse.success = false;
                    }
                    res.json(jsonResponse);
                } else {
                    var addressObj = refillCustomer.updateSubscriptionAddressStart(params.sid.stringValue, params.addressType.stringValue);
                    addressObj.countryCode.value = addressObj.countryCode.value.toLowerCase();
                    forms.changeaddress.clearFormElement();
                    forms.changeaddress.copyFrom(addressObj);
                    forms.changeaddress.states.copyFrom(addressObj);

                    res.render('account/smartorderrefill/changeaddress', {
                        customerAddresses: refillCustomer.getCustomerAddresses(),
                        ContinueURL : URLUtils.https('SmartOrderRefillController-ManageRefillList', 'addressType', params.addressType.stringValue, 'sid', params.sid.stringValue, 'action', 'updateAddress')
                    });
                }
            } break;

            case 'updateQuantity': {
                var quantity  = params.quantity.intValue,
                    productID = params.item.stringValue;

                if (quantity && quantity > 0) { 
                    try {
                        refillCustomer.changeSubscriptionProductQtd(params.sid.stringValue, productID, quantity);
                        jsonResponse.success = true;
                    } catch (e) {
                        jsonResponse.success = false;
                    }
                } else {
                    jsonResponse.message = (quantity == null || quantity < 0) ? Resource.msg('validate.required', 'forms', null) : Resource.msgf('validate.min', 'forms', null, 1);
                    jsonResponse.success = false;
                }
                res.json(jsonResponse);
            } break;

            case 'updateRefill': {
                try {
                    var periodicity = params.periodicity.stringValue,
                        interval    = params.interval.intValue,
                        productID   = params.item.stringValue;

                    refillCustomer.updateRefill(params.sid.stringValue, productID, periodicity, interval);
                    jsonResponse.success = true;
                } catch (e) {
                    jsonResponse.success = false
                }
                res.json(jsonResponse);
            } break;

            case 'updateCreditCard': {

                if (!empty(forms.updatecard) && forms.updatecard.valid && forms.updatecard.triggeredAction && CSRFProtection.validateRequest()) {
                    try {
                        refillCustomer.updateCreditCardFinish(params.sid.stringValue, forms);
                        jsonResponse.success = true;
                    } catch (e) {
                        jsonResponse.success = false
                    }
                    res.json(jsonResponse);
                } else {
                    var currentCreditCard = refillCustomer.updateCreditCardStart(params.sid.stringValue);

                    forms.updatecard.type.setOptions(currentCreditCard.applicablePaymentCards.iterator());
                    forms.updatecard.clearFormElement();
                    forms.updatecard.type.value = (currentCreditCard.type == 'MasterCard') ? 'Master Card' : currentCreditCard.type;
                    forms.updatecard.number.value = currentCreditCard.number;
        
                    res.render('account/smartorderrefill/updatecard', {
                        ContinueURL    : URLUtils.https('SmartOrderRefillController-ManageRefillList', 'sid', params.sid.stringValue, 'action', 'updateCreditCard'),
                        currentCountry : currentCreditCard.currentCountry,
                        canUpdateAll   : currentCreditCard.canUpdateAll,
                        expMonth       : currentCreditCard.expMonth,
                        expYear        : currentCreditCard.expYear
                    });
                }
            } break;

            case 'removeProduct': {
                try {
                    refillCustomer.removeSubscriptionProduct(params.sid.stringValue, params.item.stringValue);
                    jsonResponse.success = true;
                } catch (e) {
                    jsonResponse.success = false
                }
                res.json(jsonResponse);
            } break;

            case 'reactivate': {
                if (!params.reactiveType.empty || !params.available.empty) {
                    if (params.available.booleanValue) {
                        if (params.priceChanged.booleanValue) {
                            refillCustomer.setNewPrices(params.sid.stringValue);
                        }

                        if (params.reactiveType.stringValue == 'remaining') {
                            refillCustomer.reactivateSubscriptionFinish(params.sid.stringValue, true)
                            jsonResponse.success = true;
                        } else {
                            refillCustomer.reactivateSubscriptionFinish(params.sid.stringValue, false)
                            jsonResponse.success = true;
                        }
                        if (!params.fromEmail.empty && params.fromEmail.booleanValue) {
                            res.redirect(URLUtils.https('SmartOrderRefillController-Manage'));
                        } else {
                            res.json(jsonResponse);
                        }             
                    } else {
                        refillCustomer.cancelSubscription(params.sid.stringValue);
                        jsonResponse.success = true;
                        res.json(jsonResponse);
                    }
                } else {
                    res.render('account/smartorderrefill/reactivesubs', refillCustomer.reactivateSubscriptionStart(params.sid.stringValue));
                }
            } break;
        }
    }
    next();
 });

/**expiration
 * Updates refill information on product line item
 */
server.use('UpdateCartProductRefillInformation', function (req, res, next) {
    var basket           = BasketMgr.currentOrNewBasket,
        product          = null,
        productLineItems = basket.allProductLineItems,
        lineItemID       = params.liuuid.stringValue;

    if (!params.pid.empty) {
        product = ProductMgr.getProduct(params.pid.stringValue);
    }
    var refillOptions = new RefillOptionsModel({
        product: product,
        productLineItems: productLineItems,
        lineItemID: lineItemID,
        preferences: Site.current.preferences
    });
    var intervalType = params.everyDelivery;
    var intervalValue = (intervalType == refillOptions.PERIODICITY.WEEK ? params.SorDeliveryWeekInterval.intValue : params.SorDeliveryMonthInterval.intValue);
    var hasRefill = params.hasSmartOrderRefill.booleanValue;
    Transaction.wrap(function() {
        if (!params.action.empty) {
            jsonResponse.success = true;
            if (params.action.stringValue == 'modify') {
                var productLineItem = null;
                if (!empty(lineItemID)) {
                    for (var pliIndex in productLineItems) {                        
                        if (lineItemID == productLineItems[pliIndex].UUID) {
                             productLineItem = productLineItems[pliIndex];
                             break;
                        }
                    }
                }
                forms.smartorderrefill.clearFormElement();
                
                if (!empty(productLineItem)) {
                    forms.smartorderrefill.copyFrom(productLineItem);
                }
                res.render('checkout/cart/modifyorderrefill', {
                    RefillOptions     : refillOptions,
                    lineItemID        : lineItemID
                });
            } else if (params.action.stringValue == 'update') {
                refillOptions.update(intervalType, intervalValue, hasRefill);
                res.json(jsonResponse);
            } else if (params.action.stringValue == 'remove') {
                refillOptions.remove();
                res.json(jsonResponse);
            }
            next();
        } else if(hasRefill) {
            refillOptions.add(intervalType, intervalValue);
        }
        sorHelper.checkForRefillProducts();
    });
});

/**
 * Displays the refill option form on pdp
 */
server.use('PDPRefillOptions', function (req, res, next) {
    if (sorHelper.verifyLicense() && sorEnabled) {
        var exclusiveGroup     = sorHelper.checkforExclusivelyGroup(customer);
        if (!exclusiveGroup) {
            var params = request.httpParameterMap,
                productLineitems = BasketMgr.currentOrNewBasket.allProductLineItems;
                product = null;
            if (!params.pid.empty) {
                product = ProductMgr.getProduct(params.pid.stringValue);
            }
            var refillOptions = new RefillOptionsModel({
                product: product,
                productLineItems: productLineitems,
                preferences: Site.current.preferences,
            });
            res.render('product/components/productrefilloptions', {
                orderable                   : productHelper.getAvailabilityModel(product).orderable,
                RefillOptions               : refillOptions
            });
            next();
        }
    }
});

/**
 * Removes refill information from ProductLineItem
 */
server.use('RefillInfoCart', function (req, res, next) {
    var lineItemID    = params.lineItemID.stringValue;    
    var refillOptions = new RefillOptionsModel({
        lineItemID       : lineItemID,
        productLineItems : BasketMgr.currentOrNewBasket.allProductLineItems,
        preferences      : Site.current.preferences
    });
    res.render('checkout/cart/showrefillinfo', {
        showLinks     : params.showLinks.booleanValue,
        RefillOptions : refillOptions,
        lineItemID    : lineItemID
    });
    next();
});

/**
 * Displays and handles the login register form for cart modal
 */
server.use('RequireLogin', function (req, res, next) {
    if (req.httpMethod == 'GET') {
        forms.sorlogin.clearFormElement();
        res.render('account/sorlogin');
    } else {
    if (!empty(request.triggeredForm) && request.triggeredForm.valid && request.triggeredForm.triggeredAction.triggered) {
        if (request.triggeredForm.register.triggered) {
                session.custom.TargetLocation = URLUtils.url('Cart-Show').toString();
                jsonResponse.url = URLUtils.url('Account-StartRegister').toString();
                jsonResponse.success = true;
        } else {
                jsonResponse.url = URLUtils.url('Cart-Show').toString();
                jsonResponse.success = logInCustomer(forms.sorlogin.username.value, forms.sorlogin.password.value, forms.sorlogin.rememberme.value);
        }
        res.json(jsonResponse);
        }
    }
    next();
});

/**
* Function that outputs resources, preferences, urls to sor_footer template
*/
server.use('Footer', function (req, res, next) {
    // Getting SOR resources, preferences and urls
    var resources   = sorHelper.getResources(),
        preferences = sorHelper.getPreferences(),
        urls        = sorHelper.getUrls();

    res.render('components/sor_footer', {
        resources   : resources,
        urls        : urls,
        preferences : preferences
    });
    next();
});

/**
 * Display SOR link in account page if SOR is enabled
 */
server.use('SORMenuLink', function (req, res, next) {
    var enabled = sorHelper.verifyLicense() && sorEnabled;
    res.render('account/sormenulink', {
        enabled: enabled,
        showCard: params.showcard.booleanValue
    });
    next();
});

// HELPER FUNCTIONS

/* customer login shim for SFCC*/
function logInCustomer(username, password, rememberMe) {
    var tempCustomer = CustomerMgr.getCustomerByLogin(username);
    var logedInCustomer = null;
    if (tempCustomer == null ||(tempCustomer !== null && tempCustomer.profile !== null && tempCustomer.profile.credentials.locked)) {
        return false;
    }
    Transaction.wrap(function () {
        logedInCustomer = CustomerMgr.loginCustomer(CustomerMgr.authenticateCustomer(username, password), rememberMe);
    });
    if (logedInCustomer == null || (logedInCustomer !== null && logedInCustomer.profile !== null && logedInCustomer.profile.credentials.locked)) {
        return false;
    } else {
        return true;
    }
}

/* Validate LogIn Middleware shim for SFCC*/
function validateLoggedIn(req, res, next) {
    if (!req.currentCustomer.profile) {
        session.custom.TargetLocation = URLUtils.url('SmartOrderRefillController-Manage').toString();
        res.redirect(URLUtils.url('Login-Show'));
    }
    next();
}

/**
 * Remove non active (canceled, expired, processed) lists
 */
function getActiveRefillLists(refillListInfo) {
    var PropertyComparator = require('dw/util/PropertyComparator');
    var ArrayList          = require('dw/util/ArrayList');
    var comparator         = new PropertyComparator('createdAt', false);
    var refillLists        = [];

    try {
        var lists = JSON.parse(refillListInfo) || [];
        for (var idx = lists.length - 1; idx >= 0; idx--) {
            if (lists[idx].status == sorConstants.STATUS.CANCELED || lists[idx].status == sorConstants.STATUS.EXPIRED || lists[idx].status == sorConstants.STATUS.PROCESSED) {
                lists.splice(idx, 1);
            }
        }
        refillLists = new ArrayList(lists);
        refillLists.sort(comparator);
    } catch (error) {
        Logger.error('Error parsing customer refill list. Error: {0}', error);
    }

    return refillLists;
}

module.exports = server.exports();
