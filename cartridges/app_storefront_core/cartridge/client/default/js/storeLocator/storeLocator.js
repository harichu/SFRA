var scrollAnimate = require("../components/scrollAnimate");

/**
 * appends params to a url
 * @param {string} url - Original url
 * @param {Object} params - Parameters to append
 * @returns {string} result url with appended parameters
 */
function appendToUrl(url, params) {
    var newUrl = url;
    newUrl += (newUrl.indexOf("?") !== -1 ? "&" : "?") + Object.keys(params).map(function (key) {
        return key + "=" + encodeURIComponent(params[key]);
    }).join("&");

    return newUrl;
}

/**
  * Create an alert to display the error message
  * @param {Object} message - Error message to display
  */
function createErrorNotification(message) {
    var errorHtml = "<div class=\"alert alert-danger alert-dismissible valid-cart-error " +
    "fade show\" role=\"alert\">" +
    "<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\">" +
    "<span aria-hidden=\"true\">&times;</span>" +
    "</button>" + message + "</div>";

    $(".shipping-error").append(errorHtml);
    scrollAnimate($(".shipping-error"));
}

/**
 * Uses google maps api to render a map
 */
function maps() {
    var map;
    var infowindow = new google.maps.InfoWindow();
    var initialLat =  $(".map-canvas").data("defaultLat");
    var initialLon =  $(".map-canvas").data("defaultLon");
    // Init Colombia Map in the center of the viewport
    //var latlng = new google.maps.LatLng(4.5709, -74.2973);
    var latlng = new google.maps.LatLng(initialLat, initialLon);
    var mapOptions = {
        scrollwheel: false,
        zoom: 14,
        center: latlng,
        mapTypeId: "roadmap"
    };

    map = new google.maps.Map($(".map-canvas")[0], mapOptions);
    var mapdiv = $(".map-canvas").attr("data-locations");

    mapdiv = JSON.parse(mapdiv);

    var bounds = new google.maps.LatLngBounds();

    var markers = [];

    // Customized google map marker icon with svg format
    var markerImg = {
        url: $("#map-marker-base").attr("src"),
        anchor: new google.maps.Point(21, 57),
    };

    var markerImgActive = {
        url: $("#map-marker-active-base").attr("src"),
        anchor: new google.maps.Point(21, 57),
    };

    Object.keys(mapdiv).forEach(function (key) {
        var item = mapdiv[key];
        var storeLocation = new google.maps.LatLng(item.latitude, item.longitude);
        var marker = new google.maps.Marker({
            position: storeLocation,
            map: map,
            title: item.name,
            icon: markerImg,
        });

        markers.push(marker);

        marker.addListener("click", function () {
            infowindow.setOptions({
                content: item.infoWindowHtml
            });

            for (var j = 0; j < markers.length; j++) {
                markers[j].setIcon(markerImg);
            }

            infowindow.open(map, marker);
            this.setIcon(markerImgActive);
        });

        // Create a minimum bound based on a set of storeLocations
        bounds.extend(marker.position);
    });
    // Fit the all the store marks in the center of a minimum bounds when any store has been found.
    if (mapdiv && mapdiv.length !== 0) {
        map.setCenter(bounds.getCenter());
    }
}

/**
 * Renders the results of the search and updates the map
 * @param {Object} data - Response from the server
 */
function updateStoresResults(data) {
    var $mapDiv = $(".map-canvas");

    if ($mapDiv.length) {
        $mapDiv.attr("data-locations", data.locations);

        if ($mapDiv.data("has-google-api")) {
            maps();
        } else {
            $(".store-locator-no-apiKey").show();
        }

    } else {
        var $resultsDiv = $(".results");
        var hasResults = data.stores.length > 0;

        $resultsDiv.empty()
            .data("has-results", hasResults)
            .data("radius", data.radius)
            .data("search-key", data.searchKey);

        if (!hasResults) {
            $(".store-locator-no-results").show();
        } else {
            $(".store-locator-no-results").hide();
        }

        if (data.storesResultsHtml) {
            $resultsDiv.append(data.storesResultsHtml);
        }

        if (data.pickupTime) {
            $(document).find(".timeslot-store-hour").html(data.pickupTime);
        }
    }

    updateOtherStateAndCity(data);
}

function updateOtherStateAndCity(responseData) {
    if (responseData.stores.length > 0) {
        var store           = responseData.stores[0];
        var cityMappingData = $("#store-municipios").data("municipios");

        for (var stateName in cityMappingData) {
            if (stateName !== "States" && Object.prototype.hasOwnProperty.call(cityMappingData, stateName)) {
                var stateCities = cityMappingData[stateName];

                for (var city in stateCities) {
                    if (Object.prototype.hasOwnProperty.call(stateCities, city)) {
                        if (store.city === city) {
                            selectOtherStateAndCity(stateName, city);
                        }
                    }
                }
            }
        }
    }
}

