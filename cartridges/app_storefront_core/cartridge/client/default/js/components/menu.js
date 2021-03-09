"use strict";

var keyboardAccessibility = require("./keyboardAccessibility");
var debounce = require("lodash/debounce");
var cookie = require("./cookie");

// Shows area related to other location and hides area related to drugstore next to geolocation
function showOtherLocationHideGeolocation() {
    var otherLocalizationRadio = $("#pickup-select-radio");
    if (otherLocalizationRadio.length) {
        otherLocalizationRadio.click();
        $("#pickup-geolocation-radio").attr("disabled", true).parents(".custom-control").addClass("disabled");
        $("#pickup-select-radio").parents(".pickup-in-store-block").attr("data-pickup-option", "select");
        $("#pickup-select-radio").parents(".selection-type-stores").find(".custom-radio").removeClass("active");
        $("#pickup-select-radio").parents(".custom-radio").addClass("active");
    }
    getZoneFromServer({}, $(".detect-zone").data("action"));
}

// Shows area related to drugstore next to geolocation
function showGeolocation() {
    $("#pickup-geolocation-radio").attr("disabled", false).parents(".custom-control").removeClass("disabled");
    var $geolocationRadio = $("#pickup-geolocation-radio");
    if ($geolocationRadio.length) {
        $geolocationRadio.click();
    }
}

function setMainStoreBasedOnZoneAlreadySaved() {
    var zoneID  = $("#zoneFinder").find(".city-select").val();
    var mainStoreSelected = $("#main-store-selected").val();

    if (mainStoreSelected !== zoneID) {
        var url = $(".set-active-zone-btn").data("url");
        $.ajax({
            url      : url,
            method   : "POST",
            dataType : "json",
            data     : {
                zone      : zoneID,
                cityName  : window.localStorage.cityName,
                stateName : window.localStorage.stateName
            },
            success  : function (data) {
                if (data.cityName) {
                    window.localStorage.stateName = data.stateName;
                    window.localStorage.cityName  = data.cityName;
                }
            }
        });
    }
}

/**
 * Makes a call to the backend to set the zone for the customer.
 * @param {Object} requestData An object containing the coordinates obtained from the browser.
 * @param {String} zoneUrl The URL to call.
 */
function getZoneFromServer(requestData, zoneUrl) {
    if (zoneUrl) {
        $.ajax({
            url: zoneUrl,
            type: "post",
            dataType: "json",
            data: requestData,
            success: function (data) {
                $.spinner().stop();

                if (data.cityName) {
                    window.localStorage.stateName = data.stateName;
                    window.localStorage.cityName  = data.cityName;

                    $(".state-select").val(window.localStorage.stateName);
                    $(".selected-zone-city").text(window.localStorage.cityName);
                    $(".state-select").trigger("change");

                    $(".active-zone").text(data.cityName);
                    $("#store-departamentos").val(data.stateName);
                    $("#store-departamentos").trigger("change");
                    var $cityOption = $("#store-municipios option").filter(function (i, e) {
                        return $(e).text().trim() == data.cityName;
                    });
                    $cityOption.attr("selected", "selected");
                }

                if (data.needReload) {
                    location.reload();
                }
            }, error : function () {
                $.spinner().stop();
            }
        });
    }
}

