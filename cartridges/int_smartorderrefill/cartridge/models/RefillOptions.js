'use strict';
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
/**
 * This model is responsible for handling the Refill interval status of products
 */
var PERIODICITY = {
    MONTH : 'month',
    WEEK  : 'week'
}

var productLineItem = null;
var preferences = null;

/**
 * This function generates a JS representation of Smart Order Refill site preference values 
 * @param {dw.system.SitePreferences} preferences 
 */
function getPreferences(preferences) {
    var preferenceObject = {
        "SorEnabled" : preferences.custom.SorEnabled,
        "SorOneTime" : preferences.custom.SorDeliveryOneTime,
        "SorDeliveryMonthInterval" : preferences.custom.SorDeliveryMonthInterval,
        "SorDeliveryWeekInterval" : preferences.custom.SorDeliveryWeekInterval,
        "SorDeliveryMonthCount" : preferences.custom.SorDeliveryMonthCount,
        "SorDeliveryWeekCount" : preferences.custom.SorDeliveryWeekCount
    }
    return preferenceObject;
}

/**
 * This functions retrives the product line item of the customer basket coresponding to a product ID or UUID
 * @param {dw.order.ProductLineItem[]} productLineItems 
 * @param {dw.catalog.Product} product 
 * @param {String} lineItemID 
 */
function getProductLineItem(productLineItems, product, lineItemID) {
    var lineitem = null;
    if (productLineItems.length > 0) {
        for (var index in productLineItems) {
            var productLineitem = productLineItems[index];
            if (!empty(lineItemID) && productLineitem.UUID == lineItemID) {
                lineitem = productLineitem;
                break;
            } if (!empty(product) && productLineitem.productID  == product.ID) {
                lineitem = productLineitem;
                break;
            }
        }
    }
    return lineitem;
}

/**
 * This function retrives the Samrt Order Refill related inforamtion of a product
 * @param {dw.catalog.Product} product 
 * @param {dw.system.SitePreferences} preferences 
 */
function getSorProductInfo(product, preferences) {
    var sorOptions = {
        isSor : false,
        commitment : 0,
        sorPrice : null
    }
    if (!empty(product)) {
        sorOptions.isSor = product.custom.SorProduct || false;
        sorOptions.commitment = product.custom.SorCommitment || 0;

        if (product.custom.SorProduct && preferences.custom.SorPriceBook) {
            var sorPriceBookID = request.session.currency.currencyCode.toLowerCase() + "-" + preferences.custom.SorPriceBook,
                PriceModel = product.getPriceModel();
            if (sorPriceBookID) {
                var sorPrice = PriceModel.getPriceBookPrice(sorPriceBookID).decimalValue;
                if (sorPrice) {
                    sorOptions.sorPrice = sorPrice;
                }
            }
        }
    }
    return sorOptions;
}

/**
 * This function retrives the week refill interval enabled on the site and the selected interval for the product line item if applicable
 * @param {dw.system.SitePreferences} preferences 
 * @param {dw.order.ProductLineItem} productLineItem 
 */
function getWeekIntervals(preferences, productLineItem) {
    var weekIntervals = {
        enabled : false,
        selected : false,
        intervals :[]
    };

    if (preferences.SorDeliveryWeekInterval.length > 0) {
        weekIntervals.enabled = true;
        var intervalSet = false;
        if (!empty(productLineItem) && productLineItem.custom.SorPeriodicity == PERIODICITY.WEEK) {
            intervalSet = true;
            var intervalValue = productLineItem.custom.SorWeekInterval;
        }
        for (var index in preferences.SorDeliveryWeekInterval) {
            var interval = preferences.SorDeliveryWeekInterval[index];
            var intervalObject = {
                value : interval,
                selected : false
            }
            if (intervalSet && interval == intervalValue) {
                intervalObject.selected = true;
                weekIntervals.selected = true;
                weekIntervals.selectedInterval = interval;
            }
            weekIntervals.intervals.push(intervalObject);
        }
    }
    return weekIntervals;
}

/**
 * This function retrives the month refill interval enabled on the site and the selected interval for the product line item if applicable
 * @param {dw.system.SitePreferences} preferences 
 * @param {dw.order.ProductLineItem} productLineItem 
 */
function getMonthInterval(preferences, productLineItem) {
    var monthIntervals = {
        enabled : false,
        selected : false,
        intervals :[]
    };

    if (preferences.SorDeliveryMonthInterval.length > 0) {
        monthIntervals.enabled = true;
        var intervalSet = false;
        if (!empty(productLineItem) && productLineItem.custom.SorPeriodicity == PERIODICITY.MONTH) {
            intervalSet = true;
            var intervalValue = productLineItem.custom.SorMonthInterval;
        }
        for (var index in preferences.SorDeliveryMonthInterval) {
            var interval = preferences.SorDeliveryMonthInterval[index];
            var intervalObject = {
                value : interval,
                selected : false
            }
            if (intervalSet && interval == intervalValue) {
                intervalObject.selected = true;
                monthIntervals.selected = true;
                monthIntervals.selectedInterval = interval;
            }
            monthIntervals.intervals.push(intervalObject);
        }
    }
    return monthIntervals;
}

/**
 * This function retrives the week refill count enabled on the site and the selected count for the product line item if applicable
 * @param {dw.system.SitePreferences} preferences 
 * @param {dw.order.ProductLineItem} productLineItem 
 */
