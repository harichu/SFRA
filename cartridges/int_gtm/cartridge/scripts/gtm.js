/** DISCLAIMER
* "Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software. 
* Do not copy, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein."
*/

"use strict";
const Site = require("dw/system/Site");
const URLUtils = require("dw/web/URLUtils");

/**
 * checks if license is valid
 * @returns {Boolean}
 */
function isLicenseValid() {
    const OSFLicenseManager = require("*/cartridge/scripts/OSFLicenseManager");
    try {
        return OSFLicenseManager.getLicenseStatus("GTM").isValid;
    } catch (error) {
        return false;
    }
}

/**
 * returns current site currency
 * @returns {string} - current site currency
 */
function getCurrencyCode() {
    return !empty(session.currency) ? session.currency.currencyCode : Site.getCurrent().getDefaultCurrency().currencyCode;
}

/**
 * product name formatting
 * @param {string} name - unformatted name
 * @returns {string} - formatted name
 */
function nameFix(name) {
    let tempName = name.replace("\"", "").replace("'", "");
    return tempName;
}

/**
 * get primary category for the product what data needed
 * @param {Object} product - product object
 * @returns {string} - category name
 */
function getCategory(product) {
    let category = "unassigned";

    if (!product) {
        return category;
    }

    if (!product.master && "masterProduct" in product && product.masterProduct && product.masterProduct.primaryCategory) {
        category = product.masterProduct.primaryCategory.ID;
    } else if (product.primaryCategory) {
        category = product.primaryCategory.ID;
    }

    return category;
}

/**
 * returns array with all required for Google Analytics information about the products
 * used primarily in cart and checkout
 * @param {Object[]} Products - products, what data needed
 * @returns {string} - dataLayer JSON
 */
function gtmProducts(Products) {
    let transactionBasket = [];

    for (let i = 0; i < Products.length; i++) {
        let cat = getCategory(Products[i].product);
        transactionBasket.push({
            "id"       : Products[i].productID,
            "name"     : nameFix(Products[i].productName),
            "category" : cat,
            "price"    : ((Products[i].adjustedPrice.value) / (Products[i].quantityValue)).toFixed(2),
            "quantity" : Products[i].quantityValue
        });
    }

    return transactionBasket;
}

/**
 * create dataLayer for shown product tile
 * @param {string} productID - shown Product ID
 * @returns {string} - dataLayer JSON
 */
function gtmProductTile(productID) {
    let product      = dw.catalog.ProductMgr.getProduct(productID),
        name         = nameFix(product.getName()),
        currencyCode = getCurrencyCode(),
        productPrice = product.priceModel.price.value || product.priceModel.minPrice.value || "undefined",
        category     = getCategory(product);

    let dataLayer = {
        "event"      : "ImpressionsUpdate",
        "eventTypes" : "show",
        "ecommerce"  : {
            "currencyCode" : currencyCode,
            "impressions"  : {
                "category" : category,
                "name"     : name,
                "price"    : productPrice,
                "id"       : product.getID()
            }
        }
    };

    return JSON.stringify(dataLayer);
}

/**
 * create dataLayer for click and hover product tile
 * @param {string} productID - Product ID
 * @returns {string} - dataLayer JSON
 */
function gtmQuickView(productID) {
    let product      = dw.catalog.ProductMgr.getProduct(productID),
        name         = nameFix(product.getName());

    let dataLayer = {
        "event"      : "QuickView",
        "eventTypes" : "link,click,hover",
        "action"     : name,
        "label"      : URLUtils.url("Product-Show", "pid", productID).toString()
    };

    return JSON.stringify(dataLayer);
}

/**
 * create dataLayer for click and hover product tile in product name
 * @param {string} productID - Product ID
 * @returns {string} - dataLayer JSON
 */
function gtmProductName(productID) {
    let product      = dw.catalog.ProductMgr.getProduct(productID),
        name         = nameFix(product.getName());

    let dataLayer = {
        "event"      : "ProductName",
        "eventTypes" : "click,hover",
        "action"     : name,
        "label"      : URLUtils.url("Product-Show", "pid", productID).toString()
    };

    return JSON.stringify(dataLayer);
}

