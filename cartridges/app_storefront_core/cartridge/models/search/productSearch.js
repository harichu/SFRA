"use strict";

var base = module.superModule;
var preferences = require("*/cartridge/config/preferences");
var defaultPageSize = preferences.defaultPageSize || 12;

/**
 * Configures and returns a PagingModel instance
 *
 * @param {dw.util.Iterator} productHits Iterator for product search results
 * @param {number} count Number of products in search results
 * @param {number} pageSize Number of products to display
 * @param {number} startIndex Beginning index value
 * @return {dw.web.PagingModel} PagingModel instance
 */
function getPagingModel(productHits, count, pageSize, startIndex) {
    var PagingModel = require("dw/web/PagingModel");
    var paging = new PagingModel(productHits, count);

    paging.setStart(startIndex || 0);
    paging.setPageSize(pageSize || defaultPageSize);

    return paging;
}

/**
 * Generates URL for [Show] More button
 *
 * @param {dw.catalog.ProductSearchModel} productSearch Product search object
 * @param {Object} httpParams HTTP query parameters
 * @return {string} More button URL
 */
function getPagesLinks(productSearch, httpParams) {
    var pagesLinks = [];
    var showMoreEndpoint = "Search-UpdateGrid";
    var pageSize = httpParams.sz || defaultPageSize;
    var hitsCount = productSearch.count;
    var pagesLength = Math.ceil(hitsCount / pageSize);

    for (var currentStart = 0 ; currentStart < pagesLength ; currentStart++) {
        var paging = getPagingModel(
            productSearch.productSearchHits,
            hitsCount,
            defaultPageSize,
            (currentStart * pageSize)
        );
        var baseUrl = productSearch.url(showMoreEndpoint);
        var finalUrl = paging.appendPaging(baseUrl);
        pagesLinks.push(finalUrl);
    }

    return pagesLinks;
}

function ProductSearch(productSearch, httpParams, sortingRule, sortingOptions, rootCategory) {
    var urlHelper = require("*/cartridge/scripts/helpers/urlHelpers");
    var productSearchObj = new base(productSearch, httpParams, sortingRule, sortingOptions, rootCategory);
    productSearchObj.pagesLinks = getPagesLinks(productSearch, httpParams);

    if (productSearch.category && productSearch.category.thumbnail !== null) {
        productSearchObj.category.thumbnail = productSearch.category.thumbnail;
    }

    var updateGridURL = productSearch.url("Search-UpdateGrid").toString();
    var defaultSearchURL = urlHelper.appendQueryParams(updateGridURL, { start: "0", sz: defaultPageSize }).toString();

    productSearchObj.defaultSearchURL = defaultSearchURL;

    return productSearchObj;
}

module.exports = ProductSearch;
