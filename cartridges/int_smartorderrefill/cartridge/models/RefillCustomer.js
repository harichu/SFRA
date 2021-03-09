'use strict';
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
/**
 * This model is responsible for handling the Customer Refill inforamtion
 */
var Resource           = require('dw/web/Resource'),
    Transaction        = require('dw/system/Transaction'),
    HashMap            = require('dw/util/HashMap'),
    Calendar           = require('dw/util/Calendar'),
    URLUtils           = require('dw/web/URLUtils'),
    OrderMgr           = require('dw/order/OrderMgr'),
    Order              = require('dw/order/Order'),
    ProductMgr         = require('dw/catalog/ProductMgr'),
    CustomerMgr        = require('dw/customer/CustomerMgr'),
    sorConstants       = require('int_smartorderrefill/cartridge/scripts/SmartOrderRefillConstants.js'),
    paymentIntegration = require('int_smartorderrefill/cartridge/controllers/paymentIntegration/PaymentIntegration/'),
    sorHelper          = require('int_smartorderrefill/cartridge/scripts/SmartOrderRefillHelper.js'),
    URLParameter       = require('dw/web/URLParameter'),
    URLAction          = require('dw/web/URLAction'),
    siteID             = dw.system.Site.current.ID,
    SORLogger          = dw.system.Logger.getLogger('SORLogger', 'SORLogger');


var preferences       = null,
    customer          = null,
    ordersList        = [],
    subscriptionsList = [],
    currentDate       = new Date();

var METHOD_MERCADOPAGO_CREDIT = Resource.msg('payment.method.id', 'mercadoPagoPreferences', null);

/**
 * This function generates a JS representation of Smart Order Refill site preference values 
 * @param {dw.system.SitePreferences} preferences 
 */
function getPreferences(preferences) {
    var preferenceObject = {
        "SorEnabled"                   : preferences.custom.SorEnabled,
        "SorMonthsToCancelPaused"      : preferences.custom.SorMonthsToCancelPaused,
        "SorAutomaticRenewalEnabled"   : preferences.custom.SorAutomaticRenewalEnabled,
        "SorChangeProductPrice"        : preferences.custom.SorChangeProductPrice,
        "SorBillingDay"                : preferences.custom.SorBillingDay,
        "rescheduleOrderEnabled"       : preferences.custom.SorRescheduleOrder,
        "numberOfDelayDays"            : preferences.custom.SorNumberOfDelayDays,
        "notificationBeforeOrderDays"  : preferences.custom.SorNotificationBeforeOrderDays,
        "SorCancelPausedInNextOrder"   : preferences.custom.SorCancelPausedInNextOrder,
        "SorPriceBook"                 : preferences.custom.SorPriceBook
    }
    return preferenceObject;
}

/**
 * This function is responsible for removing all orders from a subscription except the ones that have status procesed and canceled 
 * @param {String} subscriptionID 
 */
function cleanOrders(subscriptionID) {
    for (var i = ordersList.length - 1; i >= 0; i--) {
        if (ordersList[i].status != sorConstants.STATUS.PROCESSED && ordersList[i].status != sorConstants.STATUS.CANCELED && ordersList[i].subscriptionID == subscriptionID) {
            ordersList.splice(i, 1);
        }
    }

    if (!ordersList) {
        ordersList = [];
    }
}

/**
 * This function is responsible for generating a list of a subscription active orders
 * @param {String} subscriptionID 
 */
function getActiveOrders(subscriptionID) {
    var tempList = [];
    for (var i = ordersList.length - 1; i >= 0; i--) {
        if (ordersList[i].status != sorConstants.STATUS.PROCESSED && ordersList[i].status != sorConstants.STATUS.CANCELED && ordersList[i].subscriptionID == subscriptionID) {
            tempList.push(ordersList[i]);
        }
    }

    return tempList;
}

/**
 * This function is responsible for retriving all the active subscriptions of a customer
 */
function getActiveSubscriptions() {
    for (var i = subscriptionsList.length - 1; i >= 0; i--) {
        if (subscriptionsList[i].status == sorConstants.STATUS.CANCELED || subscriptionsList[i].status == sorConstants.STATUS.EXPIRED) {
            subscriptionsList.splice(i, 1);
        }
    }

    if (!subscriptionsList) {
        subscriptionsList = [];
    }
}

/**
 * This function is responsible for creating retriving array index of a refill object
 * @param {Object[]} list 
 * @param {String} item 
 */
function getIndexOfId(list, item) {
    return list.map(function(e) {
        return e.ID;
    }).indexOf(item);
}

/**
 * This function is responsible for saving the subscription list to the customer profile
 */
function saveSubscriptions() {
    customer.profile.custom.SorSubscriptions = JSON.stringify(subscriptionsList);
}

/**
 * This function is responsible for saving the orders list to the customer profile
 */
function saveOrders() {
    customer.profile.custom.SorOrders = JSON.stringify(ordersList);
}

/**
 * This function is responsible for setting the active Smart Order Refill status of a customer
 */
function defineSOR() {
    var hasSor = false;

    for each (var order in ordersList) {
        if (order.type == sorConstants.TYPE.SOR && order.status != sorConstants.STATUS.CANCELED && order.status != sorConstants.STATUS.PROCESSED) {
            hasSor = true;
            break;
        }
    }

    customer.profile.custom.hasSmartOrderRefill = hasSor;
}

/**
 * This function is responsible for retriving a customer subscription by ID
 * @param {String} subscriptionId 
 */
function getSubscription(subscriptionId) {
    var idx = getIndexOfId(subscriptionsList, subscriptionId),
        tempSubscription = null;
    if (idx != -1) {
        tempSubscription = subscriptionsList[idx];
    }
    return tempSubscription;
}

/**
 * Sets a subscription data into the global subscription array, so that its data can be saved.
 * @param {Object} subscription A subscription to set in the array.
 */
function setSubscription(subscription) {
    var index = getIndexOfId(subscriptionsList, subscription.ID);
    subscriptionsList[index] = subscription;
}

/**
 * his function is responsible for retriving a customer order by ID
 * @param {String} orderId 
 */
function getOrder(orderId) {
    var idx = getIndexOfId(ordersList, orderId),
        tempOrder = null;
    if (idx != -1) {
        tempOrder =  ordersList[idx];
    }
    return tempOrder;
}

/**
 * This function is responsible for generating the list of refill orders for a customer subscription
 * @param {Object[]} subscriptionList 
 * @param {Object[]} products 
 * @param {Number} count 
 */
function createScheduledOrders(subscriptionList, products, count) {
    var orderProducts            = products || subscriptionList.products,
        productsInDifferentOrder = [],
        ccExpDate                = new Calendar(new Date(subscriptionList.cardExpirationDate)),
        mainOrder                = {
            subscriptionID : subscriptionList.ID,
            originalOrder  : subscriptionList.originalOrder,
            type           : subscriptionList.type,
            customerNo     : customer.profile.customerNo,
            status         : sorConstants.STATUS.SCHEDULED,
            notified       : false,
            products       : [],
            zoneId         : subscriptionList.zoneId
        };

    if (!empty(subscriptionList.geolocation)) {
        mainOrder.geolocation = {
            lat : subscriptionList.geolocation.lat,
            lng : subscriptionList.geolocation.lng
        }
    }

    if (subscriptionList.creditCardToken) {
        mainOrder.creditCardToken = subscriptionList.creditCardToken;
    }

    // Prepare the list of products will be in each order
    for each (var prod in orderProducts) {
        if (mainOrder.products.indexOf(prod) == -1) {
            if (subscriptionList.type == sorConstants.TYPE.SOR) {
                if (mainOrder.products.length == 0) {
                    mainOrder.periodicity = prod.periodicity;
                    mainOrder.interval = prod.interval;
                    mainOrder.orderDay = prod.orderDay;
                }
                mainOrder.products.push(prod);
            } else {
                if (mainOrder.products.length == 0) {
                    mainOrder.orderDay = prod.orderDay;
                    mainOrder.canChangeProduct = prod.canChangeProduct
                    mainOrder.products.push(prod);
                } else {
                    if (mainOrder.orderDay == prod.orderDay && mainOrder.canChangeProduct == prod.canChangeProduct) {
                        mainOrder.products.push(prod);
                    } else {
                        productsInDifferentOrder.push(prod);
                    }
                }
            }
        }
    }

    var latestValidity = new Date();
    var orderCounter   = 0;
    for (var productKey in mainOrder.products) {
        var product        = mainOrder.products[productKey];
        var orderCalendar  = new Calendar(new Date());
        var orderDate      = orderCalendar.getTime();
        var expiredOrder   = false;
        var productCounter = 0;
        var threshold      = product.periodicity === sorConstants.PERIODICITY.WEEK ? product.sorWeekInterval : product.sorMonthInterval;

        while (productCounter < threshold) {
            orderCounter++;
            var order       = JSON.parse(JSON.stringify(mainOrder));
            order.ID        = subscriptionList.ID + '-' + sorHelper.dateToStr(orderDate, '-') + ((count) ? '.' + count : '') + '.' + orderCounter;
            order.createdAt = orderDate;
            order.products  = [product];
            if (order.createdAt.getTime() > latestValidity.getTime()) {
                latestValidity = order.createdAt;
            }

            if (!expiredOrder && ccExpDate.compareTo(orderCalendar) < 0) {
                expiredOrder = (subscriptionList.type == sorConstants.TYPE.SOR);
            }

            if (expiredOrder) {
                order.status = sorConstants.STATUS.CCEXPIRED,
                delete order.creditCardToken;
            }

            var curentDateBegin = currentDate;
            curentDateBegin.setHours(0,0,0,0);
            orderDate.setHours(0,0,0,0);
            if (orderDate.getTime() >= curentDateBegin.getTime() && empty(getOrder(order.ID))) {
                ordersList.push(order);
            }

            orderCalendar = new Calendar(orderDate);
            if (subscriptionList.type == sorConstants.TYPE.SOR) {
                if (product.periodicity == sorConstants.PERIODICITY.WEEK) {
                    orderCalendar.add(Calendar.DAY_OF_MONTH, 7);
                } else {
                    orderCalendar.add(Calendar.MONTH, 1);
                }
            } else {
                orderCalendar.add(Calendar.MONTH, 1);
            }

            orderDate = orderCalendar.getTime();
            productCounter++;
        }
    }

    subscriptionsList.validUntil = latestValidity;
    saveSubscriptions();
    saveOrders();

    Transaction.wrap(function () {
        defineSOR();
    });
}

/**
 * This function is responsible for determening if the order is the last order of a subscription
 * @param {String} orderID 
 */
function isLastOrder (orderID) {
    var tempOrder = getOrder(orderID);
    var subscriptionID = tempOrder.subscriptionID;
    var tempList;
    
    var ret = {
        status: false,
        message: ""
    }
    
    tempList = getActiveOrders(tempOrder.subscriptionID);
    
    if (tempList.length <= 1) {
        ret.status = true;
        ret.message = Resource.msg('smartorderrefill.lastordercheck', 'smartorderrefill', null);
    }

    return ret;
}

