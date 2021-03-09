"use strict";

var scrollAnimate = require("../components/scrollAnimate");
var debounce = require("lodash/debounce");
var gridRequestPending = false;

/**
 * Update DOM elements with Ajax results
 *
 * @param {Object} $results jQuery DOM element
 * @param {string} selector DOM element to look up in the $results
 */
function updateDom($results, selector) {
    var $updates = $results.find(selector);
    $(selector).empty().html($updates.html());
}

/**
 * Checks if element is in viewport
 */
$.fn.isInViewport = function () {
    var elementTop = $(this).offset().top;
    var elementBottom = elementTop + $(this).outerHeight();

    var viewportTop = $(window).scrollTop();
    var viewportBottom = viewportTop + $(window).height() + $(".site-header-container").outerHeight() + $(".product-wrapper").last().outerHeight();

    return elementBottom  > viewportTop && elementTop < viewportBottom;
};

/**
 * Hides the number of results select option if value is larger than the remaining number of tiles
 * Adds a disabled class on the select if no viable options remain
 * @param {Number} remainingTiles - the number used to compare the option value to
 */
function handleSelectOptionVisibility(remainingTiles) {
    var $resultsNumberSelect = $(".js-pagination-number-select");

    $resultsNumberSelect.find(".option").each(function () {
        var isViableOption = $(this).data("value") > remainingTiles;

        $(this).toggleClass("d-none", !!isViableOption);
    });

    var selectHasOptions = $resultsNumberSelect.find(".option:not(.d-none)").length > 0;

    $resultsNumberSelect.toggleClass("disabled", !selectHasOptions);
}

/**
 * Adjusts the URL to be used in the AJAX call with the new size and start values
 *
 */
function handleLazyLoad() {
    if ($(".js-loadmore-trigger:not(.disabled)").length && !gridRequestPending) {
        if ($(".js-loadmore-trigger").isInViewport()) {
            var $loadMoreTrigger = $(".js-loadmore-trigger");
            var thisUrl = $loadMoreTrigger.attr("data-url");
            var actualPageUrl = window.location.href;
            var srule = getQueryStringValue(actualPageUrl, "srule");

            var urlParams = new URLSearchParams(thisUrl);
            urlParams.delete("srule");

            // Set the requets pending to true to prevent multiple requests
            gridRequestPending = true;

            // Trigger the spinner animation
            $loadMoreTrigger.spinner().start();

            // Call function which will make AJAX call to update the grid
            updateCategoryGrid(decodeURIComponent(urlParams.toString()), srule, $loadMoreTrigger);
        }
    }
}

/**
 * Function that makes AJAX call to update the catgeory grid ugind a series of parameters
 * @param {String} thisUrl - URL that will be used to add the new grid information
 * @param {String} srule - sortin rule
 * @param {Object} $loadMoreTrigger - load more button object
 */
function updateCategoryGrid(thisUrl, srule, $loadMoreTrigger) {
    $.ajax({
        url: thisUrl,
        data: { selectedUrl: thisUrl, srule: srule },
        method: "GET",
        success: function (response) {
            //If the request went successfully, then change the url and update the grid
            var pageLinkUrl = thisUrl;
            var sz = getQueryStringValue(pageLinkUrl, "sz");
            var start = getQueryStringValue(pageLinkUrl, "start");
            var maxsize = getQueryStringValue(pageLinkUrl, "maxsize");
            var newPageUrl = window.location.href;

            if (sz && start) {
                newPageUrl = insertParam(newPageUrl, "start", start);
                newPageUrl = insertParam(newPageUrl, "sz", sz);
                window.history.pushState(null, null, newPageUrl);
            }

            if (maxsize) {
                newPageUrl = insertParam(newPageUrl, "maxsize", maxsize);
                window.history.pushState(null, null, newPageUrl);
            }

            // Update the product grid and sort options with the response
            $(".products-grid").html(response);
            updateSortOptions(response);

            // Remove the spinner animation
            if ($loadMoreTrigger != null) {
                $loadMoreTrigger.spinner().stop();
            } else {
                $.spinner().stop();
                scrollAnimate();
            }

            // Set the requets pending to false to enable the lazyload functionality
            gridRequestPending = false;
        },
        error: function () {
            if ($loadMoreTrigger != null) {
                $loadMoreTrigger.spinner().stop();
            } else {
                $.spinner().stop();
            }
        }
    });
}

