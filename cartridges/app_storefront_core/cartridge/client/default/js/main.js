"use strict";

window.jQuery = window.$ = require("jquery");
var processInclude = require("./util");

$(document).ready(function () {
    processInclude(require("./components/menu"));
    processInclude(require("./components/cookie"));
    processInclude(require("./components/consentTracking"));
    processInclude(require("./components/footer"));
    processInclude(require("./components/miniCart"));
    processInclude(require("./components/collapsibleItem"));
    processInclude(require("./components/search"));
    processInclude(require("./components/clientSideValidation"));
    processInclude(require("./components/countrySelector"));
    processInclude(require("./components/toolTip"));
    processInclude(require("./components/carousel"));
    processInclude(require("./components/datepicker"));
    processInclude(require("./components/zoneSelector"));
});

require("./thirdParty/bootstrap");
require("./components/spinner");
require("slick-carousel/slick/slick.js");
require("@chenfengyuan/datepicker/dist/datepicker.js");
require("jquery-zoom/jquery.zoom.js");
require("jquery-mask-plugin/src/jquery.mask.js");
