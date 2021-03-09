"use strict";

var server = require("server");
var base = module.superModule;
var productHelper = require("*/cartridge/scripts/helpers/productHelpers");
var searchHelper = require("*/cartridge/scripts/helpers/searchHelpers");
var Resource = require("dw/web/Resource");
var URLUtils = require("dw/web/URLUtils");
var preferences = require("*/cartridge/config/preferences");

var defaultPageSize = preferences.defaultPageSize || 12;
var defaultContentPageSize = 8;

var cache = require("*/cartridge/scripts/middleware/cache");
var consentTracking = require("*/cartridge/scripts/middleware/consentTracking");
var pageMetaData = require("*/cartridge/scripts/middleware/pageMetaData");

server.extend(base);

/**
 * Set breadcrumbs for Search properly
 * @returns {Array} an array of breadcrumbs
 */
function getBreadcrumbs() {
    var cgid = request.httpParameterMap.cgid;
    var home = {
        htmlValue : Resource.msg("global.home", "common", null),
        url : URLUtils.home().toString()
    };
    var breadcrumbs = null;
    if (!empty(cgid.stringValue)) {
        // Due to the recursive nature of getAllBreadcrumbs, it comes reversed
        breadcrumbs = productHelper.getAllBreadcrumbs(cgid, null, []).reverse();
    } else {
        breadcrumbs = [
            {
                htmlValue : Resource.msg("label.search.results", "common", null),
                url : "#"
            }
        ];
        breadcrumbs.unshift(home);
    }
    return breadcrumbs;
}

server.prepend("Show", function (req, res, next) {
    var pricebookHelpers = require("*/cartridge/scripts/checkout/priceBooksHelpers");

    pricebookHelpers.applyListPriceBook();

    next();
});

server.append("Show", function (req, res, next) {
    var SuggestModel = require("dw/suggest/SuggestModel");

    var viewData = res.getViewData();
    var breadcrumbs = getBreadcrumbs();
    var pageSize = req.querystring.sz || defaultPageSize;
    var currentStart = req.querystring.start || 0;
    var currentPage = currentStart / pageSize;
    var pageLinks = searchHelper.formatPageLinks(res.viewData.productSearch.pagesLinks, currentPage);
    var searchTerm = req.querystring.q;
    var maxPageSize = req.querystring.maxsize || defaultPageSize;

    if (empty(req.querystring.cgid) && !empty(searchTerm)) {
        var suggestions = new SuggestModel();
        suggestions.setSearchPhrase(searchTerm);
        suggestions.setMaxSuggestions(3);

        viewData.canonicalLink = "";
        viewData.preventCanonical = true;
    } else if (!empty(req.querystring.cgid)) {
        viewData.canonicalLink = URLUtils.https("Search-Show", "cgid", req.querystring.cgid).toString().split("?")[0];
    }

    var isLastPage = res.viewData.productSearch.count - pageSize * currentPage < pageSize;
    var updateGridURL = res.getViewData().productSearch.productSearch.url("Search-UpdateGrid").toString();
    var lazyLoadObj = searchHelper.getLazyLoadObj(updateGridURL, currentStart, pageSize, maxPageSize, preferences.lazyStep, isLastPage);

    viewData.breadcrumbs = breadcrumbs;
    viewData.pageLinks   = pageLinks;
    viewData.maxPageSize = maxPageSize;
    viewData.lazyLoadURL = lazyLoadObj.url;
    viewData.showPagination = lazyLoadObj.showPagination;

    viewData.searchOptions = searchHelper.getSearchOptionsArray(preferences.numberOfOptions, defaultPageSize);

    res.setViewData(viewData);
    return next();
});

server.append("Refinebar", function (req, res, next) {
    var ps = res.getViewData().productSearch.productSearch;
    var subCategories;

    subCategories = ps.isCategorySearch() && ps.category.hasOnlineSubCategories()
        ? ps.category.onlineSubCategories
        : null;

    res.setViewData({
        subCategories: subCategories
    });
    next();
});

server.replace("ShowAjax", cache.applyShortPromotionSensitiveCache, consentTracking.consent, function (req, res, next) {
    var result = searchHelper.searchAjax(req, res);
    var pageSize = req.querystring.sz || defaultPageSize;
    var currentStart = req.querystring.start || 0;
    var currentPage = currentStart / pageSize;
    var maxPageSize = req.querystring.maxsize || defaultPageSize;

    var viewData = res.getViewData();
    viewData.productSearch = result.productSearch;
    res.setViewData(viewData);

    var pageLinks = res.viewData.productSearch ? searchHelper.formatPageLinks(res.viewData.productSearch.pagesLinks, currentPage) : null;
    var isLastPage = res.viewData.productSearch.count - pageSize * currentPage < pageSize;
    var updateGridURL = res.getViewData().productSearch.productSearch.url("Search-UpdateGrid").toString();
    var lazyLoadObj = searchHelper.getLazyLoadObj(updateGridURL, currentStart, pageSize, maxPageSize, preferences.lazyStep, isLastPage);

    res.render("search/searchResultsNoDecorator", {
        productSearch: result.productSearch,
        maxSlots: result.maxSlots,
        reportingURLs: result.reportingURLs,
        refineurl: result.refineurl,
        pageLinks: pageLinks,
        maxPageSize : maxPageSize,
        lazyLoadURL : lazyLoadObj.url,
        showPagination : lazyLoadObj.showPagination
    });

    return next();
}, pageMetaData.computedPageMetaData);

