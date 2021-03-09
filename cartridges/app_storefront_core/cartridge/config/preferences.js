"use strict";

var defaultPageSize = 12;
var numberOfOptions;
var lazyStep;
var pageSizePrefJSON = require("dw/system/Site").current.getCustomPreferenceValue("difarmaSearchGridOptions");

if (!empty(pageSizePrefJSON) && JSON.parse(pageSizePrefJSON).default) {
    defaultPageSize = JSON.parse(pageSizePrefJSON).default;
}

// eslint-disable-next-line
if (!empty(pageSizePrefJSON) && JSON.parse(pageSizePrefJSON).numberOfOptions) {
    numberOfOptions = JSON.parse(pageSizePrefJSON).numberOfOptions;
}

if (!empty(pageSizePrefJSON) && JSON.parse(pageSizePrefJSON).lazyStep) {
    lazyStep = JSON.parse(pageSizePrefJSON).lazyStep;
}

module.exports = {
    maxOrderQty: 10,
    defaultPageSize: defaultPageSize,
    numberOfOptions: numberOfOptions,
    lazyStep: lazyStep
};
