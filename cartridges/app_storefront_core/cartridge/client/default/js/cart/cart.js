"use strict";

var base = require("../product/base");
var focusHelper = require("../components/focus");

/**
 * appends params to a url
 * @param {string} url - Original url
 * @param {Object} params - Parameters to append
 * @returns {string} result url with appended parameters
 */
function appendToUrl(url, params) {
    var newUrl = url;
    newUrl += (newUrl.indexOf("?") !== -1 ? "&" : "?") + Object.keys(params).map(function (key) {
        return key + "=" + encodeURIComponent(params[key]);
    }).join("&");

    return newUrl;
}

/**
 * Checks whether the basket is valid. if invalid displays error message and disables
 * checkout button
 * @param {Object} data - AJAX response from the server
 */
function validateBasket(data) {
    if (data.valid) {
        if (data.valid.error) {
            $(".checkout-btn").addClass("disabled");
        } else {
            $(".checkout-btn").removeClass("disabled");
        }
    }
}

/**
 * re-renders the cart items number
 * @param {Object} data - AJAX response from the server
 */
function updateItemNumber(data) {
    $(".checkout-steps .total-items-label").empty().append(data.resources.numberOfItems);
}

/**
 * re-renders the order totals and the number of items in the cart
 * @param {Object} data - AJAX response from the server
 */
function updateCartTotals(data) {
    $(".shipping-cost").empty().append(data.totals.totalShippingCost);
    $(".tax-total").empty().append(data.totals.totalTax);
    $(".grand-total").empty().append(data.totals.grandTotal);
    $(".sub-total").empty().append(data.totals.guestTotal);
    $(".sub-total-club").empty().append(data.totals.clubTotal);
    $(".minicart-quantity").empty().append(data.numItems);
    $(".total-items-label .cart-qty").empty().append(data.numItems);
    $(".minicart-link").attr({
        "aria-label": data.resources.minicartCountOfItems,
        "title": data.resources.minicartCountOfItems
    });

    var $guestTotalContainer = $(".sub-total-container");

    if (!data.isMemberOfClubVerde || !data.hasClubProducts || data.totals.shouldDisplayGuestTotalPrice) {
        $guestTotalContainer.removeClass("d-none");
    } else {
        $guestTotalContainer.addClass("d-none");
    }

    if (data.hasClubProducts) {
        $(".sub-total-club-container").removeClass("d-none");
    } else {
        $(".sub-total-club-container").addClass("d-none");
        $(".sub-total-container").removeClass("d-none");
    }

    if (data.totals.orderLevelDiscountTotal.value > 0) {
        $(".coupon-code").html("-" + data.totals.orderLevelDiscountTotal.formatted);

        $(".order-discount").removeClass("hide-order-discount");
        $(".order-discount-total").empty()
            .append("- " + data.totals.orderLevelDiscountTotal.formatted);
    }

    if (data.totals.shippingLevelDiscountTotal.value > 0) {
        $(".coupon-code").html("-" + data.totals.shippingLevelDiscountTotal.formatted);

        $(".shipping-discount").removeClass("hide-shipping-discount");
        $(".shipping-discount-total").empty().append("- " +
            data.totals.shippingLevelDiscountTotal.formatted);
    } else {
        $(".shipping-discount").addClass("hide-shipping-discount");
    }

    data.items.forEach(function (item) {
        $(".item-" + item.UUID).empty();
        if (item.renderedPromotions) {
            $(".item-" + item.UUID).append(item.renderedPromotions);
        }
        if (item.priceTotal && item.priceTotal.renderedPrice) {
            $(".item-total-" + item.UUID).append(item.priceTotal.renderedPrice);
        }
    });
}

/**
 * re-renders the order totals and the number of items in the cart
 * @param {Object} message - Error message to display
 */
function createErrorNotification(message) {
    /**
     * @todo ACF3 To be updated to use alerts from a standardized file
     */
    var errorHtml = "<div class=\"alert alert-danger alert-dismissible valid-cart-error " +
        "fade show\" role=\"alert\">" +
        "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
        "<span aria-hidden=\"true\">&times;</span>" +
        "</button>" + message + "</div>";

    $(".cart-error").append(errorHtml);
}

/**
 * re-renders the approaching discount messages
 * @param {Object} approachingDiscounts - updated approaching discounts for the cart
 */
