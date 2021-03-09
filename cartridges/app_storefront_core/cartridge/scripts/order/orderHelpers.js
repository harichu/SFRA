"use strict";

var formatMoney           = require("dw/util/StringUtils").formatMoney;
var Money                 = require("dw/value/Money");
var Site                  = require("dw/system/Site");
var ProductMgr            = require("dw/catalog/ProductMgr");
var StringUtils           = require("dw/util/StringUtils");
var Calendar              = require("dw/util/Calendar");
var ImageModel            = require("*/cartridge/models/product/productImages");
var instorePUstoreHelpers = require("*/cartridge/scripts/helpers/instorePickupStoreHelpers");
var OMSService            = require("*/cartridge/scripts/services/OMSService");
var Resource              = require("dw/web/Resource");
var StoreMgr              = require("dw/catalog/StoreMgr");

var currentSite        = Site.getCurrent();
var currency           = currentSite.getDefaultCurrency();
var documentApiByIdUrl = currentSite.getCustomPreferenceValue("documentByIdUrl");

var OMS_GREEN_ORDER_STATUSES  = ["Customer Picked Up", "Delivered To Customer"];
var SFCC_GREEN_ORDER_STATUSES = ["COMPLETED"];

function parseDate(omsOrderDate) {
    var tempDateString  = omsOrderDate.substring(0, 10).split("-");
    var tempTimeString  = omsOrderDate.substring(11, 19).split(":");
    var orderPlacedDate = new Date(
        tempDateString[0], tempDateString[1] - 1, tempDateString[2],
        tempTimeString[0], tempTimeString[1],     tempTimeString[2]
    );

    return orderPlacedDate;
}

function buildOrderDTO(apiOrder) {
    var shipment               = apiOrder.shipments[0];
    var address                = shipment.shippingAddress;
    var isHomeDelivery         = shipment.shippingMethod && !shipment.shippingMethod.custom.storePickupEnabled;
    var hasPrescriptionProduct = false;
    var hasSORProduct          = false;
    var pids                   = [];
    var orderPlacedDate        = new Date(apiOrder.creationDate);
    var orderPlacedDateObj     = new Calendar();

    orderPlacedDateObj.setTime(orderPlacedDate);
    orderPlacedDateObj.setTimeZone(require("dw/system/Site").getCurrent().getTimezone());

    var formattedDate = StringUtils.formatCalendar(orderPlacedDateObj, "EEEE dd/MM/YYYY · kk:mm");

    var lineItems = apiOrder.allProductLineItems.toArray().map(function (lineItem) {
        var lineItemDTO = {
            OrderedQty : lineItem.quantity.value,
            Item       : {
                ItemID : lineItem.product != null ? lineItem.product.ID : null
            }
        };

        if (lineItem.product != null) {
            pids.push(lineItem.product.ID);

            if (lineItem.product.custom.difarmaPrescriptionModel.value) {
                hasPrescriptionProduct = true;
            }

            if (lineItem.product.custom.SorProduct) {
                hasSORProduct = true;
            }

            var imageModel = new ImageModel(lineItem.product, { types: ["small"]});

            if (!empty(imageModel) && imageModel.small && imageModel.small.length > 0) {
                var productImgObj    = imageModel.small[0];
                lineItemDTO.imgUrl = productImgObj.url;
                lineItemDTO.alt    = productImgObj.alt;
                lineItemDTO.title  = lineItem.product.name;
                lineItemDTO.Brand  = lineItem.product.brand;
            }
        }

        return lineItemDTO;
    });

    var orderStatus = Resource.msg("order.sfcc.status." + apiOrder.status.displayValue.toLowerCase(), "order", null);

    var store    = isHomeDelivery ? null : StoreMgr.getStore(shipment.custom.fromStoreId);
    var orderDTO = {
        "statusDesc"             : orderStatus,
        "isDeliveredToCustomer"  : SFCC_GREEN_ORDER_STATUSES.indexOf(apiOrder.status.displayValue) !== -1,
        "CustomerEMailID"        : apiOrder.customerEmail,
        "CustomerFirstName"      : apiOrder.customerName.split(" ")[0],
        "OrderLines"             : {
            "OrderLine" : lineItems
        },
        "paymentMethodDesc"      : apiOrder.paymentInstruments[0].paymentMethod,
        "CustomerLastName"       : apiOrder.customerName.split(" ")[1],
        "OrderNo"                : apiOrder.orderNo,
        "Extn"                   : {
            "ExtnBoletaID" : ""
        },
        "rawCreationDate"        : apiOrder.creationDate,
        "FormattedDate"          : formattedDate[0].toUpperCase() + formattedDate.slice(1),
        "FormattedTotal"         : formatMoney(apiOrder.totalGrossPrice),
        "isHomeDelivery"         : isHomeDelivery,
        "hasPrescriptionProduct" : hasPrescriptionProduct,
        "hasSORProduct"          : hasSORProduct,
        "address"                : {
            "name"  : isHomeDelivery ? (address != null ? address.custom.addressIdForOMS : "") : (store != null ? store.name : ""),
            "line1" : isHomeDelivery ? (address != null ? address.address1 : "") : (store != null ? store.address1 : ""),
            "line2" : isHomeDelivery ? (address != null ? address.address2 : "") : (store != null ? store.address2 : "")
        },
        "invoiceURL"             : "",
        "pids"                   : pids,
        "pickupTime"             : "",
        "pickUpStoreLatAndLng"   : {
            "lat" : isHomeDelivery ? null : (store != null ? store.latitude : ""),
            "lng" : isHomeDelivery ? null : (store != null ? store.longitude : "")
        }
    };

    return orderDTO;
}

