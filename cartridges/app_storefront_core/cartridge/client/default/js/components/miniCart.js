"use strict";

var cart = require("../cart/cart");
var base = require("../product/base");

var updateMiniCart = true;
var recentProduct = "";

module.exports = function () {
    cart();

    $(".minicart").on("count:update", function (event, count) {
        if (count && $.isNumeric(count.quantityTotal)) {
            $(".minicart .minicart-quantity").text(count.quantityTotal);
            $(".minicart .minicart-link").attr({
                "aria-label": count.minicartCountOfItems,
                "title": count.minicartCountOfItems
            });
        }
    });

    if ($(window).width() > 991) {
        $(".minicart .minicart-trigger").on("touchstart click", function () {
            var url = $(this).data("action-url");

            if (!updateMiniCart) {
                $(".minicart .popover, .minicart-overlay").addClass("show opaque-overlay");
                $("body").addClass("overflow-hidden");
                return;
            }

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event : "clickMinicart",
                label : window.location.href
            });

            $(".minicart .popover, .minicart-overlay").addClass("show opaque-overlay");
            $("body").addClass("overflow-hidden");
            $(".account-dropdown").collapse("hide");
            $.get(url, function (data) {
                $(".minicart .popover").empty();
                $(".minicart .popover").append(data);

                if (recentProduct) {
                    var $recentCard = $(".card.uuid-" + recentProduct);
                    if ($recentCard.length == 1) {
                        $recentCard[0].scrollIntoView(false);
                        $recentCard.addClass("last-updated");
                        setTimeout(function () {
                            $recentCard.removeClass("last-updated");
                        }, 500);
                        recentProduct = "";
                    }
                }
            });
        });
    }

    $("#minicart-collapse").on("hide.bs.collapse", function () {
        $("body").removeClass("overflow-hidden");
        $(".minicart .popover").removeClass("show");
        $(".minicart .popover").empty();
    });

    $("body").on("change", ".cart-elements-container .quantity", function () {
        if ($(this).parents(".bonus-product-line-item").length) {
            window.location.reload();
        } else {
            base.checkChooseBonusProductModal();
        }
    });

    $(document).on("click", ".minicart-overlay", function () {
        if ($(".modal-remove-product").length) {
            $(".modal-remove-product").modal("hide");
        }
    });

    $("body").on("product:afterAddToCart cart:update", function (event, data) {
        updateMiniCart = true;
        if ($("#sor-modal").length) {
            $("#sor-modal").modal("hide");
        }
        if (data && data.pliUUID) {
            recentProduct = data.pliUUID;
            $(".minicart").trigger("focusin");
        }
    });
    $(".cart-elements-container").on("click", ".subtract-product-quantity", function () {
        var $inputQuantity = $(this).siblings(".quantity");
        var quantity = parseInt($inputQuantity.val(), 10);

        if (quantity > 1) {
            $inputQuantity.val(quantity - 1);
            $inputQuantity.trigger("change");
            $(this).parents(".quantity-form").find(".max-quantity-warning").addClass("d-none");
        }
    });
    $(".cart-elements-container").on("click", ".add-product-quantity", function () {
        var $inputQuantity = $(this).siblings(".quantity");
        var quantity = parseInt($inputQuantity.val(), 10);
        var maxQuantity = parseInt($(this).data("stock-quantity"), 10);

        if (quantity < maxQuantity) {
            $inputQuantity.val(quantity + 1);
            $inputQuantity.trigger("change");
        } else if (quantity == maxQuantity) {
            $(this).parents(".quantity-form").find(".max-quantity-warning").removeClass("d-none");
        }
    });
    $("body").on("click", function (e) {
        if (!e.target.classList.contains("add-product-quantity")) {
            $(".max-quantity-warning").addClass("d-none");
        }
    });
};
