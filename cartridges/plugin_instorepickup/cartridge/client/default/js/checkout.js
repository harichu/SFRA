"use strict";

var processInclude = require("jsfarmacias/util");

$(document).ready(function () {
    processInclude(require("./checkout/checkout"));
    processInclude(require("./checkout/instore"));
    processInclude(require("jsMP/checkout/mercadoPago"));
});
