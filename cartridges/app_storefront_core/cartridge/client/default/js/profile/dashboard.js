"use strict";

module.exports = {
    init: function () {
        var loyaltyLevel = $("#customer-loyalty-level").val().toLocaleLowerCase().replace(/ /g, "-");
        var $loyaltCard  = $(".loyalty-card");

        var displayCorrectLoyaltyLevelElements = function () {
            var $this = $(this);
            if ($this.hasClass("loyalty-level-" + loyaltyLevel)) {
                $this.removeClass("d-none");
            }
        };

        $loyaltCard.find(".loyalty-medicine").each(displayCorrectLoyaltyLevelElements);
        $loyaltCard.find(".loyalty-beauty").each(displayCorrectLoyaltyLevelElements);
    }
};
