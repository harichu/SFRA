'use strict';
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
/**
 * Controller for managing the OSF Smart Order Refill Business Manager module
 * This Business Manager module is used to display the reports about and manage customer subscriptions and subscription orders
 * @module controllers/SmartOrderRefillReport
 */

// API includes
var Transaction         = require('dw/system/Transaction'),
    CustomerMgr         = require('dw/customer/CustomerMgr'),
    ProductMgr          = require('dw/catalog/ProductMgr'),
    Site                = require('dw/system/Site'),
    ISML                = require('dw/template/ISML'),
    URLUtils            = require('dw/web/URLUtils'),
    Calendar            = require('dw/util/Calendar'),
    PagingModel         = require('dw/web/PagingModel'),
    ArrayList           = require('dw/util/ArrayList'),
    Resource            = require('dw/web/Resource');

// Script Includes
var app                 = require('bm_smartorderrefill/cartridge/scripts/app'),
    guard               = require('bm_smartorderrefill/cartridge/scripts/guard'),
    RefillCustomerModel = require('int_smartorderrefill/cartridge/models/RefillCustomer.js'),
    sorHelper           = require('int_smartorderrefill/cartridge/scripts/SmartOrderRefillHelper.js'),
    sorConstants        = require('int_smartorderrefill/cartridge/scripts/SmartOrderRefillConstants.js');

// Global Variables
var SORLogger           = dw.system.Logger.getLogger('SORReporting', 'SORReporting'),
    params              = request.httpParameterMap,
    forms               = session.forms;

var METHOD_MERCADOPAGO_CREDIT = Resource.msg('payment.method.id', 'mercadoPagoPreferences', null);

/**
 * This Endpoint renders the main dasboard page where the merchant can choose from the 3 available sections
 * SOR Subscriptions, Orders Summary, Subscription Summary
 */
function manage() {
    app.getView({
        Authorized : sorHelper.verifyLicense()
    }).render('bm/sor_maindashboard');
}

/**
 * This Endpoint renders the SOR Subscriptions page
 * This page displays the customers with active Smart Order Refill subscriptions and alowes filtering by customer name and email
 */
function manageSOR() {
    var searchBy       = app.getForm('sorsubscriptions').getValue('searchMemberBy'),
        search         = app.getForm('sorsubscriptions').getValue('searchMember'),
        members, tmpMember;

    if (search) {
        tmpMember = filterSORMembers(searchBy, search);
    }

    if (!tmpMember) {
        tmpMember = getAllCustomersWithSOR();
    }

    var members = constructPagingModel(tmpMember.asList());

    app.getView({
        memberPaginationModel      : members,
        sorType          : sorConstants.TYPE.SOR,
        navigation       : 'manageSOR'
    }).render('bm/sor_sordashboard');
}

/**
 * This function creates the search query for customers with active subscriptions while taking into account the filtering parameters 
 * @param {String} searchBy 
 * @param {String} search 
 */
function filterSORMembers(searchBy, search) {
    var queryStr = 'custom.hasSmartOrderRefill={0} OR custom.hasStandBySubscriptions={1}';
    search = "'" + search + "*'";
    switch (searchBy) {
        case 'customerName':
            queryStr += ' AND (firstName ILIKE ' + search + ' OR lastName ILIKE ' + search + ')';
            break;

        case 'customerEmail':
            queryStr += ' AND email ILIKE ' + search;
            break;

        default:
            break;
    }

    return CustomerMgr.searchProfiles(queryStr, null, true, true);
}

/**
 * This enpont is used to render a customers active subscriptions as tiles
 * The tiles are displayed in a modal and contains summary information and action buttons  similar to ones on customer Smart Order refill Dashboard
 */
function showSubscriptions() {
    var currentCustomer   = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue);
    
    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });
    
    var context  = refillCustomer.viewCustomerSubscriptions();
   
    app.getView(context).render('bm/sor_subscriptions');
}

/**
 * This endpoint renders a page of the customers selected subscription
 * This page shows a detailed view of subscription and enables the editing of certain information regarding the subscription
 */
function viewSubscription() {
    var currentCustomer   = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue);
    
    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });

    var context = refillCustomer.viewSubscription(params.sid.stringValue);
    if(!empty(context.currentCreditCard)) {
        if (context.currentCreditCard.expMonth && context.currentCreditCard.expYear) {
            context.currentCreditCard.expMonth = context.currentCreditCard.expMonth;
            context.currentCreditCard.expYear  = context.currentCreditCard.expYear;
        } else {
            var expDate = new Date(context.ProductList.cardExpirationDate);
            context.currentCreditCard.expMonth = (expDate.getMonth() + 1).toFixed(0);
            context.currentCreditCard.expYear  = expDate.getFullYear().toFixed(0);
        }   
    }
    
    app.getView(context).render('bm/sor_viewsubscriptions');
}

/**
 * This enpont is used to render a customers selected order as tiles
 * The tile is displayed in a modal and contains summary information and action buttons similar to ones on customer Smart Order refill Dashboard
 */
function viewOrder() {
    var currentCustomer   = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue);

    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });
    var order       = refillCustomer.viewOrder(params.oid.stringValue);
    var isLastOrder = params.isLast.stringValue
        
    app.getView({
        order       : order,
        customer    : currentCustomer,
        isLastOrder : isLastOrder
    }).render('bm/sor_orders');
}

/**
 * This endpoint renders a page of the customers selected order
 * his page shows a detailed view of order and enables the editing of certain information regarding the order
 */
function orderDetails() {
    var currentCustomer   = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue);

    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });
    var order       = refillCustomer.viewOrder(params.oid.stringValue);
        
    app.getView({
        order    : order,
        customer : currentCustomer
    }).render('bm/sor_vieworders');
}

/**
 * This endpoint handles actions for order that are submited via ajax
 */