/**
 * This function is responsible for setting order status and sending the coresponding email notification message
 * @param {Object} args 
 */
function manageOrder(args) {
    var tempOrder = getOrder(args.orderId),
        newStatus = args.newStatus;
        map       = new HashMap();

    if (tempOrder) {
        var subProp;

        switch (newStatus) {
            case sorConstants.STATUS.PAUSED:
                subProp  = 'sor.mail.pauseorder.subject';
                map.put('topcontent', Resource.msgf('sor.mail.pauseorder.topcontent', 'mail', null, new Date(tempOrder.createdAt).toDateString(), sorHelper.strOfProducts(tempOrder.products)));
                break;

            case sorConstants.STATUS.CANCELED:
                map.put('topcontent', Resource.msgf('sor.mail.cancelorder.topcontent', 'mail', null, new Date(tempOrder.createdAt).toDateString()));
                map.put('products', tempOrder.products);
                subProp  = 'sor.mail.cancelorder.subject';
                break;

            case 'reactivate':
                newStatus = sorConstants.STATUS.SCHEDULED;

                subProp  = 'sor.mail.reactivateorder.subject';
                map.put('topcontent', Resource.msgf('sor.mail.reactivateorder.topcontent', 'mail', null, new Date(tempOrder.createdAt).toDateString(), sorHelper.strOfProducts(tempOrder.products)));
                map.put('products', tempOrder.products);
                break;
        }

        tempOrder.status = newStatus;
        tempOrder.lastUpdate = new Date();
        Transaction.wrap(function() {
            saveOrders();
        });

        if (args.skipEmail) {
            return true;
        }
        var subject = Resource.msg(subProp, 'mail', null);
        map.put('subject', subject);
        map.put('customerName', customer.profile.firstName);
        map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
        sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
    }

    return true;
}

/**
 * This function is responsible for changing the subscription status to paused,
 *  removing its scheduled order from the customer profile and sending the notification email to the customer
 * @param {String} subscriptionId 
 */
function pauseSubscription(subscriptionId) {
    var tempSubscription = getSubscription(subscriptionId),
        ret = {error: false};

    if (!tempSubscription) return false;

    if (tempSubscription.type == sorConstants.TYPE.SOR) {
        tempSubscription.status = sorConstants.STATUS.PAUSED;
        tempSubscription.lastUpdate = new Date();

        cleanOrders(tempSubscription.ID);

        var map       = new HashMap(),
            subject   = Resource.msg('sor.mail.pausesubscription.subject', 'mail', null),
            cancelIntervalProp = (preferences.SorMonthsToCancelPaused > 1 ? 'sor.mail.months'  : 'sor.mail.month'),
            monthsToCancelPaused = preferences.SorMonthsToCancelPaused > 1 ? preferences.SorMonthsToCancelPaused : 12;
        
        map.put('topcontent', Resource.msgf('sor.mail.pausesubscription.topcontent', 'mail', null, sorHelper.strOfProducts(tempSubscription.products), Resource.msgf(cancelIntervalProp, 'mail', null, monthsToCancelPaused)));
        map.put('sorConstants', sorConstants)
        map.put('subject', subject);
        map.put('isSubscription', true);
        map.put('customerName', customer.profile.firstName);
        sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');

        Transaction.wrap(function () {
            saveSubscriptions();
            saveOrders();
            customer.profile.custom.hasStandBySubscriptions = true;
            defineSOR();
        });
    }

    return ret;
}

/**
 * This function is responsible for retriving information required for displaying the reactivate choice message 
 * @param {String} subscriptionId 
 */
function reactivateSubscriptionStart(subscriptionId) {
    var tempSubscription = getSubscription(subscriptionId);

    var allProductsAvailable = sorHelper.getProductItemsAvailability(tempSubscription),
        createdAt            = new Date(),
        validUntil           = new Calendar(createdAt),
        priceChanges;

    if (preferences.SorChangeProductPrice) {
        priceChanges = sorHelper.getProductPricesChanges(tempSubscription);
    }

    validUntil.add(Calendar.YEAR, 1);
    var oneYear = validUntil.getTime();

    return {
        ContinueURL   : URLUtils.https('SmartOrderRefillController-ManageRefillList', 'sid', subscriptionId, 'action', 'reactivate', 'available', allProductsAvailable),
        Available     : allProductsAvailable,
        RemainingDate : tempSubscription.validUntil,
        OneYearDate   : oneYear.toDateString(),
        PriceChanges  : priceChanges
    };
}

/**
 * This function is responsible for reactivating the subscription, recreating the refill orders and sending the notification email
 * @param {String} subscriptionId 
 * @param {Number} remaining 
 */
function reactivateSubscriptionFinish(subscriptionId, remaining) {
    var tempSubscription = getSubscription(subscriptionId);

    if (remaining) {
        tempSubscription.status = sorConstants.STATUS.UPDATED;
        tempSubscription.lastUpdate = new Date();

        var diff = sorHelper.dateDiffInDays(tempSubscription.lastUpdate, tempSubscription.lastRefillDate);

        if (diff < 0) {
            var lastRefill = new Date(tempSubscription.lastRefillDate),
                today      = new Date();

            lastRefill.setMonth(today.getMonth());
            lastRefill.setFullYear(today.getFullYear());
            tempSubscription.lastRefillDate = lastRefill;
        }
    } else {
        var createdAt  = new Date(),
        validUntil = new Calendar(createdAt);

        validUntil.add(Calendar.YEAR, 1);
        tempSubscription.status = sorConstants.STATUS.NEW;
        tempSubscription.createdAt = createdAt;
        tempSubscription.lastRefillDate = createdAt;
        tempSubscription.validUntil = validUntil.getTime();
    }

    var map     = new HashMap(),
        subject = Resource.msg('sor.mail.reactivatesubscription.subject', 'mail', null);

    map.put('topcontent', Resource.msgf('sor.mail.reactivatesubscription.topcontent', 'mail', null, sorHelper.strOfProducts(tempSubscription.products)));
    map.put('sorConstants', sorConstants)
    map.put('subject', subject);
    map.put('isSubscription', true);
    map.put('customerName', customer.profile.firstName);
    map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
    sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');

    Transaction.wrap(function() {
        saveSubscriptions();
        customer.profile.custom.hasStandBySubscriptions = false;
        createScheduledOrders(tempSubscription);
    });
}

/**
 * This function is responsible for updating a subscription product price
 * @param {String} subscriptionId 
 */
function setNewPrices(subscriptionId) {
    var tempSubscription = getSubscription(subscriptionId);

    var priceChanges = sorHelper.getProductPricesChanges(tempSubscription);
    for each(var prod in priceChanges.products) {
        var prodIdx = sorHelper.getIndexOfId(tempSubscription.products, prod.ID);
        if (prodIdx != -1) {
            tempSubscription.products[prodIdx].price = prod.newPrice.toString();
        }
    }
}

/**
 * This function is responsible for canceling all of a subscriptions remaining orders
 * @param {String} subscriptionID 
 */
function cancelAllOrders(subscriptionID) {
    for each (var order in ordersList) {
        if (order.status != sorConstants.STATUS.CANCELED) {
            if (subscriptionID && subscriptionID.length > 0 && order.subscriptionID != subscriptionID) {
                continue;
            }
            order.status = sorConstants.STATUS.CANCELED;
            order.lastUpdate = new Date();
        }
    }

    Transaction.wrap(function() {
        saveOrders();
        defineSOR();
    });

    return true;
}

/**
 * This function is responsible for canceling a customer subscription and optionaly sending a notification message
 * @param {String} subscriptionId 
 * @param {Boolean} skipEmail 
 */
function cancelSubscription(subscriptionId, skipEmail) {
    try {
        var tempSubscription = getSubscription(subscriptionId);

        if (tempSubscription) {
            tempSubscription.status = sorConstants.STATUS.CANCELED;
            tempSubscription.lastUpdate = new Date();
            Transaction.wrap(function() {
                saveSubscriptions();
            });

            cancelAllOrders(subscriptionId);
            if (skipEmail) {
                return true;
            }
            var map     = new HashMap(),
                subject = Resource.msg('sor.mail.cancelsubscription.subject', 'mail', null);

            map.put('topcontent', Resource.msg('sor.mail.cancelsubscription.topcontent', 'mail', null));
            map.put('sorConstants', sorConstants)
            map.put('subject', subject);
            map.put('isSubscription', true);
            map.put('customerName', customer.profile.firstName);
            sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
        }
    } catch (e) {
        return false;
    }
    return true;
}

/**
 * This function is responsible for seting the renewal status of a subscription to canceled
 * @param {String} subscriptionId 
 */
function cancelRenewal(subscriptionId) {
    var tempSubscription = getSubscription(subscriptionId),
        ret = {error: false};

    if (tempSubscription) {
        tempSubscription.renewal = false;
        tempSubscription.status = sorConstants.STATUS.UPDATED;
        tempSubscription.lastUpdate = new Date();
        Transaction.wrap(function() {
            saveSubscriptions();
        });
    }

    return ret;
}

/**
 * This function detrmines if a subscription or order is eligible for customer cancelation
 * this is to ensure that a customer commitment will be fulfilled 
 * @param {String} type 
 * @param {String} id 
 * @param {String} item 
 */
function checkBeforeCancel(type, id, item) {
    var ret = {
        status  : true,
        message : ""
    };

    switch (type) {
        case "order" : {
            var tempOrder         = getOrder(id),
                orderSubscription = getSubscription(tempOrder.subscriptionID),
                futureProductOrders, productCommitment;

            for each (var product in tempOrder.products) {
                productCommitment = 0;
                for each (var tempProduct in orderSubscription.products) {
                    if (tempProduct.ID == product.ID) {
                        if (tempProduct.commitment) {
                            productCommitment = tempProduct.commitment - tempProduct.commitmentDone;
                        }
                        break;
                    }
                }

                if (productCommitment <= 0) continue;

                futureProductOrders = 0;
                for each (var order in ordersList) {
                    for each (tempProduct in order.products) {
                        if (order.subscriptionID == orderSubscription.ID
                            && product.ID == tempProduct.ID
                            && order.status != sorConstants.STATUS.CANCELED
                            && order.status != sorConstants.STATUS.PROCESSED) {
                            futureProductOrders += 1;
                        }
                    }
                }

                if (productCommitment >= futureProductOrders) {
                    var productName = ProductMgr.getProduct(product.ID).name;
                    ret.status = false;
                    ret.message = "Product " + productName + " needs " + productCommitment + " more completed orders.";
                }
            }
        } break;

        case "subscription" : {
            var tempSubscription = getSubscription(id);

            for each (var product in tempSubscription.products) {
                if (item && item != product.ID) continue;

                if (product.commitment && product.commitment > product.commitmentDone) {
                    var productName = ProductMgr.getProduct(product.ID).name;
                    ret.status = false;
                    ret.message = "Product " + productName + " has commitment " + product.commitmentDone + "/" + product.commitment;
                    break;
                }
            }
        } break;

        case "all" : {
            var tempStatus;
            for each (var tempSubscription in subscriptionsList) {
                tempStatus = checkBeforeCancel("subscription", tempSubscription.ID);
                if (!tempStatus.status) {
                    ret.status = false;
                    ret.message = tempStatus.message;
                    break;
                }
            }
        } break;
    }

    return ret;
}

