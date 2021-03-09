"use strict";

var scrollAnimate = require("./scrollAnimate");
var debounce = require("lodash/debounce");

/**
 * appends params to a url
 * @param {string} data - data returned from the server's ajax call
 * @param {Object} button - button that was clicked for email sign-up
 */
function displayMessage(data, button) {
    $.spinner().stop();
    var status;
    if (data.success) {
        status = "alert-success";
    } else {
        status = "alert-danger";
    }

    if ($(".email-signup-message").length === 0) {
        $("body").append(
            "<div class=\"email-signup-message\"></div>"
        );
    }
    $(".email-signup-message")
        .append("<div class=\"email-signup-alert text-center " + status + "\">" + data.msg + "</div>");

    setTimeout(function () {
        $(".email-signup-message").remove();
        button.removeAttr("disabled");
    }, 3000);
}

/**
 * AChecks if element is in viewport
 */
$.fn.isInViewport = function () {
    var elementTop = $(this).offset().top;
    var elementBottom = elementTop + $(this).outerHeight();

    var viewportTop = $(window).scrollTop();
    var viewportBottom = viewportTop + $(window).height();

    return elementBottom  > viewportTop && elementTop < viewportBottom;
};


/**
 * Handles the visibility and positioning of the back to top button
 */
function handleBackToTop() {
    var $bckToTopBtn = $(".back-to-top-btn");
    var $loadMoreBtn = $(".js-loadmore-trigger");
    var lazyloadDisabled = !$loadMoreBtn.length || $loadMoreBtn.hasClass("disabled");
    var $bodyHeight = $("body").height() - $(".footer").height();

    if ($(this).scrollTop() > $bodyHeight / 2 && lazyloadDisabled) {
        $bckToTopBtn.addClass("visible");
        if ($(".footer").isInViewport()) {
            var bottomOffset = $(".footer").height() + $bckToTopBtn.height() / 2;
            $bckToTopBtn.addClass("move-up-btn").css("bottom", bottomOffset);
        } else {
            $bckToTopBtn.removeClass("move-up-btn").css("bottom", 40);
        }
    } else {
        $bckToTopBtn.removeClass("visible");
    }
}

function validateEmail(email) {
    // eslint-disable-next-line
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}

function initNewsletterListeners() {
    var $body       = $("body");
    var $confirmBtn = $body.find(".newsletter-modal .confirm-btn");

    // Disable "confirm" button if no option is checked;
    $body.on("change", ".newsletter-options input", function () {
        var checkedOptionsQty = $body.find(".newsletter-options input:checkbox:checked").length;
        checkedOptionsQty == 0 ? $confirmBtn.attr("disabled", "true") : $confirmBtn.removeAttr("disabled");
    });

    $("#newsletter-email").on("keyup", function (e) {
        var $errorContainer = $body.find(".email-signup .error-container");
        if (!$errorContainer.hasClass("d-none") && e.keyCode != 13) {
            $errorContainer.addClass("d-none");
        }

        var email           = $("input[name=hpEmailSignUp]").val();
        if (email != "") {
            $(".subscribe-news").removeAttr("disabled");
        }
        else {
            $(".subscribe-news").attr("disabled", true);
        }
    });


    // E-mail signup form;
    $(".newsletter-form").on("submit", function (e) {
        e.preventDefault();
        var $errorContainer = $body.find(".email-signup .error-container");
        var email           = $("input[name=hpEmailSignUp]").val();

        if (validateEmail(email)) {
            $(".newsletter-modal").modal("show");
        } else {
            $errorContainer.text($errorContainer.data("invalid"));
            $errorContainer.removeClass("d-none");
        }
    });

    // Newsletter options modal form;
    $(".newsletter-options-form").on("submit", function (e) {
        var $form            = $(this);
        var url              = $form.attr("action");
        var email            = $("input[name=hpEmailSignUp]").val();
        var formattedOptions = $form
            .find(".newsletter-options input:checkbox:checked")
            .map(function () {
                return $(this).data("option");
            })
            .toArray()
            .join();

        e.preventDefault();
        $form.attr("disabled", true);

        $.ajax({
            url      : url,
            type     : "post",
            dataType : "json",
            data: {
                email   : email,
                options : formattedOptions
            },
            success: function (data) {
                $form.attr("disabled", false);
                $(".newsletter-modal").modal("hide");
                if (!data.success) {
                    var $errorContainer = $body.find(".email-signup .error-container");
                    $errorContainer.text(data.msg);
                    $errorContainer.removeClass("d-none");
                }
            }
        });
    });
}

/**
 * Clears the storelocator data when moving to a different page
 */
function clearStorelocatorData() {
    if (!$(document).find(".store-locator-container").length && window.localStorage.getItem("searchQueryText") != null) {
        window.localStorage.removeItem("searchQueryText");
    }
}


module.exports = function () {
    initNewsletterListeners();

    $(".back-to-top").click(function () {
        scrollAnimate();
    });

    $(window).on("scroll", debounce(handleBackToTop, 50));

    clearStorelocatorData();

    $(".subscribe-email").on("click", function (e) {
        e.preventDefault();
        var url = $(this).data("href");
        var button = $(this);
        var emailId = $("input[name=hpEmailSignUp]").val();
        $.spinner().start();
        $(this).attr("disabled", true);
        $.ajax({
            url: url,
            type: "post",
            dataType: "json",
            data: {
                emailId: emailId
            },
            success: function (data) {
                displayMessage(data, button);
            },
            error: function (err) {
                displayMessage(err, button);
            }
        });
    });
};
