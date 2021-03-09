"use strict";

var server = require("server");
var base = module.superModule;
var Resource = require("dw/web/Resource");
var URLUtils = require("dw/web/URLUtils");

server.extend(base);

/**
 * Extending Page controller to add breadcrumbs
 */
server.append("Show", function (req, res, next) {
    var ContentMgr = require("dw/content/ContentMgr");
    var viewData = res.getViewData();

    if (!empty(viewData.content)) {
        viewData.canonicalLink = URLUtils.https("Page-Show", "cid", viewData.content.ID).toString().split("?")[0];
        viewData.breadcrumbs = [
            {
                htmlValue: Resource.msg("global.home", "common", null),
                url: URLUtils.home().toString()
            }
        ];

        var parentFolder = ContentMgr.getContent(viewData.content.ID).getClassificationFolder();
        if (parentFolder && parentFolder.custom.hasTreeFolderStructure) {
            viewData.breadcrumbs.push({
                htmlValue: !empty(parentFolder.getDisplayName()) ? parentFolder.getDisplayName() : "",
                url: URLUtils.url("Search-ShowContent", "fdid", parentFolder.ID)
            });
        }

        viewData.breadcrumbs.push({
            htmlValue: viewData.content.name,
            url: "#"
        });

        res.setViewData(viewData);
    }

    next();
});

module.exports = server.exports();
