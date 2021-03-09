"use strict";

var server = require("server");

var Resource = require("dw/web/Resource");
var URLUtils = require("dw/web/URLUtils");
var Site = require("dw/system/Site");
var emailHelper = require("*/cartridge/scripts/helpers/emailHelpers");
var validation = require("*/cartridge/scripts/contactUs/validation");
var csrfProtection = require("*/cartridge/scripts/middleware/csrf");

/**
 * Send a feedback to the customerService with jobOffer
 * @param {Object} form - form used to fill feedback template
 * @param {String} subjectType - subject from resources
 * @param {String} formType - type of form that was filled (bodegueros, estudiantes, etc)
 */
function Email(form, subjectType, formType) {
    var jobOfferEmailLists = Site.current.getCustomPreferenceValue("jobOfferEmailLists");
    var emailList = !empty(jobOfferEmailLists) ? JSON.parse(jobOfferEmailLists) : null;
    var to = !empty(emailList) && formType in emailList ? emailList[formType] : Site.current.getCustomPreferenceValue("customerServiceEmailTo");
    var resourceName = (formType === "bodeguero" || formType === "auxiliar") ? subjectType + "." + formType : subjectType;
    var emailObject = {
        to: to,
        from: Site.current.getCustomPreferenceValue("customerServiceEmail"),
        subject: Resource.msg(resourceName, "jobOffer", null)
    };
    emailHelper.send(emailObject, "mail/feedback", {form: form});
}

/**
 * Gets the universities to be used on the job offer form.
 * @return {Array.<Object>} An array of selectors for universities.
 */
function getUniversitiesSelectors() {
    var universities = Site.current.getCustomPreferenceValue("Universities");
    var selectors = [{
        name: Resource.msg("label.input.jobOffer.university.option.placeholder", "jobOffer", null),
        value: ""
    }];
    for (var i = 0; i < universities.length; i++) {
        selectors.push({
            name: universities[i],
            value: universities[i]
        });
    }
    selectors.push({
        name: Resource.msg("label.input.jobOffer.university.option.other", "jobOffer", null),
        value: "other"
    });

    return selectors;
}

/**
 * Obtains the academic years to be used in the job offer form.
 * @return {Array.<Object>} An array of selectors for academic years.
 */
function getAcademicYearSelectors() {
    var academic = Site.current.getCustomPreferenceValue("AcademicYear");
    var selectors = [{
        name: Resource.msg("label.input.jobOffer.academicYear.option.placeholder", "jobOffer", null),
        value: ""
    }];
    for (var i = 0; i < academic.length; i++) {
        selectors.push({
            name: Resource.msgf("label.input.jobOffer.academicYear.option.year", "jobOffer", null, academic[i]),
            value: academic[i]
        });
    }
    selectors.push({
        name: Resource.msg("label.input.jobOffer.academicYear.option.other", "jobOffer", null),
        value: "other"
    });

    return selectors;
}

server.get("Show", csrfProtection.generateToken, function (req, res, next) {
    var formType = req.querystring.formType;

    res.render("jobOffer/jobOffer", {
        actionUrl: URLUtils.url("JobOffer-Subscribe", "formType", formType).toString(),
        formType: formType
    });
    next();
});

server.post("Subscribe", server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    var errors = validation.validate(req.form);
    var formType = req.querystring.formType;

    if (empty(errors)) {
        Email(req.form, "email.subject", formType);
        res.json({
            success: true,
            msg: Resource.msg("subscribe.to.contact.us.success", "contactUs", null)
        });
    } else {
        res.json({
            msg: Resource.msg("subscribe.to.contact.us.email.invalid", "contactUs", null),
            fields: errors
        });
    }
    next();
});

server.post("Validate", server.middleware.https, function (req, res, next) {
    var errors = validation.validateFilledFields(req.form);
    res.json({
        fields: errors
    });
    next();
});

server.get("Trainee", csrfProtection.generateToken, function (req, res, next) {
    res.render("jobOffer/jobOfferTrainee", {
        actionUrl: URLUtils.url("JobOffer-SubscribeTrainner").toString(),
        universities: getUniversitiesSelectors(),
        academicYears: getAcademicYearSelectors()
    });
    next();
});

server.post("SubscribeTrainner", server.middleware.https, csrfProtection.validateAjaxRequest, function (req, res, next) {
    var errors = validation.validate(req.form);
    var formType = "estudiante";

    if (empty(errors)) {
        Email(req.form, "email.subject.trainee", formType);
        res.json({
            success: true,
            msg: Resource.msg("subscribe.to.contact.us.success", "contactUs", null)
        });
    } else {
        res.json({
            msg: Resource.msg("subscribe.to.contact.us.email.invalid", "contactUs", null),
            fields: errors
        });
    }
    next();
});

module.exports = server.exports();
