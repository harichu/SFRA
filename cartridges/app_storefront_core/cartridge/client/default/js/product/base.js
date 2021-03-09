"use strict";

var focusHelper = require("../components/focus");
var generalUtils = require("../generalUtils");


/**
 * Retrieves the relevant pid value
 * @param {jquery} $el - DOM container for a given add to cart button
 * @return {string} - value to be used when adding product to cart
 */
function getPidValue($el) {
    var pid;

    if ($("#quickViewModal").hasClass("show") && !$(".product-set").length) {
        pid = $($el).closest(".modal-content").find(".product-quickview").data("pid");
    } else if ($(".product-set-detail").length || $(".product-set").length) {
        pid = $($el).closest(".product-wrapper").find(".product-id").text();
    } else {
        pid = $($el).closest(".product-wrapper:not(\".bundle-item\")").data("pid");
    }

    return pid;
}

/**
 * Retrieve contextual quantity selector
 * @param {jquery} $el - DOM container for the relevant quantity
 * @return {jquery} - quantity selector DOM container
 */
function getQuantitySelector($el) {
    return ($el && $el.length) ?
        $($el).closest(".product-wrapper").find(".quantity-select") :
        $(".quantity-select");
}

/**
 * Retrieves the value associated with the Quantity pull-down menu
 * @param {jquery} $el - DOM container for the relevant quantity
 * @return {string} - value found in the quantity input
 */
function getQuantitySelected($el) {
    return getQuantitySelector($el).val();
}

/**
 * Process the attribute values for an attribute that has image swatches
 *
 * @param {Object} attr - Attribute
 * @param {string} attr.id - Attribute ID
 * @param {Object[]} attr.values - Array of attribute value objects
 * @param {string} attr.values.value - Attribute coded value
 * @param {string} attr.values.url - URL to de/select an attribute value of the product
 * @param {boolean} attr.values.isSelectable - Flag as to whether an attribute value can be
 *     selected.  If there is no variant that corresponds to a specific combination of attribute
 *     values, an attribute may be disabled in the Product Detail Page
 * @param {jQuery} $productContainer - DOM container for a given product
 * @param {Object} msgs - object containing resource messages
 */
function processSwatchValues(attr, $productContainer, msgs) {
    attr.values.forEach(function (attrValue) {
        var $swatchButton = $productContainer.find("[data-attr=\"" + attr.id + "\"] [data-attr-value=\"" +
            attrValue.value + "\"]");

        if (attrValue.selected) {
            $swatchButton.addClass("selected");
            $swatchButton.siblings(".selected-assistive-text").text(msgs.assistiveSelectedText);
        } else {
            $swatchButton.removeClass("selected");
            $swatchButton.siblings(".selected-assistive-text").empty();
        }

        if (attrValue.url) {
            $swatchButton.attr("data-url", attrValue.url);
        }
    });
}

/**
 * Process attribute values associated with an attribute that does not have image swatches
 *
 * @param {Object} attr - Attribute
 * @param {string} attr.id - Attribute ID
 * @param {Object[]} attr.values - Array of attribute value objects
 * @param {string} attr.values.value - Attribute coded value
 * @param {string} attr.values.url - URL to de/select an attribute value of the product
 * @param {boolean} attr.values.isSelectable - Flag as to whether an attribute value can be
 *     selected.  If there is no variant that corresponds to a specific combination of attribute
 *     values, an attribute may be disabled in the Product Detail Page
 * @param {jQuery} $productContainer - DOM container for a given product
 */
function processNonSwatchValues(attr, $productContainer) {
    var $attr = "[data-attr=\"" + attr.id + "\"]";
    var $defaultOption = $productContainer.find($attr + " option:first");
    $defaultOption.attr("value", attr.resetUrl);

    attr.values.forEach(function (attrValue) {
        var $attrValue = $productContainer
            .find($attr + " [data-attr-value=\"" + attrValue.value + "\"]");
        $attrValue.attr("value", attrValue.url)
            .removeAttr("disabled");

        if (!attrValue.selectable) {
            $attrValue.attr("disabled", true);
        }
    });
}

/**
 * Routes the handling of attribute processing depending on whether the attribute has image
 *     swatches or not
 *
 * @param {Object} attrs - Attribute
 * @param {string} attr.id - Attribute ID
 * @param {jQuery} $productContainer - DOM element for a given product
 * @param {Object} msgs - object containing resource messages
 * @param {string} attributeSelected - Id of the seletor group
 */
