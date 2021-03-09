"use strict";

var ProductMgr = require("dw/catalog/ProductMgr");
var SFTPClient = require("dw/net/SFTPClient");
var Status     = require("dw/system/Status");
var gsUtil     = require("int_google/cartridge/scripts/helpers/GoogleShoppingHelper");
var Site       = require("dw/system/Site");
var Logger     = require("dw/system/Logger");

function start() {
    var preferences       = Site.current.preferences.custom;
    var allProducts       = ProductMgr.queryAllSiteProducts();
    var gsFeed            = gsUtil.createGSFeed(allProducts);
    var googleCredentials = JSON.parse(preferences.googleData);
    var siteName          = Site.current.name;

    var sftpData = {
        url  : googleCredentials.server_url,
        port : Number(googleCredentials.server_port),
        merchant : {
            name    : googleCredentials.merchant_username,
            password: googleCredentials.merchant_password
        },
        file : googleCredentials.file_name,
        timeout : googleCredentials.timeout
    };

    var sftp = new SFTPClient();
    sftp.setTimeout(sftpData.timeout);
    sftp.connect(sftpData.url, sftpData.port, sftpData.merchant.name, sftpData.merchant.password);
    
    if (sftp.connected) {
        Logger.info(siteName + " GoogleShopping - Connected to SFTP");
        
        var putFile = sftp.putBinary(sftpData.file, gsFeed);

        if (!putFile) {
            sftp.disconnect();
            return new Status(Status.ERROR, "ERROR", siteName + " GoogleShopping - There was an issue uploading the \"" + sftpData.file + "\" file to SFTP");
        }
    } else {
        sftp.disconnect();
        return new Status(Status.ERROR, "ERROR", siteName + " GoogleShopping - Could not connect to SFTP");
    }

    sftp.disconnect();

    return new Status(Status.OK, "OK", "Export has been successfully finished.");
}

exports.start = start;
