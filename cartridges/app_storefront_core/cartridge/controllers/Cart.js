"use strict";
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
var BasketMgr     = require("dw/order/BasketMgr");
var cartHelper    = require("*/cartridge/scripts/cart/cartHelpers");
var PBHelpers     = require("*/cartridge/scripts/checkout/priceBooksHelpers");
var productHelper = require("*/cartridge/scripts/helpers/productHelpers");
var server        = require("server");
var sorEnabled    = dw.system.Site.getCurrent().getCustomPreferenceValue("SorEnabled");
var sorHelper     = require("int_smartorderrefill/cartridge/scripts/SmartOrderRefillHelper.js");
var LoggerUtils   = require("*/cartridge/scripts/utils/LoggerUtils");
var MarketingCloudUtils = require("*/cartridge/scripts/utils/MarketingCloudUtils");

server.extend(module.superModule);

server.append("Show", function (req, res, next) {
    var Site = require("dw/system/Site");

    req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

    next();
});

server.replace("UpdateQuantity", function (req, res, next) {
    var Resource = require("dw/web/Resource");
    var Transaction = require("dw/system/Transaction");
    var URLUtils = require("dw/web/URLUtils");
    var CartModel = require("*/cartridge/models/cart");
    var collections = require("*/cartridge/scripts/util/collections");
    var basketCalculationHelpers = require("*/cartridge/scripts/helpers/basketCalculationHelpers");

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.setStatusCode(500);
        res.json({
            error: true,
            redirectUrl: URLUtils.url("Cart-Show").toString()
        });

        return next();
    }

    cartHelper.checkPrescriptionModel(currentBasket);

    var productId = req.querystring.pid;
    var updateQuantity = parseInt(req.querystring.quantity, 10);
    var uuid = req.querystring.uuid;
    var productLineItems = currentBasket.productLineItems;
    var matchingLineItem = collections.find(productLineItems, function (item) {
        return item.productID === productId && item.UUID === uuid;
    });
    var availableToSell = 0;

    var totalQtyRequested = 0;
    var qtyAlreadyInCart = 0;
    var minOrderQuantity = 0;
    var canBeUpdated = false;
    var perpetual = false;
    var bundleItems;
    var bonusDiscountLineItemCount = currentBasket.bonusDiscountLineItems.length;

    if (matchingLineItem) {
        if (matchingLineItem.product.bundle) {
            bundleItems = matchingLineItem.bundledProductLineItems;
            canBeUpdated = collections.every(bundleItems, function (item) {
                var quantityToUpdate = updateQuantity *
                    matchingLineItem.product.getBundledProductQuantity(item.product).value;
                qtyAlreadyInCart = cartHelper.getQtyAlreadyInCart(
                    item.productID,
                    productLineItems,
                    item.UUID
                );
                totalQtyRequested = quantityToUpdate + qtyAlreadyInCart;
                availableToSell = productHelper.getAvailabilityModel(item.product).inventoryRecord.ATS.value;
                minOrderQuantity = item.product.minOrderQuantity.value;
                perpetual = productHelper.getAvailabilityModel(item.product).inventoryRecord.perpetual;

                return (totalQtyRequested <= availableToSell || perpetual) && (quantityToUpdate >= minOrderQuantity);
            });
        } else {
            availableToSell = productHelper.getAvailabilityModel(matchingLineItem.product).inventoryRecord.ATS.value;
            perpetual = productHelper.getAvailabilityModel(matchingLineItem.product).inventoryRecord.perpetual;
            qtyAlreadyInCart = cartHelper.getQtyAlreadyInCart(
                productId,
                productLineItems,
                matchingLineItem.UUID
            );
            totalQtyRequested = updateQuantity + qtyAlreadyInCart;
            minOrderQuantity = matchingLineItem.product.minOrderQuantity.value;
            canBeUpdated = (totalQtyRequested <= availableToSell || perpetual) && (updateQuantity >= minOrderQuantity);
        }
    }

    if (canBeUpdated) {
        Transaction.wrap(function () {
            matchingLineItem.setQuantityValue(updateQuantity);

            var previousBounsDiscountLineItems = collections.map(currentBasket.bonusDiscountLineItems, function (bonusDiscountLineItem) {
                return bonusDiscountLineItem.UUID;
            });

            basketCalculationHelpers.calculateTotals(currentBasket);
            if (currentBasket.bonusDiscountLineItems.length > bonusDiscountLineItemCount) {
                var prevItems = JSON.stringify(previousBounsDiscountLineItems);

                collections.forEach(currentBasket.bonusDiscountLineItems, function (bonusDiscountLineItem) {
                    if (prevItems.indexOf(bonusDiscountLineItem.UUID) < 0) {
                        bonusDiscountLineItem.custom.bonusProductLineItemUUID = matchingLineItem.UUID; // eslint-disable-line no-param-reassign
                        matchingLineItem.custom.bonusProductLineItemUUID = "bonus";
                        matchingLineItem.custom.preOrderUUID = matchingLineItem.UUID;
                    }
                });
            }
        });
    }

    if (matchingLineItem && canBeUpdated) {
        var basketModel = new CartModel(currentBasket);
        res.json(basketModel);
    } else {
        res.setStatusCode(500);
        res.json({
            errorMessage: Resource.msg("error.cannot.update.product.quantity", "cart", null)
        });
    }

    return next();
});

