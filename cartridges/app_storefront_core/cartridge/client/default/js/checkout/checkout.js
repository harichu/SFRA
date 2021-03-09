"use strict";

var addressHelpers = require("./address");
var shippingHelpers = require("./shipping");
var billingHelpers = require("./billing");
var summaryHelpers = require("./summary");
var formHelpers = require("./formErrors");
var scrollAnimate = require("../components/scrollAnimate");
var formValidation = require("../components/formValidation");
var login = require("../login/login");

function initMercadoPago() {
  if (window.MP) {
    var MercadoPago = window.MP;
    new MercadoPago().init();
    delete window.MP;
  }
}
/**
 * Displays a modal popup with the out of stock products, so that the customer can remove them from the cart.
 * @param {Object} data An object containing a redirection URL for when out of stock products have been removed, as well as the products themselves.
 * @param {String} data.outOfStockRedirectUrl The URL to redirect to, once the out of stock products have been removed from the cart.
 * @param {Array.<Object>} data.productsOutOfStock The products that are out of stock.
 */
function showOutOfStockModal(data) {
  var outOfStockProducts = data.productsOutOfStock;
  console.log("Probando JS del cliente outOfStockProducts");
  console.log("outOfStockProducts:");
  console.log(outOfStockProducts);

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
    var $shortDescription = $('<span class="line-item-name"></span>');
    $shortDescription.html(product.description);
    var $quantity = $('<span class="line-item-pricing-info">teeest</span>');
    $quantity.html(product.displayQuantity);
    var $test2 = $('<span class="line-item-name"></span>');
    $test2.html(product.displayQuantity);
    var $testText = $(
      '<span class="line-item-pricing-info">Esto es una prueba</span>'
    );

    $productDescription.append($productBrand);
    $productDescription.append($shortDescription);
    $productDescription.append($quantity);
    $productDescription.append($test2);
    $productDescription.append($testText);
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

  $(".js-field-error-message").html(errorHtml);
  scrollAnimate($(".js-field-error-message"));
}

/**
 * Validates the form fields.
 * @param {Object} $form The form to validate.
 */
function validateFields($form) {
  $.ajax({
    url: $form.data("validation-url"),
    type: "post",
    dataType: "json",
    data: $form.serialize(),
    success: function (response) {
      formValidation($form, response);
    },
  });
}

/**
 * Appends a parameter to a URL.
 * @param {String} url The URL to modify.
 * @param {String} name The name of the parameter.
 * @param {String} value The value of the parameter.
 * @return {String} A new URL, with the input parameter.
 */
function appendParamToURL(url, name, value) {
  // quit if the param already exists
  if (url.indexOf(name + "=") !== -1) {
    return url;
  }
  var separator = url.indexOf("?") !== -1 ? "&" : "?";
  return url + separator + name + "=" + encodeURIComponent(value);
}

/**
 * Verifies that the user has accepted the terms of agreement.
 * @return {Boolean} Whether terms of acceptance have been agreed to.
 */

function isTermsAccepted() {
  var $termsCheckbox = $("#termsAndConditions");
  var $termsErrorMessage = $("#accept-terms-error");

  if ($termsCheckbox.length) {
    if ($termsErrorMessage.length) {
      $termsErrorMessage.addClass("d-none");
    }

    if (!$termsCheckbox.is(":checked")) {
      $termsErrorMessage.removeClass("d-none").addClass("show");
      return false;
    }
  }

  return true;
}

/**
 * Verifies that a receipt is valid.
 * @return {Boolean} Whether the receipt is valid.
 */

function isReceiptValid() {
  var $receiptCheckbox = $("#receipt-checkbox");
  var $receiptErrorMessage = $("#receipt-error");

  if ($receiptCheckbox.length) {
    if ($receiptErrorMessage.length) {
      $receiptErrorMessage.addClass("d-none");
    }

    if (!$receiptCheckbox.is(":checked")) {
      $receiptErrorMessage.removeClass("d-none").addClass("show");
      return false;
    }
  }

  return true;
}

/**
 * Adds guest data to an MP object.
 * @param {Object} data the guest data to add.
 */