function selectOtherStateAndCity(state, city) {
    if (city && state) {
        var $storeCities = $("#store-municipios");
        var $storeStates = $("#store-departamentos");

        $storeStates.val(state);
        $storeStates.trigger("change");
        $storeCities.val(city);
    }
}

/**
 * Search for stores with new zip code
 * @param {HTMLElement} element - the target html element
 * @returns {boolean} false to prevent default event
 */
function search(element) {
    var $form = element.closest(".store-locator");
    var $resultCard = $(".results-card");
    $resultCard.spinner().start();
    var radius = $(".results").data("radius");
    var url = $form.attr("action");
    var urlParams = { radius: radius };
    var fieldsSearch = {
        postalCode: $form.find("[name=\"postalCode\"]").val(),
        lat: window.localStorage.getItem("lat") ? window.localStorage.getItem("lat") : "",
        long: window.localStorage.getItem("long") ? window.localStorage.getItem("long") : "",
    };

    if (window.localStorage.getItem("tempLong") != null && window.localStorage.getItem("tempLat") != null) {
        fieldsSearch.lat = window.localStorage.getItem("tempLat");
        fieldsSearch.long = window.localStorage.getItem("tempLong");
        window.localStorage.removeItem("tempLat");
        window.localStorage.removeItem("tempLong");
    }

    var payload = $form.is("form") ? $form.serialize() : fieldsSearch;
    var isAsyncSearch = false;

    if (window.difarmaStorePickup.geolocation.lat
        && window.difarmaStorePickup.geolocation.lng
    ) {
        payload.lat  = window.difarmaStorePickup.geolocation.lat;
        payload.long = window.difarmaStorePickup.geolocation.lng;
        payload.city = window.difarmaStorePickup.city;
    } else {
        if (window.difarmaStorePickup.customerPosition || !isBrowserGeolocationEnabled) {
            // the default latitude and longitude below are just to pass a value anyway. This position is so far from the Americas that store search will give up and pick the default store for the site.
            window.difarmaStorePickup.customerPosition  = window.difarmaStorePickup.customerPosition || { lat : 0, lng : 0};
            payload.lat  = window.difarmaStorePickup.customerPosition.lat;
            payload.long = window.difarmaStorePickup.customerPosition.lng;
        } else if (isBrowserGeolocationEnabled) {
            isAsyncSearch = true;
            navigator.geolocation.getCurrentPosition(function (position) {
                // this context here is asynchronous.
                window.difarmaStorePickup = window.difarmaStorePickup || {};
                window.difarmaStorePickup.customerPosition = {};
                window.difarmaStorePickup.customerPosition.lat = position.coords.latitude;
                window.difarmaStorePickup.customerPosition.lng = position.coords.longitude;
                executeSearch(url, urlParams, $form, payload, $resultCard);
            });
        }
    }

    if (!isAsyncSearch) {
        executeSearch(url, urlParams, $form, payload, $resultCard);
    }

    return false;
}

function executeSearch(url, urlParams, $form, payload, $resultCard) {
    url = appendToUrl(url, urlParams);

    $.ajax({
        url: url,
        type: $form.attr("method"),
        data: payload,
        dataType: "json",
        success: function (data) {
            $resultCard.spinner().stop();
            updateStoresResults(data);
            $(".select-store").prop("disabled", true);
        },
        error: function (err) {
            $resultCard.spinner().stop();
            if ($(".shipping-error").html().length == 0) {
                createErrorNotification(JSON.parse(err.responseText).message);
            } else {
                scrollAnimate($(".shipping-error"));
            }
        }
    });
}

var countryCode = $(".current-site-data").data("country-code");

function convertUrlParamsToObj(t) {
    t = t[0] == "?" ? t.slice(1) : t;
    return t.split("&").reduce(function (acc, val) { var arr=val.split("="); acc[arr[0]] = arr[1]; console.log(acc); return acc;}, {});
}

function convertObjToUrlParams(obj) {
    // Fix IE issue with the polyfill below
    if (!Object.entries) {
        Object.entries = function (o) {
            var ownProps = Object.keys(o);
            var i = ownProps.length;
            var resArray = new Array(i);
            while (i--) {
                resArray[i] = [ownProps[i], o[ownProps[i]]];
            }
            return resArray;
        };
    }
    var objArr = Object.entries(obj);
    return objArr.reduce(function (acc, val, index) {
        return (index==0?"?":"")+acc+val[0]+"="+val[1]+(objArr && index < objArr.length-1 ? "&" : "");
    }, "");
}

