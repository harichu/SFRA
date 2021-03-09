"use strict";

var addressHelpers = require("./address");
var formHelpers = require("./formErrors");
var generalUtils = require("jsfarmacias/generalUtils");
var scrollAnimate = require("../components/scrollAnimate");
var clientSideValidation = require("../components/clientSideValidation");
const storeLocator = require("../storeLocator/storeLocator");

var isStorePickupFirstLoad = true;
var isZoneCityMappingEnabled = $("#is-zone-city-zone-mapping-enabled").is(
  ":checked"
);
var isBrowserGeolocationEnabled =
  $("#is-browser-geolocation-enabled").val() === "true";

/**
 * Search for closest city;
 */
function fillStateAndCity() {
  var $closestCity = $("#closest-city");
  var closestCity = $closestCity.val();

  if (closestCity) {
    setHomeDeliveryStateAndCity(closestCity);
  } else if (isBrowserGeolocationEnabled) {
    navigator.geolocation.getCurrentPosition(function (position) {
      var lat = position.coords.latitude;
      var long = position.coords.longitude;
      var apiBrowserKey = $("#google-places-browser-api-key").val();

      if (apiBrowserKey) {
        var url =
          "https://maps.googleapis.com/maps/api/geocode/json?latlng=" +
          lat +
          "," +
          long +
          "&key=" +
          apiBrowserKey;

        $.ajax({
          url: url,
          type: "get",
          dataType: "json",
          success: function (data) {
            if (
              data &&
              data.results &&
              data.results.length &&
              data.results[0].address_components
            ) {
              var cityComponentArray = data.results[0].address_components.filter(
                function (component) {
                  return (
                    component.types &&
                    component.types.indexOf("locality") !== -1
                  );
                }
              );

              if (cityComponentArray[0]) {
                $closestCity.val(cityComponentArray[0].long_name);
                setHomeDeliveryStateAndCity($closestCity.val());
              }
            }
          },
        });
      }
    });
  }
}

/**
 * Validates the checkbox that says that the same prescription is valid for all products.
 * @return {Object} An object with the first item to which this applies, and the list of other items to apply.
 */
var validateApplyAllCheckbox = function () {
  var $firstApplied;
  var toApply = [];
  var $forms = $(".prescription-block").first().find(".js-prescription-form");
  $forms.each(function () {
    var $this = $(this);
    if ($this.data("image-name")) {
      if (!$firstApplied) {
        $firstApplied = $this;
      } else {
        if ($firstApplied.data("image-name") != $this.data("image-name")) {
          toApply = [];
          return false;
        }
      }
    } else {
      toApply.push($this);
    }
  });
  return {
    firstApplied: $firstApplied,
    toApply: toApply,
    items: $forms.length,
  };
};

/**
 * Displays a checkbox for the user to indicate whether a single prescription applies to all products.
 */
function displayApplyToAllPrescriptions() {
  $(".js-prescription-valid-to-all-container").addClass("d-none");
  $(".js-prescription-valid-to-all").removeAttr("disabled");

  var uploadedPrescriptionsQty = $(".js-exclude-prescription:visible").length;
  var isWontUploadCheckboxChecked = $(".noreceipt-input").is(":checked");
  var isPrescriptionValidToAll = $(".js-prescription-valid-to-all").is(
    ":checked"
  );
  var result = validateApplyAllCheckbox();
  var isAllPrescriptionsUploaded = result.toApply.length == 0;

  if (uploadedPrescriptionsQty <= 1) {
    if (result.firstApplied && result.toApply.length > 0) {
      result.firstApplied
        .closest(".js-prescription-card")
        .next(".js-prescription-valid-to-all-container")
        .removeClass("d-none");
    }
  }

  if (
    isPrescriptionValidToAll ||
    isWontUploadCheckboxChecked ||
    isAllPrescriptionsUploaded
  ) {
    $("body").trigger(
      "checkout:enableButton",
      ".next-step-button .submit-shipping"
    );
  } else {
    $("body").trigger(
      "checkout:disableButton",
      ".next-step-button .submit-shipping"
    );
  }
}

function setHomeDeliveryStateAndCity(googleApiCity) {
  var cityMappingData = $("#store-municipios").data("municipios");

  for (var state in cityMappingData) {
    if (state !== "States") {
      if (Object.prototype.hasOwnProperty.call(cityMappingData, state)) {
        var stateCities = cityMappingData[state];

        for (var city in stateCities) {
          if (googleApiCity === city) {
            selectStateAndCity(state, city);
          }
        }
      }
    }
  }
}

function selectStateAndCity(state, city) {
  if (city && state) {
    var $homeDeliveryCities = $("#shippingCitydefault");
    var $homeDeliveryStates = $("#shippingStatedefault");

    $homeDeliveryStates.val(state);
    $homeDeliveryStates.trigger("change");
    $homeDeliveryCities.val(city);
  }
}

/**
 * updates the shipping address selector within shipping forms
 * @param {Object} productLineItem - the productLineItem model
 * @param {Object} shipping - the shipping (shipment model) model
 * @param {Object} order - the order model
 * @param {Object} customer - the customer model
 */
function updateShippingAddressSelector(
  productLineItem,
  shipping,
  order,
  customer
) {
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
    $shippingAddressSelector.append(
      addressHelpers.methods.optionValueForAddress(null, false, order)
    );

    if (customer.addresses && customer.addresses.length > 0) {
      $shippingAddressSelector.append(
        addressHelpers.methods.optionValueForAddress(
          order.resources.accountAddresses,
          false,
          order
        )
      );

      customer.addresses.forEach(function (address) {
        var isSelected = shipping.matchingAddressId === address.ID;
        $shippingAddressSelector.append(
          addressHelpers.methods.optionValueForAddress(
            { UUID: "ab_" + address.ID, shippingAddress: address },
            isSelected,
            order
          )
        );
      });
    }
    // Separator -
    $shippingAddressSelector.append(
      addressHelpers.methods.optionValueForAddress(
        order.resources.shippingAddresses,
        false,
        order,
        { className: "multi-shipping" }
      )
    );
    shippings.forEach(function (aShipping) {
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
      if (
        (newAddress && matchingUUID) ||
        (!newAddress && matchingUUID) ||
        (!newAddress && !matchingUUID)
      ) {
        //NOSONAR
        $shippingAddressSelector.append(addressOption);
      }
      if (newAddress && !matchingUUID) {
        $(addressOption[0]).remove();
      }
    });
  }

  if (!hasSelectedAddress) {
    // show
    $(form).addClass("hide-details");
  } else {
    $(form).removeClass("hide-details");
  }

  $("body").trigger("shipping:updateShippingAddressSelector", {
    productLineItem: productLineItem,
    shipping: shipping,
    order: order,
    customer: customer,
  });
}

/**
 * updates the shipping address form values within shipping forms
 * @param {Object} shipping - the shipping (shipment model) model
 */
function updateShippingAddressFormValues(shipping) {
  var addressObject = $.extend({}, shipping.shippingAddress);

  if (!addressObject) {
    addressObject = {
      firstName: null,
      lastName: null,
      address1: null,
      address2: null,
      city: null,
      postalCode: null,
      stateCode: null,
      countryCode: null,
      barrio: null,
      phone: null,
    };
  }

  addressObject.isGift = shipping.isGift;
  addressObject.giftMessage = shipping.giftMessage;

  $("input[value=" + shipping.UUID + "]").each(function (formIndex, el) {
    var form = el.form;
    if (!form) return;
    var countryCode = addressObject.countryCode;

    $("input[name$=_firstName]", form).val(addressObject.firstName);
    $("input[name$=_lastName]", form).val(addressObject.lastName);
    $("input[name$=_address1]", form).val(addressObject.address1);
    $("input[name$=_address2]", form).val(addressObject.address2);
    $("select[name$=_city]", form).val(addressObject.city);
    $("input[name$=_barrio]", form).val(addressObject.barrio);
    $("input[name$=_postalCode]", form).val(addressObject.postalCode);
    $("select[name$=_stateCode],input[name$=_stateCode]", form).val(
      addressObject.stateCode
    );

    if (countryCode && typeof countryCode === "object") {
      $("select[name$=_country]", form).val(addressObject.countryCode.value);
    } else {
      $("select[name$=_country]", form).val(addressObject.countryCode);
    }

    $("input[name$=_phone]", form).val(addressObject.phone);

    $("input[name$=_isGift]", form).prop("checked", addressObject.isGift);
    $("textarea[name$=_giftMessage]", form).val(
      addressObject.isGift && addressObject.giftMessage
        ? addressObject.giftMessage
        : ""
    );
  });

  $("body").trigger("shipping:updateShippingAddressFormValues", {
    shipping: shipping,
  });
}

