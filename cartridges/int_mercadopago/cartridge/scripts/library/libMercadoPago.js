"use strict";

/**
 * libMercadoPago.js
 *
 * A library file for Mercado Pago communication.
 */

var collections = require('*/cartridge/scripts/util/collections');
var array = require('*/cartridge/scripts/util/array');
var MercadoPagoHelper = require('*/cartridge/scripts/util/MercadoPagoHelper');

var Resource = require('dw/web/Resource');
var LoggerUtils = require("*/cartridge/scripts/utils/LoggerUtils");
var URLUtils = require("dw/web/URLUtils");

/**
* Mercadopago service and base functions definions
*/
function MercadoPago() {
    //Initialize HTTP services for a cartridge
    var serviceID = 'mercadopago.payment.service.' + dw.system.Site.current.ID.toLowerCase();
    var sandboxEnabled = true;

    this.service = dw.svc.LocalServiceRegistry.createService(serviceID, {
        createRequest: function (svc, args) {
            svc.addHeader('Content-Type', args.contentType);
            svc.setRequestMethod(args.req);
            svc.URL = svc.getConfiguration().credential.URL + args.urlPart;

            if (!empty(args.data)) {
                return JSON.stringify(args.data);
            }
        },
        parseResponse: function (svc, client) {
            if (client.statusCode == 200 || client.statusCode == 201) {
                return MercadoPagoHelper.parseJson(client.getText(), null);
            }

            LoggerUtils.standardError("[MercadoPago][" + svc.getRequestData() + "] : " + client.getErrorText());

            return {};
        },
        mockCall: function (svc) {
            return {
                statusCode: 200,
                statusMessage: 'Success',
                text: 'MOCK RESPONSE (' + svc.URL + ')'
            };
        },
    });

    if (dw.system.System.getInstanceType() === dw.system.System.PRODUCTION_SYSTEM) {
        sandboxEnabled = false;
    }

    // overwrite sandboxEnabled if jsonData has enableSandbox set to true
    this.credentialsConfig = MercadoPagoHelper.parseJson(this.service.getConfiguration().credential.custom.jsonData, null);

    if (!empty(this.credentialsConfig) && 'enableSandbox' in this.credentialsConfig && this.credentialsConfig.enableSandbox === true) {
        sandboxEnabled = true;
    }

    this.sandboxEnabled = sandboxEnabled;

    this.__exec = function (args) {
        var url    = args.urlPart;
        var data   = args.data || "";
        var method = args.req;
        LoggerUtils.serviceInfo("Request to Mercado Pago : \n" + method + " " + url + "\n" + "Body: \n" + JSON.stringify(data));
        var result = this.service.call(args);
        var JSONresponse = JSON.stringify(result.object);

        if (JSONresponse != "null") {
            if (JSONresponse.length == 2 && !empty(result.object.length)) { // response is a list
                JSONresponse = JSON.stringify(result.object.toArray());
                LoggerUtils.serviceInfo("Response from Mercado Pago : \n" + method + " " + url + " Body: \n" + JSONresponse);
            }
        } else {
            JSONresponse = JSON.stringify(result.errorMessage);
            LoggerUtils.serviceError("Response from Mercado Pago : \n" + method + " " + url + " Body: \n" + JSONresponse);
        }

        return result.object;
    };

    this.__get = function (urlPart, contentType) {
        return this.__exec({
            urlPart: urlPart,
            req: 'GET',
            contentType: contentType
        });
    };

    this.__post = function (urlPart, data, contentType) {
        return this.__exec({
            urlPart: urlPart,
            req: 'POST',
            data: data,
            contentType: contentType
        });
    };

    this.__put = function (urlPart, data, contentType) {
        return this.__exec({
            urlPart: urlPart,
            req: 'PUT',
            data: data,
            contentType: contentType
        });
    };

    this.__del = function (urlPart, contentType) {
        return this.__exec({
            urlPart: urlPart,
            req: 'DELETE',
            contentType: contentType
        });
    };
}

/**
 * Builds query for requested data to use in request URL
 * @param  {Object} data
 * @return {String} query
 */
MercadoPago.prototype.buildquery = function (data) {
    var elements = [];

    for (var key in data) {
        if (data.hasOwnProperty(key)) {
            elements.push(key + '=' + encodeURI(data[key]));
        }
    }

    return elements.join('&');
};

