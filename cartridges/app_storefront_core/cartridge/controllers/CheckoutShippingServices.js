"use strict";
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
var BasketMgr       = require("dw/order/BasketMgr");
var csrfProtection  = require("*/cartridge/scripts/middleware/csrf");
var inventoryHelper = require("*/cartridge/scripts/helpers/inventoryHelpers.js");
var Logger          = require("dw/system/Logger");
var server          = require("server");
var Site            = require("dw/system/Site");
var sorEnabled      = Site.getCurrent().getCustomPreferenceValue("SorEnabled");
var sorHelper       = require("int_smartorderrefill/cartridge/scripts/SmartOrderRefillHelper.js");
var ShippingMgr     = require("dw/order/ShippingMgr");
var Transaction     = require("dw/system/Transaction");
var URLUtils        = require("dw/web/URLUtils");
var Resource        = require("dw/web/Resource");
var StoreMgr        = require("dw/catalog/StoreMgr");

server.extend(module.superModule);

var sitePreferences                = Site.current.preferences.custom;
var isInventoryCheckServiceEnabled = sitePreferences.enableOmsInventoryCheckService;

/**
 * If the customer has selected store pickup shipping method, this code will
 * set one of the available store pickup methods ("today" or "tomorrow") based
 * on a session variable;
 * @param {dw.order.Shipment} shipment
 */
function setStorePickupShippingMethodIfNecessary(shipment) {
    var storePickupTodayShippingMethod    = null;
    var storePickupTomorrowShippingMethod = null;

    if (isInventoryCheckServiceEnabled) {
        ShippingMgr.allShippingMethods.toArray().forEach(function (shippingMethod) {
            if (shippingMethod.custom.storePickupEnabled) {
                if (shippingMethod.custom.isToday) {
                    storePickupTodayShippingMethod = shippingMethod;
                } else {
                    storePickupTomorrowShippingMethod = shippingMethod;
                }
            }
        });

        if (shipment.shippingMethod.custom.storePickupEnabled) {
            if (session.custom.isPickupToday) {
                shipment.setShippingMethod(storePickupTodayShippingMethod);
            } else {
                shipment.setShippingMethod(storePickupTomorrowShippingMethod);
            }
        }
    }
}
/**
 * Endpoint was modified in order to ensure that only credit card payment methods are allowed if the customer has Smart Order Refill products in the cart
 */
server.append(
    "SubmitShipping",
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req1, res1, next) {
        var viewData              = res1.getViewData();
        var homeDeliveryMessage   = req1.form.note || "";
        var currentBasket         = BasketMgr.getCurrentBasket();
        var shipment              = currentBasket.defaultShipment;

        Transaction.wrap(function () {
            if (homeDeliveryMessage) {
                shipment.custom.homeDeliveryMessage = homeDeliveryMessage;
            }

            setStorePickupShippingMethodIfNecessary(shipment);
        });
        viewData.fieldsToValidate   = {fullName: true, rut: true};
        viewData.guestData          = getMainDocumentData();

        var city = shipment.getShippingMethod().custom.storePickupEnabled ? StoreMgr.getStore(req1.form.storeId).getCity() : shipment.getShippingAddress().getCity();

        viewData.productsOutOfStock    = inventoryHelper.getListOfUnavailableProducts(!shipment.shippingMethod.custom.storePickupEnabled, city);
        viewData.outOfStockRedirectUrl = URLUtils.https("Checkout-Begin").toString();

        res1.setViewData(viewData);
        this.on("route:BeforeComplete", function (req, res) {
            currentBasket             = BasketMgr.getCurrentBasket();
            shipment                  = currentBasket.defaultShipment;
            var shippingAddress       = shipment.shippingAddress;
            var form                  = server.forms.getForm("shipping");
            var shippingAddressFields = form.shippingAddress.addressFields;
            Transaction.wrap(function () {
                if (shipment.shippingMethod.custom.storePickupEnabled) {
                    var storeId  = shipment.custom.fromStoreId;
                    var store    = StoreMgr.getStore(storeId);
                    if (empty(store)) {
                        Logger.error("Store with ID " + storeId + " could not be found.");
                    } else {
                        shippingAddress.custom.addressIdForOMS = store.name;
                        shippingAddress.custom.latitude = store.latitude;
                        shippingAddress.custom.longitude = store.longitude;
                    }
                } else if (!empty(shippingAddressFields.addressId) && !empty(shippingAddressFields.addressId.htmlValue)) {
                    shippingAddress.custom.addressIdForOMS = shippingAddressFields.addressId.htmlValue;
                }
            });

            var viewDataInternal = res.getViewData();
            var hasRefillProducts = sorHelper.checkForRefillProducts();
            if (sorEnabled && hasRefillProducts) {
                var applicablePaymentMethods = [];
                if (viewDataInternal.order) {
                    for (var index in viewDataInternal.order.billing.payment.applicablePaymentMethods) {
                        var paymentMethod = viewDataInternal.order.billing.payment.applicablePaymentMethods[index];
                        if (paymentMethod.ID == "CREDIT_CARD") {
                            applicablePaymentMethods.push(paymentMethod);
                        }
                    }
                    viewDataInternal.order.billing.payment.applicablePaymentMethods = applicablePaymentMethods;
                }
                res.setViewData(viewDataInternal);
            }

        });
        return next();
    }
);