function updateApproachingDiscounts(approachingDiscounts) {
    var html = "";
    $(".approaching-discounts").empty();
    if (approachingDiscounts.length > 0) {
        approachingDiscounts.forEach(function (item) {
            html += "<div class=\"single-approaching-discount text-center\">"
                + item.discountMsg + "</div>";
        });
    }
    $(".approaching-discounts").append(html);
}

/**
 * Updates the availability of a product line item
 * @param {Object} data - AJAX response from the server
 * @param {string} uuid - The uuid of the product line item to update
 */
function updateAvailability(data, uuid) {
    var lineItem;
    var messages = "";

    for (var i = 0; i < data.items.length; i++) {
        if (data.items[i].UUID === uuid) {
            lineItem = data.items[i];
            break;
        }
    }

    if (lineItem) {
        $(".availability-" + lineItem.UUID).empty();
    }

    if (lineItem && lineItem.availability) {
        if (lineItem.availability.messages) {
            lineItem.availability.messages.forEach(function (message) {
                messages += "<p class=\"line-item-attributes\">" + message + "</p>";
            });
        }

        if (lineItem.availability.inStockDate) {
            messages += "<p class=\"line-item-attributes line-item-instock-date\">"
                + lineItem.availability.inStockDate
                + "</p>";
        }
    }

    if (lineItem) {
        $(".availability-" + lineItem.UUID).html(messages);
    }
}

/**
 * Finds an element in the array that matches search parameter
 * @param {array} array - array of items to search
 * @param {function} match - function that takes an element and returns a boolean indicating if the match is made
 * @returns {Object|null} - returns an element of the array that matched the query.
 */
function findItem(array, match) {
    for (var i = 0, l = array.length; i < l; i++) {
        if (match.call(this, array[i])) {
            return array[i];
        }
    }
    return null;
}

/**
 * Updates details of a product line item
 * @param {Object} data - AJAX response from the server
 * @param {string} uuid - The uuid of the product line item to update
 */
function updateProductDetails(data, uuid) {
    /**
     * @todo ACF1 MAJOR ISSUES here if kept as is.
     * Needs refactoring to allow other attributes to work out of the box
     */
    var lineItem = findItem(data.cartModel.items, function (item) {
        return item.UUID === uuid;
    });

    if (lineItem.variationAttributes) {
        var colorAttr = findItem(lineItem.variationAttributes, function (attr) {
            return attr.attributeId === "color";
        });

        if (colorAttr) {
            var colorSelector = ".Color-" + uuid;
            var newColor = "Color: " + colorAttr.displayValue;
            $(colorSelector).text(newColor);
        }

        var sizeAttr = findItem(lineItem.variationAttributes, function (attr) {
            return attr.attributeId === "size";
        });

        if (sizeAttr) {
            var sizeSelector = ".Size-" + uuid;
            var newSize = "Size: " + sizeAttr.displayValue;
            $(sizeSelector).text(newSize);
        }

        var imageSelector = ".card.product-info.uuid-" + uuid + " .item-image > img";
        $(imageSelector).attr("src", lineItem.images.small[0].url);
        $(imageSelector).attr("alt", lineItem.images.small[0].alt);
        $(imageSelector).attr("title", lineItem.images.small[0].title);
    }

    var qtySelector = ".quantity[data-uuid=\"" + uuid + "\"]";
    $(qtySelector).val(lineItem.quantity);
    $(qtySelector).data("pid", data.newProductId);

    $(".remove-product[data-uuid=\"" + uuid + "\"]").data("pid", data.newProductId);

    var priceSelector = ".line-item-price-" + uuid + " .sales .value";
    $(priceSelector).text(lineItem.price.sales.formatted);
    $(priceSelector).attr("content", lineItem.price.sales.decimalPrice);

    if (lineItem.price.list) {
        var listPriceSelector = ".line-item-price-" + uuid + " .list .value";
        $(listPriceSelector).text(lineItem.price.list.formatted);
        $(listPriceSelector).attr("content", lineItem.price.list.decimalPrice);
    }
}

/**
 * Generates the modal window on the first call.
 * @todo ACF2 Needs to be updated and not use this way again.
 * A unified modal into an external file should be made and called only from there
 */
