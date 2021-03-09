"use strict";

/**
* Prescription service
* Include PrescriptionServiceDefinition.js and implement the relevant user handling methods.
*/
function DifarmaService() {
    var PrescriptionServiceDefinition = require("*/cartridge/scripts/services/PrescriptionServiceDefinition");

    /**
     * Upload prescription file
     * @return {Object} result of prescription upload
     */
    PrescriptionServiceDefinition.prototype.UploadFile = function (file) {
        var difarmaService = new PrescriptionServiceDefinition();
        return difarmaService.uploadFile(file);
    };

    /**
     * Returns prescription
     * @return {Object} Prescription
     */
    PrescriptionServiceDefinition.prototype.GetPrescriptionURL = function (fileID) {
        var difarmaService = new PrescriptionServiceDefinition();
        return difarmaService.getURL(fileID);
    };

    return new PrescriptionServiceDefinition();
}

module.exports = DifarmaService;
