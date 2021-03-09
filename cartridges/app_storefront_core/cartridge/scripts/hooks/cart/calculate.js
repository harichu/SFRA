/* eslint-disable */
'use strict';

/** @module calculate */
/**
 * This javascript file implements methods (via Common.js exports) that are needed by
 * the new (smaller) CalculateCart.ds script file.  This allows OCAPI calls to reference
 * these tools via the OCAPI 'hook' mechanism
 */

var HashMap = require('dw/util/HashMap');
var PriceBookMgr = require("dw/catalog/PriceBookMgr");
var PromotionMgr = require('dw/campaign/PromotionMgr');
var ShippingMgr = require('dw/order/ShippingMgr');
var TaxMgr = require('dw/order/TaxMgr');
var Status = require('dw/system/Status');
var HookMgr = require('dw/system/HookMgr');
var Site = require("dw/system/Site");

var currentSite    = Site.current;
var clubPriceBook  = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("specialPriceBook"));
var salesPriceBook = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("salesPriceDefault"));
var listPriceBook  = PriceBookMgr.getPriceBook(currentSite.getCustomPreferenceValue("listPriceDefault"));

/**
 * @function calculate
 *
 * calculate is the arching logic for computing the value of a basket.  It makes
 * calls into cart/calculate.js and enables both SG and OCAPI applications to share
 * the same cart calculation logic.
 *
 * @param {object} basket The basket to be calculated
 */
exports.calculate = function (basket) {
    // ===================================================
    // =====   CALCULATE PRODUCT LINE ITEM PRICES    =====
    // ===================================================

    calculateProductPrices(basket);

    // ===================================================
    // =====    CALCULATE GIFT CERTIFICATE PRICES    =====
    // ===================================================

    calculateGiftCertificatePrices(basket);

    // ===================================================
    // =====   Note: Promotions must be applied      =====
    // =====   after the tax calculation for         =====
    // =====   storefronts based on GROSS prices     =====
    // ===================================================

    // ===================================================
    // =====   APPLY PROMOTION DISCOUNTS			 =====
    // =====   Apply product and order promotions.   =====
    // =====   Must be done before shipping 		 =====
    // =====   calculation. 					     =====
    // ===================================================

    calculatePromotions(basket);
    calculateSourceCodeDiscounts(basket);

    // ===================================================
    // =====        CALCULATE SHIPPING COSTS         =====
    // ===================================================

    // apply product specific shipping costs
    // and calculate total shipping costs
    HookMgr.callHook('dw.order.calculateShipping', 'calculateShipping', basket);

    // ===================================================
    // =====   APPLY PROMOTION DISCOUNTS			 =====
    // =====   Apply product and order and 			 =====
    // =====   shipping promotions.                  =====
    // ===================================================

    calculatePromotions(basket);

    // since we might have bonus product line items, we need to
    // reset product prices
    calculateProductPrices(basket);

    // ===================================================
    // =====         CALCULATE TAX                   =====
    // ===================================================

    HookMgr.callHook('dw.order.calculateTax', 'calculateTax', basket);

    // ===================================================
    // =====         CALCULATE BASKET TOTALS         =====
    // ===================================================

    basket.updateTotals();

    // ===================================================
    // =====            DONE                         =====
    // ===================================================

    return new Status(Status.OK);
};

/**
 * @function calculateProductPrices
 *
 * Calculates product prices based on line item quantities. Set calculates prices
 * on the product line items.  This updates the basket and returns nothing
 *
 * @param {object} basket The basket containing the elements to be computed
 */
