"use strict";

/**
 * This script will add a function to autocomplete the address fields used by Google Places API.
 * The script assumes that Google Places' library is injected in the DOM
 */

var countryCode = $(".current-site-data").data("country-code");
var keyMaps = {
    COUNTRY: "country",
    CITY: "locality",
    ADM_AREA3: "administrative_area_level_3",
    ADM_AREA2: "administrative_area_level_2",
    STATE: "administrative_area_level_1",
    ZIPCODE: "postal_code",
    ADDRESS1: "route"
};

var generalUtils = require("app_storefront_core/cartridge/client/default/js/generalUtils.js");

function removeDiacritics(str) {
    return generalUtils.removeDiacritics(str).toLowerCase();
}

function getBestMatchIndex(value, candidateArray) {
    for (var index = 0; index < candidateArray.length; index++) {
        if (removeDiacritics(value) === removeDiacritics(candidateArray[index])) {
            return index;
        }
    }

    return getSecondBestMatchIndex(value, candidateArray);
}

function getSecondBestMatchIndex(value, candidateArray) {
    for (var index = 0; index < candidateArray.length; index++) {
        if (removeDiacritics(candidateArray[index]).includes(removeDiacritics(value))) {
            return index;
        }
    }

    return -1;
}

/**
 *
 * @param {String} stateName    retrieved from Google Places;
 * @param {String} admArea2Name retrieved from Google Places;
 * @return {Boolean} whether a state was found;
 */
function selectState(stateName, admArea2Name) {
    var $stateChildren = $("[data-autocomplete=state").children();
    var stateNameArray = $stateChildren.map(function () {
        return $(this).val();
    });

    var bestMatchIndex = getBestMatchIndex(stateName, stateNameArray);
    var admArea2Found  = $stateChildren.filter(function () {
        return admArea2Name && removeDiacritics(this.value) == removeDiacritics(admArea2Name);
    });

    if (admArea2Found.length > 0) {
        selectOption(admArea2Found[0], admArea2Name);
        $("[data-autocomplete=state").trigger("change");
        return true;
    } else if (bestMatchIndex >= 0) {
        selectOption($stateChildren.get(bestMatchIndex), stateName);
        $("[data-autocomplete=state").trigger("change");
        return true;
    }

    return false;
}

/**
 * Finds the given type in a Google Places' place array
 *
 * @param {Object[]} place an array containing the place's data
 * @param {String} type a string with the type of place data
 */
function getTypeFromPlace(place, type) {
    return place.address_components.find(function (field) {
        return field.types.indexOf(type) !== -1;
    });
}

/**
 * Fills in the given dropdown select input option
 * @param {HTMLOptionElement} option the option html element
 * @param {Object} data an Google Place's type object
 */
function fillDropdownOption(option, data) {
    if (option && data) {
        $(option).attr("id", data.short_name);
        $(option).val(data.short_name);
        $(option).text(data.long_name);
        $(option).prop("selected", true);
        return true;
    }
    return false;
}

/**
 * Fills in the given dropdown select input option
 * @param {HTMLOptionElement} option the option html element
 * @param {String}            optionNewValue
 */
function selectOption(option, optionNewValue) {
    if (option && optionNewValue) {
        $(option).attr("id", optionNewValue);
        $(option).prop("selected", true);
        return true;
    }
    return false;
}
module.exports = function () {
    var autocomplete = null;
    var initAutocomplete = function () {
        var [source] = $("[data-autocomplete=source]");
        if (!source) {
            return;
        }
        autocomplete = new google.maps.places.Autocomplete(source, {
            types: ["geocode"],
            componentRestrictions: {country: countryCode}
        });
        autocomplete.setFields(["address_component", "geometry"]);
        autocomplete.addListener("place_changed", function () {
            var place = autocomplete.getPlace();
            var city = getTypeFromPlace(place, keyMaps.CITY);
            var admArea3 = getTypeFromPlace(place, keyMaps.ADM_AREA3);
            var admArea2 = getTypeFromPlace(place, keyMaps.ADM_AREA2);
            var zipCode = getTypeFromPlace(place, keyMaps.ZIPCODE);
            var state = getTypeFromPlace(place, keyMaps.STATE);
            var country = getTypeFromPlace(place, keyMaps.COUNTRY);
            $("#addressLatitude").val(place.geometry.location.lat());
            $("#addressLongitude").val(place.geometry.location.lng());

            if (zipCode) {
                $("[data-autocomplete=zipcode]").val(zipCode.short_name);
            }
            fillDropdownOption($("[data-autocomplete=country]").children()[1], country);

            var wasStateSelected = selectState(state.short_name, admArea2 && admArea2.short_name);

            if (wasStateSelected) {
                var $cityChildren = $("[data-autocomplete=city").children();
                if (admArea3) {
                    var admArea3Found = $cityChildren.filter(function () {
                        return removeDiacritics(this.value) == removeDiacritics(admArea3.short_name);
                    });
                    fillDropdownOption(admArea3Found.length > 0 ? admArea3Found[0] : $cityChildren[1], admArea3);
                } else if (city) {
                    var cityFound = $cityChildren.filter(function () {
                        return removeDiacritics(this.value) == removeDiacritics(city.short_name);
                    });
                    fillDropdownOption(cityFound.length > 0 ? cityFound[0] : $cityChildren[1], city);
                }
            }

            var routeData = place.address_components.filter(function (component) {
                return component.types.indexOf("route") !== -1;
            });

            var streetNumberData = place.address_components.filter(function (component) {
                return component.types.indexOf("street_number") !== -1;
            });

            var route        = null;
            var streetNumber = null;

            if (routeData.length > 0) {
                route = routeData[0].long_name;
            }
            
            if (streetNumberData.length > 0) {
                streetNumber = streetNumberData[0].long_name;
            }

            if (routeData.length > 0) {
                var address = route + (streetNumber ? ", " + streetNumber : "");
                $("#shippingAddressOnedefault").val(address);
            }

            $("[data-autocomplete=source]").blur();
        });

        $("[data-autocomplete=source]").one("focus", function () {
            $(this).attr("autocomplete", "new-password");
        });
    };
    google.maps.event.addDomListener(window, "load", initAutocomplete);
    $(window).on("initAutocompleteEvent", initAutocomplete);
};