server.append("UpdateGrid", function (req, res, next) {
    var pageSize = req.querystring.sz || defaultPageSize;
    var currentStart = req.querystring.start || 0;
    var currentPage = currentStart / pageSize;
    var pageLinks = searchHelper.formatPageLinks(res.viewData.productSearch.pagesLinks, currentPage);
    var maxPageSize = req.querystring.maxsize || defaultPageSize;
    var updateGridURL = res.getViewData().productSearch.productSearch.url("Search-UpdateGrid").toString();
    var isLastPage = res.viewData.productSearch.count - pageSize * currentPage < pageSize;
    var lazyLoadObj = searchHelper.getLazyLoadObj(updateGridURL, currentStart, pageSize, maxPageSize, preferences.lazyStep, isLastPage);

    res.setViewData({
        pageLinks: pageLinks,
        maxPageSize: maxPageSize,
        lazyLoadURL: lazyLoadObj.url,
        showPagination: lazyLoadObj.showPagination,
        urlParams: {
            pageSize : pageSize,
            currentStart: currentStart
        }
    });
    next();
});

/**
 * Render the folder content
 */
server.get("ShowContent", function (req, res, next) {
    var ContentMgr = require("dw/content/ContentMgr");
    var folderId = request.httpParameterMap.fdid.stringValue;
    var folder = ContentMgr.getFolder(folderId);
    var viewData = res.getViewData();
    var pageSize = req.querystring.sz || defaultContentPageSize;
    var currentStart = req.querystring.start || 0;
    var currentPage = currentStart / pageSize;
    var content;
    var contentPageLinks;

    req.pageMetaData.setTitle(folder.pageTitle);

    if (folder && !empty(folder.template)) {
        viewData.breadcrumbs = [{
            htmlValue: Resource.msg("global.home", "common", null),
            url: URLUtils.home().toString()
        }];

        var currentFolder = folder;
        while (currentFolder.parent != null) {
            if (currentFolder.parent.root == false) {
                viewData.breadcrumbs.splice(1, 0, {
                    htmlValue: currentFolder.parent.getDisplayName(),
                    url: URLUtils.url("Search-ShowContent", "fdid", currentFolder.parent.ID)
                });
            }
            currentFolder = currentFolder.parent;
        }

        viewData.canonicalLink = URLUtils.https("Search-ShowContent", "fdid", folder.ID).toString().split("?")[0];

        viewData.breadcrumbs.push({
            htmlValue: !empty(folder.getDisplayName()) ? folder.getDisplayName() : "",
            url: "#"
        });

        content = folder.getOnlineContent().length > pageSize
            ? searchHelper.formatContent(folder.getOnlineContent(), currentStart, pageSize)
            : folder.getOnlineContent();

        contentPageLinks = folder.getOnlineContent().length > pageSize
            ? searchHelper.getContentPageLinks(folder, currentStart, pageSize)
            : null;

        res.setViewData({
            folder: folder,
            folderTitle: !empty(folder.pageTitle) ? folder.pageTitle : "",
            folderDescription: !empty(folder.pageDescription) ? folder.pageDescription : "",
            folderBodyTitle: !empty(folder.custom.bodyTitle) ? folder.custom.bodyTitle : "",
            folderImageLarge: !empty(folder.custom.imageLarge) ? folder.custom.imageLarge.getURL() : null,
            folderImageSmall: !empty(folder.custom.imageSmall) ? folder.custom.imageSmall.getURL() : null,
            folderImageAlt: !empty(folder.custom.imageAlt) ? folder.custom.imageAlt : "",
            folderContent: content,
            pageLinks: contentPageLinks ? searchHelper.formatPageLinks(contentPageLinks, currentPage) : null,
            folderHTML: !empty(folder.custom.htmlContent) ? folder.custom.htmlContent : "",
            folderIcon: !empty(folder.custom.imageClubLogo) ? folder.custom.imageClubLogo.getURL() : null
        });

        res.render(folder.template);
    } else {
        res.setStatusCode(404);
        res.render("error/notFound");
    }
    next();
});

module.exports = server.exports();
