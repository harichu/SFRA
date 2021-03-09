"use strict";

(function ($) {
    /**
     * @constructor
     * @classdesc Integration class
     */
    function MercadoPago() {
        var that = this;

        var $content = $("[data-mp-content]");
        var $form = $content.find("[data-mp-form]");

        var $elements = {
            paymentOptionTab: $("[data-payment-option-tab]"),
            paymentTypeButton: $content.find("[data-toggle-payment-type]"),
            customerCardsContainer: $content.find("[data-mp-customer-cards]"),
            customerCard: $content.find("[data-mp-customer-card]")
        };

        // Regular fields
        var fields = {
            cardType: {
                $el: $form.find("[data-mp-card-type]"),
                disable: {other: false, stored: false},
                hide: {other: false, stored: true},
                errors : []
            },
            cardHolder: {
                $el: $form.find("[data-mp-card-holder]"),
                disable: {other: true, stored: true},
                hide: {other: true, stored: true},
                errors : ["221", "316"]
            },
            cardNumber: {
                $el: $form.find("[data-mp-card-number]"),
                disable: {other: true, stored: true},
                hide: {other: true, stored: true},
                errors : ["205", "E301"]
            },
            cardMonth: {
                $el: $form.find("[data-mp-card-month]"),
                disable: {other: true, stored: true},
                hide: {other: true, stored: true},
                errors : ["208", "325"]
            },
            cardYear: {
                $el: $form.find("[data-mp-card-year]"),
                disable: {other: true, stored: true},
                hide: {other: true, stored: true},
                errors : ["209", "326"]
            },
            securityCode: {
                $el: $form.find("[data-mp-security-code]"),
                disable: {other: true, stored: false},
                hide: {other: true, stored: false},
                errors : ["224", "E302", "E203"]
            },
            email: {
                $el: $form.find("[data-mp-email]"),
                disable: {other: false, stored: true},
                hide: {other: false, stored: true},
                errors : ["email"]
            },
            phone: {
                $el: $form.find("[data-mp-phone]"),
                disable: {other: false, stored: true},
                hide: {other: false, stored: true},
                errors : ["phone"]
            },
            saveCard: {
                $el: $form.find("[data-mp-save-card]"),
                disable: {other: true, stored: true},
                hide: {other: false, stored: true},
                errors : []
            },
            useSameMailPhoneAsAddress: {
                $el: $form.find("[data-mp-use-same]"),
                disable: {other: false, stored: true},
                hide: {other: false, stored: true},
                errors : []
            }
        };

        // Extended fields
        fields.issuer = {
            $el: $form.find("[data-mp-issuer]"),
            disable: {other: true, stored: true},
            hide: {other: true, stored: true},
            errors : ["issuer"]
        };
        fields.installments = {
            $el: $form.find("[data-mp-installments]"),
            disable: {other: true, stored: false},
            hide: {other: true, stored: false},
            errors : ["installments"]
        };
        fields.docType = {
            $el: $form.find("[data-mp-doc-type]"),
            disable: {other: false, stored: true},
            hide: {other: false, stored: true},
            errors : ["212", "322"]
        };
        fields.docNumber = {
            $el: $form.find("[data-mp-doc-number]"),
            $wrapper: $form.find("[data-mp-doc-wrapper]"),
            $label: $form.find("[data-mp-doc-label]"),
            $tooltip: $form.find("[data-mp-doc-tooltip]"),
            disable: {other: false, stored: true},
            hide: {other: false, stored: true},
            errors : ["214", "324"]
        };

        // Hidden fields
        Object.defineProperty(fields, "cardId", {
            enumerable: false,
            value: {
                $el: $form.find("[data-mp-card-id]")
            }
        });
        Object.defineProperty(fields, "token", {
            enumerable: false,
            value: {
                $el: $form.find("[data-mp-token]")
            }
        });

        var methods = {
            paymentOption: {
                /**
                 * @function handleChange
                 * @description Handle change of payment method and set initial state of payment tab
                 */
                handleChange: function () {
                    var $activeTab = $(this);
                    var methodId = $activeTab.closest("[data-method-id]").data("methodId");
                    var initialState = $form.data("mpInitial");

                    methodId === that.configuration.paymentMethodId && methods.paymentOption.setInitialState[initialState + "Payment"]();
                },
                setInitialState: {
                    /**
                     * @function newPayment
                     * @description Set initial state for new payment section
                     */
                    newPayment: function () {
                        var paymentMethodInput = fields.cardType.$el.filter(function () {return this.value === that.configuration.defaultCardType;});

                        // Check default card type
                        paymentMethodInput.prop("checked", true);
                        methods.card.handleTypeChange.call(paymentMethodInput[0], {data: {handleOther: true}});
                    },
                    /**
                     * @function storedPayment
                     * @description Set initial state for stored payment section
                     */
                    storedPayment: function () {
                        var firstCard = $elements.customerCard.filter(":first");

                        // Select first card
                        methods.registeredCustomer.selectCustomerCard.call(firstCard[0]);

                        // Toggle payment type to stored
                        $elements.paymentTypeButton.data("togglePaymentType", "stored");
                        methods.registeredCustomer.togglePaymentType.call($elements.paymentTypeButton[0]);
                    },
                    /**
                     * @function restoreStoredPayment
                     * @description Restore stored payment section
                     */
                    restoreStoredPayment: function () {
                        var firstCard = $elements.customerCard.filter(":first");

                        // Select first card
                        methods.registeredCustomer.selectCustomerCard.call(firstCard[0]);

                        // Show and set disabled to false for stored payment fields
                        for (var field in fields) {
                            !fields[field].hide.stored
                                && fields[field].$el.closest("[data-mp-container]").removeClass("checkout-hidden");
                            !fields[field].disable.stored
                                && fields[field].$el.prop("disabled", false);
                        }
                    }
                }
            },

            token: {
                /**
                 * @function populate
                 * @description Create token and populate field with value during submit
                 * @param {Event} event
                 * @param {Object} eventData
                 */
                populate: function (event, eventData) {
                    // Continue default flow
                    if (eventData && eventData.continue) {
                        return;
                    }

                    // Stop default flow
                    event.stopImmediatePropagation();

                    var isOtherPaymentMethod = fields.cardType.$el.filter(":checked").data("mpCardType") === that.configuration.otherPaymentMethod;
                    var isMercadoPago = $("input[name$=\"billing_paymentMethod\"]:enabled").val() === that.configuration.paymentMethodId;
                    if (isOtherPaymentMethod || !isMercadoPago) {
                        fields.token.$el.val("");
                        $(".next-step-button .submit-payment").trigger("click", {continue: true});
                        return;
                    }

                    Mercadopago.clearSession();

                    Mercadopago.createToken($form, function (status, serviceResponse) {
                        var validForm = true;

                        Object.keys(fields).forEach(function (index) {
                            var field = fields[index];
                            if (field.$el.attr("required")
                                && field.$el.is(":visible")
                                && field.$el.is(":enabled")) {
                                if (field.$el.val().length > 0) {
                                    field.$el.next(".invalid-feedback").hide();
                                } else if (field.errors && field.errors.indexOf(index) != -1) {
                                    methods.token.errorResponse(index);
                                    validForm = false;
                                }
                            }
                        });

                        if ((status === 200 || status === 201) && validForm) {
                            methods.token.successResponse(serviceResponse);
                        } else {
                            if (fields.cardHolder.$el.attr("required")
                                && fields.cardHolder.$el.is(":visible")
                                && fields.cardHolder.$el.is(":enabled")
                                && fields.cardHolder.$el.val().length === 0) {
                                methods.token.errorResponse(fields.cardHolder.errors[0]);
                            }

                            if (fields.securityCode.$el.attr("required")
                                && fields.securityCode.$el.is(":visible")
                                && fields.securityCode.$el.is(":enabled")
                                && fields.securityCode.$el.val().length === 0) {
                                methods.token.errorResponse(fields.securityCode.errors[0]);
                            }

                            if (fields.docNumber.$el.attr("required")
                                && fields.docNumber.$el.is(":visible")
                                && fields.docNumber.$el.is(":enabled")
                                && fields.docNumber.$el.val().length === 0) {
                                methods.token.errorResponse(fields.docNumber.errors[0]);
                            }

                            if (serviceResponse.cause) {
                                serviceResponse.cause.forEach(function (cause, index, causes) {
                                    methods.token.errorResponse(cause.code);
                                });
                            }
                        }
                    });
                },
                /**
                 * @function successResponse
                 * @description Success callback for token creation
                 * @param {Object} serviceResponse
                 */
                successResponse: function (serviceResponse) {
                    Object.keys(fields).map(function (fieldKey, index) {
                        var field = fields[fieldKey];
                        field.$el.next(".invalid-feedback").hide();
                    });

                    fields.token.$el.val(serviceResponse.id);
                    $(".next-step-button .submit-payment").trigger("click", {continue: true});
                },
                /**
                 * @function errorResponse
                 * @description Error callback for token creation
                 * @param {String} errorCode
                 */
                errorResponse: function (errorCode) {
                    var errorMessages = $form.data("mpErrorMessages");
                    var errorField;

                    // Set error code message if found, otherwise set default error message
                    var errorMessage = errorMessages[errorCode] ? errorMessages[errorCode] : errorMessages.default;

                    Object.keys(fields).forEach(function (index) {
                        var field = fields[index];
                        if (field.errors && field.errors.indexOf(errorCode) !== -1) {
                            errorField = field;
                            return true;
                        }
                    });

                    if (errorField) {
                        errorField.$el.next(".invalid-feedback").focus().show().text(errorMessage);
                    } else {
                        $(".error-message").removeClass("d-none");
                        $(".error-message-text").text(errorMessage);
                    }
                }
            },

            card: {
                /**
                 * @function handleTypeChange
                 * @description Handle credit card type change
                 * @param {Event} e
                 */
                handleTypeChange: function (e) {
                    var $el = $(this);
                    var issuerMandatory = $el.data("mpIssuerRequired");
                    var isOtherType = $el.data("mpCardType") === that.configuration.otherPaymentMethod;

                    // Handle fields for other payment method
                    e.data.handleOther && methods.card.handleOtherType(isOtherType);

                    if (that.preferences.enableInstallments === true && !isOtherType) {
                        methods.installment.set($el.val());

                        // Set issuer info
                        if (issuerMandatory) {
                            methods.issuer.set($el);
                            fields.issuer.$el.prop("disabled", false);
                            fields.issuer.$el.off("change").on("change", methods.installment.setByIssuerId);
                        } else {
                            fields.issuer.$el.prop("disabled", true);
                        }
                    }
                },
                /**
                 * @function handleOtherType
                 * @description Toggle other payment method
                 * @param {Boolean} isOtherType
                 */
                handleOtherType: function (isOtherType) {
                    for (var field in fields) {
                        fields[field].hide.other
                            && fields[field].$el.closest("[data-mp-container]").toggleClass("checkout-hidden", isOtherType);
                        fields[field].disable.other
                            && fields[field].$el.prop("disabled", isOtherType);
                    }
                }
            },

            installment: {
                /**
                 * @function set
                 * @description Set installments
                 * @param {String} paymentMethodId
                 */
                set: function (paymentMethodId) {
                    // Set installments info
                    Mercadopago.getInstallments({
                        payment_method_id: paymentMethodId,
                        amount: $form.data("mpCartTotal")
                    }, methods.installment.handleServiceResponse);
                },
                /**
                 * @function handleServiceResponse
                 * @description Callback for installments
                 * @param {Number} status
                 * @param {Array} response
                 */
                handleServiceResponse: function (status, response) {
                    fields.installments.$el.find("option").remove();

                    if (status != 200 && status != 201) {
                        return;
                    }

                    var $defaultOption = $(new Option(that.resourceMessages.defaultInstallments, ""));
                    fields.installments.$el.append($defaultOption);

                    if (response.length > 0) {
                        $.each(response[0].payer_costs, function (i, item) {
                            fields.installments.$el.append($("<option>", {
                                value: item.installments,
                                text : item.recommended_message || item.installments
                            }));

                            if (fields.installments.$el.val() !== "" && fields.installments.$el.val() === item.installments) {
                                fields.installments.$el.val(item.installments);
                            }
                        });
                    }
                },
                /**
                 * @function handleServiceResponse
                 * @description Set installments using issuer ID
                 */
                setByIssuerId: function () {
                    var issuerId = $(this).val();

                    if (!issuerId || issuerId === "-1") {
                        return;
                    }

                    Mercadopago.getInstallments({
                        payment_method_id: fields.cardType.$el.filter(":checked").val(),
                        amount: $form.data("mpCartTotal"),
                        issuer_id: issuerId
                    }, methods.installment.handleServiceResponse);
                }
            },

            issuer: {
                /**
                 * @function set
                 * @description Set issuer
                 * @param {jQuery} element
                 */
                set: function ($element) {
                    Mercadopago.getIssuers($element.val(), methods.issuer.handleServiceResponse);
                },
                /**
                 * @function handleServiceResponse
                 * @description Callback for issuer
                 * @param {Number} status
                 * @param {Array} response
                 */
                handleServiceResponse: function (status, response) {
                    fields.issuer.$el.find("option").remove();

                    if (status != 200 && status != 201) {
                        return;
                    }

                    var $defaultOption = $(new Option(that.resourceMessages.defaultIssuer, ""));
                    fields.issuer.$el.append($defaultOption);

                    $.each(response, function (i, item) {
                        fields.issuer.$el.append($("<option>", {
                            value: item.id,
                            text : item.name !== "default" ? item.name : that.configuration.defaultIssuer
                        }));

                        if (fields.issuer.$el.val() !== "" && fields.issuer.$el.val() === item.id) {
                            fields.issuer.$el.val(item.id);
                        }
                    });
                }
            },

            docType: {
                /**
                 * @function init
                 * @description Init identification document type
                 */
                init: function () {
                    Mercadopago.getIdentificationTypes(methods.docType.handleServiceResponse);
                },
                /**
                 * @function handleServiceResponse
                 * @description Callback for identification document type
                 * @param {Number} status
                 * @param {Array} response
                 */
                handleServiceResponse: function (status, response) {
                    fields.docType.$el.find("option").remove();
                    var hasCC = fields.docType.$el.data("has-cc");
                    var hasCE = fields.docType.$el.data("has-ce");
                    if (status != 200 && status != 201) {
                        return;
                    }

                    $.each(response, function (i, item) {
                        var $optionElement = $("<option>", {
                            value: item.id,
                            text : item.name,
                            "data-min-length": item.min_length,
                            "data-max-length": item.max_length
                        });
                        if ((JSON.parse(hasCC) && item.id === "CC") || (JSON.parse(hasCE) && item.id === "CE")) {
                            $optionElement.attr("selected", "selected");
                        }
                        fields.docType.$el.append($optionElement);
                    });

                    fields.docType.$el.trigger("change");
                }
            },

            docNumber: {
                /**
                 * @function setRange
                 * @description Set range identification document number
                 */
                setRange: function () {
                    var $selectedOption = $(this).find("option:selected");
                    var minLength = $selectedOption.data("minLength");
                    var maxLength = $selectedOption.data("maxLength");

                    // Set label
                    var labelSecondPart = $selectedOption.val() === that.configuration.docTypeDNI ? that.resourceMessages.docNumberLabelDNI : that.resourceMessages.docNumberLabelOther;
                    fields.docNumber.$label.text(that.resourceMessages.docNumberLabel + " " + labelSecondPart);

                    // Set range
                    fields.docNumber.$wrapper.addClass("required");
                    fields.docNumber.$el.attr("maxlength", maxLength);
                    fields.docNumber.$el.attr("minlength", minLength);

                    // Set tooltip
                    fields.docNumber.$tooltip.text(that.resourceMessages.docNumberTooltip.replace("{0}", minLength).replace("{1}", maxLength));
                }
            },

            registeredCustomer: {
                /**
                 * @function togglePaymentType
                 * @description Toggle payment type (new or stored)
                 * @param {Event} event
                 */
                togglePaymentType: function (event) {
                    var $el = $(this);
                    var isNew = $el.data("togglePaymentType") !== "stored";

                    $elements.customerCardsContainer.toggleClass("checkout-hidden", isNew);

                    // Disable and remove value to properly create token
                    fields.cardId.$el.prop("disabled", isNew);
                    isNew && fields.cardId.$el.val("");

                    for (var field in fields) {
                        fields[field].hide.stored
                            && fields[field].$el.closest("[data-mp-container]").toggleClass("checkout-hidden", !isNew);
                        fields[field].disable.stored
                            && fields[field].$el.prop("disabled", !isNew);
                    }

                    // Set initial states
                    isNew && methods.paymentOption.setInitialState.newPayment();
                    // Only when triggered from event (to avoid recursion)
                    event && !isNew && methods.paymentOption.setInitialState.restoreStoredPayment();

                    // Change to opposite
                    $el.data("togglePaymentType", isNew ? "stored" : "new");
                    $el.text($el.data((isNew ? "stored" : "new") + "PaymentText"));
                },
                /**
                 * @function selectCustomerCard
                 * @description Select store credit card
                 */
                selectCustomerCard: function () {
                    var $el = $(this);
                    $elements.customerCard.removeClass("selected-payment");
                    $el.addClass("selected-payment");
                    fields.cardId.$el.val($el.data("mpCustomerCard"));

                    var paymentMethodInput = fields.cardType.$el.filter(function () {
                        return this.value === $el.data("mpMethodId");
                    });
                    paymentMethodInput.prop("checked", true);
                    methods.card.handleTypeChange.call(paymentMethodInput[0], {data: {handleOther: false}});

                    var selectedElementHTML = $el.find(".saved-payment-element").html();
                    $(".saved-payment-element.default").html(selectedElementHTML);
                    $("#saved-payments-expand").collapse("hide");
                }
            }
        };

        /**
         * @function initSDK
         * @description Init MercadoPago JS SDK by setting public key
         */
        function initSDK() {
            window.Mercadopago.setPublishableKey(that.preferences.publicKey);
        }

        /**
         * @function events
         * @description Init events
         */
        function events() {
            $elements.paymentOptionTab.on("click", methods.paymentOption.handleChange); // By click
            fields.cardType.$el.on("change", {handleOther: true}, methods.card.handleTypeChange);
            fields.docType.$el.on("change", methods.docNumber.setRange);
            $elements.paymentTypeButton.on("click", methods.registeredCustomer.togglePaymentType);
            $elements.customerCard.on("click", methods.registeredCustomer.selectCustomerCard);
            $(".next-step-button .submit-payment").on("click", methods.token.populate);
        }

        this.preferences = $form.data("mpPreferences");
        this.resourceMessages = $form.data("mpResourceMessages");
        this.configuration = $form.data("mpConfiguration");

        /**
         * @function init
         * @description Init integration
         */
        this.init = function () {
            if (window.Mercadopago) {
                initSDK();
                that.preferences.enableDocTypeNumber && methods.docType.init();
                events();
                methods.paymentOption.handleChange.call($elements.paymentOptionTab.filter(".enabled")); // Initial
            }
        };
    }

    window.MP = MercadoPago;
}(jQuery));