function updateMercadoPagoWithGuestData(data) {
  if (data && data.guestData && data.guestData.document) {
    var guestDocType = data.guestData.document.split(".").join("");
    var guestDocNumber = data.guestData.number;
    var $marcadoPagoDocType = $("#docType");
    var $marcadoPagoDocNumber = $("#docNumber");

    $marcadoPagoDocNumber.val(guestDocNumber.replace(/\./g, ""));

    if (guestDocType === "CE" || guestDocType === "CC") {
      $marcadoPagoDocType.val(guestDocType);
    } else if (guestDocType === "RUT") {
      $marcadoPagoDocType.val(guestDocType);
    } else {
      $marcadoPagoDocType.val("Otro");
    }
  }
}

/**
 * Checks whether the user is using IE.
 * @return {Boolean} Whether the user is using IE.
 */
function isInternetExplorer() {
  return /*@cc_on!@*/ false || !!document.documentMode; // NOSONAR
}

/**
 * Update the checkout steps to reflect the active step.
 * @param {string} currentStage The active stage.
 */
function updateProgressBar(currentStage) {
  $(document).find(".checkout-step").removeClass("completed");
  var currentStep = $(".checkout-step-" + currentStage);
  currentStep.prevAll().addClass("completed");
  $(".checkout-title-small").addClass("d-none");
  $(".checkout-title-" + currentStage).removeClass("d-none");
}

/**
 * Update the payment methods elements
 */
function paymentTabNavigation() {
  var methodID = $(".nav-link.active").parent().data("method-id");
  $(".payment-information").data("payment-method-id", methodID);

  // Trigger click on Mercado Pago tab to enable the Mercado Pago events
  if ($(".payment-option-tabs .nav-link").length == 1) {
    $(".nav-link.active").trigger("click");
  }

  $(document).on("click", ".credit-card-payment", function () {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "clickPaymentMethod",
      action: "creditcard",
      label: "PaymentMethodID",
    });
  });

  // Add class to reflect selected payment inout
  $(document).on(
    "change",
    "input.mp__card-input.custom-control-input",
    function () {
      $(".mp__card-input").parents(".custom-radio").removeClass("active");
      $(this).parents(".custom-radio").addClass("active");
      $(".mercado-pago-form").collapse("hide");
    }
  );

  $(document).on("show.bs.collapse", ".mercado-pago-form", function () {
    $(".mp__card-input").parents(".custom-radio").removeClass("active");

    if ($(".selected-payment").length) {
      var savedPaymentId = $(".selected-payment").data("mp-method-id");
      $(this)
        .siblings(".payment-collapse-title")
        .find("#cardType-" + savedPaymentId)
        .prop("checked", true)
        .trigger("change");
      $(".add-payment-method-button")
        .data("togglePaymentType", "stored")
        .click();
    } else {
      $(this)
        .siblings(".payment-collapse-title")
        .find(".mp__card-input")
        .first()
        .prop("checked", true)
        .trigger("change");
    }
  });

  // Stop child collapse element from triggering collapse event on parent
  $(document).on("show.bs.collapse", ".saved-payments-expand", function (e) {
    e.stopPropagation();
  });

  $(document).on("click", ".save-payment-button", function (e) {
    e.preventDefault();
    $(document).find(".submit-payment").trigger("click");
  });
}

/**
 * Create the jQuery Checkout Plugin.
 *
 * This jQuery plugin will be registered on the dom element in checkout.isml with the
 * id of "checkout-main".
 *
 * The checkout plugin will handle the different state the user interface is in as the user
 * progresses through the varying forms such as shipping and payment.
 *
 * Billing info and payment info are used a bit synonymously in this code.
 *
 */
