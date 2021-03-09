(function($){
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
/* ***** Start of Util section ***** */
function SmartOrderRefill() {}

// Form Validation
SmartOrderRefill.validateForm = function (element) {
    var formValid = true;
    element.find('.field-wrapper').each(function() {
        var fieldWrapper = $(this);
        var field = fieldWrapper.find('input, select');
        if (field.length > 0) {
            field.removeClass('is-invalid');
            fieldWrapper.find('label.error').addClass('d-none');
            var validState = field[0].validity;

            if (!validState.valid) {
                formValid = false;
                field.addClass('is-invalid');
                if (validState.valueMissing) {
                    fieldWrapper.find('label.error.missing-error').removeClass('d-none');
                } else {
                    fieldWrapper.find('label.error.value-error').removeClass('d-none');
                }
            }
        }
    });
    return formValid;
}

// Create Modal Up To Modal Type
SmartOrderRefill.CreateModal = function(container, options) {
    if (options.buttons && Object.keys(options.buttons).length > 0) {
        var buttons = {};
        for (var key in options.buttons) {
            if (key.indexOf('SOR_GLOBAL_') > -1) {
                buttons[SmartOrderRefillSettings.Resources[key]] = options.buttons[key];
            } else {
                buttons[key] = options.buttons[key];
            }
        }
        options.buttons = buttons;
    }
    if(SmartOrderRefillSettings.ModalType == 'dialog') {
        $(container).dialog(options);
    } else {
        SmartOrderRefill.BootstrapModal(container, options)
    }
}

// Generic Modal Close
SmartOrderRefill.CloseModal = function() {
    if(SmartOrderRefillSettings.ModalType == 'dialog') {
        $(this).closest('.ui-dialog-content').dialog("close");
    } else {
        var modal = $(this).closest('.modal');
        if (modal.length == 0) {
            modal = $(this).find('.modal');
        }
        modal.modal('hide');
    }
}

// Refresh options after close the modal
$(".modal-sor button.close, .modal-sor button.btn-close-sor").on("click", function () {
    $("#everyDelivery").prop("selectedIndex", 1);
    $("#SorDeliveryWeekInterval, #SorDeliveryMonthInterval").prop("selectedIndex", 0);
});

// Bootstrap Modal
SmartOrderRefill.BootstrapModal = function(container, options) {
    var buttonsMarkUp = '';
    var title = options.title ? options.title : '';
    var width = options.width ? 'style="max-width:' + options.width + '!important;"' : '';
    var buttons = options.buttons;
    if (buttons && Object.keys(buttons).length > 0) {
        buttonsMarkUp += '<div class="modal-footer background-grey border-0 justify-content-center d-row">';
        $(container).off('click', '#sorModalCenter button.action');
        for (var key in buttons) {
            buttonsMarkUp += '<button type="button" class="btn btn-secondary action"  data-id="' + key + '">' + key + '</button>';
            $(container).on('click', '#sorModalCenter button.action[data-id="' + key + '"]',  buttons[key])
        }
        buttonsMarkUp += '<div>';
    }
    var bootstrap = '<div class="modal sor-modal sor-default-modal fade modal-checkout p-0" id="sorModalCenter" tabindex="-1" role="dialog" aria-labelledby="sorModalCenter" aria-hidden="true">'
        + '<div class="modal-dialog"' + width + 'role="document">'
            + '<div class="modal-content">'
                + '<div class="modal-header background-primary text-white py-2">'
                    + '<h5 class="modal-title text-center w-100" id="exampleModalLongTitle">' + title + '</h5>'
                    + '<button type="button" class="close" data-dismiss="modal" aria-label="Close">'
                        + '<span aria-hidden="true" style="font-size:29px;" class="text-white">&times;</span>'
                    + '</button>'
                + '</div>'
                + '<div class="modal-body">'
                    + $(container).html()
                + '</div>'
                + buttonsMarkUp
            + '</div>'
        + '</div>'
    + '</div>';
    container.html(bootstrap);
    container.find('.modal').on('shown.bs.modal', function (e) {
        var subscriptionModals = $('#subscriptionview, #orderview');
        if(subscriptionModals.length > 0 && !container.is(subscriptionModals)) {
            container.siblings('.modal-backdrop').last().css('z-index', '1060');
            container.find('.modal').css('z-index', '1070');
        }
    });
    container.find('.modal').modal({
        backdrop: 'static'
    });
    container.find('.modal').modal('show');
    container.find('.modal').on('hidden.bs.modal', function (e) {
        container.remove();
        if($('#subscriptionview, #orderview, #error-model').length > 0) {
            $('body').addClass('modal-open');
        }
    });

    $(window).trigger("initAutocompleteEvent");
}

SmartOrderRefill.limitCharacters = function() {
    $('form').find('textarea[data-character-limit]').each(function() {
        var characterLimit = $(this).data("character-limit"),
            charCountHtml  = String.format(app.resources.CHAR_LIMIT_MSG,
                                '<span class="char-remain-count">'+characterLimit+'</span>',
                                '<span class="char-allowed-count">'+characterLimit+'</span>');
        var charCountContainer = $(this).next('div.char-count');
        if (charCountContainer.length===0) {
            charCountContainer = $('<div class="char-count"/>').insertAfter($(this));
        }
        charCountContainer.html(charCountHtml);
        // trigger the keydown event so that any existing character data is calculated
        $(this).change();
    });
}

SmartOrderRefill.creatContainer = function(selector) {
    var $target, id;
    if (jQuery.type(selector) === "string") {
        if (selector.indexOf('#')===0) {
            $target = $(selector, document);
            $target.selector = selector;
        } else {
            $target = $('#' + selector, document);
            $target.selector = '#' + selector;
        }
    } else if (selector instanceof jQuery) {
        $target = selector;
    }

    if ($target.length === 0) {
        if ($target.selector && $target.selector.indexOf('#')===0) {
            id = $target.selector.substr(1);
            $target = $('<div>').attr('id', id).appendTo('body');
        }
    }
    return $target;
}

function getURLParameter(url, name) {
    return (RegExp(name + '=' + '(.+?)(&|$)').exec(url)||[,null])[1];
}

/* ****** End of Util section ****** */


/* ****** Start of Account section ******* */

SmartOrderRefill.initAddressChangeForm = function(target, urlview) {
    $(document).off('click', '.changeaddress').on('click', '.changeaddress', function(e) {
        e.preventDefault();
        var url        = $(this).attr('data-link'),
        $container = SmartOrderRefill.creatContainer('#addresschange'),
        options   = SmartOrderRefill.ModalOptions.addressChangeFormOptions(target, urlview, $container);
        
        $container.load(url, function() {
            SmartOrderRefill.CreateModal($container, options);
            SmartOrderRefill.initCSRFProtection();
            var $form = $('#editAddressForm');
            $('select[name$="_changeaddress"]', $form).on('change', function() {
                var selected        = $(this).children(':selected').first(),
                    selectedAddress = $(selected).data('address');
                if (!selectedAddress) { return; }
                fillAddressFields(selectedAddress, $form);
                SmartOrderRefill.validateForm($form)
            });
        });
    });
}

function fillAddressFields(address, $form) {
    for (var field in address) {
        if (field === 'ID' || field === 'UUID' || field === 'key') {
            continue;
        }
        $form.find('[name$="' + field.replace('Code', '') + '"]').val(address[field]);

        if (field === 'countryCode') {
            $form.find('[name$="country"]').trigger('change');
            $form.find('[name$="state"]').val(address.stateCode);
        }
    }
}

/**
 * @private
 * @function
 * @description initialize dialog for order view
 */
SmartOrderRefill.initOrderView = function() {
    $('.order.view').on('click', function(e) {
        e.preventDefault();
        var url        = $(this).attr('data-link'),
            $container = SmartOrderRefill.creatContainer('#orderview');

        $container.load(url, function() {
            SmartOrderRefill.limitCharacters();
            SmartOrderRefill.CreateModal($container, SmartOrderRefill.ModalOptions.orderViewOptions);
            SmartOrderRefill.initAddressChangeForm('#orderview', url);
        });
    });

    $(document).on("click", ".skip-order", function(e) {
        e.preventDefault();
        var $el = $(this);
        var url = $el.attr("data-link");
        $.ajax({
            type : "POST",
            url  : url
        }).done(function(response) {
            if (response.success) {
                $el.parent(".next-order-item").remove();
            }
        })
    });
}

/**
 * @private
 * @function
 * @description initialize dialog for subscription view
 */
SmartOrderRefill.initSubscriptionView = function() {
    $('.subscription.view').on('click', function(e) {
        e.preventDefault();
        var url        = $(this).attr('data-link'),
            $container = SmartOrderRefill.creatContainer('#subscriptionview');

        $container.load(url, function(){
            SmartOrderRefill.limitCharacters();
            SmartOrderRefill.CreateModal($container, SmartOrderRefill.ModalOptions.subscriptionViewOptions);
            SmartOrderRefill.initAddressChangeForm('#subscriptionview', url);
            SmartOrderRefill.initUpdateCreditCardForm();
        });
    });
}

/**
 * @private
 * @function
 * @description initialize update product quantity
 */
SmartOrderRefill.initUpdateProductQuantity = function() {
    $(document).on('click', '.update-item', function(e) {
        e.preventDefault();

        var url      = $(this).attr('data-link'),
            item     = getURLParameter(url, 'item'),
            quantity = $(this).parents('.order-section').find('#quantity_' + item).val();
        $.ajax({
            type : 'POST',
            url  : url,
            data : {quantity : quantity}
        }).done(function(response) {
            if (response) {
                if($('#qtyError').length) {
                    $('#qtyError').remove();
                }
                if (response.success) {
                    window.location = SmartOrderRefillSettings.Urls.manageOrders;
                } else {
                    if (!$('#qtyError').length) {
                        $('<label class="error" id="qtyError">' + response.message + '</label>').insertAfter('#quantity_' + item);
                    }
                }
            } else {
                SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_QUANTITY_ERROR, false);
            }
        }).fail(function(xhr, textStatus) {
            SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
        });
    });
}

/**
 * @private
 * @function
 * @description initialize remove product
 */
SmartOrderRefill.initRemoveProduct = function() {
    $(document).on('click', '.remove-item', function(e) {
        e.preventDefault();
        var url      = $(this).attr('data-link');
        $.ajax({
            type : 'POST',
            url  : url
        }).done(function(response) {
            if (response && response.success) {
                window.location = SmartOrderRefillSettings.Urls.manageOrders;
            } else {
                SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_QUANTITY_ERROR, false);
            }
        }).fail(function(xhr, textStatus) {
            SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
        });
    });
}