function manageOrders() {
    var currentCustomer   = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue);
    var action = params.action.stringValue;
    var jsonResponse = {
        "success": false,
        "message": '',
        "continueURL": '',
        "test": ''
    };
    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });

    if (!params.oid.empty) {
      
        switch (action) {
            case 'view': {
                var context       = refillCustomer.viewOrder(params.oid.stringValue);
                var originalOrder = OrderMgr.getOrder(context.ProductList.originalOrder);
                var shippingCost  = originalOrder.getAdjustedShippingTotalPrice();
                context['ShippingMethodName'] = originalOrder.defaultShipment.shippingMethod.displayName;
                context['ShippingCost']       = originalOrder.getAdjustedShippingTotalPrice().decimalValue.get();
                res.render('account/smartorderrefill/vieworder', context);
            } break;


            case 'updateAddress' : {
                if (!empty(request.triggeredForm) && request.triggeredForm.triggeredAction.triggered) {
                    if (request.triggeredForm.valid) {
                        refillCustomer.updateOrderAddressFinish(params.oid.stringValue, session.forms.changeaddress, params.addressType.stringValue);
                        jsonResponse.success = true;
                        jsonResponse.continueURL = URLUtils.https('SmartOrderRefillReport-OrderDetails', 'client', params.client.stringValue, 'sorType' , 'SOR', 'oid', params.oid.stringValue);
                    } else {
                        jsonResponse.success = false;
                    }
                    app.getView({
                        order    : refillCustomer.viewOrder(params.oid.stringValue),
                        customer : CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue)
                    }).render('bm/sor_vieworders');
                } else {
                    var addressObj = refillCustomer.updateOrderAddressStart(params.oid.stringValue, params.addressType.stringValue);
                    
                    app.getForm('changeaddress').clear();
                    app.getForm('changeaddress').copyFrom(addressObj);
                    app.getForm('changeaddress.states').copyFrom(addressObj);

                    app.getView({
                        customerAddresses: refillCustomer.getCustomerAddresses(),
                        continueURL : URLUtils.https('SmartOrderRefillReport-ManageOrders', 'client', params.client.stringValue, 'addressType', 
                                        params.addressType.stringValue, 'oid', params.oid.stringValue, 'action', 'updateAddress', 'viewType', 'subscription'),
                        backURL: URLUtils.https('SmartOrderRefillReport-OrderDetails', 'client', params.client.stringValue, 'sorType' , 'SOR', 'oid', params.oid.stringValue)
                    }).render('bm/sor_changeaddress');;
                }
            } break;
            
            case 'canceled' : {
                var checkBeforeCancel = refillCustomer.checkBeforeCancel('order', params.oid.stringValue);
                if (!checkBeforeCancel.status) {
                    if (forms.cancelationfee.save.submitted) {
                        var fee = forms.cancelationfee.fee.value;
                        refillCustomer.cancelOrderWithCommitment(params.oid.stringValue, fee);
                    } else {
                        app.getForm('cancelationfee').clear();
                        var subscriptionsUrl = URLUtils.https('SmartOrderRefillReport-CancelationFee', 'client', params.client.stringValue, 'oid', params.oid.stringValue).toString();
                        renderJSON({
                            subscriptionsUrl: subscriptionsUrl
                        });
                        
                       
                    }
                } else {
                    refillCustomer.manageOrder({
                        orderId   : params.oid.stringValue,
                        newStatus : sorConstants.STATUS.CANCELED
                    });
                }
                
                return;
            } break;

            default : {
                try {
                    refillCustomer.manageOrder({
                        orderId   : params.oid.stringValue,
                        newStatus : action
                    });
                    jsonResponse.success = true;
                } catch (e) {
                    jsonResponse.success = false;
                }
                renderJSON(jsonResponse);
            }
        }
    }
}

/**
 * This endpoint handles the ajax request for cancel/reactivate subscription triggered by the subscription tile button
 */
function updateRenewal() {
    var currentCustomer   = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue),
        subscriptionsList = JSON.parse(currentCustomer.profile.custom.SorSubscriptions),
        idx               = sorHelper.getIndexOfId(subscriptionsList, params.sid.stringValue);

    if (idx != -1) {
        subscriptionsList[idx].renewal = params.status.booleanValue;
        subscriptionsList[idx].status = sorConstants.STATUS.UPDATED;
        subscriptionsList[idx].lastUpdate = new Date();
        Transaction.wrap(function() {
            currentCustomer.profile.custom.SorSubscriptions = JSON.stringify(subscriptionsList);
        });
    }
    var reloadUrl = (URLUtils.https('SmartOrderRefillReport-ShowSubscriptions', 'client', params.client.stringValue, 'sorType', 'SOR')).toString();
    renderJSON({reloadUrl: reloadUrl});

}

/**
 * This endpoint will render the edit address page for the customer subscription
 */
function viewChangeAddress() {
    var currentCustomer   = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue),
        viewType          = params.viewType.stringValue,
        subscriptionsList = JSON.parse(currentCustomer.profile.custom.SorSubscriptions),
        ordersList        = JSON.parse(currentCustomer.profile.custom.SorOrders),
        sorList           = (viewType == sorConstants.VIEWTYPE.SUBSCRIPTION) ? subscriptionsList : ordersList,
        idx               = sorHelper.getIndexOfId(sorList, params.sid.stringValue);

    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });    

    if (idx != -1) {
        var addressType      = params.addressType.stringValue;
        
        if (viewType == sorConstants.VIEWTYPE.SUBSCRIPTION) {
            var addressObj =refillCustomer.updateSubscriptionAddressStart(sorList[idx].ID, addressType);

            addressObj.countryCode.value = addressObj.countryCode.value.toLowerCase();
            app.getForm('changeaddress').clear();
            app.getForm('changeaddress').copyFrom(addressObj);
            app.getForm('changeaddress.states').copyFrom(addressObj);
        } else {
            var addressObj = refillCustomer.updateOrderAddressStart(sorList[idx].ID, addressType)

            addressObj.countryCode.value = addressObj.countryCode.value.toLowerCase();
            app.getForm('changeaddress').clear();
            app.getForm('changeaddress').copyFrom(addressObj);
            app.getForm('changeaddress.states').copyFrom(addressObj);
        }
        
        app.getView({
            ContinueURL        : URLUtils.https('SmartOrderRefillReport-ChangeAddress', 'sid', sorList[idx].ID, 'viewType', viewType, 'addressType', addressType, 'client', currentCustomer.profile.customerNo, 'sorType', params.sorType.stringValue),
            SubscriptionListID : sorList[idx].ID,
            CustomerNo         : currentCustomer.profile.customerNo,
            viewType           : viewType,
            sorType            : params.sorType.stringValue,
            OriginalListID     : (viewType == sorConstants.VIEWTYPE.ORDER) ? sorList[idx].subscriptionID : ''
        }).render('bm/sor_changeaddress');
    }
}

/**
 * This endpoint saves the address changes to the customer subscription
 */
function changeAddress() {
    var currentCustomer = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue),
        viewType        = params.viewType.stringValue,
        sorList         = (viewType == sorConstants.VIEWTYPE.SUBSCRIPTION) ? JSON.parse(currentCustomer.profile.custom.SorSubscriptions) : JSON.parse(currentCustomer.profile.custom.SorOrders),
        idx             = sorHelper.getIndexOfId(sorList, params.sid.stringValue);

    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });    
    

    if (idx != -1) {
        if (forms.changeaddress.valid) {
            var addressType      = params.addressType.stringValue;

            refillCustomer.updateSubscriptionAddressFinish(sorList[idx].ID, forms.changeaddress, addressType)
            viewSubscription();
        } else {
            app.getView({
                ContinueURL        : URLUtils.https('SmartOrderRefillReport-ChangeAddress', 'sid', sorList[idx].ID, 'viewType', viewType, 'client', currentCustomer.profile.customerNo, 'sorType', params.sorType.stringValue),
                SubscriptionListID : sorList[idx].ID,
                CustomerNo         : currentCustomer.profile.customerNo,
                viewType           : viewType,
                sorType            : params.sorType.stringValue
            }).render('bm/sor_changeaddress');
        }
    }
}

