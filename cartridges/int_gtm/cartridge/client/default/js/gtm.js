/** DISCLAIMER
* "Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software. 
* Do not copy, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein."
*/

"use strict";
var lo = require("lodash");
let liveClick = [];

class GTMController {
    /**
     * function to push data to the dataLayer, and add hash
     * @param {Object} data - data to push
     */
    static hashPush(data) {
        if (data) {
            if (data.eventTypes) {
                delete data.eventTypes;
            }
            if ((location.hash.indexOf(data.event + "gtm") == -1)) {
                dataLayer.push(data);
            }
        }
    }

    /**
     * Parse the data object into json
     * @param {String} data
     * @returns {Object} jsonObject
     */
    static parseJSON(data) {
        let parsedJson = {};
        try {
            parsedJson = JSON.parse(data);
        } catch (error) {
            parsedJson = JSON.parse(data.replace(/'/gi, "\"").replace(/\\"/, "'"));
        }
        if (parsedJson !== null && typeof parsedJson.label !== "undefined" && parsedJson.label.length == 0) {
            parsedJson.label = window.location.href;
        }
        return parsedJson;
    }
    /**
     * check data type and parse string into JSON
     * @param {Object} data - data to push
     */
    static dataPush(data) {
        if ((typeof(data) === "string") && (data != "")) {
            if ((data != null) || (data != "null")) {
                data = GTMController.parseJSON(lo.unescape(data));
                GTMController.hashPush(data);
            }
        } else {
            GTMController.hashPush(data);
        }
    }

    /**
     * find, parse and add to dataLayer data-gtm from all tags in node
     * @param {Object} node - DOM node, inside which will be search
     */
    static findAllDataDOM(node) {
        let allGTMData = node.querySelectorAll("[data-gtm]"),
            impressionsContainer = [],
            dataCollectionObj = {};

        if (!allGTMData.length) {
            return false;
        }

        for (let i = 0; i < allGTMData.length; i++) {
            let tempNode = allGTMData[i];
            dataCollectionObj = GTMController.parseJSON(tempNode.getAttribute("data-gtm"));

            if (!dataCollectionObj || !dataCollectionObj.eventTypes || !dataCollectionObj.event) {
                continue;
            }

            let eventTypes = dataCollectionObj.eventTypes.split(",");

            if (eventTypes.indexOf("show") != -1) {
                if (dataCollectionObj.event.indexOf("show") == -1) {
                    dataCollectionObj.event = "show" + dataCollectionObj.event;
                }
                var currentTagObj = dataCollectionObj.ecommerce && dataCollectionObj.ecommerce.impressions;
                if (currentTagObj && dataCollectionObj.event == "showImpressionsUpdate") {
                    var isAlreadyAdded = false;
                    
                    for (let i = 0; i < impressionsContainer.length; i++) {
                        var tagObj = impressionsContainer[i];

                        if (tagObj.id === currentTagObj.id) {
                            isAlreadyAdded = true;
                            break;
                        }   
                    }

                    if (!isAlreadyAdded) {
                        impressionsContainer.push(currentTagObj);
                    }
                } else {
                    GTMController.dataPush(dataCollectionObj);
                }
                tempNode.removeAttribute("data-gtm");
            }
        }

        if (impressionsContainer.length > 0) {
            let dataLayerObj = {
                "event" : "showImpressionsUpdate",
                "ecommerce": {}
            };
            dataLayerObj.ecommerce.impressions = impressionsContainer;
            GTMController.dataPush(dataLayerObj);
        }
    }

    /**
     *  if 'link' option enable, set same 'data-gtm' to all node childNodes,
     *  to have the same event in clickListenerRun and hoverListenerRun
     */
    static handleLinks(node) {
        const allGTMData = node.querySelectorAll("[data-gtm]");

        if (!allGTMData.length) {
            return false;
        }

        function setChildData(childs, data) {
            for (let i = 0; i < childs.length; i++) {
                if (childs[i].nodeType == 1) {
                    if (childs[i].getAttribute("data-gtm")) continue;
                    childs[i].setAttribute("data-gtm", data);
                    if (childs[i].childNodes.length) {
                        setChildData(childs[i].childNodes, data);
                    }
                }
            }
        }

        for (let i = 0; i < allGTMData.length; i++) {
            let tempNode = allGTMData[i];
            const dataStr = tempNode.getAttribute("data-gtm"),
                dataObj = GTMController.parseJSON(dataStr);

            if (!dataObj) continue;

            if (typeof dataObj.eventTypes !== "undefined" && dataObj.eventTypes.indexOf("link") != -1) {
                if (tempNode.childNodes.length) {
                    setChildData(tempNode.childNodes, dataStr);
                }
            }

            if (typeof dataObj.eventTypes !== "undefined" && dataObj.eventTypes.indexOf("add") != -1) {
                let dynamicNodes = document.querySelectorAll(dataObj.selector);
                if (dynamicNodes.length) {
                    for (let j = 0; j < dynamicNodes.length; j++) {
                        let tempDynamicNode = dynamicNodes[j];
                        let dataObj = GTMController.parseJSON(dataStr);
                        let eventTypes = dataObj.eventTypes.split(",");
                        eventTypes.splice(eventTypes.indexOf("add"), 1);
                        dataObj.eventTypes = eventTypes.join(",");
                        tempDynamicNode.setAttribute("data-gtm", JSON.stringify(dataObj));
                    }
                    tempNode.removeAttribute("data-gtm");
                }
            }
        }
    }

    /**
     * run AJAX listener, to find all (gtm_data in JSON) or (gtm-data in HTML) sent via XMLHttpRequest
     */
    static AJAXListenerRun() {
        var listenerSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function () {
            var callback = this.onreadystatechange;
            this.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 200) {
                    if (this.getAllResponseHeaders().indexOf("application/json") != -1) {
                        var myArr = GTMController.parseJSON(this.responseText);
                        if (myArr.gtm_data) {
                            GTMController.dataPush(myArr.gtm_data);
                        }
                    }

                    if (this.getAllResponseHeaders().indexOf("text/html") != -1) {
                        var container = document.implementation.createHTMLDocument("").documentElement;
                        container.innerHTML = this.responseText;
                        GTMController.findAllDataDOM(container);
                    }
                }
                if (callback) {
                    callback.apply(this, arguments);
                }
            };
            listenerSend.apply(this, arguments);
        };
    }