/**
 * create dataLayer for show product detail page
 * @param {string} productID - shown Product ID
 * @returns {string} - dataLayer JSON
 */
function gtmProductPDP(productID) {
    let product      = dw.catalog.ProductMgr.getProduct(productID),
        name         = nameFix(product.getName()),
        category     = getCategory(product),
        currencyCode = getCurrencyCode(),
        productPrice = product.priceModel.price.value || product.priceModel.minPrice.value || "undefined";

    let dataLayer = {
        "event"      : "DetailsProduct",
        "eventTypes" : "show",
        "ecommerce" : {
            "detail": {
                "currencyCode": currencyCode,
                "products": [{
                    "category": category,
                    "name"    : name,
                    "price"   : productPrice,
                    "id"      : product.getID()
                }]
            }
        }
    };

    return JSON.stringify(dataLayer);
}

/**
 * create dataLayer for add to cart
 * @param {string} productID - added Product ID
 * @returns {string} - dataLayer JSON
 */
function gtmAddToCart(productID, quantity, path) {
    let product      = dw.catalog.ProductMgr.getProduct(productID),
        name         = nameFix(product.getName()),
        currencyCode = getCurrencyCode(),
        category     = getCategory(product),
        productPrice = product.priceModel.price.value || product.priceModel.minPrice.value || "undefined";

    let dataLayer =  {
        "event"       : "showAddToCart",
        "eventTypes"  : "show",
        "label"       : path,
        "currencyCode": currencyCode,
        "ecommerce"   : {
            "add"     : {
                "products": [{
                    "name"    : name,
                    "id"      : product.getID(),
                    "category": category,
                    "quantity": quantity,
                    "price"   : productPrice,
                }]
            }
        }
    };

    return JSON.stringify(dataLayer);
}

/**
 * create dataLayer for remove from cart
 * @param {string} productID - removed Product ID
 * @returns {string} - dataLayer JSON
 */
function gtmRemoveFromCart(productID, eventTypes) {
    let product  = dw.catalog.ProductMgr.getProduct(productID),
        name     = nameFix(product.getName()),
        category = getCategory(product),
        productPrice = product.priceModel.price.value || product.priceModel.minPrice.value || "undefined";

    let dataLayer =  {
        "event"       : "showRemovedFromCart",
        "eventTypes"  : eventTypes,
        "ecommerce"   : {
            "remove"  : {
                "products": [{
                    "name"    : name,
                    "id"      : product.getID(),
                    "price"   : productPrice,
                    "category": category,
                }]
            }
        }
    };

    return JSON.stringify(dataLayer);
}

/**
 * create checkout dataLayer from current Basket
 * @param {number} step - checkout step
 * @returns {string} - dataLayer JSON
 */
function gtmCheckoutData(step, eventTypes) {
    const BasketMgr = require("dw/order/BasketMgr");
    let currentBasket = BasketMgr.getCurrentOrNewBasket();

    let dataLayer = {
        "event": "showCheckout",
        "eventTypes"  : eventTypes,
        "ecommerce": {
            "currencyCode": getCurrencyCode(),
            "checkout": {
                "products": gtmProducts(currentBasket.getAllProductLineItems())
            }
        }
    };

    if (dataLayer) {
        dataLayer.ecommerce.checkout.actionField = {"step": step};
    }

    return JSON.stringify(dataLayer);
}

/**
 * create order confirmation dataLayer from current Basket
 * @param {string} OrderNo - order number
 * @returns {string} - dataLayer JSON
 */
