"use strict";

function sortOptionsAlphabetically($select) {
    var $options    = $select.find("option");
    var optionArray = $options.map(function (_, option) {
        return {
            text  : $(option).text(),
            value : option.value,
            isSelected: $(option).prop("selected")
        };
    }).get();

    optionArray.sort(function (option1, option2) {
        // Does not order an empty option ("Select...");
        if (!option1.value) {
            return -1;
        }
        if (!option2.value) {
            return 1;
        }

        return option1.text > option2.text ? 1  :
            option1.text < option2.text    ? -1 :
                0;
    });

    $options.each(function (i, option) {
        option.value = optionArray[i].value;
        $(option).text(optionArray[i].text);
        $(option).prop("selected", optionArray[i].isSelected);
    });
}

function removeDiacritics(str) {
    var map = {
        "a" : "á|à|ã|â",
        "A" : "À|Á|Ã|Â",
        "e" : "é|è|ê",
        "E" : "É|È|Ê",
        "i" : "í|ì|î",
        "I" : "Í|Ì|Î",
        "o" : "ó|ò|ô|õ",
        "O" : "Ó|Ò|Ô|Õ",
        "u" : "ú|ù|û|ü",
        "U" : "Ú|Ù|Û|Ü",
        "c" : "ç",
        "C" : "Ç",
        "n" : "ñ",
        "N" : "Ñ"
    };

    for (var char in map) {
        str = str.replace(new RegExp(map[char], "g"), char);
    }

    return str;
}

/**
 * @function
 * @description creates a mutation observer
 * @param {targetNode} target The DOM element to be observed
 * @param {callbackFunc} function The callback function to be executed
 */

function createObserver(target, callbackFunc) {
    var targetNode = target;
    var config = { attributes: true, childList: true, subtree: true };
    var callback = function (mutationsList, observer) {
        mutationsList.forEach(function (mutation) {
            if (mutation.type === "childList") {
                observer.disconnect();
                callbackFunc();
            }
        });
    };
    var observer = new MutationObserver(callback);
    observer.observe(targetNode, config);
}

module.exports.sortOptionsAlphabetically = sortOptionsAlphabetically;
module.exports.removeDiacritics = removeDiacritics;
module.exports.createObserver = createObserver;