function updateAttrs(attrs, $productContainer, msgs, attributeSelected) {
    // Currently, the only attribute type that has image swatches is Color.
    var attrsWithSwatches = ["color"];

    var positionsAfterSelected = 0;
    attrs.baseAttributes.concat(attrs.customAttributes).forEach(function (attr) {
        if (attrsWithSwatches.indexOf(attr.id) > -1) {
            processSwatchValues(attr, $productContainer, msgs);
        } else {
            processNonSwatchValues(attr, $productContainer);
        }
        positionsAfterSelected = validateSelectors(attr, $productContainer, attributeSelected, positionsAfterSelected);
    });
}

/**
 * Validate product selectors to be activeted in the correct order
 *
 * @param {Object} attrs - Attribute
 * @param {string} attr.id - Attribute ID
 * @param {jQuery} $productContainer - DOM element for a given product
 * @param {string} attributeSelected - Id of the seletor group
 * @param {number} positionsAfterSelected - Number of positions this attr are after the selected attr
 */
function validateSelectors(attr, $productContainer, attributeSelected, positionsAfterSelected) {
    var selector = $productContainer.find("select[class*=\"select-"+attr.id+"\"]");
    if (attr.id === attributeSelected || positionsAfterSelected>0) {
        positionsAfterSelected++;
    }
    if (selector.length) {
        if (positionsAfterSelected > 2) {
            $(selector).prop("disabled", true);
        } else {
            $(selector).prop("disabled", false);
        }

        if (positionsAfterSelected > 1 && $(selector)[0].selectedIndex === 0) {
            positionsAfterSelected++;
        }
    }
    return positionsAfterSelected;
}

/**
 * Updates the availability status in the Product Detail Page
 *
 * @param {Object} response - Ajax response object after an
 *                            attribute value has been [de]selected
 * @param {jQuery} $productContainer - DOM element for a given product
 */
function updateAvailability(response, $productContainer) {
    var availabilityValue = "";
    var availabilityMessages = response.product.availability.messages;
    if (!response.product.readyToOrder) {
        availabilityValue = "<li><div>" + response.resources.info_selectforstock + "</div></li>";
    } else {
        availabilityMessages.forEach(function (message) {
            availabilityValue += "<li><div>" + message + "</div></li>";
        });
    }

    $($productContainer).trigger("product:updateAvailability", {
        product: response.product,
        $productContainer: $productContainer,
        message: availabilityValue,
        resources: response.resources
    });

    $productContainer.find(".quantity-error").addClass("d-none");
}

/**
 * Generates html for promotions section
 *
 * @param {array} promotions - list of promotions
 * @return {string} - Compiled HTML
 */
function getPromotionsHtml(promotions) {
    if (!promotions) {
        return "";
    }

    var html = "";

    promotions.forEach(function (promotion) {
        html += `<div class="callout" title="${promotion.details}">${promotion.calloutMsg}</div>`;
    });

    return html;
}

/**
 * Generates html for product attributes section
 *
 * @param {array} attributes - list of attributes
 * @return {string} - Compiled HTML
 */
function getAttributesHtml(attributes) {
    if (!attributes) {
        return "";
    }

    var html = "";

    attributes.forEach(function (attributeGroup) {
        if (attributeGroup.ID === "mainAttributes") {
            attributeGroup.attributes.forEach(function (attribute) {
                html += "<div class=\"attribute-values\">" + attribute.label + ": " +
                    attribute.value + "</div>";
            });
        }
    });

    return html;
}

/**
 * @typedef UpdatedOptionValue
 * @type Object
 * @property {string} id - Option value ID for look up
 * @property {string} url - Updated option value selection URL
 */

/**
 * @typedef OptionSelectionResponse
 * @type Object
 * @property {string} priceHtml - Updated price HTML code
 * @property {Object} options - Updated Options
 * @property {string} options.id - Option ID
 * @property {UpdatedOptionValue[]} options.values - Option values
 */

/**
 * Updates DOM using post-option selection Ajax response
 *
 * @param {OptionSelectionResponse} options - Ajax response options from selecting a product option
 * @param {jQuery} $productContainer - DOM element for current product
 */
function updateOptions(options, $productContainer) {
    options.forEach(function (option) {
        var $optionEl = $productContainer.find(".product-option[data-option-id*=\"" + option.id +
            "\"]");
        option.values.forEach(function (value) {
            var valueEl = $optionEl.find("option[data-value-id*=\"" + value.id + "\"]");
            valueEl.val(value.url);
        });
    });
}

/**
 * Dynamically creates Bootstrap carousel from response containing images
 * @param {Object[]} imgs - Array of large product images,along with related information
 * @param {jQuery} $productContainer - DOM element for a given product
 *
 * @todo ACF4 Needs refactoring! Very satic way of building carousels
 */
