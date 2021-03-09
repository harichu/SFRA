"use strict";

var processInclude = require("jsfarmacias/util");

$(document).ready(function () {
    processInclude(require("jsfarmacias/product/detail"));
    processInclude(require("./product/pdpInstoreInventory"));
    processInclude(require("jsfarmacias/product/productCarousels"));
});
