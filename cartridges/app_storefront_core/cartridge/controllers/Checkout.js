"use strict";
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
var server     = require("server"),
    sorEnabled = dw.system.Site.getCurrent().getCustomPreferenceValue("SorEnabled"),
    sorHelper  = require("int_smartorderrefill/cartridge/scripts/SmartOrderRefillHelper.js");
var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");
var cartHelper = require("*/cartridge/scripts/cart/cartHelpers");
var validationHelpers = require("*/cartridge/scripts/helpers/validationHelpers"); // eslint-disable-line no-unused-vars
var Resource = require("dw/web/Resource");
var Site = require("dw/system/Site");
var csrfProtection = require("*/cartridge/scripts/middleware/csrf");
var consentTracking = require("*/cartridge/scripts/middleware/consentTracking");
var productHelper = require("*/cartridge/scripts/helpers/productHelpers");
var BasketMgr = require("dw/order/BasketMgr");
var Transaction = require("dw/system/Transaction");
var OrderModel = require("*/cartridge/models/order");
var Locale = require("dw/util/Locale");
var URLUtils = require("dw/web/URLUtils");
var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");

var sitePreferences = Site.current.preferences.custom;

server.extend(module.superModule);

/**
 * Checks minimum necessary information in order to complete a purchase
 * @param {Object} customerProfile the current customer profile
 * @returns {Boolean}
 */
function hasCompleteProfile(customerProfile) {
    return (!empty(customerProfile.custom.ccDocument)    ||
        !empty(customerProfile.custom.ceDocument)        ||
        !empty(customerProfile.custom.passport)          ||
        !empty(customerProfile.custom.difarmaRunRutNit)) &&
        validationHelpers.validateEmail(customerProfile.email);
}

/**
 * Endpoint was modified in order to ensure a pdict value required by Smart Order Refill is available in checkout
 * and handle missing data in Shipping and Billing addresses forms
 */