server.replace("EditProductLineItem", function (req, res, next) {
    var ProductMgr = require("dw/catalog/ProductMgr");
    var Resource = require("dw/web/Resource");
    var URLUtils = require("dw/web/URLUtils");
    var Transaction = require("dw/system/Transaction");
    var CartModel = require("*/cartridge/models/cart");
    var collections = require("*/cartridge/scripts/util/collections");
    var basketCalculationHelpers = require("*/cartridge/scripts/helpers/basketCalculationHelpers");

    var uuid = req.form.uuid;
    var productId = req.form.pid;
    var updateQuantity = parseInt(req.form.quantity, 10);

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.setStatusCode(500);
        res.json({
            error: true,
            redirectUrl: URLUtils.url("Cart-Show").toString()
        });

        return next();
    }

    cartHelper.checkPrescriptionModel(currentBasket);

    var productLineItems = currentBasket.allProductLineItems;
    var requestLineItem = collections.find(productLineItems, function (item) {
        return item.UUID === uuid;
    });

    var uuidToBeDeleted = null;
    var pliToBeDeleted;
    var newPidAlreadyExist = collections.find(productLineItems, function (item) {
        if (item.productID === productId && item.UUID !== uuid) {
            uuidToBeDeleted = item.UUID;
            pliToBeDeleted = item;
            updateQuantity += parseInt(item.quantity, 10);
            return true;
        }
        return false;
    });

    var availableToSell = 0;
    var totalQtyRequested = 0;
    var qtyAlreadyInCart = 0;
    var minOrderQuantity = 0;
    var canBeUpdated = false;
    var perpetual = false;
    var bundleItems;

    if (requestLineItem) {
        if (requestLineItem.product.bundle) {
            bundleItems = requestLineItem.bundledProductLineItems;
            canBeUpdated = collections.every(bundleItems, function (item) {
                var quantityToUpdate = updateQuantity *
                    requestLineItem.product.getBundledProductQuantity(item.product).value;
                qtyAlreadyInCart = cartHelper.getQtyAlreadyInCart(
                    item.productID,
                    productLineItems,
                    item.UUID
                );
                totalQtyRequested = quantityToUpdate + qtyAlreadyInCart;
                availableToSell = productHelper.getAvailabilityModel(item.product).inventoryRecord.ATS.value;
                perpetual = productHelper.getAvailabilityModel(item.product).inventoryRecord.perpetual;
                minOrderQuantity = item.product.minOrderQuantity.value;

                return (totalQtyRequested <= availableToSell || perpetual) && (quantityToUpdate >= minOrderQuantity);
            });
        } else {
            availableToSell = productHelper.getAvailabilityModel(requestLineItem.product).inventoryRecord.ATS.value;
            perpetual = productHelper.getAvailabilityModel(requestLineItem.product).inventoryRecord.perpetual;
            qtyAlreadyInCart = cartHelper.getQtyAlreadyInCart(
                productId,
                productLineItems,
                requestLineItem.UUID
            );
            totalQtyRequested = updateQuantity + qtyAlreadyInCart;
            minOrderQuantity = requestLineItem.product.minOrderQuantity.value;
            canBeUpdated = (totalQtyRequested <= availableToSell || perpetual) && (updateQuantity >= minOrderQuantity);
        }
    }

    var error = false;
    if (canBeUpdated) {
        var product = ProductMgr.getProduct(productId);

        try {
            Transaction.wrap(function () {
                if (newPidAlreadyExist) {
                    var shipmentToRemove = pliToBeDeleted.shipment;
                    currentBasket.removeProductLineItem(pliToBeDeleted);
                    if (shipmentToRemove.productLineItems.empty && !shipmentToRemove.default) {
                        currentBasket.removeShipment(shipmentToRemove);
                    }
                }

                if (!requestLineItem.product.bundle) {
                    requestLineItem.replaceProduct(product);
                }

                requestLineItem.setQuantityValue(updateQuantity);

                basketCalculationHelpers.calculateTotals(currentBasket);
            });
        } catch (e) {
            error = true;
        }
    }

    if (!error && requestLineItem && canBeUpdated) {
        var cartModel = new CartModel(currentBasket);

        var responseObject = {
            cartModel: cartModel,
            newProductId: productId
        };

        if (uuidToBeDeleted) {
            responseObject.uuidToBeDeleted = uuidToBeDeleted;
        }

        res.json(responseObject);
    } else {
        res.setStatusCode(500);
        res.json({
            errorMessage: Resource.msg("error.cannot.update.product", "cart", null)
        });
    }

    return next();
});

