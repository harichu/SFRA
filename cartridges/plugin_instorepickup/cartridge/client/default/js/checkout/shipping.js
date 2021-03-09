"use strict";

var addressHelpers = require("jsfarmacias/checkout/address");
var base = require("jsfarmacias/checkout/shipping");
var baseFormHelpers = require("jsfarmacias/checkout/formErrors");

/**
 * updates the shipping address selector within shipping forms
 * @param {Object} productLineItem - the productLineItem model
 * @param {Object} shipping - the shipping (shipment model) model
 * @param {Object} order - the order model
 * @param {Object} customer - the customer model
 */
function updateShippingAddressSelector(productLineItem, shipping, order, customer) {
    var uuidEl = $("input[value=" + productLineItem.UUID + "]");
    var shippings = order.shipping;

    var form;
    var $shippingAddressSelector;
    var hasSelectedAddress = false;

    if (uuidEl && uuidEl.length > 0) {
        form = uuidEl[0].form;
        $shippingAddressSelector = $(".addressSelector", form);
    }

    if ($shippingAddressSelector && $shippingAddressSelector.length === 1) {
        $shippingAddressSelector.empty();
        // Add New Address option
        $shippingAddressSelector.append(addressHelpers.methods.optionValueForAddress(
            null,
            false,
            order));
        // Separator -
        $shippingAddressSelector.append(addressHelpers.methods.optionValueForAddress(
            order.resources.shippingAddresses, false, order, { className: "multi-shipping" }
        ));

        shippings.forEach(function (aShipping) {
            if (!aShipping.selectedShippingMethod || !aShipping.selectedShippingMethod.storePickupEnabled) {
                var isSelected = shipping.UUID === aShipping.UUID;
                hasSelectedAddress = hasSelectedAddress || isSelected;

                var addressOption = addressHelpers.methods.optionValueForAddress(
                    aShipping,
                    isSelected,
                    order,
                    { className: "multi-shipping" }
                );
                var newAddress = addressOption.html() === order.resources.addNewAddress;
                var matchingUUID = aShipping.UUID === shipping.UUID;
                if ((newAddress && matchingUUID) || (!newAddress && matchingUUID) || (!newAddress && !matchingUUID)) {
                    $shippingAddressSelector.append(addressOption);
                }
                if (newAddress && !matchingUUID) {
                    $(addressOption[0]).remove();
                }
            }
        });
        if (customer.addresses && customer.addresses.length > 0) {
            $shippingAddressSelector.append(addressHelpers.methods.optionValueForAddress(
                order.resources.accountAddresses, false, order));
            customer.addresses.forEach(function (address) {
                var isSelected = shipping.matchingAddressId === address.ID;
                $shippingAddressSelector.append(
                    addressHelpers.methods.optionValueForAddress({
                        UUID: "ab_" + address.ID,
                        shippingAddress: address
                    }, isSelected, order)
                );
            });
        }
    }

    if (!hasSelectedAddress) {
        // show
        $(form).addClass("hide-details");
    } else {
        $(form).removeClass("hide-details");
    }
}

/**
 * Update the shipping UI for a single shipping info (shipment model)
 * @param {Object} shipping - the shipping (shipment model) model
 * @param {Object} order - the order/basket model
 * @param {Object} customer - the customer model
 * @param {Object} [options] - options for updating PLI summary info
 * @param {Object} [options.keepOpen] - if true, prevent changing PLI view mode to 'view'
 */
function updateShippingInformation(shipping, order, customer, options) {
    // First copy over shipmentUUIDs from response, to each PLI form
    order.shipping.forEach(function (aShipping) {
        aShipping.productLineItems.items.forEach(function (productLineItem) {
            base.methods.updateProductLineItemShipmentUUIDs(productLineItem, aShipping);
        });
    });

    // Now update shipping information, based on those associations
    base.methods.updateShippingMethods(shipping);
    base.methods.updateShippingAddressFormValues(shipping);
    base.methods.updateShippingSummaryInformation(shipping, order);

    // And update the PLI-based summary information as well
    shipping.productLineItems.items.forEach(function (productLineItem) {
        updateShippingAddressSelector(productLineItem, shipping, order, customer);
        base.methods.updatePLIShippingSummaryInformation(productLineItem, shipping, order, options);
    });
}