server.post("SaveHomeDeliveryAddress",
    function (req, res, next) {
        var CustomerMgr      = require("dw/customer/CustomerMgr");
        var AccountModel     = require("*/cartridge/models/account");
        var OrderModel       = require("*/cartridge/models/order");
        var Locale           = require("dw/util/Locale");
        var COHelpers        = require("*/cartridge/scripts/checkout/checkoutHelpers");
        var inventoryHelpers = require("*/cartridge/scripts/helpers/inventoryHelpers");

        var currentBasket = BasketMgr.getCurrentBasket();
        var shipment = currentBasket.defaultShipment;
        var currentLocale = Locale.getLocale(req.locale.id);
        var viewData = res.getViewData();
        var form = server.forms.getForm("shipping");
        var formPhoneField = form.shippingAddress.addressFields.phone;
        form.shippingAddress.addressFields.country.htmlValue = currentLocale.country;
        form.shippingAddress.addressFields.country.valid = true;

        // Handles legacy customers that have no phone in the selected address;
        if (empty(formPhoneField.value) && !empty(customer.profile)) {
            formPhoneField.value = customer.profile.phoneMobile ||
                Resource.msg("label.input.countrycode", "forms", null) + "000000000";

            formPhoneField.valid = true;
        }

        var shippingFormErrors = COHelpers.validateShippingForm(form.shippingAddress.addressFields);

        // Handles legacy customers that have invalid phone number;
        if (!empty(shippingFormErrors["dwfrm_shipping_shippingAddress_addressFields_phone"])) {
            formPhoneField.value = Resource.msg("label.input.countrycode", "forms", null) + "000000000";

            delete shippingFormErrors["dwfrm_shipping_shippingAddress_addressFields_phone"];
        }

        session.custom.storeSearchLatitude  = null;
        session.custom.storeSearchLongitude = null;

        var storeData = {
            isInventoryCheckServiceEnabled : false
        };

        if (isInventoryCheckServiceEnabled) {
            storeData = inventoryHelpers.getHomeDeliveryStoreData(
                form.shippingAddress.addressFields.latitude.value,
                form.shippingAddress.addressFields.longitude.value,
                form.shippingAddress.addressFields.city.value
            );
            
            prepareOmsData(storeData);
        }

        if (Object.keys(shippingFormErrors).length > 0) {
            res.json({
                form: form,
                fieldErrors: [shippingFormErrors],
                serverErrors: [],
                error: true,
                success: false
            });
        } else {
            viewData.address = form.shippingAddress.addressFields;
            viewData.saveAddress = req.form.saveaddress;
            res.setViewData(viewData);
            this.on("route:BeforeComplete", function (req2, res2) { // eslint-disable-line no-shadow
                var GeolocationUtils = require("*/cartridge/scripts/utils/GeolocationUtils");

                var shippingData = res2.getViewData();
                var address      = shippingData.address;
                var geolocation  = GeolocationUtils.getFallbackGeolocation(address.latitude.value, address.longitude.value);

                if (shippingData.error) {
                    res2.json(shippingData);
                    return;
                }
                try {
                    Transaction.wrap(function () {
                        var shippingAddress = shipment.shippingAddress;

                        if (!shippingAddress) {
                            shippingAddress = shipment.createShippingAddress();
                        }

                        shippingAddress.setAddress1(address.address1.value || "");
                        shippingAddress.setAddress2(address.address2.value || "");
                        shippingAddress.setCity(address.city.value || "");
                        shippingAddress.setPostalCode(address.postalCode.value || "");
                        shippingAddress.setStateCode(address.states.stateCode.value || "");
                        shippingAddress.setCountryCode(address.country.value || "");
                        shippingAddress.setPhone(address.phone.value || "");
                        shippingAddress.custom.barrio    = address.barrio.value || "";
                        shippingAddress.custom.latitude  = geolocation.lat;
                        shippingAddress.custom.longitude = geolocation.lng;

                        if (req2.currentCustomer.raw.authenticated && shippingData.saveAddress == "true") {
                            var customer = CustomerMgr.getCustomerByCustomerNumber(
                                req2.currentCustomer.raw.profile.customerNo
                            );
                            var addressBook = customer.getProfile().getAddressBook();
                            var addressId = address.addressId.value;
                            var addressToSave = addressBook.getAddress(addressId) || addressBook.createAddress(addressId);

                            addressToSave.setFirstName(address.firstName.value || "");
                            addressToSave.setLastName(address.lastName.value || "");
                            addressToSave.setAddress2(address.address2.value || "");
                            addressToSave.setAddress1(address.address1.value || "");
                            addressToSave.setAddress2(address.address2.value || "");
                            addressToSave.setCity(address.city.value || "");
                            addressToSave.setPhone(address.phone.value || "");
                            addressToSave.setPostalCode(address.postalCode.value || "");
                            addressToSave.setStateCode(address.states.stateCode.value || "");
                            addressToSave.setCountryCode(address.country.value || "");
                            addressToSave.custom.barrio = address.barrio.value || "";
                            addressToSave.custom.latitude  = geolocation.lat;
                            addressToSave.custom.longitude = geolocation.lng;
                        }
                    });
                } catch (err) {
                    res2.setStatusCode(500);
                    res2.json({
                        success: false,
                        error: true,
                        errorMessage: err
                    });

                    return;
                }

                var curLocale              = Locale.getLocale(req2.locale.id);
                var unavailableProductList = inventoryHelper.getListOfUnavailableProducts(null, form.shippingAddress.addressFields.city.value);

                var basketModel = new OrderModel(
                    currentBasket,
                    { usingMultiShipping: false, countryCode: curLocale.country, containerView: "basket" }
                );

                if(storeData.isOutOfCoverage){
                    res2.setStatusCode(500);
                    res2.json({
                        error                 : true,
                        message               : storeData.errorMessage,
                        success               : false,
                        storeData             : storeData,
                    });
                    return;
                }
               
                res2.json({
                    customer              : new AccountModel(req2.currentCustomer),
                    order                 : basketModel,
                    productsOutOfStock    : unavailableProductList,
                    redirectUrl           : URLUtils.https("Cart-Show").toString(),
                    outOfStockRedirectUrl : URLUtils.https("Checkout-Begin").toString(),
                    storeData             : storeData,
                    success               : true,
                });

            });
        }

        return next();
    }
);


