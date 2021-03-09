"use strict";

module.exports = {
    initializeCarousels: function () {
        $(".other-articles-slider").slick({
            dots: false,
            slidesToShow: 4.3,
            infinite: false,
            centerPadding: "15px",
            responsive: [
                {
                    breakpoint: 993,
                    settings: {
                        slidesToShow: 2.3
                    }
                },
                {
                    breakpoint: 540,
                    settings: {
                        slidesToShow: 1.3
                    }
                }
            ]
        });

        $(function () {
            $(".tile-date").each(function () {
                //keep only the 3 first letters of the month
                var sliced = $(this).text().replace(/^\s+/g, "").split(" ");
                sliced[0] = sliced[0].slice(0, 3);
                $(this).text(sliced.join(" "));
            });
        });
    }
};
