"use strict";

module.exports = function () {
    $(".slick-slider").slick();

    document.addEventListener("init.slick", function (event) {
        if (event.detail) {
            $(event.detail.selector).slick();
        } else if (event.target) {
            $(event.target).slick();
        }
    });

    $(".category-slider").slick({
        customPaging: function (slider, i) {
            var count = i + 1;
            return "<button class='tab'> TAB "+ count +"</button>";
        },
    });
};

