"use strict";
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
var base = module.superModule;

var Calendar    = require("dw/util/Calendar");
var HashMap     = require("dw/util/HashMap");
var Resource    = require("dw/web/Resource");
var Site        = require("dw/system/Site");
var BasketMgr   = require("dw/order/BasketMgr");
var Transaction = require("dw/system/Transaction");
var Order       = require("dw/order/Order");
var Status      = require("dw/system/Status");
var server      = require("server");
var PaymentMgr  = require("dw/order/PaymentMgr");
var HookMgr     = require("dw/system/HookMgr");
var Logger      = require("dw/system/Logger");
var StringUtils = require("dw/util/StringUtils");

var storeHelpers = require("*/cartridge/scripts/helpers/storeHelpers");
var instorePUstoreHelpers = require("*/cartridge/scripts/helpers/instorePickupStoreHelpers");
var OrderMgr = require("dw/order/OrderMgr");
var OrderLoadHelper = require("*/cartridge/scripts/helpers/orderLoadHelper");

var METHOD_MERCADOPAGO_CREDIT = Resource.msg("payment.method.id", "mercadoPagoPreferences", null);

/**
 * Sends a confirmation to the current user
 * @param {dw.order.Order} order - The current user"s order
 * @param {string} locale - the current request"s locale id
 * @returns {void}
 */
function sendConfirmationEmail(order, locale) {
    var customer = order.getCustomer();
    var customerProfile = customer.getProfile();
    var accountHelpers = require("*/cartridge/scripts/helpers/accountHelpers");
    var OrderModel = require("*/cartridge/models/order");
    var Mail = require("dw/net/Mail");
    var Locale = require("dw/util/Locale");
    var Template = require("dw/util/Template");
    var LoyaltyUtils = require("*/cartridge/scripts/utils/LoyaltyUtils");
    var document = null;

    if (!empty(customerProfile)) {
        document = accountHelpers.getCustomerDocument(customerProfile);
    } else {
        document = order.custom.ccDocument ||
            order.custom.ceDocument ||
            order.custom.passport ||
            order.custom.difarmaRunRutNit;
    }

    Logger.warn("Customer: ");
    Logger.warn(customer);
    Logger.warn("session: ");
    Logger.warn(session.custom);
    var context = new HashMap();
    var currentLocale = Locale.getLocale(locale);

    var orderModel = new OrderModel(order, { countryCode: currentLocale.country });

    var orderObject = {
        order: orderModel,
        standardProductLineItems: orderModel.items.items
    };

    if (orderModel.shipping[0].selectedShippingMethod.storePickupEnabled) {
        orderObject.pickupTime = instorePUstoreHelpers.getPickUpInStoreDateAndTime(order.creationDate);
        var pickUpTimeCalendar = new Calendar(orderObject.pickupTime);
        orderObject.pickupTimeDayOfWeek = StringUtils.formatCalendar(pickUpTimeCalendar, "EEEE");
        orderObject.pickupTimeMonth = StringUtils.formatCalendar(pickUpTimeCalendar, "MMMM");
    }

    if (Site.current.getCustomPreferenceValue("SorEnabled") && session.custom.hasSORProducts) {
        // It marks the order as a First SOR Order
        Transaction.wrap(function () {
            order.custom.isFirstSorOrder = true;
        });

        var RefillCustomerModel = require("int_smartorderrefill/cartridge/models/RefillCustomer.js");
        var array = require("*/cartridge/scripts/util/array");
        var refillCustomer = new RefillCustomerModel({
            preferences: require("dw/system/Site").current.preferences,
            customer: require("dw/customer/CustomerMgr").getCustomerByLogin(customer.profile.email)
        });
        var subscriptionList = refillCustomer.createSmartOrderRefillSubscription(order);
        orderObject.HasRefillProducts = true;
        orderObject.Order = order;
        orderObject.RefillList = [subscriptionList];
        orderObject.SORProductLineItems = [];
        orderObject.standardProductLineItems = [];
        orderObject.order.items.items.map(function (item) {
            var isSORProduct = !!array.find(subscriptionList.products, function (product) {
                return product.ID === item.id;
            });
            if (isSORProduct) {
                orderObject.SORProductLineItems.push(item);
            } else {
                orderObject.standardProductLineItems.push(item);
            }
        });
        delete session.custom.hasSORProducts;
    }

    Object.keys(orderObject).forEach(function (key) {
        context.put(key, orderObject[key]);
    });

    context.put("isMemberOfCruzVerde", LoyaltyUtils.isClubMember());

    var template = new Template("checkout/confirmation/confirmationEmail");
    var content = template.render(context).text;

    // Set Order for hook compat
    context.put("Order", order);
    // Set extra param, CurrentLocale
    context.put("CurrentLocale", currentLocale);

    var hookID = "app.mail.sendMail";
    if (HookMgr.hasHook(hookID)) {
        var MarketingCloudUtils = require("*/cartridge/scripts/utils/MarketingCloudUtils");
        var isMarketingCloudEnabled = MarketingCloudUtils.getMarketingCloudEnabled();
        
        var sendMailObj = {
            communicationHookID: "order.confirmation",
            template: "checkout/confirmation/confirmationEmail",
            toEmail: order.customerEmail,
            document: document,
            subject: Resource.msg("subject.order.confirmation.email", "order", null),
            messageBody: content,
            params: context
        };
        if (!isMarketingCloudEnabled) {
            sendMailObj.fromEmail = Site.current.getCustomPreferenceValue("customerServiceEmail") || "no-reply@salesforce.com";
        }
        HookMgr.callHook(
            hookID,
            "sendMail",
            sendMailObj
        );
    } else {
        var confirmationEmail = new Mail();

        confirmationEmail.addTo(order.customerEmail);
        confirmationEmail.setSubject(Resource.msg("subject.order.confirmation.email", "order", null));
        confirmationEmail.setFrom(Site.current.getCustomPreferenceValue("customerServiceEmail")
            || "no-reply@salesforce.com");

        confirmationEmail.setContent(content, "text/html", "UTF-8");
        confirmationEmail.send();
    }
}