function calculateProductPrices (basket) {
    // get total quantities for all products contained in the basket
    var productQuantities = basket.getProductQuantities();
    var productQuantitiesIt = productQuantities.keySet().iterator();

    // get product prices for the accumulated product quantities
    var productPrices = new HashMap();

    while (productQuantitiesIt.hasNext()) {
        var prod = productQuantitiesIt.next();
        var quantity = productQuantities.get(prod);
        productPrices.put(prod, prod.priceModel.getPrice(quantity));
    }

    // iterate all product line items of the basket and set prices
    var productLineItems = basket.getAllProductLineItems().iterator();
    while (productLineItems.hasNext()) {
        var productLineItem = productLineItems.next();

        // handle non-catalog products
        if (!productLineItem.catalogProduct) {
            productLineItem.setPriceValue(productLineItem.basePrice.valueOrNull);
            continue;
        }

        var product = productLineItem.product;

        // handle option line items
        if (productLineItem.optionProductLineItem) {
            // for bonus option line items, we do not update the price
            // the price is set to 0.0 by the promotion engine
            if (!productLineItem.bonusProductLineItem) {
                productLineItem.updateOptionPrice();
            }
        // handle bundle line items, but only if they're not a bonus
        } else if (productLineItem.bundledProductLineItem) {
            // no price is set for bundled product line items
        // handle bonus line items
        // the promotion engine set the price of a bonus product to 0.0
        // we update this price here to the actual product price just to
        // provide the total customer savings in the storefront
        // we have to update the product price as well as the bonus adjustment
        } else if (productLineItem.bonusProductLineItem && product !== null) {
            var price = product.priceModel.price;
            var adjustedPrice = productLineItem.adjustedPrice;
            productLineItem.setPriceValue(price.valueOrNull);
            // get the product quantity
            var quantity2 = productLineItem.quantity;
            // we assume that a bonus line item has only one price adjustment
            var adjustments = productLineItem.priceAdjustments;
            if (!adjustments.isEmpty()) {
                var adjustment = adjustments.iterator().next();
                var adjustmentPrice = price.multiply(quantity2.value).multiply(-1.0).add(adjustedPrice);
                adjustment.setPriceValue(adjustmentPrice.valueOrNull);
            }


        // set the product price. Updates the 'basePrice' of the product line item,
        // and either the 'netPrice' or the 'grossPrice' based on the current taxation
        // policy

        // handle product line items unrelated to product
        } else if (product === null) {
            productLineItem.setPriceValue(null);
        // handle normal product line items
        } else if (!productLineItem.custom.hasCustomSourceCodeCalculation) {
            productLineItem.setPriceValue(productPrices.get(product).valueOrNull);
        }
    }
}

/**
 * @function calculateGiftCertificates
 *
 * Function sets either the net or gross price attribute of all gift certificate
 * line items of the basket by using the gift certificate base price. It updates the basket in place.
 *
 * @param {object} basket The basket containing the gift certificates
 */
function calculateGiftCertificatePrices(basket) {
    var giftCertificates = basket.getGiftCertificateLineItems().iterator();
    while (giftCertificates.hasNext()) {
        var giftCertificate = giftCertificates.next();
        giftCertificate.setPriceValue(giftCertificate.basePrice.valueOrNull);
    }
}

/**
 * Checks if a basket has source code discounts, and then either marks them for removal or its items for price readjustment as needed.
 * @param {dw.order.LineItemCtnr} basket The basket to process.
 * @return {boolean} Whether a recalculation of the basket is necessary.
 */