/**
 * This function generates a view of all customer active subscriptions 
 */
function viewCustomerSubscriptions() {
    getActiveSubscriptions();

    return {
        SubscriptionsList : subscriptionsList,
        Client            : customer.profile
    }
}

/**
 * This function retrives inforamtion regarding a customer subscription
 * @param {String} subscriptionId 
 */
function viewSubscription(subscriptionId) {
    var tempSubscription = getSubscription(subscriptionId),
        ret = {error: false};

    if (empty(tempSubscription)) {
        var tempOrder = getOrder(subscriptionId)
        var subscriptionId = tempOrder.subscriptionID
        var tempSubscription = getSubscription(subscriptionId)
    }

    if (tempSubscription) {
        var currentCreditCard = sorHelper.getCreditCardInformation(tempSubscription),
            paymentMethod      = dw.order.PaymentMgr.getPaymentMethod(METHOD_MERCADOPAGO_CREDIT),
            paymentProcessorID = paymentMethod.getPaymentProcessor().getID(),
            paymentIntegration = require('int_smartorderrefill/cartridge/controllers/paymentIntegration/PaymentIntegration/'), 
            activeOrdersList;
        
        activeOrdersList = getActiveOrders(subscriptionId);
            
        return {
            CustomerNo        : customer.profile.customerNo,
            ordersList        : activeOrdersList,
            hasProcessor      : (paymentIntegration[paymentProcessorID]),
            currentCustomer   : customer,
            ProductList       : tempSubscription,
            viewType          : sorConstants.VIEWTYPE.SUBSCRIPTION,
            currentCreditCard : currentCreditCard
        }
    }
    return ret;
}

/**
 * This function retrives inforamtion regarding a customer refill order
 * @param {String} orderId 
 */
function viewOrder(orderId) {
    var tempOrder        = getOrder(orderId),
        tempSubscription = getSubscription(tempOrder.subscriptionID),
        ret = {error: false};

    if (tempOrder) {
        if (empty(tempOrder['billingAddress'])) {
            tempOrder.billingAddress = tempSubscription['billingAddress'];
        }

        if (empty(tempOrder['shippingAddress'])) {
            tempOrder.shippingAddress = tempSubscription['shippingAddress'];
        }
    }

    if (tempOrder) {
        return {
            ProductList : tempOrder,
            viewType    : sorConstants.VIEWTYPE.ORDER
        };
    }
    return ret;
}

/**
 * This function is responsible for updating the quantity of a subscription product and all of its scheduled orders products
 * @param {String} subscriptionId 
 * @param {String} productID 
 * @param {Number} quantity 
 */
function changeSubscriptionProductQtd(subscriptionId, productID, quantity) {
    var tempSubscription = getSubscription(subscriptionId),
        ret = {error: false};

    if (tempSubscription) {
        tempSubscription.status = sorConstants.STATUS.UPDATED;
        tempSubscription.lastUpdate = new Date();

        var prodIdx = sorHelper.getIndexOfId(tempSubscription.products, productID);

        if (prodIdx != -1) {
            tempSubscription.products[prodIdx].quantity = quantity;
            for each (var order in ordersList) {
                if (order.subscriptionID == tempSubscription.ID && order.status != sorConstants.STATUS.CANCELED && order.status != sorConstants.STATUS.PROCESSED) {
                    var ordIdx = sorHelper.getIndexOfId(order.products, productID);
                    if (ordIdx != -1) {
                        order.products[ordIdx].quantity = quantity;
                        if (order.status != sorConstants.STATUS.CCEXPIRED) {
                            order.status = sorConstants.STATUS.UPDATED;
                        }
                        order.lastUpdate = new Date();
                    }
                }
            }
            Transaction.wrap(function () {
                saveSubscriptions();
                saveOrders();
            });

        }
        return ret;
    }
}

/**
 * This function is responsible for updating the ID of a subscription product and all of its scheduled orders products
 * @param {String} subscriptionId 
 * @param {String} productID 
 * @param {String} newProductID 
 */
function changeSubscriptionProductId(subscriptionId, productID, newProductID) {
    var tempSubscription = getSubscription(subscriptionId),
        ret = {error: false};

    if (tempSubscription) {
        tempSubscription.status = sorConstants.STATUS.UPDATED;
        tempSubscription.lastUpdate = new Date();

        var prodIdx = sorHelper.getIndexOfId(tempSubscription.products, productID);
        var newProductPrice  = ProductMgr.getProduct(newProductID).getPriceModel(),
            newPrice         = newProductPrice.price.value,
            newCurrency      = newProductPrice.price.currencyCode
        if (prodIdx != -1) {
            tempSubscription.products[prodIdx].ID = newProductID;
            tempSubscription.products[prodIdx].price = newPrice;
            tempSubscription.products[prodIdx].currencyCode = newCurrency;
            for each (var order in ordersList) {
                if (order.subscriptionID == tempSubscription.ID && order.status != sorConstants.STATUS.CANCELED && order.status != sorConstants.STATUS.PROCESSED) {
                    var ordIdx = sorHelper.getIndexOfId(order.products, productID);
                    if (ordIdx != -1) {
                        order.products[ordIdx].ID = newProductID;
                        order.products[ordIdx].price =  newPrice;
                        order.products[ordIdx].currencyCode = newCurrency;
                        if (order.status != sorConstants.STATUS.CCEXPIRED) {
                            order.status = sorConstants.STATUS.UPDATED;
                        }
                        order.lastUpdate = new Date();
                    }
                }
            }
            Transaction.wrap(function () {
                saveSubscriptions();
                saveOrders();
            });

        }
        return ret;
    }
}

/**
 * This function is responsible for updating the ID of a refill order product
 * @param {String} orderId 
 * @param {String} productID 
 * @param {String} newProductID 
 */
function changeOrderProductId(orderId, productID, newProductID) {
    var tempOrder = getOrder(orderId),
        ret = {error: false};

    if (tempOrder) {
        tempOrder.status = sorConstants.STATUS.UPDATED;
        tempOrder.lastUpdate = new Date();

        var prodIdx = sorHelper.getIndexOfId(tempOrder.products, productID);
        var newPrice = ProductMgr.getProduct(newProductID).getPriceModel().price.value
        var newCurrency = ProductMgr.getProduct(newProductID).getPriceModel().price.currencyCode
        if (prodIdx != -1) {
            tempOrder.products[prodIdx].ID = newProductID;
            tempOrder.products[prodIdx].price = newPrice;
            tempOrder.products[prodIdx].currencyCode = newCurrency;
            Transaction.wrap(function () {
                saveOrders();
            });
        }
        return ret;
    }
}

/**
 * This function is responsible for updating the quantity of a refill order product
 * @param {String} orderId 
 * @param {String} productID 
 * @param {Number} quantity 
 */
function changeOrderProductQtd(orderId, productID, quantity) {
    var tempOrder = getOrder(orderId),
        ret = {error: false};

    if (tempOrder) {
        var prodIdx = sorHelper.getIndexOfId(tempOrder.products, productID);

        if (prodIdx != -1) {
            tempOrder.status = sorConstants.STATUS.UPDATED;
            tempOrder.lastUpdate = new Date();
            tempOrder.products[prodIdx].quantity = quantity;

            Transaction.wrap(function () {
                saveOrders();
            });
        }
    }
    return ret;
}

/**
 * This function is responsible for removing a refill order product
 * @param {String} orderId 
 * @param {String} productID 
 */
function removeOrderProduct(orderId, productID) {
    var tempOrder = getOrder(orderId),
        ret = {error: false};

    if (tempOrder) {
        if (tempOrder.products.length === 1) {
            manageOrder({
                orderId   : orderId,
                newStatus : sorConstants.STATUS.CANCELED
            });
        } else {
            var prodIdx = sorHelper.getIndexOfId(tempOrder.products, productID);

            if (prodIdx != -1) {
                tempOrder.products.splice(prodIdx, 1);
                tempOrder.status = sorConstants.STATUS.UPDATED;
                tempOrder.lastUpdate = new Date();

                Transaction.wrap(function () {
                    saveOrders();
                });
            }
        }
    }

    return ret;
}

/**
 * This function is responsible for removing a subscription product, updating all scheduled orders and optionaly send a notification email to the customre
 * @param {*} subscriptionId 
 * @param {*} productID 
 * @param {*} skipEmail 
 */
function removeSubscriptionProduct(subscriptionId, productID, skipEmail) {
    var tempSubscription = getSubscription(subscriptionId),
        ret = {error: false};

    if (tempSubscription) {
        if (tempSubscription.products.length === 1) {
            cancelSubscription(subscriptionId, skipEmail);
        } else {
            var prodIdx = sorHelper.getIndexOfId(tempSubscription.products, productID);

            if (prodIdx != -1) {
                tempSubscription.products.splice(prodIdx, 1);
                tempSubscription.status = sorConstants.STATUS.UPDATED;
                tempSubscription.lastUpdate = new Date();

                cleanOrders(subscriptionId);

                Transaction.wrap(function () {
                    saveSubscriptions();
                    saveOrders();
                    createScheduledOrders(tempSubscription);
                });

            }
        }
    }

    return ret;
}

/**
 * Function is responsible for retriving information about reill order address
 * @param {String} orderId 
 * @param {String} addressType 
 */
function updateOrderAddressStart(orderId, addressType) {
    var addressType      = addressType,
        addressAttribute = addressType + 'Address',
        addressObj       = {},
        tempOrder        = getOrder(orderId),
        tempSubscription = getSubscription(tempOrder.subscriptionID);

    if (!empty(tempOrder[addressAttribute])) {
        addressObj = tempOrder[addressAttribute];
    } else {
        addressObj = tempSubscription[addressAttribute];
    }

    return addressObj;
}
/**
 * Function is responsible for retriving information about subscription address
 * @param {String} subscriptionId 
 * @param {String} addressType 
 */
function updateSubscriptionAddressStart(subscriptionId, addressType) {
    var addressType      = addressType,
        addressAttribute = addressType + 'Address',
        tempSubscription = getSubscription(subscriptionId);

    return tempSubscription[addressAttribute];
}

/**
 * Function is responsible for setting the address values 
 * @param {dw.web.FormElement} addressForm 
 * @param {Object[]} list 
 * @param {String} addressAttribute 
 */
function updateAddress(addressForm, list, addressAttribute) {
    var addressObj = {
        address1    : addressForm.address1.htmlValue,
        address2    : addressForm.address2.htmlValue,
        city        : addressForm.city.htmlValue,
        countryCode : {value: addressForm.country.htmlValue},
        firstName   : addressForm.firstName.htmlValue,
        fullName    : addressForm.firstName.htmlValue + ' ' + addressForm.lastName.htmlValue,
        lastName    : addressForm.lastName.htmlValue,
        phone       : addressForm.phone.htmlValue,
        stateCode   : addressForm.states.state.htmlValue
    };

    if (!empty(addressForm.postal)) {
        addressObj.postalCode = addressForm.postal.htmlValue;
    }

    list[addressAttribute] = addressObj;
}

