var formValidation = require("./components/formValidation");

$(document).ready(function () {
    if ($(".confirmation-map-element").length) {
        var map;
        var latLng = {
            lat: $("#map").data("lat"),
            lng: $("#map").data("lng")
        };

        /* eslint-disable */
        map = new google.maps.Map(document.getElementById("map"), { // NOSONAR
            center: latLng,
            zoom: 15
        });

        var marker = new google.maps.Marker({ // NOSONAR
            position: latLng,
            map: map
        });

        google.maps.event.trigger(map, "resize"); // NOSONAR

        /* eslint-enable */
    }


    $("form.checkout-registration").submit(function (e) {
        var form = $(this);
        e.preventDefault();
        var url = form.attr("action");
        form.spinner().start();
        $.ajax({
            url: url,
            type: "post",
            dataType: "json",
            data: form.serialize(),
            success: function (data) {
                form.spinner().stop();
                if (!data.success) {
                    formValidation(form, data);
                } else {
                    location.href = data.redirectUrl;
                }
            },
            error: function (err) {
                if (err.responseJSON.redirectUrl) {
                    window.location.href = err.responseJSON.redirectUrl;
                }
                form.spinner().stop();
            }
        });
        return false;
    });

    $(document).on("click", ".print-order", function (e) {
        e.preventDefault();
        window.print();
    });
});