/**
 * updates the shipping method radio buttons within shipping forms
 * @param {Object} shipping - the shipping (shipment model) model
 */
function updateShippingMethods(shipping) {
    var uuidEl = $("input[value=" + shipping.UUID + "]");
    var onlyPickupValid = true;

    shipping.applicableShippingMethods.forEach(function (method) {
        if (!method.storePickupEnabled) {
            onlyPickupValid = false;
        }
    });

    if (onlyPickupValid) {
        $(".restricted-address").removeClass("d-none");
        $(".home-delivery-methods").addClass("d-none");
        $(".non-restricted-address").addClass("d-none");
        $(".selection-shipday-radios").removeClass("d-flex").addClass("d-none");
    } else {
        $(".restricted-address").addClass("d-none");
        $(".home-delivery-methods").removeClass("d-none");
        $(".non-restricted-address").removeClass("d-none");
        $(".selection-shipday-radios").removeClass("d-none").addClass("d-flex");
    }

    if (uuidEl && uuidEl.length > 0) {
        $.each(uuidEl, function (shipmentIndex, el) {
            var form = el.form;
            if (!form) return;

            var $shippingMethodList = $(".shipping-method-list", form);

            if ($shippingMethodList && $shippingMethodList.length > 0) {
                $shippingMethodList.empty();

                var shippingMethods = shipping.applicableShippingMethods;
                var selected = shipping.selectedShippingMethod || {};
                var shippingMethodFormID = form.name + "_shippingAddress_shippingMethodID";
                var triggeredbyAddress = $(form).attr("data-address-mode") !== "saved" && $(form).attr("data-address-mode") !== "saved-new";

                var $todayRadioOption    = $("[name='shipday'][value='today']");
                var $tomorrowRadioOption = $("[name='shipday'][value='tomorrow']");

                if (triggeredbyAddress) {
                    if (selected.storePickupEnabled) {
                        $(".checkout-summary").attr("data-summary-mode", "address-pickup");
                    } else {
                        $(".checkout-summary").attr("data-summary-mode", "address");
                    }
                    $("body").trigger("checkout:disableButton", ".next-step-button .submit-shipping");
                } else {
                    $(".checkout-summary").attr("data-summary-mode", "shipping");

                    if (!selected.storePickupEnabled) {
                        var isPrescriptionUploadEnabled = $("#is-prescription-upload-enabled").is(":checked");
                        var result = base.methods.validateApplyAllCheckbox();
                        if (result.toApply.length == 0 || !isPrescriptionUploadEnabled) {
                            $("body").trigger("checkout:enableButton", ".next-step-button .submit-shipping");
                        } else {
                            $("body").trigger("checkout:disableButton", ".next-step-button .submit-shipping");
                        }
                    }
                }

                //
                // Create the new rows for each shipping method
                //
                $.each(shippingMethods, function (methodIndex, shippingMethod) {
                    var $shippingMethodsContainer = $(".home-delivery-methods");

                    var tmpl = $("#shipping-method-template").clone();
                    // set input
                    $("input", tmpl)
                        .prop("id", "shippingMethod-" + shippingMethod.ID + "-" + shipping.UUID)
                        .prop("name", shippingMethodFormID)
                        .prop("value", shippingMethod.ID)
                        .attr("data-pickup", shippingMethod.storePickupEnabled);

                    $(".shipping-method-option-container", tmpl).attr("data-is-today", !!shippingMethod.isToday);

                    // Add class to deactivate shipping method if it is not part of the available days
                    if ($shippingMethodsContainer.attr("data-available-days") == "today" && !shippingMethod.isToday || $shippingMethodsContainer.attr("data-available-days") == "tomorrow" && shippingMethod.isToday) {
                        $(".shipping-method-option-container", tmpl).addClass("inactive-home-shipping-method");
                    }

                    if (shippingMethod.storePickupEnabled) {
                        $("input", tmpl).parent(".custom-control").addClass("d-none inactive-home-shipping-method");
                    }

                    if (!triggeredbyAddress) {
                        $("input", tmpl).attr("checked", shippingMethod.ID === selected.ID);
                    }

                    $("label", tmpl)
                        .prop("for", "shippingMethod-" + shippingMethod.ID + "-" + shipping.UUID);
                    // set shipping method name
                    $(".display-name", tmpl).text(shippingMethod.displayName);

                    if (window.difarmaHomeDelivery && window.difarmaHomeDelivery.isInventoryCheckServiceEnabled && !shippingMethod.storePickupEnabled && !shippingMethod.isDespachoVolumetrico) {
                        var estimatedArrivalTime = shippingMethod.isToday ?
                            window.difarmaHomeDelivery.currentDayMessage :
                            window.difarmaHomeDelivery.nextDayMessage;

                        $(".arrival-time", tmpl)
                            .text(estimatedArrivalTime)
                            .show();
                    } else if (shippingMethod.estimatedArrivalTime) {
                        $(".arrival-time", tmpl)
                            .text("(" + shippingMethod.estimatedArrivalTime + ")")
                            .show();
                    }

                    // set shipping cost
                    $(".shipping-cost", tmpl).text(shippingMethod.shippingCost);

                    var shippingInputs = tmpl.find("input");

                    $.each(shippingInputs, function () {
                        var $checkboxContainer = $(this).parent(".custom-control");

                        if ($(this).attr("checked") == "checked") {
                            $checkboxContainer.addClass("active");
                        }

                        if ($todayRadioOption.prop("checked") && $checkboxContainer.data("isToday")) {
                            $checkboxContainer.show();
                        }

                        if ($tomorrowRadioOption.prop("checked") && !$checkboxContainer.data("isToday")) {
                            $checkboxContainer.show();
                        }
                    });

                    $shippingMethodList.append(tmpl.html());
                });

            }
        });
    }

    $("body").trigger("shipping:updateShippingMethods", { shipping: shipping });
}