/**
 * Function is responsible for saving the modified address information of the refill order
 * @param {String} orderId 
 * @param {dw.web.FormElement} formData 
 * @param {String} addressType 
 */
function updateOrderAddressFinish(orderId, formData, addressType) {
    var tempOrder = getOrder(orderId),
        addressTypeValue = addressType,
        ret = {error: false};

    addressType += 'Address';

    updateAddress(formData, tempOrder, addressType);
    tempOrder.status = sorConstants.STATUS.UPDATED;
    tempOrder.lastUpdate = new Date();

    Transaction.wrap(function() {
        saveOrders();
    });

    sendAddressChangeEmail(addressTypeValue, tempOrder, 'order')
    return ret;
}

/**
 * Function is responsible for saving the modified address information of the subscription
 * @param {*} subscriptionId 
 * @param {*} formData 
 * @param {*} addressType 
 */
function updateSubscriptionAddressFinish(subscriptionId, formData, addressType) {
    var tempSubscription = getSubscription(subscriptionId),
        addressTypeValue = addressType,
        ret = {error: false};

    addressType += 'Address';

    updateAddress(formData, tempSubscription, addressType);
    tempSubscription.status = sorConstants.STATUS.UPDATED;
    tempSubscription.lastUpdate = new Date();

    for each (var order in ordersList) {
        if (order.subscriptionID == subscriptionId && order.status != sorConstants.STATUS.CANCELED && order.status != sorConstants.STATUS.PROCESSED) {
            order.status = sorConstants.STATUS.UPDATED;
            order.lastUpdate = new Date();
            updateAddress(formData, order, addressType);
        }
    }
    sendAddressChangeEmail(addressTypeValue, tempSubscription, 'subscription')
    Transaction.wrap(function() {
        saveSubscriptions();
        saveOrders();
    });

    return ret;
}

/**
 * Function is responsible for sending address change customer notification email
 * @param {String} addressType 
 * @param {Object} refillList 
 * @param {String} refillListType 
 */
function sendAddressChangeEmail(addressType, refillList, refillListType) {
    var addressTypeValue = Resource.msg('sor.mail.addresstype.'+ addressType, 'mail', null)
    var map     = new HashMap(),
        subject = Resource.msgf('sor.mail.changeaddress.subject', 'mail', null, addressTypeValue);

    map.put('topcontent', Resource.msgf('sor.mail.changeaddress.topcontent.' + refillListType, 'mail', null, addressTypeValue, sorHelper.strOfProducts(refillList.products),  new Date(refillList.createdAt).toDateString()));
    map.put('bottomcontent', Resource.msg('sor.mail.changeaddress.bottomcontent', 'mail', null));
    map.put('address', refillList[addressType + 'Address']);
    map.put('sorConstants', sorConstants)
    map.put('subject', subject);
    map.put('customerName', customer.profile.firstName);
    map.put('button', {
        text : Resource.msg('sor.mail.managerefill.button.name', 'mail', null),
        link : URLUtils.https(new URLAction('SmartOrderRefillController-Manage', siteID))
    });
    sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
}

/**
 * Function is responsible for updating the  subscription refill interval
 * @param {String} subscriptionId 
 * @param {String} item 
 * @param {String} periodicity 
 * @param {Number} interval 
 */
function updateRefill(subscriptionId, item, periodicity, interval) {
    var tempSubscription = getSubscription(subscriptionId);
    var now              = new Date();
    var ret              = {error: false};

    if (tempSubscription) {
        var prodIdx = getIndexOfId(tempSubscription.products, item);

        if (prodIdx != -1) {
            tempSubscription.products[prodIdx].periodicity = periodicity;
            tempSubscription.products[prodIdx].interval = interval;
            tempSubscription.status = sorConstants.STATUS.UPDATED;
            tempSubscription.lastUpdate = now;
            if (periodicity === sorConstants.PERIODICITY.WEEK) {
                tempSubscription.products[prodIdx].sorWeekInterval = interval;
            } else {
                tempSubscription.products[prodIdx].sorMonthInterval = interval;
            }
            setSubscription(tempSubscription);

            cleanOrders(subscriptionId);
            Transaction.wrap(function () {
                saveOrders();
                saveSubscriptions();
                createScheduledOrders(tempSubscription);
            });
        }
    }

    return ret;
}

/**
 * Function is responsible for retriving the subscription creditcard inforamtion
 * @param {String} subscriptionId 
 */
function updateCreditCardStart(subscriptionId) {
    var currentCountry = sorHelper.getCurrentCountry(request.locale)

    var tempSubscription       = getSubscription(subscriptionId),
        applicablePaymentCards = dw.order.PaymentMgr.getPaymentMethod(METHOD_MERCADOPAGO_CREDIT).getApplicablePaymentCards(customer, currentCountry.countryCode, 0),
        currentCreditCard      = sorHelper.getCreditCardInformation(tempSubscription),
        canUpdateAll           = false,
        expMonth, expYear;

    if (currentCreditCard && currentCreditCard.expMonth && currentCreditCard.expYear) {
        expMonth = currentCreditCard.expMonth;
        expYear  = currentCreditCard.expYear;
        canUpdateAll = true;
    } else {
        var expDate = new Date(tempSubscription.cardExpirationDate);

        expMonth = (expDate.getMonth() + 1).toString();
        expYear  = expDate.getFullYear().toString();
    }

    return creditCardInfo = {
        currentCountry          : currentCountry,
        applicablePaymentCards  : applicablePaymentCards,
        number                  : currentCreditCard.number,
        type                    : currentCreditCard.type,
        canUpdateAll            : canUpdateAll,
        expMonth                : expMonth,
        expYear                 : expYear
    }
}

/**
 * Function is responsible for saving the updated credit card inforamtion 
 * @param {String} subscriptionId 
 * @param {dw.web.FormElement} forms 
 */
function updateCreditCardFinish(subscriptionId, forms) {
    var tempSubscription = getSubscription(subscriptionId);

    if (!tempSubscription) return false;

    var newSubscriptionID = sorHelper.updateCreditCardInformation(forms.updatecard, tempSubscription);

    if (newSubscriptionID) {
        var newYear            = parseInt(forms.updatecard.expiration.year.value),
            newMonth           = parseInt(forms.updatecard.expiration.month.htmlValue) - 1,
            cardExpirationDate = new Date(newYear, newMonth, 1),
            lastDayOfMonth     = new Calendar(cardExpirationDate);

        lastDayOfMonth.set(Calendar.DAY_OF_MONTH, lastDayOfMonth.getActualMaximum(Calendar.DAY_OF_MONTH));
        cardExpirationDate = lastDayOfMonth.getTime();

        tempSubscription.cardExpirationDate = cardExpirationDate;
        tempSubscription.creditCardToken = newSubscriptionID;
        tempSubscription.status = sorConstants.STATUS.UPDATED;
        tempSubscription.lastUpdate = new Date();

        cleanOrders(subscriptionId);

        Transaction.wrap(function () {
            saveSubscriptions();
            saveOrders();
            createScheduledOrders(tempSubscription);
        });
    }

}

/**
 * Function is responsible for generating a new subscription based on the Storefront order
 * @param {dw.order.Order} order 
 */
function createSmartOrderRefillSubscription(order) {
    var subscriptionList = {},
        count            = 1;
    
    var paymentMethod      = dw.order.PaymentMgr.getPaymentMethod(METHOD_MERCADOPAGO_CREDIT),
        orderAddress       = order.shipments[0].shippingAddress,
        paymentProcessorID = paymentMethod.getPaymentProcessor().getID();
    
    if (!paymentIntegration[paymentProcessorID].CheckInitialPaymentApproval(order)) {
        return false;
    }

    for each (var shipment in order.shipments) {
        var createdAt  = new Date(),
            validUntil = new Calendar(createdAt);

        var firstProduct   = order.getAllProductLineItems().toArray()[0];
        var isWeekly       = firstProduct.custom.SorPeriodicity == sorConstants.PERIODICITY.WEEK;
        var daysSpan       = isWeekly ? 7 : 30;
        var amountOfOrders = isWeekly ? firstProduct.custom.SorWeekInterval : firstProduct.custom.SorMonthInterval;
        validUntil.add(Calendar.DATE, daysSpan * amountOfOrders);

        subscriptionList = {
            ID              : sorConstants.TYPE.SOR + '-' + count + '-' + order.orderNo,
            originalOrder   : order.orderNo,
            type            : sorConstants.TYPE.SOR,
            renewal         : preferences.SorAutomaticRenewalEnabled,
            status          : sorConstants.STATUS.NEW,
            customerNo      : customer.profile.customerNo,
            createdAt       : createdAt,
            orderDay        : createdAt.getDate(),
            lastRefillDate  : createdAt,
            validUntil      : validUntil.getTime(),
            billingAddress  : sorHelper.stringifyAddress(order.billingAddress),
            shippingAddress : sorHelper.stringifyAddress(shipment.getShippingAddress()),
            products        : [],
            zoneId          : session.custom.mainStore,
            geolocation     : {
                lat : session.custom.storeSearchLatitude || orderAddress.custom.latitude,
                lng : session.custom.storeSearchLongitude || orderAddress.custom.longitude
            }
        };

        // save the payment token
        if (order.paymentInstruments[0].creditCardToken) {
            subscriptionList.creditCardToken = order.paymentInstruments[0].creditCardToken;
        }

        // save credit card expiration date
        var payment_instruments = order.getPaymentInstruments(),
            cardExpirationDate  = new Date();

        for each (var instrument in payment_instruments) {
            if (instrument.paymentMethod.equals(METHOD_MERCADOPAGO_CREDIT)) {
                cardExpirationDate = new Date(instrument.getCreditCardExpirationYear(), instrument.getCreditCardExpirationMonth()-1, 1);
                var lastDayOfMonth = new Calendar(cardExpirationDate);
                lastDayOfMonth.set(Calendar.DAY_OF_MONTH, lastDayOfMonth.getActualMaximum(Calendar.DAY_OF_MONTH));
                cardExpirationDate = lastDayOfMonth.getTime();
            }
        }
        subscriptionList.cardExpirationDate = cardExpirationDate;

        // create the product list with the refilled product
        var lineItems      = shipment.getProductLineItems(),
            orderLI        = order.getAllProductLineItems().toArray(),
            orderDay       = preferences.SorBillingDay,
            sorPriceBookID = null;

        if (orderDay && orderDay > 0) {
            if (orderDay > 28) {
                ordarDay = validUntil.getActualMaximum(Calendar.DAY_OF_MONTH);
            }
            subscriptionList.orderDay = orderDay;
            validUntil.set(Calendar.DAY_OF_MONTH, orderDay);
            subscriptionList.validUntil = validUntil.getTime();
        }

        if (preferences.SorPriceBook) {
            sorPriceBookID = request.session.currency.currencyCode.toLowerCase() + "-" + preferences.SorPriceBook;
        }


        for each (var line_item in lineItems) {
            if (!empty(line_item.custom.hasSmartOrderRefill) && line_item.custom.hasSmartOrderRefill) {
                if (line_item.custom.SorMonthInterval > 0 || line_item.custom.SorWeekInterval > 0) {
                    if (!empty(line_item.product)) {
                        var quantity = line_item.getQuantityValue(),
                            prodPrice = 0;

                        if (quantity > 0) {
                            if (sorPriceBookID) {
                                var product    = ProductMgr.getProduct(line_item.product.ID),
                                    PriceModel = product.getPriceModel(),
                                    sorPrice   = PriceModel.getPriceBookPrice(sorPriceBookID).decimalValue;
                            }

                            if (sorPrice) {
                                prodPrice = sorPrice.get();
                            } else {
                                var pliPrice = line_item.getAdjustedPrice();
                                var pliQuantity = line_item.getQuantityValue();
                                var pliPricePerUnit = pliPrice.divide(pliQuantity);
                                prodPrice = parseFloat(pliPricePerUnit.decimalValue.get().toFixed(2));
                            }

                            var listItem = {
                                ID               : line_item.product.ID,
                                price            : prodPrice,
                                currencyCode     : line_item.getAdjustedPrice().getCurrencyCode(),
                                quantity         : quantity,
                                periodicity      : line_item.custom.SorPeriodicity,
                                interval         : 1,
                                sorWeekInterval  : line_item.custom.SorWeekInterval,
                                sorMonthInterval : line_item.custom.SorMonthInterval,
                                orderDay         : subscriptionList.orderDay
                            };

                            var newDate  = new Date(),
                                newValidUntil = new Calendar(newDate);

                            if (line_item.custom.SorPeriodicity == sorConstants.PERIODICITY.WEEK) {
                                newValidUntil.add(Calendar.DAY_OF_MONTH, 7 * line_item.custom.SorWeekInterval);
                            } else {
                                newValidUntil.add(Calendar.MONTH, line_item.custom.SorMonthInterval);
                                newValidUntil.set(Calendar.DAY_OF_MONTH, subscriptionList.orderDay);
                            }

                            subscriptionList.validUntil = newValidUntil.getTime();

                            if (line_item.product.custom.SorCommitment) {
                                listItem.commitment = line_item.product.custom.SorCommitment;
                                listItem.commitmentDone = 0;
                            }

                            subscriptionList.products.push(listItem);
                        }
                    }
                }
            }
        }
        if (subscriptionList.products.length > 0) {
            subscriptionsList.push(subscriptionList);

            Transaction.wrap(function () {
                createScheduledOrders(subscriptionList);
                saveSubscriptions();
            });

            count++;
        } else {
            subscriptionList = {};
        }
    }

    return subscriptionList;
}