/**
 * @private
 * @function
 * @description initialize change product form
 */
SmartOrderRefill.initChangeProductForm = function(target, urlview) {
    $(document).off('click', '.change-item').on('click', '.change-item', function(e) {
        e.preventDefault();
        var url        = $(this).attr('data-link'),
            $container = SmartOrderRefill.creatContainer('#changeproduct'),
            options    = SmartOrderRefill.ModalOptions.changeProductFormOptions;

        $container.load(url, function() {
            SmartOrderRefill.CreateModal($container, options);
        }.bind(this));
    });
}

/**
 * @private
 * @function
 * @description initialize dialog for update credit card view
 */
SmartOrderRefill.initUpdateCreditCardForm = function(target, urlview) {
    $(document).off('click', '.update-card').on('click', '.update-card', function(e) {
        e.preventDefault();
        var url        = $(this).attr('data-link'),
            $container = SmartOrderRefill.creatContainer('#updatecreditcard'),
            options    = SmartOrderRefill.ModalOptions.updateCreditCardFormOptions;
        SmartOrderRefill.initCSRFProtection();
        $container.load(url, function() {
            SmartOrderRefill.CreateModal($container, options);

            $("select[id$='_updatecard_expiration_month']").val(parseInt($('#updatecreditcard').find('.expiration-date-wrapper').attr('data-expmonth')));
            $("select[id$='_updatecard_expiration_year']").val($('#updatecreditcard').find('.expiration-date-wrapper').attr('data-expyear'));
        }.bind(this));
    });
}