/**
 * Gets stored access token which is kept in service credentials password field.
 * @return {String} access token
 */
MercadoPago.prototype.getAccessToken = function () {
    // always return token
    return this.service.getConfiguration().credential.password;
};

/**
 * @description Get available payment methods
 * @return {Array} available payment methods
 */
MercadoPago.prototype.getPaymentMethods = function () {
    var accessToken = this.getAccessToken();

    if (!accessToken) {
        return [];
    }

    var responseCollection = this.__get('/v1/payment_methods?access_token=' + encodeURI(accessToken), 'application/json');
    var responseArray = collections.map(responseCollection, function(responseItem) {
        return responseItem;
    });
    var paymentArray = [];

    if (this.credentialsConfig && this.credentialsConfig.includedPaymentIds) {
        try {
            var includedPaymentIds = this.credentialsConfig.includedPaymentIds;
            responseArray.forEach(function(responseItem) {
                for (var includedPaymentId in includedPaymentIds) {
                    if (includedPaymentId !== responseItem.id) {
                        continue;
                    }

                    paymentArray.push(responseItem);
                }
            });
        } catch(e) {
            LoggerUtils.standardError('libMercadoPago.js - Error when filtering mercadopago payment methods : ' + e.message);
        }
    }

    return paymentArray.length ? paymentArray : responseArray;
};

/**
 * Checks that basic checkout enabled from Json data in service credentials
 * @return {Boolean} boolean value of basic checkout enabled or not
 */
MercadoPago.prototype.isBasicCheckoutEnabled = function () {
    var credential = this.service.getConfiguration().getCredential();
    var isBasicCheckoutEnabled = MercadoPagoHelper.parseJson(credential.custom.jsonData, {}).basicCheckoutEnabled;

    return !!isBasicCheckoutEnabled;
};

/**
 * @description Get group payment methods by payment type
 * @param {Array} paymentMethods
 * @return {Object} grouped payment types as two different arrays in an object
 */
MercadoPago.prototype.groupPaymentMethods = function (paymentMethods) {
    var cards = [];
    var other = [];

    paymentMethods.forEach(function(paymentMethod) {
        if (paymentMethod.payment_type_id.indexOf('card') >= 0) {
            cards.push(paymentMethod);
        } else {
            other.push(paymentMethod);
        }
    });

    if (this.isBasicCheckoutEnabled()) {
        other.push({
            id: 'basiccheckout',
            payment_type_id: 'basiccheckout',
            name: 'Basic Checkout',
            thumbnail: null,
            additional_info_needed: 'no'
        });
    }

    return {
        cards: cards,
        other: other
    };
};

/**
 * Creates payment on billing page to be a Mercadopago Payment
 * @return {Object} payment creation response from Mercadopago
 */
MercadoPago.prototype.createPayment = function (paymentData) {
    var accessToken   = this.getAccessToken();
    var isLoadTesting = require('dw/system/Site').current.getCustomPreferenceValue('mercadoPagoLoadTesting');
    var result        = null;

    if (isLoadTesting) {
        var UUIDUtils = require('dw/util/UUIDUtils');
        result        = {
            id       : UUIDUtils.createUUID(),
            status   : 'approved',
            transaction_details : {
                external_resource_url : 'mock'
            }
        };
        result.status_detail = 'mock ' + result.status;
    } else if (!empty(accessToken)) {
        result = this.__post('/v1/payments?access_token=' + encodeURI(accessToken), paymentData, 'application/json');
    }

    return result;
};

/**
 * Returns payment information for webhooks from Mercadopago
 * @return {Object} payment information from Mercadopago
 */
MercadoPago.prototype.getPaymentInfoWebhook = function (id) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__get('/v1/payments/' + id + '?access_token=' + encodeURI(accessToken), 'application/json');
    }

    return null;
};

/**
 * Creates an authenticated customer on Mercadopago side.
 * @param {Object} customer.profile.email || order.customerEmail
 * @return {Object} create customer event result from Mercadopago
 */
MercadoPago.prototype.createCustomer = function (customerData) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__post('/v1/customers?access_token=' + encodeURI(accessToken), customerData, 'application/json');
    }

    return null;
};

/**
 * Creates an authenticated customer on Mercadopago side.
 * @param {Object} customer.profile.email || order.customerEmail
 * @return {Object} customer on Mercadopago with matched email
 */