/**
 * This endpoint renderes the edit product page for the selected product of the customer subscription / order
 */
function editProduct() {
    var currentCustomer = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue),
        viewType        = params.viewType.stringValue,
        sorList         = (viewType == sorConstants.VIEWTYPE.SUBSCRIPTION) ? JSON.parse(currentCustomer.profile.custom.SorSubscriptions) : JSON.parse(currentCustomer.profile.custom.SorOrders),
        idx             = sorHelper.getIndexOfId(sorList, params.sid.stringValue);

    if (idx != -1) {
        var prodIdx = sorHelper.getIndexOfId(sorList[idx].products, params.item.stringValue);
        var refillCustomer = new RefillCustomerModel({
            preferences : Site.current.preferences,
            customer    : currentCustomer
        });

        if (prodIdx != -1) {
            var productSearchModel = new dw.catalog.ProductSearchModel(),
                productId          = sorList[idx].products[prodIdx].ID,
                productObj         = ProductMgr.getProduct(productId),
                product            = sorList[idx].products[prodIdx],
                listProducts       = new dw.util.ArrayList(),
                listVariations     = new dw.util.ArrayList(),
                selectedVariations = new dw.util.ArrayList(),
                tempProducts, category;
   
            productSearchModel.setCategoryID('root');
            productSearchModel.setRecursiveCategorySearch(true);
            productSearchModel.search();
            tempProducts = productSearchModel.products;
        
            var ProductUtils = require('*/cartridge/scripts/product/ProductUtils.js');
            var commitment   = refillCustomer.checkCommitmentStatus(product)
            while (tempProducts.hasNext()) {
                var prod = tempProducts.next();
                
                if (prod.custom.SorProduct) {
                    if (prod.isMaster() || prod.isVariant()) {
                        if (prod.isVariant()) {
                            prod = prod.getMasterProduct();
                        }
                        var variations = ProductUtils.getVariants(prod, prod.variationModel, 1);
                    
                       for each(var variation in variations){
                        var tempVariation = {};

                        tempVariation.ID = prod.ID;
                        tempVariation.label = prod.name + '(';
                        tempVariation.value = variation.id
                        var attributeNames = Object.keys(variation.attributes)
                    
                        for each(var tempAtrributeName in attributeNames) {
                            tempVariation.label += tempAtrributeName + ' = ' + variation.attributes[tempAtrributeName] + ' '
                        }
                        tempVariation.label += ')';

                         if(!commitment && !prod.custom.SorCommitment) {
                            listVariations.add(tempVariation);  
                         } else {
                             if (!productObj.isBundle()) {
                                if (tempVariation.ID == productObj.getMasterProduct().ID) {
                                    listVariations.add(tempVariation);     
                                }
                             }   
                         }    
                       }
                       if (!prod.custom.SorCommitment){
                            listProducts.add(prod);  
                       }              
                    } else {
                        var tempBundle = {};
                        tempBundle.ID = prod.ID
                        tempBundle.label = prod.name
                        tempBundle.value = prod.ID
                        if (!commitment && !prod.custom.SorCommitment || commitment && productObj.ID == prod.ID) {
                            listVariations.add(tempBundle);  
                        }
                        if (!prod.custom.SorCommitment){
                            listProducts.add(prod); 
                        }
                    }
                }
            }
            
            if (productObj.isVariant()) {
                var attr = productObj.variationModel.getProductVariationAttributes()
                for each(var va in attr) {
                    selectedVariations.push(va.displayName + "=" + productObj.variationModel.getSelectedValue(va).displayValue)
                }
            }
          
            var listPeriodicity     = new dw.util.ArrayList(),
                listIntervals       = new dw.util.ArrayList(),
                periodicity         = new dw.util.ArrayList(),
                weekIntervals       = Site.current.preferences.custom.SorDeliveryWeekInterval,
                monthIntervals      = Site.current.preferences.custom.SorDeliveryMonthInterval,
                selectedPeriodicity = product.periodicity,
                selectedInterval    = product.interval;
            
            if (weekIntervals.length > 0) {
                periodicity.push(sorConstants.PERIODICITY.WEEK)
            }
            if (monthIntervals.length > 0) {
                periodicity.push(sorConstants.PERIODICITY.MONTH)
            }    

            for each(var period in periodicity) {
                var tempPeriodicity = {};
                tempPeriodicity.value = period;
                tempPeriodicity.label = period;
                listPeriodicity.add(tempPeriodicity)
            }

            for each(var interval in weekIntervals) {
                var tempWeekInterval = {};
                tempWeekInterval.value=interval;
                tempWeekInterval.label=interval;
                tempWeekInterval.periodicity=sorConstants.PERIODICITY.WEEK;
                listIntervals.add(tempWeekInterval)
            }
            for each(var interval in monthIntervals) {
                var tempMonthInterval = {};
                tempMonthInterval.value=interval;
                tempMonthInterval.label=interval;
                tempMonthInterval.periodicity=sorConstants.PERIODICITY.MONTH;
                listIntervals.add(tempMonthInterval)
            }
         
            app.getForm('editproduct').object.product.setOptions(listProducts.iterator()); 
            app.getForm('editproduct').object.variation.setOptions(listVariations.iterator());
            app.getForm('editproduct').object.periodicity.setOptions(listPeriodicity.iterator());
            app.getForm('editproduct').object.interval.setOptions(listIntervals.iterator());
            app.getForm('editproduct').clear();
            app.getForm('editproduct').setValue('quantity', sorList[idx].products[prodIdx].quantity);

            app.getView({
                ContinueURL        : URLUtils.https('SmartOrderRefillReport-SaveProduct', 'sid', sorList[idx].ID, 'item', productId, 'viewType', viewType, 'client', currentCustomer.profile.customerNo, 'sorType', params.sorType.stringValue),
                SubscriptionListID : sorList[idx].ID,
                CustomerNo         : currentCustomer.profile.customerNo,
                viewType           : viewType,
                sorType            : params.sorType.stringValue,
                commitment         : commitment,
                products           : listProducts,
                variations         : listVariations,
                selectedProduct    : productObj,
                selectedVariations : selectedVariations,
                selectedPeriodicity: selectedPeriodicity,
                selectedInterval   : selectedInterval,
                OriginalListID     : (viewType == sorConstants.VIEWTYPE.ORDER) ? sorList[idx].subscriptionID : ''
            }).render('bm/sor_editproduct');  
        }
    }
}

/**
 * This endpoint saves the changes to the products of the customer subscription / order
 */