function getModalHtmlElement() {
    if ($("#editProductModal").length !== 0) {
        $("#editProductModal").remove();
    }
    var htmlString = "<!-- Modal -->"
        + "<div class=\"modal fade\" id=\"editProductModal\" tabindex=\"-1\" role=\"dialog\">"
        + "<span class=\"enter-message sr-only\"></span>"
        + "<!-- Modal content-->"
        + "<div class=\"modal-content\">"
        + "<div class=\"modal-header\">"
        + "    <button type=\"button\" class=\"close pull-right\" data-dismiss=\"modal\">"
        + "        <span aria-hidden=\"true\">&times;</span>"
        + "        <span class=\"sr-only\"> </span>"
        + "    </button>"
        + "</div>"
        + "<div class=\"modal-body\"></div>"
        + "<div class=\"modal-footer\"></div>"
        + "</div>"
        + "</div>"
        + "</div>";
    $("body").append(htmlString);
}

/**
 * Parses the html for a modal window
 * @param {string} html - representing the body and footer of the modal window
 *
 * @return {Object} - Object with properties body and footer.
 */
function parseHtml(html) {
    var $html = $("<div>").append($.parseHTML(html));

    var body = $html.find(".product-quickview");
    var footer = $html.find(".modal-footer").children();

    return { body: body, footer: footer };
}

/**
 * replaces the content in the modal window for product variation to be edited.
 * @param {string} editProductUrl - url to be used to retrieve a new product model
 */
function fillModalElement(editProductUrl) {
    $(".modal-body").spinner().start();
    $.ajax({
        url: editProductUrl,
        method: "GET",
        dataType: "json",
        success: function (data) {
            var parsedHtml = parseHtml(data.renderedTemplate);

            $("#editProductModal .modal-body").empty();
            $("#editProductModal .modal-body").html(parsedHtml.body);
            $("#editProductModal .modal-footer").html(parsedHtml.footer);
            $("#editProductModal .modal-header .close .sr-only").text(data.closeButtonText);
            $("#editProductModal .enter-message").text(data.enterDialogMessage);
            $("#editProductModal").modal("show");
            $.spinner().stop();
        },
        error: function () {
            $.spinner().stop();
        }
    });
}

/**
 * replace content of modal
 * @param {string} actionUrl - url to be used to remove product
 * @param {string} productID - pid
 * @param {string} productName - product name
 * @param {string} uuid - uuid
 */
function confirmDelete(actionUrl, productID, productName, uuid, $deleteButton) {
    var $card = $deleteButton.closest(".card");
    var brand = $card.find(".product-brand").html();
    var imgSrc = $card.find(".product-image").attr("src");

    var $deleteConfirmBtn = $("body").find(".cart-delete-confirmation-btn");
    var $productToRemoveSpanName = $("body").find(".product-to-remove");
    var $productToRemoveSpanBrand = $("body").find(".product-to-remove-brand");
    var $productToRemoveSpanImg = $("body").find(".product-to-remove-img");

    $deleteConfirmBtn.data("pid", productID);
    $deleteConfirmBtn.data("action", actionUrl);
    $deleteConfirmBtn.data("uuid", uuid);

    $productToRemoveSpanName.empty().append(productName);
    $productToRemoveSpanBrand.empty().append(brand);
    $productToRemoveSpanImg.attr("src", imgSrc);
}

/**
 * check if all products are available
 * @param {Object} data containing the basket information
 */
function checkUnavailableProducts(data) {
    // check if the basket has items
    var items = data.items;

    // set default false unavailable items
    var unavailableItems = false;

    // loop through all items and check availability
    $.each(items, function (index, item) {
        if (item.available === false) {
            unavailableItems = true;
            return false;
        }
    });

    // remove disabled class from proceed to payment button
    if (unavailableItems === false) {
        $(".btn-payment-check").removeClass("disabled");
    }
}

