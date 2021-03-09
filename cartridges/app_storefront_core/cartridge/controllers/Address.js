"use strict";

var server = require("server");
var base = module.superModule;

var Resource = require("dw/web/Resource");
var URLUtils = require("dw/web/URLUtils");
var csrfProtection = require("*/cartridge/scripts/middleware/csrf");
var userLoggedIn = require("*/cartridge/scripts/middleware/userLoggedIn");
var consentTracking = require("*/cartridge/scripts/middleware/consentTracking");
var COHelpers = require("*/cartridge/scripts/checkout/checkoutHelpers");
server.extend(base);

server.replace("SaveAddress", csrfProtection.validateAjaxRequest, function (req1, res1, next) {
    var CustomerMgr = require("dw/customer/CustomerMgr");
    var Transaction = require("dw/system/Transaction");
    var formErrors = require("*/cartridge/scripts/formErrors");
    var accountHelpers = require("*/cartridge/scripts/helpers/accountHelpers");

    var addressForm = server.forms.getForm("address");
    var addressFormObj = addressForm.toObject();
    addressFormObj.addressForm = addressForm;
    var customer = CustomerMgr.getCustomerByCustomerNumber(
        req1.currentCustomer.profile.customerNo
    );
    var addressBook = customer.getProfile().getAddressBook();
    if (addressForm.valid) {
        res1.setViewData(addressFormObj);
        this.on("route:BeforeComplete", function (req2, res2) {
            var formInfo = res2.getViewData();
            Transaction.wrap(function () {
                var address = null;
                if (formInfo.addressId.equals(req2.querystring.addressId) || !addressBook.getAddress(formInfo.addressId)) {
                    address = req2.querystring.addressId
                        ? addressBook.getAddress(req2.querystring.addressId)
                        : addressBook.createAddress(formInfo.addressId);
                }
                if (address) {
                    if (req2.querystring.addressId) {
                        address.setID(formInfo.addressId);
                    }

                    address.setAddress1(formInfo.address1 || "");
                    address.setAddress2(formInfo.address2 || "");
                    address.setCity(formInfo.city || "");
                    address.setFirstName(formInfo.firstName || "");
                    address.setLastName(formInfo.lastName || "");
                    address.setPhone(formInfo.phone || "");
                    address.setPostalCode(formInfo.postalCode || "");
                    address.custom.barrio = formInfo.barrio || "";
                    address.custom.latitude = formInfo.latitude || "";
                    address.custom.longitude = formInfo.longitude || "";

                    if (formInfo.states && formInfo.states.stateCode) {
                        address.setStateCode(formInfo.states.stateCode);
                    }

                    if (formInfo.country) {
                        address.setCountryCode(formInfo.country);
                    }

                    address.setJobTitle(formInfo.jobTitle || "");
                    address.setPostBox(formInfo.postBox || "");
                    address.setSalutation(formInfo.salutation || "");
                    address.setSecondName(formInfo.secondName || "");
                    address.setCompanyName(formInfo.companyName || "");
                    address.setSuffix(formInfo.suffix || "");
                    address.setSuite(formInfo.suite || "");
                    address.setJobTitle(formInfo.title || "");

                    // Send account edited email
                    accountHelpers.sendAccountEditedEmail(customer.profile);

                    res2.json({
                        success: true,
                        redirectUrl: URLUtils.url("Address-List").toString()
                    });
                } else {
                    formInfo.addressForm.valid = false;
                    formInfo.addressForm.addressId.valid = false;
                    formInfo.addressForm.addressId.error =
                        Resource.msg("error.message.idalreadyexists", "forms", null);
                    res2.json({
                        success: false,
                        fields: formErrors.getFormErrors(addressForm)
                    });
                }
            });
        });
        this.on("route:Complete", function (_req3, res3) {
            var viewData = res3.getViewData();
            if (viewData.success && customer.authenticated) {
                Transaction.wrap(function () {
                    customer.profile.custom.lastProfileChangeTimestamp = new Date();
                });
            }
        });
    } else {
        res1.json({
            success: false,
            fields: formErrors.getFormErrors(addressForm)
        });
    }
    return next();
});