MercadoPago.prototype.searchCustomer = function (filter) {
    var accessToken = this.getAccessToken();
    var filters = this.buildquery(filter);

    if (!empty(accessToken)) {
        return this.__get('/v1/customers/search?' + filters + '&access_token=' + encodeURI(accessToken), 'application/json');
    }

    return null;
};

/**
 * Creates an authenticated customer on Mercadopago side.
 * @param {Object} customer.profile.email || order.customerEmail
 * @return {Object} customer on Mercadopago with matched email
 */
MercadoPago.prototype.createCustomerCard = function (customerID, cardToken) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__post('/v1/customers/' + customerID + '/cards?access_token=' + encodeURI(accessToken), {token: cardToken}, 'application/json');
    }

    return null;
};

/**
 * Creates an authenticated customer on Mercadopago side.
 * @param {Object} customer.profile.email || order.customerEmail
 * @return {Object} customer on Mercadopago with matched email
 */
MercadoPago.prototype.getCustomerCard = function (customerID) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__get('/v1/customers/' + customerID + '/cards?access_token=' + encodeURI(accessToken), 'application/json');
    }

    return null;
};

/**
 * Obtains a customer card type from a preapproved card.
 * @param {String} customerID The ID of a customer within Mercado Pago's database.
 * @param {String} cardId The ID of a saved credit card, within Mercado Pago's database.
 * @return {String} The customer saved card type or null.
 */
MercadoPago.prototype.getCustomerCardType = function (customerId, cardId) {
    if (!empty(customerId) && !empty(cardId)) {
        var cardList = this.getCustomerCard(customerId);

        for (var index in cardList) {
            var card = cardList[index];

            if (card.id === cardId) {
                return card.payment_method.id;
            }
        }
    }

    return null;
};

/**
 * Obtains a token for a preapproved credit card.
 * @param {String} cardId The ID of a saved credit card, within Mercado Pago's database.
 * @return {Object} An object with data about a card's token.
 */
MercadoPago.prototype.getCardToken = function (cardId) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__post('/v1/card_tokens/?access_token=' + encodeURI(accessToken), { card_id : cardId }, 'application/json');
    }

    return null;
};

/**
 * Creates test user for given site id.
 * @param {String} Site ID
 * @return {Object} result from
 */
MercadoPago.prototype.createTestCustomer = function (siteID) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__post('/users/test_user?access_token=' + encodeURI(accessToken), siteID, 'application/json');
    }

    return null;
};

/**
 * Gets notifications for payment from Mercadopago
 * @param {String} ID of payment
 * @return {Object} notification for requested payment.
 */
MercadoPago.prototype.getPaymentInfo = function (id) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__get('/v1/payments/' + id + '?access_token=' + encodeURI(accessToken), 'application/json');
    }

    return null;
};

/**
 * Gets order information from Mercadopago with given ID
 * @param {String} ID of Order
 * @return {Object} order list from Mercadopago.
 */
MercadoPago.prototype.getMerchantOrderInfo = function (id) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__get('/merchant_orders/' + id + '?access_token=' + encodeURI(accessToken), 'application/json');
    }

    return null;
};

/**
 * Gets authorized payment information
 * @param {String} ID of Payment
 * @return {Object} payments list from Mercadopago.
 */
MercadoPago.prototype.getAuthorizedPayment = function (id) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__get('/authorized_payments/' + id + '?access_token=' + encodeURI(accessToken), 'application/json');
    }

    return null;
};

/**
 * Refunds payment
 * @param {String} ID of Payment
 * @return {Object} refund payment response
 */
MercadoPago.prototype.refundPayment = function (id) {
    var accessToken = this.getAccessToken();
    var refundStatus = {
        status: 'refunded'
    };

    if (!empty(accessToken)) {
        return this.__put('/v1/payments/' + id + '?access_token=' + encodeURI(accessToken), refundStatus, 'application/json');
    }

    return null;
};

/**
 * Cancels payment
 * @param {String} ID of Payment
 * @return {Object} Cancel payment response
 */
MercadoPago.prototype.cancelPayment = function (id) {
    var accessToken = this.getAccessToken();
    var cancelStatus = {
        status: 'cancelled'
    };

    if (!empty(accessToken)) {
        return this.__put('/v1/payments/' + id + '?access_token=' + encodeURI(accessToken), cancelStatus, 'application/json');
    }

    return null;
};