server.append("UpdateQuantity", hasClubProducts);
server.append("MiniCartShow", forceLogInForRefillCustomers, hasClubProducts, addAvailability, buildMcCart);
server.append("Show", forceLogInForRefillCustomers, hasClubProducts, addAvailability, buildMcCart);
server.append("GetProduct", addAvailability);
server.append("MiniCart", server.middleware.include, function (req, res, next) {
    var viewData = res.getViewData();
    // add new variable for link mode
    viewData.linkMode = req.querystring.linkMode || null;
    res.setViewData(viewData);
    next();
});

server.append("RemoveProductLineItem", function (req, res, next) {
    var currentBasket = BasketMgr.getCurrentBasket();

    cartHelper.checkPrescriptionModel(currentBasket);

    var basket = res.viewData.basket;
    basket.hasClubProducts = cartHelper.hasClubProducts();
    res.viewData.basket = basket;

    LoggerUtils.sessionInfo("Removed product from cart: " + req.querystring.pid + " (UUID: " + req.querystring.uuid + ")");

    next();
});

server.append("EditBonusProduct", function (req, res, next) {
    var viewData = res.getViewData();
    var collections = require("*/cartridge/scripts/util/collections");
    var duuid = req.querystring.duuid;
    var currentBasket = BasketMgr.getCurrentOrNewBasket();
    var bonusDiscountLineItem = collections.find(currentBasket.getBonusDiscountLineItems(), function (item) {
        return item.UUID === duuid;
    });

    var promotion = bonusDiscountLineItem.promotion;

    viewData.labels.header = !empty(promotion) && !empty(promotion.calloutMsg) ? promotion.calloutMsg.markup : "";

    res.setViewData(viewData);
    next();
});

/**
 * Middleware to inject a boolean value in the viewData
 * meaning whether the basket has any unavailable products
 */
function addAvailability(_req, res, next) {
    var viewdata = res.getViewData();
    viewdata.hasUnavailableProducts = productHelper.basketHasUnavailableProducts();
    res.setViewData(viewdata);
    next();
}

function buildMcCart(_req, res, next) {
    var basket = BasketMgr.getCurrentOrNewBasket();
    var mcCart =MarketingCloudUtils.buildCart(basket);
    var viewData = res.getViewData();
    viewData.marketingCloudCart = mcCart;
    res.setViewData(viewData);
    next();
}

/**
 * Endpoint was modified in order to ensure  pdict values required by Smart Order Refill is available in cart
 * This ensures that a gust customer is not allowed to continue if they have Smart Order Refill products in the cart
 */
function forceLogInForRefillCustomers(req, res, next) {
    if (sorEnabled) {
        var viewData = res.getViewData();
        var hasRefillProducts = sorHelper.checkForRefillProducts();
        var customerLoggedIn = customer.authenticated;

        viewData.hasRefillProducts = hasRefillProducts;
        viewData.showLogInMessage = !customerLoggedIn && hasRefillProducts;
        res.setViewData(viewData);
    }
    next();
}

/**
 * Injects a boolean attribute in the viewdata
 */
function hasClubProducts(req, res, next) {
    var viewData = res.getViewData();
    viewData.hasClubProducts = cartHelper.hasClubProducts();
    res.setViewData(viewData);
    next();
}

