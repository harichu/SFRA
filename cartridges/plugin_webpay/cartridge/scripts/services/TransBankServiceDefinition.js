"use strict";

/**
 * @module TransBankServiceDefinition
 */

// API Includes
var HashMap  = require("dw/util/HashMap");
var URLUtils = require("dw/web/URLUtils");
var WSUtil   = require("dw/ws/WSUtil");

var preferences      = require("dw/system/Site").getCurrent().getPreferences();
var plusCommerceCode = preferences.custom.tbkTransbankCode;
var fullCommerceCode = preferences.custom.tbkTransbankFullCode;
var Constants        = require("~/cartridge/scripts/Constants");

/**
 * Set the security level of the request.
 * @param {Object} port It's the serviceClient of the request.
 * @param {String} commerceCode commerceCode necessary for full or plus transactions 
 */
function setSecurity(port, commerceCode) {
    var secretsMap = new HashMap();

    secretsMap.put("request", Constants.transbank.transbankKeystorePassword);

    var requestCfg = new dw.util.HashMap();

    // define the ws actions to be performed - in this case add a username token, timestamp,
    // sign and encrypt the message
    requestCfg.put(WSUtil.WS_ACTION, WSUtil.WS_SIGNATURE);

    // define signature properties
    // the keystore file has the basename of the WSDL file and the
    // file extension based on the keystore type (e.g. HelloWorld.pkcs12).
    // The keystore file has to be placed beside the WSDL file.
    requestCfg.put(WSUtil.WS_SIG_PROP_KEYSTORE_TYPE, Constants.transbank.keystoreType);
    requestCfg.put(WSUtil.WS_SIG_PROP_KEYSTORE_PW, Constants.transbank.transbankKeystorePassword);
    requestCfg.put(WSUtil.WS_SIG_PROP_KEYSTORE_ALIAS, commerceCode);

    requestCfg.put(WSUtil.WS_SIGNATURE_USER, commerceCode);
    requestCfg.put(WSUtil.WS_SIG_KEY_ID, WSUtil.KEY_ID_TYPE_ISSUE_SERIAL);

    // set the secrets for the callback
    requestCfg.put(WSUtil.WS_SECRETS_MAP, secretsMap);

    var responseCfg = new HashMap();

    // define the ws actions to be performed for the response
    responseCfg.put(WSUtil.WS_ACTION, WSUtil.WS_SIGNATURE);

    // define signature properties
    responseCfg.put(WSUtil.WS_SIG_PROP_KEYSTORE_TYPE, Constants.transbank.keystoreType);
    responseCfg.put(WSUtil.WS_SIG_PROP_KEYSTORE_PW, Constants.transbank.transbankKeystorePassword);
    responseCfg.put(WSUtil.WS_SIG_PROP_KEYSTORE_ALIAS, commerceCode + "tbk");

    responseCfg.put(WSUtil.WS_SIGNATURE_USER, commerceCode + "tbk");
    responseCfg.put(WSUtil.WS_SIG_KEY_ID, WSUtil.KEY_ID_TYPE_ISSUE_SERIAL);

    // set the security
    WSUtil.setWSSecurityConfig(port, requestCfg, responseCfg);
}

var plus = {
    initTransaction : {
        initServiceClient: function () {
            /* eslint-disable */
            var webreferenceLocal = webreferences2.WSWebpayService;
            this.webreference     = webreferenceLocal;
            return webreferenceLocal.getDefaultService();
        },

        execute: function(svc, requestObject) {
            return svc.serviceClient.initTransaction(requestObject);
        },

        createRequest: function(service, params) {
            setSecurity(service.getServiceClient(), plusCommerceCode);
            var initTransactionInput = new this.webreference.WsInitTransactionInput();

            initTransactionInput.setWSTransactionType(this.webreference.WsTransactionType["TR_NORMAL_WS"]);
            initTransactionInput.setSessionId(session.sessionID);

            initTransactionInput.setReturnURL(params.returnURL);
            initTransactionInput.setFinalURL(params.finalURL);

            var transactionalDetails = new this.webreference.WsTransactionDetail();
            transactionalDetails.setAmount(params.amount);
            transactionalDetails.setBuyOrder(params.orderNumber);
            transactionalDetails.setCommerceCode(params.commerceCode);
            initTransactionInput.transactionDetails.add(transactionalDetails);

            return initTransactionInput;
        },

        parseResponse: function(service, response) {
            return response;
        },

        mockFull: function(service, params) {
            return {
                token : "fake_token",
                url   : params.returnURL
            };
        }
    },
    getTransactionResult : {
        initServiceClient : function() {
            /* eslint-disable */
            var webreferenceLocal = webreferences2.WSWebpayService;
            this.webreference     = webreferenceLocal;
            return webreferenceLocal.getDefaultService();
        },

        createRequest : function(service, params) {
            setSecurity(service.getServiceClient(), plusCommerceCode);
            return params;
        },

        execute : function(service, req) {
            return service.serviceClient.getTransactionResult(req.token);
        },

        parseResponse : function(service, response) {
            return response;
        },

        mockFull : function() {
            return {
                buyOrder        : '13421533332156661',
                sessionId       : session.sessionID,
                accountDate     : '01/16',
                transactionDate : '01/16/20:43',
                VCI             : 'TSY',
                urlRedirection  : URLUtils.https('Product-Show').toString(),
                cardDetails : {
                    cardNumber  : '4111111111111111',
                    cardExpirationDate : '29/11',
                    detailsOuput : {
                        Amount            : Number(99),
                        authorizationCode : 'APPROVED',
                        buyOrder          : '13421533332156661',
                        commerceCode      : '597044444414',
                        paymentTypeCode   : 'VD',
                        responseCode      : '0',
                        sharesNumber      : 1
                    }
                }
            };
        }
    },

    acknowledgeTransaction : {
        initServiceClient  : function() {
            /* eslint-disable */
            var webreferenceLocal = webreferences2.WSWebpayService;
            this.webreference     = webreferenceLocal;
            return webreferenceLocal.getDefaultService();
        },

        createRequest : function(service, params) {
            setSecurity(service.getServiceClient(), plusCommerceCode);
            return params;
        },

        execute : function(service, request) {
            return service.getServiceClient().acknowledgeTransaction(request.token);
        },

        parseResponse : function(service, response) {
            return response;
        },

        mockFull : function(service, params) {
            return params;
        }
    }
};

