"use strict";

var URLUtils   = require("dw/web/URLUtils");
var Resource   = require("dw/web/Resource");
var ContentMgr = require("dw/content/ContentMgr");
var server     = require("server");

server.get("Show", function (req, res, next) {
    var folder           = ContentMgr.getFolder("blog");
    var contentAssetList = folder.getOnlineContent();
    var breadcrumbs = [{
        htmlValue : Resource.msg("global.home", "common", null),
        url       : URLUtils.home().toString()
    }, {
        htmlValue : folder.displayName,
        url       : ""
    }];

    res.render("blog/landing", {
        content          : folder,
        breadcrumbs      : breadcrumbs,
        contentAssetList : contentAssetList
    });

    next();
});

server.get("ShowArticle", function (req, res, next) {
    var articleID = req.querystring.cid;    

    if (empty(articleID)) {
        res.redirect(URLUtils.url("Blog-Show"));
        next();
        return;
    }

    var article = ContentMgr.getContent(articleID);

    if (empty(article)) {
        res.redirect(URLUtils.url("Blog-Show"));
        next();
        return;
    }

    var blogTitle = article.folders.length > 0 ?
        article.folders[0].parent.displayName :
        "";

    var suggestedArticles = article.folders.length > 0 ?
        article
            .folders[0]
            .onlineContent
            .toArray()
            .filter(function (contentAsset) {
                return contentAsset.ID !== articleID;
            }) :
        [];

    var breadcrumbs = [{
        htmlValue : Resource.msg("global.home", "common", null),
        url       : URLUtils.home().toString()
    }, {
        htmlValue : blogTitle,
        url       : URLUtils.url("Blog-Show")
    }, {
        htmlValue : article.name,
        url       : ""
    }];

    res.render("blog/article", {
        breadcrumbs       : breadcrumbs,
        article           : article,
        suggestedArticles : suggestedArticles
    });

    next();
});

module.exports = server.exports();