function saveProduct() {
    var currentCustomer = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue),
        viewType        = params.viewType.stringValue,
        sorList         = (viewType == sorConstants.VIEWTYPE.SUBSCRIPTION) ? JSON.parse(currentCustomer.profile.custom.SorSubscriptions) : JSON.parse(currentCustomer.profile.custom.SorOrders),
        idx             = sorHelper.getIndexOfId(sorList, params.sid.stringValue),
        quantity        = forms.editproduct.quantity.value,
        newProductId    = forms.editproduct.variation.value,
        newRefillPeriod = forms.editproduct.periodicity.value,
        newRefillInterval = forms.editproduct.interval.value;

    if (idx != -1) {
        sorList[idx].status = sorConstants.STATUS.UPDATED;
        sorList[idx].lastUpdate = new Date();

        var prodIdx = sorHelper.getIndexOfId(sorList[idx].products, params.item.stringValue);
        var refillCustomer = new RefillCustomerModel({
            preferences : Site.current.preferences,
            customer    : currentCustomer
        });
        if (prodIdx != -1) {
            var currentProductId       = sorList[idx].products[prodIdx].ID,
                currentProductPeriod   = sorList[idx].products[prodIdx].periodicity,
                currentProductInterval = sorList[idx].products[prodIdx].interval,
                currentRefill          = currentProductInterval + currentProductPeriod,
                newRefill              = newRefillInterval + newRefillPeriod;
            if (quantity && quantity > 0) {
                if (viewType == sorConstants.VIEWTYPE.SUBSCRIPTION) {
                    refillCustomer.changeSubscriptionProductQtd(sorList[idx].ID, currentProductId, quantity);
                    if (newProductId && currentProductId != newProductId) {
                        refillCustomer.changeSubscriptionProductId(sorList[idx].ID, currentProductId, newProductId);
                    }
                    
                    if (newRefill && currentRefill != newRefill) {
                        refillCustomer.updateRefill(sorList[idx].ID, currentProductId, newRefillPeriod, newRefillInterval);
                    }

                    viewSubscription();
                } else {
                    refillCustomer.changeOrderProductQtd(sorList[idx].ID, currentProductId, quantity);
                    if (newProductId && currentProductId != newProductId) {
                        refillCustomer.changeOrderProductId(sorList[idx].ID, currentProductId, newProductId);
                    }
                    
                    viewSubscription(); 
                }
            } else {
                var selectedProductObj  = ProductMgr.getProduct(sorList[idx].products[prodIdx].ID),
                    commitment          = refillCustomer.checkCommitmentStatus(sorList[idx].products[prodIdx]),
                    selectedPeriodicity = sorList[idx].products[prodIdx].periodicity,
                    selectedInterval    = sorList[idx].products[prodIdx].interval;
                
                app.getView({
                    ContinueURL        : URLUtils.https('SmartOrderRefillReport-SaveProduct', 'sid', sorList[idx].ID, 'item', sorList[idx].products[prodIdx].ID, 'viewType', viewType, 'client', currentCustomer.profile.customerNo, 'sorType', params.sorType.stringValue),
                    SubscriptionListID : sorList[idx].ID,
                    CustomerNo         : currentCustomer.profile.customerNo,
                    CanChangeProduct   : sorList[idx].products[prodIdx].canChangeProduct,
                    selectedProduct    : selectedProductObj,
                    commitment         : commitment,
                    selectedPeriodicity: selectedPeriodicity,
                    selectedInterval   : selectedInterval,
                    viewType           : viewType,
                    sorType            : params.sorType.stringValue
                }).render('bm/sor_editproduct');
            }
        }
    }
}

/**
 * This endpoint renders the edit credit card page for the customer subscription
 */
function viewCreditCardForm() {
    var currentCustomer = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue),
        sorList         = JSON.parse(currentCustomer.profile.custom.SorSubscriptions),
        idx             = sorHelper.getIndexOfId(sorList, params.sid.stringValue);

    if (idx != -1) {
        var currentCountry         = require('*/cartridge/scripts/util/Countries').getCurrent({
            CurrentRequest: {
                locale: request.locale
            }
        }),
            applicablePaymentCards = dw.order.PaymentMgr.getPaymentMethod(METHOD_MERCADOPAGO_CREDIT).getApplicablePaymentCards(customer, currentCountry.countryCode, 0),
            currentCreditCard      = sorHelper.getCreditCardInformation(sorList[idx]),
            canUpdateAll           = false,
            expMonth, expYear;

        app.getForm('updatecard').object.type.setOptions(applicablePaymentCards.iterator());
        app.getForm('updatecard').clear();
        app.getForm('updatecard').setValue('type', (currentCreditCard.type == 'MasterCard') ? 'Master Card' : currentCreditCard.type);
        app.getForm('updatecard').setValue('number', currentCreditCard.number);

        if (currentCreditCard.expMonth && currentCreditCard.expYear) {
            expMonth = parseInt(currentCreditCard.expMonth);
            expYear  = parseInt(currentCreditCard.expYear);
            canUpdateAll = true;
        } else {
            var expDate = new Date(sorList[idx].cardExpirationDate);

            expMonth = expDate.getMonth() + 1;
            expYear  = expDate.getFullYear();
        }
        app.getForm('updatecard.expiration').setValue('month', expMonth);
        app.getForm('updatecard.expiration').setValue('year', expYear);

        app.getView({
            ContinueURL        : URLUtils.https('SmartOrderRefillReport-UpdateCard', 'sid', sorList[idx].ID, 'client', currentCustomer.profile.customerNo, 'viewType', sorConstants.VIEWTYPE.SUBSCRIPTION, 'sorType', params.sorType.stringValue),
            SubscriptionListID : sorList[idx].ID,
            CustomerNo         : currentCustomer.profile.customerNo,
            viewType           : sorConstants.VIEWTYPE.SUBSCRIPTION,
            sorType            : params.sorType.stringValue,
            canUpdateAll       : canUpdateAll
        }).render('bm/sor_updatecard');
    }
}

/**
 * This endpoint saves the credit card changes for the customer subscription
 */
function updateCard() {
    var currentCustomer = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue),
        sorList         = JSON.parse(currentCustomer.profile.custom.SorSubscriptions),
        idx             = sorHelper.getIndexOfId(sorList, params.sid.stringValue);
    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });    

    if (idx != -1) {
        if (forms.updatecard.number.value) {
            try {
                refillCustomer.updateCreditCardFinish(sorList[idx].ID, forms);
            } 
            catch(err) {
                SORLogger.error('Error updating credit card information for SOR customer. Error: {0}', err)
            } 
            finally {
                viewSubscription();
            }   

        } else {
            app.getView({
                ContinueURL        : URLUtils.https('SmartOrderRefillReport-UpdateCard', 'sid', sorList[idx].ID, 'client', currentCustomer.profile.customerNo, 'viewType', sorConstants.VIEWTYPE.SUBSCRIPTION, 'sorType', params.sorType.stringValue),
                SubscriptionListID : sorList[idx].ID,
                CustomerNo         : currentCustomer.profile.customerNo,
                viewType           : sorConstants.VIEWTYPE.SUBSCRIPTION,
                sorType            : params.sorType.stringValue
            }).render('bm/sor_updatecard');
        }
    }
}

/**
 * This endpoint handles the ajax request to cancel the customer subscription
 */