(function ($) {
  $.fn.checkout = function () {
    // eslint-disable-line
    var plugin = this;

    //
    // Collect form data from user input
    //
    var formData = {
      // Shipping Address
      shipping: {},

      // Billing Address
      billing: {},

      // Payment
      payment: {},

      // Gift Codes
      giftCode: {},
    };

    //
    // The different states/stages of checkout
    //
    var checkoutStages = ["shipping", "payment", "placeOrder", "submitted"];

    /**
     * Updates the URL to determine stage
     * @param {number} currentStage - The current stage the user is currently on in the checkout
     */
    function updateUrl(currentStage) {
      history.pushState(
        checkoutStages[currentStage],
        document.title,
        location.pathname +
          "?stage=" +
          checkoutStages[currentStage] +
          "#" +
          checkoutStages[currentStage]
      );
    }

    //
    // Local member methods of the Checkout plugin
    //
    var members = {
      // initialize the currentStage variable for the first time
      currentStage: 0,

      /**
       * Set or update the checkout stage (AKA the shipping, billing, payment, etc... steps)
       * @returns {Object} a promise
       */
      updateStage: function () {
        var stage = checkoutStages[members.currentStage];
        var defer = $.Deferred(); // eslint-disable-line

        if (stage === "shipping") {
          //
          // Clear Previous Errors
          //
          formHelpers.clearPreviousErrors(".shipping-form");

          initMercadoPago();

          //
          // Submit the Shipping Address Form
          //
          var isMultiShip = $("#checkout-main").hasClass("multi-ship");
          var formSelector = isMultiShip
            ? ".multi-shipping .active form"
            : ".single-shipping .shipping-form";
          var form = $(formSelector);

          if (isMultiShip && form.length === 0) {
            // disable the next:Payment button here
            $("body").trigger(
              "checkout:disableButton",
              ".next-step-button button"
            );
            // in case the multi ship form is already submitted
            var url = $("#checkout-main").attr("data-checkout-get-url");
            $.ajax({
              url: url,
              method: "GET",
              success: function (data) {
                // enable the next:Payment button here
                $("body").trigger(
                  "checkout:enableButton",
                  ".next-step-button button"
                );
                if (!data.error) {
                  $("body").trigger("checkout:updateCheckoutView", {
                    order: data.order,
                    customer: data.customer,
                  });
                  defer.resolve();
                } else if ($(".shipping-error .alert-danger").length < 1) {
                  var errorMsg = data.message;
                  var errorHtml =
                    '<div class="alert alert-danger alert-dismissible valid-cart-error ' +
                    'fade show" role="alert">' +
                    '<button type="button" class="close" data-dismiss="alert" aria-label="Close">' +
                    '<span aria-hidden="true">&times;</span>' +
                    "</button>" +
                    errorMsg +
                    "</div>";
                  $(".shipping-error").append(errorHtml);
                  scrollAnimate($(".shipping-error"));
                  defer.reject();
                }
              },
              error: function () {
                // enable the next:Payment button here
                $("body").trigger(
                  "checkout:enableButton",
                  ".next-step-button button"
                );
                // Server error submitting form
                defer.reject();
              },
            });
          } else {
            setStoreAddressData(form);
            var shippingFormData = form.serialize();

            $("body").trigger("checkout:serializeShipping", {
              form: form,
              data: shippingFormData,
              callback: function (data) {
                shippingFormData = data;
              },
            });
            // disable the next:Payment button here
            $("body").trigger(
              "checkout:disableButton",
              ".next-step-button button"
            );
            $.ajax({
              url: form.attr("action"),
              type: "post",
              data: shippingFormData,
              success: function (data) {
                var outOfStockProducts = data.productsOutOfStock;
                if (outOfStockProducts && outOfStockProducts.length > 0) {
                  showOutOfStockModal(data);
                } else {
                  $("body").trigger(
                    "checkout:enableButton",
                    ".next-step-button button"
                  );
                  shippingHelpers.methods.shippingFormResponse(defer, data);
                  updateMercadoPagoWithGuestData(data);
                }
              },
              error: function (err) {
                // enable the next:Payment button here
                $("body").trigger(
                  "checkout:enableButton",
                  ".next-step-button button"
                );
                if (err.responseJSON) {
                  if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                  } else if (err.responseJSON.fields) {
                    formValidation($(form), {
                      fields: err.responseJSON.fields,
                    });
                  }
                }
                // Server error submitting form
                defer.reject(err.responseJSON);
              },
            });
          }
          return defer;
        } else if (stage === "payment") {
          //
          // Submit the Billing Address Form
          //

          formHelpers.clearPreviousErrors(".payment-form");

          var billingAddressForm = $(
            "#dwfrm_billing .billing-address-block"
          ).serialize();

          $("body").trigger("checkout:serializeBilling", {
            form: $("#dwfrm_billing .billing-address-block"),
            data: billingAddressForm,
            callback: function (data) {
              if (data) {
                billingAddressForm = data;
              }
            },
          });

          var contactInfoForm = $(
            "#dwfrm_billing .contact-info-block"
          ).serialize();

          $("body").trigger("checkout:serializeBilling", {
            form: $("#dwfrm_billing .contact-info-block"),
            data: contactInfoForm,
            callback: function (data) {
              if (data) {
                contactInfoForm = data;
              }
            },
          });

          var activeTabId = $(".tab-pane.active").attr("id");
          var paymentInfoSelector =
            "#dwfrm_billing ." + activeTabId + " .payment-form-fields";
          var paymentInfoForm = $(paymentInfoSelector).serialize();

          $("body").trigger("checkout:serializeBilling", {
            form: $(paymentInfoSelector),
            data: paymentInfoForm,
            callback: function (data) {
              if (data) {
                paymentInfoForm = data;
              }
            },
          });

          var paymentForm =
            billingAddressForm + "&" + contactInfoForm + "&" + paymentInfoForm;
          if (isInternetExplorer()) {
            paymentForm = $(
              ".payment-form-container input, select"
            ).serialize();
          }

          var arePseFieldsValid = true;
          var pseFieldsWithError = [];
          var $paymentForm = $("#dwfrm_billing");
          var $pseBank = $paymentForm.find("select[name$='pseBankID']");
          var $pseDocType = $paymentForm.find("select[name$='pseDocType']");
          var $pseDocNumber = $paymentForm.find("input[name$='pseDocNumber']");
          var selectedPaymentTypeID = $paymentForm
            .find(
              "input[name='dwfrm_billing_mercadoPagoCreditCard_cardType']:checked"
            )
            .val();
          if (selectedPaymentTypeID == "pse") {
            pseFieldsWithError = [$pseBank, $pseDocType, $pseDocNumber].filter(
              function ($ele) {
                $ele.trigger("focusout");
                var isInvalid = $ele.val() == "" || $ele.hasClass("is-invalid");
                arePseFieldsValid = arePseFieldsValid && !isInvalid;
                return isInvalid;
              }
            );
          }
          if (!arePseFieldsValid) {
            scrollAnimate(pseFieldsWithError[0]);
            defer.reject();
            return defer;
          }

          //Saved credit card case handling
          if (
            $(".data-checkout-stage").data("customer-type") === "registered" &&
            !$("[data-mp-customer-cards]").hasClass("checkout-hidden")
          ) {
            var $cvvElement = $("[data-mp-security-code]");
            var cvvCode = $cvvElement.val();
            var $savedPaymentInstrument = $(
              ".saved-payment-instrument.selected-payment"
            );

            //Invalidate the CVV field if empty
            if (
              $(
                "[name='dwfrm_billing_mercadoPagoCreditCard_cardType']:checked"
              ).data("is-card") &&
              cvvCode === ""
            ) {
              $cvvElement
                .addClass("is-invalid")
                .siblings(".invalid-feedback")
                .show()
                .html($cvvElement.data("parse-error"));
              scrollAnimate($cvvElement);
              defer.reject();
              return defer;
            }

            //Send expiration date information from saved credit card
            paymentForm +=
              "&dwfrm_billing_mercadoPagoCreditCard_expirationYear=" +
              $savedPaymentInstrument.data("mp-expiration-year");

            paymentForm +=
              "&dwfrm_billing_mercadoPagoCreditCard_expirationMonth=" +
              $savedPaymentInstrument.data("mp-expiration-month");

            if (!$("#is-mercado-pago-enabled").is(":checked")) {
              if ($savedPaymentInstrument.data("uuid")) {
                paymentForm +=
                  "&storedPaymentUUID=" + $savedPaymentInstrument.data("uuid");
              }

              if (cvvCode) {
                paymentForm += "&securityCode=" + cvvCode;
              }
            }
          }

          paymentForm +=
            "&dwfrm_billing_mercadoPagoCreditCard_isCreditCard=" +
            $(
              '[name="dwfrm_billing_mercadoPagoCreditCard_cardType"]:checked'
            ).data("is-card");

          if (!isTermsAccepted() || !isReceiptValid()) {
            return defer;
          }

          // disable the next:Place Order button here
          $("body").trigger(
            "checkout:disableButton",
            ".next-step-button button"
          );
          $.ajax({
            url: $("#dwfrm_billing").attr("action"),
            method: "POST",
            data: paymentForm,
            success: function (data) {
              // look for field validation errors
              if (data.error) {
                if (data.fieldErrors.length) {
                  data.fieldErrors.forEach(function (error) {
                    if (
                      Object.keys(error).length &&
                      $("." + Object.keys(error))
                        .parents(".card")
                        .hasClass(".payment-form")
                    ) {
                      formHelpers.loadFormErrors(".payment-form", error);
                    } else {
                      $.each(Object.values(error), function (i, e) {
                        createErrorNotification(e);
                      });
                    }
                  });
                }

                if (data.serverErrors.length) {
                  data.serverErrors.forEach(function (error) {
                    $(".error-message").removeClass("d-none");
                    $(".error-message-text").text(error);
                    scrollAnimate($(".error-message"));
                  });
                }

                if (data.cartError) {
                  window.location.href = data.redirectUrl;
                }

                defer.reject();
              } else {
                $.ajax({
                  url: $(".place-order").data("action"),
                  method: "POST",
                  success: function (dataPlace) {
                    if (dataPlace.error) {
                      var outOfStockProducts = dataPlace.productsOutOfStock;
                      if (outOfStockProducts && outOfStockProducts.length > 0) {
                        showOutOfStockModal(dataPlace);
                      } else if (dataPlace.cartError) {
                        window.location.href = dataPlace.redirectUrl;
                        defer.reject();
                      } else {
                        // go to appropriate stage and display error message
                        defer.reject(dataPlace);
                      }
                    } else {
                      var continueUrl = dataPlace.continueUrl;
                      var urlParams = {
                        ID: dataPlace.orderID,
                        token: dataPlace.orderToken,
                      };

                      continueUrl +=
                        (continueUrl.indexOf("?") !== -1 ? "&" : "?") +
                        Object.keys(urlParams)
                          .map(function (key) {
                            return (
                              key + "=" + encodeURIComponent(urlParams[key])
                            );
                          })
                          .join("&");
                      if (dataPlace.newTab) {
                        window.open(continueUrl, "_blank");
                      }
                      window.location.href = continueUrl;
                    }
                    // enable the placeOrder button here
                    $("body").trigger(
                      "checkout:enableButton",
                      ".next-step-button button"
                    );
                  },
                  error: function () {
                    // enable the placeOrder button here
                    $("body").trigger(
                      "checkout:enableButton",
                      $(".next-step-button button")
                    );
                  },
                });
              }
            },
            error: function (err) {
              // enable the next:Place Order button here
              $("body").trigger(
                "checkout:enableButton",
                ".next-step-button button"
              );
              if (err.responseJSON && err.responseJSON.redirectUrl) {
                window.location.href = err.responseJSON.redirectUrl;
              }
            },
          });

          return defer;
        }
        var p = $("<div>").promise(); // eslint-disable-line
        setTimeout(function () {
          p.done(); // eslint-disable-line
        }, 500);
        return p; // eslint-disable-line
      },

      /**
       * Initialize the checkout stage.
       *
       * TODO: update this to allow stage to be set from server?
       */
      initialize: function () {
        // set the initial state of checkout
        members.currentStage = checkoutStages.indexOf(
          $(".data-checkout-stage").data("checkout-stage")
        );
        $(plugin).attr(
          "data-checkout-stage",
          checkoutStages[members.currentStage]
        );

        if (checkoutStages[members.currentStage] === "payment") {
          var processInclude = require("jsfarmacias/util");
          processInclude(require("jsMP/checkout/mercadoPago"));
          initMercadoPago();
        }

        //
        // Handle Payment option selection
        //
        $('input[name$="paymentMethod"]', plugin).on("change", function () {
          $(".credit-card-form").toggle($(this).val() === "CREDIT_CARD");
        });

        //
        // Handle Next State button click
        //
        $(plugin).on("click", ".next-step-button button", function () {
          members.nextStage();
        });

        //
        // Handle Edit buttons on shipping and payment summary cards
        //
        $(".shipping-summary .edit-button", plugin).on("click", function () {
          if (!$("#checkout-main").hasClass("multi-ship")) {
            $("body").trigger("shipping:selectSingleShipping");
          }
          $(this)
            .parents(".pickup-in-store-block")
            .attr("data-pickup-option", "results");
          members.gotoStage("shipping");
        });

        $(".payment-summary .edit-button", plugin).on("click", function () {
          members.gotoStage("payment");
        });

        //
        // remember stage (e.g. shipping)
        //
        updateUrl(members.currentStage);

        //
        // Listen for foward/back button press and move to correct checkout-stage
        //
        $(window).on("popstate", function (e) {
          //
          // Back button when event state less than current state in ordered
          // checkoutStages array.
          //
          if (
            e.state === null ||
            checkoutStages.indexOf(e.state) < members.currentStage
          ) {
            members.handlePrevStage(false);
          } else if (checkoutStages.indexOf(e.state) > members.currentStage) {
            // Forward button  pressed
            members.handleNextStage(false);
          }
        });

        //
        // Set the form data
        //
        plugin.data("formData", formData);
      },

      /**
       * The next checkout state step updates the css for showing correct buttons etc...
       */
      nextStage: function () {
        var promise = members.updateStage();

        promise.done(function () {
          // Update UI with new stage
          members.handleNextStage(true);
        });

        promise.fail(function (data) {
          // show errors
          if (data) {
            if (data.errorStage) {
              members.gotoStage(data.errorStage.stage);

              if (data.errorStage.step === "billingAddress") {
                var $billingAddressSameAsShipping = $(
                  'input[name$="_shippingAddressUseAsBillingAddress"]'
                );
                if ($billingAddressSameAsShipping.is(":checked")) {
                  $billingAddressSameAsShipping.prop("checked", false);
                }
              }
            }

            if (data.errorMessage && data.authError) {
              var url = appendParamToURL(
                window.location.origin + window.location.pathname,
                "stage",
                "payment"
              );
              $(".error-message").removeClass("d-none");
              $(".error-message-text").text(data.errorMessage);
              window.location.href = appendParamToURL(url, "authError", true);
            } else if (data.errorMessage) {
              $(".error-message").removeClass("d-none");
              $(".error-message-text").text(data.errorMessage);
            }
          }
        });
      },

      /**
       * The next checkout state step updates the css for showing correct buttons etc...
       *
       * @param {boolean} bPushState - boolean when true pushes state using the history api.
       */
      handleNextStage: function (bPushState) {
        if (members.currentStage < checkoutStages.length - 1) {
          // move stage forward
          members.currentStage++;

          //
          // show new stage in url (e.g.payment)
          //
          if (bPushState) {
            updateUrl(members.currentStage);
          }
        }

        // Set the next stage on the DOM
        $(plugin).attr(
          "data-checkout-stage",
          checkoutStages[members.currentStage]
        );

        updateProgressBar(checkoutStages[members.currentStage]);
      },

      /**
       * Previous State
       */
      handlePrevStage: function () {
        if (members.currentStage > 0) {
          // move state back
          members.currentStage--;
          updateUrl(members.currentStage);
        }

        $(plugin).attr(
          "data-checkout-stage",
          checkoutStages[members.currentStage]
        );

        updateProgressBar(checkoutStages[members.currentStage]);
      },

      /**
       * Use window history to go to a checkout stage
       * @param {string} stageName - the checkout state to goto
       */
      gotoStage: function (stageName) {
        members.currentStage = checkoutStages.indexOf(stageName);
        updateUrl(members.currentStage);
        $(plugin).attr(
          "data-checkout-stage",
          checkoutStages[members.currentStage]
        );

        updateProgressBar(checkoutStages[members.currentStage]);
      },
    };

    //
    // Initialize the checkout
    //
    members.initialize();

    return this;
  };
})(jQuery);