function getWeekCount(preferences, productLineItem) {
    var weekIntervals = {
        enabled : false,
        selected : false,
        intervals :[]
    };

    if (preferences.SorDeliveryWeekCount > 0) {
        weekIntervals.enabled = true;
        var intervalSet = false;
        var weekCount = [];

        if (!empty(productLineItem) && productLineItem.custom.SorPeriodicity == PERIODICITY.WEEK) {
            intervalSet = true;
            var intervalValue = productLineItem.custom.SorWeekInterval;
        }

        for (var i = 1; i <= preferences.SorDeliveryWeekCount; i++) {
            weekCount.push(i);
        }

        for (var index in weekCount) {
            var interval = weekCount[index];
            var intervalObject = {
                value : interval.toFixed(0),
                selected : false
            }
            if (intervalSet && interval == intervalValue) {
                intervalObject.selected = true;
                weekIntervals.selected = true;
                weekIntervals.selectedInterval = interval;
            }
            weekIntervals.intervals.push(intervalObject);
        }
    }
    return weekIntervals;
}

/**
 * This function retrives the month refill count enabled on the site and the selected count for the product line item if applicable
 * @param {dw.system.SitePreferences} preferences 
 * @param {dw.order.ProductLineItem} productLineItem 
 */
function getMonthCount(preferences, productLineItem) {
    var monthIntervals = {
        enabled : false,
        selected : false,
        intervals :[]
    };

    if (preferences.SorDeliveryMonthCount > 0) {
        monthIntervals.enabled = true;
        var intervalSet = false;
        var monthCount = [];

        if (!empty(productLineItem) && productLineItem.custom.SorPeriodicity == PERIODICITY.MONTH) {
            intervalSet = true;
            var intervalValue = productLineItem.custom.SorMonthInterval;
        }

        for (var i = 1; i <= preferences.SorDeliveryMonthCount; i++) {
            monthCount.push(i);
        }

        for (var index in monthCount) {
            var interval = monthCount[index];
            var intervalObject = {
                value : interval.toFixed(0),
                selected : false
            }
            if (intervalSet && interval == intervalValue) {
                intervalObject.selected = true;
                monthIntervals.selected = true;
                monthIntervals.selectedInterval = interval;
            }
            monthIntervals.intervals.push(intervalObject);
        }
    }
    return monthIntervals;
}

// member functions

/**
 * This function returns the the Smart Order Refill status of the line item
 * @param {dw.order.ProductLineItem} productLineItem 
 */
function getIsSorChecked(productLineItem) {
    var isSorChecked = false;
        if(!empty(productLineItem) && productLineItem.custom.hasSmartOrderRefill) {
            isSorChecked = true;
        }
    return isSorChecked;
}

/**
 * This function updated the refill inforamtion of the product line item
 * @param {String} intervalType 
 * @param {Number} intervalValue 
 * @param {Boolean} hasRefill 
 */
function update(intervalType, intervalValue, hasRefill) {
    if (hasRefill) {
        add(intervalType, intervalValue);
    } else {
        remove();
    }
}

/**
 * This function sets the refill information of the product to no refill
 */
function remove() {
    productLineItem.custom.hasSmartOrderRefill = true;
    productLineItem.custom.SorMonthInterval = 0;
    productLineItem.custom.SorWeekInterval = 0;
    productLineItem.custom.SorPeriodicity = '';

    this.weekIntervals = getWeekIntervals(preferences, productLineItem);
    this.monthIntervals = getMonthInterval(preferences, productLineItem);

}

/**
 * This function add the refill interval and sets the refill status of the product line item
 * @param {String} intervalType 
 * @param {Number} intervalValue 
 */
function add(intervalType, intervalValue) {
    productLineItem.custom.hasSmartOrderRefill = true;
    productLineItem.custom.SorPeriodicity = intervalType;
    if (intervalType == PERIODICITY.WEEK) {
        productLineItem.custom.SorMonthInterval = 0;
        productLineItem.custom.SorWeekInterval = intervalValue;
    } else if (intervalType == PERIODICITY.MONTH) {
        productLineItem.custom.SorMonthInterval = intervalValue;
        productLineItem.custom.SorWeekInterval = 0;
    } else {
        productLineItem.custom.SorMonthInterval = 0;
        productLineItem.custom.SorWeekInterval = 0;
    }
    this.weekIntervals = getWeekIntervals(preferences, productLineItem);
    this.monthIntervals = getMonthInterval(preferences, productLineItem);
}

/**
 * Contructor function for the model
 * @param {Object} args 
 */
function RefillOptions(args) {
    preferences = getPreferences(args.preferences);
    productLineItem = getProductLineItem(args.productLineItems, args.product, args.lineItemID);
    var product = args.product;
    if (empty(product) && !empty(productLineItem)) {
        product = productLineItem.product;
    }

    var sorProdcutOptions = getSorProductInfo(product, args.preferences);

    this.isSORProduct = sorProdcutOptions.isSor;
    this.commitment = sorProdcutOptions.commitment;
    this.isSOREnabled = preferences.SorEnabled || false;
    this.sorOneTime = preferences.SorOneTime;
    this.weekIntervals = getWeekIntervals(preferences, productLineItem);
    this.monthIntervals = getMonthInterval(preferences, productLineItem);
    this.weekCount = getWeekCount(preferences, productLineItem);
    this.monthCount = getMonthCount(preferences, productLineItem);
    this.isSorChecked = getIsSorChecked(productLineItem);
    this.sorPrice = sorProdcutOptions.sorPrice;
    this.PERIODICITY = PERIODICITY;
}

RefillOptions.prototype.update = update;
RefillOptions.prototype.remove = remove;
RefillOptions.prototype.add = add;
module.exports = RefillOptions;