/**
 *  Checks for default credit cards and subscriptions about to expire and notifies the customer.
 *  Also if all subscriptions are expired, or the customer has no more scheduled orders the flag on his profile will be set to false
 *  and the customer will be removed from SOR_customers customers group.
 */
function manageSubscriptions(dateOverride) {
    var renewalCount = 0;
    //set global level currentDate
    currentDate = sorHelper.getCurrentDate(dateOverride);

    if (subscriptionsList) {
        for each (var productList in subscriptionsList) {
            if (productList.status == sorConstants.STATUS.EXPIRED || productList.status == sorConstants.STATUS.CANCELED) {
                continue;
            }

            if (productList.status == sorConstants.STATUS.PAUSED) {
                checkPausedSubscription(productList, customer, dateOverride);
                continue;
            }

            setLocaleAndCurrency(productList);

            var customerCCExpirationDate = productList.cardExpirationDate,
                creditCardDifference     = getCreditCardExpirationDiff(customerCCExpirationDate, dateOverride);

            if (creditCardDifference == 15 || creditCardDifference == 10 || creditCardDifference == 5 || creditCardDifference == 2) {
                var map     = new HashMap(),
                    subject = Resource.msg('sor.mail.ccexp.expire.subject', 'mail', null);

                map.put('topcontent', Resource.msgf('sor.mail.ccexp.expire.topcontent', 'mail', null, creditCardDifference));
                map.put('subject', subject);
                map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
                map.put('customerName', customer.profile.firstName);
                sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
            } else if (creditCardDifference == 0) {
                var map     = new HashMap(),
                    subject = Resource.msg('sor.mail.ccexp.expired.subject', 'mail', null);

                map.put('topcontent', Resource.msg('sor.mail.ccexp.expired.topcontent', 'mail', null));
                map.put('subject', subject);
                map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
                map.put('customerName', customer.profile.firstName);
                sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
            }

            var subscriptionDifference = getSubscriptionExpirationDiff(productList, dateOverride),
                productsName           = sorHelper.strOfProducts(productList.products);

            if (productList.renewal) {
                if (preferences.SorAutomaticRenewalEnabled) {
                    if (subscriptionDifference == 15 || subscriptionDifference == 3) {
                        var map     = new HashMap(),
                            subject = Resource.msg('sor.mail.subscriptionren.renew.subject', 'mail', null);

                        map.put('topcontent', Resource.msgf('sor.mail.subscriptionren.renew.topcontent', 'mail', null, productsName, subscriptionDifference));
                        map.put('products', productList.products);
                        map.put('sorConstants', sorConstants)
                        map.put('subject', subject);
                        map.put('isSubscription', true);
                        map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
                        map.put('customerName', customer.profile.firstName);
                        sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
                    } else if (subscriptionDifference == 0) {
                        var map     = new HashMap(),
                            subject = Resource.msg('sor.mail.subscriptionren.renewed.subject', 'mail', null);

                        map.put('topcontent', Resource.msgf('sor.mail.subscriptionren.renewed.topcontent', 'mail', null, productsName));
                        map.put('products', productList.products);
                        map.put('sorConstants', sorConstants)
                        map.put('subject', subject);
                        map.put('isSubscription', true);
                        map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
                        map.put('customerName', customer.profile.firstName);
                        sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');

                        if (productList.status == sorConstants.STATUS.RENEW) {
                            renewalCount++;
                        }
                    }
                } else {
                    if (subscriptionDifference == 15 || subscriptionDifference == 3) {
                        var map     = new HashMap(),
                            subject = Resource.msg('sor.mail.subscriptionexp.expire.subject', 'mail', null);

                        map.put('topcontent', Resource.msgf('sor.mail.subscriptionexp.expire.topcontent', 'mail', null, productsName, subscriptionDifference));
                        map.put('sorConstants', sorConstants)
                        map.put('subject', subject);
                        map.put('isSubscription', true);
                        map.put('customerName', customer.profile.firstName);
                        sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
                    } else if (subscriptionDifference == 0) {
                        var map     = new HashMap(),
                            subject = Resource.msg('sor.mail.subscriptionexp.expired.subject', 'mail', null);

                        map.put('topcontent', Resource.msgf('sor.mail.subscriptionexp.expired.topcontent', 'mail', null, productsName));
                        map.put('sorConstants', sorConstants)
                        map.put('subject', subject);
                        map.put('isSubscription', true);
                        map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
                        map.put('customerName', customer.profile.firstName);
                        sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
                    }
                }
            } else if (!productList.renewal) {
                if (subscriptionDifference == 15 || subscriptionDifference == 3) {
                    var map     = new HashMap(),
                        subject = Resource.msg('sor.mail.subscriptionexp.expire.subject', 'mail', null);

                    map.put('topcontent', Resource.msgf('sor.mail.subscriptionexp.expire.topcontent', 'mail', null, productsName, subscriptionDifference));
                    map.put('sorConstants', sorConstants)
                    map.put('subject', subject);
                    map.put('isSubscription', true);
                    map.put('customerName', customer.profile.firstName);
                    sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
                } else if (subscriptionDifference == 0) {
                    var map     = new HashMap(),
                        subject = Resource.msg('sor.mail.subscriptionexp.expired.subject', 'mail', null);

                    map.put('topcontent', Resource.msgf('sor.mail.subscriptionexp.expired.topcontent', 'mail', null, productsName));
                    map.put('products', productList.products);
                    map.put('sorConstants', sorConstants)
                    map.put('subject', subject);
                    map.put('isSubscription', true);
                    map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
                    map.put('customerName', customer.profile.firstName);
                    sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
                }
            }

            if (preferences.SorChangeProductPrice) {
                var priceChanges = sorHelper.getProductPricesChanges(productList);

                if (priceChanges.changed) {
                    for each (var prod in priceChanges.products) {
                        var prodIdx = sorHelper.getIndexOfId(productList.products, prod.ID);
                        if (prodIdx != -1) {
                            productList.products[prodIdx].price = prod.newPrice.toString();
                            for each (order in ordersList) {
                                if (order.status != sorConstants.STATUS.PROCESSED && order.status != sorConstants.STATUS.CANCELED && order.subscriptionID == productList.ID) {
                                    order.products[prodIdx].price = prod.newPrice.toString();
                                }
                            }
                        }
                    }

                    Transaction.wrap(function () {
                        saveOrders();
                        saveSubscriptions();
                        customer.profile.custom.hasStandBySubscriptions = false;
                    });
                    var map     = new HashMap(),
                        subject = Resource.msg('sor.mail.changeprice.subject', 'mail', null);

                    map.put('topcontent', Resource.msg('sor.mail.changeprice.topcontent', 'mail', null));
                    map.put('bottomcontent', Resource.msg('sor.mail.changeprice.bottomcontent', 'mail', null));
                    map.put('products', productList.products);
                    map.put('sorConstants', sorConstants);
                    map.put('subject', subject);
                    map.put('isSubscription', true);
                    map.put('priceChanges', priceChanges.products);
                    map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
                    map.put('customerName', customer.profile.firstName);
                    sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
                }
            }

            if (renewalCount > 0) {
                for each (var orderList in ordersList) {
                    if (orderList.subscriptionID == productList.ID) {
                        if (orderList.status == sorConstants.STATUS.SCHEDULED) {
                            var args = {type:'system'};
                            try {
                                chargeOrderList(orderList, args);
                            } catch (e) {
                                SORLogger.error('Error in renewal order: {0}', e.toString());
                            }
                            
                            Transaction.wrap(function() {
                                setOrderProcessStatus (orderList.ID, dateOverride)
                            });
                        }

                        if (orderList.status == sorConstants.STATUS.PAUSED) {
                            orderList.status = sorConstants.STATUS.CANCELED;
                            sendOrderInactiveMail(orderList)
                        }

                        if (orderList.status == sorConstants.STATUS.OUTOFSTOCK) {
                            orderList.status = sorConstants.STATUS.CANCELED;
                            sendOutofstockMail(orderList);
                        }

                        if (orderList.status == sorConstants.STATUS.CCEXPIRED) {
                            orderList.status = sorConstants.STATUS.CANCELED;
                            sendCCExpiredMail(orderList);
                        }

                        Transaction.wrap(function () {
                            saveOrders();
                        });
                    }
                }

                productList.status = sorConstants.STATUS.NEW;
                cleanOrders(productList.ID);
                Transaction.wrap(function () {
                    saveOrders();
                    createScheduledOrders(productList);
                    saveSubscriptions();
                    customer.profile.custom.hasStandBySubscriptions = false;
                    defineSOR();
                });

            } else if (subscriptionDifference == 0) {
                productList.status = sorConstants.STATUS.EXPIRED;
                Transaction.wrap(function () {
                    saveSubscriptions();
                    customer.profile.custom.hasStandBySubscriptions = false;
                    defineSOR();
                });
            }
        }
    }
}


