"use strict";

var Cleave = require("cleave.js").default;

module.exports = {
    handleCreditCardNumber: function (cardFieldSelector, cardTypeSelector) {
        var cleave = new Cleave(cardFieldSelector, {
            creditCard: true,
            onCreditCardTypeChanged: function (type) {
                var creditCardTypes = {
                    visa: "Visa",
                    mastercard: "Master Card",
                    amex: "Amex",
                    discover: "Discover",
                    unknown: "Unknown"
                };

                var cardType = creditCardTypes[Object.keys(creditCardTypes).indexOf(type) > -1
                    ? type
                    : "unknown"];
                $(cardTypeSelector).val(cardType);
                $(".card-number-wrapper").attr("data-type", type);

                if (type == "mastercard") {
                    type = "master";
                }

                $("#cardType-" + type).prop("checked", true).trigger("change");
                if (type === "visa" || type === "master" || type === "discover") {
                    $("#securityCode").attr("maxlength", 3);
                } else {
                    $("#securityCode").attr("maxlength", 4);
                }
            }
        });

        $(cardFieldSelector).data("cleave", cleave);
    },

    serializeData: function (form) {
        var serializedArray = form.serializeArray();
        return $.param(serializedArray);
    },

    handleCVV: function (cvvSelector) {
        var self = $(cvvSelector);

        new Cleave(self, {
            numeral: true,
            numeralPositiveOnly: true,
            numeralDecimalMark: "",
            delimiter: "",
            stripLeadingZeroes: false
        });
    }
};