function createCarousel(imgs, $productContainer) {
    var carousel = $productContainer.find(".carousel");

    var carouselInner = $(carousel).find(".carousel-inner");
    carouselInner.empty();
    carouselInner.removeClass("slick-initialized").removeClass("slick-slider");
    for (var i = 0; i < imgs.pdplarge.length; i++) {
        if (i === 6) {break;}
        $("<div class=\"carousel-item "+ (i===0 ? "active" : "") +" \"><div class=\"zoom js-zoom\"><img src=\"" + imgs.pdplarge[i].url + "\" class=\"d-block zoom-original img-fluid\" alt=\"" + imgs.pdplarge[i].alt + "\" title=\"" + imgs.pdplarge[i].title + "\" itemprop=\"image\" /></div></div>").appendTo($(carousel).find(".carousel-inner"));
    }

    var carouselNav = $(carousel).find(".carousel-nav");
    carouselNav.empty();
    carouselNav.removeClass("slick-initialized").removeClass("slick-slider");
    for (var j = 0; j < imgs.small.length; j++) {
        if (j === 6) {break;}
        $("<div class=\"carousel-nav-item "+ (j===0 ? "active" : "") +" \"><img src=\"" + imgs.small[j].url + "\" class=\"carousel-nav-img d-block img-fluid\" alt=\"" + imgs.small[j].alt + "\" title=\"" + imgs.small[j].title + "\" itemprop=\"image\" /></div>").appendTo($(carousel).find(".carousel-nav"));
    }

    carouselInner.slick({
        asNavFor: ".carousel-nav",
        fade: true,
        arrows: false,
        accessibility: true,
        dots: false,
        centerMode: true,
        centerPadding: "0"
    });

    carouselNav.slick({
        slidesToShow: 6,
        asNavFor: ".carousel-inner",
        variableWidth: true,
        focusOnSelect: true,
        mobileFirst: true,
        arrows: false,
        dots: false,
        infinite: false,
        swipe: false,
    });

    if ($(".js-zoom").length && $(window).width() > 991) {
        $(".js-zoom").zoom();
    }
}

/**
 * Parses JSON from Ajax call made whenever an attribute value is [de]selected
 * @param {Object} response - response from Ajax call
 * @param {Object} response.product - Product object
 * @param {string} response.product.id - Product ID
 * @param {Object[]} response.product.variationAttributes - Product attributes
 * @param {Object[]} response.product.images - Product images
 * @param {boolean} response.product.hasRequiredAttrsSelected - Flag as to whether all required
 *     attributes have been selected.  Used partially to
 *     determine whether the Add to Cart button can be enabled
 * @param {jQuery} $productContainer - DOM element for a given product.
 */
function handleVariantResponse(response, $productContainer, attributeSelected) {
    var isChoiceOfBonusProducts =
        $productContainer.parents(".choose-bonus-product-dialog").length > 0;
    var isVariant;
    if (response.product.variationAttributes) {
        updateAttrs(response.product.variationAttributes, $productContainer, response.resources, attributeSelected);
        isVariant = response.product.productType === "variant";
        if (isChoiceOfBonusProducts && isVariant) {
            $productContainer.parent(".bonus-product-item")
                .data("pid", response.product.id);

            $productContainer.parent(".bonus-product-item")
                .data("ready-to-order", response.product.readyToOrder);
        }
    }

    // Update primary images
    if ($productContainer.find(".carousel").length) {
        createCarousel(response.product.images, $productContainer);
    } else if ($productContainer.find(".tile-image").length) {
        updateTileImage(response.product.images, $productContainer);
    }

    // Update pricing
    if (!isChoiceOfBonusProducts) {
        var $priceSelector = $(".prices .price", $productContainer).length ?
            $(".prices .price", $productContainer) :
            $(".prices .price");
        $priceSelector.replaceWith(response.product.price.html);
    }

    // Update promotions
    $(".promotions").empty().html(getPromotionsHtml(response.product.promotions));

    updateAvailability(response, $productContainer);

    if (isChoiceOfBonusProducts) {
        var $selectButton = $productContainer.find(".select-bonus-product");
        $selectButton.trigger("bonusproduct:updateSelectButton", {
            product: response.product,
            $productContainer: $productContainer
        });
    } else {
        // Enable "Add to Cart" button if all required attributes have been selected
        $("button.add-to-cart, button.add-to-cart-global, button.update-cart-product-global").trigger("product:updateAddToCart", {
            product: response.product,
            $productContainer: $productContainer
        }).trigger("product:statusUpdate", {
            product: response.product,
            $productContainer: $productContainer
        });
    }

    // Update attributes
    $productContainer.find(".main-attributes").empty()
        .html(getAttributesHtml(response.product.attributes));

    // Update product name
    $productContainer.find(".product-name").empty()
        .html(response.product.productName);
}

/**
 * @typespec UpdatedQuantity
 * @type Object
 * @property {boolean} selected - Whether the quantity has been selected
 * @property {string} value - The number of products to purchase
 * @property {string} url - Compiled URL that specifies variation attributes, product ID, options,
 *     etc.
 */