/**
 * This function determines of a paused subscription needs to be canceled and notifies the customer 
 * @param {Object} subscription 
 * @param {dw.customer.Customer} customer 
 * @param {Date} dateOverride 
 */
function checkPausedSubscription(subscription, customer, dateOverride) {
    var monthsToCancel = preferences.SorMonthsToCancelPaused || 12,
        currentDate    = sorHelper.getCurrentDate(dateOverride);

    if (monthsToCancel <= 0 || monthsToCancel > 12) {
        monthsToCancel = 12;
    }

    var dateToCancelCalendar = new dw.util.Calendar(new Date(subscription.createdAt));
    dateToCancelCalendar.add(dw.util.Calendar.MONTH, monthsToCancel);
    var dateToCancel = dateToCancelCalendar.getTime(),
        diff         = sorHelper.dateDiffInDays(currentDate, dateToCancel);

    if (diff <= 0) {
        var subscriptionsList = JSON.parse(customer.profile.custom.SorSubscriptions) || [],
            idx               = sorHelper.getIndexOfId(subscriptionsList, subscription.ID);

        if (idx != -1) {
            subscriptionsList[idx].status = sorConstants.STATUS.CANCELED;
            subscriptionsList[idx].lastUpdate = new Date();

            customer.profile.custom.SorSubscriptions = JSON.stringify(subscriptionsList);
            customer.profile.custom.hasStandBySubscriptions = false;
            defineSOR();

            var map     = new HashMap(),
                subject = Resource.msg('sor.mail.cancelorderinative.subject', 'mail', null);

            map.put('subject', subject);
            map.put('customerName', customer.profile.firstName);
            map.put('topcontent', Resource.msgf('sor.mail.subscriptionexp.expired.topcontent', 'mail', null, sorHelper.strOfProducts(subscriptionsList[idx].products)));
            sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
        }
    }
}

/**
 * Set the Locale And Currency on the basket based on the original order
 * @param {Object} orderList 
 * @param {dw.order.Basket} basket 
 */
function setLocaleAndCurrency(orderList, basket) {
    var originalOrder = OrderMgr.getOrder(orderList.originalOrder);
    request.setLocale(originalOrder.getCustomerLocaleID());

    if (basket && originalOrder.getCurrencyCode() != basket.getCurrencyCode()) {
        var newCurrency = dw.util.Currency.getCurrency(originalOrder.getCurrencyCode());
        session.setCurrency(newCurrency);
        basket.updateCurrency();
    }
}

/**
 * Returns the difference between the current date and the customer credit card expiration date
 * @param {Date} customerCCExpirationDate
 * @param {String} dateOverride
 * @returns {Number}
 */

function getCreditCardExpirationDiff(customerCCExpirationDate, dateOverride) {
    var currentDate = sorHelper.getCurrentDate(dateOverride),
        diff        = sorHelper.dateDiffInDays(currentDate, customerCCExpirationDate);

    return diff;
}

/**
 * Returns the difference between the current date and the subscription expiration date
 * @param {Object} subscriptionList
 * @param {String} dateOverride
 * @returns {Number}
 */
function getSubscriptionExpirationDiff(subscriptionList, dateOverride) {
    var currentDate         = sorHelper.getCurrentDate(dateOverride),
        subscriptionExpDate = new Date(subscriptionList.validUntil),
        diff                = sorHelper.dateDiffInDays(currentDate, subscriptionExpDate);

    if (diff <= 0) {
        diff = 0;
        if (subscriptionList.renewal) {
            if (preferences.SorAutomaticRenewalEnabled) {
                subscriptionList.status = sorConstants.STATUS.RENEW;
                subscriptionList.createdAt = currentDate;
                var validUntil = new Calendar(new Date(currentDate));

                validUntil.add(Calendar.YEAR, 1);
                if (subscriptionList.orderDay) {
                    validUntil.set(Calendar.DAY_OF_MONTH, subscriptionList.orderDay);
                }
                subscriptionList.validUntil = validUntil.getTime();
            } else {
                subscriptionList.status = sorConstants.STATUS.EXPIRED;
            }
        }
    }

    return diff;
}

/**
 * Processes the customer product list and extract required order list for automatic orders
 * @param {dw.customer.Customer} currentCustomer
 * @param {String} dateOverride
 * @returns {Object} ordersLists
 */
function processCustomerSorOrders(dateOverride) {
    var currentDate = sorHelper.getCurrentDate(dateOverride);

    for each (var orderList in ordersList) {
        Transaction.begin();
        var orderli = ordersList;
        var subscriptionList = getSubscription(orderList.subscriptionID)
        var subscriptionExpDate = new Date(subscriptionList.validUntil),
            subExp              = sorHelper.dateDiffInDays(currentDate, subscriptionExpDate);

        if (orderList.status == sorConstants.STATUS.SCHEDULED || orderList.status == sorConstants.STATUS.UPDATED || orderList.status == sorConstants.STATUS.OUTOFSTOCK || orderList.status == sorConstants.STATUS.CCEXPIRED) {
            var diff = sorHelper.dateDiffInDays(orderList.createdAt, currentDate);

            if (preferences.notificationBeforeOrderDays > 0 && !orderList.notified && diff >= -preferences.notificationBeforeOrderDays && diff < 0) {
                var map     = new HashMap(),
                    subject = Resource.msg('sor.mail.beforeorder.subject', 'mail', null);

                map.put('topcontent', Resource.msgf('sor.mail.beforeorder.topcontent', 'mail', null, sorHelper.strOfProducts(orderList.products), preferences.notificationBeforeOrderDays));
                map.put('subject', subject);
                
                map.put('button', {
                    text : Resource.msg('sor.mail.managerefill.button.name', 'mail', null),
                    link : URLUtils.https('SmartOrderRefillController-Manage')
                });
                
                map.put('customerName', customer.profile.firstName);
                sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');

                orderList.notified = true;
            }

            if (diff < 0) continue;

            // Re-Scheduled Disabled
            if (!preferences.rescheduleOrderEnabled) {
                if (diff == 0) {
                    processOrderList(orderList, true);
                } else {
                    orderList.status = sorConstants.STATUS.CANCELED;
                    var map     = new HashMap(),
                        subject = Resource.msg('sor.mail.cancelorderinative.subject', 'mail', null);

                    map.put('subject', subject);
                    map.put('customerName', customer.profile.firstName);
                    map.put('topcontent', Resource.msgf('sor.mail.cancelorderinative.topcontent', 'mail', null, new Date(orderList.createdAt).toDateString(), sorHelper.strOfProducts(orderList.products)));
                    sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
                }
            // Re-Scheduled Enabled
            } else {
                if (diff < preferences.numberOfDelayDays) {
                    processOrderList(orderList, false);

                    if (diff == 0 && orderList.status == sorConstants.STATUS.OUTOFSTOCK) {
                        var map = new HashMap(),
                            subject = Resource.msg('sor.mail.outofstock.subject', 'mail', null);

                        map.put('subject', subject);
                        map.put('customerName', customer.profile.firstName);
                        map.put('thanks', Resource.msg('sor.mail.sorryoutofstock', 'mail', null));
                        map.put('topcontent', Resource.msgf('sor.mail.outofstock.topcontent', 'mail', null, sorHelper.strOfProducts(orderList.products), new Date(orderList.createdAt).toDateString()));
                        map.put('bottomcontent', Resource.msgf('sor.mail.outofstock.bottomcontent', 'mail', null, preferences.numberOfDelayDays));
                        map.put('products', orderList.products);
                        sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
                    }
                } else {
                    if (orderList.status == sorConstants.STATUS.OUTOFSTOCK) {
                        sendOutofstockMail(orderList);
                        orderList.status = sorConstants.STATUS.CANCELED
                    } else if (orderList.status == sorConstants.STATUS.CCEXPIRED) {
                        sendCCExpiredMail(orderList);
                        orderList.status = sorConstants.STATUS.CANCELED
                    } else {
                        orderList.status = sorConstants.STATUS.CANCELED;
                        sendOrderInactiveMail(orderList);
                    }
                }
            }

            if (orderList.status == sorConstants.STATUS.CANCELED || orderList.status == sorConstants.STATUS.OUTOFSTOCK) {
                updateSubscription(orderList.subscriptionID, dateOverride);
            }
        } else if (orderList.status == sorConstants.STATUS.PAUSED) {
            var cancelOrder       = false;

            if (preferences.SorCancelPausedInNextOrder) {
                var nextOrder = new Calendar(new Date(orderList.createdAt));
                if (orderList.periodicity == sorConstants.PERIODICITY.WEEK) {
                    var daysInterval = 7 * orderList.interval;
                    nextOrder.add(Calendar.DAY_OF_MONTH, daysInterval);
                } else {
                    nextOrder.add(Calendar.MONTH, orderList.interval);
                    nextOrder.set(Calendar.DAY_OF_MONTH, orderList.orderDay);
                }
                cancelOrder = (currentDate >= nextOrder.getTime());
            } 
            
            var pauseDiff = sorHelper.dateDiffInDays(orderList.createdAt, currentDate);
            if (preferences.rescheduleOrderEnabled) {
                cancelOrder = (pauseDiff >= preferences.numberOfDelayDays);
            } else {
                cancelOrder = (pauseDiff >= 0);
            }

            if (cancelOrder || subExp == 0) {
                sendOrderInactiveMail(orderList); 
                orderList.status = sorConstants.STATUS.CANCELED;

                if (cancelOrder) {
                    updateSubscription(orderList.subscriptionID, dateOverride);
                }
            }
        }
        Transaction.commit();
    }

    return ordersList;
}

/**
 * Function is responsible for sending out of stock notification email to customer
 * @param {Object} orderList 
 */
function sendOutofstockMail(orderList) {
    var map = new HashMap(),
        subject = Resource.msg('sor.mail.cancelorderoutofstock.subject', 'mail', null);

    map.put('subject', subject);
    map.put('customerName', customer.profile.firstName);
    map.put('thanks', Resource.msg('sor.mail.sorryoutofstock', 'mail', null));
    map.put('topcontent', Resource.msgf('sor.mail.cancelorderoutofstock.topcontent', 'mail', null, sorHelper.strOfProducts(orderList.products), new Date(orderList.createdAt).toDateString()));
    map.put('bottomcontent', Resource.msg('sor.mail.cancelorderoutofstock.bottomcontent', 'mail', null));

    sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
}

/**
 * Function is responsible for sending credit card expiration notification email to customer
 * @param {Object} orderList 
 */
