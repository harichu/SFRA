"use strict";

var server = require("server");
var csrfProtection = require("*/cartridge/scripts/middleware/csrf");
var consentTracking = require("*/cartridge/scripts/middleware/consentTracking");
var userLoggedIn = require("*/cartridge/scripts/middleware/userLoggedIn");
var instorePUstoreHelpers = require("*/cartridge/scripts/helpers/instorePickupStoreHelpers");
var Calendar = require("dw/util/Calendar");
var StringUtils = require("dw/util/StringUtils");
var OrderMgr = require("dw/order/OrderMgr");
var StoreMgr = require("dw/catalog/StoreMgr");
var CustomerMgr = require("dw/customer/CustomerMgr");
var Resource = require("dw/web/Resource");
var URLUtils = require("dw/web/URLUtils");
var Site = require("dw/system/Site");
var orderHelpers = require("*/cartridge/scripts/order/orderHelpers");

var sitePreferences = Site.current.preferences.custom;

server.extend(module.superModule);

server.append(
    "Confirm",
    consentTracking.consent,
    server.middleware.https,
    csrfProtection.generateToken,

    function (req, res, next) {
        var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");

        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

        var viewData = res.getViewData();

        if (viewData.order.shipping[0].selectedShippingMethod.storePickupEnabled) {
            viewData.order.pickupTime = instorePUstoreHelpers.getPickUpInStoreDateAndTime(viewData.order.creationDate);
            var pickUpTimeCalendar = new Calendar(viewData.order.pickupTime);
            viewData.order.pickupTimeDayOfWeek = StringUtils.formatCalendar(pickUpTimeCalendar, "EEEE");
            viewData.order.pickupTimeMonth = StringUtils.formatCalendar(pickUpTimeCalendar, "MMMM");
            var pickUpStore = StoreMgr.getStore(OrderMgr.getOrder(viewData.order.orderNumber).shipments[0].custom.fromStoreId);
            viewData.order.pickUpStoreLatAndLng = {
                lat: pickUpStore.latitude,
                lng: pickUpStore.longitude
            };
        }
        var profile = CustomerMgr.queryProfile("email = {0}", viewData.order.orderEmail);
        viewData.userExists = !empty(profile);
        viewData.isDisplayPrescription = true;
        viewData.isPaymentAuthorized = req.querystring.isPaymentAuthorized === "true";
        res.setViewData(viewData);

        LoyaltyUtils.setGuestLoyaltyMember(false);
        LoyaltyUtils.setSpecificCustomerGroup(false);

        next();
    }
);

server.replace(
    "Details",
    consentTracking.consent,
    server.middleware.https,
    userLoggedIn.validateLoggedIn,
    function (req, res, next) {
        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

        var orderNo                  = req.querystring.orderID;
        var isOmsOrderServiceEnabled = sitePreferences.enableOmsOrderService;

        var order = isOmsOrderServiceEnabled ?
            orderHelpers.getOrder(orderNo) : 
            orderHelpers.getSfccOrder(orderNo);

        var currentCustomerEmail = req.currentCustomer.profile.email;
        var breadcrumbs          = [
            {
                htmlValue: Resource.msg("global.home", "common", null),
                url: URLUtils.home().toString()
            },
            {
                htmlValue: Resource.msg("page.title.myaccount", "account", null),
                url: URLUtils.url("Account-Show").toString()
            },
            {
                htmlValue: Resource.msg("label.orderhistory", "account", null),
                url: URLUtils.url("Order-History").toString()
            }
        ];

        if (!order.isHomeDelivery) {
            order.pickupTime          = instorePUstoreHelpers.getPickUpInStoreDateAndTime(order.rawCreationDate);
            var pickUpTimeCalendar    = new Calendar(order.pickupTime);
            order.pickupTimeDayOfWeek = StringUtils.formatCalendar(pickUpTimeCalendar, "EEEE");
            order.pickupTimeMonth     = StringUtils.formatCalendar(pickUpTimeCalendar, "MMMM");
        }

        if (order.CustomerEMailID === currentCustomerEmail) {
            var exitLinkText = Resource.msg("link.orderdetails.orderhistory", "account", null);
            var exitLinkUrl =
                URLUtils.https("Order-History", "orderFilter", req.querystring.orderFilter);
            res.render("account/orderDetails", {
                order: order,
                isOmsOrderServiceEnabled : isOmsOrderServiceEnabled,
                exitLinkText: exitLinkText,
                exitLinkUrl: exitLinkUrl,
                breadcrumbs: breadcrumbs
            });
        } else {
            res.redirect(URLUtils.url("Account-Show"));
        }

        next();
    }
);