/**
 * Keep refinement panes expanded/collapsed after Ajax refresh
 *
 * @param {Object} $results jQuery DOM element
 */
function handleRefinements($results) {
    $(".refinement.active").each(function () {
        $(this).removeClass("active");

        var activeDiv = $results.find("." + $(this)[0].className.replace(/ /g, "."));
        activeDiv.addClass("active");
        activeDiv.find("button.title").attr("aria-expanded", "true");
    });

    $(".content-trigger.expanded").each(function () {
        $(this).removeClass("expanded");

        var activeTrigger = $results.find("." + $(this)[0].className.replace(/ /g, "."));
        activeTrigger.addClass("expanded");
    });

    updateDom($results, ".refinements");
}

/**
 * Parse Ajax results and updated select DOM elements
 *
 * @param {string} response Ajax response HTML code
 */
function parseResults(response) {
    var $results = $(response);
    var specialHandlers = {
        ".refinements": handleRefinements
    };

    // Update DOM elements that do not require special handling
    [
        ".grid-header",
        ".header.page-title",
        ".products-grid",
        ".show-more",
        ".filter-bar",
        ".pagination-top"
    ].forEach(function (selector) {
        updateDom($results, selector);
    });

    Object.keys(specialHandlers).forEach(function (selector) {
        specialHandlers[selector]($results);
    });
}

/**
 * This function retrieves another page of content to display in the content search grid
 * @param {JQuery} $element the jquery element that has the click event attached
 * @param {JQuery} $target the jquery element that will receive the response
 */
function getContent($element, $target) {
    var showMoreUrl = $element.data("url");
    $.spinner().start();
    $.ajax({
        url: showMoreUrl,
        method: "GET",
        success: function (response) {
            $target.append(response);
            $.spinner().stop();
        },
        error: function () {
            $.spinner().stop();
        }
    });
}

/**
 * This function removes a parameter from the query string of the given URL
 * @param {string} url - The url which contains the query string that will have the param removed
 * @param {string} parameter - The name of the parameter that has to be removed
 */
function removeURLParameter(url, parameter) {
    var urlParts = url.split("?");

    if (urlParts.length>=2) {
        var prefix = encodeURIComponent(parameter) + "=";
        var pars = urlParts[1].split(/[&;]/g);

        for (var i = pars.length; i-- > 0;) {
            if (pars[i].lastIndexOf(prefix, 0) !== -1) {
                pars.splice(i, 1);
            }
        }

        url = urlParts[0] + (pars.length > 0 ? "?" + pars.join("&") : "");
        return url;
    } else {
        return url;
    }
}

/**
 * This function gets an a key and a value and adds it to the given url query string
 * @param {string} url - The base url used for adding the parameter in the query string
 * @param {string} key - The key of the param that will be added to the url
 * @param {string} value - The value of the param that will be added to the url
 */

function insertParam(url, key, value) {
    url = removeURLParameter(url, key);

    var queryStart;

    if (url.indexOf("?") !== -1) {
        queryStart = "&";
    } else {
        queryStart = "?";
    }

    return url + queryStart + key + "=" + value;
}

/**
 * This functions gets an url and a key to return the value of the param, if exists, of the query string
 * @param {string} url - The base url used for searching the query string
 * @param {string} key - Which key should be searched in the query string
 */