/**
 * Copies a CustomerAddress to a Shipment as its Shipping Address
 * @param {dw.customer.CustomerAddress} address - The customer address
 * @param {dw.order.Shipment} [shipmentOrNull] - The target shipment
 */
function copyCustomerAddressToShipment(address, shipmentOrNull) {
    var currentBasket = BasketMgr.getCurrentBasket();
    var shipment = shipmentOrNull || currentBasket.defaultShipment;
    var shippingAddress = shipment.shippingAddress;

    Transaction.wrap(function () {
        if (shippingAddress === null) {
            shippingAddress = shipment.createShippingAddress();
        }
        shippingAddress.custom.barrio = address.barrio;
        shippingAddress.setFirstName(address.firstName);
        shippingAddress.setLastName(address.lastName);
        shippingAddress.setAddress1(address.address1);
        shippingAddress.setAddress2(address.address2);
        shippingAddress.setCity(address.city);
        shippingAddress.setPostalCode(address.postalCode);
        shippingAddress.setStateCode(address.stateCode);
        var countryCode = address.countryCode;
        shippingAddress.setCountryCode(countryCode.value);
        shippingAddress.setPhone(address.phone);
    });
}

/**
 * Overriding function to adapt for Mercado Pago instead of standard credit card
 */
function savePaymentInstrumentToWallet(billingData, currentBasket, customer) {
    var PaymentInstrument = require("dw/order/PaymentInstrument");
    var MercadoPagoHelper = require("*/cartridge/scripts/util/MercadoPagoHelper");

    var wallet = customer.getProfile().getWallet();

    return Transaction.wrap(function () {
        var storedPaymentInstrument = null;
        var token                   = null;

        if (MercadoPagoHelper.isMercadoPagoEnabled()) {
            storedPaymentInstrument = wallet.createPaymentInstrument(METHOD_MERCADOPAGO_CREDIT);

            storedPaymentInstrument.setCreditCardHolder(
                currentBasket.billingAddress.fullName
            );
            storedPaymentInstrument.setCreditCardNumber(
                billingData.paymentInformation.mercadoPago.cardNumber.value
            );
            storedPaymentInstrument.setCreditCardType(
                billingData.paymentInformation.mercadoPago.cardType.value
            );
            storedPaymentInstrument.setCreditCardExpirationMonth(
                billingData.paymentInformation.mercadoPago.expirationMonth.value
            );
            storedPaymentInstrument.setCreditCardExpirationYear(
                billingData.paymentInformation.mercadoPago.expirationYear.value
            );

            token = Math.random().toString(36).substr(2);

            storedPaymentInstrument.setCreditCardToken(token);

            return storedPaymentInstrument;
        } else {
            storedPaymentInstrument = wallet.createPaymentInstrument(PaymentInstrument.METHOD_CREDIT_CARD);

            storedPaymentInstrument.setCreditCardHolder(
                currentBasket.billingAddress.fullName
            );
            storedPaymentInstrument.setCreditCardNumber(
                billingData.paymentInformation.cardNumber.value
            );
            storedPaymentInstrument.setCreditCardType(
                billingData.paymentInformation.cardType.value
            );
            storedPaymentInstrument.setCreditCardExpirationMonth(
                billingData.paymentInformation.expirationMonth.value
            );
            storedPaymentInstrument.setCreditCardExpirationYear(
                billingData.paymentInformation.expirationYear.value
            );

            var processor = PaymentMgr.getPaymentMethod(PaymentInstrument.METHOD_CREDIT_CARD).getPaymentProcessor();
            token = HookMgr.callHook(
                "app.payment.processor." + processor.ID.toLowerCase(),
                "createMockToken"
            );

            storedPaymentInstrument.setCreditCardToken(token);

            return storedPaymentInstrument;
        }
    });
}