/**
 * updates the shipping method radio buttons within shipping forms
 * @param {Object} shipping - the shipping (shipment model) model
 */
function updateShippingMethods(shipping) {
  var uuidEl = $("input[value=" + shipping.UUID + "]");
  if (uuidEl && uuidEl.length > 0) {
    $.each(uuidEl, function (shipmentIndex, el) {
      var form = el.form;
      if (!form) return;

      var $shippingMethodList = $(".shipping-method-list", form);

      if ($shippingMethodList && $shippingMethodList.length > 0) {
        $shippingMethodList.empty();
        var shippingMethods = shipping.applicableShippingMethods;
        var selected = shipping.selectedShippingMethod || {};
        var shippingMethodFormID =
          form.name + "_shippingAddress_shippingMethodID";
        //
        // Create the new rows for each shipping method
        //
        $.each(shippingMethods, function (methodIndex, shippingMethod) {
          var tmpl = $("#shipping-method-template").clone();
          // set input
          $("input", tmpl)
            .prop(
              "id",
              "shippingMethod-" + shippingMethod.ID + "-" + shipping.UUID
            )
            .prop("name", shippingMethodFormID)
            .prop("value", shippingMethod.ID)
            .attr("checked", shippingMethod.ID === selected.ID);

          if (shippingMethod.storePickupEnabled) {
            $("input", tmpl).parent(".custom-control").addClass("d-none");
          }

          $("label", tmpl).prop(
            "for",
            "shippingMethod-" + shippingMethod.ID + "-" + shipping.UUID
          );
          // set shipping method name
          $(".display-name", tmpl).text(shippingMethod.displayName);
          // set or hide arrival time
          if (shippingMethod.estimatedArrivalTime) {
            $(".arrival-time", tmpl)
              .text("(" + shippingMethod.estimatedArrivalTime + ")")
              .show();
          }
          // set shipping cost
          $(".shipping-cost", tmpl).text(shippingMethod.shippingCost);

          $("input:checked", tmpl).parent(".custom-control").addClass("active");

          $shippingMethodList.append(tmpl.html());
        });
      }
    });
  }

  $("body").trigger("shipping:updateShippingMethods", { shipping: shipping });
}

/**
 * Update list of available shipping methods whenever user modifies shipping address details.
 * @param {jQuery} $shippingForm - current shipping form
 */
function updateShippingMethodList($shippingForm) {
  // delay for autocomplete!
  setTimeout(function () {
    var $shippingMethodList = $shippingForm.find(".shipping-method-list");
    var urlParams = addressHelpers.methods.getAddressFieldsFromUI(
      $shippingForm
    );
    var shipmentUUID = $shippingForm.find("[name=shipmentUUID]").val();
    var url = $shippingMethodList.data("actionUrl");
    urlParams.shipmentUUID = shipmentUUID;

    $shippingMethodList.spinner().start();
    $.ajax({
      url: url,
      type: "post",
      dataType: "json",
      data: urlParams,
      success: function (data) {
        if (data.error) {
          window.location.href = data.redirectUrl;
        } else {
          $("body").trigger("checkout:updateCheckoutView", {
            order: data.order,
            customer: data.customer,
            options: { keepOpen: true },
          });

          $shippingMethodList.spinner().stop();
        }
      },
    });
  }, 300);
}

/**
 * updates the order shipping summary for an order shipment model
 * @param {Object} shipping - the shipping (shipment model) model
 * @param {Object} order - the order model
 */
function updateShippingSummaryInformation(shipping, order) {
  $("[data-shipment-summary=" + shipping.UUID + "]").each(function (i, el) {
    var $container = $(el);
    var $shippingAddressLabel = $container.find(".shipping-addr-label");
    var $addressContainer = $container.find(".address-summary");
    var $shippingPhone = $container.find(".shipping-phone");
    var $methodTitle = $container.find(".shipping-method-title");
    var $methodArrivalTime = $container.find(".shipping-method-arrival-time");
    var $methodPrice = $container.find(".shipping-method-price");
    var $shippingSummaryLabel = $container.find(".shipping-method-label");
    var $summaryDetails = $container.find(".row.summary-details");
    var giftMessageSummary = $container.find(".gift-summary");

    var address = shipping.shippingAddress;
    var selectedShippingMethod = shipping.selectedShippingMethod;
    var isGift = shipping.isGift;

    addressHelpers.methods.populateAddressSummary($addressContainer, address);

    if (address && address.phone) {
      $shippingPhone.text(address.phone);
    } else {
      $shippingPhone.empty();
    }

    if (selectedShippingMethod) {
      $("body").trigger("shipping:updateAddressLabelText", {
        selectedShippingMethod: selectedShippingMethod,
        resources: order.resources,
        shippingAddressLabel: $shippingAddressLabel,
      });
      $shippingSummaryLabel.show();
      $summaryDetails.show();
      $methodTitle.text(selectedShippingMethod.displayName);
      if (selectedShippingMethod.estimatedArrivalTime) {
        $methodArrivalTime.text(
          "( " + selectedShippingMethod.estimatedArrivalTime + " )"
        );
      } else {
        $methodArrivalTime.empty();
      }
      $methodPrice.text(selectedShippingMethod.shippingCost);
    }

    if (isGift) {
      giftMessageSummary
        .find(".gift-message-summary")
        .text(shipping.giftMessage);
      giftMessageSummary.removeClass("d-none");
    } else {
      giftMessageSummary.addClass("d-none");
    }
  });

  $("body").trigger("shipping:updateShippingSummaryInformation", {
    shipping: shipping,
    order: order,
  });
}

function updateShippingHomeDelivery(data, form) {
  var htmlCode = `<p class="shipping-input-title text-bold mb-0">${data.address.addressId.htmlValue}</p><p class="shippig-address-details mb-0"> ${data.address.address1.htmlValue} ${data.address.address2.htmlValue} ${data.address.city.htmlValue}, ${data.address.states.stateCode.htmlValue}</p>`;
  $(".saved-address").find(".card-address label").html(htmlCode);

  if (form.attr("data-address-mode") == "new") {
    form.attr("data-address-mode", "saved-new");
    $(".shipping-form-element-container").addClass("deactivated");
  } else {
    form.attr("data-address-mode", "saved");
  }

  //Preselect the first available Home Delivery Shipping method
  $(".home-delivery-methods")
    .find(
      ".shipping-method-option-container:not(.inactive-home-shipping-method)"
    )
    .first()
    .addClass("active")
    .find("input")
    .click();
}

/**
 * Update the read-only portion of the shipment display (per PLI)
 * @param {Object} productLineItem - the productLineItem model
 * @param {Object} shipping - the shipping (shipment model) model
 * @param {Object} order - the order model
 * @param {Object} [options] - options for updating PLI summary info
 * @param {Object} [options.keepOpen] - if true, prevent changing PLI view mode to 'view'
 */
