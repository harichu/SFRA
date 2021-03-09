"use strict";

var clientSideValidation = require("../components/clientSideValidation");
var isLoyaltyEnabled     = $("#is-loyalty-enabled").is(":checked");
var $body = $("body");

function startLoader() {
    var $inputField = $(".rut-inputfield").parent();
    var html = "<div class='lds-ring'><div></div><div></div><div></div><div></div></div>";
    $inputField.append(html);
}

function stopLoader() {
    $(".lds-ring").remove();
}

module.exports = {
    init: function () {
        var $memberText = $(".is-member-text");
        var $clubTerms = $(".js-registration-club-conditions");

        $body.on("focusin", ".rut-inputfield", function () {
            $memberText.addClass("d-none");
            $(this).removeClass("is-invalid");
        });

        $body.on("change", "#registration-document", function () {
            var docType = $(this).find("option:selected").data("doc-type");
            $("#registration-identification-number").data("type", docType);
        });

        $body.on("focusout", ".js-doc-validation", function () {
            if (isLoyaltyEnabled) {
                var url       = $("#validate-document-url").val();
                var $this     = $(this);
                var docNumber = $this.val();
                var docType   = $this.data("type");

                if (clientSideValidation.functions.validateDocument(docNumber, docType)) {
                    startLoader();
                    $.ajax({
                        url      : url,
                        method   : "GET",
                        dataType : "json",
                        data     : {
                            docNumber : docNumber
                        },
                        success  : function (data) {
                            setTimeout(function () {
                                stopLoader();
                            }, 300);

                            if (data.isLoyaltyCustomer) {
                                $memberText.removeClass("d-none");
                                $clubTerms.removeClass("d-inline").addClass("d-none");
                            } else {
                                $memberText.addClass("d-none");
                                $clubTerms.removeClass("d-none").addClass("d-inline");
                            }
                        }
                    });
                } else {
                    clientSideValidation.functions.invalidateField($this);
                }
            }
        });
    }
};
