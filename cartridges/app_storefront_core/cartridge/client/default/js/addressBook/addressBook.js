"use strict";

var formValidation = require("../components/formValidation");
var generalUtils   = require("jsfarmacias/generalUtils");

var url;
var isDefault;
var $body = $("body");
var isZoneCityMappingEnabled = $("#is-zone-city-zone-mapping-enabled").is(":checked");

/**
 * Create an alert to display the error message
 * @param {Object} message - Error message to display
 */
function createErrorNotification(message) {
    var errorHtml = "<div class=\"alert alert-danger alert-dismissible valid-cart-error " +
        "fade show\" role=\"alert\">" +
        "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
        "<span aria-hidden=\"true\">&times;</span>" +
        "</button>" + message + "</div>";

    $(".error-messaging").append(errorHtml);
}

/**
 * create option for the Municipios select
 * @param {String} departamento - departamento from municipios
 */
function setMunicipios(departamento) {
    var $city = $("#city");

    if ($city.length) {
        var municipios         = JSON.parse($city.attr("data-municipios"));
        var selectedMunicipios = municipios[departamento];
        var cityValue          = $city.attr("value");
        var item               = null;
        var selected           = null;

        $city.find("option").not(":first").remove();

        if (isZoneCityMappingEnabled) {
            for (item in selectedMunicipios) {
                if (Object.prototype.hasOwnProperty.call(selectedMunicipios, item)) {
                    selected = (cityValue != "" && cityValue == item) ? "selected" : "";
                    $city.append("<option value='" + item + "' " + selected + ">" + item + "</option>");
                }
            }
        } else {
            for (item in selectedMunicipios) {
                if (Object.prototype.hasOwnProperty.call(selectedMunicipios, item)) {
                    selected = (cityValue != "" && cityValue == selectedMunicipios[item]) ? "selected" : "";
                    $city.append("<option value='" + selectedMunicipios[item] + "' " + selected + ">" + selectedMunicipios[item] + "</option>");
                }
            }
        }
    }

    generalUtils.sortOptionsAlphabetically($city);
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

    init: function () {
        var $addressListContainer = $(".address-list-container");
        var $nameSortIcon         = $(".addressbook-header .address-name .sort-icon");

        $body.on("click", ".addressbook-header .address-name .sort-icon", function () {
            $.ajax({
                url      : $(this).data("url"),
                type     : "get",
                dataType : "json",
                success  : function (data) {
                    $nameSortIcon.data("url", data.updatedURL);
                    $addressListContainer.html(data.addresListTemplate);
                }
            });
        });
    },

    removeAddress: function () {
        $(".remove-address").on("click", function (e) {
            e.preventDefault();
            isDefault = $(this).data("default");
            if (isDefault) {
                url = $(this).data("url")
                    + "?addressId="
                    + $(this).data("id")
                    + "&isDefault="
                    + isDefault;
            } else {
                url = $(this).data("url") + "?addressId=" + $(this).data("id");
            }
            $(".product-to-remove").empty().append($(this).data("id"));
        });
    },

    removeAddressConfirmation: function () {
        $(".delete-confirmation-btn").click(function (e) {
            e.preventDefault();

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event : "confirmRemove",
                label : "Address"
            });
            

            $.ajax({
                url: url,
                type: "get",
                dataType: "json",
                success: function (data) {
                    $("#uuid-" + data.UUID).remove();
                    if ($(".address-item").length == 0) {
                        $("<div class='card addressbook-row'><span class='no-addresses'>"+data.message+"</span></div>").insertAfter(".addressbook-header");
                    }
                },
                error: function (err) {
                    if (err.responseJSON.redirectUrl) {
                        window.location.href = err.responseJSON.redirectUrl;
                    } else {
                        createErrorNotification(err.responseJSON.errorMessage);
                    }
                    $.spinner().stop();
                }
            });
        });
    },

    submitAddress: function () {
        $("form.address-form").submit(function (e) {
            var $form = $(this);
            e.preventDefault();
            url = $form.attr("action");
            $form.spinner().start();
            $("form.address-form").trigger("address:submit", e);
            $.ajax({
                url: url,
                type: "post",
                dataType: "json",
                data: $form.serialize(),
                success: function (data) {
                    $form.spinner().stop();
                    if (!data.success) {
                        formValidation($form, data);
                    } else {
                        location.href = data.redirectUrl;
                    }
                },
                error: function (err) {
                    if (err.responseJSON.redirectUrl) {
                        window.location.href = err.responseJSON.redirectUrl;
                    }
                    $form.spinner().stop();
                }
            });
            return false;
        });
    },

    loadDepartamentosMunicipios: function () {
        setMunicipios($("#state").val());

        $(document).on("change", "#state", function () {
            setMunicipios($(this).val());
        });
    },

    validationRequired: function () {
        verifyRequiredFields();
        $(document).on("input", ".form-control", function () {
            verifyRequiredFields();
        });
    }
};