module.exports = function () {
    var isDesktop = function () {
        return $(".header-search-mobile").css("display") == "none";
    };

    $(document).ready(function () {
        if (!navigator.geolocation) {
            $.spinner().stop();
            return;
        }

        if (window.location.search.indexOf("delsrch") != -1) {
            $(document).find("#storelocatorInput").val("");
        }

        var isBrowserGeolocationEnabled = $("#is-browser-geolocation-enabled").val() === "true";
        var isFirstAccess               = $("#is-first-access").is(":checked");
        var hasZoneAlreadySet           = window.localStorage.cityName && window.localStorage.stateName;

        var $detectZone = $(".detect-zone");
        var zoneUrl = $detectZone.data("action");
        var requestData = {};

        if (hasZoneAlreadySet) {
            setMainStoreBasedOnZoneAlreadySaved();
        } else {
            if (isFirstAccess) {
                showGeolocation();
                if (isBrowserGeolocationEnabled) {
                    navigator.geolocation.getCurrentPosition(function (position) {
                        requestData.lat  = position.coords.latitude;
                        requestData.long = position.coords.longitude;
                        getZoneFromServer(requestData, zoneUrl);
                    }, showOtherLocationHideGeolocation);
                } else {
                    getZoneFromServer(requestData, zoneUrl);
                }
            } else {
                getZoneFromServer(requestData, zoneUrl);
            }
        }

        $("select[name=\"zone-selector\"]").on("change", function () {
            var $this       = $(this);
            var url         = $this.data("action");
            var dataRequest = {
                zone     : $this.val(),
                zoneName : $this.find("option:selected").text().trim()
            };

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push($this.find("option:selected").data("gtm"));

            $.ajax({
                url: url,
                type: "post",
                dataType: "json",
                data: dataRequest,
                success: function (data) {
                    $.spinner().stop();

                    if (data.cityName) {
                        window.localStorage.cityName = data.cityName;
                    }

                    if (data.needReload) {
                        if (data.url.length && data.farmaciasPage) {
                            $(document).find("#storelocatorInput").val("");
                            window.location.href = data.url;
                        } else {
                            location.reload();
                        }
                    }
                }, error() {
                    $.spinner().stop();
                }
            });
        });
    });
    $(".logout-btn").on("click", function () {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            event: "clickLogout"
        });

        window.location.href = $(this).data("url");
    });

    var headerBannerStatus = window.sessionStorage.getItem("hide_header_banner");
    $(".header-banner .close").on("click", function () {
        $(".header-banner").addClass("d-none");
        window.sessionStorage.setItem("hide_header_banner", "1");
    });

    if (!headerBannerStatus || headerBannerStatus < 0) {
        $(".header-banner").removeClass("d-none");
    }

    if (!isDesktop()) {
        //Resets mobile navigation when clicking on the back button
        $(".navigation-back-link").on("click", function () {
            resetMobileNavigation();
        });

        //Expands secondary navigation
        $(".dropdown-items").on("show.bs.collapse", function () {
            $(".nav-link").removeClass("d-flex").addClass("d-none");
            $(".navigation-back-link").removeClass("d-none").addClass("d-flex");
            $(".navbar-nav").addClass("expanded-subnavigation");
        });
    } else {
        var lastScrollTop = 0;
        var $header = $(".site-header-container");
        var headerBottom = $header.position().top + $header.outerHeight();

        //Adds or removes sticky header classes according to the direction of scroll
        $(window).on("scroll", debounce(handleStickyHeader, 50));
    }

    //Adds overflow class, to prevent page scroll while navigation is open
    $("#sg-navbar-collapse").on("show.bs.collapse", function () {
        $("body").addClass("overflow-hidden");
        //Close mobile search expand to avoid overlap with navigation
        if ($(".header-search-small.show").length) {
            $(".header-search-small.show").removeClass("show");
        }
    });

    //Resets navigation when closing it and removes overflow class
    $("#sg-navbar-collapse").on("hide.bs.collapse", function () {
        $("body").removeClass("overflow-hidden");

        if (!isDesktop()) {
            resetMobileNavigation();
        } else {
            $(".dropdown-items").collapse("hide");
        }
    });

    //Prevents the collapse events from children to propagate on parents
    $(".dropdown-items").on("show.bs.collapse, hide.bs.collapse", function (e) {
        e.stopPropagation();
    });

    /**
     * Resets mobile navigation to initial state.
     */
    function resetMobileNavigation() {
        $(".navigation-back-link").removeClass("d-flex").addClass("d-none");
        $(".nav-link").addClass("d-flex").removeClass("d-none");
        $(".navbar-nav").removeClass("expanded-subnavigation");
        $(".dropdown-items").collapse("hide");
    }

    $(".navigation-zone-item").on("show.bs.collapse", function (event) {
        event.stopPropagation();
    });

    $(".navigation-zone-item").on("hide.bs.collapse", function (event) {
        event.stopPropagation();
    });

    /**
     * Adds hide sticky class on scroll up
     */
    function handleStickyHeader() {
        if (!$("body").hasClass("overflow-hidden")) {
            var windowTop  = $(window).scrollTop();
            var zoneSelectorReminderStatus = cookie.getCookie("hidezoneselector");

            if ((windowTop <= headerBottom || windowTop < lastScrollTop)) {
                $header.removeClass("hide-sticky");
                $(".minicart-container-inner").removeClass("position-minicart");
                $(".minicart-overlay").removeClass("position-minicart");
            } else {
                $header.addClass("hide-sticky");
                $(".minicart-container-inner").addClass("position-minicart");
                $(".minicart-overlay").addClass("position-minicart");
                if ($(".header-collapse.show").length) {
                    $(".header-collapse.show").collapse("hide");
                }
            }

            if ($(window).scrollTop() > $header.outerHeight()) {
                $(".zone-reminder-modal").addClass("faded");
            } else if (!zoneSelectorReminderStatus || zoneSelectorReminderStatus < 0) {
                $(".zone-reminder-modal").removeClass("faded");
            }

            lastScrollTop = windowTop;
        }
    }

    handleZoneSelectorReminderModal();

    /**
     * Handles the behavior of the sticky zone selector reminder modal
     */
    function handleZoneSelectorReminderModal() {
        var zoneSelectorReminderStatus = cookie.getCookie("hidezoneselector");

        $(".js-close-reminder-modal").on("click", function () {
            $(this).parents(".zone-reminder-modal").addClass("faded");
            $(".js-zone-reminder-overlay").addClass("faded");

            // Calculate expiration date for the cookie
            var expirationHours = $(this).parents(".zone-reminder-container").data("reminder-option-expiration");
            var date = new Date();
            date.setTime(date.getTime() + expirationHours * 60 * 60 * 1000);
            var expires = "expires="+date.toUTCString();

            // Set cookie
            document.cookie = "hidezoneselector=1;" + expires + ";path=/";
        });

        if (!zoneSelectorReminderStatus || zoneSelectorReminderStatus < 0) {
            $(".zone-reminder-modal, .js-zone-reminder-overlay").removeClass("faded");
        }
    }

    keyboardAccessibility(".navigation-menu .nav-link, .navigation-menu .dropdown-link",
        {
            39: function (menuItem) { // right
                if (menuItem.hasClass("nav-item")) { // top level
                    menuItem.find(".dropdown-link").first().focus();
                } else {
                    if (menuItem.next().length == 0) { // if this is the last menuItem
                        menuItem.parent().find(".dropdown-link").first().focus(); // set focus to the first menuitem
                    } else {
                        menuItem.next().children().first().focus();
                    }
                }
            },
            37: function (menuItem) { // left
                if (!menuItem.hasClass("nav-item")) { // top level
                    if (menuItem.prev().not("hr").length == 0) { // if this is the first menuItem
                        menuItem.parent().find(".dropdown-link").last().focus(); // set focus to the first menuitem
                    } else {
                        menuItem.prev().children().first().focus();
                    }
                }
            },
            40: function (menuItem) { // down
                if (menuItem.hasClass("nav-item")) { // top level
                    menuItem.removeClass("show").children(".dropdown-menu").removeClass("show");
                    $(this).attr("aria-expanded", "false");
                    menuItem.next().children().first().focus();
                } else if (menuItem.hasClass("dropdown")) {
                    menuItem.addClass("show").children(".dropdown-menu").addClass("show");
                    $(this).attr("aria-expanded", "true");
                    menuItem.find("ul > li > a")
                        .first()
                        .focus();
                }
            },
            38: function (menuItem) { // up
                if (menuItem.hasClass("nav-item")) { // top level
                    menuItem.removeClass("show").children(".dropdown-menu").removeClass("show");
                    $(this).attr("aria-expanded", "false");
                    menuItem.prev().children().first().focus();
                } else {
                    menuItem.closest(".show").removeClass("show")
                        .closest("li.show").removeClass("show")
                        .children()
                        .first()
                        .focus()
                        .attr("aria-expanded", "false");
                }
            },
            27: function (menuItem) { // escape
                var parentMenu = menuItem.hasClass("show")
                    ? menuItem
                    : menuItem.closest("li.show");
                parentMenu.children(".show").removeClass("show");
                parentMenu.removeClass("show").children(".nav-link")
                    .attr("aria-expanded", "false");
                parentMenu.children().first().focus();
            }
        },
        function () {
            return $(this).parent();
        }
    );

    keyboardAccessibility(".navbar-header .user",
        {
            40: function ($popover) { // down
                if ($popover.children("a").first().is(":focus")) {
                    $popover.next().children().first().focus();
                } else {
                    $popover.children("a").first().focus();
                }
            },
            38: function ($popover) { // up
                if ($popover.children("a").first().is(":focus")) {
                    $(this).focus();
                    $popover.removeClass("show");
                } else {
                    $popover.children("a").first().focus();
                }
            },
            27: function () { // escape
                $(".navbar-header .user .popover").removeClass("show");
                $(".user").attr("aria-expanded", "false");
            },
            9: function () { // tab
                $(".navbar-header .user .popover").removeClass("show");
                $(".user").attr("aria-expanded", "false");
            }
        },
        function () {
            var $popover = $(".user .popover li.nav-item");
            return $popover;
        }
    );
};