server.replace(
    "Begin",
    server.middleware.https,
    consentTracking.consent,
    csrfProtection.generateToken,
    function (req, res, next) {
        var AccountModel = require("*/cartridge/models/account");
        var reportingUrlsHelper = require("*/cartridge/scripts/reportingUrls");
        var collections = require("*/cartridge/scripts/util/collections");
        var basketValidationHelpers = require("*/cartridge/scripts/helpers/basketValidationHelpers");

        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));
 
        var isPrescriptionUploadServiceEnabled    = sitePreferences.enablePrescriptionUploadService;
        var isRestrictedPrescriptionUploadEnabled = sitePreferences.enableRestrictedPrescriptionUpload;
        var isInventoryCheckServiceEnabled        = sitePreferences.enableOmsInventoryCheckService;
        var isZoneCityMappingEnabled              = sitePreferences.enableCityZoneMapping;

        if (!empty(req.currentCustomer.raw.profile)) {
            LoyaltyUtils.checkAndSetSpecificCustomerGroup(req.currentCustomer.raw.profile.custom.difarmaRunRutNit);
        }

        var currentBasket = BasketMgr.getCurrentBasket();
        if (!currentBasket) {
            res.redirect(URLUtils.url("Home-Show"));
            return next();
        }

        var validatedProducts = basketValidationHelpers.validateProducts(currentBasket);
        if (validatedProducts.error) {
            res.redirect(URLUtils.url("Cart-Show"));
            return next();
        }

        cartHelper.checkPrescriptionModel(currentBasket);

        var currentStage = req.querystring.stage ? req.querystring.stage : "shipping";

        var billingAddress = currentBasket.billingAddress;

        var currentCustomer = req.currentCustomer.raw;
        var currentLocale = Locale.getLocale(req.locale.id);
        var preferredAddress;

        // only true if customer is registered
        if (req.currentCustomer.addressBook && req.currentCustomer.addressBook.preferredAddress) {
            var shipments = currentBasket.shipments;
            preferredAddress = req.currentCustomer.addressBook.preferredAddress;

            collections.forEach(shipments, function (shipment) {
                if (!shipment.shippingAddress) {
                    COHelpers.copyCustomerAddressToShipment(preferredAddress, shipment);
                }
            });

            if (!billingAddress) {
                COHelpers.copyCustomerAddressToBilling(preferredAddress);
            }
        }

        // Calculate the basket
        Transaction.wrap(function () {
            COHelpers.ensureNoEmptyShipments(req);

        });

        if (currentBasket.shipments.length <= 1) {
            req.session.privacyCache.set("usingMultiShipping", false);
        }

        if (currentBasket.currencyCode !== req.session.currency.currencyCode) {
            Transaction.wrap(function () {
                currentBasket.updateCurrency();
            });
        }

        COHelpers.recalculateBasket(currentBasket);

        var shippingForm = COHelpers.prepareShippingForm(currentBasket);
        var billingForm = COHelpers.prepareBillingForm(currentBasket);
        var usingMultiShipping = req.session.privacyCache.get("usingMultiShipping");

        if (preferredAddress) {
            shippingForm.copyFrom(preferredAddress);
            billingForm.copyFrom(preferredAddress);
        }

        // Loop through all shipments and make sure all are valid
        var allValid = COHelpers.ensureValidShipments(currentBasket);

        var orderModel = new OrderModel(
            currentBasket,
            {
                customer: currentCustomer,
                usingMultiShipping: usingMultiShipping,
                shippable: allValid,
                countryCode: currentLocale.country,
                containerView: "basket"
            }
        );

        // Get rid of this from top-level ... should be part of OrderModel???
        var currentYear = new Date().getFullYear();
        var creditCardExpirationYears = [];

        for (var j = 0; j < 10; j++) {
            creditCardExpirationYears.push(currentYear + j);
        }

        var accountModel = new AccountModel(req.currentCustomer);

        var reportingURLs;
        reportingURLs = reportingUrlsHelper.getCheckoutReportingURLs(
            currentBasket.UUID,
            2,
            "Shipping"
        );

        var isAuthError = req.querystring.authError = "true" &&  currentStage == "payment" ? true : false;

        var simplePrescritionLineItems = [];
        orderModel.shipping.forEach(function (shipping) {
            shipping.productLineItems.items.forEach(function (lineItem) {
                if (!empty(lineItem.custom.difarmaPrescriptionModel) && lineItem.custom.difarmaPrescriptionModel.value === "simple") {
                    simplePrescritionLineItems.push(lineItem);
                }
            });
        });

        res.render("checkout/checkout", {
            order: orderModel,
            simplePrescritionLineItems : simplePrescritionLineItems,
            customer: accountModel,
            isPrescriptionUploadServiceEnabled    : isPrescriptionUploadServiceEnabled,
            isRestrictedPrescriptionUploadEnabled : isRestrictedPrescriptionUploadEnabled,
            isInventoryCheckServiceEnabled        : isInventoryCheckServiceEnabled,
            isZoneCityMappingEnabled              : isZoneCityMappingEnabled,
            forms: {
                shippingForm: shippingForm,
                billingForm: billingForm
            },
            expirationYears: creditCardExpirationYears,
            currentStage: currentStage,
            reportingURLs: reportingURLs,
            prescription: currentBasket.custom.difarmaPrescriptionModel,
            isAuthError: isAuthError
        });

        this.on("route:BeforeComplete", function (req1, res1) { // eslint-disable-line no-shadow
            var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");
            var Logger       = require("dw/system/Logger");
            var storeHelpers = require("*/cartridge/scripts/helpers/storeHelpers");
            var StoreMgr     = require("dw/catalog/StoreMgr");

            var isCreated = req1.querystring.isCreated != "false";
            var hasRefillProducts = sorHelper.checkForRefillProducts();
            var viewData = res1.getViewData();
            var profileForm = server.forms.getForm("profile");
            var currentBasket1 = BasketMgr.getCurrentBasket();
            var shipment = currentBasket1.defaultShipment;
            var shippingAddress = shipment.shippingAddress;
            var billingAddress1 = currentBasket1.getBillingAddress();
            var currentCustomer1 = req1.currentCustomer.raw;
            var currentLocale1 = Locale.getLocale(req1.locale.id);
            var allValid1 = COHelpers.ensureValidShipments(currentBasket1);
            var dmList = COHelpers.getDepartamentosAndMunicipios();
            var currentSite = dw.system.Site.getCurrent();
            var zoneId = storeHelpers.getZoneId(req1);
            
            if (zoneId) {
                var store = StoreMgr.getStore(zoneId);
                if (!empty(store)) {
                    viewData.zone = {
                        state: store.getStateCode(),
                        municipio: store.getCity()
                    };
                }
            }

            if (productHelper.basketHasUnavailableProducts()) {
                res.redirect(URLUtils.home().toString());
            }

            // Checks if customer logged in from Facebook account with empty document number.
            if (currentCustomer1.authenticated) {
                var customerProfile = currentCustomer1.profile;
                isCreated = !empty(customerProfile) && hasCompleteProfile(customerProfile);
                if (!isCreated) {
                    profileForm.customer.firstname.value = customerProfile.firstName;
                    profileForm.customer.lastname.value = customerProfile.lastName;
                    if (validationHelpers.validateEmail(customerProfile.email)) {
                        profileForm.customer.email.value = customerProfile.email;
                    } else {
                        profileForm.customer.email.value = "";
                    }
                }
            }

            viewData.homeDeliveryMessage = shipment.custom.homeDeliveryMessage;
            viewData.departamentos = dmList.departamentos;
            viewData.municipios = dmList.municipios;
            viewData.isCreated = isCreated;
            viewData.profileForm = profileForm;
            viewData.customerName = currentBasket1.getCustomerName();
            viewData.isMemberOfClubVerde = LoyaltyUtils.isClubMember();
            viewData.hasClubProducts = cartHelper.hasClubProducts();
            viewData.googlePlacesBrowserApiKey = currentSite.getCustomPreferenceValue("GooglePlacesBrowserAPIKEY");
            viewData.uploadImageUrl = URLUtils.url("PrescriptionServices-UploadImage").relative().toString();
            viewData.deleteImageUrl = URLUtils.url("PrescriptionServices-DeleteImage").relative().toString();
            viewData.applyToAll = URLUtils.url("PrescriptionServices-ApplyImageToAll").relative().toString();

            Transaction.wrap(function () {
                var data = {};
                if (empty(shippingAddress)) {
                    shippingAddress = shipment.createShippingAddress();
                }
                if (empty(billingAddress1)) {
                    billingAddress1 = currentBasket1.createBillingAddress();
                }
                if (!empty(currentCustomer1.profile)) {
                    currentBasket1.setCustomerEmail(currentCustomer1.profile.getEmail());
                    data.firstName = currentCustomer1.profile.getFirstName();
                    data.lastName = currentCustomer1.profile.getLastName();
                    data.phone = currentCustomer1.profile.getPhoneMobile();
                } else {
                    data.firstName = profileForm.customer.firstname.htmlValue;
                    data.lastName = profileForm.customer.lastname.htmlValue;
                    data.phone = profileForm.customer.phone.htmlValue;
                }
                data.countryCode = currentLocale1.country || Site.current.getCustomPreferenceValue("CountryCode");
                updateOrderAddress(shippingAddress, data);
                updateOrderAddress(billingAddress1, data);
            });

            if (sorEnabled && hasRefillProducts) {
                viewData.hasRefillProducts = hasRefillProducts;
            }
            var orderModel1 = new OrderModel(
                currentBasket1,
                {
                    customer: currentCustomer1,
                    usingMultiShipping: false,
                    shippable: allValid1,
                    countryCode: currentLocale1.country,
                    containerView: "basket"
                }
            );
            viewData.order = orderModel1;

            var isPickupInStoreTabActive = (viewData.prescription == "restricted") || orderModel1.hasStorePickupOnlyProducts;

            viewData.isPickupInStoreTabActive   = isPickupInStoreTabActive;
            viewData.isRestrictedProductPresent = viewData.prescription == "restricted";

            var shippingMethod = orderModel1.shipping[0].shippingMethod;
            Logger.getLogger("Checkout", "shipment").info(JSON.stringify({
                shippingMethod             : shippingMethod ? shippingMethod.ID : null,
                isPickup                   : shippingMethod ? shippingMethod.custom.storePickupEnabled : null,
                isRestrictedProductPresent : viewData.isRestrictedProductPresent,
                isPickupInStoreTabActive   : isPickupInStoreTabActive
            }));
            viewData.isHomeDeliveryTabEnabled = !orderModel1.hasStorePickupOnlyProducts  && viewData.prescription !== "restricted";
            viewData.isStorePickupTabEnabled  = !orderModel1.hasHomeDeliveryOnlyProducts;

            res1.setViewData(viewData);
        });

        return next();
    }
);