function calculateSourceCodeDiscounts(basket) {
    var RECALCULABLE_DISCOUNT_TYPES    = ["AMOUNT", "FIXED_PRICE", "PERCENTAGE"];
    var productLineItemList            = basket.allProductLineItems.iterator();
    var isBasketRecalculationNecessary = false;
    var isClubPriceBookApplied         = false;

    for (var i = 0; i < PriceBookMgr.applicablePriceBooks.length; i++) {
        var element = PriceBookMgr.applicablePriceBooks[i];
        
        if (element.ID === clubPriceBook.ID) {
            isClubPriceBookApplied = true;
            break;
        }
    }

    while (productLineItemList.hasNext()) {
        var productLineItem = productLineItemList.next();

        productLineItem.custom.hasCustomSourceCodeCalculation = false;
        productLineItem.custom.shouldRemoveSourceCodeDiscount = false;

        var lineItemPriceModel = productLineItem.product.priceModel;
        var lineItemPriceBook  = lineItemPriceModel.priceInfo.priceBook;
        var rawSalesPrice      = lineItemPriceModel.getPriceBookPrice(salesPriceBook.ID, productLineItem.quantity);

        // Lineitem will have list pricebook assigned to it if the list price is the lowest one.
        // Else, the following logic is applied;
        if (lineItemPriceBook.ID != listPriceBook.ID || (rawSalesPrice.value === 0)) {
            var adjustmentList = productLineItem.priceAdjustments.iterator();

            while (adjustmentList.hasNext()) {
                var adjustment  = adjustmentList.next();
                var discount    = adjustment.appliedDiscount;
                var isClubPromo = adjustment.promotion.custom.isClubPromotion;

                // Ignores some kinds of discounts;
                if (RECALCULABLE_DISCOUNT_TYPES.indexOf(discount.type) == -1) {
                    continue;
                }

                // At the time of the implementation, there is only one source code: the list source code;
                var sourceCodeList = adjustment.campaign.sourceCodeGroups.iterator();
                while (sourceCodeList.hasNext()) {
                    var currentSourceCode         = sourceCodeList.next();
                    var isCurrentSourceCodeActive = !empty(session.sourceCodeInfo) && currentSourceCode.ID == session.sourceCodeInfo.group.ID;

                    if (isCurrentSourceCodeActive) {
                        var rawListPrice  = lineItemPriceModel.getPriceBookPrice(listPriceBook.ID, productLineItem.quantity);
                        var rawClubPrice  = lineItemPriceModel.getPriceBookPrice(clubPriceBook.ID, productLineItem.quantity);
                        var discountValue = getDiscountValue(lineItemPriceModel, discount, rawListPrice);

                        // If the discount is not of the predefined types, then the "lineItemPriceBook"
                        // pricebook will be used, which is the lowest of the active pricebooks. 
                        // Note that line item's "shouldRemoveSourceCodeDiscount" value will be false;
                        if (empty(discountValue)) {
                            continue;
                        }

                        var promotionalListPrice = rawListPrice.subtract(discountValue);
                        if (promotionalListPrice.value < rawSalesPrice.value) {
                            // Sets the list price, not the sale nor the promotional list price;
                            productLineItem.setPriceValue(rawListPrice.value);
                            productLineItem.custom.hasCustomSourceCodeCalculation = true;

                        } else {
                            productLineItem.custom.shouldRemoveSourceCodeDiscount = true;
                        }

                        if (!isClubPriceBookApplied && isClubPromo) {
                            productLineItem.custom.hasCustomSourceCodeCalculation = false;
                            productLineItem.custom.shouldRemoveSourceCodeDiscount = true;
                        }

                        var isClubPriceLessThanPromotionalListPrice = rawClubPrice.available && rawClubPrice.value < promotionalListPrice.value; 
                        if (isClubPriceBookApplied && isClubPromo && isClubPriceLessThanPromotionalListPrice) {
                            // Sets the club price
                            productLineItem.setPriceValue(rawClubPrice.value);
                            productLineItem.custom.hasCustomSourceCodeCalculation = true;
                            productLineItem.custom.shouldRemoveSourceCodeDiscount = true;
                        }

                        // If product has no sale price;
                        if (rawSalesPrice.value === 0) {
                            calculateNoSalePriceScenarios(isClubPromo,
                                isClubPriceBookApplied,
                                promotionalListPrice,
                                rawClubPrice,
                                productLineItem,
                                rawListPrice
                            );
                        }
                            
                        isBasketRecalculationNecessary = true;
                    }
                }
            }
        }
    }

    return isBasketRecalculationNecessary;
}

function calculateNoSalePriceScenarios(isClubPromo, isClubPriceBookApplied, promotionalListPrice, rawClubPrice, productLineItem, rawListPrice) {
    if (isClubPromo) {
        // Registered customer;
        if (isClubPriceBookApplied) {
            if (promotionalListPrice.value < rawClubPrice.value || rawClubPrice.value === 0) {
                productLineItem.setPriceValue(rawListPrice.value);
                productLineItem.custom.hasCustomSourceCodeCalculation = true;
                productLineItem.custom.shouldRemoveSourceCodeDiscount = false;
            }
            else {
                productLineItem.custom.shouldRemoveSourceCodeDiscount = true;
            }
        }
    }
    else {
        // Registered user;
        if (isClubPriceBookApplied) {
            if (promotionalListPrice.value < rawClubPrice.value || rawClubPrice.value === 0) {
                productLineItem.setPriceValue(promotionalListPrice.value);
                productLineItem.custom.hasCustomSourceCodeCalculation = true;
                productLineItem.custom.shouldRemoveSourceCodeDiscount = true;
            }
        }
        else {
            productLineItem.setPriceValue(promotionalListPrice.value);
            productLineItem.custom.hasCustomSourceCodeCalculation = true;
            productLineItem.custom.shouldRemoveSourceCodeDiscount = true;
        }
    }
}

