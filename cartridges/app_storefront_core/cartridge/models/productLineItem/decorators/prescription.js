"use strict";

module.exports = function (object, lineItem) {
    Object.defineProperty(object, "productPrescriptionModel", {
        enumerable: true,
        value: lineItem.product.custom.difarmaPrescriptionModel.value
    });
    Object.defineProperty(object, "difarmaPrescriptionId", {
        enumerable: true,
        value: lineItem.custom.difarmaPrescriptionId
    });
    Object.defineProperty(object, "difarmaPrescriptionFileName", {
        enumerable: true,
        value: lineItem.custom.difarmaPrescriptionFileName
    });
};
