/**
 * @module scripts/SmartOrderRefillHelper
 */
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
var ProductMgr            = require('dw/catalog/ProductMgr'),
    BasketMgr             = require('dw/order/BasketMgr'),
    CustomerMgr           = require('dw/customer/CustomerMgr'),
    Resource              = require('dw/web/Resource'),
    paymentIntegration    = require('int_smartorderrefill/cartridge/controllers/paymentIntegration/PaymentIntegration/'),
    sorConstants          = require('int_smartorderrefill/cartridge/scripts/SmartOrderRefillConstants.js'),
    InventoryCheckService = require("app_storefront_core/cartridge/scripts/services/InventoryCheckService"),
    productHelper         = require("*/cartridge/scripts/helpers/productHelpers"),
    sitePref              = dw.system.Site.getCurrent();

var METHOD_MERCADOPAGO_CREDIT = Resource.msg('payment.method.id', 'mercadoPagoPreferences', null);

/**
 * Verify Smart Order Refill License
 */
function verifyLicense() {
    var OSFLicenseManager = require('*/cartridge/scripts/OSFLicenseManager');
    try {
        return OSFLicenseManager.getLicenseStatus('DWORC').isValid;
    } catch (error) {
        return false;
    }
}


/**
 * Get Credit Card Information from Payment Processor Service
 */
function getCreditCardInformation(subsList) {
    var paymentMethod      = dw.order.PaymentMgr.getPaymentMethod(METHOD_MERCADOPAGO_CREDIT),
        paymentProcessorID = paymentMethod.getPaymentProcessor().getID(),
        creditCardInfo     = null;

    if (paymentIntegration[paymentProcessorID]) {
        if (paymentProcessorID == sorConstants.PAYMENTPROCESSOR.CYBERSOURCE) {
            var libCybersource    = require('int_cybersource/cartridge/scripts/cybersource/libCybersource'),
                CybersourceHelper = libCybersource.getCybersourceHelper(),
                csReference       = webreferences.CyberSourceTransaction,
                serviceRequest    = new csReference.RequestMessage();

            CybersourceHelper.addPaySubscriptionRetrieveService(serviceRequest, subsList.originalOrder, subsList.creditCardToken);
            var service         = paymentIntegration[paymentProcessorID].CreateService(),
                serviceResponse = service.call(serviceRequest);

            if (serviceResponse && serviceResponse.status == 'OK' && serviceResponse.object && serviceResponse.object.decision == 'ACCEPT') {
                var CardHelper = require('int_cybersource/cartridge/scripts/helper/CardHelper'),
                    cardType   = CardHelper.getCardType(serviceResponse.object.paySubscriptionRetrieveReply.cardType);

                creditCardInfo = {
                    number   : serviceResponse.object.paySubscriptionRetrieveReply.cardAccountNumber,
                    expMonth : serviceResponse.object.paySubscriptionRetrieveReply.cardExpirationMonth,
                    expYear  : serviceResponse.object.paySubscriptionRetrieveReply.cardExpirationYear,
                    type     : cardType
                };
            }
        }
    }
    return  creditCardInfo;
}

/**
 * Update Credit Card Information on Payment Processor Service
 */
function updateCreditCardInformation(form, subsList) {
    var paymentMethod      = dw.order.PaymentMgr.getPaymentMethod(METHOD_MERCADOPAGO_CREDIT),
        paymentProcessorID = paymentMethod.getPaymentProcessor().getID(),
        subscriptionID     = null;

    if (paymentIntegration[paymentProcessorID]) {
        if (paymentProcessorID == sorConstants.PAYMENTPROCESSOR.CYBERSOURCE) {
            var csReference    = webreferences.CyberSourceTransaction,
                serviceRequest = new csReference.RequestMessage();

            paymentIntegration[paymentProcessorID].UpdateCard(serviceRequest, form, subsList.originalOrder, subsList.creditCardToken);
            var service         = paymentIntegration[paymentProcessorID].CreateService(),
                serviceResponse = service.call(serviceRequest);

            if (serviceResponse && serviceResponse.status == 'OK' && serviceResponse.object && serviceResponse.object.decision == 'ACCEPT') {
                subscriptionID = (serviceResponse.object.paySubscriptionUpdateReply.subscriptionIDNew) ? serviceResponse.object.paySubscriptionUpdateReply.subscriptionIDNew : serviceResponse.object.paySubscriptionUpdateReply.subscriptionID;
            }
        }
    }
    return subscriptionID;
}

