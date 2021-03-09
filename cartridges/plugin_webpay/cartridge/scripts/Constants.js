"use strict";

/**
 * Constants object to prevend spreading hardcoded Strings
 */
var constants = {
    debitCard  : "DEBIT_CARD",
    creditCard : "CREDIT_CARD",

    transbank  : {
        authorizationResult : {
            SUCCESS               : "SUCCESS",
            FAILURE               : "FAILURE",
            TIMEOUT               : "TIMEOUT",
            ABORTED_BY_USER       : "ABORTED_BY_USER",
            INTERNAL_WEBPAY_ERROR : "INTERNAL_WEBPAY_ERROR",
            AUTHENTICATION_FAILED : "AUTHENTICATION_FAILED"
        },

        method : {
            Normal : "NORMAL",
            Full   : "FULL"
        },

        paymentType : {
            DEBIT                                 : "DEBIT",
            CREDIT_NORMAL                         : "CREDIT_NORMAL",
            CREDIT_NO_INTEREST                    : "CREDIT_NO_INTEREST",
            CREDIT_TWO_INSTALLMENTS_NO_INTEREST   : "CREDIT_TWO_INSTALLMENTS_NO_INTEREST",
            CREDIT_THREE_INSTALLMENTS_NO_INTEREST : "CREDIT_THREE_INSTALLMENTS_NO_INTEREST",
            CREDIT_MULTIPLE_INSTALLMENTS          : "CREDIT_MULTIPLE_INSTALLMENTS"
        },

        responseCode : {
            APPROVED              : "APPROVED",
            DENIED                : "DENIED",
            SHOULD_RETRY          : "SHOULD_RETRY",
            GENERAL_ERROR         : "GENERAL_ERROR",
            TAX_ERROR             : "TAX_ERROR",
            EXCEEDS_MONTHLY_QUOTA : "EXCEEDS_MONTHLY_QUOTA",
            EXCEEDS_DAILY_QUOTA   : "EXCEEDS_DAILY_QUOTA",
            UNAUTHORIZED          : "UNAUTHORIZED"
        },

        operation : {
            normal : "TR_NORMAL_WS",
            full   : "TR_COMPLETA_WS"
        },

        resultCodes : {
            FAILED  : 0
        },

        keystoreType              : "jks",
        transbankKeystorePassword : "12345678"
    }
};

constants.transbank.tables = {
    paymentTypes : {
        "VD" : constants.transbank.paymentType.DEBIT,
        "VN" : constants.transbank.paymentType.CREDIT_NORMAL,
        "VC" : constants.transbank.paymentType.CREDIT_MULTIPLE_INSTALLMENTS,
        "SI" : constants.transbank.paymentType.CREDIT_THREE_INSTALLMENTS_NO_INTEREST,
        "S2" : constants.transbank.paymentType.CREDIT_TWO_INSTALLMENTS_NO_INTEREST
    },

    responseCodes : {
        "0"  : constants.transbank.responseCode.APPROVED,
        "-1" : constants.transbank.responseCode.DENIED,
        "-2" : constants.transbank.responseCode.SHOULD_RETRY,
        "-3" : constants.transbank.responseCode.GENERAL_ERROR,
        "-4" : constants.transbank.responseCode.TAX_ERROR,
        "-5" : constants.transbank.responseCode.EXCEEDS_MONTHLY_QUOTA,
        "-6" : constants.transbank.responseCode.EXCEEDS_DAILY_QUOTA
    },

    vci : {
        "TSY" : constants.transbank.authorizationResult.SUCCESS,
        "TSN" : constants.transbank.authorizationResult.FAILURE,
        "TO6" : constants.transbank.authorizationResult.TIMEOUT,
        "ABO" : constants.transbank.authorizationResult.ABORTED_BY_USER,
        "U3"  : constants.transbank.authorizationResult.INTERNAL_WEBPAY_ERROR
    }
};

module.exports = constants;