/**
 * Updates the quantity DOM elements post Ajax call
 * @param {UpdatedQuantity[]} quantities -
 * @param {jQuery} $productContainer - DOM container for a given product
 */
function updateQuantities(quantities, $productContainer) {
    if ($productContainer.parent(".bonus-product-item").length <= 0) {
        var optionsHtml = "";

        if (quantities.length) {
            optionsHtml = quantities.map(function (quantity) {
                var selected = quantity.selected ? " selected " : "";
                return "<option value=\"" + quantity.value +
                    "\"  data-url=\"" + quantity.url + "\"" +
                    "\"  data-gtm=" + JSON.stringify(quantity.gtmData) +
                    selected + ">" + quantity.value + "</option>";
            }).join("");
            $productContainer.find(".quantity-select").attr("disabled", false);
        } else {
            optionsHtml = `<option value="1">${1}</option>`;
            $productContainer.find(".quantity-select").attr("disabled", true);
        }

        getQuantitySelector($productContainer).empty().html(optionsHtml);

    }
}
/**
 * updates the product view when a product attribute is selected or deselected or when
 *         changing quantity
 * @param {string} selectedValueUrl - the Url for the selected variation value
 * @param {jQuery} $productContainer - DOM element for current product
 */
function attributeSelect(selectedValueUrl, $productContainer, attributeSelected) {
    if (selectedValueUrl) {
        $("body").trigger("product:beforeAttributeSelect", {
            url: selectedValueUrl,
            container: $productContainer
        });

        $.ajax({
            url: selectedValueUrl,
            method: "GET",
            success: function (data) {
                handleVariantResponse(data, $productContainer, attributeSelected);
                updateOptions(data.product.options, $productContainer);
                updateQuantities(data.product.quantitiesWrapper, $productContainer);
                $("body").trigger("product:afterAttributeSelect", {
                    data: data,
                    container: $productContainer
                });
                $.spinner().stop();
            },
            error: function () {
                $.spinner().stop();
            }
        });
    }
}

/**
 * Parses the html for a modal window
 * @param {string} html - representing the body and footer of the modal window
 *
 * @return {Object} - Object with properties body and footer.
 */
function parseHtml(html) {
    var $html = $("<div>").append($.parseHTML(html));

    var body = $html.find(".choice-of-bonus-product");
    var footer = $html.find(".modal-footer").children();

    return {
        body: body,
        footer: footer
    };
}

/**
 * Retrieves url to use when adding a product to the cart
 *
 * @param {Object} data - data object used to fill in dynamic portions of the html
 */
function chooseBonusProducts(data, editmode) {
    $(".modal-body").spinner().start();

    if ($("#chooseBonusProductModal").length !== 0) {
        $("#chooseBonusProductModal").remove();
    }
    var bonusUrl;
    if (data.bonusChoiceRuleBased) {
        bonusUrl = data.showProductsUrlRuleBased;
    } else {
        bonusUrl = data.showProductsUrlListBased;
    }

    /**
     * @todo ACF2 Needs refactoring to remove hard-coded html elements. Should be better to use a template structure for this.
     */

    var htmlString = "<!-- Modal -->" +
        "<div class=\"modal fade px-2\" id=\"chooseBonusProductModal\" tabindex=\"-1\" role=\"dialog\">" +
        "<span class=\"enter-message sr-only\"></span>" +
        "<div class=\"modal-dialog choose-bonus-product-dialog\" " +
        "data-total-qty=\"" + data.maxBonusItems + "\"" +
        "data-UUID=\"" + data.uuid + "\"" +
        "data-pliUUID=\"" + data.pliUUID + "\"" +
        "data-addToCartUrl=\"" + data.addToCartUrl + "\"" +
        "data-pageStart=\"0\"" +
        "data-pageSize=\"" + data.pageSize + "\"" +
        "data-moreURL=\"" + data.showProductsUrlRuleBased + "\"" +
        "data-bonusChoiceRuleBased=\"" + data.bonusChoiceRuleBased + "\">" +
        "<!-- Modal content-->" +
        "<div class=\"modal-content\">" +
        "<div class=\"modal-header\">" +
        "    <span class=\"\">" + data.labels.header + "</span>" +
        "       <button type=\"button\" class=\"close pull-right\" data-dismiss=\"modal\">" +
        "        <span aria-hidden=\"true\">&times;</span>" +
        "        <span class=\"sr-only\"> </span>" +
        "    </button>" +
        "</div>" +
        "<div class=\"modal-body\"></div>" +
        "<div class=\"modal-footer\"></div>" +
        "</div>" +
        "</div>" +
        "</div>";
    $("body").append(htmlString);
    $(".modal-body bonus-product-carousel").spinner().start();

    $.ajax({
        url: bonusUrl,
        method: "GET",
        dataType: "json",
        success: function (response) {
            var parsedHtml = parseHtml(response.renderedTemplate);
            $("#chooseBonusProductModal .modal-body").empty();
            $("#chooseBonusProductModal .enter-message").text(response.enterDialogMessage);
            $("#chooseBonusProductModal .modal-header .close .sr-only").text(response.closeButtonText);
            $("#chooseBonusProductModal .modal-body").html(parsedHtml.body);
            $("#chooseBonusProductModal .modal-footer").html(parsedHtml.footer);
            $("#chooseBonusProductModal").modal("show");

            var selectedElem = $("#chooseBonusProductModal .selected-pid");
            var count = 0;

            if (selectedElem.length) {
                selectedElem.each(function () {
                    count += parseInt($(this).data("qty"), 10);

                    var selectedID = $(this).data("pid");
                    var selectedProduct = $(`.choice-of-bonus-product[data-pid='${selectedID}']`);

                    selectedProduct.addClass("selected").find(".select-bonus-product").addClass("selected btn-outline-secondary").removeClass("btn-secondary select");
                    selectedProduct.find(".bonus-quantity select").val($(this).data("qty"));
                });
            }

            $(".pre-cart-products").html(count);

            if (editmode) {
                $(document).find(".add-bonus-products .add-mode").addClass("d-none");
                $(document).find(".add-bonus-products .remove-mode").removeClass("d-none");
                $(".choose-bonus-product-dialog").find(".add-bonus-products").prop("disabled", false);
            }

            $.spinner().stop();

            setTimeout(function () {
                $(".choose-bonus-product-dialog .modal-body").slick({
                    adaptiveHeight: true
                });
            }, 1000);
        },
        error: function () {
            $.spinner().stop();
        }
    });
}

