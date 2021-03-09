"use strict";

var base = module.superModule;

base.custom       = require("*/cartridge/models/product/decorators/custom");
base.prescription = require("*/cartridge/models/productLineItem/decorators/prescription");

module.exports = base;