var full = {
    initCompleteTransaction : {
        initServiceClient: function() {
            /* eslint-disable */
            var webreferenceLocal = webreferences2.WSCompleteWebpayService;
            this.webreference     = webreferenceLocal;
            return webreferenceLocal.getDefaultService();
        },

        execute: function(svc, requestObject) {
            return svc.serviceClient.initCompleteTransaction(requestObject);
        },

        createRequest: function(service, params) {
            setSecurity(service.getServiceClient(), fullCommerceCode);
            var initTransactionInput = new this.webreference.WsCompleteInitTransactionInput();

            initTransactionInput.setTransactionType(this.webreference.WsCompleteTransactionType["TR_COMPLETA_WS"]);
            initTransactionInput.setSessionId(session.sessionID);
            initTransactionInput.setBuyOrder(params.orderNo);

            var transactionalDetails = new this.webreference.WsTransactionDetail();
            transactionalDetails.setAmount(params.amount);
            transactionalDetails.setBuyOrder(params.orderNo);
            transactionalDetails.setCommerceCode(params.commerceCode);

            var cardDetails = new this.webreference.CompleteCardDetail();
            cardDetails.setCardExpirationDate(params.cardDetail.cardExpirationDate);
            cardDetails.setCardNumber(params.cardDetail.cardNumber);
            cardDetails.setCvv(params.cardDetail.cvv);

            initTransactionInput.transactionDetails.add(transactionalDetails);
            initTransactionInput.setCardDetail(cardDetails);
            return initTransactionInput;
        },


        parseResponse: function(service, response) {
            return response;
        },

        mockFull: function(service, params) {
            return {
                token : 'fake_token',
                url   : params.returnURL
            };
        }
    },
    queryShare : {
        initServiceClient : function() {
            /* eslint-disable */
            var webreferenceLocal = webreferences2.WSCompleteWebpayService;
            this.webreference     = webreferenceLocal;
            return webreferenceLocal.getDefaultService();
        },

        createRequest : function(service, params) {
            setSecurity(service.getServiceClient(), fullCommerceCode);
            return params;
        },

        execute : function(service, req) {
            var serviceClient = service.getServiceClient();
            var sharesNumber  = req.shareNumber ? req.shareNumber : 1;
            return serviceClient.queryShare(req.token, req.orderNo, sharesNumber);
        },

        parseResponse : function(service, response) {
            return response;
        },

        mockFull : function() {
            return {
                accountDate     : '01/16',
                buyOrder        : '13421533332156661',
                cardDetails     : {
                    cardNumber         : '4111111111111111',
                    cardExpirationDate : '29/11',
                    detailsOuput       : {
                        Amount            : Number(99),
                        authorizationCode : 'APPROVED',
                        buyOrder          : '13421533332156661',
                        commerceCode      : '597044444414',
                        paymentTypeCode   : 'VD',
                        responseCode      : '0',
                        sharesNumber      : 1,
                    }
                },
                sessionId       : session.sessionID,
                transactionDate : '01/16/20:43',
                urlRedirection  : URLUtils.https('Product-Show').toString(),
                VCI             : 'TSY'
            };
        }
    },

    authorize : {
        initServiceClient : function() {
            /* eslint-disable */
            var webreferenceLocal = webreferences2.WSCompleteWebpayService;
            this.webreference     = webreferenceLocal;
            return webreferenceLocal.getDefaultService();
        },

        createRequest : function(service, params) {
            setSecurity(service.getServiceClient(), fullCommerceCode);
            var wsCompletePaymentTypeInput = new this.webreference.WsCompletePaymentTypeInput();
            wsCompletePaymentTypeInput.setCommerceCode(params.commerceCode);
            wsCompletePaymentTypeInput.setBuyOrder(params.orderNo);
            wsCompletePaymentTypeInput.setQueryShareInput(params.queryShareInput || null);
            return {
                paymentList : wsCompletePaymentTypeInput,
                token       : params.token
            };
        },

        execute : function(service, request) {
            return service.getServiceClient().authorize(request.token, [request.paymentList]);
        },

        parseResponse : function(service, response) {
            return response;
        },

        mockFull : function(service, params) {
            return params;
        }
    },

    acknowledgeCompleteTransaction : {
        initServiceClient : function() {
            /* eslint-disable */
            var webreferenceLocal = webreferences2.WSCompleteWebpayService;
            this.webreference     = webreferenceLocal;
            return webreferenceLocal.getDefaultService();

        },

        createRequest : function(service, params) {
            setSecurity(service.getServiceClient(), fullCommerceCode);
            return { token : params.token };
        },

        execute : function(service, request) {
            return service.getServiceClient().acknowledgeCompleteTransaction(request.token);
        },

        parseResponse : function(service, response) {
            return response;
        },

        mockFull : function(service, params) {
            return params;
        }
    }
};

module.exports = {
    full: full,
    plus: plus
};