/**
 * @private
 * @function
 * @description initialize update refill
 */
SmartOrderRefill.initUpdateRefill = function() {
    $(document).on('click', '.update-refill', function(e) {
        e.preventDefault();
        var url         = $(this).attr('data-link'),
            item        = getURLParameter(url, 'item'),
            periodicity = $('#select-everydelivery-' + item).val(),
            interval    = (periodicity == 'month') ? $('#sorMonth-' + item).val() : $('#sorWeek-' + item).val();
        $.ajax({
            type : 'POST',
            url  : url,
            data : {
                periodicity : periodicity,
                interval    : interval
            }
        }).done(function(response) {
            if (response && response.success) {
                window.location = SmartOrderRefillSettings.Urls.manageOrders;
            } else {
                SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_QUANTITY_ERROR, false);
            }
        }).fail(function(xhr, textStatus) {
            SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
        });
    });
}

/**
 * @private
 * @function
 * @description initialize credit card expiration warning
 */
 SmartOrderRefill.initCreditCardExpirationWarning = function() {

    $(document).on('change','.pt_checkout [name$="creditCard_expiration_month"], .pt_checkout [name$="creditCard_expiration_year"]',function(){
        var month = $('.pt_checkout [name$="creditCard_expiration_month"]').val(),
            year  = $('.pt_checkout [name$="creditCard_expiration_year"]').val();
        toggleExpirationWarning(month, year);
    });
    $(document).on('change','#checkout-main [name$="creditCardFields_expirationMonth"], #checkout-main [name$="creditCardFields_expirationYear"]',function(){
        var month = $('#checkout-main [name$="creditCardFields_expirationMonth"]').val(),
            year  = $('#checkout-main [name$="creditCardFields_expirationYear"').val();
        toggleExpirationWarning(month, year);
    });
    function toggleExpirationWarning(month, year) {
        if (typeof month !== "undefined" && typeof year !== "undefined" && month && year) {
            var expirationDate = new Date(new Date(year,month).setDate(0)),
                currentDate    = new Date(),
                nextYear       = new Date(currentDate.getFullYear() + 1,currentDate.getMonth(),currentDate.getDate() - 1);

            if ((expirationDate - nextYear) <= 0) {
                $('.credit_card_expiration_warning').show();
            }else{
                $('.credit_card_expiration_warning').hide();
            }
        }
    }
}

/**
 * @private
 * @function
 * @description initialize reactivate order view
 */
