"use strict";

function convertObj(javaObj, depth) {
    var tempObj = {};
    for (var prop in javaObj) {
        if (prop != "class" || prop != "constructor") {
            if (depth > 0 &&  javaObj[prop]["class"] != null) {
                Object.defineProperty(tempObj, prop, {value: javaObj[prop]});
            } else {
                tempObj[prop] = javaObj[prop];
            }
        }
    }
    return tempObj;
}

module.exports = function (object, apiProduct) {
    Object.defineProperty(object, "custom", {
        enumerable: true,
        value: convertObj(apiProduct.custom, 1)
    });

    Object.defineProperty(object.custom, "shippingMethods", {
        enumerable: true,
        value: {
            homeDelivery: apiProduct.custom["homeDelivery"],
            storePickup: apiProduct.custom["storePickup"]
        }
    });

    Object.defineProperty(object.custom, "badges", {
        enumerable: true,
        value: {
            bioequivalence: apiProduct.custom["bioequivalence"] ? apiProduct.custom["bioequivalence"].absURL.toString() : null,
            expressdelivery: apiProduct.custom["expressdelivery"] ? apiProduct.custom["expressdelivery"].absURL.toString() : null
        }
    });

    Object.defineProperty(object, "tabs", {
        enumerable: true,
        value: {
            tab1Title: apiProduct.custom["tab1Title"],
            tab1Content: apiProduct.custom["tab1Content"] ? apiProduct.custom["tab1Content"].markup : null,
            tab2Title: apiProduct.custom["tab2Title"],
            tab2Content: apiProduct.custom["tab2Content"] ? apiProduct.custom["tab2Content"].markup : null,
            tab3Title: apiProduct.custom["tab3Title"],
            tab3Content: apiProduct.custom["tab3Content"] ? apiProduct.custom["tab3Content"].markup : null,
        }
    });

    var promotions = object.promotions;
    var hasClubPromotionAdjusment = false;
    var hasPromotionWithBadge = false;

    if (promotions) {
        promotions.forEach(function (promotion) {
            if (promotion.custom.isClubPromotion) {
                hasClubPromotionAdjusment = true;
            }

            if (promotion.custom.promotionPriceBadge) {
                hasPromotionWithBadge = true;
            }
        });
    }

    Object.defineProperty(object, "hasClubPromotionAdjusment", {
        enumerable: true,
        value: hasClubPromotionAdjusment
    });

    Object.defineProperty(object, "hasPromotionWithBadge", {
        enumerable: true,
        value: hasPromotionWithBadge
    });
};