/**
 * Charge a cancelation fee on Payment Processor Service
 */
function chargeCancelationFee(subsList, cancelationFee) {
    var paymentMethod      = dw.order.PaymentMgr.getPaymentMethod(METHOD_MERCADOPAGO_CREDIT),
        paymentProcessorID = paymentMethod.getPaymentProcessor().getID();

    if (paymentIntegration[paymentProcessorID]) {
        if (paymentProcessorID == sorConstants.PAYMENTPROCESSOR.CYBERSOURCE) {
            var csReference    = webreferences.CyberSourceTransaction,
                serviceRequest = new csReference.RequestMessage();

            paymentIntegration[paymentProcessorID].ChargeFee(serviceRequest, subsList, cancelationFee);

            var service         = paymentIntegration[paymentProcessorID].CreateService(),
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
    }
    return false;
}

/**
 * Determines if all products are available for order
 */
function getProductItemsAvailability(productList) {
    var isInventoryCheckServiceEnabled = sitePref.getCustomPreferenceValue("enableOmsInventoryCheckService");

    if (isInventoryCheckServiceEnabled) {
        var formattedProductList = productList.products.map(function (product) {
            return {
                quantityValue : product.quantity,
                product       : {
                    ID : product.ID
                }
            };
        });

        if (productList.geolocation) {
            var radius          = sitePref.getCustomPreferenceValue("storelocatorRadius");
            var serviceResponse = InventoryCheckService.getStorePickupCandidates(
                productList.geolocation.lat,
                productList.geolocation.lng, 
                radius,
                formattedProductList
            ).object;
            
            return !serviceResponse.Message;
        } else {
            throw new Error("No geolocation data for \"" + productList.ID + "\"");
        }
    } else {
        var allProductsAvailable = true;
        for each (var productItem in productList.products) {
            var product = ProductMgr.getProduct(productItem.ID);
            if (!productHelper.getAvailabilityModel(product).orderable || !product.custom.SorProduct) {
                allProductsAvailable = false;
                break;
            }
        }

        return allProductsAvailable;
    }
}

/**
 * Verify if the price of any SOR product changed
 */
function getProductPricesChanges(productList) {
    var productsPrices = {
        changed  : false,
        products : []
    };
    var sorPriceBookID = null;
    
    var pref = dw.system.Site.current.preferences.custom;
    if (pref.SorPriceBook) {
        sorPriceBookID = request.session.currency.currencyCode.toLowerCase() + "-" + pref.SorPriceBook;
    }

    for each (var productItem in productList.products) {
        var product      = ProductMgr.getProduct(productItem.ID),
            currentPrice = product.priceModel.price.decimalValue;
            
        PriceModel = product.getPriceModel();
        if (sorPriceBookID) {
            var sorPrice = PriceModel.getPriceBookPrice(sorPriceBookID).decimalValue;
            if (sorPrice) {
                currentPrice = sorPrice;
            }
        }    

        if (currentPrice != productItem.price) {
            productsPrices.changed = true;
            productsPrices.products.push({
                ID       : productItem.ID,
                name     : product.name,
                oldPrice : productItem.price,
                newPrice : currentPrice
            });
        }
    }
    return productsPrices;
}

/**
 * Calculate basket taxation
 */
function calculateTax(basket) {
    var ShippingLocation = require('dw/order/ShippingLocation'),
        TaxMgr           = require('dw/order/TaxMgr'),
        shipments        = basket.getShipments().iterator();

    while (shipments.hasNext()) {
        var shipment          = shipments.next(),
            shipmentLineItems = shipment.getAllLineItems().iterator();
        while (shipmentLineItems.hasNext()) {
            var _lineItem = shipmentLineItems.next();
            if (_lineItem.taxClassID === TaxMgr.customRateTaxClassID) {
                _lineItem.updateTax(_lineItem.taxRate);
            } else {
                _lineItem.updateTax(null);
            }
        }

        var taxJurisdictionID = null;

        if (shipment.shippingAddress !== null) {
            var location = new ShippingLocation(shipment.shippingAddress);
            taxJurisdictionID = TaxMgr.getTaxJurisdictionID(location);
        }

        if (taxJurisdictionID === null) {
            taxJurisdictionID = TaxMgr.defaultTaxJurisdictionID;
        }

        // if we have no tax jurisdiction, we cannot calculate tax
        if (taxJurisdictionID === null) {
            continue;
        }

        // shipping address and tax juridisction are available
        var shipmentLineItems2 = shipment.getAllLineItems().iterator();
        while (shipmentLineItems2.hasNext()) {
            var lineItem   = shipmentLineItems2.next(),
                taxClassID = lineItem.taxClassID;

            // do not touch line items with fix tax rate
            if (taxClassID === TaxMgr.customRateTaxClassID) {
                continue;
            }

            // line item does not define a valid tax class; let's fall back to default tax class
            if (taxClassID === null) {
                taxClassID = TaxMgr.defaultTaxClassID;
            }

            // if we have no tax class, we cannot calculate tax
            if (taxClassID === null) {
                continue;
            }

            // get the tax rate
            var taxRate = TaxMgr.getTaxRate(taxClassID, taxJurisdictionID);
            // w/o a valid tax rate, we cannot calculate tax for the line item
            if (taxRate === null) {
                continue;
            }

            // calculate the tax of the line item
            lineItem.updateTax(taxRate);
        }
    }

    // besides shipment line items, we need to calculate tax for possible order-level price adjustments
    // this includes order-level shipping price adjustments
    if (!basket.getPriceAdjustments().empty || !basket.getShippingPriceAdjustments().empty) {
        // calculate a mix tax rate from
        var basketPriceAdjustmentsTaxRate = (basket.getMerchandizeTotalGrossPrice().value / basket.getMerchandizeTotalNetPrice().value) - 1,
            basketPriceAdjustments        = basket.getPriceAdjustments().iterator();

        while (basketPriceAdjustments.hasNext()) {
            var basketPriceAdjustment = basketPriceAdjustments.next();
            basketPriceAdjustment.updateTax(basketPriceAdjustmentsTaxRate);
        }

        var basketShippingPriceAdjustments = basket.getShippingPriceAdjustments().iterator();
        while (basketShippingPriceAdjustments.hasNext()) {
            var basketShippingPriceAdjustment = basketShippingPriceAdjustments.next();
            basketShippingPriceAdjustment.updateTax(basketPriceAdjustmentsTaxRate);
        }
    }
}

/* Calculates product prices based on line item quantities. */

function calculateProductPrices (basket) {

    // iterate all product line items of the basket and set prices
    var productLineItems = basket.getAllProductLineItems().iterator();
    while (productLineItems.hasNext()) {
        var productLineItem = productLineItems.next();
        var product = productLineItem.product;

        // handle option line items
        if (productLineItem.optionProductLineItem) {
            // for bonus option line items, we do not update the price
            // the price is set to 0.0 by the promotion engine
            if (!productLineItem.bonusProductLineItem) {
                productLineItem.updateOptionPrice();
            }
        // handle bundle line items, but only if they're not a bonus
        } else if (productLineItem.bundledProductLineItem) {
            // no price is set for bundled product line items
        // handle bonus line items
        // the promotion engine set the price of a bonus product to 0.0
        // we update this price here to the actual product price just to
        // provide the total customer savings in the storefront
        // we have to update the product price as well as the bonus adjustment
        } else if (productLineItem.bonusProductLineItem && product !== null) {
            var price = product.priceModel.price;
            var adjustedPrice = productLineItem.adjustedPrice;
            productLineItem.setPriceValue(price.valueOrNull);
            // get the product quantity
            var quantity2 = productLineItem.quantity;
            // we assume that a bonus line item has only one price adjustment
            var adjustments = productLineItem.priceAdjustments;
            if (!adjustments.isEmpty()) {
                var adjustment = adjustments.iterator().next();
                var adjustmentPrice = price.multiply(quantity2.value).multiply(-1.0).add(adjustedPrice);
                adjustment.setPriceValue(adjustmentPrice.valueOrNull);
            }

        // handle product line items unrelated to product
        } else if (product === null && productLineItem.catalogProduct) {
            productLineItem.setPriceValue(null);
        // handle normal product line items
        } else {
            productLineItem.setPriceValue(productLineItem.basePrice.valueOrNull);
        }
    }
}

/**
 * Converts Address object into JSON
 */
function stringifyAddress(address) {
    var addressObj = {
        address1    : address.getAddress1(),
        address2    : address.getAddress2(),
        city        : address.getCity(),
        countryCode : {displayValue : address.getCountryCode().displayValue, value : address.getCountryCode().value},
        firstName   : address.getFirstName(),
        fullName    : address.getFullName(),
        lastName    : address.getLastName(),
        phone       : address.getPhone(),
        postalCode  : address.getPostalCode(),
        stateCode   : address.getStateCode()
    };

    return addressObj;
}

/**
 * Populates order address object with address information from jsonObj
 */
function setJSONAddressToOrderAddress(orderAddress, jsonObj) {
    orderAddress.setFirstName(jsonObj.firstName);
    orderAddress.setLastName(jsonObj.lastName);
    orderAddress.setPhone(jsonObj.phone);
    orderAddress.setAddress1(jsonObj.address1);
    orderAddress.setAddress2(jsonObj.address2);
    orderAddress.setCity(jsonObj.city);
    orderAddress.setStateCode(jsonObj.stateCode);
    orderAddress.setPostalCode(jsonObj.postalCode);
    orderAddress.setCountryCode(jsonObj.countryCode.value);
}

/**
 * Checks basket for presence of refill products
 */
function checkForRefillProducts() {
    var countSor  = 0,
        basket    = BasketMgr.getCurrentBasket();

    if (basket) {
        var customer = basket.getCustomer();
        if (customer && !checkforExclusivelyGroup(customer)) {
            var productLineItems = basket.allProductLineItems;

            for each (var lineItem in productLineItems) {
                if ('hasSmartOrderRefill' in lineItem.custom
                    && lineItem.custom.hasSmartOrderRefill
                    && (lineItem.custom.SorMonthInterval > 0 || lineItem.custom.SorWeekInterval > 0)) {
                    countSor++;
                }
            }
        }
    }

    session.custom.hasSORProducts = (countSor > 0);
    return (countSor > 0) ? true : false;
}

/**
 * Checks if a Exclusively group is set and, if true, the customer is assigned to it
 */
function checkforExclusivelyGroup(customer) {
    var exclusiveGroup = sitePref.getCustomPreferenceValue('SorExclusivelyCustomerGroup');

    if (exclusiveGroup) {
        var group = CustomerMgr.getCustomerGroup(exclusiveGroup);
        if (group) {
            if (!customer.authenticated) {
                return true;
            } else {
                var currentCustomer = CustomerMgr.getCustomerByLogin(customer.profile.email);
                if (!currentCustomer.isMemberOfCustomerGroup(exclusiveGroup)) {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Send email
 */
function sendEmail(to, subject, content, template) {
    var mail        = new dw.net.Mail(),
        mailFrom    = sitePref.getCustomPreferenceValue('customerServiceEmail') || Resource.msg('smartorderrefill.defaultemail', 'smartorderrefill', null),
        mailContent = content;

     if (template) {
        var mailTemplate = new dw.util.Template(template);

        mailContent = mailTemplate.render(content);
     }

    mail.setFrom(mailFrom)
        .addTo(to)
        .setSubject(subject)
        .setContent(mailContent)
        .send();
}

/**
 * Function for overriding current date
 */
function getCurrentDate(dateOverride) {
    var currentDate = null,
        today       = new Date();
    if (dateOverride) {
        currentDate = strToDate(dateOverride);
    } else {
        currentDate = today;
    }
    return currentDate;
}

/**
 * Return the difference in days between two dates
 */
function dateDiffInDays(date1, date2) {
    var dt1 = new Date(date1),
        dt2 = new Date(date2);

    return Math.floor((Date.UTC(dt2.getFullYear(), dt2.getMonth(), dt2.getDate()) - Date.UTC(dt1.getFullYear(), dt1.getMonth(), dt1.getDate()) ) /(1000 * 60 * 60 * 24));
}

/**
 * Function which converts date object to a string
 */
function dateToStr(date, separator) {
    var day   = date.getDate(),
        month = date.getMonth(),
        year  = date.getFullYear();

     day = (day > 9 ? '' : '0') + day;
     month = (month + 1 > 9 ? '' : '0') + (month + 1);
     year = (year > 9 ? '' : '0') + year;
    return [year, month, day].join(separator || '-');
}

/**
 * Function which converts string to a date object
 */
function strToDate(date) {
    var dateParams = date.split('-'),
        year       = dateParams[0],
        month      = dateParams[1],
        day        = dateParams[2],
        date       = new Date();

    date.setFullYear(year);
    date.setMonth(month - 1, day);

    return date;
}

/**
 * Get Index an ID from a List
 */
function getIndexOfId(list, item) {
    return list.map(function(e) {
        return e.ID;
    }).indexOf(item);
}

/**
 * Generate a string with all subscription's products names
 */
function strOfProducts(list) {
    var txt = '';
    for (var i = 0; i < list.length; i++) {
        if (i == 0) {
            txt = ProductMgr.getProduct(list[i].ID).name;
        } else {
            txt += ', ' + ProductMgr.getProduct(list[i].ID).name;
        }
    }
    return txt;
}

/**
 * Update the address
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
        postalCode  : addressForm.postal.htmlValue,
        stateCode   : addressForm.states.state.htmlValue
    };
    list[addressAttribute] = addressObj;
}

/**
 * Get ProductLineItem's Custom Attributes for Multi-Shipping
 */

 function getSorAttributes(basket) {
     var obj = {};
    for each (var pli in basket.productLineItems) {
        if (pli.custom.hasSmartOrderRefill) {
            obj[pli.productID] = {
                SorMonthInterval : pli.custom.SorMonthInterval,
                SorWeekInterval  : pli.custom.SorWeekInterval,
                SorPeriodicity   : pli.custom.SorPeriodicity
            }
        }
    }
    return obj;
 }

 /**
 * Set ProductLineItem's Custom Attributes for Multi-Shipping
 */
function setSorAttributes(basket, obj) {
    for each (var pli in basket.productLineItems) {
        if (Object.keys(obj).indexOf(pli.productID) >= 0) {
            pli.custom.hasSmartOrderRefill = true;
            pli.custom.SorMonthInterval    = obj[pli.productID].SorMonthInterval;
            pli.custom.SorWeekInterval     = obj[pli.productID].SorWeekInterval;
            pli.custom.SorPeriodicity      = obj[pli.productID].SorPeriodicity;
        }
    }
}

/**
 * Returns smartorderrefill resources
 * @returns {Object}
 */
function getResources() {
    var resources = { 
        SOR_DELETE_ORDERS_TITLE         : Resource.msg('smartorderrefill.deleteorders.title', 'smartorderrefill', null),
        SOR_DELETE_ORDERS_MESSAGE       : Resource.msg('smartorderrefill.deleteorders.message', 'smartorderrefill', null),
        SOR_DELETE_PART_MESSAGE         : Resource.msg('smartorderrefill.deletepart.message', 'smartorderrefill', null),
        SOR_DELETE_SUBSCRIPTION_TITLE   : Resource.msg('smartorderrefill.deletesubs.title', 'smartorderrefill', null),
        SOR_DELETE_SUBSCRIPTION_MESSAGE : Resource.msg('smartorderrefill.deletesubs.message', 'smartorderrefill', null),
        SOR_PAUSE_SUBSCRIPTION_TITLE    : Resource.msg('smartorderrefill.pausesubs.title', 'smartorderrefill', null),
        SOR_PAUSE_SUBSCRIPTION_MESSAGE  : Resource.msg('smartorderrefill.pausesubs.message', 'smartorderrefill', null),
        SOR_REACTIVE_SUBSCRIPTION_TITLE : Resource.msg('smartorderrefill.reactivesubs.title', 'smartorderrefill', null),
        SOR_SKIP_ORDER_TITLE            : Resource.msg('smartorderrefill.skiporder.title', 'smartorderrefill', null),
        SOR_SKIP_ORDER_MESSAGE          : Resource.msg('smartorderrefill.skiporder.message', 'smartorderrefill', null),
        SOR_PAUSE_ORDER_TITLE           : Resource.msg('smartorderrefill.pauseorder.title', 'smartorderrefill', null),
        SOR_PAUSE_ORDER_MESSAGE         : Resource.msg('smartorderrefill.pauseorder.message', 'smartorderrefill', null),
        SOR_REACTIVE_ORDER_TITLE        : Resource.msg('smartorderrefill.reactiveorder.title', 'smartorderrefill', null),
        SOR_UPDATE_CREDIT_CARD_TITLE    : Resource.msg('smartorderrefill.updatecreditcard', 'smartorderrefill', null),
        SOR_REACTIVE_ORDER_MESSAGE      : Resource.msg('smartorderrefill.reactiveorder.notavailable', 'smartorderrefill', null),
        SOR_CUSTOMER_SERVICE_MESSAGE    : Resource.msg('smartorderrefill.subscription.customerservice', 'smartorderrefill', null),
        SOR_UNEXPECTED_ERROR            : Resource.msg('smartorderrefill.unexpectederror', 'smartorderrefill', null),
        SOR_ERROR_TITLE                 : Resource.msg('smartorderrefill.errortitle', 'smartorderrefill', null),
        SOR_ADDRESS_ERROR               : Resource.msg('smartorderrefill.addresserror', 'smartorderrefill', null),
        SOR_PRODUCT_ERROR               : Resource.msg('smartorderrefill.producterror', 'smartorderrefill', null),
        SOR_QUANTITY_ERROR              : Resource.msg('smartorderrefill.quantityerror', 'smartorderrefill', null),
        SOR_CREDITCARD_ERROR            : Resource.msg('smartorderrefill.creditcarderror', 'smartorderrefill', null),
        SOR_LOGINFROMCART_ERROR         : Resource.msg('smartorderrefill.loginfromcart.error', 'smartorderrefill', null) ,
        SOR_MODIFY_SMART_ORDER_REFILL   : Resource.msg('smartorderrefill.modifySOR', 'smartorderrefill', null),
        SOR_CHANGE_ADDRESS              : Resource.msg('smartorderrefill.vieworder.changeaddress', 'account', null),
        SOR_GLOBAL_CLOSE                : Resource.msg('smartorderrefill.close', 'smartorderrefill', null),
        SOR_GLOBAL_CANCEL               : Resource.msg('smartorderrefill.cancel', 'smartorderrefill', null),
        SOR_GLOBAL_SAVE                 : Resource.msg('smartorderrefill.save', 'smartorderrefill', null),
        SOR_GLOBAL_OK                   : Resource.msg('smartorderrefill.ok', 'smartorderrefill', null),
        SOR_GLOBAL_UPDATE               : Resource.msg('smartorderrefill.update', 'smartorderrefill', null),
        SOR_GLOBAL_SUBMIT               : Resource.msg('smartorderrefill.submit', 'smartorderrefill', null),
        SOR_DIALOG_SUBSCRIPTION         : Resource.msg('smartorderrefill.dialog.subscription', 'smartorderrefill', null),
    }
    return resources;
}

/**
 * Returns urls to SmartOrderRefillController functions for account page
 * @returns {Object}
 */
function getUrls() {
    var URLUtils = require('dw/web/URLUtils');
    var urls = {
        loginFromCartPage           : URLUtils.url('SmartOrderRefillController-RequireLogin').toString(),
        manageOrders                : URLUtils.url('SmartOrderRefillController-Manage').toString(),
        updateRefillData            : URLUtils.url('SmartOrderRefillController-UpdateCartProductRefillInformation').toString(),
        updatePDPOptions            : URLUtils.url('SmartOrderRefillController-PDPRefillOptions').toString(),
        cancelOneOrder              : URLUtils.url('SmartOrderRefillController-SkipOrder').toString(),
        cartShow                    : URLUtils.url('Cart-Show').toString()
    }
    return urls;
}

/* Returns SOR preferences
* @returns {Object}
*/
function getPreferences() {
    var Site = require('dw/system/Site');
    var preferences = {
        SOR_ENABLED: Site.getCurrent().getCustomPreferenceValue('SorEnabled')
    }
    return preferences;
}

function getDefaultVariant(pvm) {
    var variant = pvm.selectedVariant;
    if (variant) { return variant; }

    var attDefs = pvm.getProductVariationAttributes();
    var map = new HashMap();

    for (var i = 0, len = attDefs.length; i < len; i++) {
        var attribute = attDefs[i];
        var selectedValue = pvm.getSelectedValue(attribute);
        if (selectedValue && selectedValue.displayValue.length > 0) {
            map.put(attribute.ID,selectedValue.ID);
        }
    }

    var variants = pvm.getVariants(map);
    for (var k = 0; k < variants.length; k++) {
        var p = variants[k];
        if (p.onlineFlag && productHelper.getAvailabilityModel(p).availability > 0) {
            return p;
        }
    }
    return null;
}

function getCurrentCountry(locale) {
    var countries = require('*/cartridge/config/countries');
    var Locale = require('dw/util/Locale');
	if (!countries || countries.length === 0) {
		return;
	}
	var currentLocale = Locale.getLocale(locale);
	var country;
	if (!currentLocale.country) {
		return countries[0]; 
	}
	for (var i = 0; i < countries.length; i++) {
		var _country = countries[i];
		if (_country.countryCode === currentLocale.country) {
			country = _country;
			break;
		}
	}
	return country || countries[0];
}

module.exports = {
    verifyLicense                   : verifyLicense,
    getCreditCardInformation        : getCreditCardInformation,
    updateCreditCardInformation     : updateCreditCardInformation,
    chargeCancelationFee            : chargeCancelationFee,
    getProductItemsAvailability     : getProductItemsAvailability,
    getProductPricesChanges         : getProductPricesChanges,
    calculateTax                    : calculateTax,
    stringifyAddress                : stringifyAddress,
    setJSONAddressToOrderAddress    : setJSONAddressToOrderAddress,
    checkForRefillProducts          : checkForRefillProducts,
    checkforExclusivelyGroup        : checkforExclusivelyGroup,
    sendEmail                       : sendEmail,
    getCurrentDate                  : getCurrentDate,
    dateDiffInDays                  : dateDiffInDays,
    dateToStr                       : dateToStr,
    strToDate                       : strToDate,
    getIndexOfId                    : getIndexOfId,
    strOfProducts                   : strOfProducts,
    updateAddress                   : updateAddress,
    getSorAttributes                : getSorAttributes,
    setSorAttributes                : setSorAttributes,
    getResources                    : getResources,
    getUrls                         : getUrls,
    getPreferences                  : getPreferences,
    getDefaultVariant               : getDefaultVariant,
    getCurrentCountry               : getCurrentCountry,
    calculateProductPrices          : calculateProductPrices
}
