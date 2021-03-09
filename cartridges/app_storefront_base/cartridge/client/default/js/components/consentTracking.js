"use strict";

/**
 * Renders a modal window that will track the users consenting to accepting site tracking policy
 */
function showConsentModal() {
    if ($(".tracking-consent").length == 0 || !$(".tracking-consent").data("caonline")) {
        return;
    }

    $.spinner().start();
    $.ajax({
        url: $(".tracking-consent").data("url"),
        type: "get",
        dataType: "html",
        success: function (response) {

            var urlAccept = $(".tracking-consent").data("accept");
            var urlReject = $(".tracking-consent").data("reject");
            var textYes = $(".tracking-consent").data("accepttext");
            var textNo = $(".tracking-consent").data("rejecttext");
            var textHeader = $(".tracking-consent").data("heading");

            /** @todo ACF2 Will need to be refactored - and modal called as a constructor (from a new file) with params */

            var htmlString = `
            <div class="modal show fade" id="consentTracking" tabindex="-1" role="dialog" aria-labelledby="${textHeader}" aria-hidden="true" style="display: block;">
                <div class="modal-dialog modal-dialog-centered" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${textHeader}</h5>
                        </div>
                        <div class="modal-body"></div>
                        <div class="modal-footer">
                            <div class="button-wrapper">
                                <button type="button" class="btn btn-secondary decline" data-url="${urlReject}">${textNo}</button>
                                <button type="button" class="btn btn-primary affirm" data-url="${urlAccept}">${textYes}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop fade show"></div>`;

            $("body").append(htmlString);
            $(".modal-body").html(response);

            $.spinner().stop();
        },
        error: function () {
            $("#consentTracking").remove();
            $.spinner().stop();
            $("body > .modal-backdrop").remove();
        }
    });

    $(document).on("click", "#consentTracking .button-wrapper button", function (e) {
        e.preventDefault();
        var url = $(this).data("url");
        $.ajax({
            url: url,
            type: "get",
            dataType: "json",
            success: function () {
                $("#consentTracking").remove();
                $("body > .modal-backdrop").remove();
            },
            error: function () {
                $("#consentTracking").remove();
                $("body > .modal-backdrop").remove();
            }
        });
    });
}

module.exports = function () {
    if ($(".consented").length === 0 && $(".tracking-consent").hasClass("api-true")) {
        showConsentModal();
    }

    if ($(".tracking-consent").hasClass("api-true")) {
        $(".tracking-consent").click(function () {
            showConsentModal();
        });
    }
};