function getDiscountValue(priceModel, discount, rawListPrice) {
    var Money = require("dw/value/Money");

    var discountValue = null;
    var currencyCode  = priceModel.price.currencyCode;

    switch (discount.type) {
        case "AMOUNT":
            discountValue = new Money(Math.abs(discount.amount), currencyCode);
            break;

        case "FIXED_PRICE":
            discountValue = rawListPrice.subtract(new Money(discount.fixedPrice, currencyCode));
            break;

        case "PERCENTAGE":
            discountValue = rawListPrice.subtract(rawListPrice.subtractPercent(discount.percentage));
            break;
    }

    return discountValue;
}

function calculateOrderPromotions(discountPlan, basket) {
    PromotionMgr.applyDiscounts(discountPlan);
    var orderAdjustmentList = basket.priceAdjustments.iterator();
    
    while (orderAdjustmentList.hasNext()) {
        var orderAdjustment = orderAdjustmentList.next();
        
        // Other discount types don't need special treatment;
        if (orderAdjustment.appliedDiscount.type === "PERCENTAGE") {
            var newDiscountValue = basket.getAdjustedMerchandizeTotalPrice(false)
                .multiply(orderAdjustment.appliedDiscount.percentage)
                .divide(100);

            orderAdjustment.setPriceValue(-newDiscountValue.value);
        }
    }
}

/**
 * Custom logic to calculate promotions so that some discounts can be deactivated.
 * @param {dw.order.LineItemCtnr} basket The basket containing the gift certificates
 */
function calculatePromotions(basket) {
    var discountPlan     = PromotionMgr.getDiscounts(basket);
    var productLineItems = basket.allProductLineItems.iterator();

    while (productLineItems.hasNext()) {
        var productLineItem = productLineItems.next();
        var priceModel      = productLineItem.product.priceModel;
        var priceBook       = priceModel.priceInfo.priceBook;
        var adjustmentList  = productLineItem.priceAdjustments.iterator();
        var productLineItemAdjustment, productDiscount, productDiscountList;

        while (adjustmentList.hasNext()) {
            productLineItemAdjustment = adjustmentList.next();
            var adjustmentSourceCodeGroup = !empty(productLineItemAdjustment.campaign) && !empty(productLineItemAdjustment.campaign.sourceCodeGroups) ? productLineItemAdjustment.campaign.sourceCodeGroups[0] : null;

            if (!empty(adjustmentSourceCodeGroup)) {
                var sourceCodePriceBook = !empty(adjustmentSourceCodeGroup.priceBooks) ? adjustmentSourceCodeGroup.priceBooks[0] : null;

                var salePriceBookPrice = productLineItem.product.priceModel.getPriceBookPrice(salesPriceBook.ID);
                var shouldRemoveSourceCodeDiscount = ((!empty(sourceCodePriceBook) && priceBook.ID != sourceCodePriceBook.ID) || salePriceBookPrice.value === 0 ) && productLineItem.custom.shouldRemoveSourceCodeDiscount;

                if (shouldRemoveSourceCodeDiscount) {
                    productDiscountList = discountPlan.getProductDiscounts(productLineItem).iterator();

                    while (productDiscountList.hasNext()) {

                        productDiscount = productDiscountList.next();

                        if (productLineItemAdjustment.promotion == productDiscount.promotion) {
                            discountPlan.removeDiscount(productDiscount);
                            productLineItem.removePriceAdjustment(productLineItemAdjustment);
                        }
                    }
                }
            }
        }
    }

    calculateOrderPromotions(discountPlan, basket);
    calculateShippingPromotions(basket);
}

exports.calculateShipping = function(basket) {
    ShippingMgr.applyShippingCost(basket);
    return new Status(Status.OK);
}

function calculateShippingPromotions (basket) {
    var shipmentsList = basket.shipments.iterator();

    while (shipmentsList.hasNext()) {
        var shipment = shipmentsList.next();
        var productLineItemsList = shipment.getProductLineItems().iterator();
        var shippingPriceAdjustmentsList = shipment.shippingPriceAdjustments.iterator();

        while (productLineItemsList.hasNext()) {
            var productLineItem = productLineItemsList.next();
            var shippingLineItem = productLineItem.shippingLineItem;

            if (!empty(shippingLineItem)) {
                if (shippingLineItem.isSurcharge()) {
                    if (shippingPriceAdjustmentsList.hasNext()) {
                        var shippingPriceAdjustment = shippingPriceAdjustmentsList.next();

                        if (shippingPriceAdjustment.appliedDiscount.type === "FREE") {
                            shippingPriceAdjustment.setPriceValue(shippingPriceAdjustment.price.subtract(shippingLineItem.price).value);
                        }
                    }
                }
            }
        }
    }
}

