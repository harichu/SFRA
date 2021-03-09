"use strict";

var formValidation = require("../components/formValidation");
var cleave = require("../components/cleave");

var publicKey = $("form.payment-form").data("mp-public-key");

function submitPaymentForm(url, formData) {
    $.ajax({
        url: url,
        type: "post",
        dataType: "json",
        data: formData,
        success: function (data) {
            $.spinner().stop();
            if (!data.success) {
                formValidation($("form.payment-form"), data);
                $("[name=save]").removeAttr("disabled");
            } else {
                window.location.href = data.redirectUrl;
            }
        },
        error: function (err) {
            $.spinner().stop();
            if (err.responseJSON.redirectUrl) {
                window.location.href = err.responseJSON.redirectUrl;
            }
        }
    });
}


/**
 * This function uses the MP response to render the FD valdiation of the add payment form
 * @param errorCode - The error code
 */
function errorResponse(errorCode) {
    var $form = $("form.payment-form");

    var fields = {
        cardHolder: {
            $el: $form.find("[data-checkout=cardholderName]"),
            errors : ["221", "316"]
        },
        cardNumber: {
            $el: $form.find("[data-checkout=cardNumber]"),
            errors : ["205", "E301"]
        },
        cardMonth: {
            $el: $form.find("[data-checkout=cardExpirationMonth]"),
            errors : ["208", "325"]
        },
        cardYear: {
            $el: $form.find("[data-checkout=cardExpirationYear"),
            errors : ["209", "326"]
        },
        securityCode: {
            $el: $form.find("[data-checkout=securityCode]"),
            errors : ["224", "E302", "E203"]
        }
    };

    var errorMessages = JSON.parse($("#mp-messages").val());
    var errorField;

    // Set error code message if found, otherwise set default error message
    var errorMessage = errorMessages[errorCode] ? errorMessages[errorCode] : errorMessages.default;

    Object.keys(fields).forEach(function (index) {
        var field = fields[index];
        if (field.errors && field.errors.indexOf(errorCode) !== -1) {
            errorField = field;
            return true;
        }
    });

    if (errorField) {
        errorField.$el.addClass("is-invalid");
        errorField.$el.next(".invalid-feedback").focus().show().text(errorMessage);
    } else {
        $(".error-message").removeClass("d-none");
        $(".error-message-text").text(errorMessage);
    }
}

function verifyRequiredFields() {
    var enable = true;
    $(".form-control[required]").each(function () {
        if ($(this).val() == "") {
            enable = false;
        }
    });
    if (enable) {
        $(".confirm-btn").removeAttr("disabled");
    }
    else {
        $(".confirm-btn").attr("disabled", true);
    }
}

module.exports = {
    initSDK: function () {
        if (window.Mercadopago) {
            window.Mercadopago.setPublishableKey(publicKey);
        }
    },

    removePayment: function () {
        $(".remove-payment").on("click", function (e) {
            e.preventDefault();
            var customerID = $(this).data("customer-id");
            var cardID = $(this).data("card-id");
            var baseUrl = $(this).data("url");
            var url     = baseUrl + "?customerID=" + customerID + "&cardID=" +  cardID;
            $(".payment-to-remove").empty().append($(this).data("card"));

            $(".delete-confirmation-btn").click(function (f) {
                f.preventDefault();
                $(".remove-payment").trigger("payment:remove", f);

                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({
                    event : "confirmRemove",
                    label : "CreditCard"
                });

                if (!$("#is-mercado-pago-enabled").is(":checked")) {
                    url = baseUrl + "?&UUID=" + cardID;
                }

                $.ajax({
                    url: url,
                    type: "get",
                    dataType: "json",
                    success: function (data) {
                        $("#card-id-" + data.cardID).remove();
                        if ($(".payment-item").length == 0) {
                            $("#empty-cards").removeClass("d-none");
                        }
                    },
                    error: function (err) {
                        if (err.responseJSON.redirectUrl) {
                            window.location.href = err.responseJSON.redirectUrl;
                        }
                        $.spinner().stop();
                    }
                });
            });
        });
    },

    submitPayment: function () {
        $("form.payment-form").submit(function (e) {
            var $form = $(this);
            e.preventDefault();
            $("[name=save]").attr("disabled", "disabled");
            var url = $form.attr("action");

            var formData = cleave.serializeData($form);
            window.Mercadopago.clearSession();

            $form.spinner().start();

            window.Mercadopago.createToken($form, function (status, response) {
                if (status === 200 || status === 201) {
                    $("#cardToken").attr("value", response.id);
                    formData = cleave.serializeData($form);
                    submitPaymentForm(url, formData);
                } else if (response.cause) {
                    $("[name=save]").removeAttr("disabled");
                    $form.find(".invalid-feedback").html("");
                    response.cause.forEach(function (cause) {
                        errorResponse(cause.code);
                        $form.spinner().stop();
                    });
                }
            });

            return false;
        });
    },

    handleCreditCardNumber: function () {
        if ($("#cardNumber").length) {
            cleave.handleCreditCardNumber("#cardNumber");
        }
    },

    handleCVV: function () {
        if ($("#securityCode").length) {
            cleave.handleCVV("#securityCode");
        }
    },

    validationRequired: function () {
        verifyRequiredFields();
        $(document).on("input", ".form-control", function () {
            verifyRequiredFields();
        });
    }
};