function responseClientErrorsOMS(UnavailableLine){
    let messages = [];

    const { Message }         = UnavailableLine.Messages;
    const { AssignedQty }     = UnavailableLine;
    const { LineId }          = UnavailableLine;
    const { ItemID }          = UnavailableLine;

    // return Message.filter(msg => msg.Text != "");
    for (let index = 0; index < Message.length; index++) {
        messages.push(Message[index].Text);
    }

    return {
        id            : LineId,
        currentStock  : AssignedQty, 
        messages      : messages,
        idItem        : ItemID
    };
}

function getErrorMessagesOMS(errorReponseOMS){
    let response = [];
    
    const { UnavailableLine } = errorReponseOMS.UnavailableLines;

    if(UnavailableLine.length > 1){
        for (let index = 0; index < UnavailableLine.length; index++) {
            response.push(responseClientErrorsOMS(UnavailableLine[index]));
        }
    }else{
        response.push(responseClientErrorsOMS(UnavailableLine[0]));
    }

    return response;
}

function validateErrorClientOMS(responseError){

    let isOutOfCoverage = false
    let clientMessage   = [];
    
    for (let index = 0; index < responseError.length; index++) {
        for (let j = 0; j < responseError[index].messages.length; j++) {
            if(responseError[index].messages[j] === " No choices generated for the line"){
                isOutOfCoverage = true;
                clientMessage.push("Los productos no están disponible en la dirección ingresada.");
            }
            if(responseError[index].messages[j].indexOf("Ensure inventory capacity for node is available") > -1){
                clientMessage.push("El producto con el SKU: " + responseError[index].idItem + " solo tiene " + responseError[index].currentStock + " unidades en stock.");
            }
        }
    }

    return {
        isOutOfCoverage : isOutOfCoverage,
        messages        : clientMessage,
    };
}

