"use strict";

var BasketMgr      = require("dw/order/BasketMgr");
var csrfProtection = require("*/cartridge/scripts/middleware/csrf");
var server         = require("server");
var Transaction    = require("dw/system/Transaction");
var LoggerUtils    = require("*/cartridge/scripts/utils/LoggerUtils");

server.extend(module.superModule);

server.replace("PlaceOrder", server.middleware.https, function (req, res, next) {
    var OrderMgr = require("dw/order/OrderMgr");
    var Resource = require("dw/web/Resource");
    var URLUtils = require("dw/web/URLUtils");
    var basketCalculationHelpers = require("*/cartridge/scripts/helpers/basketCalculationHelpers");
    var hooksHelper = require("*/cartridge/scripts/helpers/hooks");
    var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");
    var validationHelpers = require("*/cartridge/scripts/helpers/basketValidationHelpers");
    var inventoryHelpers = require("*/cartridge/scripts/helpers/inventoryHelpers");
    var StoreMgr = require("dw/catalog/StoreMgr");

    var currentBasket = BasketMgr.getCurrentBasket();
    var validatedProducts = validationHelpers.validateProducts(currentBasket);

    if (!currentBasket || validatedProducts.error) {
        res.json({
            error: true,
            cartError: true,
            fieldErrors: [],
            serverErrors: [],
            redirectUrl: URLUtils.url("Cart-Show").toString()
        });
        return next();
    }

    if (req.session.privacyCache.get("fraudDetectionStatus")) {
        res.json({
            error: true,
            cartError: true,
            redirectUrl: URLUtils.url("Error-ErrorCode", "err", "01").toString(),
            errorMessage: Resource.msg("error.technical", "checkout", null)
        });

        return next();
    }

    var validationOrderStatus = hooksHelper("app.validate.order", "validateOrder", currentBasket, require("*/cartridge/scripts/hooks/validateOrder").validateOrder);
    if (validationOrderStatus.error) {
        res.json({
            error: true,
            errorMessage: validationOrderStatus.message
        });
        return next();
    }

    // Check to make sure there is a shipping address
    if (currentBasket.defaultShipment.shippingAddress === null) {
        res.json({
            error: true,
            errorStage: {
                stage: "shipping",
                step: "address"
            },
            errorMessage: Resource.msg("error.no.shipping.address", "checkout", null)
        });
        return next();
    }

    // Check to make sure billing address exists
    if (!currentBasket.billingAddress) {
        res.json({
            error: true,
            errorStage: {
                stage: "payment",
                step: "billingAddress"
            },
            errorMessage: Resource.msg("error.no.billing.address", "checkout", null)
        });
        return next();
    }

    // Calculate the basket
    Transaction.wrap(function () {
        basketCalculationHelpers.calculateTotals(currentBasket);
    });

    // Re-validates existing payment instruments
    var validPayment = COHelpers.validatePayment(req, currentBasket);
    if (validPayment.error) {
        res.json({
            error: true,
            errorStage: {
                stage: "payment",
                step: "paymentInstrument"
            },
            errorMessage: Resource.msg("error.payment.not.valid", "checkout", null)
        });
        return next();
    }

    // Re-calculate the payments.
    var calculatedPaymentTransactionTotal = COHelpers.calculatePaymentTransaction(currentBasket);
    if (calculatedPaymentTransactionTotal.error) {
        res.json({
            error: true,
            errorMessage: Resource.msg("error.technical", "checkout", null)
        });
        return next();
    }

    var unavailableProductList = inventoryHelpers.getListOfUnavailableProducts(!currentBasket.defaultShipment.shippingMethod.custom.storePickupEnabled, currentBasket.getDefaultShipment().getShippingAddress().getCity());

    if (unavailableProductList.length > 0) {
        res.json({
            error                 : true,
            cartError             : true,
            productsOutOfStock    : unavailableProductList,
            outOfStockRedirectUrl : URLUtils.url("Checkout-Begin").toString()
        });
        return next();
    }

    // Creates a new order.
    var order = COHelpers.createOrder(currentBasket);
    if (!order) {
        res.json({
            error: true,
            errorMessage: Resource.msg("error.technical", "checkout", null)
        });
        return next();
    }

    if (!empty(currentBasket.custom.difarmaPrescriptionModel)) {
        Transaction.wrap(function () {
            order.custom.difarmaPrescriptionModel = currentBasket.custom.difarmaPrescriptionModel;
        });
    }

    // Handles payment authorization
    var paymentResult = COHelpers.handlePayments(order, order.orderNo);
    if (paymentResult.error) {
        res.json({
            error: true,
            errorMessage: paymentResult.errorMessage || Resource.msg("error.technical", "checkout", null),
            authError: paymentResult.authError
        });
        return next();
    }

    var fraudDetectionStatus = hooksHelper("app.fraud.detection", "fraudDetection", currentBasket, require("*/cartridge/scripts/hooks/fraudDetection").fraudDetection);
    if (fraudDetectionStatus.status === "fail") {
        Transaction.wrap(function () { OrderMgr.failOrder(order); });

        // fraud detection failed
        req.session.privacyCache.set("fraudDetectionStatus", true);

        res.json({
            error: true,
            cartError: true,
            redirectUrl: URLUtils.url("Error-ErrorCode", "err", fraudDetectionStatus.errorCode).toString(),
            errorMessage: Resource.msg("error.technical", "checkout", null)
        });

        return next();
    }

    if (!paymentResult.isWebpay && !paymentResult.isPSE) {
        // Places the order
        var placeOrderResult = COHelpers.placeOrder(order, fraudDetectionStatus, paymentResult);
        if (placeOrderResult.error) {
            res.json({
                error: true,
                errorMessage: Resource.msg("error.technical", "checkout", null)
            });
            return next();
        }
    }

    // Reset usingMultiShip after successful Order placement
    req.session.privacyCache.set("usingMultiShipping", false);

    LoggerUtils.sessionInfo("Order Placed: " + order.orderNo);

    // TODO: Exposing a direct route to an Order, without at least encoding the orderID
    //  is a serious PII violation.  It enables looking up every customers orders, one at a
    //  time.
    res.json({
        error: false,
        orderID: order.orderNo,
        orderToken: order.orderToken,
        continueUrl: URLUtils.url("Order-Confirm", "isPaymentAuthorized", paymentResult.isPaymentAuthorized).toString()
    });

    return next();
});