function updatePLIShippingSummaryInformation(
  productLineItem,
  shipping,
  order,
  options
) {
  var $pli = $("input[value=" + productLineItem.UUID + "]");
  var form = $pli && $pli.length > 0 ? $pli[0].form : null;

  if (!form) return;

  var $viewBlock = $(".view-address-block", form);

  var address = shipping.shippingAddress || {};
  var selectedMethod = shipping.selectedShippingMethod;

  var nameLine = address.firstName ? address.firstName + " " : "";
  if (address.lastName) nameLine += address.lastName;

  var address1Line = address.address1;
  var address2Line = address.address2;

  var phoneLine = address.phone;

  var shippingCost = selectedMethod ? selectedMethod.shippingCost : "";
  var methodNameLine = selectedMethod ? selectedMethod.displayName : "";
  var methodArrivalTime =
    selectedMethod && selectedMethod.estimatedArrivalTime
      ? "(" + selectedMethod.estimatedArrivalTime + ")"
      : "";

  var tmpl = $("#pli-shipping-summary-template").clone();

  $(".ship-to-name", tmpl).text(nameLine);
  $(".ship-to-address1", tmpl).text(address1Line);
  $(".ship-to-address2", tmpl).text(address2Line);
  $(".ship-to-city", tmpl).text(address.city);
  if (address.stateCode) {
    $(".ship-to-st", tmpl).text(address.stateCode);
  }
  $(".ship-to-zip", tmpl).text(address.postalCode);
  $(".ship-to-phone", tmpl).text(phoneLine);

  if (!address2Line) {
    $(".ship-to-address2", tmpl).hide();
  }

  if (!phoneLine) {
    $(".ship-to-phone", tmpl).hide();
  }

  if (shipping.selectedShippingMethod) {
    $(".display-name", tmpl).text(methodNameLine);
    $(".arrival-time", tmpl).text(methodArrivalTime);
    $(".price", tmpl).text(shippingCost);
  }

  if (shipping.isGift) {
    $(".gift-message-summary", tmpl).text(shipping.giftMessage);
    var shipment = $(".gift-message-" + shipping.UUID);
    $(shipment).val(shipping.giftMessage);
  } else {
    $(".gift-summary", tmpl).addClass("d-none");
  }
  // checking h5 title shipping to or pickup
  var $shippingAddressLabel = $(".shipping-header-text", tmpl);
  $("body").trigger("shipping:updateAddressLabelText", {
    selectedShippingMethod: selectedMethod,
    resources: order.resources,
    shippingAddressLabel: $shippingAddressLabel,
  });

  $viewBlock.html(tmpl.html());

  $("body").trigger("shipping:updatePLIShippingSummaryInformation", {
    productLineItem: productLineItem,
    shipping: shipping,
    order: order,
    options: options,
  });
}

/**
 * Update the hidden form values that associate shipping info with product line items
 * @param {Object} productLineItem - the productLineItem model
 * @param {Object} shipping - the shipping (shipment model) model
 */
function updateProductLineItemShipmentUUIDs(productLineItem, shipping) {
  $("input[value=" + productLineItem.UUID + "]").each(function (key, pli) {
    var form = pli.form;
    $("[name=shipmentUUID]", form).val(shipping.UUID);
    $("[name=originalShipmentUUID]", form).val(shipping.UUID);

    $(form).closest(".card").attr("data-shipment-uuid", shipping.UUID);
  });

  $("body").trigger("shipping:updateProductLineItemShipmentUUIDs", {
    productLineItem: productLineItem,
    shipping: shipping,
  });
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
      updateProductLineItemShipmentUUIDs(productLineItem, aShipping);
    });
  });

  // Now update shipping information, based on those associations
  updateShippingMethods(shipping);
  updateShippingAddressFormValues(shipping);
  updateShippingSummaryInformation(shipping, order);

  // And update the PLI-based summary information as well
  shipping.productLineItems.items.forEach(function (productLineItem) {
    updateShippingAddressSelector(productLineItem, shipping, order, customer);
    updatePLIShippingSummaryInformation(
      productLineItem,
      shipping,
      order,
      options
    );
  });

  $("body").trigger("shipping:updateShippingInformation", {
    order: order,
    shipping: shipping,
    customer: customer,
    options: options,
  });
}

/**
 * Update the checkout state (single vs. multi-ship)
 * @param {Object} order - checkout model to use as basis of new truth
 */
function updateMultiShipInformation(order) {
  var $checkoutMain = $("#checkout-main");
  var $checkbox = $("[name=usingMultiShipping]");
  // var $submitShippingBtn = $("button.submit-shipping");
  $(".shipping-error .alert-danger").remove();

  if (order.usingMultiShipping) {
    $checkoutMain.addClass("multi-ship");
    $checkbox.prop("checked", true);
  } else {
    $checkoutMain.removeClass("multi-ship");
    $checkbox.prop("checked", null);
    //Removed that line because multishipping is not being used and the button shouldn't be enabled here.
    // $submitShippingBtn.prop("disabled", null);
  }

  $("body").trigger("shipping:updateMultiShipInformation", { order: order });
}

/**
 * Create an alert to display the error message
 * @param {Object} message - Error message to display
 */
function createErrorNotification(message) {
  var errorHtml =
    '<div class="alert alert-danger alert-dismissible valid-cart-error ' +
    'fade show" role="alert">' +
    '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
    '<span aria-hidden="true">&times;</span>' +
    "</button>" +
    message +
    "</div>";

  $(".shipping-error").append(errorHtml);
  scrollAnimate($(".shipping-error"));
}

/**
 * Handle response from the server for valid or invalid form fields.
 * @param {Object} defer - the deferred object which will resolve on success or reject.
 * @param {Object} data - the response data with the invalid form fields or
 *  valid model data.
 */
function shippingFormResponse(defer, data) {
  var isMultiShip = $("#checkout-main").hasClass("multi-ship");
  var formSelector = isMultiShip
    ? ".multi-shipping .active form"
    : ".single-shipping form";

  // highlight fields with errors
  if (data.error) {
    if (data.fieldErrors.length) {
      data.fieldErrors.forEach(function (error) {
        if (Object.keys(error).length) {
          formHelpers.loadFormErrors(formSelector, error);
        }
      });
      defer.reject(data);
    }

    if (data.serverErrors && data.serverErrors.length) {
      $.each(data.serverErrors, function (index, element) {
        createErrorNotification(element);
      });

      defer.reject(data);
    }

    if (data.cartError) {
      window.location.href = data.redirectUrl;
      defer.reject();
    }
  } else {
    // Populate the Address Summary

    $("body").trigger("checkout:updateCheckoutView", {
      order: data.order,
      customer: data.customer,
    });
    if ($(window).width() > 991) {
      scrollAnimate($(".payment-form"));
    }

    defer.resolve(data);
  }
}
/**
 * Clear out all the shipping form values and select the new address in the drop down
 * @param {Object} order - the order object
 */
function clearShippingForms(order) {
  order.shipping.forEach(function (shipping) {
    $("input[value=" + shipping.UUID + "]").each(function (formIndex, el) {
      var form = el.form;
      if (!form) return;

      $("input[name$=_firstName]", form).val("");
      $("input[name$=_lastName]", form).val("");
      $("input[name$=_address1]", form).val("");
      $("input[name$=_address2]", form).val("");
      $("select[name$=_city]", form).val("");
      $("input[name$=_barrio]", form).val("");
      $("input[name$=_postalCode]", form).val("");
      $("select[name$=_stateCode],input[name$=_stateCode]", form).val("");
      $("select[name$=_country]", form).val("");

      $("input[name$=_phone]", form).val("");

      $("input[name$=_isGift]", form).prop("checked", false);
      $("textarea[name$=_giftMessage]", form).val("");
      $(form).find(".gift-message").addClass("d-none");

      $(form).attr("data-address-mode", "new");
      var addressSelectorDropDown = $(
        ".addressSelector input[value=new]",
        form
      );
      $(addressSelectorDropDown).prop("checked", "checked");
    });
  });

  $("body").trigger("shipping:clearShippingForms", { order: order });
}

/**
 * Does Ajax call to create a server-side shipment w/ pliUUID & URL
 * @param {string} url - string representation of endpoint URL
 * @param {Object} shipmentData - product line item UUID
 * @returns {Object} - promise value for async call
 */
function createNewShipment(url, shipmentData) {
  $(".checkout-page").spinner().start();
  return $.ajax({
    url: url,
    type: "post",
    dataType: "json",
    data: shipmentData,
  });
}

/**
 * Does Ajax call to select shipping method
 * @param {string} url - string representation of endpoint URL
 * @param {Object} urlParams - url params
 * @param {Object} el - element that triggered this call
 */
function selectShippingMethodAjax(url, urlParams, el) {
  $(".checkout-page").spinner().start();
  $.ajax({
    url: url,
    type: "post",
    dataType: "json",
    data: urlParams,
  })
    .done(function (data) {
      if (data.error) {
        window.location.href = data.redirectUrl;
      } else {
        var cartTotal = data.order.priceTotal.replace(/\D/g, "");
        $(".mp-form").data("mp-cart-total", cartTotal);

        $("body").trigger("checkout:updateCheckoutView", {
          order: data.order,
          customer: data.customer,
          options: { keepOpen: true },
          urlParams: urlParams,
        });
        $("body").trigger("checkout:postUpdateCheckoutView", {
          el: el,
        });
      }
      $.spinner().stop();
    })
    .fail(function () {
      $.spinner().stop();
    });
}

/**
 * Hide and show to appropriate elements to show the multi ship shipment cards in the enter view
 * @param {jQuery} element - The shipping content
 */
