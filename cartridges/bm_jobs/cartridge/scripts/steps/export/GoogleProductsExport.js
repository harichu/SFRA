"use strict";

var Site            = require("dw/system/Site");
var File            = require("dw/io/File");
var FileWriter      = require("dw/io/FileWriter");
var XMLStreamWriter = require("dw/io/XMLIndentingStreamWriter");
var CatalogMgr      = require("dw/catalog/CatalogMgr");
var ProductMgr      = require("dw/catalog/ProductMgr");
var URLUtils        = require("dw/web/URLUtils");
var StringUtils     = require("dw/util/StringUtils");
var Promotion       = require("dw/campaign/Promotion");
var PromotionMgr    = require("dw/campaign/PromotionMgr");

var NS_PREFIX = "g";
var NS_URI    = "http://base.google.com/ns/1.0";

var xsw;
var products;
var hostname;

/**
 * Preparation step to do before job starts
 */
module.exports.beforeStep = function (params) {
    var fileName = Site.getCurrent().ID + "_Feed";
    var exportPath = params.ExportPath;
    var feedTitle = params.FeedTitle;
    var feedDescription = params.FeedDescription;

    products = ProductMgr.queryAllSiteProducts();
    hostname = params.SiteHostName;

    var googleFeedLibrary = params.LibraryId;

    (new File(StringUtils.format("{0}/{1}/{2}", File.LIBRARIES, googleFeedLibrary, exportPath))).mkdirs();

    var fullPath = StringUtils.format("{0}/{1}/{2}/{3}.xml", File.LIBRARIES, googleFeedLibrary, exportPath, fileName);
    xsw = new XMLStreamWriter(new FileWriter(
        new File(fullPath)
    ));

    writeOpening(xsw);

    request.setLocale(params.locale);
    writeSingleElement(xsw, "title", feedTitle, false);
    writeSingleElement(xsw, "link", URLUtils.httpsHome().host(hostname).toString());
    writeSingleElement(xsw, "description", feedDescription, false);
};

module.exports.getTotalCount = function () {
    return products.getCount();
};

module.exports.read = function () {
    if (products.hasNext()) {
        return products.next();
    }
};

/**
 * Main method to process entries
 */
module.exports.process = function (product) {
    if (product.isOnline()) {
        var item = {};

        request.setLocale("en_US");
        var master;

        if (product.isVariant()) {
            master = product.getVariationModel().getMaster();
        } else if (product.isMaster()) {
            master = product;
        } else if (product.isProductSet()) {
            master = product;
        } else if (product.isProductSetProduct() && product.productSets.length) {
            master = product.productSets[0];
        } else {
            master = product;
        }

        var allCategories = getAllCategories(null, product.getID(), []).reverse();

        item.title = product.getName() || null;
        item.description = master ? master.getShortDescription() : product.getShortDescription();
        item.link = URLUtils.http("Product-Show", "pid", product.getID()).host(hostname).toString();
        item.color = getItemAttributes(product, "color");
        item.product_type = allCategories.join(" > ");
        item.id            = product.getID();
        item.brand         = product.getBrand() || "";
        item.item_group_id = product.variant ? product.getVariationModel().getMaster().getID() : product.getID();
        item.condition     = "New";
        item.availability  = product.getAvailabilityModel().isInStock() ? "in stock" : "out of stock";

        var PriceModel = product.getPriceModel();
        if (PriceModel.priceInfo) {
            var priceBook = PriceModel.priceInfo.priceBook;
            while (priceBook.parentPriceBook) {
                priceBook = priceBook.parentPriceBook ? priceBook.parentPriceBook : priceBook;
            }
            var StandardPrice = PriceModel.getPriceBookPrice(priceBook.ID);
            StandardPrice = StandardPrice.available ? StandardPrice : PriceModel.getPrice();
            var SalesPrice = PriceModel.getPrice();

            var promos = PromotionMgr.getActivePromotions().getProductPromotions(product);
            var promo = getPublicProductPromotion(promos);

            if (promo) {
                if (product.optionProduct) {
                    SalesPrice = promo.getPromotionalPrice(product, product.getOptionModel());
                } else {
                    SalesPrice = promo.getPromotionalPrice(product);
                }
            }

            item.price = StandardPrice.available ? StandardPrice.getValue() + " " + StandardPrice.getCurrencyCode() : null;

            if (SalesPrice && SalesPrice.available && StandardPrice.available && StandardPrice.compareTo(SalesPrice) !== 0) {
                item.sale_price = SalesPrice.getValue() + " " + SalesPrice.getCurrencyCode();
            }
        }

        item.size             = getItemAttributes(product, "size");
        item.mpn              = product.getManufacturerSKU() || null;
        item.image_link       = getImageUrl(product, "medium");
        item.additional_image = getAdditionalImageUrl(product, "medium") || null;
        item.upc              = product.getUPC() || null;

        return item;
    }
};

function getPublicProductPromotion(promotions) {
    var promos = promotions.toArray().filter(function (promotion) {
        return promotion.getPromotionClass() == Promotion.PROMOTION_CLASS_PRODUCT
            && !promotion.basedOnCoupons
            && !promotion.basedOnSourceCodes
            && isPublicPromotion(promotion);
    });
    return promos.length ? promos[0] : null;
}

function isPublicPromotion(promotion) {
    var customerGroups = promotion.getCustomerGroups();
    var hasCustomerGroups = customerGroups.length;
    // used to avoid universal campaigns without customer groups (which would always match condition !basedOnCustomerGroups)
    var isPublic = (hasCustomerGroups && !promotion.basedOnCustomerGroups) || customerGroups.toArray().filter(function (customerGroup) {
        return customerGroup.ID == "Everyone";
    }).length > 0;
    return isPublic;
}