SmartOrderRefill.initReactivateOrderView = function(target, urlview) {
    $(document).off('click', '.order.reactivate').on('click', '.order.reactivate', function(e) {
        e.preventDefault();
        var url   = $(this).attr('data-link'),
            order = getURLParameter(url, 'sid');
        $.ajax({
            type : 'POST',
            url  : url,
            data : {
                order : order
            }
        }).done(function(response) {
            if (response) {
                if (!response.success) {
                    var $container = SmartOrderRefill.creatContainer('#reactivate-order');
                    $container.html("<span class='text-grey'>" + SmartOrderRefillSettings.Resources.SOR_REACTIVE_ORDER_MESSAGE + "</span>");
                    SmartOrderRefill.CreateModal($container, SmartOrderRefill.ModalOptions.reactivateOrderViewOptions);
                } else {
                    window.location = SmartOrderRefillSettings.Urls.manageOrders;
                }
            } else {
                SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
            }
        }).fail(function(xhr, textStatus) {
            SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
        });
    });
}

/**
 * @private
 * @function
 * @description initialize reactivate subscription view
 */
SmartOrderRefill.initReactivateSubscriptionView = function(target, urlview) {
    $(document).off('click', '.reactivatesubscription').on('click', '.reactivatesubscription', function(e) {
        e.preventDefault();
        var url        = $(this).attr("data-link"),
            $container = SmartOrderRefill.creatContainer('#reactivate-subscription'),
            options    = SmartOrderRefill.ModalOptions.reactivateSubscriptionOptions;

        $container.load(url, function() {
            SmartOrderRefill.CreateModal($container, options);
        }.bind(this));
    });
}
/* ****** End of Account section ****** */

/* ******* Start of Cart section ******* */

SmartOrderRefill.initModifyRefill = function() {
    $(document).on('click', '#modifyRefill', function(e) {
        e.preventDefault();
        var url        = $(this).attr('data-link'),
            $container = SmartOrderRefill.creatContainer('#modify-smart-order-refill');

        $container.load(url, function(){
            SmartOrderRefill.limitCharacters();
            SmartOrderRefill.CreateModal($container, SmartOrderRefill.ModalOptions.modifyRefillOptions);
            // force to load the selected value of sor subscriptions
            $('[name="everyDelivery"]').trigger('change');
            $('#modify-smart-order-refill select').on('change', function() {
                $('#multipleRefill').prop('checked', true);
            });
        });
    });
}

SmartOrderRefill.initRemoveRefill = function() {
    $(document).on('click', '#removeRefill', function(e) {
        e.preventDefault();
        var url      = $(this).attr('data-link'),
            cartShow = SmartOrderRefillSettings.Urls.cartShow;

        $.ajax({
            type: 'GET',
            url: url,
            success: function(response) {
                if (response && response.success) {
                    window.location = cartShow;
                } else {
                    SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
                }
            }
        });
    });
}

SmartOrderRefill.initLoginFromCart = function() {
    $(document).on('click', '#message_wrapper a', function() {
        var $container = SmartOrderRefill.creatContainer('#sorlogin'),
            options = {
                modal : true,
                width : "900px"
            }
        $container.load(SmartOrderRefillSettings.Urls.loginFromCartPage, function() {
            SmartOrderRefill.limitCharacters();
            SmartOrderRefill.CreateModal($container, options)
        });
    });
    $(document).on('click', '#sorlogin button', function(e) {
        e.preventDefault();
        var form = $(this).parents('form:first');
        if (SmartOrderRefill.validateForm(form)) {
            var url  = form.attr('action'),
                data = {};
                form.serializeArray().map(function (param) {
                    data[param['name']] = param['value'];
                });

            $.ajax({
                type: 'POST',
                url: url,
                data : data,
                success: function(response) {
                    if (!response) {
                        SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
                    } else if (response.success) {
                        if ($('#loginFromCartError').length) {
                            $('#loginFromCartError').remove();
                        }
                        window.location = response.url;
                    } else {
                        if (!$('#loginFromCartError').length) {
                            form.prepend('<div id="loginFromCartError" class="error-form alert alert-danger">' + SmartOrderRefillSettings.Resources.SOR_LOGINFROMCART_ERROR + '</div>');
                        }
                    }
                }
            });
        }
    });
}

/* ******* End of Cart section ******* */

/* ******* Start of Product section ******* */