/**
 * Cancels payment
 * @param {String} ID of Payment
 * @return {Object} Cancel pre-aproval response
 */
MercadoPago.prototype.cancelPreaprovalPayment = function (id) {
    var accessToken = this.getAccessToken();
    var cancelStatus = {
        status: 'cancelled'
    };

    if (!empty(accessToken)) {
        return this.__put('/preapproval/' + id + '?access_token=' + encodeURI(accessToken), cancelStatus, 'application/json');
    }

    return null;
};

/**
 * Creates preference
 * @param {Object} prefenrence
 * @return {Object} create preference response
 */
MercadoPago.prototype.createPreference = function (preference) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__post('/checkout/preferences?access_token=' + encodeURI(accessToken), preference, 'application/json');
    }

    return null;
};

/**
 * Generates access token based on clientId and clientSecret
 * @return {Object} generated access token from Mercadopago
 */
MercadoPago.prototype.getPreferenceAccessToken = function () {
    var credential = this.service.getConfiguration().getCredential();
    var clientId = credential.custom.jsonData.clientId || '';
    var clientSecret = credential.custom.jsonData.clientSecret || '';

    return this.__post('/oauth/token', {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials'
    }, 'application/json');
};

/**
 * Create preference based on token generated using clientId and clientSecret
 * @param {Object} preference
 * @return {Object} preference object created by token generated.
 */
MercadoPago.prototype.createPreferenceObject = function (preference) {
    var accessToken = (this.getPreferenceAccessToken() || {}).access_token;

    if (!empty(accessToken)) {
        return this.__post('/checkout/preferences?access_token=' + encodeURI(accessToken), preference, 'application/json');
    }

    return null;
};

/**
 * Create preference based on token generated using clientId and clientSecret
 * @param {Object} preference
 * @return {Object} preference object created by token generated.
 */
MercadoPago.prototype.createPreferenceUrl = function (order) {
    if (empty(order)) {
        return;
    }

    var backUrl = dw.web.URLUtils.httpsContinue().toString();
    var items = [];
    var payer = {};

    order.allProductLineItems.toArray().forEach(function (productLineItem) {
        var item = {
            id: productLineItem.productID,
            title: productLineItem.product.name,
            quantity: productLineItem.quantityValue,
            currency_id: session.getCurrency().getCurrencyCode(),
            unit_price: productLineItem.getProratedPrice().divide(productLineItem.getQuantity().getValue()).getValue()
        };

        if (!empty(productLineItem.product.longDescription)) {
            item.description = productLineItem.product.longDescription;
        }

        if (!empty(productLineItem.product.primaryCategory)) {
            item.category_id = productLineItem.product.primaryCategory.displayName;
        }

        items.push(item);
    });

    // add shipment costs as item
    if (order.getAdjustedShippingTotalPrice() > 0) {
        var shippingItem = {
            id: order.defaultShipment.shippingMethod.ID,
            title: order.defaultShipment.shippingMethod.displayName,
            quantity: 1,
            currency_id: session.getCurrency().getCurrencyCode(),
            unit_price: order.getAdjustedShippingTotalPrice().getValue()
        };

        items.push(shippingItem);
    }

    payer.name = order.billingAddress.firstName;
    payer.surname = order.billingAddress.lastName;
    payer.email = order.customerEmail;
    payer.phone = payer.phone || {};
    payer.phone.area_code = '-';
    payer.phone.number = order.billingAddress.phone;
    payer.address = payer.address || {};
    payer.address.street_name = order.billingAddress.address1 + '-' + order.billingAddress.city + '-' + order.billingAddress.countryCode;
    payer.address.street_number = '0';
    payer.address.zip_code = order.billingAddress.postalCode;

    var createPreferenceResponse = this.createPreferenceObject({
        external_reference: order.orderNo,
        items: items,
        payer: payer,
        shipments: {
            receiver_address: {
                apartment: '-',
                floor: '-',
                street_name: order.defaultShipment.shippingAddress.address1 + '-' + order.defaultShipment.shippingAddress.city + '-' + order.defaultShipment.shippingAddress.countryCode,
                street_number: '0',
                zip_code: order.defaultShipment.shippingAddress.postalCode
            },
            mode: 'not_specified',
            free_shipping: false
        },
        back_urls: {
            success: backUrl,
            pending: backUrl,
            failure: backUrl
        },
        auto_return: 'all',
        installments: 1,
        transaction_amount: order.getTotalGrossPrice().getValue()
    });

    return this.sandboxEnabled ? createPreferenceResponse.sandbox_init_point : createPreferenceResponse.init_point;
};