    //run DOM updates listener, to find all gtm-data added to DOM
    static DOMListenerRun() {
        let observer = new MutationObserver(function (mutationsList, observer) {
            GTMController.handleLinks(document);
        });
        const targetNode = document.body,
            config     = {childList: true, subtree: true};
        observer.observe(targetNode, config);
    }


    static scrollListenerRun() {
        let scrollGrad = [0, 25, 50, 75, 100],
            currentGrad = 0,
            prevPct = 0;

        function pushScrollData(dir, pct) {
            if (pct == 0 && dir == "down") return;
            if (pct == 100 && dir == "up") return;
            let data = {};
            data.event = "Scroll";
            data.direction = dir;
            data.percentage = pct;
            GTMController.dataPush(data);
        }

        window.onscroll = function () {
            const rect = document.documentElement.getBoundingClientRect(),
                percentage = 100 * (Math.abs(rect.top)) / (rect.height - window.innerHeight),
                pctScrolled = percentage === Infinity ? 0 : Math.round(percentage);

            if (pctScrolled > prevPct) {
                if (pctScrolled >= scrollGrad[currentGrad]) {
                    pushScrollData("down", scrollGrad[currentGrad]);
                    if (currentGrad + 1 < scrollGrad.length) {
                        currentGrad++;
                    }
                }
                prevPct = pctScrolled;
            }

            if (pctScrolled < prevPct) {
                if (pctScrolled <= scrollGrad[currentGrad]) {
                    pushScrollData("up", scrollGrad[currentGrad]);
                    if (currentGrad - 1 >= 0) {
                        currentGrad--;
                    }
                }
                prevPct = pctScrolled;
            }
        };
    }

    static clickListenerRun() {
        let allContainers = document.querySelectorAll("body,.container");
        for (let i = 0; i < allContainers.length; i++) {
            let tempNode = allContainers[i];
            tempNode.addEventListener("click", function (event) {
                if (event && event.target && event.target.getAttribute("data-gtm")) {
                    let node = event.target,
                        data = GTMController.parseJSON(node.getAttribute("data-gtm"));
                    if (data.eventTypes.indexOf("click") != -1) {

                        data.event = "click" + lo.upperFirst(data.event);
                        if (!data.action) {
                            data.action = "click";
                        }

                        if (liveClick.indexOf(data.event) == -1) {
                            liveClick.push(data.event);
                            setTimeout(function () {
                                liveClick.splice(liveClick.indexOf(data.event), 1);
                            }, 10);
                        } else {
                            return;
                        }
                        GTMController.dataPush(data);
                    }
                }
            });
        }
    }

    static changeListenerRun() {
        document.addEventListener("change", function (event) {
            if (event && event.target && event.target.getAttribute("data-gtm")) {
                let node = event.target,
                    data = GTMController.parseJSON(node.getAttribute("data-gtm"));

                if (data.eventTypes.indexOf("change") != -1) {
                    data.event = "change" + lo.upperFirst(data.event);
                    data.action = node.value;
                    if (typeof node.attributes["type"] !== "undefined" && node.attributes["type"]["nodeValue"] == "checkbox") {
                        data.action = node.checked ? "checked" : "unchecked";
                    }
                    if (!data.action) {
                        data.action = "change";
                    }

                    GTMController.dataPush(data);
                }
            }
        });
    }

    static hoverListenerRun() {
        let timeout = null;
        document.addEventListener("mouseover", function (event) {
            if (event && event.target && event.target.getAttribute("data-gtm")) {
                const hoverDelay = 1000; // delay for hover event (ms)
                let node = event.target,
                    data = GTMController.parseJSON(node.getAttribute("data-gtm")),
                    defaultEventName = data.event;
                if (data.eventTypes.indexOf("hover") != -1) {
                    timeout = setTimeout(function () {
                        data.event = "hover" + lo.upperFirst(defaultEventName);
                        if (!data.action) {
                            data.action = "hover";
                        }
                        GTMController.dataPush(data);
                    }, hoverDelay);
                }
            }
        });

        document.addEventListener("mouseout", function (event) {
            if (event && event.target && event.target.getAttribute("data-gtm")) {
                clearTimeout(timeout);
            }
        });
    }
}

/**
 * initial gtm-data search and dataLayer push on page
 * AJAX listener run
 */

document.addEventListener("DOMContentLoaded", function (event) {
    GTMController.findAllDataDOM(document);
    GTMController.AJAXListenerRun();
    GTMController.DOMListenerRun();

    if (gtmSitePreferences.GTM_CLICK) {
        GTMController.clickListenerRun();
        GTMController.changeListenerRun();
    }

    if (gtmSitePreferences.GTM_HOVER) {
        GTMController.hoverListenerRun();
    }

    if (gtmSitePreferences.GTM_SCROLL) {
        GTMController.scrollListenerRun();
    }
});
