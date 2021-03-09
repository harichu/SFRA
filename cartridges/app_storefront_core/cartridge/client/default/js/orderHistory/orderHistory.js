"use strict";

module.exports = function () {

    var $body               = $("body");
    var $orderListContainer = $(".order-cards-container");

    $body.on("click", ".order-history-header .sort-icon", function () {
        $orderListContainer.spinner().start();
        $.ajax({
            url      : $(this).data("url"),
            type     : "get",
            dataType : "json",
            success  : function (data) {
                $orderListContainer.spinner().stop();
                $(".order-history-header .order-" + data.sortingAttr + " .sort-icon").data("url", data.updatedURL);
                $orderListContainer.html(data.addresListTemplate);
            }
        });
    });

    $body.on("click", ".order-sor-btn", function () {
        var $this       = $(this);
        var $orderLine  = $this.closest(".order-list-item");
        var orderNo =     $orderLine.data("order-no");
        var url         = $("#sor-modal-url").val();
        var pids        = $orderLine.data("order-pids");
        var orderHasSor = $this.data("has-sor");

        $("#sor-order-no").val(orderNo);
        if (orderHasSor) {
            $.ajax({
                url     : url,
                method  : "GET",
                data : {
                    pids : pids
                },
                success : function (data) {
                    $(".sor-modal").html(data);
                    $(".modal-sor").modal("show");
                }
            });
        }
    });

    $body.on("click", ".submit-sor-btn", function () {
        var orderNo                  = $("#sor-order-no").val();
        var sorIntervalType          = $("#everyDelivery").val();
        var sorDeliveryWeekInterval  = $("#SorDeliveryWeekInterval").val();
        var sorDeliveryMonthInterval = $("#SorDeliveryMonthInterval").val();
        var sorIntervalValue         = sorIntervalType === "month" ? sorDeliveryMonthInterval : sorDeliveryWeekInterval;

        $.ajax({
            url      : $(this).data("url"),
            type     : "get",
            dataType : "json",
            data     : {
                orderNo          : orderNo,
                sorIntervalType  : sorIntervalType,
                sorIntervalValue : sorIntervalValue
            },
            success  : function (data) {
                if (data.success) {
                    $(".modal-sor").modal("hide");
                    window.location.href = data.redirectUrl;
                }
            }
        });
    });

    $("body").on("change", ".order-history-select", function (e) {
        var $ordersContainer = $(".order-list-container");
        $ordersContainer.empty();
        $(".order-history-select").trigger("orderHistory:sort", e);
        $.ajax({
            url: e.currentTarget.value,
            method: "GET",
            success: function (data) {
                $ordersContainer.html(data);
            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                }
            }
        });
    });

    $(document).on("click", ".print-order", function (e) {
        e.preventDefault();
        window.print();
    });

    if ($(".confirmation-map-element").length) {
        var map;
        var latLng = {
            lat: $("#map").data("lat"),
            lng: $("#map").data("lng")
        };

        /* eslint-disable */
        map = new google.maps.Map(document.getElementById("map"), { // NOSONAR
            center: latLng,
            zoom: 15,
            mapTypeId: "roadmap"
        });

        var marker = new google.maps.Marker({ // NOSONAR
            position: latLng,
            map: map
        });


        google.maps.event.trigger(map, "resize"); // NOSONAR

        /* eslint-enable */
    }
};
