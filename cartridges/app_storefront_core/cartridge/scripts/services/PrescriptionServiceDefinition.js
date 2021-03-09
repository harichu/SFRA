"use strict";

var Site                 = require("dw/system/Site");
var HTTPRequestPart      = require("dw/net/HTTPRequestPart");
var LocalServiceRegistry = require("dw/svc/LocalServiceRegistry");
var StringUtils          = require("dw/util/StringUtils");
var LoggerUtils          = require("*/cartridge/scripts/utils/LoggerUtils");

var SERVICE_NAME = "difarma.prescription";
/**
 * @class
 * PrescriptionServiceDefinition
 */
const PrescriptionServiceDefinition = function () {
    var createRequest = function (svc, args) {
        var awsToken = Site.current.getCustomPreferenceValue("difarmaAWSToken");
        svc.setRequestMethod("POST");
        svc.addHeader("Authorization", awsToken);
        LoggerUtils.serviceInfo("Service - " + SERVICE_NAME + " - createRequest(service, params);" +
            "url: " + svc.getURL() + ";");
        return args.file;
    };

    var execute = function (svc, req) {
        var httpClient = svc.client;
        httpClient.sendMultiPart([new HTTPRequestPart("file", req)]);
        return httpClient;
    };

    this.getURL = function (fileID) {
        var awsToken = Site.current.getCustomPreferenceValue("difarmaAWSToken");
        var svc = this.configure();
        return StringUtils.format(svc.configuration.credential.URL + "/{0}?token={1}", fileID, awsToken);
    };

    var parseResponse = function (svc, client) {
        var result = JSON.parse(client.text);
        return result;
    };

    this.configure = function () {
        var serviceObj = {
            createRequest: createRequest,
            parseResponse: parseResponse,
            executeOverride: true,
            execute: execute
        };

        this.service = LocalServiceRegistry.createService("difarma.prescription", serviceObj);
        return this.service;
    };

    this.uploadFile = function (file) {
        this.configure();
        if (this.service) {
            return this.service.call({ file: file, method: "POST"});
        }
        return null;
    };
};

module.exports = PrescriptionServiceDefinition;