/**
 *
 * @param {Object} order object retrieved from OMS service;
 */
function addAttributes(order, addDetails) {
    order.rawCreationDate = parseDate(order.OrderDate);

    var firstLineItem   = order.OrderLines.OrderLine[0];
    var formattedDate   = StringUtils.formatCalendar(new Calendar(order.rawCreationDate), "EEEE dd/MM/YYYY · HH:mm");
    var formattedStatus = order.Status.toLowerCase().replace(/\s/g, "_");

    order.FormattedDate          = formattedDate[0].toUpperCase() + formattedDate.slice(1);
    order.FormattedTotal         = formatMoney(new Money(order.PriceInfo.TotalAmount, currency));
    order.isHomeDelivery         = firstLineItem.DeliveryMethod !== "PICK";
    order.statusDesc             = Resource.msg("order.oms.status." + formattedStatus, "order", null);
    order.isDeliveredToCustomer  = OMS_GREEN_ORDER_STATUSES.indexOf(order.Status) !== -1;
    order.hasPrescriptionProduct = false;
    order.hasSORProduct          = false;

    if (order.PaymentMethods &&
        order.PaymentMethods.PaymentMethod &&
        order.PaymentMethods.PaymentMethod.length > 0 &&
        order.PaymentMethods.PaymentMethod[0].PaymentType === "CREDIT_CARD") {
        order.paymentMethodDesc = Resource.msg("order.payment.credit_card", "order", null).toLowerCase();
    }

    if (firstLineItem.PersonInfoShipTo) {
        order.address = {
            name  : firstLineItem.PersonInfoShipTo.AddressID,
            line1 : firstLineItem.PersonInfoShipTo.AddressLine1,
            line2 : firstLineItem.PersonInfoShipTo.AddressLine2
        };
    }

    if (documentApiByIdUrl && order.Extn && order.Extn.ExtnBoletaID) {
        order.invoiceURL = documentApiByIdUrl + order.Extn.ExtnBoletaID;
    }

    order.pids = [];

    if (addDetails) {
        order.OrderLines.OrderLine.forEach(function (lineItem) {
            var apiProduct = ProductMgr.getProduct(lineItem.Item.ItemID);
            order.pids.push(lineItem.Item.ItemID);

            var imageModel = new ImageModel(apiProduct, { types: ["small"]});

            if (!empty(imageModel) && imageModel.small && imageModel.small.length > 0) {
                var productImgObj    = imageModel.small[0];
                lineItem.imgUrl = productImgObj.url;
                lineItem.alt    = productImgObj.alt;
                lineItem.title  = apiProduct.name;
                lineItem.Brand  = apiProduct.brand;
            }
        });
    }

    if (!order.isHomeDelivery) {
        order.pickupTime          = instorePUstoreHelpers.getPickUpInStoreDateAndTime(order.rawCreationDate);
        var pickUpTimeCalendar    = new Calendar(order.pickupTime);
        order.pickupTimeDayOfWeek = StringUtils.formatCalendar(pickUpTimeCalendar, "EEEE");
        order.pickupTimeMonth     = StringUtils.formatCalendar(pickUpTimeCalendar, "MMMM");

        if (firstLineItem.PersonInfoShipTo) {
            order.pickUpStoreLatAndLng = {
                lat: firstLineItem.PersonInfoShipTo.Latitude,
                lng: firstLineItem.PersonInfoShipTo.Longitude
            };
        }
    }
}