var initAutocomplete = function () {
    var autocomplete = null;
    var searchInput = document.getElementById("storelocatorInput");

    if (searchInput == null) {
        return;
    }

    autocomplete = new google.maps.places.Autocomplete(searchInput, {
        types: ["geocode"],
        componentRestrictions: {country: countryCode}
    });
    autocomplete.setFields(["address_component", "geometry"]);
    autocomplete.addListener("place_changed", function () {
        var place = autocomplete.getPlace();
        window.localStorage.setItem("searchQueryText", $(".storelocator-search-form input").val());
        if (place.geometry) {
            var addressComponents = place.address_components.map(addr => addr.long_name).join(", ");
            window.dataLayer      = window.dataLayer || [];

            window.dataLayer.push({
                event      : "SearchForStores",
                eventTypes : "click",
                action     : addressComponents,
                label      : "Address"
            });

            var paramsObj = convertUrlParamsToObj(window.location.search);
            paramsObj.long = place.geometry.location.lng();
            paramsObj.lat = place.geometry.location.lat();
            if (paramsObj.delsrch) { delete paramsObj.delsrch; }
            window.location.search = convertObjToUrlParams(paramsObj);
        }
    });
};

var isBrowserGeolocationEnabled = $("#is-browser-geolocation-enabled").val() === "true";

function updateGeoLocation() {
    if (isBrowserGeolocationEnabled) {
        navigator.geolocation.getCurrentPosition(function (position) {
            var paramsObj = convertUrlParamsToObj(window.location.search);
            if (paramsObj.delsrch) { delete paramsObj.delsrch; }
            if (!(paramsObj && paramsObj.lat && paramsObj.long)) {
                paramsObj.long = position.coords.longitude;
                paramsObj.lat = position.coords.latitude;
                window.location.search = convertObjToUrlParams(paramsObj);
            }
        });
    }
}

if (isBrowserGeolocationEnabled) {
    navigator.geolocation.getCurrentPosition(function (position) {
        window.difarmaStorePickup = window.difarmaStorePickup || {};
        window.difarmaStorePickup.customerPosition = {};
        window.difarmaStorePickup.customerPosition.lat = position.coords.latitude;
        window.difarmaStorePickup.customerPosition.lng = position.coords.longitude;
    });
}

