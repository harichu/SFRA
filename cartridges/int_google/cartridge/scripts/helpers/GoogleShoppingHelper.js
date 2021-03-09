"use strict";

var Site         = require("dw/system/Site");
var File         = require("dw/io/File");
var PriceBookMgr = require("dw/catalog/PriceBookMgr");
var SortedMap    = require("dw/util/SortedMap");
var FileWriter   = require("dw/io/FileWriter");
var URLUtils     = require("dw/web/URLUtils");
var CSVStreamWriter = require("dw/io/CSVStreamWriter");
var ProductAvailabilityModel = require("dw/catalog/ProductAvailabilityModel");

/**
 * Helper function to get variation attribute values
 * @param {dw.catalog.ProductVariationModel} variationModel
 * @param {string} attributeID
 */
function getVariationValue(variationModel, attributeID) {
    var attribute       = variationModel ? variationModel.getProductVariationAttribute(attributeID) : null;
    var attributeValue  = attribute      ? variationModel.getSelectedValue(attribute) : null;
    var displayValue    = attributeValue ? attributeValue.displayValue : null;
    return displayValue || "";
}

/**
 * Helper function to get the primary category of the product
 * @param {dw.catalog.Product} categorySource
 */
function getCategory(categorySource) {
    var category = null;
    if (categorySource.primaryCategory && categorySource.primaryCategory.ID != "root") {
        category = categorySource.primaryCategory;
    } else {
        for (var i = 0; i < categorySource.categories.length; i++) {
            if (categorySource.categories[i].ID != "root") {
                category = categorySource.categories[i];
                break;
            }
        }
    }
    return category;
}

/**
 * Create GS feed using all valid products
 * @param {SeekableIterator} allProducts
 */
function createGSFeed(allProducts) {
    var line         = new SortedMap();
    var productCount = 0;
    var siteID       = Site.getCurrent().ID;
    var path         = "Impex/upload/GoogleShopping";
    var dirs         = new File(path);
    var file         = new File(path + "/" + "googleFeed-" + siteID + ".csv");

    dirs.mkdirs();
    var fileWriter   = new FileWriter(file, "UTF-8");
    var writer       = new CSVStreamWriter(fileWriter, String.fromCharCode(9));

    line.id               = "id";
    line.title            = "title";
    line.description      = "description";
    line.link             = "link";
    line.gtin             = "gtin";
    line.mpn              = "mpn";
    line.image_link       = "image_link";
    line.otherImages      = "additional_image_link";
    line.availability     = "availability";
    line.price            = "price";

    //variants
    line.item_group_id    = "item_group_id";
    line.material         = "material";
    line._size            = "size";
    line.color            = "color";

    line.brand            = "brand";
    line.condition        = "condition";
    line.adult            = "adult";

    line.googleCategoryID = "google_product_category";
    line.breadCrumb       = "product_type";
    line.age_group        = "age_group";
    line.gender           = "gender";

    try {
        writer.writeNext(line.values().toArray());
        line.condition  = "new";

        var sitePriceBooks = PriceBookMgr.sitePriceBooks.toArray();
        PriceBookMgr.setApplicablePriceBooks(sitePriceBooks);

        while (allProducts.hasNext()) {
            var product = allProducts.next();

            if (product.isProductSet() || product.isBundle() || product.isMaster() || !product.isOnline()) {
                continue;
            }

            var price = product.getPriceModel().getPrice();
            var availability = product.getAvailabilityModel().getAvailabilityStatus();

            if (!price.available
                || price.getValue() == 0
                || availability == ProductAvailabilityModel.AVAILABILITY_STATUS_NOT_AVAILABLE
            ) {
                continue;
            }

            var images = product.getImages("large");
            if (images.length == 0 || images[0].httpsURL == null) {
                continue;
            }

            var categorySource  = product.isVariant() ? product.masterProduct : product;
            var category        = getCategory(categorySource);

            //166 id is default for Apparel && Accessories products.
            //google merchant categories: http://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.xls
            var googleCategoryID = product.custom.googleCategoryID || "166",
                breadCrumb       = "";

            if (category) {
                var categories   = [];
                while (category.ID != "root") {
                    categories.push((category.displayName || "").trim());
                    category = category.parent;
                }
                breadCrumb = categories.reverse().join(" > ");
            }

            var otherImages = [];
            for (var j = 1; j < images.length; j++) {
                if (images[j].httpsURL != null) {
                    otherImages.push(encodeURI(images[j].httpsURL.toString()));
                }
            }

            var title = product.getName() || product.getID();
            var link  = URLUtils.https("Product-Show", "pid", product.ID).toString();

            line.id               = product.getID();
            line.title            = title;
            line.description      = title + " - " + (product.brand || "Difarma");
            line.gtin             = product.getEAN() || product.getUPC() || "";
            line.mpn              = line.gtin ? "" : product.getEAN() || product.getUPC() || product.ID.substr(0, 70);
            line.link             = encodeURI(link);
            line.image_link       = encodeURI(images[0].httpsURL.toString());
            line.availability     = availability == ProductAvailabilityModel.AVAILABILITY_STATUS_IN_STOCK ? "in stock" : "preorder";
            line.price            = price.getValue() + " " + price.getCurrencyCode();
            line.googleCategoryID = googleCategoryID;
            line.breadCrumb       = breadCrumb;
            line.age_group        = product.custom.googleProductAgeGroup || "";
            line.otherImages      = otherImages.join(",");
            line.material         = product.custom.googleProductMaterial || "";
            line.adult            = product.custom.googleHasMatureContent || "no";
            line.brand            = !empty(product.brand) ? product.brand : "Difarma";
            line.gender           = product.custom.googleProductGender || "";
            if (product.isVariant()) {
                var variationModel = product.getVariationModel();
                line.item_group_id = variationModel.master.ID;
                line._size         = getVariationValue(variationModel, "size");
                line.color         = getVariationValue(variationModel, "color");
            } else {
                line.item_group_id = "";
                line._size         = "";
                line.color         = "";
            }

            writer.writeNext(line.values().toArray());
            productCount++;

            if (productCount % 700 == 0) {
                fileWriter.flush();
            }
        }
    }
    finally {
        writer.close();
        fileWriter.close();
        allProducts.close();
        PriceBookMgr.setApplicablePriceBooks(sitePriceBooks);
    }
    return file;
}

module.exports.createGSFeed = createGSFeed;