/**
 * Retrieves order from OMS service;
 * @param {String} orderNo
 */
function getOrder(orderNo) {
    var order = OMSService.getOrderDetails(orderNo);

    addAttributes(order, true);

    return order;
}

/**
 * Retrieves order from SFCC;
 * @param {String} orderNo
 */
function getSfccOrder(orderNo) {
    var OrderMgr = require("dw/order/OrderMgr");
    var apiOrder = OrderMgr.getOrder(orderNo);
    var orderDTO = buildOrderDTO(apiOrder);

    return orderDTO;
}

/**
* Returns a list of orders for the current customer from SFCC;
* @param {String} customerNo
* @returns {Array} - order list
* */
function getCustomerSfccOrderList(customerNo) {
    var OrderMgr = require("dw/order/OrderMgr");
    var Order    = require("dw/order/Order");

    var apiOrderList = OrderMgr.searchOrders(
        "customerNo={0} AND status!={1}",
        "creationDate desc",
        customerNo,
        Order.ORDER_STATUS_REPLACED
    );
    var result = [];

    while (apiOrderList.hasNext()) {
        var apiOrder = apiOrderList.next();
        var orderDTO = buildOrderDTO(apiOrder);

        result.push(orderDTO);
    }

    return result;
}
/**
* Returns a list of orders for the current customer from OMS service;

* @param {Object} email        customerEmail
* @param {Object} sortingAttr  sorting attribute
* @param {String} sortingOrder "asc" or "desc"
* @returns {Array} - order list
* */
function getCustomerOrderList(email, sortingAttr, sortingOrder) {
    var serviceResponse = OMSService.getCustomerOrders(email);

    if (!serviceResponse) {
        return [];
    }

    var customerOrders = serviceResponse.Output.OrderList.Order || [];
    var orders         = [];

    customerOrders.forEach(function (customerOrder) {
        addAttributes(customerOrder, false);

        orders.push(customerOrder);
    });

    if (sortingAttr) {
        var order = sortingOrder || "asc";

        orders.sort(function (item1, item2) {
            if (order === "asc") {

                if (sortingAttr === "total" && item1.PriceInfo.TotalAmount < item2.PriceInfo.TotalAmount) {
                    return -1;
                }

                if (sortingAttr === "date" && item1.rawCreationDate.getTime() < item2.rawCreationDate.getTime()) {
                    return -1;
                }

                return 1;
            } else if (order === "desc") {
                if (sortingAttr === "total" && item1.PriceInfo.TotalAmount > item2.PriceInfo.TotalAmount) {
                    return -1;
                }

                if (sortingAttr === "date" && item1.rawCreationDate.getTime() > item2.rawCreationDate.getTime()) {
                    return -1;
                }

                return 1;
            }
        });
    }

    return orders;
}

/**
* Returns a list of orders for the current customer from OMS service;
* @param {Object} req - current request
* @returns {Order} - order list
* */
function getApiOrderSecurily(req) {
    var OrderMgr = require("dw/order/OrderMgr");
    var order = null;

    if (!empty(req) && "querystring" in req && "currentCustomer" in req) {
        order = OrderMgr.getOrder(req.querystring.ID);

        if (!order || order.customer.ID !== req.currentCustomer.raw.ID || order.getUUID() !== req.querystring.UUID) {
            return null;
        }
    }

    return order;
}

module.exports = {
    getOrder                 : getOrder,
    getCustomerOrderList     : getCustomerOrderList,
    getSfccOrder             : getSfccOrder,
    getCustomerSfccOrderList : getCustomerSfccOrderList,
    getApiOrderSecurily      : getApiOrderSecurily
};