/**
 * Creates DW Transaction for given Order to save.
 * @param {Objet} Order
 */
MercadoPago.prototype.createTransaction = function (order) {
    if (empty(order)) {
        return;
    }

    var transactionID = request.httpParameterMap.collection_id.getStringValue();
    var paymentInstrument;
    var paymentProcessor;

    // Get payment instrument
    order.getPaymentInstruments('MercadoPago').toArray().forEach(function (payInstrument) {
        paymentInstrument = payInstrument;
        paymentProcessor = require('dw/order/PaymentMgr').getPaymentMethod(payInstrument.paymentMethod).paymentProcessor;
    });

    // Set payment proccessor
    if (!empty(paymentInstrument)) {
        paymentInstrument.paymentTransaction.paymentProcessor = paymentProcessor;
    }

    // Set transaction id
    paymentInstrument.paymentTransaction.transactionID = transactionID;

    // Set order payment status to paid if order is authorized
    order.setPaymentStatus(require('dw/order/Order').PAYMENT_STATUS_PAID);
};

/**
 * Updates preference.
 */
MercadoPago.prototype.updatePreference = function (id, preference) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__put('/checkout/preferences/' + id + '?access_token=' + encodeURI(accessToken), preference, 'application/json');
    }

    return null;
};

/**
 * Searches payment with constructed filter.
 * @param {Objet} filter
 * @param {String} offset
 * @param {String} limit
 * @return {Object} search result with provided filter parameters in URL
 */
MercadoPago.prototype.searchPayment = function (filters, offset, limit) {
    var accessToken = this.getAccessToken();
    var uriPrefix = this.sandboxEnabled ? '/sandbox' : '';

    filters.offset = !empty(offset) ? offset : '0';
    filters.limit = !empty(offset) ? limit : '0';
    filters = this.buildquery(filters);

    if (!empty(accessToken)) {
        return this.__get(uriPrefix + '/collections/search?' + filters + '&access_token=' + encodeURI(accessToken), 'application/json');
    }

    return null;
};

/**
 * Gets preference
 */
MercadoPago.prototype.getPreference = function (id) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__get('/checkout/preferences/' + id + '?access_token=' + encodeURI(accessToken), 'application/json');
    }

    return null;
};

/**
 * Creates pre-approval payment
 */
MercadoPago.prototype.createPreaprovalPayment = function (preaprovalpayment) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__post('/preapproval?access_token=' + encodeURI(accessToken), preaprovalpayment, 'application/json');
    }

    return null;
};

/**
 * Gets pre-approval payment
 */
MercadoPago.prototype.getPreaprovalPayment = function (id) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__get('/preapproval/' + id + '?access_token=' + encodeURI(accessToken), 'application/json');
    }

    return null;
};

/**
 * Updates pre-aproval payment
 */
MercadoPago.prototype.updatePreaprovalPayment = function (id, preaprovalpayment) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__put('/preapproval/' + id + '?access_token=' + encodeURI(accessToken), preaprovalpayment, 'application/json');
    }

    return null;
};

/**
 * Constructs payment data object to verify the payment on Mercadopago
 * @param {Order} order
 * @param {Object} customer
 * @param {Object} installments
 * @param {String} issuerId
 * @param {String} customerID
 * @return {Object} generated payment data to use in payment call
 */