var exports = {
  initialize: function () {
    $("#checkout-main").checkout();
    if ($("#modal-facebook").length > 0) {
      $("#modal-facebook").removeClass("d-sm-none");
      $("#modal-facebook").modal();
    }

    var $marcadoPagoDocNumber = $("#docNumber");
    if ($marcadoPagoDocNumber.val()) {
      $marcadoPagoDocNumber.val($marcadoPagoDocNumber.val().replace(/\./g, ""));
    }

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "showCheckout",
      label: window.location.href,
    });

    paymentTabNavigation();

    login.handlePhonePrefix();

    login.handleRutMask();

    $(document).on("change", "#pse-document-type", function () {
      var numberField = $("#pse-document-number");
      var patternError = "";

      // Redefine the error variable when document oprions is changed
      if ($(this).val() === "Otro") {
        patternError = numberField.data("passport-error");
        numberField.data("type", "pasaporte");
      } else if ($(this).val() === "CE") {
        patternError = numberField.data("ce-error");
      } else {
        patternError = numberField.data("cc-error");
      }

      numberField.data("pattern-mismatch", patternError);

      if ($(this).val() === "Otro") {
        numberField.attr("maxlength", 50).attr("pattern", ".{6,50}");
      } else {
        numberField.attr("maxlength", 10).attr("pattern", ".{6,10}");
      }
    });

    $(document).on("submit", "#facebook-registration", function (e) {
      e.preventDefault();
      var $form = $(this);
      var url = $form.attr("action");
      var names = $form.find("#registration-form-fname").val().split(" ");
      var formData = {
        firstName: names[0],
        lastName: $form
          .find("#registration-form-fname")
          .val()
          .replace(names[0], ""),
        email: $form.find("#registration-form-email").val(),
        phone: $form.find("#registration-form-phone").val(),
        document: $form.find("#registration-document").val(),
        rut: $form.find("#registration-form-rut").val(),
        cedula: $form.find("#registration-identification-number").val(),
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
            updateMercadoPagoWithGuestData(data);
            window.location.reload();
          }
        },
        error: function (err) {
          console.log(err);
        },
      });
    });

    shippingHelpers.methods.fillStateAndCity();
  },

  updateCheckoutView: function () {
    $("body").on("checkout:updateCheckoutView", function (e, data) {
      shippingHelpers.methods.updateMultiShipInformation(data.order);
      summaryHelpers.updateTotals(data.order.totals, data.order.shipping);
      data.order.shipping.forEach(function (shipping) {
        shippingHelpers.methods.updateShippingInformation(
          shipping,
          data.order,
          data.customer,
          data.options
        );
      });
      billingHelpers.methods.updateBillingInformation(
        data.order,
        data.customer,
        data.options
      );
      billingHelpers.methods.updatePaymentInformation(data.order, data.options);
      summaryHelpers.updateOrderProductSummaryInformation(
        data.order,
        data.options
      );
    });
  },

  disableButton: function () {
    $("body").on("checkout:disableButton", function (e, button) {
      $(button).prop("disabled", true);
    });
  },

  enableButton: function () {
    $("body").on("checkout:enableButton", function (e, button) {
      $(button).prop("disabled", false);
    });
  },

  validate: function () {
    $("form#facebook-registration:not(.form-control)").submit(function () {
      var $form = $(this);
      validateFields($form);
    });
  },
};

