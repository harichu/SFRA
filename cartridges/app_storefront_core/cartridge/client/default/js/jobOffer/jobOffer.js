"use strict";

var base = require("../contactUs/contactUs");
var validation = require("../components/clientSideValidation");
var login = require("../login/login");

module.exports = {
    subscribeContact: base.subscribeContact,
    handlePhonePrefix: login.handlePhonePrefix(),
    handleRutMask: login.handleRutMask(),

    switchCareer: function () {
        $("input[type=\"radio\"][name=\"career\"]").change(function () {
            var $inputfieldTellUs = $(this).closest("form").find(".contact-us-jobOffer-tellUs");
            if ($inputfieldTellUs.length) {
                if (this.value == "other") {
                    $inputfieldTellUs.removeClass("d-none");
                    $inputfieldTellUs.find("input").attr("disabled", false);
                } else {
                    $inputfieldTellUs.addClass("d-none");
                    $inputfieldTellUs.find("input").attr("disabled", true);
                }
            }
        });
    },

    toggleApplyForm: function () {
        $(document).on("click", ".open-job-modal-cta", function (e) {
            e.preventDefault();
            $.ajax({
                url: $(this).attr("href"),
                type: "get",
                success: function (data) {
                    $(document).find(".modal-job-offer").empty().html(data).modal("show");
                    validation.invalid();
                    login.handlePhonePrefix();
                    login.handleRutMask();
                }
            });
        });
    },

    scrollToSection: function () {
        $("a[href^='#']").on("click", function (event) {
            var target = $(this.getAttribute("href"));
            if (target.length) {
                event.preventDefault();
                $("html, body").stop().animate({
                    scrollTop: target.offset().top - 100
                }, 1000);
            }
        });
    }
};