function cancelSubscription() {
    var customerId       = params.client.stringValue,
        currentCustomer  = CustomerMgr.getCustomerByCustomerNumber(customerId),
        subscriptionId   = params.sid.stringValue,
        subscriptionsUrl = "";

    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });
    
    if (refillCustomer.checkBeforeCancel('subscription', subscriptionId).status == false) {
        if (forms.cancelationfee.save.submitted) {
            var fee = forms.cancelationfee.fee.value;
            refillCustomer.cancelSubscriptionWithCommitment(subscriptionId, fee);
            subscriptionsUrl = URLUtils.https('SmartOrderRefillReport-ShowSubscriptions', 'client', customerId).toString();
        } else {
            app.getForm('cancelationfee').clear();
            subscriptionsUrl = URLUtils.https('SmartOrderRefillReport-CancelationFee', 'client', customerId, 'sid', subscriptionId).toString();
        }
    } else {
        refillCustomer.cancelSubscription(subscriptionId);
        subscriptionsUrl = URLUtils.https('SmartOrderRefillReport-ShowSubscriptions', 'client', customerId).toString();
    }  
    
    renderJSON({
        subscriptionsUrl: subscriptionsUrl,
    });
}
/**
 * This endpoint handles the ajax request to pause the customer subscription
 */
function pauseSubscription() {
    var subscriptionID = params.sid.stringValue, 
        customerId       = params.client.stringValue,
        currentCustomer  = CustomerMgr.getCustomerByCustomerNumber(customerId);
    
        
    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });

    refillCustomer.pauseSubscription(subscriptionID);

    var showSubscriptions = URLUtils.https('SmartOrderRefillReport-ShowSubscriptions', 'client', params.client.stringValue, 'sid', params.sid.stringValue).toString();
    renderJSON({
            reloadUrl: showSubscriptions
        })
}

/**
 * This endpoint handles the ajax request to reactivate a paused customer subscription
 */
function reactivateSubscription() {
    var subscriptionID = params.sid.stringValue, 
        customerId       = params.client.stringValue,
        currentCustomer  = CustomerMgr.getCustomerByCustomerNumber(customerId);
    
    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });

    if (params.reactiveType.stringValue == 'remaining') {
        refillCustomer.reactivateSubscriptionFinish(subscriptionID, true);
    
    } else {
        refillCustomer.reactivateSubscriptionFinish(subscriptionID, false);
   }

    renderJSON({reloadUrl: URLUtils.https('SmartOrderRefillReport-ShowSubscriptions', 'client', params.client.stringValue, 'sid', params.sid.stringValue).toString()});
}

/**
 * This endpoint renders a modal to ask for the type of reactivation that will be alied to the paused customer subscription
 */
function reactivateSubscriptionPeriod() {

    app.getView({
        validUntil : params.remainDate.stringValue,
        oneYear    : params.oneYear.stringValue,
        sid        : params.sid.stringValue,
        client     : params.client.stringValue
    }).render('bm/sor_reactivate_time');
}

/**
 * This endpoint handles the removal of a product from the customer subscription / order
 */
function removeProduct() {
    var customerId       = params.client.stringValue,
        currentCustomer  = CustomerMgr.getCustomerByCustomerNumber(customerId),
        subscriptionId   = params.sid.stringValue,
        item             = params.item.stringValue,
        viewType         = params.viewType.stringValue,
        subscriptionsUrl = "";

    var refillCustomer = new RefillCustomerModel({
        preferences : Site.current.preferences,
        customer    : currentCustomer
    });
    
    if (subscriptionId) {
        if (refillCustomer.checkBeforeCancel('subscription', subscriptionId, item).status == false) {
            if (forms.cancelationfee.save.submitted) {
                var fee = forms.cancelationfee.fee.value;
                refillCustomer.removeSubscriptionProductWithCommitment(subscriptionId, item, fee);
                viewSubscription();
            } else {
                app.getForm('cancelationfee').clear();
                subscriptionsUrl = URLUtils.https('SmartOrderRefillReport-CancelationFee', 'client', customerId, 'sid', subscriptionId, 'item', item).toString();
                renderJSON({
                    subscriptionsUrl: subscriptionsUrl
                });
            }
        } else {
            refillCustomer.removeSubscriptionProduct(subscriptionId, item);
            viewSubscription();
        }
    } else {
        refillCustomer.removeOrderProduct(params.oid.stringValue, item);
        viewSubscription();
    }
}

/**
 * This endpoint renders a modal for choosing the fee for canceling a subscription / order that has commitment or removing a product that has commitment
 */
function cancelationFee() {
    var subscriptionId = params.sid.stringValue,
        oredrId        = params.oid.stringValue,
        customer       = params.client.stringValue,
        item           = params.item.stringValue,
        continueURL    = "";
    
    if (item) {
        continueURL = URLUtils.https('SmartOrderRefillReport-RemoveProduct', 'sid', subscriptionId, 'client', customer, 'item', item);
    } else {
        if (subscriptionId) {
            continueURL = URLUtils.https('SmartOrderRefillReport-CancelSubscription', 'sid', subscriptionId, 'client', customer);
        } else {
            continueURL = URLUtils.https('SmartOrderRefillReport-ManageOrders', 'oid', oredrId, 'client', customer, 'action', 'canceled');
        }
     }

    app.getView({
            SubscriptionListID : subscriptionId,
            customer           : customer,
            continueURL        : continueURL
        }).render('bm/sor_cancelationfee');
}

/**
 * Show a subscription's orders
 */
function showOrders() {
    var currentCustomer = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue),
        subscriptionID  = params.sid.stringValue;

    if (subscriptionID) {
        var tempList  = JSON.parse(currentCustomer.profile.custom.SorOrders),
            orderList = [];

        for each (var order in tempList) {
            if (order.subscriptionID == subscriptionID) {
                orderList.push(order);
            }
        }

        app.getView({
            OrdersList         : orderList,
            CustomerNo         : currentCustomer.profile.customerNo,
            SubscriptionListID : subscriptionID,
            sorType            : params.sorType.stringValue
        }).render('bm/sor_nextorders');
    }
}

/**
 * Reschedule a subscription's orders
 */
function reschedule() {
    var currentCustomer = CustomerMgr.getCustomerByCustomerNumber(params.client.stringValue),
        orderList       = JSON.parse(currentCustomer.profile.custom.SorOrders),
        idx             = sorHelper.getIndexOfId(orderList, params.oid.stringValue);

    if (idx != -1) {
        orderList[idx].status = sorConstants.STATUS.SCHEDULED;
        Transaction.wrap(function() {
            currentCustomer.profile.custom.SorOrders = JSON.stringify(orderList);
        });
        showOrders();
    }
}

/**
 * This endpoint renders the Orders Summary search page
 * This page is used to search for customer orders and filter by criteria Start Date, End Date, Customer Email, Product id/name, order status
  */
function ordersSummary () {
    app.getView({navigation: 'orderSummary'}).render('bm/osf_smartorderrefill_report');
}

/**
 * Generates paging model for orders/subscription search results
 * @param {Object[]} elements a colection of Objects representing the scheduled order/subscriptions stored in the customer profile 
 */
