"use strict";

var cart = require("../cart/cart");
var scrollAnimate = require("./scrollAnimate");

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

    $(".minicart").on("mouseenter focusin touchstart", function () {
        if ($(".search:visible").length === 0) {
            return;
        }
        var url = $(".minicart").data("action-url");
        var count = parseInt($(".minicart .minicart-quantity").text(), 10);

        if (count !== 0) {
            if (!updateMiniCart) {
                $(".minicart .popover").addClass("show");
                return;
            }

            $(".minicart .popover").addClass("show");
            $(".minicart .popover").spinner().start();
            $.get(url, function (data) {
                $(".minicart .popover").empty();
                $(".minicart .popover").append(data);
                $.spinner().stop();

                if (recentProduct) {
                    var $recentCard = $(".card.uuid-" + recentProduct);
                    if ($recentCard.length == 1) {
                        $recentCard[0].scrollIntoView(false);
                        $recentCard.addClass("last-updated");
                        setTimeout(function() {
                            $recentCard.removeClass("last-updated");
                        }, 500);
                        recentProduct = "";
                        scrollAnimate();
                    } else {
                        scrollAnimate();
                    }
                }

                updateMiniCart = false;
            });
        }
    });
    $("body").on("touchstart click", function (e) {
        if ($(".minicart").has(e.target).length <= 0) {
            $(".minicart .popover").removeClass("show");
        }
    });
    $(".minicart").on("mouseleave focusout", function (event) {
        if ((event.type === "focusout" && $(".minicart").has(event.target).length > 0) ||
            (event.type === "mouseleave" && $(event.target).is(".minicart .quantity")) ||
            $("body").hasClass("modal-open")) {
            event.stopPropagation();
            return;
        }
        $(".minicart .popover").removeClass("show");
    });
    $("body").on("change", ".minicart .quantity", function () {
        if ($(this).parents(".bonus-product-line-item").length && $(".cart-page").length) {
            location.reload();
        }
    });
    $("body").on("product:afterAddToCart cart:update", function (event, data) {
        updateMiniCart = true;
        if (data && data.pliUUID) {
            recentProduct = data.pliUUID;
            $(".minicart").trigger("focusin");
        }
    });
};