function getAmPmMessage(hour) {
    var omsApproximateTimePrefix = sitePreferences.omsApproximateTimePrefix;
    var amTime                   = Resource.msg("oms.deliverytime.am", "checkout", null);
    var pmTime                   = Resource.msg("oms.deliverytime.pm", "checkout", null);
    var dailyShift               = hour < 12 ? amTime : pmTime;
    var amPmHour                 = hour % 12;

    amPmHour = amPmHour ? amPmHour : 12;

    var formattedTime = amPmHour + ":00 " + dailyShift;

    return "(" + omsApproximateTimePrefix + " " + formattedTime + ")";
}

function prepareOmsData(storeData) {
    storeData.isInventoryCheckServiceEnabled = true;
    storeData.isOutOfCoverage                = false;

    if (storeData.currentDayHour) {
        storeData.currentDayMessage = getAmPmMessage(storeData.currentDayHour);
    }

    if (storeData.nextDayHour) {
        storeData.nextDayMessage = getAmPmMessage(storeData.nextDayHour);
    }
    
    // if (!storeData.currentDayHour && !storeData.nextDayHour) {
    //     storeData.isEmptyOmsResponse = true;
    //     storeData.errorMessage       = Resource.msg("subheading.error.general", "error", null);
    // }

    if(storeData.errorResponse) {
        let errorMessages                = getErrorMessagesOMS(storeData.errorResponse);
        let { messages, isOutOfCoverage} = validateErrorClientOMS(errorMessages);
        storeData.messages               = messages;
        storeData.errorMessage           = Resource.msg(storeData.messages[0], "error", null);
        storeData.isOutOfCoverage        = isOutOfCoverage;
    }

}

/**
 * Gets the customer's main document data;
 * @return {Object} An object detailing the type and number for the main document of the customer.
 */
function getMainDocumentData() {

    if (!customer.profile) {
        return {};
    }

    var doctType      = "";
    var docNumber     = "";
    var profileCustom = customer.profile.custom;

    if (profileCustom.ceDocument) {
        doctType  = Resource.msg("CE.docType", "mercadoPagoPreferences", null);
        docNumber = profileCustom.ceDocument;
    } else if (profileCustom.ccDocument) {
        doctType  = Resource.msg("CC.docType", "mercadoPagoPreferences", null);
        docNumber = profileCustom.ccDocument;
    } else if (profileCustom.passport) {
        doctType  = Resource.msg("Otro.docType", "mercadoPagoPreferences", null);
        docNumber = profileCustom.passport;
    } else if (profileCustom.difarmaRunRutNit) {
        doctType  = Resource.msg("RUT.docType", "mercadoPagoPreferences", null);
        docNumber = profileCustom.difarmaRunRutNit;
    }

    return {
        document : doctType,
        number   : docNumber
    };
}

module.exports = server.exports();
