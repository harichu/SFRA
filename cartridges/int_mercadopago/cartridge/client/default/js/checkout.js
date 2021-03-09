"use strict";

var processInclude = require("jsfarmacias/util");

$(document).ready(function () {
    processInclude(require("./checkout/checkout"));
    processInclude(require("./checkout/mercadoPago"));
});
