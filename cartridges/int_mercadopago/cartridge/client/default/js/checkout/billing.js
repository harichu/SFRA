"use strict";

var base = require("jsfarmacias/checkout/billing");

/**
 * @function updatePaymentInformation
 * @description Update payment details summary based on payment method
 * @param {Object} order - checkout model to use as basis of new truth
 */
base.methods.updatePaymentInformation = function (order) {
    // update payment details
    var $paymentSummary = $(".payment-details");
    var htmlToAppend = "";

    if (order.billing.payment && order.billing.payment.selectedPaymentInstruments
        && order.billing.payment.selectedPaymentInstruments.length > 0) {

        if (order.billing.payment.selectedPaymentInstruments[0].paymentMethod == "CREDIT_CARD") {
            htmlToAppend += "<span>" + order.resources.cardType + " "
                + order.billing.payment.selectedPaymentInstruments[0].type
                + "</span><div>"
                + order.billing.payment.selectedPaymentInstruments[0].maskedCreditCardNumber
                + "</div><div><span>"
                + order.resources.cardEnding + " "
                + order.billing.payment.selectedPaymentInstruments[0].expirationMonth
                + "/" + order.billing.payment.selectedPaymentInstruments[0].expirationYear
                + "</span></div>";
        } else if (order.billing.payment.selectedPaymentInstruments[0].paymentMethod == "MercadoPago") {
            var paymentMethods        = $("[data-mp-available-payment-methods]").data("mpAvailablePaymentMethods");
            var paymentInstrumentType = order.billing.payment.selectedPaymentInstruments[0].type;
            var paymentMethod         = paymentMethods.find(function (method, index) { return  paymentInstrumentType == method.id;});
            var paymentMethodName     = paymentMethod ? paymentMethod.name : paymentInstrumentType;

            htmlToAppend += "<span>"
                + order.billing.payment.selectedPaymentInstruments[0].paymentMethod  + " "
                + paymentMethodName
                + "</span>";
        }
    }

    $paymentSummary.empty().append(htmlToAppend);
};

/**
 * @function handlePaymentOptionChange
 * @description Handle payment option change
 */
base.methods.handlePaymentOptionChange = function () {
    var $activeTab          = $(this);
    var activeTabId         = $activeTab.attr("href");
    var $paymentInformation = $(".payment-information");
    var isNewPayment        = $(".user-payment-instruments").hasClass("checkout-hidden");

    $(".payment-options [role=tab]").each(function (i, tab) {
        let otherTab   = $(tab);
        let otherTabId = otherTab.attr("href");

        $(otherTabId).find("input, select").prop("disabled", otherTabId !== activeTabId);
    });

    if (activeTabId === "#credit-card-content") {
        // Restore
        $paymentInformation.data("is-new-payment", isNewPayment);
    } else {
        // Prevent rejection during payment submit
        $paymentInformation.data("is-new-payment", true);
    }
};

/**
 * @function useSameMailPhoneAsAddress
 * @description fill user information for payment data
 */
base.useSameMailPhoneAsAddress = function () {
    var fillSameFields = function () {
        $("[data-mp-phone]").val($("#phoneNumber").val());
        $("[data-mp-email]").val($("#email").val());
    };

    $("#useSameMailPhoneAsAddress").change(function (event) {
        $("[data-mail-phone-container]").toggleClass("checkout-hidden", this.checked);


        if (this.checked) {
            fillSameFields();
            $("#phoneNumber").on("change.usesame", fillSameFields);
            $("#email").on("change.usesame", fillSameFields);
        } else {
            $("[data-mp-phone]").val("");
            $("[data-mp-email]").val("");
            $("#phoneNumber").off("change.usesame");
            $("#email").off("change.usesame");
        }
    });
};

/**
 * @function changePaymentOption
 * @description Change payment option
 */
base.changePaymentOption = function () {
    $(".payment-options [role=tab]").on("click", base.methods.handlePaymentOptionChange); // By click
};

/**
 * @function initPaymentOption
 * @description Initiate payment option
 */
base.initPaymentOption = function () {
    // Initial
    $(".payment-options [role=tab].enabled").trigger("click");
    base.methods.handlePaymentOptionChange.call($(".payment-options [role=tab].active"));
};

module.exports = base;