/**
 *  Handle Ajax payment (and billing) form submit
 */
server.replace(
    "SubmitPayment",
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var PaymentManager = require("dw/order/PaymentMgr");
        var HookManager = require("dw/system/HookMgr");
        var Resource = require("dw/web/Resource");
        var MercadoPagoHelper = require("*/cartridge/scripts/util/MercadoPagoHelper");
        var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");

        var viewData = {};
        var paymentForm = server.forms.getForm("billing");
        var formPhoneField = paymentForm.contactInfoFields.phone;

        // Handles legacy customers that have no phone in the selected address;
        if (empty(formPhoneField.value) && !empty(customer.profile)) {
            formPhoneField.value = customer.profile.phoneMobile ||
                Resource.msg("label.input.countrycode", "forms", null) + "000000000";

            formPhoneField.valid = true;
        }

        // verify billing form data
        var billingFormErrors = COHelpers.validateBillingForm(paymentForm.addressFields);
        var contactInfoFormErrors = COHelpers.validateFields(paymentForm.contactInfoFields);

        // Handles legacy customers that have invalid phone number;
        if (!empty(contactInfoFormErrors["dwfrm_billing_contactInfoFields_phone"])) {
            formPhoneField.value = Resource.msg("label.input.countrycode", "forms", null) + "000000000";

            delete contactInfoFormErrors["dwfrm_billing_contactInfoFields_phone"];
        }

        var formFieldErrors = [];
        if (Object.keys(billingFormErrors).length) {
            formFieldErrors.push(billingFormErrors);
        } else {
            viewData.address = {
                firstName: { value: paymentForm.addressFields.firstName.value },
                lastName: { value: paymentForm.addressFields.lastName.value },
                address1: { value: paymentForm.addressFields.address1.value },
                address2: { value: paymentForm.addressFields.address2.value },
                city: { value: paymentForm.addressFields.city.value },
                postalCode: { value: paymentForm.addressFields.postalCode.value },
                countryCode: { value: paymentForm.addressFields.country.value }
            };

            if (Object.prototype.hasOwnProperty.call(paymentForm.addressFields, "states")) {
                viewData.address.stateCode = { value: paymentForm.addressFields.states.stateCode.value };
            }
        }

        if (Object.keys(contactInfoFormErrors).length) {
            formFieldErrors.push(contactInfoFormErrors);
        } else {
            viewData.email = {
                value: paymentForm.contactInfoFields.email.value
            };

            viewData.phone = { value: paymentForm.contactInfoFields.phone.value };
        }

        var paymentMethodIdValue = paymentForm.paymentMethod.value;
        if (!PaymentManager.getPaymentMethod(paymentMethodIdValue).paymentProcessor) {
            throw new Error(Resource.msg(
                "error.payment.processor.missing",
                "checkout",
                null
            ));
        }

        var paymentProcessor = PaymentManager.getPaymentMethod(paymentMethodIdValue).getPaymentProcessor();

        var paymentFormResult;

        if (!MercadoPagoHelper.isMercadoPagoEnabled()) {
            delete paymentForm.mercadoPagoCreditCard;

            var cardNumberObj = paymentForm.creditCardFields.cardNumber;
            if (cardNumberObj && cardNumberObj.value) {
                cardNumberObj.value = cardNumberObj.value.replace(/\s/g, "");
            }
        }

        var mpEmailField = paymentForm.mercadoPagoCreditCard.email;
        if (!mpEmailField.value) {
            mpEmailField.value     = paymentForm.contactInfoFields.email.value;
            mpEmailField.htmlValue = paymentForm.contactInfoFields.email.htmlValue;
            mpEmailField.valid     = true;
        }

        if (HookManager.hasHook("app.payment.form.processor." + paymentProcessor.ID.toLowerCase())) {
            paymentFormResult = HookManager.callHook("app.payment.form.processor." + paymentProcessor.ID.toLowerCase(),
                "processForm",
                req,
                paymentForm,
                viewData
            );
        } else {
            paymentFormResult = HookManager.callHook("app.payment.form.processor.default_form_processor", "processForm");
        }

        if (paymentFormResult.error && paymentFormResult.fieldErrors) {
            formFieldErrors.push(paymentFormResult.fieldErrors);
        }

        if (formFieldErrors.length || paymentFormResult.serverErrors) {
            // respond with form data and errors
            res.json({
                form: paymentForm,
                fieldErrors: formFieldErrors,
                serverErrors: paymentFormResult.serverErrors ? paymentFormResult.serverErrors : [],
                error: true
            });
            return next();
        }

        res.setViewData(paymentFormResult.viewData);

        this.on("route:BeforeComplete", function (req1, res1) { // eslint-disable-line no-shadow
            var HookMgr = require("dw/system/HookMgr");
            var PaymentMgr = require("dw/order/PaymentMgr");
            var AccountModel = require("*/cartridge/models/account");
            var OrderModel = require("*/cartridge/models/order");
            var URLUtils = require("dw/web/URLUtils");
            var Locale = require("dw/util/Locale");
            var basketCalculationHelpers = require("*/cartridge/scripts/helpers/basketCalculationHelpers");
            var hooksHelper = require("*/cartridge/scripts/helpers/hooks");
            var validationHelpers = require("*/cartridge/scripts/helpers/basketValidationHelpers");

            var currentBasket = BasketMgr.getCurrentBasket();
            var validatedProducts = validationHelpers.validateProducts(currentBasket);

            var billingData = res1.getViewData();

            if (!currentBasket || validatedProducts.error) {
                delete billingData.paymentInformation;

                res1.json({
                    error: true,
                    cartError: true,
                    fieldErrors: [],
                    serverErrors: [],
                    redirectUrl: URLUtils.url("Cart-Show").toString()
                });
                return;
            }

            var billingAddress = currentBasket.billingAddress;
            var billingForm = server.forms.getForm("billing");
            var paymentMethodID = billingData.paymentMethod.value;
            var result;

            billingForm.creditCardFields.cardNumber.htmlValue = "";
            billingForm.creditCardFields.securityCode.htmlValue = "";

            Transaction.wrap(function () {
                if (!billingAddress) {
                    billingAddress = currentBasket.createBillingAddress();
                }

                billingAddress.setFirstName(billingData.address.firstName.value);
                billingAddress.setLastName(billingData.address.lastName.value);
                billingAddress.setAddress1(billingData.address.address1.value);
                billingAddress.setAddress2(billingData.address.address2.value);
                billingAddress.setCity(billingData.address.city.value);
                billingAddress.setPostalCode(billingData.address.postalCode.value);
                if (Object.prototype.hasOwnProperty.call(billingData.address, "stateCode")) {
                    billingAddress.setStateCode(billingData.address.stateCode.value);
                }
                billingAddress.setCountryCode(billingData.address.countryCode.value);

                if (billingData.storedPaymentUUID) {
                    billingAddress.setPhone(req1.currentCustomer.profile.phone);
                    currentBasket.setCustomerEmail(req1.currentCustomer.profile.email);
                } else {
                    billingAddress.setPhone(billingData.phone.value);
                    currentBasket.setCustomerEmail(billingData.email.value);
                }
            });

            // if there is no selected payment option and balance is greater than zero
            if (!paymentMethodID && currentBasket.totalGrossPrice.value > 0) {
                var noPaymentMethod = {};

                noPaymentMethod[billingData.paymentMethod.htmlName] =
                    Resource.msg("error.no.selected.payment.method", "payment", null);

                delete billingData.paymentInformation;

                res1.json({
                    form: billingForm,
                    fieldErrors: [noPaymentMethod],
                    serverErrors: [],
                    error: true
                });
                return;
            }

            // check to make sure there is a payment processor
            if (!PaymentMgr.getPaymentMethod(paymentMethodID).paymentProcessor) {
                throw new Error(Resource.msg(
                    "error.payment.processor.missing",
                    "checkout",
                    null
                ));
            }

            var processor = PaymentMgr.getPaymentMethod(paymentMethodID).getPaymentProcessor();

            if (HookMgr.hasHook("app.payment.processor." + processor.ID.toLowerCase())) {
                result = HookMgr.callHook("app.payment.processor." + processor.ID.toLowerCase(),
                    "Handle",
                    currentBasket,
                    billingData.paymentInformation
                );
            } else {
                result = HookMgr.callHook("app.payment.processor.default", "Handle");
            }

            // need to invalidate credit card fields
            if (result.error) {
                delete billingData.paymentInformation;

                res1.json({
                    form: billingForm,
                    fieldErrors: result.fieldErrors,
                    serverErrors: result.serverErrors,
                    error: true
                });
                return;
            }

            if (HookMgr.hasHook("app.payment.form.processor." + processor.ID.toLowerCase())) {
                HookMgr.callHook("app.payment.form.processor." + processor.ID.toLowerCase(),
                    "savePaymentInformation",
                    req1,
                    currentBasket,
                    billingData
                );
            } else {
                HookMgr.callHook("app.payment.form.processor.default", "savePaymentInformation");
            }

            // Calculate the basket
            Transaction.wrap(function () {
                basketCalculationHelpers.calculateTotals(currentBasket);
            });

            // Re-calculate the payments.
            var calculatedPaymentTransaction = COHelpers.calculatePaymentTransaction(
                currentBasket
            );

            if (calculatedPaymentTransaction.error) {
                res1.json({
                    form: paymentForm,
                    fieldErrors: [],
                    serverErrors: [Resource.msg("error.technical", "checkout", null)],
                    error: true
                });
                return;
            }

            var usingMultiShipping = req1.session.privacyCache.get("usingMultiShipping");
            if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
                req1.session.privacyCache.set("usingMultiShipping", false);
                usingMultiShipping = false;
            }

            hooksHelper("app.customer.subscription", "subscribeTo", [paymentForm.subscribe.checked, paymentForm.contactInfoFields.email.htmlValue], function () {});

            var currentLocale = Locale.getLocale(req1.locale.id);

            var basketModel = new OrderModel(
                currentBasket,
                { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: "basket" }
            );

            var accountModel = new AccountModel(req1.currentCustomer);
            var renderedStoredPaymentInstrument = COHelpers.getRenderedPaymentInstruments(
                req1,
                accountModel
            );

            delete billingData.paymentInformation;

            res1.json({
                renderedPaymentInstruments: renderedStoredPaymentInstrument,
                customer: accountModel,
                order: basketModel,
                form: billingForm,
                error: false
            });
        });

        return next();
    }
);

/**
 *  Handle Ajax payment (and billing) form submit
 */
server.append(
    "SubmitPayment",
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        this.on("route:BeforeComplete", function (_req, _res) { // eslint-disable-line no-shadow
            var currentBasket = BasketMgr.getCurrentBasket();
            if (empty(currentBasket)) {
                return;
            }

            var billingAddress  = currentBasket.billingAddress;
            var shippingAddress = currentBasket.defaultShipment.shippingAddress;

            Transaction.wrap(function () {
                billingAddress.setFirstName(shippingAddress.firstName);
                billingAddress.setLastName(shippingAddress.lastName);
                billingAddress.setAddress1(shippingAddress.address1);
                billingAddress.setAddress2(shippingAddress.address2);
                billingAddress.setCity(shippingAddress.city);
                billingAddress.setStateCode(shippingAddress.stateCode);
                billingAddress.setCountryCode(shippingAddress.countryCode);
            });
        });

        return next();
    }
);

module.exports = server.exports();
