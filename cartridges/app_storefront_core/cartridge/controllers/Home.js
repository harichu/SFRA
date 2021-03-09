"use strict";

var base = module.superModule;
var server = require("server");
var URLUtils = require("dw/web/URLUtils");
server.extend(base);

server.append("Show", function (req, res, next) {
    var viewData = res.getViewData();
    [viewData.canonicalLink] = URLUtils.home().toString().split(/home|homepage|[?]/);
    res.setViewData(viewData);

    next();
});

module.exports = server.exports();
