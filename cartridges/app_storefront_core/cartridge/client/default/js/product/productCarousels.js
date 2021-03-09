"use strict";

module.exports = {
    initializeCarousels: function () {
        $(".carousel-inner").slick({
            asNavFor: ".carousel-nav",
            fade: true,
            arrows: false,
            accessibility: true,
            dots: false,
            centerMode: true,
            centerPadding: "0"
        });

        $(".carousel-nav").slick({
            slidesToShow: 6,
            asNavFor: ".carousel-inner",
            variableWidth: true,
            focusOnSelect: true,
            mobileFirst: true,
            arrows: false,
            dots: false,
            infinite: false,
            swipe: false,
        });

        $(".recommendation-slider").slick({
            slidesToShow: 4.5,
            infinite: false,
            adaptiveHeight: true,

        });
    },
    initializeZoom: function () {
        if ($(".js-zoom").length && $(window).width() > 991) {
            $(".js-zoom").zoom();
        }
    }
};
