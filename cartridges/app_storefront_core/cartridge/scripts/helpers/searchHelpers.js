"use strict";

var base = module.superModule;
var URLUtils = require("dw/web/URLUtils");
var PagingModel = require("dw/web/PagingModel");

/**
 * Function to format page links according to FSD 2.2
 * @param {string[]} pagesLinks Array with all urls of that search
 * @param {number} currentPage current page of the user
 * @returns {Object[]} formattedLinks return a array of objects which object may contain 3 variables
 * @returns {string} formattedLinks[].name the infomation that will be display
 * @returns {string} formattedLinks[].url link to where the user will be redirected
 * @returns {boolean} formattedLinks[].selected conditional that verify if the link is equal the actual page
 */
function formatPageLinks(pagesLinks, currentPage) {
    var formatedPagesLink = [];

    if (!empty(pagesLinks) && currentPage < pagesLinks.length) {
        formatedPagesLink.push({name: "" + (currentPage + 1), url: pagesLinks[currentPage], selected: true});

        if (currentPage == (pagesLinks.length - 1)) {
            var maxIteration = Math.min(4, pagesLinks.length);
            for (var i = 1; i < maxIteration; i++) {
                var index = (pagesLinks.length - 1) - i;
                formatedPagesLink.unshift({name: "" + (index + 1), url: pagesLinks[index]});
            }
        } else if (currentPage > 0) {
            formatedPagesLink.unshift({name: "" + (currentPage), url: pagesLinks[currentPage - 1]});
        }

        if (currentPage > 1 && formatedPagesLink[0].url != pagesLinks[0]) {
            formatedPagesLink[0].name = "...";
            formatedPagesLink[0].dots = true;
            formatedPagesLink.unshift({name: "" + (1), url: pagesLinks[0]});
        }

        for (var j = currentPage + 1; j < pagesLinks.length && j < currentPage + 5; j++) {
            formatedPagesLink.push({name: "" + (j + 1), url: pagesLinks[j]});
        }

        if (currentPage + 3 < pagesLinks.length && formatedPagesLink[formatedPagesLink.length-1].name != pagesLinks.length) {
            formatedPagesLink[formatedPagesLink.length-1].name = "...";
            formatedPagesLink[formatedPagesLink.length-1].dots = true;
            formatedPagesLink.push({name: "" + (pagesLinks.length), url: pagesLinks[pagesLinks.length - 1]});
        }
    }

    return formatedPagesLink;
}

/**
 * Function to get the PagingModel needed for the Content pagination
 * @param {dw.util.Collection} content - The online content of the folder.
 * @param {Number} pageStart - The index of the first element of the page.
 * @param {Number} pageSize - The number of the elements in one page.
 * @returns {dw.web.PagingModel} - The PagingModel created with the given info.
 */

function getContentPagingModel(content, pageStart, pageSize) {
    var pagingModel = new PagingModel(content);
    pagingModel.setStart(pageStart);
    pagingModel.setPageSize(pageSize);

    return pagingModel;
}

/**
 * Function to reduce the number of elements in the Online Content Collection.
 * @param {dw.util.Collection} content - The online content of the folder.
 * @param {Number} currentStart - The index of the first element of the page.
 * @param {Number} pageSize  - The number of elements in one page.
 * @returns {Array} - The array created, starting from the given index until limit is reached.
 */
function formatContent(content, currentStart, pageSize) {
    var result = content.toArray(currentStart, pageSize);

    return result;
}

/**
 * Function to get the page links of a given content folder.
 * @param {dw.content.Folder} folder - The selected folder.
 * @param {Number} currentStart - The index of the first element of the page.
 * @param {Number} pageSize - The number of elements in one page.
 * @returns {Array} - Returns the array of links.
 */
function getContentPageLinks(folder, currentStart, pageSize) {
    var contentPageLinks = [];
    var hitsCount = folder.getOnlineContent().length;
    var pagesLength = Math.ceil(hitsCount / pageSize);

    for (currentStart = 0; currentStart < pagesLength; currentStart++) {
        var paging = getContentPagingModel(
            folder.getOnlineContent(),
            currentStart * pageSize,
            pageSize
        );
        var baseUrl = URLUtils.url("Search-ShowContent", "fdid", folder.getID());
        var finalUrl = paging.appendPaging(baseUrl);
        contentPageLinks.push(finalUrl);
    }

    return contentPageLinks;
}

/**
 * performs a search
 *
 * @param {Object} req Provided HTTP query parameters
 * @param {Object} res Provided HTTP query parameters
 * @return {Object} an object with relevant search information
 */
function search(req, res) {
    var response = base.search(req, res);

    //Added behavior to redirect when there is just one product found in the search
    if (!response.searchRedirect) {
        if (response.productSearch.count === 1 && response.productSearch.productIds[0]) {
            var productRedirect = URLUtils.url("Product-Show", "pid", response.productSearch.productIds[0].productID).relative().toString();
            if (productRedirect) {
                return { searchRedirect: productRedirect };
            }
        }
    }

    return response;
}

function searchAjax(req, res) {
    var pricebookHelpers = require("*/cartridge/scripts/checkout/priceBooksHelpers");

    pricebookHelpers.applyListPriceBook();
    var response = base.search(req, res);

    return response;
}

function getSearchOptionsArray(optionsNumber, defaultOption) {
    var searchOptionsArray = [];

    for (var i = 1; i <= optionsNumber; i++) {
        searchOptionsArray.push(defaultOption * i);
    }

    return searchOptionsArray;
}

/**
 * Calculate and return the pagination visibility and load more URL
 * @param {String} url - The base URL for grid update
 * @param {String} start - The index of the first element of the page.
 * @param {String} size - The current number of the elements in one page.
 * @param {String} maxsize - The maximum selected number of elements
 * @param {String} step - The increment of the lazyload
 * @param {Boolean} isLast - Comes as true is on the last page
 * @returns {Object} Returns an object with pagination and URL
 */
function getLazyLoadObj(url, start, size, maxsize, step, isLast) {
    var urlHelper = require("*/cartridge/scripts/helpers/urlHelpers");
    var showPagination = true;
    var newStepSize = step;
    var newPageSize;

    if (size < maxsize) {
        if ((maxsize - size) / step < 1) {
            newStepSize = maxsize - size;
        }
        showPagination = false;
    }

    if (isLast) {
        newPageSize = maxsize;
    } else {
        newPageSize = Number(size) + Number(newStepSize);
    }

    var updatedURL = urlHelper.appendQueryParams(url, { start: start, sz: newPageSize, maxsize: maxsize}).toString();

    return {
        showPagination: showPagination,
        url: updatedURL
    };
}

exports.setupSearch = base.setupSearch;
exports.getCategoryTemplate = base.getCategoryTemplate;
exports.setupContentSearch = base.setupContentSearch;
exports.applyCache = base.applyCache;
exports.search = search;
exports.formatPageLinks = formatPageLinks;
exports.formatContent = formatContent;
exports.getContentPageLinks = getContentPageLinks;
exports.searchAjax = searchAjax;
exports.getSearchOptionsArray = getSearchOptionsArray;
exports.getLazyLoadObj = getLazyLoadObj;