MercadoPago.prototype.createPaymentData = function (order, customer, installments, issuerId, customerID) {
    // Construct product line items
    var items = collections.map(order.allProductLineItems, function (prodLineItem) {
        var item = {};

        item.id = prodLineItem.productID;
        item.title = prodLineItem.product.name;

        if (prodLineItem.product.longDescription) {
            item.description = prodLineItem.product.longDescription.markup;
        }

        if (prodLineItem.product.primaryCategory) {
            item.category_id = prodLineItem.product.primaryCategory.displayName;
        }

        item.quantity = prodLineItem.quantityValue;
        item.unit_price = prodLineItem.adjustedGrossPrice.value;

        return item;
    });

    // Payer billing information for payer
    var payer = {
        address: {
            street_name: order.billingAddress.address1 + '-' + order.billingAddress.city + '-' + order.billingAddress.countryCode,
            street_number: '0',
            zip_code: order.billingAddress.postalCode
        },
        first_name: order.billingAddress.firstName,
        last_name: order.billingAddress.lastName,
        phone: {
            area_code: '-',
            number: order.billingAddress.phone
        }
    };

    // Customer information
    var paymentPayer = {};
    if (customerID) {
        paymentPayer.id = customerID; // Required for registered customer
        paymentPayer.type = 'customer';
    }

    paymentPayer.email = order.customerEmail;

    if (customer.isAuthenticated()) {
        payer.registration_date = customer.profile.getCreationDate();
    }

    // Payment method id and token
    var paymentMethodId;
    var token;
    var docType;
    var docNumber;

    collections.forEach(order.getPaymentInstruments(), function (payInstrument) {
        if (payInstrument.paymentMethod !== Resource.msg('payment.method.id', 'mercadoPagoPreferences', null)) {
            return;
        }

        paymentMethodId = payInstrument.creditCardType;
        token = payInstrument.creditCardToken;
        docType = payInstrument.custom.customerDocType;
        docNumber = payInstrument.custom.customerDocNumber;
    });

    if (!token) {
        paymentPayer.first_name = order.billingAddress.firstName;
        paymentPayer.last_name  = order.billingAddress.lastName;

        if (docType && docNumber) {
            paymentPayer.identification = {
                'type'   : docType,
                'number' : docNumber,
            };
        }
    }

    var payDataObj = {};

    var notificationUrl = dw.web.URLUtils.https("MercadoPago-MercadoPagoPaymentNotification", "token", order.orderToken).toString();

    //Add entity type just when request is for bank transfer
    if (paymentMethodId == "pse") {
        var server = require("server");
        var mercadoPagoForm = server.forms.getForm('billing').mercadoPagoCreditCard;
        var financialInstitutionID = mercadoPagoForm.pseBankID.value;
        var isUserRegistered = customer.registered;
        var callbackUrl = URLUtils.https('MercadoPago-PSEReturnURL', 'ID', order.orderNo, 'token', order.orderToken).toString();
        payDataObj = {
            description: Resource.msg('pagamento.pse', 'mercadoPago', null),
            payer: {
                email: paymentPayer.email,
                identification: paymentPayer.identification,
                entity_type: "individual"
            },
            additional_info: {
                ip_address: request.httpHeaders['x-is-remote_addr']
            },
            payment_method_id: paymentMethodId, // Required
            transaction_amount: order.getTotalGrossPrice().getValue(),
            callback_url: callbackUrl,
            transaction_details: {
                financial_institution: Number(financialInstitutionID)
            },
            external_reference: order.orderNo,
            notification_url: notificationUrl
        }
    } else if (paymentMethodId === "webpay") {
        var server           = require("server");
        var profileForm      = server.forms.getForm("profile");
        var isUserRegistered = customer.registered;

        var rut = isUserRegistered ?
            customer.profile.custom.difarmaRunRutNit :
            profileForm.customer.cedula.value;

        var callbackUrl = dw.web.URLUtils.https('MercadoPago-ReturnURLWebpay', 'orderID', order.orderNo, 'orderToken', order.orderToken).toString();

        payDataObj = {
            callback_url       : callbackUrl,
            payment_method_id  : "webpay",
            external_reference : order.orderNo,
            transaction_amount : order.getTotalGrossPrice().getValue(),
            payer: {
                email          : order.customerEmail,
                entity_type    : "individual",
                identification : {
                    type   : "RUT",
                    number : rut,
                }
            },
            transaction_details: {
                financial_institution: 1234
            },
            additional_info: {
                ip_address: request.httpHeaders['x-is-remote_addr']
            }
        };
    } else {
        payDataObj = {
            payer: paymentPayer,
            external_reference: order.orderNo,
            additional_info: {
                items: items,
                payer: payer,
                shipments: {
                    receiver_address: {
                        apartment: '-',
                        floor: '-',
                        street_name: order.defaultShipment.shippingAddress.address1 + '-' + order.defaultShipment.shippingAddress.city + '-' + order.defaultShipment.shippingAddress.countryCode,
                        street_number: '0',
                        zip_code: order.defaultShipment.shippingAddress.postalCode
                    }
                }
            },
            installments: 1,
            payment_method_id: paymentMethodId, // Required
            token: token, // Required only for credit card payments
            transaction_amount: order.getTotalGrossPrice().getValue(),
            notification_url: notificationUrl
        };

        // Set issuer id
        if (issuerId !== 0) {
            payDataObj.issuer_id = issuerId;
        }

        // Set installments if they are greater than 1
        if (installments !== 1) {
            payDataObj.installments = installments;
        }
    }

    if (dw.system.Site.current.getCustomPreferenceValue("mercadoPagoSendTaxes")) {
        payDataObj["net_amount"] = order.getTotalNetPrice().getValue();
        payDataObj["taxes"] = [{
            "value": order.getTotalTax().getValue(),
            "type": "IVA"
        }];
    }

    return payDataObj;
};