function constructPagingModel(elements) {
    const defaultPaginationSize = 10;
    var parameterMap            = request.httpParameterMap;
    var pageSize                = parameterMap.sz.intValue || defaultPaginationSize;
    var start                   = parameterMap.start.intValue || 0;
    var elementsPagingModel        = new PagingModel(elements);

    elementsPagingModel.setPageSize(pageSize);
    elementsPagingModel.setStart(start);

    return elementsPagingModel;
}

/**
 * Function responsible for filtering the cumulative list of all scheduled orders belonging to all SOR customers acording to search criteria 
 * @param {Object[]} allLists colection of all orders belonging to all SOR customers
 * @param {Date} reportDateStart start date filter
 * @param {Date} reportDateEnd end date filter
 * @param {String} customerEmail customer email filter
 * @param {String} orderProductID product id filter 
 * @param {String} orderProduct product name filter
 * @param {Boolean} productCounts 
 * @param {Boolean} ordersScheduled flag to include orders with status "scheduled" in the filtered results
 * @param {Boolean} ordersCanceled flag to include orders with status "canceled" in the filtered results
 * @param {Boolean} ordersProcessed flag to include orders with status "procesed" in the filtered results
 */
function validateAndReturnOrders(allLists, reportDateStart, reportDateEnd, customerEmail, orderProduct, productCounts, ordersScheduled, ordersCanceled, ordersProcessed,
                                ordersOther) {
                              
    var orders       = new ArrayList(),
        productCount = new dw.util.HashMap(),
        totalAmount  = {},
        dateStart, dateEnd;
                               
    if (empty(reportDateStart)){
        dateStart = new Date(1990);
    } else {
        dateStart = new Date(reportDateStart);
    }                                
    if (empty(reportDateEnd)) {
        dateEnd = new Date(2045, 11, 11)
    } else {
        dateEnd = new Date(reportDateEnd)
    }

    var newEndDate = dateEnd.setHours(23,59,59);
    for each (var tempList in allLists) {

        //Filteres scheduled orders by customer email if it was specified as filtering parameter
        if (customerEmail) {
            var customer = dw.customer.CustomerMgr.getCustomerByCustomerNumber(tempList.customerNo);
            if (customer && customer.profile && customer.profile.email && customer.profile.email.indexOf(customerEmail) == -1) {
                continue;
            }
        }
       
        var orderCreatedAt = new Date(tempList.createdAt); 
        if (dateStart <= orderCreatedAt && orderCreatedAt <= newEndDate) {

            //Filteres scheduled orders by product name or ID if it was specified as filtering parameter
            if (orderProduct) {
                var flag = false;
                for each (var productItem in tempList.products) {
                    if (productItem && ProductMgr.getProduct(productItem.ID) && ProductMgr.getProduct(productItem.ID).getName().indexOf(orderProduct) != -1) {
                        flag = true;
                        break;
                    }
                    if (productItem && productItem.ID == orderProduct) {
                        flag = true;
                        break;
                    }
                }
                if (!flag) continue;
            }
            //Filteres scheduled orders by scheduled status if flag was chosen 
            if (ordersScheduled == false) {
                if (tempList.status == 'scheduled' || tempList.status == 'updated') {
                    continue;
                }
            }
            //Filteres scheduled orders by canceled status if flag was chosen 
            if (ordersCanceled == false) {
                if (tempList.status == 'canceled' || tempList.status == 'deleted') {
                    continue;
                }
            }
            //Filteres scheduled orders by procesed status if flag was chosen 
            if (ordersProcessed == false) {
                if (tempList.status == 'processed') {
                    continue;
                }
            }
            //Filteres scheduled orders by paused, cardexpired, outofstock status if Other flag was chosen 
            if (ordersOther == false) {
                if (tempList.status == 'paused' || tempList.status == 'cardexpired' || tempList.status == 'outofstock') {
                    continue;
                }
            }

            //calculates the sum of all scheduled orders taht have passed the filtering
            for each (var productItem in tempList.products) {
                if (totalAmount[productItem.currencyCode]) {
                    totalAmount[productItem.currencyCode] += parseFloat(productItem.price);
                } else {
                    totalAmount[productItem.currencyCode] = parseFloat(productItem.price)
                }
            }
            orders.push(tempList);
        }    
        
    }

    // The return result object
    return { 'orders': orders, 'productCount': productCount, 'totalAmount' : totalAmount};
}

/**
 * Retrives a colection of all scheduled orders belonging to all SOR customers  
 */
function getAllOrders () {
    var allCustomers = getAllCustomersWithSORSummary();
    var allOrders = new Array();
    try {
        for each (var currentCustomer in allCustomers) {
            var customerOrders = JSON.parse(currentCustomer.customer.profile.custom.SorOrders);
            for each (var tempOrder in customerOrders) {
                allOrders.push(tempOrder);
            }
        }
    } catch (error) {
        SORLogger.error('Error retrieving SOR customer scheduled orders. Error: {0}', error)
    }


    return allOrders;
}

/**
 * This endpoint handles the form submit for search results and exporting the search results to csv
 */
function handleSummaryFormFilter() {

    var searchForm = app.getForm('osfsorreport');

    searchForm.handleAction({
        filter: renderSummaryResults,
        export: function() {
            var reportDateStart = searchForm.getValue('reportDateStart'),
                reportDateEnd   = searchForm.getValue('reportDateEnd'),
                customerEmail   = searchForm.getValue('customerEmail'),
                orderProduct    = searchForm.getValue('orderProduct'),
                productCounts   = searchForm.getValue('productCounts'),
                ordersScheduled = searchForm.getValue('ordersScheduled'),
                ordersCanceled  = searchForm.getValue('ordersCanceled'),
                ordersProcessed = searchForm.getValue('ordersProcessed'),
                ordersOther     = searchForm.getValue('ordersOther');
            try {
                var allOrders = getAllOrders(reportDateStart, reportDateEnd);

                var result = validateAndReturnOrders(allOrders, reportDateStart, reportDateEnd, customerEmail, orderProduct,
                    productCounts, ordersScheduled, ordersCanceled, ordersProcessed, ordersOther);
                   
                var orders = result.orders;

                exportOrders(orders);
            }
            catch(err) {
                SORLogger.error("SmartOrderRefillReport.js - export methode of handleSummaryFormFilter - " + err);
            }
        },        
        error: function () {
            app.getView({navigation: 'orderSummary'}).render('bm/osf_smartorderrefill_report');
            return;
        }
    })

}