base.saveMultiShipInfo = function () {
    $(".btn-save-multi-ship").on("click", function (e) {
        e.preventDefault();

        // Save address to checkoutAddressBook
        var form = $(this).closest("form");
        var $rootEl = $(this).closest(".shipping-content");
        var data = $(form).serialize();
        var url = $(form).attr("action");

        var checkedShippingMethod = $("input[name=dwfrm_shipping_shippingAddress_shippingMethodID]:checked", form);
        var isStorePickUpMethod = checkedShippingMethod.attr("data-pickup");
        var storeId = $("input[name='storeId']", form).val();
        var errorMsg = "Before you can continue to the next step, you must select a store.";

        if (isStorePickUpMethod === "true" && (storeId === undefined)) {
            base.methods.createErrorNotification(errorMsg);
        } else {
            $rootEl.spinner().start();
            $.ajax({
                url: url,
                type: "post",
                dataType: "json",
                data: data
            })
                .done(function (response) {
                    baseFormHelpers.clearPreviousErrors(form);
                    if (response.error) {
                        if (response.fieldErrors && response.fieldErrors.length) {
                            response.fieldErrors.forEach(function (error) {
                                if (Object.keys(error).length) {
                                    baseFormHelpers.loadFormErrors(form, error);
                                }
                            });
                        } else if (response.serverErrors && response.serverErrors.length) {
                            $.each(response.serverErrors, function (index, element) {
                                base.methods.createErrorNotification(element);
                            });
                        }
                    } else {
                    // Update UI from response
                        $("body").trigger("checkout:updateCheckoutView",
                            {
                                order: response.order,
                                customer: response.customer
                            }
                        );

                        base.methods.viewMultishipAddress($rootEl);
                    }

                    if (response.order && response.order.shippable) {
                        $("button.submit-shipping").attr("disabled", null);
                    }

                    $rootEl.spinner().stop();
                })
                .fail(function (err) {
                    if (err.responseJSON.redirectUrl) {
                        window.location.href = err.responseJSON.redirectUrl;
                    }

                    $rootEl.spinner().stop();
                });
        }
        return false;
    });
};

base.methods.updateShippingInformation = updateShippingInformation;
base.methods.updateShippingAddressSelector = updateShippingAddressSelector;
base.methods.updateShippingMethods = updateShippingMethods;

module.exports = base;
