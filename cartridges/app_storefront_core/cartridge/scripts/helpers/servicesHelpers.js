"use strict";

var LocalServiceRegistry = require("dw/svc/LocalServiceRegistry");

/**
 * Function responsible for getting an dw.svc.ServiceRegistry instance using the ID of the Service that was created in BM
 * @param {String} serviceID - ID of the webservice that was configured in BM
 * @param {Dictionary} serviceCallback - Dictionary containing the mandatory methods for the service (createRequest and parse)
 * @returns the service created
 */

function get(serviceID, serviceCallback) {
    var service = null;
    //If the service was not configured and callback was sent
    if (serviceCallback) {
        service = LocalServiceRegistry.createService(serviceID, serviceCallback);
    }

    return service;
}

exports.Get = get;