function initRecommAddToCartCarousel() {
    $(".recommendation-mini-cart-carousel").not(".slick-initialized").slick({
        slidesToShow: 1.5,
        infinite: false,
        adaptiveHeight: false,
        centerMode: false
    });
    $("#productRecommendationModal").find(".modal-content").spinner().stop();
}

function initRecommAddToCartCarouselObserver() {
    $("#productRecommendationModal").find(".modal-content").spinner().start();
    $(".js-add-to-cart-recommendations").each(function () {
        if ($(this).find(".recommendation-mini-cart-carousel").length == 0) {
            generalUtils.createObserver($(this)[0], initRecommAddToCartCarousel);
        } else {
            initRecommAddToCartCarousel();
        }
    });
}

function initRecommAddToCartModal(pid) {
    if (window.innerWidth <= 544) {
        var $productRecommendationModal = $("#productRecommendationModal");

        if (!$productRecommendationModal.length || !pid) {
            return;
        }

        var productRecommendationModalUrl = $productRecommendationModal.data("url") + "?pid=" + pid;

        $.ajax({
            url: productRecommendationModalUrl,
            method: "GET",
            success: function (response) {
                if (response && $(response).children().length) {
                    $productRecommendationModal.find(".modal-body").empty().html(response);

                    if (!$productRecommendationModal.hasClass("show")) {
                        $productRecommendationModal.appendTo("body").modal("show");
                        $(".modal-backdrop").addClass("modal-backdrop-transparent");
                        $productRecommendationModal.off("shown.bs.modal").on("shown.bs.modal", function () {
                            initRecommAddToCartCarouselObserver();
                        });
                    } else {
                        initRecommAddToCartCarouselObserver();
                    }
                }
            },
            error: function () {
                $.spinner().stop();
            }
        });
    }
}

/**
 * Updates the Mini-Cart quantity value after the customer has pressed the "Add to Cart" button
 * @param {string} response - ajax response from clicking the add to cart button
 */
function handlePostCartAdd(response, request) {
    $(".minicart-trigger").trigger("count:update", response);

    var messageType = response.error ? "alert-danger" : "alert-success";
    // show add to cart toast
    if (response.newBonusDiscountLineItem && Object.keys(response.newBonusDiscountLineItem).length !== 0) {
        chooseBonusProducts(response.newBonusDiscountLineItem);
    } else {
        if (!window.SmartOrderRefill && window.innerWidth > 991) {
            $(".minicart-trigger").click();
        }
        if (response.error != false) {
            if ($(".add-to-cart-messages").length === 0) {
                $("body").append(
                    "<div class=\"add-to-cart-messages\"></div>"
                );
            }

            /**
             * @todo ACF3 To be refactored and use alerts from a unified JS file
             */
            $(".add-to-cart-messages").append(
                "<div class=\"alert " + messageType + " add-to-basket-alert text-center\" role=\"alert\">" +
                response.message +
                "</div>"
            );

            setTimeout(function () {
                $(".add-to-basket-alert").remove();
            }, 5000);
        } else if (request && request.pid) {
            initRecommAddToCartModal(request.pid);
        }
    }
}