function sendCCExpiredMail(orderList) {
    var map = new HashMap(),
        subject = Resource.msg('sor.mail.cancelorderccexpired.subject', 'mail', null);

    map.put('subject', subject);
    map.put('customerName', customer.profile.firstName);
    map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
    map.put('topcontent', Resource.msgf('sor.mail.cancelorderccexpired.topcontent', 'mail', null, new Date(orderList.createdAt).toDateString(), sorHelper.strOfProducts(orderList.products)));

    sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
}

/**
 * Function is responsible for sending order cancelation for inactivity notification email to customer
 * @param {Object} orderList 
 */
function sendOrderInactiveMail(orderList) {
    var map = new HashMap(),
        subject = Resource.msg('sor.mail.cancelorderinative.subject', 'mail', null);

    map.put('subject', subject);
    map.put('customerName', customer.profile.firstName);
    map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
    map.put('topcontent', Resource.msgf('sor.mail.cancelorderinative.topcontent', 'mail', null, new Date(orderList.createdAt).toDateString(), sorHelper.strOfProducts(orderList.products)));
    map.put('products', orderList.products);

    sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
}

/**
 * Fucntion is responsible for procesing a refill order and setting the corect status and sending the coresponsing notification email
 * @param {Object} orderList
 * @param {Boolean} cancelIfOutOfStock
 */
function processOrderList(orderList, cancelIfOutOfStock) {
    if (orderList.status != sorConstants.STATUS.CCEXPIRED) {
        var allProductsAvailable = sorHelper.getProductItemsAvailability(orderList);

        if (allProductsAvailable) {
            orderList.status = sorConstants.STATUS.PROCESSING;
            SORLogger.info('Set PROCESSING status. Order: {0}', orderList.ID);
        } else if (cancelIfOutOfStock) {
            orderList.status = sorConstants.STATUS.CANCELED;
            sendOutofstockMail(orderList);
        } else {
            orderList.status = sorConstants.STATUS.OUTOFSTOCK;
        }
    } else {
        orderList.status = sorConstants.STATUS.CANCELED;
        sendCCExpiredMail(orderList);
    }
}

/**
 * Update a customer Subscription after an order cancelation
 * @param {String} subscriptionID
 * @param {String} dateOverride
 */
function updateSubscription(subscriptionID, dateOverride) {
    var currentDate = sorHelper.getCurrentDate(dateOverride),
        tempSubscription = getSubscription(subscriptionID);

    if (tempSubscription) {
        tempSubscription.status = sorConstants.STATUS.UPDATED;
        tempSubscription.lastUpdate = new Date(currentDate);
        tempSubscription.lastRefillDate = new Date(currentDate);
        saveSubscriptions();
    }
}

/**
 * Adds products from refill order to basket
 * @param {dw.order.Basket} basket
 * @param {Object} orderList
 */
function populateCart(basket, orderList) {
    var shippingObj       = null,
        billingObj        = null,
        billingAddress    = basket.getBillingAddress(),
        shippingAddress   = null,
        orderSubscription = getSubscription(orderList.subscriptionID),
        shipmentIterator  = basket.getShipments().iterator(),
        shipmentDefault   = null;

    if (orderList.billingAddress) {
        billingObj = orderList.billingAddress;
    } else {
        billingObj = orderSubscription.billingAddress;
    }

    if (orderList.shippingAddress) {
        shippingObj = orderList.shippingAddress;
    } else {
        shippingObj = orderSubscription.shippingAddress;
    }

    if (shipmentIterator.hasNext()) {
        shipmentDefault = shipmentIterator.next();
        shippingAddress = shipmentDefault.shippingAddress;
        if (shippingAddress == null){
            shippingAddress = shipmentDefault.createShippingAddress();
        }
        sorHelper.setJSONAddressToOrderAddress(shippingAddress, shippingObj);
    }

    if (billingAddress != null) {
        sorHelper.setJSONAddressToOrderAddress(billingAddress, billingObj);
    }

    var originalOrder   = OrderMgr.getOrder(orderList.originalOrder),
        defaultShipping = originalOrder.getDefaultShipment().getShippingMethod();

    shipmentDefault.setShippingMethod(defaultShipping);
    if (originalOrder.getAdjustedShippingTotalPrice().value == 0) {
        shipmentDefault.getShippingLineItems()[0].setPriceValue(originalOrder.getAdjustedShippingTotalPrice().value);
    } else {
        dw.order.ShippingMgr.applyShippingCost(basket);
    }

    for each (var prod in orderList.products) {
        if (!prod.cancelDate) {
            var product = ProductMgr.getProduct(prod.ID);

            if (product.master) {
                var pdv             = sorHelper.getDefaultVariant(product.variationModel),
                    productLineItem = basket.createProductLineItem(pdv.getID(), shipmentDefault);
            } else {
                var productLineItem = basket.createProductLineItem(product.getID(), shipmentDefault);
            }

            if (productLineItem) {
                productLineItem.setQuantityValue(parseInt(prod.quantity));
                productLineItem.setPriceValue(parseFloat(prod.price));
            }

            SORLogger.info('Added to Cart ID: {0} ({1})', productLineItem.getProductID(), prod.quantity);

        }
    }
}

/**
 * Fucntion is responsible for setting the procesed status on orders that have been placed 
 * @param {String} orderId 
 * @param {Date} dateOverride 
 */
function setOrderProcessStatus (orderId, dateOverride) {
    var currentDate = sorHelper.getCurrentDate(dateOverride);
    var order = getOrder(orderId);
    order.status = sorConstants.STATUS.PROCESSED;
    order.lastUpdate = currentDate;
    var orderSubscription = getSubscription(order.subscriptionID);
    orderSubscription.status = sorConstants.STATUS.UPDATED;
    orderSubscription.lastUpdate = currentDate;
    orderSubscription.lastRefillDate = order.createdAt;

    for each (var product in orderSubscription.products) {
        if (product.commitment) {
            product.commitmentDone = product.commitmentDone + 1;
        }
    }

    Transaction.wrap(function () {
        saveOrders();
        saveSubscriptions();
        customer.profile.custom.hasStandBySubscriptions = (ordersList[ordersList.length - 1].ID == order.ID);
    });

}

/**
 * Function is responsible for canceling a subscription with commitment and charging the customer a fee if apllicable
 * @param {String} subscriptionId 
 * @param {Number} cancelationFee 
 */
function cancelSubscriptionWithCommitment(subscriptionId, cancelationFee) {
    var tempSubscription = getSubscription(subscriptionId),
        note             = "Cancel Subscription (" + subscriptionId + ")";

    if (cancelationFee && cancelationFee >= 0) {
        var cancelationInfo = {
            ID: tempSubscription.ID,
            type : sorConstants.FEETYPE.SUBSCRIPTION,
            products : tempSubscription.products
        }
        var cancelationStatus = chargeCancelationFee(tempSubscription, cancelationFee, note, cancelationInfo);
        var skipEmail = true;
        if (cancelationStatus) {
            cancelSubscription(subscriptionId, skipEmail);
        }
    } else {
        cancelSubscription(subscriptionId);
    }
}

/**
 * Function is responsible for canceling a order with commitment and charging the customer a fee if apllicable
 * @param {String} orderId 
 * @param {Number} cancelationFee 
 */
function cancelOrderWithCommitment(orderId, cancelationFee) {
    var tempOrder        = getOrder(orderId),
        tempSubscription = getSubscription(tempOrder.subscriptionID),
        note             = "Cancel Order (" + orderId + ")";

    if (cancelationFee && cancelationFee >= 0) {
        var cancelationInfo = {
            ID: orderId,
            type : sorConstants.FEETYPE.ORDER,
            products : tempOrder.products
        }
        var cancelationStatus = chargeCancelationFee(tempSubscription, cancelationFee, note, cancelationInfo);
        if (cancelationStatus) {
            manageOrder({
                orderId   : orderId,
                newStatus : sorConstants.STATUS.CANCELED,
                skipEmail : true
            });
        }
    } else {
        manageOrder({
            orderId   : orderId,
            newStatus : sorConstants.STATUS.CANCELED
        });
    }
}

/**
 * Function is responsible for removing a product with commitment and charging the customer a fee if apllicable
 * @param {String} subscriptionId 
 * @param {String} item 
 * @param {Number} cancelationFee 
 */
function removeSubscriptionProductWithCommitment(subscriptionId, item, cancelationFee) {
    var tempSubscription = getSubscription(subscriptionId),
        note             = "Remove product (" + item + ") from Subscription (" + subscriptionId + ")";

    if (cancelationFee && cancelationFee >= 0) {
        var cancelationInfo = {
            ID: tempSubscription.ID,
            type : sorConstants.FEETYPE.PRODUCT,
            products : []
        }
        for (var prodIndex in tempSubscription.products) {
            if (tempSubscription.products[prodIndex].ID == item) {
                cancelationInfo.products.push(tempSubscription.products[prodIndex]);
                break;
            }
        }
        var cancelationStatus = chargeCancelationFee(tempSubscription, cancelationFee, note, cancelationInfo);
        var skipEmail = true;
        if (cancelationStatus) {
            removeSubscriptionProduct(subscriptionId, item, skipEmail);
        }
    } else {
        removeSubscriptionProduct(subscriptionId, item);
    }
}

/**
 * Function is responsible for charging a customer a cancelation fee 
 * @param {String} subsList 
 * @param {Number} cancelationFee 
 * @param {String} note 
 * @param {Object} cancelationInfo 
 */
function chargeCancelationFee(subsList, cancelationFee, note, cancelationInfo) {
    var orderList     = {},
        args          = {},
        cancelProduct = {},
        status        = {};

    orderList.subscriptionID = subsList.ID;
    orderList.originalOrder = subsList.originalOrder;
    orderList.creditCardToken = subsList.creditCardToken;
    orderList.originalOrder = subsList.originalOrder;
    orderList.products = [];

    if (note) {
        orderList.note = note;
    }

    if (cancelationInfo) {
        orderList.cancelationInfo = cancelationInfo;
    }

    args.type = 'cancel';
    args.cancelationFee = cancelationFee;

    cancelProduct.ID = 'sorcancel';
    cancelProduct.price = cancelationFee;
    cancelProduct.quantity = 1;
    orderList.products.push(cancelProduct);
    
    Transaction.wrap(function () {
        status = chargeOrderList(orderList, args);
    });
        
    if (status.error) {
        return false;
    } else {
        return true;
    }
}

/**
 * Function is responsible for creating a SFCC order from a refill order object
 * @param {Object} orderList 
 * @param {Object} args 
 */