module.exports.write = function (productDataList) {
    var productDataIterator = productDataList.iterator();

    while (productDataIterator.hasNext()) {
        var product = productDataIterator.next();
        if (product.title && product.price) {
            xsw.writeStartElement("item");
            writeAttributes(xsw, product);
            xsw.writeEndElement();
        }
    }
};

/**
 * Closure step to finish and proper close files
 */
module.exports.afterStep = function () {
    writeClosure(xsw);
    products.close();
};

/**
 * Writes opening XML tags.
 *
 * @param {*} writer - writes properties to XML
 */
function writeOpening(writer) {
    writer.setPrefix(NS_PREFIX, NS_URI);
    writer.writeStartDocument();
    writer.writeStartElement("rss");
    writer.writeNamespace(NS_PREFIX, NS_URI);
    writer.writeAttribute("version", "2.0");
    writer.writeStartElement("channel");
}

/**
 * Method opens the tag, writes value and closes it.
 *
 * @param {*} writer - writes properties to XML
 * @param {*} key - name of tag
 * @param {*} value - value inside of tag
 * @param {*} withNS - if true than add g: prefix to tag
 */
function writeSingleElement(writer, key, value, withNS) {
    if (key && value) {
        withNS ? writer.writeStartElement(NS_URI, key) : writer.writeStartElement(key);
        writer.writeCharacters(value);
        writer.writeEndElement();
    }
}

/**
 * Gets product color or size from variation model and returns them.
 *
 * @param {*} product - product
 * @param {*} attribute - variation product's attributes
 */
function getItemAttributes(product, attribute) {
    var productVariationModel     = product.getVariationModel();
    var productVariationAttribute = productVariationModel.getProductVariationAttribute(attribute);

    if (productVariationAttribute) {
        var productVariationAttributeValue = productVariationModel.getVariationValue(product, productVariationAttribute);

        if (productVariationAttributeValue) {
            return productVariationAttributeValue.getDisplayValue();
        }
    }

    return null;
}

/**
 * Gets all product categories and returns them in an array.
 *
 * @param {*} cgid - category ID
 * @param {*} pid - product ID
 * @param {*} categories - array of categories
 */
function getAllCategories(cgid, pid, categories) {
    var category,
        product;

    if (pid) {
        product  = ProductMgr.getProduct(pid);
        category = product.variant ? product.masterProduct.primaryCategory : product.primaryCategory;
    } else if (cgid) {
        category = CatalogMgr.getCategory(cgid);
    }

    if (category) {
        categories.push(category.displayName);
        if (category.parent && category.parent.ID !== "root") {
            return getAllCategories(category.parent.ID, null, categories);
        }
    }

    return categories;
}

/**
 * Writes product specific attributes to XML.
 *
 * @param {*} writer - writes properties to XML
 * @param {*} product - product object (item object)
 */
function writeAttributes(writer, product) {
    writeSingleElement(writer, "id", product.id, true);
    writeSingleElement(writer, "title", product.title, true);
    writeSingleElement(writer, "description", product.description, true);
    writeSingleElement(writer, "link", product.link, true);
    writeSingleElement(writer, "image_link", product.image_link, true);

    if (product.additional_image) {
        writeSingleElement(writer, "additional_image_link", product.additional_image, true);
    }

    writeSingleElement(writer, "availability", product.availability, true);

    if (product.price) {
        writeSingleElement(writer, "price", product.price, true);
    }
    if (product.sale_price) {
        writeSingleElement(writer, "sale_price", product.sale_price, true);
    }

    writeSingleElement(writer, "google_product_category", product.google_product_category, true);
    writeSingleElement(writer, "product_type", product.product_type, true);
    writeSingleElement(writer, "brand", product.brand, true);
    writeSingleElement(writer, "mpn", product.mpn, true);
    writeSingleElement(writer, "upc", product.upc, true);

    if ((!product.upc && !product.brand) || (!product.mpn && !product.brand)) {
        writeSingleElement(writer, "identifier_exists", "no", true);
    } else {
        writeSingleElement(writer, "identifier_exists", "yes", true);
    }

    writeSingleElement(writer, "item_group_id", product.item_group_id, true);
    writeSingleElement(writer, "condition", product.condition, true);
    writeSingleElement(writer, "color", product.color, true);
    writeSingleElement(writer, "size", product.size, true);
}

/**
 * Write closing tags and close XML writer.
 *
 * @param {*} writer - writes properties to XML
 */
function writeClosure(writer) {
    writer.writeEndElement(); // end channel
    writer.writeEndElement(); // end rss
    writer.writeEndDocument();
    writer.close();
}

/**
 * Get product image url 
 * @param {string|dw.catalog.Product} product - Product instance
 * @param {string} type - View type of the image (e.g. large, medium, small)
 * @returns {string|null} url - First image url or null.
 */
function getImageUrl(product, type) {
    var images = product.getImages(type);

    if (images && images.length >= 1) {
        return images[0].absURL;
    }
    return null;
}

/**
 * Get additional product images url 
 *
 * @param {string|dw.catalog.Product} product - Product instance
 * @param {string} type - View type of the image (e.g. large, medium, small)
 * @returns {string|null} url - Additional image url or null.
 */
function getAdditionalImageUrl(product, type) {
    var images = product.getImages(type);

    if (images && images.length >= 2) {
        return images[1].absURL;
    }
    return null;
}
