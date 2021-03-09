"use strict";

var base = module.superModule;

var ProductMgr = require("dw/catalog/ProductMgr");
var Resource = require("dw/web/Resource");
var productHelper = require("*/cartridge/scripts/helpers/productHelpers");
var arrayHelper = require("*/cartridge/scripts/util/array");
var instorePickupStoreHelper = require("*/cartridge/scripts/helpers/instorePickupStoreHelpers");
var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");

/**
 * Determines whether a product's current instore pickup store setting are
 * the same as the previous selected
 *
 * @param {string} existingStoreId - store id currently associated with this product
 * @param {string} selectedStoreId - store id just selected
 * @return {boolean} - Whether a product's current store setting is the same as
 * the previous selected
 */
function hasSameStore(existingStoreId, selectedStoreId) {
    return existingStoreId === selectedStoreId;
}

/**
 * Loops through all Shipments and attempts to select a ShippingMethod, where absent
 * @param {dw.catalog.Product} product - Product object
 * @param {string} productId - Product ID to match
 * @param {dw.util.Collection<dw.order.ProductLineItem>} productLineItems - Collection of the Cart's
 *     product line items
 * @param {string[]} childProducts - the products' sub-products
 * @param {SelectedOption[]} options - product options
 * @param {string} storeId - store id
 * @return {dw.order.ProductLineItem} - Filtered the product line item matching productId
 *  and has the same bundled items or options and the same instore pickup store selection
 */
function getExistingProductLineItemInCartWithTheSameStore(
    product,
    productId,
    productLineItems,
    childProducts,
    options,
    storeId) {
    var existingProductLineItem = null;
    var matchingProducts = base.getExistingProductLineItemsInCart(
        product,
        productId,
        productLineItems,
        childProducts,
        options);
    if (matchingProducts.length) {
        existingProductLineItem = arrayHelper.find(matchingProducts, function (matchingProduct) {
            return !storeId || hasSameStore(matchingProduct.custom.fromStoreId, storeId);
        });
    }
    return existingProductLineItem;
}

/**
 * Adds a product to the cart. If the product is already in the cart it increases the quantity of
 * that product.
 * @param {dw.order.Basket} currentBasket - Current users's basket
 * @param {string} productId - the productId of the product being added to the cart
 * @param {number} quantity - the number of products to the cart
 * @param {string[]} childProducts - the products' sub-products
 * @param {SelectedOption[]} options - product options
 * @param {string} storeId - store id
 * @param {Object} req - The local instance of the request object
 * @return {Object} returns an error object
 */
function addProductToCart(currentBasket, productId, quantity, childProducts, options, storeId, req) {
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
    var Transaction = require("dw/system/Transaction");

    var lineItemQuantity = isNaN(quantity) ? base.DEFAULT_LINE_ITEM_QUANTITY : quantity;
    var totalQtyRequested = 0;
    var canBeAdded = false;
    var inventory = productHelper.getAvailabilityModel(product).inventoryRecord;

    if (product.bundle) {
        canBeAdded = base.checkBundledProductCanBeAdded(childProducts, productLineItems, lineItemQuantity);
    } else {
        totalQtyRequested = lineItemQuantity + base.getQtyAlreadyInCart(productId, productLineItems);
        perpetual = inventory && inventory.perpetual;
        canBeAdded =
            (perpetual
            || (inventory && totalQtyRequested <= inventory.ATS.value));
    }

    if (!canBeAdded) {
        result.error = true;
        result.message = Resource.msgf(
            "error.alert.selected.quantity.cannot.be.added.for",
            "product",
            null,
            inventory ? inventory.ATS.value : 0,
            product.name
        );
        return result;
    }
    // Get the existing product line item from the basket if the new product item
    // has the same bundled items or options and the same instore pickup store selection
    productInCart = getExistingProductLineItemInCartWithTheSameStore(
        product, productId, productLineItems, childProducts, options, storeId);
    if (productInCart) {
        productQuantityInCart = productInCart.quantity.value;
        quantityToSet = lineItemQuantity ? lineItemQuantity + productQuantityInCart : productQuantityInCart + 1;
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
        var currentBasketShipment = currentBasket.shipments.length > 0 && currentBasket.shipments[0];
        var shipment = currentBasketShipment || defaultShipment;

        productLineItem = base.addLineItem(
            currentBasket,
            product,
            lineItemQuantity,
            childProducts,
            optionModel,
            shipment
        );

        // Once the new product line item is added, set the instore pickup fromStoreId for the item
        if (productLineItem.product.custom.storePickup) {
            if (storeId) {
                instorePickupStoreHelper.setStoreInProductLineItem(storeId, productLineItem);
            }
        }
        result.uuid = productLineItem.UUID;
    }

    Transaction.wrap(function () {
        COHelpers.ensureNoEmptyShipments(req);
    });

    return result;
}

base.addProductToCart = addProductToCart;
module.exports = base;