/**
* This function generates the csv export file based on the serach results 
* @param {Array} orders - returned by validateAndReturnOrders function
*/
function exportOrders(orders) {
    var Resource         = require('dw/web/Resource'),
        StringUtils      = require('dw/util/StringUtils'),
        File             = require('dw/io/File'),
        FileWriter       = require('dw/io/FileWriter'),
        CSVStreamWriter  = require('dw/io/CSVStreamWriter');
    
    var headers = [
        Resource.msg('report.tableheader.customer','sor_smartorderrefill',null), 
        Resource.msg('report.tableheader.orderdate','sor_smartorderrefill',null),
        Resource.msg('report.tableheader.status','sor_smartorderrefill',null),
        Resource.msg('report.tableheader.subscriptionid','sor_smartorderrefill',null),
        Resource.msg('report.tableheader.productid','sor_smartorderrefill',null),
        Resource.msg('report.tableheader.productname','sor_smartorderrefill',null),
        Resource.msg('report.tableheader.productprice','sor_smartorderrefill',null)
    ];

    var path = File.IMPEX + File.SEPARATOR + 'src' + File.SEPARATOR + 'SmartOrderRefillReports/Exports/Orders/'
    var dirTarget = new File(path);
    if (!dirTarget.exists()) {
        dirTarget.mkdirs();
    }
    var fileName         = ['Exp_order_', StringUtils.formatCalendar(new Calendar(), "yyyy_MM_dd_HHmmss"), '.csv'].join(''),
        file             = new File(path + fileName),
        fileWriter       = new FileWriter(file);
        csw              = new CSVStreamWriter(fileWriter);   

    if (headers != null) {
        csw.writeNext(headers);
        headers = null;
    }
    try {
        for each (var order in orders) {
            for each (var productLine in order.products) {
                var line = [
                    dw.customer.CustomerMgr.getCustomerByCustomerNumber(order.customerNo).getProfile().getEmail(),
                    order.ID.split(order.subscriptionID + '-')[1],
                    order.status,
                    order.subscriptionID,
                    productLine.ID,
                    dw.catalog.ProductMgr.getProduct(productLine.ID).getName(),
                    productLine.price + ' ' + productLine.currencyCode
                ];
                csw.writeNext(line); 
            } 
        }
    }
    catch(err) {
        SORLogger.error("SmartOrderRefillReport.js - exportOrders function - " + err);
        csw.writeNext([Resource.msg('forms.sorsubscriptions.exportError','sor_forms',null)]);
    }
    finally {
        csw.close();
        fileWriter.close();
        ISML.renderTemplate('bm/osf_smartorderrefill_report');
    }
}

/**
 * This endpoint handles the rendering of the order search results 
 */
function renderSummaryResults() {
    var searchForm = app.getForm('osfsorreport');

    var reportDateStart = searchForm.getValue('reportDateStart'),
        reportDateEnd   = searchForm.getValue('reportDateEnd'),
        customerEmail   = searchForm.getValue('customerEmail'),
        orderProduct    = searchForm.getValue('orderProduct'),
        productCounts   = searchForm.getValue('productCounts'),
        ordersScheduled = searchForm.getValue('ordersScheduled'),
        ordersCanceled  = searchForm.getValue('ordersCanceled'),
        ordersProcessed = searchForm.getValue('ordersProcessed'),
        ordersOther     = searchForm.getValue('ordersOther');                                                                                               

    var allOrders = getAllOrders();
    
    var result = validateAndReturnOrders(allOrders, reportDateStart, reportDateEnd, customerEmail, orderProduct,
            productCounts, ordersScheduled, ordersCanceled, ordersProcessed, ordersOther);

    var orders           = result.orders,
        productCount     = result.productCount,
        totalAmount      = result.totalAmount,
        orderPagingModel = constructPagingModel(orders);

    ISML.renderTemplate('bm/osf_smartorderrefill_report', {
        productCount    : productCount,
        totalAmount     : totalAmount,
        OrderPagingModel: orderPagingModel,
        reportDateStart : reportDateStart,
        reportDateEnd   : reportDateEnd,
        customerEmail   : customerEmail,
        orderProduct    : orderProduct,
        productCounts   : productCounts,
        ordersScheduled : ordersScheduled,
        ordersCanceled  : ordersCanceled,
        ordersProcessed : ordersProcessed,
        ordersOther     : ordersOther,
        navigation      : 'orderSummary'
    });

}

/* =========== Subscription Reports ========== */

/**
 * This endpoint renders the Subscription Summary search page
 * This page is used to search for customer orders and filter by criteria Start Date, End Date, Customer Email
  */
function subscriptionsSummary () {
    app.getView({navigation: 'subscriptionSummary'}).render('bm/osf_smartorderrefill_report_subscriptions');
}

/**
 * Function responsible for filtering the cumulative list of all subscriptions belonging to all SOR customers acording to search criteria 
 * @param {Object[]} allLists colection of all subscriptions belonging to all SOR customers
 * @param {Date} reportDateStart start date filter
 * @param {Date} reportDateEnd end date filter
 * @param {String} customerEmail customer email filter
 * @param {String} subscriptionID subscription id filter
 */
function validateAndReturnSubscriptions(allLists, reportDateStart, reportDateEnd, customerEmail, subscriptionID) {

    var subscriptions = new ArrayList();
    var newEndDate = reportDateEnd.setHours(23,59,59)
    for each (var tempList in allLists) {
        var subCreatedAt = new Date(tempList.createdAt)
        //Filteres subscriptions by customer email if it was specified as filtering parameter
        if (customerEmail) {
            var customer = dw.customer.CustomerMgr.getCustomerByCustomerNumber(tempList.customerNo);
            if (customer && customer.profile && customer.profile.email && customer.profile.email.indexOf(customerEmail) == -1) {
                continue;
            }
        }
        if(reportDateStart != null && reportDateEnd != null){
            if (reportDateStart <= subCreatedAt && subCreatedAt <= newEndDate) {
                if (subscriptionID != null) {
                    if (subscriptionID === tempList.ID) {
                        subscriptions.push(tempList);
                    }
                } else {
                    subscriptions.push(tempList);
                }  
            }
        } else if (subscriptionID != null) {
            if (subscriptionID === tempList.ID) {
                subscriptions.push(tempList);
            }
        } 
        else {
            subscriptions.push(tempList);
        }            
    }
   
    // The return result object
    return { 'subscriptions': subscriptions, 'productCount': {} };
}

/**
 * Retrives a colection of all subscriptions belonging to all SOR customers  
 */
function getAllSubscriptions () {
    var allCustomers = getAllCustomersWithSORSummary(); 
    var allSubscriptions = new Array();
    try {
        for each (var currentCustomer in allCustomers) {
            var customerSubscriptions = JSON.parse(currentCustomer.customer.profile.custom.SorSubscriptions);
            for each (var tempSubscription in customerSubscriptions) {
                allSubscriptions.push(tempSubscription);
            }
        }
    } catch (error) {
        SORLogger.error('Error retrieving SOR customer scheduled orders. Error: {0}', error)
    }

    return allSubscriptions;
}

/**
 * This endpoint handles the form submit for search results and exporting the search results to csv
 */
