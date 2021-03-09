"use strict";
var base = require("./base");

/**
 * updates the product name when a different variation is selected
 * @param {string} product - product object
 * @param {jQuery} productContainer - element for current product
 */
function updateProductName(product, productContainer) {
    var productName = $(productContainer).find(".product-name");

    productName.html(product.productName);
}

function updateShippingMethods(product, productContainer) {
    var trackShippingElem = $(productContainer).find(".product-detail-shipping").find(".track-shipping");
    var storeShippingElem = $(productContainer).find(".product-detail-shipping").find(".store-shipping");
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

function updateCustomBadges(product, productContainer) {
    var bioequivalenceElem = $(productContainer).find(".carousel").find("img.bioequivalence");
    var expressdeliveryElem = $(productContainer).find(".carousel").find("img.expressdelivery");
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

module.exports = {
    availability: base.availability,

    updateAttributesAndDetails: function () {
        $("body").on("product:statusUpdate", function (e, data) {
            var $productContainer = data.$productContainer;

            data.product.attributes.forEach((attribute)=>{
                if (attribute.ID === "MedicalProductsProperties") {
                    attribute.attributes.forEach((innerAttribute)=>{
                        if (innerAttribute.label === "Notation") {
                            var productNotation = $productContainer.find("p.product-notation");
                            if (productNotation) {
                                $(productNotation).text(innerAttribute.value[0]);
                            }
                        }
                    });
                } else if (attribute.ID === "ProductInformation") {
                    attribute.attributes.forEach((innerAttribute)=>{
                        if (innerAttribute.label === "PUM") {
                            var productPUM = $productContainer.find("span.pum-text-special");
                            if (productPUM) {
                                $(productPUM).text(innerAttribute.value[0]);
                            }
                        }
                    });
                }

            });

            Object.entries(data.product.tabs).forEach(([key, value]) => {
                if (value) {
                    var spanElement = $productContainer.find("span."+key.replace(/\s/g, ""));
                    if (spanElement.length) {
                        if (key.includes("Content")) {
                            spanElement.html(value);
                        } else if (key.includes("Title")) {
                            spanElement.text(value);
                        }
                    }
                }
            });

            updateProductName(data.product, data.$productContainer);
            updateShippingMethods(data.product, data.$productContainer);
            updateCustomBadges(data.product, data.$productContainer);
        });
    },
    updateAttribute: function () {
        $("body").on("product:afterAttributeSelect", function (e, response) {
            if ($(".product-detail>.bundle-items").length || $(".product-set-detail").eq(0)) {
                response.container.data("pid", response.data.product.id);
                response.container.find(".product-id").text(response.data.product.id);
            } else {
                $(".product-id").text(response.data.product.id);
                $(".product-detail:not(\".bundle-item\")").data("pid", response.data.product.id);
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

            var enable = $(".product-availability").toArray().every(function (item) {
                return $(item).data("available") && $(item).data("ready-to-order");
            });
            $("button.add-to-cart-global").attr("disabled", !enable);
        });
    },
    updateAvailability: function () {
        $("body").on("product:updateAvailability", function (e, response) {
            $("div.availability", response.$productContainer)
                .data("ready-to-order", response.product.readyToOrder)
                .data("available", response.product.available);

            $(".availability-msg", response.$productContainer)
                .empty().html(response.message);

            if ($(".global-availability").length) {
                var allAvailable = $(".product-availability").toArray()
                    .every(function (item) { return $(item).data("available"); });

                var allReady = $(".product-availability").toArray()
                    .every(function (item) { return $(item).data("ready-to-order"); });

                $(".global-availability")
                    .data("ready-to-order", allReady)
                    .data("available", allAvailable);

                $(".global-availability .availability-msg").empty()
                    .html(allReady ? response.message : response.resources.info_selectforstock);
            }
        });
    },
    sizeChart: function () {
        var $sizeChart = $(".size-chart-collapsible");
        $(".size-chart a").on("click", function (e) {
            e.preventDefault();
            var url = $(this).attr("href");
            if ($sizeChart.is(":empty")) {
                $.ajax({
                    url: url,
                    type: "get",
                    dataType: "json",
                    success: function (data) {
                        $sizeChart.append(data.content);
                    }
                });
            }
            $sizeChart.toggleClass("active");
        });

        $("body").on("click touchstart", function (e) {
            if ($(".size-chart").has(e.target).length <= 0) {
                $sizeChart.removeClass("active");
            }
        });
    },
    copyProductLink: function () {
        $("body").on("click", "#fa-link", function () {
            event.preventDefault();
            var $temp = $("<input>");
            $("body").append($temp);
            $temp.val($("#shareUrl").val()).select();
            document.execCommand("copy");
            $temp.remove();
            $(".copy-link-message").attr("role", "alert");
            $(".copy-link-message").removeClass("d-none");
            setTimeout(function () {
                $(".copy-link-message").addClass("d-none");
            }, 3000);
        });
    },

    focusChooseBonusProductModal: base.focusChooseBonusProductModal()
};