function getQueryStringValue(url, key) {
    return decodeURIComponent(url.replace(new RegExp("^(?:.*[&\\?]" + encodeURIComponent(key).replace(/[.+*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
}

/**
 * This function gets the query string used for refinement and adds its parameters to the current url
 * @param {string} url - The url used for refinement
 */

function updateUrl(url) {
    var pageLinkUrl = window.location.origin + url;
    var prefs = {};
    var pageUrl = window.location.href;
    var optionsUrl;

    for (var i = 1; i <= 10; i++) {
        if (getQueryStringValue(pageLinkUrl, "prefn" + i)) {
            prefs["prefn" + i] = getQueryStringValue(pageLinkUrl, "prefn" + i);
            prefs["prefv" + i] = getQueryStringValue(pageLinkUrl, "prefv" + i);
        } else {
            prefs["prefn" + i] = "";
            prefs["prefv" + i] = "";
        }
    }

    if (getQueryStringValue(pageLinkUrl, "pmin")) {
        prefs.pmin = getQueryStringValue(pageLinkUrl, "pmin");
    } else {
        prefs.pmin = "";
    }

    if (getQueryStringValue(pageLinkUrl, "pmax")) {
        prefs.pmax = getQueryStringValue(pageLinkUrl, "pmax");
    } else {
        prefs.pmax = "";
    }

    if (Object.keys(prefs).length) {
        $(".category-sort-order option").each(function () {
            optionsUrl = $(this).val();
            Object.keys(prefs).forEach(function (item) {
                if (prefs[item]) {
                    optionsUrl = insertParam(optionsUrl, item, prefs[item]);
                } else {
                    optionsUrl = removeURLParameter(optionsUrl, item);
                }
            });
            $(this).val(optionsUrl);
        });

        $(".select-order ul .js-sort-option").each(function () {
            optionsUrl = $(this).attr("rel");
            Object.keys(prefs).forEach(function (item) {
                if (prefs[item]) {
                    optionsUrl = insertParam(optionsUrl, item, prefs[item]);
                } else {
                    optionsUrl = removeURLParameter(optionsUrl, item);
                }
            });
            $(this).attr("rel", optionsUrl);
        });


        var searchResultsURL = $(".js-pagination-data").attr("data-default-url");
        Object.keys(prefs).forEach(function (item) {
            if (prefs[item]) {
                searchResultsURL = insertParam(searchResultsURL, item, prefs[item]);
            } else {
                searchResultsURL = removeURLParameter(searchResultsURL, item);
            }
        });
        $(".js-pagination-data").attr("data-default-url", searchResultsURL);
    }

    Object.keys(prefs).forEach(function (item) {
        if (prefs[item]) {
            pageUrl = insertParam(pageUrl, item, prefs[item]);
        } else {
            pageUrl = removeURLParameter(pageUrl, item);
        }

    });

    window.history.pushState(null, null, pageUrl);
}

/**
 * Update sort option URLs from Ajax response
 *
 * @param {string} response Ajax response HTML code
 */
function updateSortOptions(response) {
    var $tempDom = $("<div>").append($(response));
    var sortOptions = $tempDom.find(".grid-footer").data("sort-options").options;
    sortOptions.forEach(function (option) {
        $("option." + option.id).val(option.url);
    });
}

module.exports = {
    filter: function () {
        // Display refinements bar when Menu icon clicked
        $(".container").on("click", "div.filter-results", function () {
            $(".refinement-bar, .apply-filters").show();
            $(".refinement-bar").siblings().attr("aria-hidden", true);
            $(".refinement-bar").closest(".row").siblings().attr("aria-hidden", true);
            $(".refinement-bar").closest(".tab-pane.active").siblings().attr("aria-hidden", true);
            $(".refinement-bar").closest(".container.search-results").siblings().attr("aria-hidden", true);
        });
    },

    toggleTileView: function () {
        $(document).on("click", ".display-products", function () {
            $(this).parents().find(".search-results").toggleClass("list-view");
            $(this).toggleClass("button-list-view");
        });
    },

    closeRefinements: function () {
        // Refinements close button
        $(".container").on("click", ".refinement-bar button.close, .apply-filters", function () {
            $("#filters").modal("hide");
        });

        $("#filters").on("hidden.bs.modal", function () {
            $(".refinement-bar, .apply-filters").hide();
        });
    },

    resize: function () {
        // Close refinement bar and hide modal background if user resizes browser
        var $isMobile = window.innerWidth < 993;
        $(window).resize(function () {
            var $changed = $isMobile != window.innerWidth < 993;
            if ($changed) {
                $("body > .modal-backdrop").remove();
                $(".refinement-bar, .modal-background").hide();
                $(".refinement-bar").siblings().attr("aria-hidden", false);
                $(".refinement-bar").closest(".row").siblings().attr("aria-hidden", false);
                $(".refinement-bar").closest(".tab-pane.active").siblings().attr("aria-hidden", false);
                $(".refinement-bar").closest(".container.search-results").siblings().attr("aria-hidden", false);
            }
        });
    },

    sort: function () {
        // Handle sort order menu selection
        $(".container").on("change", "[name=sort-order]", function (e) {
            e.preventDefault();

            $.spinner().start();
            $(this).trigger("search:sort", this.value);
            $.ajax({
                url: this.value,
                data: { selectedUrl: this.value },
                method: "GET",
                success: function (response) {
                    $(".products-grid").empty().html(response);
                    $.spinner().stop();
                },
                error: function () {
                    $.spinner().stop();
                }
            });
        });

        // Create a custom Sort By select for each breakpoint
        $(".category-sort-order").each(function () {
            // Save the number of original options
            var numberOfOptions = $(this).children("option").length;

            $(this).addClass("select-hidden");
            $(this).wrap("<div class='select-order cursor-pointer w-100'></div>");

            var $styledSelect, $list;

            // Mount different structures for each breakpoint
            if ($(".select-order").parent("div.modal-body").length === 0) {
                $(this).after("<div class='styled-select select-lg d-flex align-items-center position-absolute'></div>");
                $styledSelect = $(this).next("div.styled-select");
                $styledSelect.text($(this).children("option").eq(0).text());
                $list = $("<ul />", {
                    "class": "select-options select-options-lg position-absolute select-index"
                }).insertAfter($styledSelect);
            } else {
                $(this).after("<div class='styled-select select-sm d-none position-absolute'></div>");
                $styledSelect = $(this).next("div.styled-select");
                $styledSelect.text($(this).children("option").eq(0).text());
                $list = $("<ul />", {
                    "class": "select-options select-options-sm"
                }).insertAfter($styledSelect);
            }

            // Create the custom options according to the original select and append to ul
            for (var i = 0; i < numberOfOptions; i++) {
                var $option = $(this).children("option").eq(i);
                $("<li />", {
                    "class"    : "option p-2 text-capitalize js-sort-option",
                    "data-gtm" : JSON.stringify($option.data("gtm")),
                    text       : $option.text(),
                    rel        : $option.val(),
                    id         : $option.data("id")
                }).appendTo($list);
            }

            var $listItems = $list.children("li");

            // Handle the click on ul for large breakpoints
            $styledSelect.click(function (e) {
                e.stopPropagation();
                $(this).toggleClass("active").next("ul.select-options").toggle();
            });

            // Handle the click on li and sort the products on grid
            $listItems.click(function (e) {
                e.stopPropagation();
                $(this).val($(this).attr("rel"));
                $styledSelect.text($(this).text()).removeClass("active");
                $("#sortOrder").modal("hide");
                $(".select-options-lg").hide();
                var url = $(this).attr("rel");

                var maxSize = $(".js-pagination-number-select").attr("data-select-size");

                var urlParams = new URLSearchParams(url);

                if (maxSize) {
                    urlParams.set("maxsize", Number(maxSize).toFixed());
                }

                url = decodeURIComponent(urlParams.toString());

                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push($(this).data("gtm"));

                // Set the requets pending to true to prevent multiple requests
                gridRequestPending = true;

                $.spinner().start();

                $.ajax({
                    url: url,
                    data: { selectedUrl: url },
                    method: "GET",
                    success: function (response) {
                        var thisUrl = url;
                        var pageLinkUrl = window.location.href;
                        var srule = getQueryStringValue(thisUrl, "srule");
                        var maxSizeParam = getQueryStringValue(thisUrl, "maxsize");

                        if (srule) {
                            pageLinkUrl = insertParam(pageLinkUrl, "srule", srule);
                            window.history.pushState(null, null, pageLinkUrl);
                        }

                        // Set the requets pending to false to enable the lazyload functionality
                        gridRequestPending = false;

                        $(".products-grid").empty().html(response);

                        if (!maxSizeParam) {
                            $(".js-loadmore-trigger").addClass("disabled");
                        }

                        $.spinner().stop();
                    },
                    error: function () {
                        $.spinner().stop();
                    }
                });
            });

            // Hide the options list
            $(document).click(function () {
                $styledSelect.removeClass("active");
                $(".select-options-lg").hide();
            });

            //var selectedOption = $(".category-sort-order option:selected")[0].dataset.id;
            //$(".select-options li#" + selectedOption).click();
        });
    },

    /**
     * Handle the expand of the custom search results number selector
     */
    handleSearchResultsNumberSelect: function () {
        $(".js-pagination-number-select").click(function (e) {
            e.stopPropagation();
            $(this).find(".styled-select").toggleClass("active").next("ul.select-options").toggle();
        });
    },

    /**
     * Handle the option change for the custom search results number selector
     */
    handlePageSizeChange: function () {
        $(".js-pagination-number-option").click(function (e) {
            e.preventDefault();

            var $select = $(this).parents(".js-pagination-number-select");
            var newValue = $(this).data("value");

            // Update the select value with the new value of the selected option
            $select.find(".styled-select").html($(this).html());
            $select.attr("data-select-size", newValue);

            // Add a distinctive class to the selected option
            $select.find(".option").removeClass("active");
            $(this).addClass("active");

            var $paginationData = $(".js-pagination-data");

            // Move to first page if user is of a different page
            var thisUrl = $paginationData.attr("data-default-url");
            var actualPageUrl = window.location.href;
            var srule = getQueryStringValue(actualPageUrl, "srule");

            var urlParams = new URLSearchParams(thisUrl);

            urlParams.set("maxsize", Number(newValue).toFixed());
            urlParams.delete("srule");

            $.spinner().start();

            // Call function which will make AJAX call to update the grid
            updateCategoryGrid(decodeURIComponent(urlParams.toString()), srule);
        });

        // Set the scroll.lazyLoaderScroll event to be triggered when reaching the bottom of the page
        $(window).on("scroll.lazyLoaderScroll", debounce(handleLazyLoad, 200));
    },

    showMore: function () {
        // Show more products
        $(".container").on("click", ".btn-page", function (e) {
            e.stopPropagation();
            var thisUrl = $(this).data("url");
            thisUrl = removeURLParameter(thisUrl, "srule");
            var maxSize = $(".js-pagination-number-select").attr("data-select-size");
            var actualPageUrl = window.location.href;
            var srule = getQueryStringValue(actualPageUrl, "srule");

            var urlParams = new URLSearchParams(thisUrl);

            urlParams.set("maxsize", Number(maxSize).toFixed());
            urlParams.delete("srule");

            e.preventDefault();

            $.spinner().start();
            $(this).trigger("search:page", e);

            // Set the requets pending to true to prevent multiple requests
            gridRequestPending = true;

            updateCategoryGrid(decodeURIComponent(urlParams.toString()), srule);
        });
    },

    applyFilter: function () {
        // Handle refinement value selection and reset click
        $(".container").on(
            "click",
            ".refinements li button, .refinement-bar button.reset, .filter-value button, .swatch-filter button",
            function (e) {
                e.preventDefault();
                e.stopPropagation();
                var url = $(this).data("href");
                var maxSize = $(".js-pagination-number-select").attr("data-select-size");
                url = removeURLParameter(url, "srule");

                var pageLinkUrl = window.location.href;
                var srule = getQueryStringValue(pageLinkUrl, "srule");

                var urlParams = new URLSearchParams(url);

                urlParams.set("maxsize", Number(maxSize).toFixed());
                urlParams.delete("srule");

                url = decodeURIComponent(urlParams.toString());

                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push($(this).data("gtm"));

                $.spinner().start();
                $(this).trigger("search:filter", e);
                $.ajax({
                    url: url,
                    data: {
                        page: $(".grid-footer").data("page-number"),
                        selectedUrl: $(this).data("href"),
                        srule: srule
                    },
                    method: "GET",
                    success: function (response) {
                        parseResults(response);
                        $.spinner().stop();
                        // Run slick() for recommendations carousel
                        $(".slick-slider").not(".slick-initialized").slick();

                        var remainingTiles = $(".js-pagination-data").data("count");

                        handleSelectOptionVisibility(remainingTiles);

                        // Only enable apply filters button on mobile if the user checked one option at least
                        if ($(".refinement-checked").length > 0) {
                            $(".apply-filters").prop("disabled", false);
                        } else {
                            $(".apply-filters").prop("disabled", true);
                        }
                        updateUrl(url);
                    },
                    error: function () {
                        $.spinner().stop();
                    }
                });
            });
    },

    showContentTab: function () {
        // Display content results from the search
        $(".container").on("click", ".content-search", function () {
            if ($("#content-search-results").html() === "") {
                getContent($(this), $("#content-search-results"));
            }
        });

        // Display the next page of content results from the search
        $(".container").on("click", ".show-more-content button", function () {
            getContent($(this), $("#content-search-results"));
            $(".show-more-content").remove();
        });
    },

    toggleMobileFilters: function () {
        $(document).on("click", ".refinement-dialog .content-trigger", function () {
            if ($(window).width() > 991) {
                $(this).toggleClass("expanded-large");
            } else {
                $(this).toggleClass("expanded");
            }
        });
    }
};