function enterMultishipView(element) {
  element.find(".btn-enter-multi-ship").removeClass("d-none");

  element.find(".view-address-block").addClass("d-none");
  element.find(".shipping-address").addClass("d-none");
  element.find(".btn-save-multi-ship.save-shipment").addClass("d-none");
  element.find(".btn-edit-multi-ship").addClass("d-none");
  element.find(".multi-ship-address-actions").addClass("d-none");
}

/**
 * Hide and show to appropriate elements to show the multi ship shipment cards in the view mode
 * @param {jQuery} element - The shipping content
 */
function viewMultishipAddress(element) {
  element.find(".view-address-block").removeClass("d-none");
  element.find(".btn-edit-multi-ship").removeClass("d-none");

  element.find(".shipping-address").addClass("d-none");
  element.find(".btn-save-multi-ship.save-shipment").addClass("d-none");
  element.find(".btn-enter-multi-ship").addClass("d-none");
  element.find(".multi-ship-address-actions").addClass("d-none");
}

/**
 * Hide and show to appropriate elements that allows the user to edit multi ship address information
 * @param {jQuery} element - The shipping content
 */
function editMultiShipAddress(element) {
  // Show
  element.find(".shipping-address").removeClass("d-none");
  element.find(".btn-save-multi-ship.save-shipment").removeClass("d-none");

  // Hide
  element.find(".view-address-block").addClass("d-none");
  element.find(".btn-enter-multi-ship").addClass("d-none");
  element.find(".btn-edit-multi-ship").addClass("d-none");
  element.find(".multi-ship-address-actions").addClass("d-none");

  $("body").trigger("shipping:editMultiShipAddress", {
    element: element,
    form: element.find(".shipping-form"),
  });
}

/**
 * perform the proper actions once a user has clicked enter address or edit address for a shipment
 * @param {jQuery} element - The shipping content
 * @param {string} mode - the address mode
 */
function editOrEnterMultiShipInfo(element, mode) {
  var form = $(element).closest("form");
  var root = $(element).closest(".shipping-content");

  $("body").trigger("shipping:updateDataAddressMode", {
    form: form,
    mode: mode,
  });

  editMultiShipAddress(root);

  var addressInfo = addressHelpers.methods.getAddressFieldsFromUI(form);

  var savedState = {
    UUID: $("input[name=shipmentUUID]", form).val(),
    shippingAddress: addressInfo,
  };

  root.data("saved-state", JSON.stringify(savedState));
}

function setMunicipios(departamento) {
  var $city = $(".shippingCity");
  var municipios = JSON.parse($city.attr("data-municipios"));
  var selectedMunicipios = municipios[departamento];
  var city = null;
  var cityValue = null;
  var selected = null;
  var htmlElement = null;

  $city.html("");

  if (isZoneCityMappingEnabled) {
    for (city in selectedMunicipios) {
      if (Object.prototype.hasOwnProperty.call(selectedMunicipios, city)) {
        cityValue = $city.attr("data-value");
        selected = cityValue != "" && cityValue == city ? "selected" : "";
        htmlElement = `<option value="${city}" ${selected}>${city}</option>`;

        $city.append(htmlElement);
      }
    }
  } else {
    for (city in selectedMunicipios) {
      if (Object.prototype.hasOwnProperty.call(selectedMunicipios, city)) {
        cityValue = $city.attr("data-value");
        selected =
          cityValue != "" && cityValue == selectedMunicipios[city]
            ? "selected"
            : "";
        htmlElement = `<option value="${selectedMunicipios[city]}" selected="${selected}">${selectedMunicipios[city]}</option>`;

        $city.append(htmlElement);
      }
    }
  }

  generalUtils.sortOptionsAlphabetically($city);
}

/**
 * select the store pickup shipping method if we have restricted prescription in basket
 */
function setShippingMethodIfPrescriptionProducts() {
  var $checkbox = $("#is-prescription-product-present");

  if ($checkbox.length && $checkbox.is(":checked")) {
    $(".shipping-method-list")
      .find("input[data-pickup='true']")
      .trigger("click");
  }
}

/**
 * handle upload prescription events
 */
function handleUploadClick($parent, $this) {
  var url = $parent.data("upload");
  var pid = $parent.data("pid");
  var csrf = $("[name=csrf_token]").val();
  var prescriptionFile = $parent.find(".js-prescription-file").get(0).files[0];
  var $errorMsgContainer = $parent.siblings(".error-msg");

  // A product line item can have two tiles: one for home delivery and one for store pickup;
  var $allTilesOfSamePLI = $('.js-prescription-form[data-pid="' + pid + '"]');
  var $allUploadButtonsForSamePLI = $allTilesOfSamePLI.find(
    ".js-prescription-upload"
  );

  $errorMsgContainer.text("");

  if (prescriptionFile) {
    var formData = new FormData();
    formData.append("file", prescriptionFile);
    formData.append("pid", pid);
    formData.append("csrf_token", csrf);
    $parent.spinner().start();
    $this.attr("disabled", true);
    $.ajax({
      url: url,
      type: "POST",
      enctype: "multipart/form-data",
      data: formData,
      processData: false,
      contentType: false,
      cache: false,
      success: function (data) {
        if (data.success) {
          $allTilesOfSamePLI
            .find(".js-prescription-file-name")
            .text(data.fileName);
          $allTilesOfSamePLI
            .find(".js-prescription-file-name-container")
            .removeClass("d-none");
          $allUploadButtonsForSamePLI.addClass("d-none");
          $allTilesOfSamePLI.data("image-name", data.fileName);
          displayApplyToAllPrescriptions();
          $(".prescription-noreceipt").addClass("d-none");
        } else {
          $errorMsgContainer.text(data.msg);
          $this.removeAttr("disabled");
          $allTilesOfSamePLI.find(".js-prescription-file").val("");
        }
        $parent.spinner().stop();
      },
      error: function () {
        $parent.spinner().stop();
        $this.removeAttr("disabled");
        $allTilesOfSamePLI.find(".js-prescription-file").val("");
      },
    });
  } else {
    $parent.find(".js-prescription-file").trigger("click");
  }
}

