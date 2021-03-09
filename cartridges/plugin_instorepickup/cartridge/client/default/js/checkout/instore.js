"use strict";

var storeLocator = require("jsfarmacias/storeLocator/storeLocator");
var generalUtils = require("jsfarmacias/generalUtils");

var isZoneCityMappingEnabled = $("#is-zone-city-zone-mapping-enabled").is(":checked");

window.difarmaStorePickup = {
    state       : null,
    city        : null,
    geolocation : {
        lat : null,
        lng : null
    }
};

function setMunicipios(departamento) {
    var $citySelect        = $("#store-municipios");
    var municipios         = JSON.parse($citySelect.attr("data-municipios"));
    var selectedMunicipios = municipios[departamento];
    var item               = null;

    if (selectedMunicipios) {
        $citySelect.html("");

        if (isZoneCityMappingEnabled) {
            for (item in selectedMunicipios) {
                if (Object.prototype.hasOwnProperty.call(selectedMunicipios, item)) {
                    $citySelect.append("<option value='"+ item +"'>"+ item +"</option>");
                }
            }
        } else {
            for (item in selectedMunicipios) {
                if (Object.prototype.hasOwnProperty.call(selectedMunicipios, item)) {
                    $citySelect.append("<option value='" + selectedMunicipios[item] + "'>" + selectedMunicipios[item] + "</option>");
                }
            }
        }
    }

    generalUtils.sortOptionsAlphabetically($citySelect);
}

/**
 * Populate store finder html
 * @param {Object} target - Dom element that needs to be populated with store finder
 */
function loadStoreLocator(target) {
    $.ajax({
        url: target.data("url"),
        method: "GET",
        success: function (response) {
            target.html(response.storesResultsHtml);
            storeLocator.search();
            storeLocator.changeRadius();
            storeLocator.selectStore();
            storeLocator.updateSelectStoreButton();
            storeLocator.initDayNightRadioListener();

            setMunicipios($("#store-departamentos").val());

            var selectedType = $("input[name='selectType']:checked").val();
            if (selectedType === "choose") {
                var $selectedLocationText = $(".selected-location-text");
                $selectedLocationText.find(".selected-location-municipio").text(window.difarmaStorePickup.city);
                $selectedLocationText.find(".selected-location-departamento").text(window.difarmaStorePickup.state);
            } else {
                // Trigger storelocator search when loading the section if detect is the selected option
                storeLocator.updateCustomerLocationByZone($("#zoneSelectedMunicipio").val(), $("#zoneSelectedDepartamento").val());
            }
        }
    });
}

/**
 * Show store locator when appropriate shipping method is selected
 * @param {Object} shippingForm - DOM element that contains current shipping form
 */
function showStoreFinder(shippingForm) {
    // hide address panel
    shippingForm.find(".home-delivery-block").addClass("d-none");

    shippingForm.find(".gift-message-block").addClass("d-none");
    shippingForm.find(".gift").prop("checked", false);
    shippingForm.find(".gift-message").addClass("d-none");

    shippingForm.find(".pickup-in-store").empty().removeClass("d-none").addClass("d-flex");

    loadStoreLocator(shippingForm.find(".pickup-in-store"));

    $(document).find(".home-delivery-title").removeClass("active");
    $(document).find(".pickup-in-store-title").addClass("active");
}

module.exports = {
    watchForInStoreShipping: function () {
        $(document).on("body:loadStorelocator", function () {
            loadStoreLocator($(".pickup-in-store"));
        });

        if ($(".pickup-in-store-title").hasClass("active")) {
            loadStoreLocator($(".pickup-in-store"));
        }

        $(document).on("change", "#store-departamentos", function () {
            setMunicipios($(this).val());
        });
    },
    watchForStoreSelection: function () {
        $("body").on("store:selected", function (e, data) {
            var $pickupInStorePanel         = $(data.event.target).parents(".pickup-in-store");
            var $afterStoreSelectionSection = $(".after-store-selection");
            var $card = $pickupInStorePanel.parents(".card");
            if ($(window).scrollTop() > $card.offset().top) {
                $("html, body").animate({
                    scrollTop: $card.offset().top
                }, 200);
            }
            var newLabel = $(data.storeDetailsHtml);
            var content = $("<div class=\"selectedStore radius-small\"></div>").append(newLabel)
                .append("<input type=\"hidden\" name=\"storeId\" value=\"" + data.storeID + "\" />");

            $pickupInStorePanel.removeClass("d-flex");
            $pickupInStorePanel.addClass("d-none");
            $afterStoreSelectionSection.empty().append(content);
            $(".change-store").removeClass("d-none");
            $(".pickup-in-store-block").attr("data-pickup-option", "results");
        });
    },
    updateAddressLabelText: function () {
        $("body").on("shipping:updateAddressLabelText", function (e, data) {
            var addressLabelText = data.selectedShippingMethod.storePickupEnabled ? data.resources.storeAddress : data.resources.shippingAddress;
            data.shippingAddressLabel.text(addressLabelText);
        });
    },
    changeStore: function () {
        $("body").on("click", ".change-store", (function (e) {
            e.preventDefault();
            showStoreFinder($(this).closest("form"));
            $(this).addClass("d-none");
            $("body").trigger("checkout:disableButton", ".next-step-button button");
            // Deselect familiar option when returning to previous step
            if ($(".selection-type-stores-radios input:checked").length) {
                $(".selection-type-stores-radios input:checked").prop("checked", false).parents(".custom-control").removeClass("active");
            }

            if ($(".selection-type-stores input:checked").val() == "choose") {
                $(this).parents(".pickup-in-store-block").attr("data-pickup-option", "select");
            } else {
                $(this).parents(".pickup-in-store-block").attr("data-pickup-option", "detect");
                $(".btn-storelocator-search").trigger("click");
            }
        }));
    },
    hideMultiShipStoreFinder: function () {
        $("body").on("instore:hideMultiShipStoreFinder", function (e, data) {
            data.form.find(".home-delivery-block").removeClass("d-none");
            $(document).find(".home-delivery-title").addClass("active");
            $(document).find(".pickup-in-store-title").removeClass("active");

            if (!data.customer.registeredUser) {
                data.form.attr("data-address-mode", "new");
            } else {
                data.form.attr("data-address-mode", "edit");
            }
        });
    },
    hideSingleShipStoreFinder: function () {
        $("body").on("instore:hideSingleShipStoreFinder", function (e, data) {
            data.form.find(".home-delivery-block").removeClass("d-none");
        });
    },
    actionEditMultiShip: function () {
        $("body").on("shipping:editMultiShipAddress", function (e, data) {
            var shippingForm = data.form;
            var pickupSelected = shippingForm.find(":checked", ".shipping-method-list").data("pickup");
            if (pickupSelected) {
                showStoreFinder(shippingForm);
            }
        });
    }
};