[billingHelpers, shippingHelpers, addressHelpers].forEach(function (library) {
  Object.keys(library).forEach(function (item) {
    if (typeof library[item] === "object") {
      exports[item] = $.extend({}, exports[item], library[item]);
    } else {
      exports[item] = library[item];
    }
  });
});

function setStoreAddressData($form) {
  var isStorePickupSelected = !$(".home-delivery-title").hasClass("active");

  if (isStorePickupSelected) {
    var $selectedStoreSlot = $(".store-result-item.active");
    var selectedState = $("#store-departamentos").val();
    var selectedCity = $("#store-municipios").val();
    var selectedstoreName = $selectedStoreSlot
      .find(".store-name-first")
      .first()
      .text()
      .trim();
    var selectedAddress = $selectedStoreSlot
      .find(".store-address-first")
      .text()
      .trim();
    var storeLatitude = $selectedStoreSlot.find(".latitude").val();
    var storeLongitude = $selectedStoreSlot.find(".longitude").val();

    $(
      "[name='dwfrm_shipping_shippingAddress_shippingMethodID'][data-pickup='true']"
    )
      .first()
      .prop("checked", true);

    $form.find(".shippingAddressId").val(selectedstoreName);
    $form.find(".shippingState").val(selectedState);
    $form.find(".shippingCity").val(selectedCity);
    $form.find(".shippingAddressOne").val(selectedAddress);
    $("#addressLatitude").val(storeLatitude);
    $("#addressLongitude").val(storeLongitude);
  }
}

module.exports = exports;