SmartOrderRefill.initializePdp = function() {

    initOptions();

    $(document).on('click', '#pdpMain .product-add-to-cart select#SorDeliveryMonthInterval', function() {
        $('input[name="hasSmartOrderRefill"]').val(['true']);
    });

    $('input[name=hasSmartOrderRefill]').change(function() {
        hideOrShowSchedules($(this).val());
    });

    //  Show or hide the schedule select based on user selection.
    function hideOrShowSchedules(value) {
        if (value === 'true') {
            if(window.innerWidth < 568) {
                $('.smart-order-refill-period').attr('style', 'margin: 15px 20px');
            }
            $('.smart-order-refill-period').attr('style', 'display:inline-block');
            $('#everyDelivery').trigger('change');
        } else {
            $('.or-cancel-edit-text').attr('style', 'margin-top:10px');
            $('.smart-order-refill-period').attr('style', 'display:none');
            if ($('input[name=variantSelected]').val()) {
                $('#add-to-cart').removeAttr('disabled');
            }
        }
    }

    function initOptions() {
        if (!$('.smart-order-refill-options').data('sorOneTime')) {
            $('.smart-order-refill-options [for="OsfSorRefillProductNo"], .smart-order-refill-options [for="OsfSorRefillProductYes"]').hide()
            $('#OsfSorRefillProductYes').prop('checked', true);
        }
        if ($('.smart-order-refill-period p').data('disableDropdown')) {

            $('#SorDeliveryWeekInterval, #SorDeliveryMonthInterval').css({'display':'none'});
        }
    }

    $(document).on('change', '[name="everyDelivery"]' ,function() {
        if ($(this).val() === 'month') {
            $('select[name=SorDeliveryWeekInterval]').hide();
            $('select[name=SorDeliveryMonthInterval]').show();
            if ($('.smart-order-refill-period p').data('disableDropdown')) {
                $('#SorDeliveryWeekInterval, #SorDeliveryMonthInterval').css({'display':'none'});
            }
        } else if ($(this).val() === 'week'){
            $('select[name=SorDeliveryMonthInterval]').hide()
            $('select[name=SorDeliveryWeekInterval]').show();
            if ($('.smart-order-refill-period p').data('disableDropdown')) {
                $('#SorDeliveryWeekInterval, #SorDeliveryMonthInterval').css({'display':'none'});
            }
        }
    });

    $('[name="everyDelivery"], select[name="SorDeliveryWeekInterval"], select[name="SorDeliveryMonthInterval"]').on('change', function() {

        var everyDeliveryHasValueSelected = $('[name="everyDelivery"]').val(),
            weekIntervalHasValueSelected  = $('select[name=SorDeliveryWeekInterval]').val(),
            monthIntervalHasValueSelected = $('select[name=SorDeliveryMonthInterval]').val(),
            sorDataInformed               = everyDeliveryHasValueSelected || (weekIntervalHasValueSelected || monthIntervalHasValueSelected),
            variantSelected               = $('input[name=variantSelected]').val(),
            shouldEnableAddToCartButton   = sorDataInformed && variantSelected;

        if (shouldEnableAddToCartButton) {
            $('#add-to-cart').removeAttr('disabled');
        } else {
            $('#add-to-cart').attr('disabled', 'disabled');
        }
    });

    $('body').on('product:afterAddToCart', function (e, response) {
        var isSor = response.queryString.indexOf("isSor=true") > -1;
        if (!response.error) {
            if (isSor) {
                $.ajax({
                    type: 'POST',
                    url: SmartOrderRefillSettings.Urls.updateRefillData,
                    data : {
                        action : 'update',
                        hasSmartOrderRefill: $('[name="hasSmartOrderRefill"]').filter(':checked').val(),
                        everyDelivery: $('[name="everyDelivery"]').val(),
                        SorDeliveryWeekInterval: $('[name="SorDeliveryWeekInterval"]').val(),
                        SorDeliveryMonthInterval:  $('[name="SorDeliveryMonthInterval"]').val(),
                        liuuid: response.pliUUID
                    }
                }).then(function () {
                    $(".minicart-trigger").click();
                });
            } else {
                $(".minicart-trigger").click();
            }
        }
    });
    $('body').on('product:afterAttributeSelect', function (e, response) {
        if (response.data && response.data.product && response.data.product.id) {
            $.ajax({
                type: 'GET',
                url: SmartOrderRefillSettings.Urls.updatePDPOptions,
                data : {
                    pid: response.data.product.id
                },
                success: function (response) {
                    var refillOptions = $(response).filter('.smart-order-refill-options');

                    var hasRefillId = '#' + refillOptions.find('[name="hasSmartOrderRefill"]').filter(':checked').attr('id');
                    var everyDelivery = refillOptions.find('[name="everyDelivery"]').val();
                    var weekInterval = refillOptions.find('[name="SorDeliveryWeekInterval"]').val();
                    var monthInterval = refillOptions.find('[name="SorDeliveryMonthInterval"]').val();

                    var sorPrice = refillOptions.find('.sor-price');
                    var sorPriceMessage = refillOptions.find('.sor-price-message');

                    $('[name="everyDelivery"]').val(everyDelivery).change();
                    $('[name="SorDeliveryWeekInterval"]').val(weekInterval).change();
                    $('[name="SorDeliveryMonthInterval"]').val(monthInterval).change();
                    $('.smart-order-refill-options .sor-price').remove();
                    $('.smart-order-refill-options .sor-price-message').remove();
                    if(sorPrice.length) {
                        $('.smart-order-refill-options').append(sorPrice);
                        $('.smart-order-refill-options').append(sorPriceMessage);
                    }
                    $(hasRefillId).prop("checked", true).change();
                    initOptions();
                    hideOrShowSchedules($("input[name=hasSmartOrderRefill]:checked").val());

                    var $modalOpener = $("#sor-modal-opener");
                    if ($modalOpener.length > 0) {
                        var disableValue = $("#add-to-cart-main").prop("disabled");
                        $("#add-to-cart-sor").prop("disabled", disableValue);
                        $modalOpener.prop("disabled", disableValue);
                    }
                }
            });
        }
    });
    hideOrShowSchedules($('input[name=hasSmartOrderRefill]:checked').val());
}