module.exports = {
  methods: {
    updateShippingAddressSelector: updateShippingAddressSelector,
    updateShippingAddressFormValues: updateShippingAddressFormValues,
    updateShippingMethods: updateShippingMethods,
    updateShippingSummaryInformation: updateShippingSummaryInformation,
    updatePLIShippingSummaryInformation: updatePLIShippingSummaryInformation,
    updateProductLineItemShipmentUUIDs: updateProductLineItemShipmentUUIDs,
    updateShippingInformation: updateShippingInformation,
    updateMultiShipInformation: updateMultiShipInformation,
    shippingFormResponse: shippingFormResponse,
    createNewShipment: createNewShipment,
    selectShippingMethodAjax: selectShippingMethodAjax,
    updateShippingMethodList: updateShippingMethodList,
    clearShippingForms: clearShippingForms,
    editMultiShipAddress: editMultiShipAddress,
    editOrEnterMultiShipInfo: editOrEnterMultiShipInfo,
    createErrorNotification: createErrorNotification,
    viewMultishipAddress: viewMultishipAddress,
    updateShippingHomeDelivery: updateShippingHomeDelivery,
    fillStateAndCity: fillStateAndCity,
    validateApplyAllCheckbox: validateApplyAllCheckbox,
    displayApplyToAllPrescriptions: displayApplyToAllPrescriptions,
  },

  selectShippingMethod: function () {
    var baseObj = this;

    setShippingMethodIfPrescriptionProducts();

    $("body").on("change", ".quantity-form > .quantity", function () {
      console.log("change cart");
      var preSelectQty = $(this).data("pre-select-qty");
      var quantity = $(this).val();
      var productID = $(this).data("pid");
      var url = $(this).data("action");
      var uuid = $(this).data("uuid");

      var urlParams = {
        pid: productID,
        quantity: quantity,
        uuid: uuid,
      };
      url = appendToUrl(url, urlParams);

      $(this).parents(".card").spinner().start();

      $.ajax({
        url: url,
        type: "get",
        context: this,
        dataType: "json",
        success: function (data) {
          $('.quantity[data-uuid="' + uuid + '"]').val(quantity);
          $(".coupons-and-promos")
            .empty()
            .append(data.totals.discountsHtml);
          updateCartTotals(data);
          updateApproachingDiscounts(data.approachingDiscounts);
          updateAvailability(data, uuid);
          validateBasket(data);
          $(this).data("pre-select-qty", quantity);

          $("body").trigger("cart:update");

          $.spinner().stop();
          if (
            $(this)
              .parents(".product-info")
              .hasClass("bonus-product-line-item") &&
            $(".cart-page").length
          ) {
            location.reload();
          }
        },
        error: function (err) {
          if (err.responseJSON.redirectUrl) {
            window.location.href = err.responseJSON.redirectUrl;
          } else {
            createErrorNotification(err.responseJSON.errorMessage);
            $(this).val(parseInt(preSelectQty, 10));
            $.spinner().stop();
          }
        },
      });
    });

    $("body").on("change", "[name='shipday']", function () {
      var $this = $(this);

      if ($this.is(":checked")) {
        var url = $this.closest(".shiptime-option-container").data("url");
        var isToday = $this.val() === "today";

        $.ajax({
          url: url,
          type: "get",
          dataType: "json",
          data: {
            isToday: isToday,
            todayTime: $("#current-day-hour").val(),
            tomorrowTime: $("#next-day-hour").val(),
          },
          success: function () {
            var $shippingMethodList = $(
              '.shipping-method-option-container[data-is-today="' +
              isToday +
              '"'
            );
            $(".shipping-method-option-container").hide();
            $shippingMethodList.show();
            $shippingMethodList
              .find("input[data-pickup=false]")
              .first()
              .click();
          },
        });
      }
    });

    $(".shipping-method-list").change(function () {
      var $shippingForm = $(this).parents("form");
      var methodID = $(":checked", this).val();
      $(".shipping-method-option-container.active").removeClass("active");
      $(":checked", this)
        .parent(".shipping-method-option-container")
        .addClass("active");
      var shipmentUUID = $shippingForm.find("[name=shipmentUUID]").val();
      var urlParams = addressHelpers.methods.getAddressFieldsFromUI(
        $shippingForm
      );
      urlParams.shipmentUUID = shipmentUUID;
      urlParams.methodID = methodID;
      urlParams.isGift = $shippingForm.find(".gift").prop("checked");
      urlParams.giftMessage = $shippingForm
        .find("textarea[name$=_giftMessage]")
        .val();

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "clickShippingMethod",
        action: $(this).find("input:checked").val(),
        label: "ShippingMethodID",
      });

      var url = $(this).data("select-shipping-method-url");
      if (baseObj.methods && baseObj.methods.selectShippingMethodAjax) {
        baseObj.methods.selectShippingMethodAjax(url, urlParams, $(this));
      } else {
        selectShippingMethodAjax(url, urlParams, $(this));
      }
    });

    $(document).on("click", ".confirm-shipping-button", function () {
      $(".delivery.prescription-block").removeClass("d-none");
      $(".delivery-content").addClass("d-none");
    });

    $(document).on("click", ".pickup-in-store-title", function () {
      var $this = $(this);

      if (!$this.hasClass("disabled") && !$this.hasClass("active")) {
        $("body").trigger(
          "checkout:disableButton",
          ".next-step-button .submit-shipping"
        );
        $(".shipping-method-list")
          .find("input[data-pickup='true']:enabled")
          .first()
          .trigger("click");
        $(".home-delivery-block").addClass("d-none");
        $(".pickup-in-store-block").removeClass("d-none");

        if (isStorePickupFirstLoad) {
          $(document).trigger("body:loadStorelocator");
        }

        isStorePickupFirstLoad = false;

        $(".checkout-summary").attr("data-summary-mode", "address-pickup");

        $(document).find(".home-delivery-title").removeClass("active");
        $(document).find(".pickup-in-store-title").addClass("active");

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push($(this).data("gtm"));
      }
    });

    $(document).on("click", ".home-delivery-title", function () {
      var $this = $(this);

      if (!$this.hasClass("disabled") && !$this.hasClass("active")) {
        $(".shipping-method-list")
          .find("input[data-pickup='false']:enabled")
          .first()
          .trigger("click");
        $(".home-delivery-block").removeClass("d-none");
        var $pickupBlock = $(".pickup-in-store-block");
        $pickupBlock.addClass("d-none");

        var $storePickupOtherCityCheckbox = $("#pickup-select-radio");
        var isOtherCityCheckboxChecked = $storePickupOtherCityCheckbox.is(
          ":checked"
        );
        if (isOtherCityCheckboxChecked) {
          $pickupBlock.attr("data-pickup-option", "select");
        } else {
          $pickupBlock.attr("data-pickup-option", "detect");
        }

        $(".checkout-summary")
          .find(".checkout-summary-preshipping")
          .removeClass("d-none");
        $(".checkout-summary").attr("data-summary-mode", "address");

        $(document).find(".home-delivery-title").addClass("active");
        $(document).find(".pickup-in-store-title").removeClass("active");

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push($(this).data("gtm"));
      }
    });

    $(document).on("click", ".change-address", function (e) {
      e.preventDefault();
      var form = $(this).closest("form");

      form.find(".shipping-form-element-container").removeClass("deactivated");

      if (form.data("addressMode") == "saved-new") {
        form.attr("data-address-mode", "new");
      } else {
        form.attr("data-address-mode", "edit");
        // Reset selected shipping address
        form.find(".active .custom-control-input").prop("checked", false);
        form.find(".custom-control.active").removeClass("active");
      }

      $(".checkout-summary").attr("data-summary-mode", "address");
      $("body").trigger("checkout:disableButton", ".next-step-button button");
    });

    $(document).on("change", "input[name='selectType']", function () {
      $(".pickup-in-store").removeClass("d-none").addClass("d-flex");

      if ($(this).val() == "choose") {
        $(this)
          .parents(".pickup-in-store-block")
          .attr("data-pickup-option", "select");
      } else {
        storeLocator.updateCustomerLocationByZone(
          $("#zoneSelectedMunicipio").val(),
          $("#zoneSelectedDepartamento").val()
        );
        $(this)
          .parents(".pickup-in-store-block")
          .attr("data-pickup-option", "detect");
      }

      $(this)
        .parents(".selection-type-stores")
        .find(".custom-radio")
        .removeClass("active");
      $(this).parents(".custom-radio").addClass("active");
    });

    $(document).on("click", ".note-link", function (e) {
      e.preventDefault();
      $(".note-textarea").toggleClass("d-none");
      $(this).find(".note-link-text").toggleClass("expanded");
    });

    //Reset who takes form when user changes input information
    $(document).on("keyup", ".fields-who-takes input", function () {
      if ($(".confirm-who-takes").prop("disabled")) {
        $("body").trigger("checkout:enableButton", ".confirm-who-takes");
        $("body").trigger(
          "checkout:disableButton",
          ".next-step-button .submit-shipping"
        );
      }
    });

    $(document).on("click", ".confirm-who-takes", function () {
      // Check general FD validation on Who takes form fields
      var pickupOnBehalfActive = $(
        ".selection-type-stores-radios-button input[value=other]"
      ).prop("checked");

      if (pickupOnBehalfActive) {
        $(".fields-who-takes").find(".form-control").trigger("validateInput");
        if (
          !clientSideValidation.functions.validateDocument(
            $(".rut-inputfield").val(),
            $(".rut-inputfield").data("type")
          )
        ) {
          clientSideValidation.functions.invalidateField($(".rut-inputfield"));
        }
      }

      if (
        !pickupOnBehalfActive ||
        $(".fields-who-takes").find(".form-control.is-invalid").length == 0
      ) {
        var isAllPrescriptionsUploaded = true;
        var isPrescriptionUploadEnabled = $(
          "#is-prescription-upload-enabled"
        ).is(":checked");
        var hasProductWithPrescriptions =
          $(this).closest("form").find(".js-prescription-upload").length > 0;

        $(".js-prescription-file-name").each(function () {
          if ($(this).html() === "null") {
            isAllPrescriptionsUploaded = false;
          }
        });

        //Listen to button click to finish first step and show prescription block
        if (isPrescriptionUploadEnabled && hasProductWithPrescriptions) {
          $(".first-step-shipment").removeClass("d-flex").addClass("d-none");
        }
        if (isPrescriptionUploadEnabled && hasProductWithPrescriptions) {
          $(".pickup.prescription-block").removeClass("d-none");
        }

        // If fields are valid and prescription is valid/not needed, go to next step
        if (isAllPrescriptionsUploaded || !isPrescriptionUploadEnabled) {
          $(this).attr("disabled", true);
          $("body").trigger(
            "checkout:enableButton",
            ".next-step-button .submit-shipping"
          );
        }
      }
    });

    $(document).on("click", "input[name='select-who-takes']", function () {
      window.dataLayer = window.dataLayer || [];
      if ($(this).val() == "me") {
        window.dataLayer.push({
          event: "StorePicker",
          eventTypes: "click",
          action: "Me",
          label: "WhoWillPick",
        });

        $(".fields-who-takes").addClass("d-none");
        $(".fields-who-takes").find("#who-takes-name").val("");
        $(".fields-who-takes").find("#who-takes-rut").val("");
      } else {
        window.dataLayer.push({
          event: "StorePicker",
          eventTypes: "click",
          action: "Other",
          label: "WhoWillPick",
        });

        $(".fields-who-takes").removeClass("d-none");
      }

      $(".confirm-who-takes").removeAttr("disabled");
      $(this)
        .parents(".selection-type-stores-radios")
        .find(".custom-radio")
        .removeClass("active");
      $(this).parents(".custom-radio").addClass("active");
    });

    $(document).on("click", "input[name='pickday']", function () {
      $(this)
        .parents(".selection-pickday-radios")
        .find(".custom-radio")
        .removeClass("active");
      $(this).parents(".custom-radio").addClass("active");
    });

    $(document).on("click", "input[name='shipday']", function () {
      $(this)
        .parents(".selection-shipday-radios")
        .find(".custom-radio")
        .removeClass("active");
      $(this).parents(".custom-radio").addClass("active");
    });

    $(document).on(
      "click",
      ".selected-location-text .checkout-link",
      function (e) {
        e.preventDefault();
        $(".change-store").trigger("click");
      }
    );

    $(document).on("click", ".select-place", function (e) {
      e.preventDefault();
      var departamento = $("#store-departamentos").val();
      var municipio = $("#store-municipios").val();
      var $pickUpInStoreDiv = $(".pickup-in-store");
      $(".confirm-who-takes").removeAttr("disabled");
      if (!$pickUpInStoreDiv.hasClass("d-flex")) {
        $pickUpInStoreDiv.addClass("d-flex");
        $pickUpInStoreDiv.removeClass("d-none");
      }
      storeLocator.updateCustomerLocationByZone(municipio, departamento);

      $(this)
        .parents(".pickup-in-store-block")
        .attr("data-pickup-option", "detect-selected");

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: "clickConfirmStorePickup",
        action: municipio + ", " + departamento,
        label: "StorePickupData",
      });
    });
  },

  saveHomeDelivery: function () {
    $(document).on(
      "click",
      "#confirm-address, #shipmentSelector-default input",
      function () {
        var $this = $(this);
        var url = $("#save-address-url").val();
        var defer = $.Deferred(); // eslint-disable-line
        var $form = $("#confirm-address").parents("form");
        var isSaveAddress =
          ($form.attr("data-address-mode") == "new" ||
            $form.attr("data-address-mode") == "details") &&
          $form.hasClass("user-logged");
        $("#save-address").val(isSaveAddress);

        $(".checkout-page").spinner().start();

        // If customer selects a saved address;
        if ($this.hasClass("address-option")) {
          var addressId = $this.data("address-id");
          var lat = $this.data("latitude");
          var lng = $this.data("longitude");
          var state = $this.data("state-code");
          var city = $this.data("city");
          var address1 = $this.data("address1");
          var address2 = $this.data("address2");

          setMunicipios(state);

          $form.find(".shippingAddressId").val(addressId);
          $form.find("#addressLatitude").val(lat);
          $form.find("#addressLongitude").val(lng);
          $form.find("#shippingStatedefault").val(state);
          $form.find("#shippingCitydefault").val(city);
          $form.find("#shippingAddressOnedefault").val(address1);
          $form.find("#shippingAddressTwodefault").val(address2);
        }

        var formData = $form.serialize();

        if (isSaveAddress) {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: "clickConfirmNewShippingAddress",
            label: window.location.href,
            data: formData,
          });
        } else {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({
            event: "clickConfirmShippingAddress",
            action: $(".addressSelector input").data("address-id"),
            label: "SelectedAddressID",
          });
        }

        $.ajax({
          url: url,
          method: "POST",
          data: formData,
          success: function (data) {
            $.spinner().stop();
            if (data.success) {
              if ($(".shipping-error").html().length > 0) {
                $(".shipping-error").html("");
              }

              var outOfStockProducts = data.productsOutOfStock;
              console.log(outOfStockProducts);
              if (outOfStockProducts.length === 0) {
                formHelpers.clearPreviousErrors($form);
                var $todayRadioOption = $("[name='shipday'][value='today']");
                var $tomorrowRadioOption = $(
                  "[name='shipday'][value='tomorrow']"
                );

                $(
                  '[name="dwfrm_shipping_shippingAddress_shippingMethodID"]'
                ).attr("checked", false);
                $("[name='shipday']").attr("disabled", false);

                if (data.storeData.isInventoryCheckServiceEnabled) {
                  var $shippingMethodsContainer = $(".home-delivery-methods");
                  $shippingMethodsContainer.attr("data-available-days", "all");

                  if (!data.storeData.currentDayHour) {
                    $shippingMethodsContainer.attr(
                      "data-available-days",
                      "tomorrow"
                    );
                  }

                  if (!data.storeData.nextDayHour) {
                    $shippingMethodsContainer.attr(
                      "data-available-days",
                      "today"
                    );
                  }
                }

                window.difarmaHomeDelivery = data.storeData;

                if (data.storeData.currentDayHour) {
                  $todayRadioOption.trigger("click");
                } else {
                  $tomorrowRadioOption.trigger("click");
                  $todayRadioOption.attr("disabled", true);
                  $(
                    ".shipping-method-list [data-is-today='true'] input[data-pickup='false']"
                  ).attr("disabled", true);
                  $todayRadioOption
                    .parent(".custom-radio")
                    .addClass("disabled");
                }

                $("#current-day-hour").val(data.storeData.currentDayHour);
                $("#next-day-hour").val(data.storeData.nextDayHour);

                $("body").trigger("checkout:updateCheckoutView", {
                  order: data.order,
                  store: data.storeData,
                  customer: data.customer,
                });
                updateShippingHomeDelivery(data, $form);
              } else {
                var $unavProdsModal = $("#unavProdsModal");
                $unavProdsModal.modal("show");
                var $deletionPanel = $("#out-of-stock-items");
                $deletionPanel.empty();

                for (var i = 0; i < outOfStockProducts.length; i++) {
                  var product = outOfStockProducts[i];
                  var $productLine = $(
                    '<div class="product-line-item d-flex align-items-center"></div>'
                  );

                  var $productIcon = $('<div class="product-icon"></div>');
                  $productIcon.append($("<img>", { src: product.image }));

                  var $productDescription = $(
                    '<div class="product-description d-flex"></div>'
                  );
                  var $productBrand = $('<span class="product-brand"></span>');
                  $productBrand.html(product.brand);

                  var $shortDescription = $(
                    '<span class="line-item-name"></span>'
                  );
                  $shortDescription.html(product.description);

                  var $quantity = $(
                    '<span class="line-item-pricing-info"></span>'
                  );
                  $quantity.html(product.displayQuantity);

                  var $currentStock = $(
                    '<span class="line-item-pricing-info"></span>'
                  );
                  $currentStock.html("Displonible en Stock: " + product.available);

                  $productDescription.append($productBrand);
                  $productDescription.append($shortDescription);
                  $productDescription.append($quantity);
                  $productDescription.append($currentStock);
                  var $divisor = $('<div class="divisor"></div>');

                  var $deleteDiv = $('<div class="product-delete"></div>');
                  var $deleteLink = $(
                    '<a class="product-delete-link d-flex align-items-center"></a>'
                  );
                  $deleteLink.attr("href", product.deleteLink);
                  $deleteLink.append($("#remove-icon-base").html());
                  $deleteDiv.append($deleteLink);

                  $productLine.append($productIcon);
                  $productLine.append($productDescription);
                  $productLine.append($divisor);
                  $productLine.append($deleteDiv);
                  $deletionPanel.append($productLine);
                }

                $unavProdsModal.find("a").on("click", function (e) {
                  e.stopPropagation();
                  e.preventDefault();
                  var $anchor = $(this);
                  $.ajax({
                    url: $anchor.attr("href"),
                  }).done(function () {
                    var $line = $anchor.parent().parent();
                    $line.remove();
                    if ($deletionPanel.children().length === 0) {
                      window.location.href = data.outOfStockRedirectUrl;
                      location.reload(true);
                    }
                  });
                });
              }
            } else {
              shippingFormResponse(defer, data);
              // Open address form and validate errors, so that the users can correct them
              if ($form.attr("data-address-mode") == "customer") {
                $(".shipping-form")
                  .attr("data-address-mode", "new")
                  .find(".form-control")
                  .trigger("validateInput");
              }
            }
          },
          error: function (err) {
            $.spinner().stop();
            if ($(".shipping-error").html().length == 0) {
              createErrorNotification(JSON.parse(err.responseText).message);
            } else {
              scrollAnimate($(".shipping-error"));
            }
            $.spinner().stop();
          },
        });
      }
    );
  },

  backToSavedAddresses: function () {
    $(".js-address-back").on("click", function () {
      var $form = $(this).parents(".shipping-form");
      $form.attr("data-address-mode", "edit");
      // Reset selected shipping address
      $form.find(".active .custom-control-input").prop("checked", false);
      $form.find(".custom-control.active").removeClass("active");
    });
  },

  toggleMultiship: function () {
    var baseObj = this;

    $('input[name="usingMultiShipping"]').on("change", function () {
      var url = $(".multi-shipping-checkbox-block form").attr("action");
      var usingMultiShip = this.checked;

      $.ajax({
        url: url,
        type: "post",
        dataType: "json",
        data: { usingMultiShip: usingMultiShip },
        success: function (response) {
          if (response.error) {
            window.location.href = response.redirectUrl;
          } else {
            $("body").trigger("checkout:updateCheckoutView", {
              order: response.order,
              customer: response.customer,
            });

            if ($("#checkout-main").data("customer-type") === "guest") {
              if (baseObj.methods && baseObj.methods.clearShippingForms) {
                baseObj.methods.clearShippingForms(response.order);
              } else {
                clearShippingForms(response.order);
              }
            } else {
              response.order.shipping.forEach(function (shipping) {
                $("input[value=" + shipping.UUID + "]").each(function (
                  formIndex,
                  el
                ) {
                  var form = el.form;
                  if (!form) return;

                  $(form).attr("data-address-mode", "edit");
                  var addressSelectorDropDown = $(form).find(
                    '.addressSelector option[value="ab_' +
                    shipping.matchingAddressId +
                    '"]'
                  );
                  $(addressSelectorDropDown).prop("selected", true);
                  $("input[name$=_isGift]", form).prop("checked", false);
                  $("textarea[name$=_giftMessage]", form).val("");
                  $(form).find(".gift-message").addClass("d-none");
                });
              });
            }

            if (usingMultiShip) {
              $("body").trigger("shipping:selectMultiShipping", {
                data: response,
              });
            } else {
              $("body").trigger("shipping:selectSingleShipping", {
                data: response,
              });
            }
          }

          $.spinner().stop();
        },
        error: function () {
          $.spinner().stop();
        },
      });
    });
  },

  selectSingleShipping: function () {
    $("body").on("shipping:selectSingleShipping", function () {
      $(".single-shipping .shipping-address").removeClass("d-none");
    });
  },

  selectMultiShipping: function () {
    var baseObj = this;

    $("body").on("shipping:selectMultiShipping", function (e, data) {
      $(".multi-shipping .shipping-address").addClass("d-none");

      data.data.order.shipping.forEach(function (shipping) {
        var element = $(
          '.multi-shipping .card[data-shipment-uuid="' + shipping.UUID + '"]'
        );

        if (shipping.shippingAddress) {
          if (baseObj.methods && baseObj.methods.viewMultishipAddress) {
            baseObj.methods.viewMultishipAddress($(element));
          } else {
            viewMultishipAddress($(element));
          }
        } else {
          /* eslint-disable no-lonely-if */
          if (baseObj.methods && baseObj.methods.enterMultishipView) {
            baseObj.methods.enterMultishipView($(element));
          } else {
            enterMultishipView($(element));
          }
          /* eslint-enable no-lonely-if */
        }
      });
    });
  },

  selectSingleShipAddress: function () {
    $(".single-shipping .addressSelector").on("change", function () {
      var form = $(this).parents("form")[0];
      var selectedOption = $("input:checked", this);
      var attrs = selectedOption.data();
      var shipmentUUID = selectedOption[0].value;
      var originalUUID = $("input[name=shipmentUUID]", form).val();
      var element;

      Object.keys(attrs).forEach(function (attr) {
        element = attr === "countryCode" ? "country" : attr;
        $("[name$=" + element + "]", form).val(attrs[attr]);

        if (element == "stateCode") {
          // Replace with empty string if value is null
          var stateVal =
            $("[name$=" + element + "]", form).val() !== null
              ? $("[name$=" + element + "]", form).val()
              : "";
          $("[name$=" + element + "]", form).val(stateVal);
          setMunicipios(stateVal);
        }
      });

      if (shipmentUUID === "new") {
        $(form).attr("data-address-mode", "new");
        fillStateAndCity();
      } else if (shipmentUUID === originalUUID) {
        $(form).attr("data-address-mode", "shipment");
      } else if (shipmentUUID.indexOf("ab_") === 0) {
        $(form).attr("data-address-mode", "customer");
      } else {
        $(form).attr("data-address-mode", "edit");
      }

      $(document).find("#confirm-address").attr("disabled", false);
    });

    setMunicipios($(".shippingState").val());

    $(document).on("change", ".shippingState", function () {
      setMunicipios($(this).val());
    });
  },

  selectMultiShipAddress: function () {
    var baseObj = this;

    $(".multi-shipping .addressSelector").on("change", function () {
      var form = $(this).closest("form");
      var selectedOption = $("option:selected", this);
      var attrs = selectedOption.data();
      var shipmentUUID = selectedOption[0].value;
      var originalUUID = $("input[name=shipmentUUID]", form).val();
      var pliUUID = $("input[name=productLineItemUUID]", form).val();
      var createNewShipmentScoped =
        baseObj.methods && baseObj.methods.createNewShipment
          ? baseObj.methods.createNewShipment
          : createNewShipment;

      var element;
      Object.keys(attrs).forEach(function (attr) {
        if (attr === "isGift") {
          $("[name$=" + attr + "]", form).prop("checked", attrs[attr]);
          $("[name$=" + attr + "]", form).trigger("change");
        } else {
          element = attr === "countryCode" ? "country" : attr;
          $("[name$=" + element + "]", form).val(attrs[attr]);
        }
      });

      if (shipmentUUID === "new" && pliUUID) {
        var createShipmentUrl = $(this).attr("data-create-shipment-url");
        createNewShipmentScoped(createShipmentUrl, {
          productLineItemUUID: pliUUID,
        })
          .done(function (response) {
            $.spinner().stop();
            if (response.error) {
              if (response.redirectUrl) {
                window.location.href = response.redirectUrl;
              }
              return;
            }

            $("body").trigger("checkout:updateCheckoutView", {
              order: response.order,
              customer: response.customer,
              options: { keepOpen: true },
            });

            $(form).attr("data-address-mode", "new");
          })
          .fail(function () {
            $.spinner().stop();
          });
      } else if (shipmentUUID === originalUUID) {
        $("select[name$=stateCode]", form).trigger("change");
        $(form).attr("data-address-mode", "shipment");
      } else if (shipmentUUID.indexOf("ab_") === 0) {
        var url = $(form).attr("action");
        var serializedData = $(form).serialize();
        createNewShipmentScoped(url, serializedData)
          .done(function (response) {
            $.spinner().stop();
            if (response.error) {
              if (response.redirectUrl) {
                window.location.href = response.redirectUrl;
              }
              return;
            }

            $("body").trigger("checkout:updateCheckoutView", {
              order: response.order,
              customer: response.customer,
              options: { keepOpen: true },
            });

            $(form).attr("data-address-mode", "customer");
            var $rootEl = $(form).closest(".shipping-content");
            editMultiShipAddress($rootEl);
          })
          .fail(function () {
            $.spinner().stop();
          });
      } else {
        var updatePLIShipmentUrl = $(form).attr("action");
        var serializedAddress = $(form).serialize();
        createNewShipmentScoped(updatePLIShipmentUrl, serializedAddress)
          .done(function (response) {
            $.spinner().stop();
            if (response.error) {
              if (response.redirectUrl) {
                window.location.href = response.redirectUrl;
              }
              return;
            }

            $("body").trigger("checkout:updateCheckoutView", {
              order: response.order,
              customer: response.customer,
              options: { keepOpen: true },
            });

            $(form).attr("data-address-mode", "edit");
          })
          .fail(function () {
            $.spinner().stop();
          });
      }
    });
  },

  /**
   * Uploads a prescription.
   */
  uploadPrescription: function () {
    $("body").on("change", ".js-prescription-valid-to-all", function () {
      var $form = $(this);
      var url = $form.data("apply-to-all");
      var csrf = $("[name=csrf_token]").val();
      var result = validateApplyAllCheckbox();
      var pid = result.firstApplied.data("pid");
      var isApplyToAllCheckboxChecked = $(
        ".js-prescription-valid-to-all:visible"
      ).is(":checked");

      $.ajax({
        url: url,
        method: "POST",
        data: {
          pid: pid,
          csrf_token: csrf,
        },
        success: function (data) {
          if (data.success) {
            for (var i in result.toApply) {
              var $parent = result.toApply[i];
              $parent
                .find("button")
                .attr("disabled", isApplyToAllCheckboxChecked);
            }
            displayApplyToAllPrescriptions();
          }
          $form.spinner().stop();
        },
        error: function () {
          $form.spinner().stop();
        },
      });
    });

    $("body").on("click", ".js-prescription-upload", function (event) {
      event.preventDefault();
      var $this = $(this);
      var $parent = $this.closest(".js-prescription-form");

      handleUploadClick($parent, $this);
    });

    $("body").on("change", ".js-prescription-file", function () {
      var $this = $(this);
      if ($this.val()) {
        var $parent = $this.closest(".js-prescription-form");
        handleUploadClick($parent, $parent.find(".js-prescription-upload"));
      }
    });

    $("body").on("click", ".js-exclude-prescription", function () {
      var $form = $(this).closest(".js-prescription-form");
      var url = $form.data("delete");
      var pid = $form.data("pid");
      var csrf = $("[name=csrf_token]").val();
      var $uploadBtnList = $form
        .closest(".prescription-block")
        .find("button.js-prescription-upload");
      var $applyToAllCheckbox = $(".js-prescription-valid-to-all:visible");
      var isApplyToAllCheckboxChecked = $applyToAllCheckbox.is(":checked");
      var isWontUploadCheckboxChecked = $(".noreceipt-input").is(":checked");

      // A product line item can have two tiles: one for home delivery and one for store pickup;
      var $allTilesOfSamePLI = $(
        '.js-prescription-form[data-pid="' + pid + '"]'
      );

      $form.spinner().start();
      $.ajax({
        url: url,
        method: "POST",
        data: {
          pid: pid,
          csrf_token: csrf,
        },
        success: function (data) {
          if (data.success) {
            $allTilesOfSamePLI.find(".js-prescription-file").val("");
            $allTilesOfSamePLI.find(".js-prescription-file-name").text("");
            $allTilesOfSamePLI
              .find(".js-prescription-file-name-container")
              .addClass("d-none");
            $allTilesOfSamePLI
              .find(".js-prescription-upload")
              .removeClass("d-none");

            var isAnyPrescriptionUploaded =
              $(".js-prescription-file-name-container:visible").length > 0;

            if (!isAnyPrescriptionUploaded) {
              $(".prescription-noreceipt").removeClass("d-none");
            }

            $allTilesOfSamePLI.data("image-name", "");
            displayApplyToAllPrescriptions();

            if (isApplyToAllCheckboxChecked) {
              $applyToAllCheckbox.prop("checked", false);
              $uploadBtnList.each(function () {
                $(this).prop("disabled", false);
              });
            }

            if (!isWontUploadCheckboxChecked) {
              $allTilesOfSamePLI
                .find(".js-prescription-upload")
                .removeAttr("disabled");
              $("body").trigger(
                "checkout:disableButton",
                ".next-step-button .submit-shipping"
              );
            }
          }
          $form.spinner().stop();
        },
        error: function () {
          $form.spinner().stop();
        },
      });
    });

    $("body").on("change", ".noreceipt-input", function (ev) {
      var isWontUploadCheckboxChecked = $(ev.currentTarget).is(":checked");
      var uploadBtnList = $("button.js-prescription-upload");

      if (isWontUploadCheckboxChecked) {
        $(".js-exclude-prescription").trigger("click");
        uploadBtnList.attr("disabled", true);
      } else {
        $("body").trigger(
          "checkout:disableButton",
          ".next-step-button .submit-shipping"
        );
        uploadBtnList.prop("disabled", false);
      }
    });
  },

  updateDataAddressMode: function () {
    $("body").on("shipping:updateDataAddressMode", function (e, data) {
      $(data.form).attr("data-address-mode", data.mode);
    });
  },

  enterMultiShipInfo: function () {
    var baseObj = this;

    $(".btn-enter-multi-ship").on("click", function (e) {
      e.preventDefault();

      if (baseObj.methods && baseObj.methods.editOrEnterMultiShipInfo) {
        baseObj.methods.editOrEnterMultiShipInfo($(this), "new");
      } else {
        editOrEnterMultiShipInfo($(this), "new");
      }
    });
  },

  editMultiShipInfo: function () {
    var baseObj = this;

    $(".btn-edit-multi-ship").on("click", function (e) {
      e.preventDefault();

      if (baseObj.methods && baseObj.methods.editOrEnterMultiShipInfo) {
        baseObj.methods.editOrEnterMultiShipInfo($(this), "edit");
      } else {
        editOrEnterMultiShipInfo($(this), "edit");
      }
    });
  },

  saveMultiShipInfo: function () {
    var baseObj = this;

    $(".btn-save-multi-ship").on("click", function (e) {
      e.preventDefault();

      // Save address to checkoutAddressBook
      var form = $(this).closest("form");
      var $rootEl = $(this).closest(".shipping-content");
      var data = $(form).serialize();
      var url = $(form).attr("action");

      $rootEl.spinner().start();
      $.ajax({
        url: url,
        type: "post",
        dataType: "json",
        data: data,
      })
        .done(function (response) {
          formHelpers.clearPreviousErrors(form);
          if (response.error) {
            if (response.fieldErrors && response.fieldErrors.length) {
              response.fieldErrors.forEach(function (error) {
                if (Object.keys(error).length) {
                  formHelpers.loadFormErrors(form, error);
                }
              });
            } else if (response.serverErrors && response.serverErrors.length) {
              $.each(response.serverErrors, function (index, element) {
                createErrorNotification(element);
              });
            }
          } else {
            // Update UI from response
            $("body").trigger("checkout:updateCheckoutView", {
              order: response.order,
              customer: response.customer,
            });

            if (baseObj.methods && baseObj.methods.viewMultishipAddress) {
              baseObj.methods.viewMultishipAddress($rootEl);
            } else {
              viewMultishipAddress($rootEl);
            }
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

      return false;
    });
  },

  cancelMultiShipAddress: function () {
    var baseObj = this;

    $(".btn-cancel-multi-ship-address").on("click", function (e) {
      e.preventDefault();

      var form = $(this).closest("form");
      var $rootEl = $(this).closest(".shipping-content");
      var restoreState = $rootEl.data("saved-state");

      // Should clear out changes / restore previous state
      if (restoreState) {
        var restoreStateObj = JSON.parse(restoreState);
        var originalStateCode = restoreStateObj.shippingAddress.stateCode;
        var stateCode = $("[name$=_stateCode]", form).val();

        if (
          baseObj.methods &&
          baseObj.methods.updateShippingAddressFormValues
        ) {
          baseObj.methods.updateShippingAddressFormValues(restoreStateObj);
        } else {
          updateShippingAddressFormValues(restoreStateObj);
        }

        if (stateCode !== originalStateCode) {
          $("[data-action=save]", form).trigger("click");
        } else {
          $(form).attr("data-address-mode", "edit");
          if (baseObj.methods && baseObj.methods.editMultiShipAddress) {
            baseObj.methods.editMultiShipAddress($rootEl);
          } else {
            editMultiShipAddress($rootEl);
          }
        }
      }

      return false;
    });
  },

  isGift: function () {
    $(".gift").on("change", function (e) {
      e.preventDefault();
      var form = $(this).closest("form");

      if (this.checked) {
        $(form).find(".gift-message").removeClass("d-none");
      } else {
        $(form).find(".gift-message").addClass("d-none");
        $(form).find(".gift-message").val("");
      }
    });
  },
};