module.exports = function () {
    $("body").on("click", ".remove-product", function (e) {
        e.preventDefault();

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push($(this).data("gtm"));

        var actionUrl = $(this).data("action");
        var productID = $(this).data("pid");
        var productName = $(this).data("name");
        var uuid = $(this).data("uuid");
        var customModalClass = $(this).data("customModalClass");
        $("body").find(".modal-remove-product").addClass(customModalClass);
        confirmDelete(actionUrl, productID, productName, uuid, $(this));
    });

    $("body").on("afterRemoveFromCart", function (e, data) {
        e.preventDefault();
        confirmDelete(data.actionUrl, data.productID, data.productName, data.uuid);
    });

    $(".optional-promo").click(function (e) {
        e.preventDefault();
        $(".promo-code-form").toggle();
    });

    $("body").on("click", ".cart-delete-confirmation-btn", function (e) {
        e.preventDefault();

        var productID = $(this).data("pid");
        var url = $(this).data("action");
        var uuid = $(this).data("uuid");
        var urlParams = {
            pid: productID,
            uuid: uuid
        };

        url = appendToUrl(url, urlParams);

        $("body > .modal-backdrop").remove();

        $.spinner().start();
        $.ajax({
            url: url,
            type: "get",
            dataType: "json",
            success: function (data) {
                $.spinner().stop();
                if (data.basket.items.length === 0) {
                    $(".cart").empty();
                    $(".number-of-items").empty().append(data.basket.resources.numberOfItems);
                    $(".minicart-quantity").empty().append(data.basket.numItems);
                    $(".total-items-label .cart-qty").empty().append(data.basket.numItems);
                    $(".minicart-quantity").addClass("d-none");
                    $(".minicart-overlay").collapse("hide");
                    $(".minicart-link").attr({
                        "aria-label": data.basket.resources.minicartCountOfItems,
                        "title": data.basket.resources.minicartCountOfItems
                    });
                    $(".minicart .popover").empty();
                    $(".minicart .popover").removeClass("show");
                    $("body").removeClass("modal-open overflow-hidden");
                    $("html").removeClass("veiled");

                    if ($(document).find(".cart-page").length)  {
                        location.reload();
                    }
                } else {
                    if (data.toBeDeletedUUIDs && data.toBeDeletedUUIDs.length > 0) {
                        for (var i = 0; i < data.toBeDeletedUUIDs.length; i++) {
                            $(".uuid-" + data.toBeDeletedUUIDs[i]).remove();
                        }
                    }
                    $(".uuid-" + uuid).remove();
                    if (!data.basket.hasBonusProduct) {
                        $(".bonus-product").remove();
                    }
                    $(".coupons-and-promos").empty().append(data.basket.totals.discountsHtml);
                    updateCartTotals(data.basket);
                    updateItemNumber(data.basket);
                    updateApproachingDiscounts(data.basket.approachingDiscounts);
                    $("body").trigger("setShippingMethodSelection", data.basket);
                    validateBasket(data.basket);

                    // check if all products are available
                    checkUnavailableProducts(data.basket);
                }

                $("body").trigger("cart:update");

            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                } else {
                    createErrorNotification(err.responseJSON.errorMessage);
                    $.spinner().stop();
                }
            }
        });
    });

    //Reset remove popup positioning
    $(".modal-remove-product").on("hidden.bs.modal", function () {
        if ($(this).hasClass("minicart-remove-popup")) {
            $(this).removeClass("minicart-remove-popup");
        }
    });

    $("body").on("change", ".quantity-form .quantity", function () {
        var preSelectQty = $(this).data("pre-select-qty");
        var quantity = $(this).val();
        var productID = $(this).data("pid");
        var url = $(this).data("action");
        var uuid = $(this).data("uuid");

        var urlParams = {
            pid: productID,
            quantity: quantity,
            uuid: uuid
        };
        url = appendToUrl(url, urlParams);

        $(this).parents(".card").spinner().start();

        $.ajax({
            url: url,
            type: "get",
            context: this,
            dataType: "json",
            success: function (data) {
                $(".quantity[data-uuid=\"" + uuid + "\"]").val(quantity);
                $(".coupons-and-promos").empty().append(data.totals.discountsHtml);
                updateCartTotals(data);
                updateApproachingDiscounts(data.approachingDiscounts);
                updateAvailability(data, uuid);
                updateItemNumber(data);
                $(this).data("pre-select-qty", quantity);

                $("body").trigger("cart:update");

                $(this).parents(".card").spinner().stop();

                if ($(this).parents(".product-info").hasClass("bonus-product-line-item") && $(".cart-page").length) {
                    location.reload();
                }
            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                } else {
                    createErrorNotification(err.responseJSON.errorMessage);
                    $(this).val(parseInt(preSelectQty, 10));
                    $(this).parents(".card").spinner().stop();
                }
            }
        });
    });

    $(".shippingMethods").change(function () {
        var url = $(this).attr("data-actionUrl");
        var urlParams = {
            methodID: $(this).find(":selected").attr("data-shipping-id")
        };
        // url = appendToUrl(url, urlParams);

        $(".totals").spinner().start();
        $.ajax({
            url: url,
            type: "post",
            dataType: "json",
            data: urlParams,
            success: function (data) {
                if (data.error) {
                    window.location.href = data.redirectUrl;
                } else {
                    $(".coupons-and-promos").empty().append(data.totals.discountsHtml);
                    updateCartTotals(data);
                    updateApproachingDiscounts(data.approachingDiscounts);
                    validateBasket(data);
                }
                $.spinner().stop();
            },
            error: function (err) {
                if (err.redirectUrl) {
                    window.location.href = err.redirectUrl;
                } else {
                    createErrorNotification(err.responseJSON.errorMessage);
                    $.spinner().stop();
                }
            }
        });
    });

    $(".promo-code-form").submit(function (e) {
        e.preventDefault();
        $.spinner().start();
        $(".coupon-missing-error").hide();
        $(".coupon-error-message").empty();
        if (!$(".coupon-code-field").val()) {
            $(".promo-code-form .form-control").addClass("is-invalid");
            $(".promo-code-form .form-control").attr("aria-describedby", "missingCouponCode");
            $(".coupon-missing-error").show();
            $.spinner().stop();
            return false;
        }
        var $form = $(".promo-code-form");
        $(".promo-code-form .form-control").removeClass("is-invalid");
        $(".coupon-error-message").empty();

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push($(this).data("gtm"));

        $.ajax({
            url: $form.attr("action"),
            type: "GET",
            dataType: "json",
            data: $form.serialize(),
            success: function (data) {
                if (data.error) {
                    $(".promo-code-form .form-control").addClass("is-invalid");
                    $(".promo-code-form .form-control").attr("aria-describedby", "invalidCouponCode");
                    $(".coupon-error-message").empty().append(data.errorMessage);
                } else {
                    location.reload();
                }
                $.spinner().stop();
            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                } else {
                    createErrorNotification(err.errorMessage);
                    $.spinner().stop();
                }
            }
        });
        return false;
    });

    $("body").on("click", ".remove-coupon", function (e) {
        e.preventDefault();

        var url = $(this).data("action");
        var uuid = $(this).data("uuid");
        var couponCode = $(this).data("code");
        var urlParams = {
            code: couponCode,
            uuid: uuid
        };

        url = appendToUrl(url, urlParams);

        $.spinner().start();
        $.ajax({
            url: url,
            type: "get",
            dataType: "json",
            success: function () {
                location.reload();
            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                } else {
                    createErrorNotification(err.responseJSON.errorMessage);
                    $.spinner().stop();
                }
            }
        });
    });

    $("body").on("click", ".cart-page .bonus-product-button", function () {
        $.spinner().start();
        $(this).addClass("launched-modal");
        $.ajax({
            url: $(this).data("url"),
            method: "GET",
            dataType: "json",
            success: function (data) {
                base.methods.editBonusProducts(data);
                $.spinner().stop();
            },
            error: function () {
                $.spinner().stop();
            }
        });
    });

    $("body").on("hidden.bs.modal", "#chooseBonusProductModal", function () {
        $("#chooseBonusProductModal").remove();
        $(".modal-backdrop").remove();
        $("body").removeClass("modal-open");

        if ($(".cart-page").length) {
            $(".launched-modal .btn-outline-primary").trigger("focus");
            $(".launched-modal").removeClass("launched-modal");
        }
    });

    $("body").on("click", ".cart-page .product-edit .edit, .cart-page .bundle-edit .edit", function (e) {
        e.preventDefault();

        var editProductUrl = $(this).attr("href");
        getModalHtmlElement();
        fillModalElement(editProductUrl);
    });

    $("body").on("shown.bs.modal", "#editProductModal", function () {
        $("#editProductModal").siblings().attr("aria-hidden", "true");
        $("#editProductModal .close").focus();
    });

    $("body").on("hidden.bs.modal", "#editProductModal", function () {
        $("#editProductModal").siblings().attr("aria-hidden", "false");
    });

    $("body").on("keydown", "#editProductModal", function (e) {
        var focusParams = {
            "event": e,
            "containerSelector": "#editProductModal",
            "firstElementSelector": ".close",
            "lastElementSelector": ".update-cart-product-global",
            "nextToLastElementSelector": ".modal-footer .quantity-select"
        };
        focusHelper.setTabNextFocus(focusParams);
    });

    $("body").on("product:updateAddToCart", function (e, response) {
        // update global add to cart (single products, bundles)
        var dialog = $(response.$productContainer)
            .closest(".quick-view-dialog");

        $(".update-cart-product-global", dialog).attr("disabled",
            !$(".global-availability", dialog).data("ready-to-order")
            || !$(".global-availability", dialog).data("available")
        );
    });

    $("body").on("product:updateAvailability", function (e, response) {
        // bundle individual products
        $(".product-availability", response.$productContainer)
            .data("ready-to-order", response.product.readyToOrder)
            .data("available", response.product.available)
            .find(".availability-msg")
            .empty()
            .html(response.message);


        var dialog = $(response.$productContainer)
            .closest(".quick-view-dialog");

        if ($(".product-availability", dialog).length) {
            // bundle all products
            var allAvailable = $(".product-availability", dialog).toArray()
                .every(function (item) { return $(item).data("available"); });

            var allReady = $(".product-availability", dialog).toArray()
                .every(function (item) { return $(item).data("ready-to-order"); });

            $(".global-availability", dialog)
                .data("ready-to-order", allReady)
                .data("available", allAvailable);

            $(".global-availability .availability-msg", dialog).empty()
                .html(allReady ? response.message : response.resources.info_selectforstock);
        } else {
            // single product
            $(".global-availability", dialog)
                .data("ready-to-order", response.product.readyToOrder)
                .data("available", response.product.available)
                .find(".availability-msg")
                .empty()
                .html(response.message);
        }
    });

    $("body").on("product:afterAttributeSelect", function (e, response) {
        if ($(".modal.show .product-quickview .bundle-items").length) {
            $(".modal.show").find(response.container).data("pid", response.data.product.id);
            $(".modal.show").find(response.container).find(".product-id").text(response.data.product.id);
        } else {
            $(".modal.show .product-quickview").data("pid", response.data.product.id);
        }
    });

    $("body").on("change", ".quantity-select", function () {
        var selectedQuantity = $(this).val();
        $(".modal.show .update-cart-url").data("selected-quantity", selectedQuantity);
    });

    $("body").on("click", ".update-cart-product-global", function (e) {
        e.preventDefault();

        var updateProductUrl = $(this).closest(".cart-and-ipay").find(".update-cart-url").val();
        var selectedQuantity = $(this).closest(".cart-and-ipay").find(".update-cart-url").data("selected-quantity");
        var uuid = $(this).closest(".cart-and-ipay").find(".update-cart-url").data("uuid");

        var form = {
            uuid: uuid,
            pid: base.getPidValue($(this)),
            quantity: selectedQuantity
        };

        $(this).parents(".card").spinner().start();
        if (updateProductUrl) {
            $.ajax({
                url: updateProductUrl,
                type: "post",
                context: this,
                data: form,
                dataType: "json",
                success: function (data) {
                    $("#editProductModal").modal("hide");

                    $(".coupons-and-promos").empty().append(data.cartModel.totals.discountsHtml);
                    updateCartTotals(data.cartModel);
                    updateApproachingDiscounts(data.cartModel.approachingDiscounts);
                    updateAvailability(data.cartModel, uuid);
                    updateProductDetails(data, uuid);
                    if (data.hasUnavailableProducts) {
                        $(".checkout-btn").addClass("disabled");
                    } else {
                        $(".checkout-btn").removeClass("disabled");
                    }
                    if (data.uuidToBeDeleted) {
                        $(".uuid-" + data.uuidToBeDeleted).remove();
                    }

                    validateBasket(data.cartModel);

                    $("body").trigger("cart:update");

                    $.spinner().stop();
                },
                error: function (err) {
                    if (err.responseJSON.redirectUrl) {
                        window.location.href = err.responseJSON.redirectUrl;
                    } else {
                        createErrorNotification(err.responseJSON.errorMessage);
                        $.spinner().stop();
                    }
                }
            });
        }
    });

    base.availability();
    base.addToCart();
    base.selectAttribute();
    base.colorAttribute();
    base.removeBonusProduct();
    base.selectBonusProduct();
    base.enableBonusProductSelection();
    base.showMoreBonusProducts();
    base.addBonusProductsToCart();
    base.focusChooseBonusProductModal();
    base.trapChooseBonusProductModalFocus();
    base.onClosingChooseBonusProductModal();
    base.checkChooseBonusProductModal();
    base.closeModalProductRecommendation();
};