server.append(
    "Login",
    server.middleware.https,
    function (req, res, next) {
        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));
 
        var viewData = res.getViewData();
        var profileForm = server.forms.getForm("profile");
        viewData.profileForm = profileForm;
        viewData.hasClubProducts = cartHelper.hasClubProducts();
        res.setViewData(viewData);
        this.on("route:BeforeComplete", function (_req1, res1) {
            if (productHelper.basketHasUnavailableProducts()) {
                res1.redirect(URLUtils.home().toString());
            }
        });
        return next();
    }
);

function validateGuestInfo(form) {
    var errors = {};
    if (!form.firstName || !form.lastName) {
        errors.name = Resource.msg("error.missing", "forms", null);
    }
    if (!form.email) {
        errors.email = Resource.msg("error.missing", "forms", null);
    }
    if (!form.phone) {
        errors.phone = Resource.msg("error.missing", "forms", null);
    }

    var cedulaError = validationHelpers.validateDocument(form.document, form.cedula);
    if (cedulaError) {
        errors.cedula = cedulaError;
    } else {
        var alreadyTakenError = validationHelpers.documentAlreadyRegistered(form.document, form.cedula);

        if (alreadyTakenError) {
            errors.cedula = alreadyTakenError;
        }
    }

    if (Object.keys(errors).length) {
        return errors;
    } else {
        return undefined;
    }
}

