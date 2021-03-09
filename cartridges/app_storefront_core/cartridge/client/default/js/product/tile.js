"use strict";

/**
 * updates the product shipping divs when a different variation is selected
 * @param {string} product - product object
 * @param {jQuery} productContainer - element for current product
 */
function updateShippingMethods(product, productContainer) {
    var trackShippingElem = $(productContainer).find(".track-shipping");
    var storeShippingElem = $(productContainer).find(".store-shipping");
    var homeDelivery = product.custom.shippingMethods.homeDelivery;
    var storePickup = product.custom.shippingMethods.storePickup || product.availableForInStorePickup;

    if (!trackShippingElem.length && !storeShippingElem.length) {
        return;
    }

    trackShippingElem.css("display", homeDelivery ? "block" : "none");
    storeShippingElem.css("display", storePickup ? "block" : "none");
    if (trackShippingElem.find("d-flex")) {
        trackShippingElem.find("d-flex").css("display", !storePickup ? "block" : "none");
    }
    if (storeShippingElem.find("d-flex")) {
        storeShippingElem.find("d-flex").css("display", !homeDelivery ? "block" : "none");
    }

}

/**
 * updates the badges imgs when a different variation is selected
 * @param {string} product - product object
 * @param {jQuery} productContainer - element for current product
 */
function updateCustomBadges(product, productContainer) {
    var bioequivalenceElem = $(productContainer).find("img.bioequivalence");
    var expressdeliveryElem = $(productContainer).find("img.expressdelivery");
    var bioequivalenceUrl = product.custom.badges.bioequivalence;
    var expressdeliveryUrl = product.custom.badges.expressdelivery;

    if (!bioequivalenceElem.length && !expressdeliveryElem.length) {
        return;
    }
    bioequivalenceElem.attr("src", bioequivalenceUrl);
    expressdeliveryElem.attr("src", expressdeliveryUrl);
    bioequivalenceElem.css("display", bioequivalenceUrl ? "block" : "none");
    expressdeliveryElem.css("display", expressdeliveryUrl ? "block" : "none");
}

/**
 * updates the product name when a different variation is selected
 * @param {string} product - product object
 * @param {jQuery} productContainer - element for current product
 */
function updateProductLink(product, productContainer) {
    var productLink = $(productContainer).find(".pdp-link .link");
    var linkText = product.productName;

    if (product.productName.length > 50) {
        linkText = $.trim(product.productName).substring(0, 50).split(" ").slice(0, -1).join(" ") + "...";
    }

    productLink.html(linkText);
}

/**
 * updates the product pricing when a different variation is selected
 * @param {string} product - product object
 * @param {jQuery} productContainer - element for current product
 */
function updateProductPricing(product, productContainer) {
    var priceSelector = $(productContainer).find(".price");
    priceSelector.replaceWith(product.price.html);
}

module.exports = {
    updateAttribute: function () {
        $("body").on("product:afterAttributeSelect", function (e, response) {
            if (!$(response.container).hasClass(".bundle-item")) {
                $(response.container).data("pid", response.data.product.id);
            }
        });
    },
    updateAddToCart: function () {
        $("body").on("product:updateAddToCart", function (e, response) {
            // update local add to cart (for sets)
            var button = response.$productContainer.find("button.add-to-cart").first();
            var productAvailable = (response.product.readyToOrder && response.product.available);
            $(button).attr("disabled", !productAvailable);
            var buttonTextInput = button.siblings(".add-to-cart-text-"+(productAvailable?"enabled":"disabled"));
            if (buttonTextInput) {
                button.find("span.add-to-cart-text").html(
                    buttonTextInput.val()
                );
            }

            // update global add to cart (single products, bundles)
            var dialog = $(response.$productContainer).closest(".quick-view-dialog");

            $(".add-to-cart-global", dialog).attr(
                "disabled",
                !$(".global-availability", dialog).data("ready-to-order") ||
                    !$(".global-availability", dialog).data("available")
            );
        });
    },
    showSpinner: function () {
        $("body").on("product:beforeAddToCart product:beforeAttributeSelect", function (e, data) {
            if ($(data.container).hasClass("product-detail")) {
                $.spinner().start();
            } else {
                $(data.container).spinner().start();
            }
        });
    },
    updateAttributes: function () {
        $("body").on("product:statusUpdate", function (e, data) {
            if (!data.product && !data.$productContainer && !data.$productContainer.length) {
                return;
            }
            updateProductLink(data.product, data.$productContainer);
            updateProductPricing(data.product, data.$productContainer);
            updateShippingMethods(data.product, data.$productContainer);
            updateCustomBadges(data.product, data.$productContainer);
        });
    }
};