function gtmOrderConfirmation(OrderNo) {
    const OrderMgr = require("dw/order/OrderMgr");
    let Order = OrderMgr.getOrder(OrderNo);

    if (!Order) {
        return false;
    }

    let actionField = {
        "id"         : Order.orderNo,    // Transaction ID. Required for purchases and refunds.
        "affiliation": Site.current.name,
        "revenue"    : Order.totalGrossPrice.value,     // Total transaction value (incl. tax and shipping)
        "tax"        : Order.totalTax.value,
        "shipping"   : Order.shipments[0].shippingTotalPrice.value
    };

    let transactionCouponStatus = Order.couponLineItems.size();
    if (transactionCouponStatus) {
        actionField["coupon"] = Order.couponLineItems[0].couponCode;
    }

    let dataLayer = {
        "event"      : "OrderConfirmation",
        "eventTypes" : "show",
        "ecommerce": {
            "currencyCode": getCurrencyCode(),
            "purchase": {
                "actionField": actionField,
                "products"   : gtmProducts(Order.shipments[0].productLineItems)
            }
        }
    };

    return JSON.stringify(dataLayer);
}

function gtmEventData(event, action, label) {
    let dataLayer = {
        "event"      : event,
        "action"     : action,
        "label"      : label
    };

    return JSON.stringify(dataLayer);
}

function gtmEventListener(eventTypes, event, action, label) {
    if (!label) {
        label = request.httpURL.toString();
    }

    let dataLayer = {
        "event"      : event,
        "eventTypes" : eventTypes,
        "action"     : action,
        "label"      : label
    };

    return JSON.stringify(dataLayer);
}

function gtmPLP(productSearchResultList) {
    var impressions = [];
    
    productSearchResultList.forEach(function (searchResult) {
        var product = searchResult.productSearchHit.product;
        impressions.push({
            "category" : getCategory(product),
            "name"     : nameFix(product.getName()),
            "price"    : product.priceModel.price.value || product.priceModel.minPrice.value || "undefined",
            "id"       : product.ID
        });
    });

    var dataLayer = {
        "event"     : "showImpressionsUpdate",
        "ecommerce" : {
            "impressions" : impressions
        }
    };

    return JSON.stringify(dataLayer);
}

function gtmForm(eventTypes, action, label) {
    let dataLayer = {
        "event"      : "",
        "eventTypes" : "form," + eventTypes,
        "action"     : action,
        "label"      : label
    };

    return JSON.stringify(dataLayer);
}

function gtmAddDynamicData(selector, eventTypes, event, action, label) {
    if (!label) {
        label = request.httpURL.toString();
    }

    let dataLayer = {
        "selector"   : selector,
        "event"      : event,
        "eventTypes" : "add," + eventTypes,
        "action"     : action,
        "label"      : label
    };

    return JSON.stringify(dataLayer);
}

function gtmIsEnabled() {
    let gtmEnabled = Site.getCurrent().getCustomPreferenceValue("gtmEnabled");

    if (gtmEnabled && isLicenseValid()) {
        return true;
    } else {
        return false;
    }
}

function gtmSitePreferences() {
    return {
        GTM_ENABLED : Site.getCurrent().getCustomPreferenceValue("gtmEnabled"),
        GTM_CLICK   : Site.getCurrent().getCustomPreferenceValue("gtmClick"),
        GTM_HOVER   : Site.getCurrent().getCustomPreferenceValue("gtmHover"),
        GTM_SCROLL  : Site.getCurrent().getCustomPreferenceValue("gtmScroll")
    };
}


module.exports = {
    gtmProductTile       : gtmProductTile,
    gtmQuickView         : gtmQuickView,
    gtmProductName       : gtmProductName,
    gtmProductPDP        : gtmProductPDP,
    gtmPLP               : gtmPLP,
    gtmAddToCart         : gtmAddToCart,
    gtmRemoveFromCart    : gtmRemoveFromCart,
    gtmCheckoutData      : gtmCheckoutData,
    gtmOrderConfirmation : gtmOrderConfirmation,
    gtmEventData         : gtmEventData,
    gtmEventListener     : gtmEventListener,
    gtmForm              : gtmForm,
    gtmIsEnabled         : gtmIsEnabled,
    gtmSitePreferences   : gtmSitePreferences,
    gtmAddDynamicData    : gtmAddDynamicData
};