function chargeOrderList(orderList, args) {
    var PromotionMgr = require('dw/campaign/PromotionMgr');
    var ShippingMgr = require('dw/order/ShippingMgr');
    var orderNo, order, amount, paymentInstrument, paymentProcessorID;
    /*
     * Temporary user to make sure the order will be created. This is needed because
     * when calling the createOrder method it expects that a session contains a valid user.
     */
    Transaction.begin();
    if (!CustomerMgr.loginExternallyAuthenticatedCustomer('SmartOrderRefilUser', '12Fa_KeP*&ass45', false)) {
        CustomerMgr.createExternallyAuthenticatedCustomer('SmartOrderRefilUser', '12Fa_KeP*&ass45');
        CustomerMgr.loginExternallyAuthenticatedCustomer('SmartOrderRefilUser', '12Fa_KeP*&ass45', false);
    }
    Transaction.commit();

    Transaction.begin();
    var basket = dw.order.BasketMgr.currentBasket;
    if (basket !== null) {
        dw.order.BasketMgr.deleteBasket(basket);
    }
    basket = dw.order.BasketMgr.currentOrNewBasket;

    if (basket.getBillingAddress() == null) {
        basket.createBillingAddress();
    }

    setLocaleAndCurrency(orderList, basket);
    populateCart(basket, orderList);

    sorHelper.calculateProductPrices(basket);
    PromotionMgr.applyDiscounts(basket);
    if (args.type !== "cancel") {
        ShippingMgr.applyShippingCost(basket);
        PromotionMgr.applyDiscounts(basket);
    }
    sorHelper.calculateProductPrices(basket);

    if (orderList.creditCardToken) {
        var subscriptionToken = orderList.creditCardToken;
    }

    sorHelper.calculateTax(basket);
    basket.updateTotals();

    //Place order
    
    orderNo = OrderMgr.createOrderNo();
    order = OrderMgr.createOrder(basket, orderNo);
    SORLogger.info('Created Order: {0}', orderNo);
    amount = basket.getTotalGrossPrice();
    paymentInstrument  = customer.profile.wallet.createPaymentInstrument(METHOD_MERCADOPAGO_CREDIT);
    paymentProcessorID = dw.order.PaymentMgr.getPaymentMethod(paymentInstrument.paymentMethod).getPaymentProcessor().getID();
    customer.profile.wallet.removePaymentInstrument(paymentInstrument);
        
    order.custom.IsSorOrder = true;
    if (args.type == "cancel") {
        order.custom.SorOrderRefillListID = 'cancel_fee';
    } else {
        order.custom.SorOrderRefillListID = orderList.ID;
    }
    order.setCustomer(customer);
    order.setCustomerEmail(customer.profile.email);
    order.setCustomerName(customer.profile.getFirstName() + ' ' + customer.profile.getLastName());
    Transaction.commit();

    if (!paymentProcessorID) {
        throw new Error('paymentProcessorID is undefined');
    }
    
    if (paymentIntegration[paymentProcessorID] || paymentProcessorID == 'BASIC_CREDIT') {
        
        Transaction.begin();
        var paymentInstrument = order.createPaymentInstrument(METHOD_MERCADOPAGO_CREDIT, amount),
            paymentMethod     = dw.order.PaymentMgr.getPaymentMethod(paymentInstrument.getPaymentMethod()),
            paymentProcessor  = paymentMethod.getPaymentProcessor(),
            paymentResponse;
        Transaction.commit();
        
        if (amount > 0) {
            SORLogger.info('Start payment process. Type: {0}, Amount: {1}, paymentProcessorID: {2}', args.type, amount, paymentProcessorID);
            if (paymentProcessorID != 'BASIC_CREDIT' && subscriptionToken) {
                switch (args.type) {
                    case 'cancel' : {
                        Transaction.wrap(function () {
                            paymentResponse = paymentIntegration[paymentProcessorID].ChargeFee(orderList, args.cancelationFee);
                        });
                    } break;

                    default : {
                        Transaction.wrap(function () {
                            paymentResponse = paymentIntegration[paymentProcessorID].Authorize(order, basket, subscriptionToken, orderList.originalOrder);
                        });
                    }
                }
            }

            if (paymentProcessorID != 'BASIC_CREDIT' && (!paymentResponse || paymentResponse.error)) {
                var map     = new HashMap(),
                    subject = Resource.msg('sor.mail.unsuccessfulpayment.subject', 'mail', null);

                map.put('topcontent', Resource.msgf('sor.mail.unsuccessfulpayment.topcontent', 'mail', null, sorHelper.strOfProducts(orderList.products)));
                map.put('subject', subject);
                map.put('thanks', Resource.msg('sor.mail.thanks', 'mail', null));
                map.put('customerName', customer.profile.firstName);
                sorHelper.sendEmail(customer.profile.email, subject, map, 'mail/soremail');
                Transaction.wrap(function () {
                    OrderMgr.failOrder(order);
                });
                throw new Error('Authorization error');
            } else {
                Transaction.begin();
                SORLogger.info('Sucsess payment');
                paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
                if (paymentProcessorID != 'BASIC_CREDIT') {
                    paymentIntegration[paymentProcessorID].UpdatePaymentInstrument(paymentInstrument, paymentResponse);
                }
                order.setExportStatus(Order.EXPORT_STATUS_READY);
                order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
                Transaction.commit();
            }
        } else {
            Transaction.begin();
            SORLogger.info('Payment is not needed');
            order.setExportStatus(Order.EXPORT_STATUS_READY);
            order.setPaymentStatus(Order.PAYMENT_STATUS_PAID);
            Transaction.commit();
        }
    } else {
        Transaction.wrap(function () {
            OrderMgr.failOrder(order);
        });
        throw new Error('Payment Integration is not found');
    }

    var status = {}; 

    Transaction.wrap(function () {
        status = OrderMgr.placeOrder(order);
    });

    if (status && status.error) {
        Transaction.wrap(function () {
            OrderMgr.failOrder(order);
        });
        throw new Error('OrderMgr.placeOrder - ' + status.message);
    }

    Transaction.wrap(function () {
        order.confirmationStatus = Order.CONFIRMATION_STATUS_CONFIRMED;
    });
    
    if (args.type == "cancel" && orderList.note) {
        order.addNote("Commitment Payment", orderList.note);
    }

    var mailSubject = Resource.msg('email.orderconfirmation.subject', 'smartorderrefill', null) + ' ' + order.orderNo,
        refillList  = [],
        map         = new dw.util.HashMap();

    refillList.push(orderList);
    map.put('ORIsFutureOrder', true);
    map.put('MailSubject', mailSubject);
    map.put('Order', order);
    map.put('RefillList', refillList);

    sorHelper.sendEmail(customer.profile.email, mailSubject, map, 'mail/orderconfirmation');
    SORLogger.info('Sent confirmation email');
    return status;
}

/**
 * Function is responsible for retriving a customer saved addresses from the profile
 */
function getCustomerAddresses() {
    var customerAddresses = [];
    for (var addressIndex in customer.profile.addressBook.addresses) {
        var address = customer.profile.addressBook.addresses[addressIndex];
        customerAddresses.push(
            {
                UUID         : address.UUID,
                ID           : address.ID,
                key          : address.ID,
                firstName    : address.firstName,
                lastName     : address.lastName,
                address1     : address.address1,
                address2     : address.address2,
                postalCode   : address.postalCode,
                city         : address.city,
                stateCode    : address.stateCode,
                countryCode  : address.countryCode.value,
                phone        : address.phone,
                type         : 'customer',
                displayValue : address.ID
            }
        );
    }
    return customerAddresses
}


/**
 * Check the commitment status for a SOR product
 * @param {Object} product
 */
function checkCommitmentStatus (product) {
    var commitment = false;
    if(product.commitment && product.commitment > product.commitmentDone) {
        var commitment = true;
    }
    return commitment;
}

/**
 * Constructor function for RefillCustomer
 * @param {Object} args 
 */
function RefillCustomer(args) {
    customer = args.customer;
    preferences = getPreferences(dw.system.Site.current.preferences);
    ordersList = JSON.parse(args.customer.profile.custom.SorOrders) || [];
    subscriptionsList = JSON.parse(args.customer.profile.custom.SorSubscriptions) || [];
}

RefillCustomer.prototype.manageOrder = manageOrder;
RefillCustomer.prototype.pauseSubscription = pauseSubscription;
RefillCustomer.prototype.reactivateSubscriptionStart = reactivateSubscriptionStart;
RefillCustomer.prototype.reactivateSubscriptionFinish = reactivateSubscriptionFinish;
RefillCustomer.prototype.cancelSubscription = cancelSubscription;
RefillCustomer.prototype.cancelRenewal = cancelRenewal;
RefillCustomer.prototype.cancelAllOrders = cancelAllOrders;
RefillCustomer.prototype.viewSubscription = viewSubscription;
RefillCustomer.prototype.viewCustomerSubscriptions = viewCustomerSubscriptions;
RefillCustomer.prototype.viewOrder = viewOrder;
RefillCustomer.prototype.changeSubscriptionProductQtd = changeSubscriptionProductQtd;
RefillCustomer.prototype.changeSubscriptionProductId = changeSubscriptionProductId;
RefillCustomer.prototype.changeOrderProductQtd = changeOrderProductQtd;
RefillCustomer.prototype.changeOrderProductId = changeOrderProductId;
RefillCustomer.prototype.removeOrderProduct = removeOrderProduct;
RefillCustomer.prototype.removeSubscriptionProduct = removeSubscriptionProduct;
RefillCustomer.prototype.updateOrderAddressStart = updateOrderAddressStart
RefillCustomer.prototype.updateOrderAddressFinish = updateOrderAddressFinish;
RefillCustomer.prototype.getCustomerAddresses = getCustomerAddresses;
RefillCustomer.prototype.updateSubscriptionAddressStart = updateSubscriptionAddressStart
RefillCustomer.prototype.updateSubscriptionAddressFinish = updateSubscriptionAddressFinish;
RefillCustomer.prototype.updateRefill = updateRefill;
RefillCustomer.prototype.checkBeforeCancel = checkBeforeCancel;
RefillCustomer.prototype.updateCreditCardStart = updateCreditCardStart;
RefillCustomer.prototype.updateCreditCardFinish = updateCreditCardFinish;
RefillCustomer.prototype.changeSubscriptionProductId = changeSubscriptionProductId;
RefillCustomer.prototype.checkCommitmentStatus = checkCommitmentStatus;
RefillCustomer.prototype.isLastOrder = isLastOrder;

RefillCustomer.prototype.createSmartOrderRefillSubscription = createSmartOrderRefillSubscription;

RefillCustomer.prototype.setNewPrices = setNewPrices;

RefillCustomer.prototype.manageSubscriptions = manageSubscriptions;
RefillCustomer.prototype.processCustomerSorOrders = processCustomerSorOrders;
RefillCustomer.prototype.populateCart = populateCart;
RefillCustomer.prototype.checkPausedSubscription = checkPausedSubscription;
RefillCustomer.prototype.setOrderProcessStatus = setOrderProcessStatus;
RefillCustomer.prototype.setLocaleAndCurrency = setLocaleAndCurrency;
RefillCustomer.prototype.chargeOrderList = chargeOrderList;

RefillCustomer.prototype.cancelSubscriptionWithCommitment = cancelSubscriptionWithCommitment;
RefillCustomer.prototype.cancelOrderWithCommitment = cancelOrderWithCommitment;
RefillCustomer.prototype.removeSubscriptionProductWithCommitment = removeSubscriptionProductWithCommitment;

RefillCustomer.prototype.saveOrders = saveOrders;



module.exports = RefillCustomer;