// generic method for functions without Ajax calls
SmartOrderRefill.initLinkModel = function() {
    $(document).off('click', '.sorshowmodal').on('click', '.sorshowmodal', function(e) {
        e.preventDefault();
        var url        = $(this).attr('data-link'),
            title      = $(this).attr('data-title'),
            content    = $(this).attr('data-content'),
            yes        = $(this).attr('data-yes'),
            no         = $(this).attr('data-no'),
            $container = SmartOrderRefill.creatContainer('#link-model'),
            options =  {
                autoOpen : true,
                modal    : true,
                title    : title,
                width    : "400px",
                buttons  : {}
            };

        if(yes) {
            options.buttons[yes] = SmartOrderRefill.ButtonFunctions.linkModelYes.bind($container, url)
        }
        if(no) {
            options.buttons[no] = SmartOrderRefill.CloseModal
        }
        $container.html("<span class='text-grey'>" + content + "</span>")

        SmartOrderRefill.CreateModal($container, options);
    });
}

// generic method for error messages
SmartOrderRefill.initErrorModal = function(content, refresPage) {
    var $container = SmartOrderRefill.creatContainer('#error-model'),
        options =  {
            autoOpen : true,
            modal    : true,
            title    : SmartOrderRefillSettings.Resources.SOR_ERROR_TITLE,
            width    : "400px",
            buttons  : {
                'SOR_GLOBAL_OK' : SmartOrderRefill.ButtonFunctions.reloadDashboard.bind($container, refresPage)
            }
        };

    $container.html("<h3>" + content + "</h3>")
    SmartOrderRefill.CreateModal($container, options);
}


// ***** BUTTONS FUNCTIONS ******
SmartOrderRefill.ButtonFunctions = {
    // reactivateSubscription
    reactivateSubscriptionSave: function() {
        var $form = $('#reactiveSubs');
        var formValid = SmartOrderRefill.validateForm($form);
        if($form) {
            if (formValid) {
                setTimeout(function() {
                    $.ajax({
                        type : 'POST',
                        url  : $form.attr('action'),
                        data : $form.serialize()
                    }).done(function(response) {
                        if (response && response.success) {
                            SmartOrderRefill.CloseModal()
                            window.location = SmartOrderRefillSettings.Urls.manageOrders;
                        } else {
                            SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
                        }
                    }).fail(function(xhr, textStatus) {
                        SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
                    });
                }, 1000);
            }
        }
    },
    reloadDashboard: function(refresPage) {
        if (refresPage) {
            window.location = SmartOrderRefillSettings.Urls.manageOrders;
        }
    },
    // initReactivateOrderView
    reactivateOrderViewOk: function() {
        setTimeout(function() {
            $.ajax({
                type : 'POST',
                url  : SmartOrderRefillSettings.Urls.cancelOneOrder,
                data : {
                    sid : order
                }
            }).done(function(response) {
                if (response && response.success) {
                    SmartOrderRefill.CloseModal
                    window.location = SmartOrderRefillSettings.Urls.manageOrders;
                } else {
                    SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
                }
            }).fail(function(xhr, textStatus) {
                SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
            });
        }, 1000);
    },

    linkModelYes: function(url) {
        $.ajax({
            type: 'GET',
            url: url,
            success: function (response) {
                if (response) {
                    if (response.success) {
                        window.location = SmartOrderRefillSettings.Urls.manageOrders;
                    } else if (response.message) {
                        SmartOrderRefill.initErrorModal(response.message, true);
                    } else {
                        SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, true);
                    }
                }
            }
        });
        SmartOrderRefill.CloseModal()
    },

    skipOrderViewYes: function(url) {
        $.ajax({
            type: 'GET',
            url: url,
            success: function (response) {
                if (response && response.success) {
                    window.location = SmartOrderRefillSettings.Urls.manageOrders;
                } else {
                    SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
                }
            }
        });
        SmartOrderRefill.CloseModal()
    },

    // initUpdateCreditCardForm
    updateCreditCardFormSave: function() {
        var $form = $('#editCreditCard');
        var formValid = SmartOrderRefill.validateForm($form);

        if (formValid) {
            setTimeout(function() {
                $.ajax({
                    type: 'POST',
                    url: $form.attr('action'),
                    data: $form.serialize()
                }).done(function(response) {
                    if (response && response.success) {
                        SmartOrderRefill.CloseModal()
                        window.location = SmartOrderRefillSettings.Urls.manageOrders;
                    } else {
                        alert(SmartOrderRefillSettings.Resources.SOR_CREDITCARD_ERROR);
                    }
                }).fail(function(xhr, textStatus) {
                    alert(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR);
                });
            }, 1000);
        }
    },

    // initChangeProductForm
    changeProductFormSave: function() {
        var $form   = $('#editProductForm'),
            product = $('.product-select').val();

        setTimeout(function() {
            $.ajax({
                type: 'POST',
                url: $form.attr('action'),
                data: {newProduct : product}
            }).done(function(response) {
                if (response && response.success) {
                    SmartOrderRefill.CloseModal.call($container)
                    window.location = SmartOrderRefillSettings.Urls.manageOrders;
                } else {
                    alert(SmartOrderRefillSettings.Resources.SOR_PRODUCT_ERROR);
                }
            }).fail(function(xhr, textStatus) {
                SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
            });
        }, 1000);
    },

    // initAddressChangeForm
    addressChangeFormSave:  function() {
        var $form = $('#editAddressForm');
        var formValid = SmartOrderRefill.validateForm($form);
        var target = SmartOrderRefill.addressChangeInfo.target
            urlview = SmartOrderRefill.addressChangeInfo.urlview,
            $container = SmartOrderRefill.addressChangeInfo.container;

        setTimeout(function() {
            if (!formValid) {
                return;
            }
            $.ajax({
                type: 'POST',
                url: $form.attr('action'),
                data: $form.serialize()
            }).done(function(response) {
                if (response) {
                    if (response.success) {
                        var viewTarget = target;
                        var bootstrapModalBody = $(target).find('.modal .modal-body');
                        if (bootstrapModalBody.length > 0) {
                            target = bootstrapModalBody;
                        }
                        $(target).load(urlview, function() {
                            SmartOrderRefill.limitCharacters();
                        });
                        SmartOrderRefill.CloseModal.call($container);
                    } else {
                        if ($('input[name$="_postal"]:invalid').length) {
                            $('input[name$="_postal"]').parent().append('<label class="error">' + Resources.INVALID_ZIP + '</label>');
                        }
                    }
                } else {
                    alert(SmartOrderRefillSettings.Resources.SOR_ADDRESS_ERROR);
                }
            }).fail(function(xhr, textStatus) {
                alert(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR);
            });

        }, 1000);

    },

    modifyRefillUpdate: function() {
        var url = $('#modify-smart-order-refill form').attr('action');
        var data = {
            hasSmartOrderRefill: $('[name="hasSmartOrderRefill"]').filter(':checked').val(),
            everyDelivery: $('[name="everyDelivery"]').val(),
            SorDeliveryWeekInterval: $('[name="SorDeliveryWeekInterval"]').val(),
            SorDeliveryMonthInterval:  $('[name="SorDeliveryMonthInterval"]').val()
        };
        $.ajax({
            type: 'POST',
            url: url,
            data: data,
            success: function(response) {
                if (response && response.success) {
                    window.location = SmartOrderRefillSettings.Urls.cartShow;
                } else {
                    SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
                }
            }
        });
    }
}