server.post("GuestInfo",
    function (req, res, next) {
        var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");

        var currentBasket = BasketMgr.getCurrentBasket();
        var form = req.form;
        var profileForm = server.forms.getForm("profile");
        var shipment = currentBasket.defaultShipment;
        var shippingAddress = shipment.shippingAddress;
        var errors = validateGuestInfo(form);
        if (errors) {
            res.json({
                success: false,
                fields: errors
            });
            return next();
        }

        LoyaltyUtils.checkAndSetGuestLoyaltyMember(form.cedula);
        LoyaltyUtils.checkAndSetSpecificCustomerGroup(form.cedula);

        Transaction.wrap(function () {
            profileForm.customer.firstname.value = form.firstName;
            profileForm.customer.lastname.value = form.lastName;
            profileForm.customer.email.value = form.email;
            profileForm.customer.phone.value = form.phone;
            profileForm.customer.document.value = form.document;
            profileForm.customer.cedula.value = form.cedula;
            currentBasket.setCustomerEmail(form.email);
            currentBasket.setCustomerName(form.firstName + " " + form.lastName);
            if (shippingAddress === null) {
                shippingAddress = shipment.createShippingAddress();
            }

            shippingAddress.setFirstName(form.firstName);
            shippingAddress.setLastName(form.lastName);
            shippingAddress.setPhone(form.phone);
        });
        res.json({
            success: true,
            redirectURL: URLUtils.url("Checkout-Begin").relative().toString()
        });

        return next();
    }
);
/**
 * Fills the OrderAddress with the given data
 * @param {dw.order.OrderAddress} address the OrderAddress instance
 * @param {Object} data an object with the data to fill in the address
 */
function updateOrderAddress(orderAddress, data) {
    if (!empty(orderAddress)) {
        orderAddress.setFirstName(data.firstName || "");
        orderAddress.setLastName(data.lastName || "");
        orderAddress.setPhone(data.phone || "");
        orderAddress.setCountryCode(data.countryCode);
    }
}

server.get("SetDayNightShippingTime", function (req, res, next) {
    var basket       = BasketMgr.getCurrentBasket();
    var isToday      = req.querystring.isToday === "true";
    var todayTime    = req.querystring.todayTime;
    var tomorrowTime = req.querystring.tomorrowTime;

    var currentSite       = Site.getCurrent();
    var businessStartTime = currentSite.preferences.custom.businessStartTime;
    var businessEndTime   = currentSite.preferences.custom.businessEndTime;
    var actualTime        = Number(isToday ? todayTime : tomorrowTime);

    Transaction.wrap(function () {
        basket.custom.ExtnIsNightShipping = !empty(actualTime) && (actualTime < businessStartTime || businessEndTime < actualTime);
    });

    res.json({
        success : true
    });

    next();
});

module.exports = server.exports();