server.replace(
    "History",
    consentTracking.consent,
    server.middleware.https,
    userLoggedIn.validateLoggedIn,
    function (req, res, next) {
        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

        var isOmsOrderServiceEnabled = sitePreferences.enableOmsOrderService;
        var orderList                = [];
        
        orderList = isOmsOrderServiceEnabled ?
            orderHelpers.getCustomerOrderList(req.currentCustomer.profile.email, "date", "desc") :
            orderHelpers.getCustomerSfccOrderList(req.currentCustomer.profile.customerNo);

        var breadcrumbs   = [
            {
                htmlValue: Resource.msg("global.home", "common", null),
                url: URLUtils.home().toString()
            },
            {
                htmlValue: Resource.msg("label.profile", "account", null),
                url: URLUtils.url("Account-Show").toString()
            },
            {
                htmlValue: Resource.msg("label.orderhistory", "account", null),
                url: ""
            }
        ];

        res.render("account/order/history", {
            orders: orderList,
            isOmsOrderServiceEnabled : isOmsOrderServiceEnabled,
            orderFilter: req.querystring.orderFilter,
            accountlanding: false,
            breadcrumbs: breadcrumbs,
            sidebarCurrent : "mydata"
        });
        next();
    }
);

server.get(
    "SortHistory",
    csrfProtection.generateToken,
    function (req, res, next) {
        var renderTemplateHelper = require("*/cartridge/scripts/renderTemplateHelper");
        
        var isOmsOrderServiceEnabled = sitePreferences.enableOmsOrderService;
        var customerEmail = req.currentCustomer.profile.email;
        var sortingAttr   = req.querystring.attr;
        var sortingOrder  = req.querystring.order;
        
        var updatedURL = URLUtils.url("Order-SortHistory", "attr", sortingAttr, "order", (sortingOrder === "asc" ? "desc" : "asc")).toString();
        var orderList  = orderHelpers.getCustomerOrderList(customerEmail, sortingAttr, sortingOrder);

        res.json({
            sortingAttr        : sortingAttr,
            updatedURL         : updatedURL,
            addresListTemplate : renderTemplateHelper.getRenderedHtml({
                isOmsOrderServiceEnabled : isOmsOrderServiceEnabled,
                orders : orderList
            }, "account/order/orderList")
        });

        return next();
    }
);

server.get(
    "SorModal",
    csrfProtection.generateToken,
    function (req, res, next) {
        var ProductMgr = require("dw/catalog/ProductMgr");

        var pids         = req.querystring.pids;
        var pidList      = pids.split(",");
        var sorProductID = null;

        for (let i = 0; i < pidList.length; i++) {
            var apiProduct = ProductMgr.getProduct(pidList[i]);

            if (apiProduct && apiProduct.custom.SorProduct) {
                sorProductID = apiProduct.ID;
                break;
            }
        }

        res.render("account/order/omsOrderSorModal", {
            sorProductID : sorProductID
        });
            
        return next();
    }
);

server.get(
    "AddSorProductsToCart",
    csrfProtection.generateToken,
    function (req, res, next) {
        var ProductMgr         = require("dw/catalog/ProductMgr");
        var BasketMgr          = require("dw/order/BasketMgr");
        var Transaction        = require("dw/system/Transaction");
        var cartHelper         = require("*/cartridge/scripts/cart/cartHelpers");
        var RefillOptionsModel = require("int_smartorderrefill/cartridge/models/RefillOptions.js");
        var sorHelper          = require("int_smartorderrefill/cartridge/scripts/SmartOrderRefillHelper.js");

        var orderNo        = req.querystring.orderNo;
        var intervalType   = req.querystring.sorIntervalType;
        var intervalValue  = Number(req.querystring.sorIntervalValue);
        var order          = orderHelpers.getOrder(orderNo);
        var currentBasket  = BasketMgr.getCurrentOrNewBasket();
        var sorProductList = [];
        var pliData        = {};

        order.OrderLines.OrderLine.forEach(function (lineItem) {
            var productID  = lineItem.Item.ItemID;
            var apiProduct = ProductMgr.getProduct(productID);

            if (apiProduct.custom.SorProduct) {
                sorProductList.push(apiProduct);
            }
        });

        if (currentBasket) {
            Transaction.wrap(function () {
                sorProductList.forEach(function (product) {
                    var result = cartHelper.addProductToCart(currentBasket, product.ID, 1);    
                    pliData[result.uuid] = product;
                });
                
                var productLineItems = currentBasket.allProductLineItems;

                for (var lineItemID in pliData) {
                    if (Object.prototype.hasOwnProperty.call(pliData, lineItemID)) {
                        var apiProduct    = pliData[lineItemID];
                        var refillOptions = new RefillOptionsModel({
                            product          : apiProduct,
                            productLineItems : productLineItems,
                            lineItemID       : lineItemID,
                            preferences      : Site.current.preferences
                        });
                        
                        refillOptions.update(intervalType, intervalValue, true);
                    }
                }

                sorHelper.checkForRefillProducts();
            });
        }

        res.json({
            success     : true,
            redirectUrl : URLUtils.url("Cart-Show").toString()
        });
            
        return next();
    }
);

module.exports = server.exports();
