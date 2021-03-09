"use strict";

var generalUtils = require("jsfarmacias/generalUtils");

var $body = $("body");
var isZoneCityMappingEnabled = $("#is-zone-city-zone-mapping-enabled").is(":checked");

function initDataForFirstSiteAccess() {
    var $initialCity  = $("#initial-city");
    var $initialState = $("#initial-state");

    if ($initialCity.length && !window.localStorage.cityName) {
        window.localStorage.cityName = $initialCity.val();
    }

    if ($initialState.length && !window.localStorage.stateName) {
        window.localStorage.stateName = $initialState.val();
    }
}

function initListeners() {
    initDataForFirstSiteAccess();

    if (isZoneCityMappingEnabled) {
        if (window.localStorage.stateName) {
            $(".state-select").val(window.localStorage.stateName);
        }

        if (window.localStorage.cityName) {
            $(".selected-zone-city").text(window.localStorage.cityName);
            $(".js_selected-zone").text(": \"" + window.localStorage.cityName + "\"");
        }
    } else {
        $(".selected-zone-city").text(window.localStorage.cityName);
        var $cityOption = $("#zone option").filter(function (i, e) {
            return $(e).data("zone-name").trim() === window.localStorage.cityName;
        });
        $cityOption.attr("selected", "selected");
        generalUtils.sortOptionsAlphabetically($("#zone"));
    }

    $body.on("change", ".state-select", function () {
        populateCitiesField($(this));
    });

    $body.on("click", ".set-active-zone-btn", function () {
        var $this              = $(this);
        var $container         = $("#zoneFinder");
        var url                = $this.data("url");
        var zoneID             = $container.find(".city-select").val();
        var cityName           = $container.find(".city-select option:selected").html().trim();
        var stateName          = $container.find(".state-select").val();
        var isStoreLocatorPage = $("#is-store-locator-page").is(":checked");

        if (stateName && zoneID) {
            $.ajax({
                url      : url,
                method   : "POST",
                dataType : "json",
                data     : {
                    zone      : zoneID,
                    cityName  : cityName,
                    stateName : stateName
                },
                success  : function (data) {
                    $(".active-zone").text(cityName);

                    if (data.cityName) {
                        window.localStorage.stateName = data.stateName;
                        window.localStorage.cityName  = data.cityName;
                    }

                    if (data.needReload) {
                        if (data.url.length && isStoreLocatorPage) {
                            $(document).find("#storelocatorInput").val("");
                            window.location.href = data.url;
                        } else {
                            location.reload();
                        }
                    }
                    else {
                        $container.modal("hide");
                    }
                }
            });
        }
    });
}

function populateCitiesField($state) {
    var stateID      = $state.val();
    var $container   = $("#zoneFinder");
    var $citySelect  = $container.find(".city-select");
    var cities       = JSON.parse($citySelect.attr("data-municipios"));
    var stateCities  = cities[stateID];
    var selectedCity = window.localStorage.cityName;

    $citySelect.find("option").not(":first").remove();

    if (isZoneCityMappingEnabled) {
        for (var city in stateCities) {
            if (Object.prototype.hasOwnProperty.call(stateCities, city)) {
                $citySelect.append("<option value='" + stateCities[city] + "' " + (selectedCity === city ? "selected" : "") + ">" + city + "</option>");
            }
        }
        generalUtils.sortOptionsAlphabetically($citySelect);
    } else {
        generalUtils.sortOptionsAlphabetically($("#zone"));
    }
}

module.exports = {
    init : function () {
        initListeners();
        $(".state-select").trigger("change");
    }
};