server.get("MiniCartCheckout", function (req, res, next) {
    var Transaction = require("dw/system/Transaction");
    var CartModel = require("*/cartridge/models/cart");
    var reportingUrlsHelper = require("*/cartridge/scripts/reportingUrls");
    var basketCalculationHelpers = require("*/cartridge/scripts/helpers/basketCalculationHelpers");

    var currentBasket = BasketMgr.getCurrentBasket();
    var reportingURLs;

    if (currentBasket) {
        Transaction.wrap(function () {
            if (currentBasket.currencyCode !== req.session.currency.currencyCode) {
                currentBasket.updateCurrency();
            }
            cartHelper.ensureAllShipmentsHaveMethods(currentBasket);
            basketCalculationHelpers.calculateTotals(currentBasket);
        });
    }

    if (currentBasket && currentBasket.allLineItems.length) {
        reportingURLs = reportingUrlsHelper.getBasketOpenReportingURLs(currentBasket);
    }

    res.setViewData({ reportingURLs: reportingURLs });


    var basketModel = new CartModel(currentBasket);
    basketModel.hasClubProducts = cartHelper.hasClubProducts();

    res.render("checkout/cart/miniCartCheckout", basketModel);
    next();
});

server.prepend("AddProduct", function (req, res, next) {
    PBHelpers.updatePriceBooks(req);

    next();
});

server.append("AddProduct", function (req, res, next) {
    cartHelper.checkPrescriptionModel(BasketMgr.getCurrentBasket());
    next();
});

server.get("GetNewBonusDiscountLineItem", function (req, res, next) {
    var Resource = require("dw/web/Resource");
    var URLUtils = require("dw/web/URLUtils");
    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.json({});
        return next();
    }

    var collections = require("*/cartridge/scripts/util/collections");
    var bonusDiscountLineItems = currentBasket.getBonusDiscountLineItems();
    var bonusLineItems = currentBasket.bonusLineItems;
    var BONUS_PRODUCTS_PAGE_SIZE = cartHelper.BONUS_PRODUCTS_PAGE_SIZE;
    var urlObject = {
        url: URLUtils.url("Cart-ChooseBonusProducts").toString(),
        configureProductstUrl: URLUtils.url("Product-ShowBonusProducts").toString(),
        addToCartUrl: URLUtils.url("Cart-AddBonusProducts").toString()
    };
    var result = {};

    collections.forEach(bonusDiscountLineItems, function (newBonusDiscountLineItem) {
        var item = collections.find(bonusLineItems, function (bonusItem) {
            return newBonusDiscountLineItem === bonusItem.bonusDiscountLineItem;
        });

        if (!item) {
            result.bonusChoiceRuleBased = newBonusDiscountLineItem.bonusChoiceRuleBased;
            result.bonuspids = [];

            var iterBonusProducts = newBonusDiscountLineItem.bonusProducts.iterator();
            while (iterBonusProducts.hasNext()) {
                var newBProduct = iterBonusProducts.next();
                result.bonuspids.push(newBProduct.ID);
            }

            result.uuid = newBonusDiscountLineItem.UUID;
            result.pliUUID = newBonusDiscountLineItem.custom.bonusProductLineItemUUID;
            result.maxBonusItems = newBonusDiscountLineItem.maxBonusItems;
            result.addToCartUrl = urlObject.addToCartUrl;
            result.showProductsUrl = urlObject.configureProductstUrl;
            result.showProductsUrlListBased = URLUtils.url("Product-ShowBonusProducts", "DUUID", newBonusDiscountLineItem.UUID, "pids", result.bonuspids.toString(), "maxpids", newBonusDiscountLineItem.maxBonusItems).toString();
            result.showProductsUrlRuleBased = URLUtils.url("Product-ShowBonusProducts", "DUUID", newBonusDiscountLineItem.UUID, "pagesize", BONUS_PRODUCTS_PAGE_SIZE, "pagestart", 0, "maxpids", newBonusDiscountLineItem.maxBonusItems).toString();
            result.pageSize = BONUS_PRODUCTS_PAGE_SIZE;
            result.configureProductstUrl = URLUtils.url("Product-ShowBonusProducts", "pids", result.bonuspids.toString(), "maxpids", newBonusDiscountLineItem.maxBonusItems).toString();
            result.newBonusDiscountLineItem = newBonusDiscountLineItem;
            result.labels = {
                close: Resource.msg("link.choiceofbonus.close", "product", null),
                selectprods: Resource.msgf("modal.header.selectproducts", "product", null, null),
                maxprods: Resource.msgf("label.choiceofbonus.selectproducts", "product", null, newBonusDiscountLineItem.maxBonusItems)
            };
            var promotion = newBonusDiscountLineItem.promotion;
            if (!empty(promotion)) {
                result.labels.header = !empty(promotion) && !empty(promotion.calloutMsg) ? promotion.calloutMsg.markup : "";
            }
        }
    });

    res.json({
        newBonusDiscountLineItem: result
    });

    next();
});

module.exports = server.exports();
