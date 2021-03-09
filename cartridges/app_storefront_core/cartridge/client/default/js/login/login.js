"use strict";

var formValidation = require("../components/formValidation");
var createErrorNotification = require("../components/errorNotification");

/**
 * Prevent removal of phone prefix
 */
function handlePhonePrefix() {
    $(document).on("keydown", ".phone-field", function () {
        var field = this;
        var prefix = $(this).data("prefix");
        setTimeout(function () {
            if ($(field).val().indexOf(prefix) !== 0) {
                $(field).val(prefix);
            }
        }, 1);
    });
}

/**
 * PHandle RUT Masking
 */
function handleRutMask() {
    var rutOptions =  {
        onKeyPress: function (rut) {
            var masks = ["0.000.000-ZZ", "00.000.000-Z"];
            var mask = (rut.length > 11) ? masks[1] : masks[0];

            $(".rut-inputfield").mask(mask, rutOptions);
        },
        translation: {
            "Z": {
                pattern: /[0-9kK]/g,
                optional: true
            }
        }
    };

    $(".rut-inputfield").mask("0.000.000-0Z", rutOptions);
}

module.exports = {
    handlePhonePrefix: handlePhonePrefix,
    handleRutMask: handleRutMask,

    login: function () {
        $("form.login").submit(function (e) {
            var form = $(this);
            e.preventDefault();
            var url = form.attr("action");
            form.spinner().start();
            $("form.login").trigger("login:submit", e);
            $.ajax({
                url: url,
                type: "post",
                dataType: "json",
                data: form.serialize(),
                success: function (data) {
                    form.spinner().stop();
                    if (!data.success) {
                        formValidation(form, data);
                        $("form.login").trigger("login:error", data);
                    } else {
                        $("form.login").trigger("login:success", data);
                        location.href = data.redirectUrl;
                    }
                },
                error: function (data) {
                    if (data.responseJSON.redirectUrl) {
                        window.location.href = data.responseJSON.redirectUrl;
                    } else {
                        $("form.login").trigger("login:error", data);
                        form.spinner().stop();
                    }
                }
            });
            return false;
        });
    },

    register: function () {
        // Only acrutts numbers for IE
        $("#datefield").on("keypress", function (event) {
            var charCode = (event.which) ? event.which : event.keyCode;
            if (charCode > 31 && (charCode < 47 || charCode > 57)) {
                event.preventDefault();
                return false;
            }
            return true;
        });

        handlePhonePrefix();

        handleRutMask();

        $("form.registration").submit(function (e) {
            var form = $(this);
            e.preventDefault();
            var url = form.attr("action");
            $.ajax({
                url: url,
                type: "post",
                dataType: "json",
                data: form.serialize(),
                success: function (data) {
                    if (!data.success) {
                        formValidation(form, data);
                    } else {
                        location.href = data.redirectUrl;
                    }
                },
                error: function (err) {
                    if (err.responseJSON.redirectUrl) {
                        window.location.href = err.responseJSON.redirectUrl;
                    } else {
                        createErrorNotification($(".error-messaging"), err.responseJSON.errorMessage);
                    }
                }
            });
            return false;
        });
    },

    resetPassword: function () {
        $(".reset-password-form").submit(function (e) {
            var form = $(this);
            e.preventDefault();
            var url = form.attr("action");
            form.spinner().start();
            $(".reset-password-form").trigger("login:register", e);
            $.ajax({
                url: url,
                type: "post",
                dataType: "json",
                data: form.serialize(),
                success: function (data) {
                    form.spinner().stop();
                    if (!data.success) {
                        formValidation(form, data);
                    } else {
                        $(".request-password-title").text(data.receivedMsgHeading);
                        $(".request-password-body").empty()
                            .append("<p>" + data.receivedMsgBody + "</p>");

                        var $fbBtnCtr  = $(".js-fb-recover-password-container");
                        var $submitBtn = $(".js-default-recover-password-button");

                        $fbBtnCtr.toggleClass("d-none", !data.isFacebookCustomer);
                        $submitBtn.toggleClass("d-none", data.isFacebookCustomer);

                        if (!data.mobile) {
                            $submitBtn.text(data.buttonText)
                                .attr("data-dismiss", "modal");
                        } else {
                            $(".send-email-btn").empty()
                                .html("<a href=\""
                                    + data.returnUrl
                                    + "\" class=\"btn btn-primary btn-block\">"
                                    + data.buttonText + "</a>"
                                );
                        }
                    }
                },
                error: function () {
                    form.spinner().stop();
                }
            });
            return false;
        });
    },

    clearResetForm: function () {
        $("#login .modal").on("hidden.bs.modal", function () {
            $("#reset-password-email").val("");
            $(".modal-dialog .form-control.is-invalid").removeClass("is-invalid");
        });
    },

    guest: function () {
        $(".checkout-as-guest").removeClass("pointer-events-none");
        $(document).on("click", ".checkout-as-guest", function (e) {
            e.preventDefault();
            if ($("#modal-guest").length > 0) {
                $("#modal-guest").removeClass("d-sm-none");
                $("#modal-guest").modal();
                $("body").addClass("overflow-hidden");
            }
        });

        $("#modal-guest").on("hidden.bs.modal", function () {
            $("body").removeClass("overflow-hidden");
        });

        $(document).on("submit", "#guest-registration", function (e) {
            e.preventDefault();
            var $form = $(this);
            $form.spinner().start();
            var url = $form.attr("action");
            var names = $form.find("#registration-form-fname").val().split(" ");
            var lastName = $form.find("#registration-form-fname").val().replace(names[0], "");
            if (lastName == " " || lastName == "") {
                lastName = names[0];
            }
            var formData = {
                firstName: names[0],
                lastName: lastName,
                email: $form.find("#registration-form-email").val(),
                phone: $form.find("#registration-form-phone").val(),
                rut: $form.find("#registration-form-rut").val(),
                document: $form.find("#registration-document").val(),
                cedula: $form.find("#registration-identification-number").val()
            };
            $.ajax({
                url: url,
                method: "POST",
                data: formData,
                success: function (data) {
                    if (!data.success) {
                        if (data && data.fields) {
                            formValidation($form, data);
                            $form.spinner().stop();
                        } else {
                            window.location.reload();
                        }
                    } else {
                        window.location.href = data.redirectURL;
                    }
                },
                error: function (err) {
                    console.log(err);
                    $form.spinner().stop();
                }
            });

        });
    }
};