module.exports = {
    init: function () {
        if ($(".map-canvas").data("has-google-api")) {
            maps();
            updateGeoLocation();
        } else {
            $(".store-locator-no-apiKey").show();
        }

        if (!$(".results").data("has-results")) {
            $(".store-locator-no-results").show();
        }

        var queryText = window.localStorage.getItem("searchQueryText");

        $(".storelocator-search-form input").val(queryText);
    },

    detectLocation: function () {
        // clicking on detect location.
        $(".detect-location").on("click", function () {
            $.spinner().start();
            if (!navigator.geolocation) {
                $.spinner().stop();
                return;
            }

            var $detectLocationButton = $(".detect-location");
            var radius = $(".results").data("radius");
            var urlParams = {
                radius: radius,
                lat: null,
                long: null
            };

            if (isBrowserGeolocationEnabled) {
                navigator.geolocation.getCurrentPosition(function (position) {
                    urlParams.lat  = position.coords.latitude;
                    urlParams.long = position.coords.longitude;
                });
            }

            var url = $detectLocationButton.data("action");
            url     = appendToUrl(url, urlParams);
            $.ajax({
                url: url,
                type: "get",
                dataType: "json",
                success: function (data) {
                    $.spinner().stop();
                    updateStoresResults(data);
                    $(".select-store").prop("disabled", true);
                }
            });
        });
    },

    search: function () {
        $(".store-locator-container form.store-locator").submit(function (e) {
            e.preventDefault();
            search($(this));
        });
        $(".store-locator-container .btn-storelocator-search[type=\"button\"]").click(function (e) {
            e.preventDefault();
            search($(this));
        });
    },

    changeRadius: function () {
        $(".store-locator-container .radius").change(function () {
            var radius = $(this).val();
            var searchKeys = $(".results").data("search-key");
            var url = $(".radius").data("action-url");
            var urlParams = {};

            if (searchKeys.postalCode) {
                urlParams = {
                    radius: radius,
                    postalCode: searchKeys.postalCode
                };
            } else if (searchKeys.lat && searchKeys.long) {
                urlParams = {
                    radius: radius,
                    lat: searchKeys.lat,
                    long: searchKeys.long
                };
            }

            url = appendToUrl(url, urlParams);
            var dialog = $(this).closest(".in-store-inventory-dialog");
            var spinner = dialog.length ? dialog.spinner() : $.spinner();
            spinner.start();
            $.ajax({
                url: url,
                type: "get",
                dataType: "json",
                success: function (data) {
                    spinner.stop();
                    updateStoresResults(data);
                    $(".select-store").prop("disabled", true);
                }
            });
        });
    },
    selectStore: function () {
        $(".store-locator-container").on("click", ".select-store", (function (e) {
            e.preventDefault();
            var url           = $(this).data("url");
            var selectedStore = $(":checked", ".results-card .results");

            $.ajax({
                url      : url,
                type     : "get",
                dataType : "json",
                data     : {
                    storeID: selectedStore.val()
                },
                success: function (data) {
                    $("[name='pickday']").attr("disabled", false);
                    var $todayRadioOption    = $("[name='pickday'][value='today']");
                    var $tomorrowRadioOption = $("[name='pickday'][value='tomorrow']");

                    if (data.storeData.currentDayHour) {
                        $todayRadioOption.trigger("click");

                    } else {
                        $tomorrowRadioOption.trigger("click");
                        $todayRadioOption.attr("disabled", true);
                        $(".shipping-method-list [data-is-today='true'] input[data-pickup='true']").attr("disabled", true);
                        $todayRadioOption.parent(".custom-radio").addClass("disabled");
                    }

                    $("#current-day-hour").val(data.storeData.currentDayHour);
                    $("#next-day-hour").val(data.storeData.nextDayHour);

                    $("body").trigger("store:selected", {
                        storeID          : selectedStore.val(),
                        searchRadius     : $("#radius").val(),
                        searchPostalCode : $(".results").data("search-key").postalCode,
                        storeDetailsHtml : selectedStore.siblings("label").find(".store-details").html(),
                        event            : e
                    });
                }
            });
        }));
    },
    updateSelectStoreButton: function () {
        $("body").on("change", ".select-store-input", (function () {
            var $this = $(this);

            $(".select-store").prop("disabled", false);

            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                event      : "PickupStore",
                eventTypes : "click",
                action     : $this.val(),
                label      : "StoreID"
            });

            if ($(this).is(":checked")) {
                $(this).parents(".results-card").find(".store-result-item").removeClass("active");
                $(this).parents(".store-result-item").addClass("active");
            }
        }));
    },
    initDayNightRadioListener : function () {
        $("body").on("change", "[name='pickday']", (function () {
            var $this = $(this);

            if ($this.is(":checked")) {
                var url = $this.closest("div").data("url");

                $.ajax({
                    url      : url,
                    type     : "get",
                    dataType : "json",
                    data     : {
                        isToday      : $this.val() === "today",
                        todayTime    : $("#current-day-hour").val(),
                        tomorrowTime : $("#next-day-hour").val()
                    }
                });
            }
        }));
    },
    initAutocomplete: function () {
        google.maps.event.addDomListener(window, "load", initAutocomplete);
    },
    updateCustomerLocationByZone: function (municipio, departamento) {
        var map = new google.maps.Map(document.getElementById("map")); // eslint-disable-line
        var displaySuggestions = function (predictions, status) {
            if (status != google.maps.places.PlacesServiceStatus.OK) { // eslint-disable-line
                console.log(status);
                if (status == "ZERO_RESULTS") {
                    $(".results-card").find(".store-locator-no-results").html($(".results-card").data("noresults"));
                }
                $(".results-card").spinner().stop();
                return;
            }
            var firstItem = predictions[0];
            var request = {
                placeId: firstItem.place_id,
                fields: ["geometry"]
            };
    
            $(".selected-location-departamento").html(departamento);
            $(".selected-location-municipio").html(municipio);
    
            service = new google.maps.places.PlacesService(map); // eslint-disable-line
            service.getDetails(request, callback);
    
            function callback(place, statusCallBack) { // eslint-disable-line
                window.localStorage.setItem("tempLat", place.geometry.location.lat());
                window.localStorage.setItem("tempLong", place.geometry.location.lng());
    
                window.difarmaStorePickup.state           = departamento;
                window.difarmaStorePickup.city            = municipio;
                window.difarmaStorePickup.geolocation.lat = place.geometry.location.lat();
                window.difarmaStorePickup.geolocation.lng = place.geometry.location.lng();
                $(".btn-storelocator-search").trigger("click");
            }
            $(".results-card").spinner().stop();
        };
        var service = new google.maps.places.AutocompleteService(); // eslint-disable-line
        var value = municipio + ", " + departamento;
        service.getPlacePredictions({ input: value }, displaySuggestions);
    }
};