/**
 * Retrieves the bundle product item ID's for the Controller to replace bundle master product
 * items with their selected variants
 *
 * @return {string[]} - List of selected bundle product item ID's
 */
function getChildProducts() {
    var childProducts = [];
    $(".bundle-item").each(function () {
        childProducts.push({
            pid: $(this).find(".product-id").text(),
            quantity: parseInt($(this).find("label.quantity").data("quantity"), 10)
        });
    });

    return childProducts.length ? JSON.stringify(childProducts) : [];
}

/**
 * Retrieve product options
 *
 * @param {jQuery} $productContainer - DOM element for current product
 * @return {string} - Product options and their selected values
 */
function getOptions($productContainer) {
    var options = $productContainer
        .find(".product-option")
        .map(function () {
            var $elOption = $(this).find(".options-select");
            var urlValue = $elOption.val();
            var selectedValueId = $elOption.find("option[value=\"" + urlValue + "\"]")
                .data("value-id");
            return {
                optionId: $(this).data("option-id"),
                selectedValueId: selectedValueId
            };
        }).toArray();

    return JSON.stringify(options);
}

/**
 * Update img Element based on response containing images
 * @param {Object[]} imgs - Array of large product images,along with related information
 * @param {jQuery} $productContainer - DOM element for a given product
 */
function updateTileImage(imgs, $productContainer) {
    var tileImgElement = $productContainer.find(".tile-image");
    if (tileImgElement && !tileImgElement.length || !imgs.medium[0] || !imgs.medium[0].url) {
        return;
    }
    $(tileImgElement).attr("src", imgs.medium[0].url);
    $(tileImgElement).attr("alt", imgs.medium[0].url);
}

