'use strict';
/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
var RefillCustomerModel = require('int_smartorderrefill/cartridge/models/RefillCustomer.js'),
    sorHelper           = require('int_smartorderrefill/cartridge/scripts/SmartOrderRefillHelper.js'),
    sorConstants        = require('int_smartorderrefill/cartridge/scripts/SmartOrderRefillConstants.js'),
    Status              = require('dw/system/Status'),
    CustomerMgr         = require('dw/customer/CustomerMgr'),
    Transaction         = require('dw/system/Transaction'),
    Resource            = require('dw/web/Resource'),
    SORLogger           = dw.system.Logger.getLogger('SORLogger', 'SORLogger');

/**
 * This function gets and iterates over order schedules
 * @param {PipelineDictionary} pdict - Any vars passed by Job call
 */
exports.CreateOrders = function (pdict) {
    if (!sorHelper.verifyLicense()) {
        return new Status(Status.ERROR, null, Resource.msg('smartorderrefill.licenseinvalid','smartorderrefill',null));
    }
    SORLogger.info('Start Job. Date Override: {0}', pdict.DateOverride);
    var CustomersWithScheduledProducts = CustomerMgr.searchProfiles('custom.hasSmartOrderRefill={0}', null, true);
    SORLogger.info('Customers count to process {0}', CustomersWithScheduledProducts.getCount());
    for each (var scheduledProfile in CustomersWithScheduledProducts) {
        SORLogger.info('Process Customer: {0}', scheduledProfile.customer.profile.getCustomerNo());
        var scheduledCustomer = new RefillCustomerModel({
            customer : scheduledProfile.customer
        });

        try {
            scheduledCustomer.manageSubscriptions(pdict.DateOverride);
        } catch (e) {
            SORLogger.error('Error in orders managment(1): {0}', e.toString());
        }

        try {
            var ordersLists = scheduledCustomer.processCustomerSorOrders(pdict.DateOverride);
        } catch (e) {
            SORLogger.error('Error in orders processing: {0}', e.toString());
        }

        for each (var orderList in ordersLists) {
            try {
                if (orderList.status != sorConstants.STATUS.PROCESSING) {
                    continue;
                }

                var args = {type:'system'};
                scheduledCustomer.chargeOrderList(orderList, args);

                Transaction.wrap(function () {
                    orderList.isLastOrder = orderList.ID == ordersLists[ordersLists.length - 1].ID;
                    scheduledCustomer.setOrderProcessStatus(orderList.ID, pdict.DateOverride);
                });
            } catch (e) {
                Transaction.wrap(function () {
                    orderList.status = sorConstants.STATUS.SCHEDULED;
                });
                SORLogger.error('Error: {0} Order {1} set status SCHEDULED', e.toString(), orderList.ID);
            }
        }
        Transaction.wrap(function () {
            scheduledCustomer.saveOrders();
        });
    }

    var CustomersWithStandBySubscriptions = CustomerMgr.searchProfiles('custom.hasStandBySubscriptions={0}', null, true);
    for each (var scheduledProfile in CustomersWithStandBySubscriptions) {
        var scheduledCustomer = new RefillCustomerModel({
            customer : scheduledProfile.customer
        });

        try {
            scheduledCustomer.manageSubscriptions(pdict.DateOverride);
        } catch (e) {
            SORLogger.error('Error in orders managment(2): {0}', e.toString());
        }
    }

    return new Status(Status.OK, null, 'Process finished.');
}