/* Attempts to create an order from the current basket
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {dw.order.Order} The order object created from the current basket
 */
function createOrder(currentBasket) {
    var order = null;
    var storeId;
    var shipment = currentBasket.defaultShipment;
    if (shipment && "custom" in shipment
        && "fromStoreId" in shipment.custom
        && shipment.custom.fromStoreId) {
        storeId = shipment.custom.fromStoreId;
    } else {
        storeId = storeHelpers.getZoneId();
    }
    if (storeId) {
        var productLineItems = currentBasket.getAllProductLineItems();
        for (var i=0; i<productLineItems.length; i++) {
            var productLineItem = productLineItems[i];
            instorePUstoreHelpers.setStoreInProductLineItem(storeId, productLineItem);
        }
    }
    try {
        order = Transaction.wrap(function () {
            var newOrder = OrderMgr.createOrder(currentBasket);

            newOrder
                .allProductLineItems
                .toArray()
                .forEach(function (lineItem) {
                    lineItem.custom.isProductSorEligible =lineItem.product && lineItem.product.custom.SorProduct;
                });

            return newOrder;
        });
    } catch (error) {
        var errorMessage = error.message;
        Logger.error("Error creating order - " + errorMessage);
    }
    return order;
}

function setCustomerDocuments(order) {
    var accountHelpers   = require("*/cartridge/scripts/helpers/accountHelpers");
    var isRegisteredUser = !empty(customer.profile);

    if (isRegisteredUser) {
        order.custom.ceDocument = customer.profile.custom.ceDocument;
        order.custom.ccDocument = customer.profile.custom.ccDocument;
        order.custom.passport   = customer.profile.custom.passport;
    } else {
        var profileForm = server.forms.getForm("profile");
        var docType     = profileForm.customer.document.value;
        var docValue    = profileForm.customer.cedula.value;
        accountHelpers.setProfileDocumentsData(order, docType, docValue);
    }
}

/**
 * Attempts to place the order
 * @param {dw.order.Order} order - The order object to be placed
 * @param {Object} fraudDetectionStatus - an Object returned by the fraud detection hook
 * @param {Object} paymentResult - MP payment result object
 * @returns {Object} an error object
 */