// ******  OPTIONS  *******

SmartOrderRefill.ModalOptions = {
    // initReactivateSubscriptionView
    reactivateSubscriptionOptions: {
        'autoOpen'     : true,
        'bgiframe'     : true,
        'title'        : SmartOrderRefillSettings.Resources.SOR_REACTIVE_SUBSCRIPTION_TITLE,
        'modal'        : true,
        'emptyOnClose' : false,
        'width'        : '400px',
        'buttons'      : {
            "SOR_GLOBAL_CANCEL": SmartOrderRefill.CloseModal,
            "SOR_GLOBAL_SAVE": SmartOrderRefill.ButtonFunctions.reactivateSubscriptionSave
        }
    },

    //initReactivateOrderView
    reactivateOrderViewOptions: {
        'autoOpen'     : true,
        'bgiframe'     : true,
        'title'        : SmartOrderRefillSettings.Resources.SOR_REACTIVE_ORDER_TITLE,
        'modal'        : true,
        'emptyOnClose' : false,
        'width'        : '400px',
        'buttons'      : {
            "SOR_GLOBAL_OK": SmartOrderRefill.ButtonFunctions.reactivateOrderViewOk
        }
    },

    // initUpdateCreditCardForm
    updateCreditCardFormOptions: {
        'autoOpen': true,
        'bgiframe': true,
        'title': SmartOrderRefillSettings.Resources.SOR_UPDATE_CREDIT_CARD_TITLE,
        'modal': true,
        'emptyOnClose': false,
        'width': '600px',
        'buttons': {
            "SOR_GLOBAL_CANCEL": SmartOrderRefill.CloseModal,
            "SOR_GLOBAL_SAVE": SmartOrderRefill.ButtonFunctions.updateCreditCardFormSave
        }
    },
    // initChangeProductForm
    changeProductFormOptions: {
        'autoOpen'     : true,
        'bgiframe'     : true,
        'modal'        : true,
        'emptyOnClose' : false,
        'width'        : '400px',
        'title'        : 'Change product',
        'buttons'      : {
            "SOR_GLOBAL_CANCEL" : SmartOrderRefill.CloseModal,
            "SOR_GLOBAL_SAVE"   : SmartOrderRefill.ButtonFunctions.changeProductFormSave
        }
    },
    // initSubscriptionView
    subscriptionViewOptions: {
        autoOpen    : true,
        modal       : true,
        dialogClass : "smart-order-refill-modal",
        width       : "700px",
        title       : SmartOrderRefillSettings.Resources.SOR_DIALOG_SUBSCRIPTION,
        buttons     : {
            "SOR_GLOBAL_CLOSE" : SmartOrderRefill.CloseModal
        }
    },
    // initOrderView
    orderViewOptions: {
        draggable   : false,
        resizable   : false,
        dialogClass : "smart-order-refill-modal",
        autoOpen    : true,
        modal       : true,
        width       : "700px",
        title       : SmartOrderRefillSettings.Resources.SOR_DIALOG_ORDER,
        buttons     : {
            "SOR_GLOBAL_CLOSE" : SmartOrderRefill.CloseModal
        }
    },
    modifyRefillOptions: {
        draggable   : false,
        resizable   : false,
        dialogClass : "smart-order-refill-modal",
        modal       : true,
        title       : SmartOrderRefillSettings.Resources.SOR_MODIFY_SMART_ORDER_REFILL,
        width       : "600px",
        buttons     : {
            "SOR_GLOBAL_UPDATE" : SmartOrderRefill.ButtonFunctions.modifyRefillUpdate
        }
    },
    // initAddressChangeForm
    addressChangeFormOptions: function(target, urlview, $container){
        SmartOrderRefill.addressChangeInfo = {
            target : target,
            urlview: urlview,
            container : $container
        };
        return {
            'autoOpen'     : true,
            'bgiframe'     : true,
            'modal'        : true,
            'emptyOnClose' : false,
            'width'        : '400px',
            'title'        : SmartOrderRefillSettings.Resources.SOR_CHANGE_ADDRESS,
            'buttons'      : {
                "SOR_GLOBAL_CANCEL" : SmartOrderRefill.CloseModal,
                "SOR_GLOBAL_SAVE"   : SmartOrderRefill.ButtonFunctions.addressChangeFormSave
            }
        }
    },
    linkModelYes: function(url) {
        $.ajax({
            type: 'GET',
            url: url,
            success: function (response) {
                if (response && response.success) {
                    window.location = SmartOrderRefillSettings.Urls.manageOrders;
                } else {
                    SmartOrderRefill.initErrorModal(SmartOrderRefillSettings.Resources.SOR_UNEXPECTED_ERROR, false);
                }
            }
        });
        SmartOrderRefill.CloseModal(this);
    },

}