/**
 * @function calculateTax <p>
 *
 * Determines tax rates for all line items of the basket. Uses the shipping addresses
 * associated with the basket shipments to determine the appropriate tax jurisdiction.
 * Uses the tax class assigned to products and shipping methods to lookup tax rates. <p>
 *
 * Sets the tax-related fields of the line items. <p>
 *
 * Handles gift certificates, which aren't taxable. <p>
 *
 * Note that the function implements a fallback to the default tax jurisdiction
 * if no other jurisdiction matches the specified shipping location/shipping address.<p>
 *
 * Note that the function implements a fallback to the default tax class if a
 * product or a shipping method does explicitly define a tax class.
 *
 * @param {dw.order.Basket} basket The basket containing the elements for which taxes need to be calculated
 */
exports.calculateTax = function(basket) {
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var collections = require('*/cartridge/scripts/util/collections');

    var taxes = basketCalculationHelpers.calculateTaxes(basket);

    // convert taxes into hashmap for performance.
    var taxesMap = {};

    taxes.taxes.forEach(function (item) {
        taxesMap[item.uuid] = { value: item.value, amount: item.amount };
    });

    var lineItems = basket.getAllLineItems();

    var totalShippingGrossPrice = 0;
    var totalShippingNetPrice = 0;

    // update taxes for all line items
    collections.forEach(lineItems, function (lineItem) {
        var tax = taxesMap[lineItem.UUID];

        if (tax) {
            if (tax.amount) {
                lineItem.updateTaxAmount(tax.value);
                if (lineItem instanceof dw.order.ShippingLineItem) {
                    totalShippingGrossPrice += lineItem.getAdjustedGrossPrice();
                    totalShippingNetPrice += lineItem.getAdjustedNetPrice();
                }
            } else {
                lineItem.updateTax(tax.value);
            }
        } else {
            if (lineItem.taxClassID === TaxMgr.customRateTaxClassID) {
                // do not touch tax rate for fix rate items
                lineItem.updateTax(lineItem.taxRate);
            } else {
                // otherwise reset taxes to null
                lineItem.updateTax(null);
            }
        }
    });

    // besides shipment line items, we need to calculate tax for possible order-level price adjustments
    // this includes order-level shipping price adjustments
    if (!basket.getPriceAdjustments().empty || !basket.getShippingPriceAdjustments().empty) {
        if (collections.first(basket.getPriceAdjustments(), function (priceAdjustment) {
            return taxesMap[priceAdjustment.UUID] === null;
        }) || collections.first(basket.getShippingPriceAdjustments(), function (shippingPriceAdjustment) {
            return taxesMap[shippingPriceAdjustment.UUID] === null;
        })) {
            // tax hook didn't provide taxes for global price adjustment, we need to calculate them ourselves.
            // calculate a mix tax rate from
            var basketPriceAdjustmentsTaxRate = ((basket.getMerchandizeTotalGrossPrice().value + basket.getShippingTotalGrossPrice().value)
                / (basket.getMerchandizeTotalNetPrice().value + basket.getShippingTotalNetPrice())) - 1;

                var basketPriceAdjustments = basket.getPriceAdjustments();
                collections.forEach(basketPriceAdjustments, function (basketPriceAdjustment) {
                    basketPriceAdjustment.updateTax(basketPriceAdjustmentsTaxRate);
                });

                var basketShippingPriceAdjustments = basket.getShippingPriceAdjustments();
                collections.forEach(basketShippingPriceAdjustments, function(basketShippingPriceAdjustment) {
                    basketShippingPriceAdjustment.updateTax(totalShippingGrossPrice/totalShippingNetPrice - 1);
                });
            }
    }

    // if hook returned custom properties attach them to the order model
    if (taxes.custom) {
        Object.keys(taxes.custom).forEach(function (key) {
            basket.custom[key] = taxes.custom[key];
        });
    }

    return new Status(Status.OK);
}
