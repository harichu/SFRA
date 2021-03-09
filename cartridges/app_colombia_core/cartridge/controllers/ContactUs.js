"use strict";

var server = require("server");
var base = module.superModule;

var Resource = require("dw/web/Resource");

server.extend(base);

server.append("Landing", function (req, res, next) {
    var viewData = res.getViewData();
    viewData.breadcrumbs[1].htmlValue = Resource.msg("page.title.feedback", "contactUs", null);
    res.setViewData(viewData);
    next();
});

module.exports = server.exports();
