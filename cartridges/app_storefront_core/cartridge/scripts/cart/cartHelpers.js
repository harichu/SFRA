"use strict";

var base           = module.superModule;
var BasketMgr      = require("dw/order/BasketMgr");
var productHelper  = require("*/cartridge/scripts/helpers/productHelpers");
var ProductMgr     = require("dw/catalog/ProductMgr");
var Resource       = require("dw/web/Resource");
var Transaction    = require("dw/system/Transaction");

/**
 * Returns whether the current basket has any product with club price
 * @returns {Boolean}
 */
function hasClubProducts() {
    var CartModel = require("*/cartridge/models/cart");
    var currentBasket = new CartModel(BasketMgr.getCurrentBasket());
    return !empty(currentBasket) && currentBasket.items.some(function (item) {
        return !empty(item.price.club) && !empty(item.price.club.value);
    });
}

/**
 * Extending function to add the header label based on promotion callout message
 */
var getNewBonusDiscountLineItemBase = base.getNewBonusDiscountLineItem;
function getNewBonusDiscountLineItem(currentBasket, previousBonusDiscountLineItems, urlObject, pliUUID) {
    var result = getNewBonusDiscountLineItemBase.call(this, currentBasket, previousBonusDiscountLineItems, urlObject, pliUUID);
    if (!empty(result)) {
        var promotion = result.newBonusDiscountLineItem.promotion;
        result.labels.header = !empty(promotion) && !empty(promotion.calloutMsg) ? promotion.calloutMsg.markup : "";
    }
    return result;
}

/**
 * Adds a product to the cart. If the product is already in the cart it increases the quantity of
 * that product.
 * @param {dw.order.Basket} currentBasket - Current users's basket
 * @param {string} productId - the productId of the product being added to the cart
 * @param {number} quantity - the number of products to the cart
 * @param {string[]} childProducts - the products' sub-products
 * @param {SelectedOption[]} options - product options
 *  @return {Object} returns an error object
 */
function addProductToCart(currentBasket, productId, quantity, childProducts, options) {
    var availableToSell;
    var defaultShipment = currentBasket.defaultShipment;
    var perpetual;
    var product = ProductMgr.getProduct(productId);
    var productInCart;
    var productLineItems = currentBasket.productLineItems;
    var productQuantityInCart;
    var quantityToSet;
    var optionModel = productHelper.getCurrentOptionModel(product.optionModel, options);
    var result = {
        error: false,
        message: Resource.msg("text.alert.addedtobasket", "product", null)
    };

    var totalQtyRequested = 0;
    var canBeAdded = false;

    if (product.bundle) {
        canBeAdded = checkBundledProductCanBeAdded(childProducts, productLineItems, quantity);
    } else {
        totalQtyRequested = quantity + base.getQtyAlreadyInCart(productId, productLineItems);
        perpetual = productHelper.getAvailabilityModel(product).inventoryRecord.perpetual;
        canBeAdded =
            (perpetual
            || totalQtyRequested <= productHelper.getAvailabilityModel(product).inventoryRecord.ATS.value);
    }

    if (!canBeAdded) {
        result.error = true;
        result.message = Resource.msgf(
            "error.alert.selected.quantity.cannot.be.added.for",
            "product",
            null,
            productHelper.getAvailabilityModel(product).inventoryRecord.ATS.value,
            product.name
        );
        return result;
    }

    productInCart = base.getExistingProductLineItemInCart(
        product, productId, productLineItems, childProducts, options);

    if (productInCart) {
        productQuantityInCart = productInCart.quantity.value;
        quantityToSet = quantity ? quantity + productQuantityInCart : productQuantityInCart + 1;
        availableToSell = productHelper.getAvailabilityModel(productInCart.product).inventoryRecord.ATS.value;

        if (availableToSell >= quantityToSet || perpetual) {
            productInCart.setQuantityValue(quantityToSet);
            result.uuid = productInCart.UUID;
        } else {
            result.error = true;
            result.message = availableToSell === productQuantityInCart
                ? Resource.msg("error.alert.max.quantity.in.cart", "product", null)
                : Resource.msg("error.alert.selected.quantity.cannot.be.added", "product", null);
        }
    } else {
        var productLineItem;
        productLineItem = base.addLineItem(
            currentBasket,
            product,
            quantity,
            childProducts,
            optionModel,
            defaultShipment
        );

        result.uuid = productLineItem.UUID;
    }

    return result;
}

/**
 * Check if the bundled product can be added to the cart
 * @param {string[]} childProducts - the products' sub-products
 * @param {dw.util.Collection<dw.order.ProductLineItem>} productLineItems - Collection of the Cart's
 *     product line items
 * @param {number} quantity - the number of products to the cart
 * @return {boolean} - return true if the bundled product can be added
 */
function checkBundledProductCanBeAdded(childProducts, productLineItems, quantity) {
    var atsValueByChildPid = {};
    var totalQtyRequested = 0;
    var canBeAdded = false;

    childProducts.forEach(function (childProduct) {
        var apiChildProduct = ProductMgr.getProduct(childProduct.pid);
        atsValueByChildPid[childProduct.pid] =
        productHelper.getAvailabilityModel(apiChildProduct).inventoryRecord.ATS.value;
    });

    canBeAdded = childProducts.every(function (childProduct) {
        var bundleQuantity = quantity;
        var itemQuantity = bundleQuantity * childProduct.quantity;
        var childPid = childProduct.pid;
        totalQtyRequested = itemQuantity + base.getQtyAlreadyInCart(childPid, productLineItems);
        return totalQtyRequested <= atsValueByChildPid[childPid];
    });

    return canBeAdded;
}

/**
 * Checks if product in basket has prescription model and set it to basket's custom attribute
 * @param {dw.order.Basket} currentBasket - Current users's basket
 **/
function checkPrescriptionModel(currentBasket) {
    if (!currentBasket) {
        currentBasket = BasketMgr.getCurrentBasket();
    }

    Transaction.wrap(function () {
        var isSimpleRestriction;
        for (var i = 0, ii = currentBasket.productLineItems.length; i < ii; i++) {
            var product = currentBasket.productLineItems[i].product;
            var difarmaPrescriptionModel = product.custom.difarmaPrescriptionModel ? product.custom.difarmaPrescriptionModel : "";
            
            if (!empty(difarmaPrescriptionModel) && difarmaPrescriptionModel.value == "restricted") {
                currentBasket.custom.difarmaPrescriptionModel = difarmaPrescriptionModel.value;
                break;
            } else if (!empty(difarmaPrescriptionModel) && difarmaPrescriptionModel.value == "simple") {
                currentBasket.custom.difarmaPrescriptionModel = difarmaPrescriptionModel.value;
                isSimpleRestriction = true;
            } else if (!isSimpleRestriction) {
                currentBasket.custom.difarmaPrescriptionModel = null;
            }
        }
    });
}

base.getNewBonusDiscountLineItem = getNewBonusDiscountLineItem;
base.addProductToCart = addProductToCart;
base.checkBundledProductCanBeAdded = checkBundledProductCanBeAdded;
base.hasClubProducts = hasClubProducts;
base.checkPrescriptionModel = checkPrescriptionModel;

module.exports = base;