server.append(
    "AddAddress",
    userLoggedIn.validateLoggedIn,
    consentTracking.consent,
    function (req, res, next) {
        var Site = require("dw/system/Site");

        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

        var isZoneCityMappingEnabled = Site.current.getCustomPreferenceValue("enableCityZoneMapping");

        var viewData = res.getViewData();
        var dmList = COHelpers.getDepartamentosAndMunicipios();
        var CustomerMgr = require("dw/customer/CustomerMgr");
        var customer = CustomerMgr.getCustomerByCustomerNumber(
            req.currentCustomer.profile.customerNo
        );
        var customerFirstName = customer.profile.firstName;
        var customerLastName = customer.profile.lastName;
        var customerCelular = customer.profile.phoneMobile;

        viewData.isZoneCityMappingEnabled = isZoneCityMappingEnabled;
        viewData.departamentos = dmList.departamentos;
        viewData.municipios = dmList.municipios;
        viewData.customerFirstName = customerFirstName;
        viewData.customerLastName = customerLastName;
        viewData.customerCelular = customerCelular;
        viewData.sidebarCurrent = "myaddresses";
        viewData.breadcrumbs = [
            {
                htmlValue: Resource.msg("global.home", "common", null),
                url: URLUtils.home().toString()
            },
            {
                htmlValue: Resource.msg("label.profile", "account", null),
                url: URLUtils.url("Account-Show").toString()
            },
            {
                htmlValue: Resource.msg("label.addressbook", "account", null),
                url: URLUtils.url("Address-List").toString()
            }
        ];
        res.setViewData(viewData);
        return next();
    }
);

server.replace(
    "EditAddress",
    csrfProtection.generateToken,
    userLoggedIn.validateLoggedIn,
    consentTracking.consent,
    function (req, res, next) {
        var CustomerMgr = require("dw/customer/CustomerMgr");
        var AddressModel = require("*/cartridge/models/address");
        var Site = require("dw/system/Site");
        var dmList = COHelpers.getDepartamentosAndMunicipios();

        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

        var departamentos = dmList.departamentos;
        var municipios = dmList.municipios;
        var addressId = req.querystring.addressId;
        var customer = CustomerMgr.getCustomerByCustomerNumber(
            req.currentCustomer.profile.customerNo
        );
        var addressBook = customer.getProfile().getAddressBook();
        var rawAddress = addressBook.getAddress(addressId);
        var addressModel = new AddressModel(rawAddress);
        var addressForm = server.forms.getForm("address");
        addressForm.clear();

        addressForm.copyFrom(addressModel.address);

        res.render("account/editAddAddress", {
            addressForm: addressForm,
            addressId: addressId,
            departamentos: departamentos,
            municipios: municipios,
            stateValue: rawAddress.stateCode,
            sidebarCurrent: "myaddresses",
            breadcrumbs: [
                {
                    htmlValue: Resource.msg("global.home", "common", null),
                    url: URLUtils.home().toString()
                },
                {
                    htmlValue: Resource.msg("label.profile", "account", null),
                    url: URLUtils.url("Account-Show").toString()
                },
                {
                    htmlValue: Resource.msg("label.addressbook", "account", null),
                    url: URLUtils.url("Address-List").toString()
                }
            ]
        });

        next();
    }
);

server.append(
    "List",
    csrfProtection.generateToken,
    userLoggedIn.validateLoggedIn,
    consentTracking.consent,
    function (req, res, next) {
        var Site = require("dw/system/Site");
        var viewData = res.getViewData();

        req.pageMetaData.setTitle(Site.current.getCustomPreferenceValue("defaultPageTitle"));

        viewData.breadcrumbs = [
            {
                htmlValue: Resource.msg("global.home", "common", null),
                url: URLUtils.home().toString()
            },
            {
                htmlValue: Resource.msg("label.profile", "account", null),
                url: URLUtils.url("Account-Show").toString()
            },
            {
                htmlValue: Resource.msg("label.addressbook", "account", null),
                url: ""
            }
        ];
        viewData.sidebarCurrent = "myaddresses";
        res.setViewData(viewData);
        return next();
    }
);

server.get(
    "Sort",
    csrfProtection.generateToken,
    userLoggedIn.validateLoggedIn,
    consentTracking.consent,
    function (req, res, next) {
        var addressHelpers       = require("*/cartridge/scripts/helpers/addressHelpers");
        var renderTemplateHelper = require("*/cartridge/scripts/renderTemplateHelper");
        
        var customerNo   = req.currentCustomer.profile.customerNo;
        var sortingAttr  = req.querystring.attr;
        var sortingOrder = req.querystring.order;
        
        var updatedURL  = URLUtils.url("Address-Sort", "attr", "name", "order", (sortingOrder === "asc" ? "desc" : "asc")).toString();
        var addressBook = addressHelpers.getCustomerAddressList(customerNo, sortingAttr, sortingOrder);

        res.json({
            updatedURL         : updatedURL,
            addresListTemplate : renderTemplateHelper.getRenderedHtml({
                addressBook : addressBook
            }, "account/addressList")
        });

        return next();
    }
);

module.exports = server.exports();