function handleSubscriptionFormFilter() {

    var searchForm = app.getForm('osfsorreport');

    searchForm.handleAction({
        filter: renderSubscriptionSummaryResults,
        export: function () {
            var reportDateStart = searchForm.getValue('reportDateStart'),
                reportDateEnd   = searchForm.getValue('reportDateEnd'),
                customerEmail   = searchForm.getValue('customerEmail');
            try {
                var allSubscriptions = getAllSubscriptions(new Date(reportDateStart), new Date(reportDateEnd));

                var result = validateAndReturnSubscriptions(allSubscriptions, reportDateStart, reportDateEnd, customerEmail);

                var subscriptions = result.subscriptions;

                exportSubscriptions(subscriptions);
            }
            catch(err) {
                SORLogger.error("SmartOrderRefillReport.js - export function - " + err);    
            }                  
        },
        error: function () {
            ISML.renderTemplate('bm/osf_smartorderrefill_report_subscriptions');
            return;
        }
    })

}

/**
 * This endpoint handles the rendering of the subscription search results 
 */
function renderSubscriptionSummaryResults() {
    var searchForm = app.getForm('osfsorreport');

    var reportDateStart = searchForm.getValue('reportDateStart'),
        reportDateEnd   = searchForm.getValue('reportDateEnd'),
        customerEmail   = searchForm.getValue('customerEmail'),
        subscriptionID  = searchForm.getValue('subscriptionID');

    var allSubscriptions = getAllSubscriptions();
  
    var result = validateAndReturnSubscriptions(allSubscriptions, reportDateStart, reportDateEnd, customerEmail, subscriptionID);

    var subscriptions = result.subscriptions;

    var subscriptionPagingModel = constructPagingModel(subscriptions);

    ISML.renderTemplate('bm/osf_smartorderrefill_report_subscriptions', {
        subscriptionPagingModel : subscriptionPagingModel,
        reportDateStart         : reportDateStart,
        reportDateEnd           : reportDateEnd,
        customerEmail           : customerEmail,
        navigation              : 'subscriptionSummary'
    });
}
/**
* This function generates the csv export file based on the serach results 
* @param {Array} subscriptions - returned by validateAndReturnSubscriptions function
*/
function exportSubscriptions(subscriptions) {
    var Resource         = require('dw/web/Resource'),
        StringUtils      = require('dw/util/StringUtils'),
        File             = require('dw/io/File'),
        FileWriter       = require('dw/io/FileWriter'),
        CSVStreamWriter  = require('dw/io/CSVStreamWriter');
    
    var headers = [
        Resource.msg('report.tableheader.subscriptionid','sor_smartorderrefill',null), 
        Resource.msg('report.tableheader.customer','sor_smartorderrefill',null),
        Resource.msg('report.tableheader.validuntil','sor_smartorderrefill',null),
        Resource.msg('report.tableheader.status','sor_smartorderrefill',null),
        Resource.msg('report.tableheader.productid','sor_smartorderrefill',null),
        Resource.msg('report.tableheader.productname','sor_smartorderrefill',null)
    ];    

    var path = File.IMPEX + File.SEPARATOR + 'src' + File.SEPARATOR + 'SmartOrderRefillReports/Exports/Subscriptions/';    
    var dirTarget = new File(path);
    if (!dirTarget.exists()) {
        dirTarget.mkdirs();
    }    

    var fileName         = ['Export_', StringUtils.formatCalendar(new Calendar(), 'yyyy_MM_dd_HHmmss'), '.csv'].join(''),
        file             = new File(path + fileName),
        fileWriter       = new FileWriter(file),
        csw              = new CSVStreamWriter(fileWriter);

    if (headers != null) {
        csw.writeNext(headers);
        headers = null;
    }
    try {
        for each (var subscription in subscriptions) {
            for each (var product in subscription.products) {   
                var line = [
                    subscription.ID,
                    dw.customer.CustomerMgr.getCustomerByCustomerNumber(subscription.customerNo).getProfile().getEmail(),
                    subscription.validUntil,
                    subscription.status,
                    product.ID,
                    dw.catalog.ProductMgr.getProduct(product.ID).getName()
                ];
                csw.writeNext(line);
            } 
        }
    }
    catch(err) {
        SORLogger.error("SmartOrderRefillReport.js - exportSubscriptions function - " + err);
        csw.writeNext([Resource.msg('forms.sorsubscriptions.exportError','sor_forms',null)]);
    }
    finally {
        csw.close();
        fileWriter.close();
        ISML.renderTemplate('bm/osf_smartorderrefill_report_subscriptions');
    }
   
}

/**
 * Creates a list of all customers that have active Smart Order Refill subscriptions
 * @returns {Array}
 */
function getAllCustomersWithSOR() {
    return CustomerMgr.searchProfiles('custom.hasSmartOrderRefill={0} OR custom.hasStandBySubscriptions={1}', null, true, true); 
}
/**
 * Creates a list of all customers that have used Smart Order Refill
 * @returns {Array}
 */
function getAllCustomersWithSORSummary() {
    return CustomerMgr.searchProfiles("", null);
}

/**
 * This function renders a object as a json response
 * @param {Object} object 
 */
function renderJSON(object) {
    response.setContentType('application/json');

    let json = JSON.stringify(object);
    response.writer.print(json);
};

/*
 * Web exposed methods
 */
exports.Manage                       = guard.all(manage);
exports.ManageSOR                    = guard.all(manageSOR);
exports.ShowSubscriptions            = guard.all(showSubscriptions);
exports.ViewSubscription             = guard.all(viewSubscription);
exports.ViewOrder                    = guard.all(viewOrder);
exports.OrderDetails                 = guard.all(orderDetails);
exports.ManageOrders                 = guard.all(manageOrders);
exports.UpdateRenewal                = guard.all(updateRenewal);
exports.ViewChangeAddress            = guard.all(viewChangeAddress);
exports.ChangeAddress                = guard.all(changeAddress);
exports.RemoveProduct                = guard.all(removeProduct);
exports.EditProduct                  = guard.all(editProduct);
exports.SaveProduct                  = guard.all(saveProduct);
exports.ViewCreditCardForm           = guard.all(viewCreditCardForm);
exports.UpdateCard                   = guard.all(updateCard);
exports.CancelSubscription           = guard.all(cancelSubscription);
exports.CancelationFee               = guard.all(cancelationFee);
exports.PauseSubscription            = guard.all(pauseSubscription);
exports.ReactivateSubscription       = guard.all(reactivateSubscription);
exports.ReactivateSubscriptionPeriod = guard.all(reactivateSubscriptionPeriod);
exports.ShowOrders                   = guard.all(showOrders);
exports.Reschedule                   = guard.all(reschedule);
exports.ExportOrders                 = guard.all(exportOrders);
exports.OrdersSummary                = guard.all(ordersSummary);
exports.SubscriptionsSummary         = guard.all(subscriptionsSummary);
exports.HandleSummaryFormFilter      = guard.all(handleSummaryFormFilter);
exports.HandleSummaryPagination      = guard.all(renderSummaryResults);
exports.HandleSubscriptionFormFilter = guard.all(handleSubscriptionFormFilter);
exports.HandleSubscriptionPagination = guard.all(renderSubscriptionSummaryResults);