/**
 * @description Parse and returns the status of Order
 * @param {String} status
 * @returns {String} returnStatus classified status as string result
 */
MercadoPago.prototype.parseOrderStatus = function (status) {
    var pendingStatuses = {
        pending: Resource.msg('status.pending', 'mercadoPago', null),
        in_process: Resource.msg('status.in_process', 'mercadoPago', null),
        in_mediation: Resource.msg('status.in_mediation', 'mercadoPago', null),
        authorized: Resource.msg('status.authorized', 'mercadoPago', null)
    };
    var approvedStatuses = {
        approved: Resource.msg('status.approved', 'mercadoPago', null)
    };
    var rejectedStatuses = {
        rejected: Resource.msg('status.rejected', 'mercadoPago', null),
        cancelled: Resource.msg('status.cancelled', 'mercadoPago', null)
    };

    var returnStatus = pendingStatuses[status] ? 'pending' : '';

    if (!returnStatus) {
        returnStatus = approvedStatuses[status] ? 'authorized' : '';
    }

    if (!returnStatus) {
        returnStatus = rejectedStatuses[status] ? 'declined' : '';
    }

    return returnStatus;
};

/**
 * @description Get stored cards on Mercadopago side with current authenticated customer
 * @param {Object} currentCustomer
 * @returns {Array} array of objects which holds customer cards data
 */
MercadoPago.prototype.getCustomerCards = function (currentCustomer) {
    if (!currentCustomer.raw.authenticated || !currentCustomer.raw.registered) {
        return null;
    }

    var customerSearch = this.searchCustomer({email: currentCustomer.profile.email});

    if (!customerSearch) {
        return null;
    }

    var foundCustomer = array.find(customerSearch.results, function (cust) {
        return cust.email == currentCustomer.profile.email;
    });

    if (!foundCustomer) {
        return null;
    }

    var custCards = this.getCustomerCard(foundCustomer.id);

    var responseArray = collections.map(custCards, function(responseItem) {
        return responseItem;
    });

    return responseArray;
};

/**
 * @description Deletes a customer card based its IDs
 * @param {String} customerID the customer ID for MP API
 * @param {String} cardID the card ID for MP API
 */
MercadoPago.prototype.deleteCustomerCard = function(customerID, cardID) {
    var accessToken = this.getAccessToken();

    if (!empty(accessToken)) {
        return this.__del('/v1/customers/' + customerID + '/cards/' + cardID + '?access_token=' + encodeURI(accessToken), 'application/json');
    }

    return null;
};

/**
 * Given a payment response, returns an object with data formated for the order load.
 * @param {Object} paymentResponse A payment authorization response.
 * @return {Object} An object with the data required for the order load to OMS.
 */
MercadoPago.prototype.prepareDataForOrderLoad = function (paymentResponse) {
    var result = {
        paymentType : paymentResponse.payment_type_id
    };

    var card = paymentResponse.card;
    if (!empty(card)) {
        result.expirationMonth = card.expiration_month || null;
        result.expirationYear  = card.expiration_year || null;
        result.name            = !empty(card.cardholder) ? card.cardholder.name : null;
        result.firstSixDigits  = card.first_six_digits || null;
        result.lastFourDigits  = card.last_four_digits || null;
        result.installmentQty  = paymentResponse.installments || 0;
    }

    return result;
};

module.exports = MercadoPago;
