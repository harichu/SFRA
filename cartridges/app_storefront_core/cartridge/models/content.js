"use strict";

var base = module.superModule;
/**
 * Extending Content model to add custom attributes
 */
function content(contentValue, renderingTemplate) {
    var model = base.call(this, contentValue, renderingTemplate);
    model.custom = contentValue.custom;
    return model;
}

module.exports = content;