SmartOrderRefill.initAccountSorView = function() {
    $('.show-hide-orders').each(function(){
        $(this).on('click' , function() {
            $(this).closest('.subscriptionSection').find('.subscriptionOrders').slideToggle('slow');
        })
    })
}
/**
 * Fills in a hidden input with a csrf token information
 */
SmartOrderRefill.initCSRFProtection = function() {
    var $tokenField = $('.csrf-token');
    $.ajax({
        type: 'POST',
        url: $tokenField.data('url'),
        success: function(response) {
            $tokenField.attr('name', response.csrf.tokenName);
            $tokenField.attr('value', response.csrf.token);
        }
    });
}

/**
 * @private
 * @function
 * @description Binds events to the cart page (edit item's details, bonus item's actions, coupon code entry)
 */
SmartOrderRefill.initialize = function() {
    SmartOrderRefill.initSubscriptionView();
    SmartOrderRefill.initOrderView();
    SmartOrderRefill.initAddressChangeForm();
    SmartOrderRefill.initCreditCardExpirationWarning();
    SmartOrderRefill.initChangeProductForm();
    SmartOrderRefill.initReactivateSubscriptionView();
    SmartOrderRefill.initReactivateOrderView();
    SmartOrderRefill.initUpdateProductQuantity();
    SmartOrderRefill.initRemoveProduct();
    SmartOrderRefill.initUpdateRefill();
    SmartOrderRefill.initModifyRefill();
    SmartOrderRefill.initRemoveRefill();
    SmartOrderRefill.initLoginFromCart();

    SmartOrderRefill.initLinkModel();

    SmartOrderRefill.initializePdp();
    SmartOrderRefill.initAccountSorView();
}


$(document).ready(function() {
    SmartOrderRefill.initialize();
    if (typeof $.fn.dialog == 'undefined' && typeof $.fn.modal !== 'undefined') {
        SmartOrderRefillSettings.ModalType = 'modal'
    }
    var fromEmail = getURLParameter(window.location.href, 'fromEmail');
    if (fromEmail) {
        var sid = getURLParameter(window.location.href, 'sid');
        if (getURLParameter(window.location.href, 'skip')) {
            $('.order.skip').each(function() {
                var url = $(this).attr('data-link');
                if (sid == getURLParameter(url, 'sid')) {
                    $(this).trigger('click');
                    return false;
                }
            });
        }
    }
    $(".sorlink.visually-hidden").removeClass("visually-hidden");
    window.SmartOrderRefill = SmartOrderRefill;
});
})(window.jQuery)