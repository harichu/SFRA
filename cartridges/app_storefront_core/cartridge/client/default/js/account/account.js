"use strict";

var login = require("../login/login");
var formValidation = require("../components/formValidation");

function validateFields($form) {
    $.ajax({
        url: $form.data("validation-url"),
        type: "post",
        dataType: "json",
        data: $form.serialize(),
        success: function (response) {
            formValidation($form, response);
        }
    });
}

var exports = {
    initialize: function () {
        if ($("#modal-facebook").length > 0) {
            $("#modal-facebook").removeClass("d-sm-none");
            $("#modal-facebook").modal({
                backdrop: "static",
                keyboard: false
            });
        }

        login.handlePhonePrefix();

        login.handleRutMask();

        $(document).on("submit", "#facebook-registration", function (e) {
            e.preventDefault();
            var $form = $(this);
            var url = $form.attr("action");
            var names = $form.find("#registration-form-fname").val().split(" ");
            var formData = {
                firstName : names[0],
                lastName  : $form.find("#registration-form-fname").val().replace(names[0], ""),
                email     : $form.find("#registration-form-email").val(),
                phone     : $form.find("#registration-form-phone").val(),
                document  : $form.find("#registration-document").val(),
                rut       : $form.find("#registration-form-rut").val(),
                cedula    : $form.find("#registration-identification-number").val()
            };
            $.ajax({
                url: url,
                method: "POST",
                data: formData,
                success: function (data) {
                    if (!data.success) {
                        if (!data.fields) {
                            window.location.reload();
                        } else {
                            formValidation($form, data);
                        }
                    } else {
                        $("#modal-facebook").modal("hide");
                        window.location.reload();
                    }
                },
                error: function (err) {
                    console.log(err);
                }
            });
        });
    },

    validate: function () {
        $("form#facebook-registration:not(.form-control)").submit(function () {
            var $form = $(this);
            validateFields($form);
        });
    }
};

module.exports = exports;