module.exports = {
    attributeSelect: attributeSelect,
    methods: {
        editBonusProducts: function (data) {
            chooseBonusProducts(data, true);
        }
    },

    focusChooseBonusProductModal: function () {
        $("body").on("shown.bs.modal", "#chooseBonusProductModal", function () {
            $("#chooseBonusProductModal").siblings().attr("aria-hidden", "true");
            $("#chooseBonusProductModal .close").focus();
        });
    },

    onClosingChooseBonusProductModal: function () {
        $("body").on("hidden.bs.modal", "#chooseBonusProductModal", function () {
            $("#chooseBonusProductModal").siblings().attr("aria-hidden", "false");
        });
    },

    trapChooseBonusProductModalFocus: function () {
        $("body").on("keydown", "#chooseBonusProductModal", function (e) {
            var focusParams = {
                "event": e,
                "containerSelector": "#chooseBonusProductModal",
                "firstElementSelector": ".close",
                "lastElementSelector": ".add-bonus-products"
            };
            focusHelper.setTabNextFocus(focusParams);
        });
    },

    colorAttribute: function () {
        $(document).on("click", "[data-attr=\"color\"] button", function (e) {
            e.preventDefault();

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push($(this).data("gtm"));

            if ($(this).attr("disabled")) {
                return;
            }
            var $productContainer = $(this).closest(".set-item");
            if (!$productContainer.length) {
                $productContainer = $(this).closest(".product-wrapper");
            }

            attributeSelect($(this).attr("data-url"), $productContainer, "color");
        });
    },

    selectAttribute: function () {
        $(document).on("change", "select[class*=\"select-\"], .options-select", function (e) {
            e.preventDefault();

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push($(this).find("option:selected").data("gtm"));

            var $productContainer = $(this).closest(".set-item");
            if (!$productContainer.length) {
                $productContainer = $(this).closest(".product-wrapper");
            }
            attributeSelect(e.currentTarget.value, $productContainer,
                $(this).closest("select[class*=\"select-\"]").attr("data-attr"));
        });
    },

    availability: function () {
        $(document).on("change", ".quantity-select", function (e) {
            e.preventDefault();
            var $this        = $(this);
            var selectedQty  = $this.find("option:selected").val();
            var pdpProductId = $(".product-detail.product-wrapper").data("pid");

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event          : "Quantity",
                eventTypes     : "click",
                action         : selectedQty,
                label          : "SelectedValue",
                updatedProduct : $this.closest(".product.product-wrapper").data("pid") || pdpProductId,
                PDP            : pdpProductId
            });

            var $productContainer = $(this).closest(".product-wrapper");
            if (!$productContainer.length) {
                $productContainer = $(this).closest(".modal-content").find(".product-quickview");
            }

            if ($(".bundle-items", $productContainer).length === 0) {
                attributeSelect($(e.currentTarget).find("option:selected").data("url"),
                    $productContainer, "quantity");
            }
        });
    },

    addToCart: function () {
        $(document).on("click", "button.add-to-cart, button.add-to-cart-global", function () {
            var addToCartUrl;
            var pid;
            var pidsObj;
            var setPids;

            var $that = $(this);

            $("body").trigger("product:beforeAddToCart", this);

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push($that.data("gtm"));

            if ($that.closest(".product-wrapper").find(".set-items").length && $that.hasClass("add-to-cart-global")) {
                setPids = [];

                $that.closest(".product-wrapper").each(function () {
                    if (!$that.hasClass("product-set-detail")) {
                        setPids.push({
                            pid: $that.find(".product-id").text(),
                            qty: $that.find(".quantity-select").val(),
                            options: getOptions($that)
                        });
                    }
                });
                pidsObj = JSON.stringify(setPids);
            }

            pid = getPidValue($that);

            var $productContainer = $that.closest(".product-wrapper");
            if (!$productContainer.length) {
                $productContainer = $that.closest(".quick-view-dialog").find(".product-wrapper");
            }

            addToCartUrl = $that.closest(".product-wrapper").find(".add-to-cart-url").val();
            if ($that.prop("id") === "add-to-cart-sor") {
                addToCartUrl += "?isSor=true";
            }

            var form = {
                pid: pid,
                pidsObj: pidsObj,
                childProducts: getChildProducts(),
                quantity: getQuantitySelected($that)
            };

            if (!$(".bundle-item").length) {
                form.options = getOptions($productContainer);
            }

            $that.trigger("updateAddToCartFormData", form);
            if (addToCartUrl) {
                $.ajax({
                    url: addToCartUrl,
                    method: "POST",
                    data: form,
                    success: function (data) {
                        if (!data.error) {
                            handlePostCartAdd(data, form);
                            $("body").trigger("product:afterAddToCart", data);
                            $(".minicart-quantity").removeClass("d-none");
                            $productContainer.find(".quantity-error").addClass("d-none");
                        } else {
                            $productContainer.find(".quantity-error").removeClass("d-none").html(data.message);
                        }
                    },
                    error: function () {
                        $.spinner().stop();
                    }
                });
            }
        });
    },

    selectBonusProduct: function () {
        $(document).on("click", ".select-bonus-product.select", function () {
            var $choiceOfBonusProduct = $(this).parents(".choice-of-bonus-product");
            var pid = $(this).data("pid");
            var maxPids = $(".choose-bonus-product-dialog").data("total-qty");
            var submittedQty = parseInt($(this).parents(".choice-of-bonus-product").find(".bonus-quantity-select").val(), 10);
            var totalQty = 0;
            $.each($("#chooseBonusProductModal .selected-pid"), function () {
                totalQty += $(this).data("qty");
            });
            totalQty += submittedQty;
            var optionID = $(this).parents(".choice-of-bonus-product").find(".product-option").data("option-id");
            var valueId = $(this).parents(".choice-of-bonus-product").find(".options-select option:selected").data("valueId");
            if (totalQty <= maxPids) {
                var selectedBonusProductHtml = "" +
                    "<div class=\"selected-pid row d-none\" " +
                    "data-pid=\"" + pid + "\"" +
                    "data-qty=\"" + submittedQty + "\"" +
                    "data-optionID=\"" + (optionID || "") + "\"" +
                    "data-option-selected-value=\"" + (valueId || "") + "\"" +
                    ">" +
                    "<div class=\"col-sm-11 col-9 bonus-product-name\" >" +
                    $choiceOfBonusProduct.find(".product-name").html() +
                    "</div>" +
                    "<div class=\"col-1\"><i class=\"fa fa-times\" aria-hidden=\"true\"></i></div>" +
                    "</div>";
                $("#chooseBonusProductModal .selected-bonus-products").append(selectedBonusProductHtml);
                $(".pre-cart-products").html(totalQty);
                $choiceOfBonusProduct.addClass("selected");
                $choiceOfBonusProduct.find(".select-bonus-product").addClass("selected btn-outline-secondary").removeClass("btn-secondary select");
                $(".bonus-summary").removeClass("alert-danger");
                $(".selected-bonus-products-error").addClass("d-none");
                $(".choose-bonus-product-dialog").find(".add-bonus-products").prop("disabled", false);
            } else {
                $(".bonus-summary").addClass("alert-danger");
                $(".selected-bonus-products-error").removeClass("d-none");
            }
        });

        $(document).on("click", ".remove-line-item-bonus", function () {
            if ($(".bonus-product-button").length) {
                $(".bonus-product-button").trigger("click");
            }
        });
    },
    removeBonusProduct: function () {
        $(document).on("click", ".select-bonus-product.selected", function () {
            $(this).removeClass("selected btn-outline-secondary").addClass("btn-secondary select");
            $("#chooseBonusProductModal .selected-pid[data-pid='" + $(this).data("pid") + "']").remove();
            var $selected = $("#chooseBonusProductModal .selected-pid");
            var count = 0;
            if ($selected.length) {
                $selected.each(function () {
                    count += parseInt($(this).data("qty"), 10);
                });
            }

            $(this).parents(".bonus-product-item").removeClass("selected");
            $(".pre-cart-products").html(count);
            $(".selected-bonus-products .bonus-summary").removeClass("alert-danger");

            if (count < 1 && $(".remove-mode.d-none").length) {
                $(".choose-bonus-product-dialog").find(".add-bonus-products").prop("disabled", true);
            }
        });
    },
    enableBonusProductSelection: function () {
        $("body").on("bonusproduct:updateSelectButton", function (e, response) {
            $("button.select-bonus-product", response.$productContainer).attr("disabled",
                (!response.product.readyToOrder || !response.product.available));
            var pid = response.product.id;
            $("button.select-bonus-product", response.$productContainer).data("pid", pid);
        });
    },
    showMoreBonusProducts: function () {
        $(document).on("click", ".show-more-bonus-products", function () {
            var url = $(this).data("url");
            $(".modal-content").spinner().start();
            $.ajax({
                url: url,
                method: "GET",
                success: function (html) {
                    var parsedHtml = parseHtml(html);
                    $(".modal-body").append(parsedHtml.body);
                    $(".show-more-bonus-products:first").remove();
                    $(".modal-content").spinner().stop();
                },
                error: function () {
                    $(".modal-content").spinner().stop();
                }
            });
        });
    },
    addBonusProductsToCart: function () {
        $(document).on("click", ".add-bonus-products", function () {
            var $readyToOrderBonusProducts = $(this).parents(".modal-footer").find(".selected-pid");

            /**
             *  @todo ACF5 The way queryString is used needs to be refactored - not safe!
             */
            var queryString = "?pids=";
            var url = $(".choose-bonus-product-dialog").data("addtocarturl");
            var pidsObject = {
                bonusProducts: []
            };

            $.each($readyToOrderBonusProducts, function () {
                var qtyOption =
                    parseInt($(this)
                        .data("qty"), 10);

                var option = null;
                if (qtyOption > 0) {
                    if ($(this).data("optionid") && $(this).data("option-selected-value")) {
                        option = {};
                        option.optionId = $(this).data("optionid");
                        option.productId = $(this).data("pid");
                        option.selectedValueId = $(this).data("option-selected-value");
                    }
                    pidsObject.bonusProducts.push({
                        pid: $(this).data("pid"),
                        qty: qtyOption,
                        options: [option]
                    });
                    pidsObject.totalQty = parseInt($(".pre-cart-products").html(), 10);
                }
            });
            queryString += JSON.stringify(pidsObject);
            queryString = queryString + "&uuid=" + $(".choose-bonus-product-dialog").data("uuid");
            queryString = queryString + "&pliuuid=" + $(".choose-bonus-product-dialog").data("pliuuid");
            $.spinner().start();
            $.ajax({
                url: url + queryString,
                method: "POST",
                success: function (data) {
                    $.spinner().stop();
                    if (data.error) {
                        $(".error-choice-of-bonus-products")
                            .html(data.errorMessage);
                    } else {
                        $(".configure-bonus-product-attributes").html(data);
                        $("#chooseBonusProductModal").modal("hide");

                        $(".minicart-trigger").trigger("count:update", data.totalQty);

                        if (window.innerWidth > 991) {
                            $(".minicart-trigger").click();
                        }

                        setTimeout(function () {
                            $(".add-to-basket-alert").remove();
                            if ($(".cart-page").length) {
                                location.reload();
                            }
                        }, 3000);
                    }
                },
                error: function () {
                    $.spinner().stop();
                }
            });
        });
    },

    getPidValue: getPidValue,
    getQuantitySelected: getQuantitySelected,
    checkChooseBonusProductModal: function () {
        var url = $(".minicart-trigger").data("checkbonusmodalurl");
        if (url) {
            $.ajax({
                url: url,
                method: "GET",
                success: function (data) {
                    if (data.newBonusDiscountLineItem && Object.keys(data.newBonusDiscountLineItem).length !== 0) {
                        handlePostCartAdd(data);
                    }
                }
            });
        }
    },

    closeModalProductRecommendation: function () {
        $(".recommendation-dialog .js-close-add-to-cart-modal").on("click", function () {
            $(".modal-backdrop").removeClass("modal-backdrop-transparent");
        });
    }
};
