"use strict";var CustomObjectMgr=require("dw/object/CustomObjectMgr"),LocalServiceRegistry=require("dw/svc/LocalServiceRegistry"),Logger=require("dw/system/Logger"),Site=require("dw/system/Site"),Transaction=require("dw/system/Transaction"),Resource=require("dw/web/Resource"),OSFLicenseConstants=require("~/cartridge/scripts/utils/licenseConstants"),serviceDefinitions=require("~/cartridge/scripts/utils/licenseServiceDefinitions");function verifyLicenseActivation(e){var t={is_avkey:e.activationKey,is_pcid:e.pcID,is_productid:e.productID,is_majorversion:1,is_minorversion:0,is_vendor:"fastspring"};return LocalServiceRegistry.createService(OSFLicenseConstants.OSF_SERVICE.ACTIVATION_ID,serviceDefinitions.verifyLicenseActivation).call(t).object}function verifyLicenseValidity(e){var t=Site.current,i=e,s=!1,c=!0,r={is_activate:!1,is_avkey:i.custom.activationKey,is_email:i.custom.email,is_pcid:i.custom.pcID},o=LocalServiceRegistry.createService(OSFLicenseConstants.OSF_SERVICE.BM_ID,serviceDefinitions.retrieveLicenseInformation).call(r).object;if(!empty(o)&&o.success)o.statusCode===OSFLicenseConstants.OSF_SERVICE.TRIAL_CODE||o.statusCode===OSFLicenseConstants.OSF_SERVICE.PERMANENT_CODE?s=!0:o.statusCode===OSFLicenseConstants.OSF_SERVICE.REVOKED_CODE?s=!1:c=!1;else{s=!0;var n=empty(o)?Resource.msg("license.unknownerror","license",null):o.faultString.toString();Logger.error(Resource.msgf("license.exception","license",null,r.productCode,n)),Transaction.wrap(function(){var e=CustomObjectMgr.createCustomObject("OSFLicenserEmails",i.custom.activationKey);e.custom.email=i.custom.email,e.custom.productName=i.custom.productName,e.custom.siteID=i.custom.siteID,e.custom.expiryDate=i.custom.expiryDate,e.custom.action="servicefail",e.custom.hostName=t.httpsHostName})}if(c){var a=new Date;Transaction.wrap(function(){i.custom.validationDateKey=a.getTime(),i.custom.isValid=s,i.custom.expiryDate=empty(o)?OSFLicenseConstants.EXPIRY_DATE.NONE:o.expiryDate})}}function installLicense(e){var t,i,s=Site.current,c=e.productCode+s.httpsHostName+s.ID,r={is_activate:!1,is_avkey:e.activationKey,is_pcid:e.pcID,is_productid:e.productID},o=verifyLicenseActivation(e),n=LocalServiceRegistry.createService(OSFLicenseConstants.OSF_SERVICE.BM_ID,serviceDefinitions.defineInstallationUniqueID);if((o.success||!empty(o.registeredComputerID)&&o.registeredComputerID===e.pcID||"214"===o.errorCode)&&(t=n.call(r).object),!empty(t)&&t.success)return Transaction.wrap(function(){(i=CustomObjectMgr.createCustomObject(OSFLicenseConstants.CUSTOM_OBJECT_TYPE,c)).custom.isInstalled=!0,i.custom.productName=e.productName,i.custom.productCode=e.productCode,i.custom.productID=e.productID,i.custom.activationKey=e.activationKey,i.custom.email=e.email,i.custom.pcID=e.pcID,i.custom.siteID=s.ID,i.custom.expiryDate=t.expiryDate,i.custom.validationDateKey=0}),verifyLicenseValidity(i),i;var a=(t||o||{}).error||Resource.msg("license.unknownerror","license",null);throw new Error(Resource.msgf("license.exception","license",null,e.productCode,a))}exports.verifyLicenseValidity=verifyLicenseValidity,exports.installLicense=installLicense;