function placeOrder(order, fraudDetectionStatus, paymentResult) {
    var result = { error: false };

    try {
        Transaction.wrap(function () {
            var placeOrderStatus = OrderMgr.placeOrder(order);
            if (placeOrderStatus.status === Status.ERROR) {
                Logger.error("order placement failed - code: " +
                    placeOrderStatus.code + " - message:" + placeOrderStatus.message);
                result.error = true;
                OrderMgr.failOrder(order, true);
                return;
            }

            if (fraudDetectionStatus.status === "flag") {
                order.setConfirmationStatus(Order.CONFIRMATION_STATUS_NOTCONFIRMED);
            } else {
                order.setConfirmationStatus(Order.CONFIRMATION_STATUS_CONFIRMED);
            }

            setCustomerDocuments(order);

            if (paymentResult.isPaymentAuthorized) {
                order.setExportStatus(Order.EXPORT_STATUS_READY);
                order.custom.isEmailSent = true;
            } else {
                order.setExportStatus(Order.EXPORT_STATUS_NOTEXPORTED);
            }

            OrderLoadHelper.fillPostPlacementData(order);

        });

        if (paymentResult.isPaymentAuthorized) {
            sendConfirmationEmail(order, request.locale);
        }
    } catch (e) {
        Logger.error("order placement failed: " + e.stack);
        Transaction.wrap(function () {
            OrderMgr.failOrder(order, true);
        });
        result.error = true;
    }

    return result;
}

/**
 * Sets the payment transaction amount
 * @param {dw.order.Basket} currentBasket - The current basket
 * @returns {Object} an error object
 */
function calculatePaymentTransaction(currentBasket) {
    var result = { error: false };

    try {
        Transaction.wrap(function () {
            // TODO: This function will need to account for gift certificates at a later date
            var orderTotal = currentBasket.totalGrossPrice;
            var paymentInstrument = currentBasket.paymentInstruments[0];
            paymentInstrument.paymentTransaction.setAmount(orderTotal);
        });
    } catch (e) {
        result.error = true;
    }

    return result;
}

/**
 * Overriding method to provide proper error messages according to MP
 */
function handlePayments(order, orderNumber) {
    var result = {};

    if (order.totalNetPrice !== 0.00) {
        var paymentInstruments = order.paymentInstruments;

        if (paymentInstruments.length === 0) {
            Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
            result.error = true;
        }

        if (!result.error) {
            for (var i = 0; i < paymentInstruments.length; i++) {
                var paymentInstrument = paymentInstruments[i];
                var paymentProcessor = PaymentMgr
                    .getPaymentMethod(paymentInstrument.paymentMethod)
                    .paymentProcessor;
                var authorizationResult;
                if (paymentProcessor === null) {
                    Transaction.begin();
                    paymentInstrument.paymentTransaction.setTransactionID(orderNumber);
                    Transaction.commit();
                } else {
                    if (HookMgr.hasHook("app.payment.processor." +
                            paymentProcessor.ID.toLowerCase())) {
                        authorizationResult = HookMgr.callHook(
                            "app.payment.processor." + paymentProcessor.ID.toLowerCase(),
                            "Authorize",
                            orderNumber,
                            paymentInstrument,
                            paymentProcessor
                        );

                        result.isPaymentAuthorized = authorizationResult.isPaymentAuthorized;

                        // Checks if its webpay
                        if ("creditCardType" in paymentInstrument && paymentInstrument.creditCardType === "webpay") {
                            result.isWebpay = true;
                        }
                        // Checks if payment method is PSE
                        if ("creditCardType" in paymentInstrument && paymentInstrument.creditCardType == "pse") {
                            result.isPSE = true;
                        }
                    } else {
                        authorizationResult = HookMgr.callHook(
                            "app.payment.processor.default",
                            "Authorize"
                        );
                    }

                    if (authorizationResult.error) {
                        Transaction.wrap(function () { OrderMgr.failOrder(order, true); });
                        result.error = true;
                        if (!empty(authorizationResult.serverErrors)) {
                            result.errorMessage = authorizationResult.serverErrors[0];
                        }
                        result.authError = authorizationResult.authError;
                        break;
                    }
                }
            }
        }
    }

    return result;
}


base.sendConfirmationEmail = sendConfirmationEmail;
base.copyCustomerAddressToShipment = copyCustomerAddressToShipment;
base.savePaymentInstrumentToWallet = savePaymentInstrumentToWallet;
base.createOrder = createOrder;
base.placeOrder = placeOrder;
base.calculatePaymentTransaction = calculatePaymentTransaction;
base.handlePayments = handlePayments;
module.exports = base;
