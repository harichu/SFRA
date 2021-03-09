/**
 *  Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software.
 *  Do not copy, sell, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein.
 */
var SORConstants = {

    PRODUCTCODE: 'DWORC',

    TYPE : {
        SOR  : 'SOR',
        CLUB : 'Club'
    },

    VIEWTYPE : {
        SUBSCRIPTION : 'subscription',
        ORDER        : 'order'
    },

    FEETYPE : {
        SUBSCRIPTION : 'subscription',
        ORDER        : 'order',
        PRODUCT      : 'product'
    },

    PERIODICITY : {
        MONTH : 'month',
        WEEK  : 'week'
    },

    STATUS : {
        NEW         : 'new',
        RENEW       : 'renew',
        SCHEDULED   : 'scheduled',
        UPDATED     : 'updated',
        PROCESSING  : 'processing',
        PROCESSED   : 'processed',
        PAUSED      : 'paused',
        CANCELED    : 'canceled',
        EXPIRED     : 'expired',
        CCEXPIRED   : 'cardexpired',
        OUTOFSTOCK  : 'outofstock'
    },

    PAYMENTPROCESSOR : {
        CYBERSOURCE : 'CYBERSOURCE_CREDIT'
    },

    TEXT : {
        CCEXPIRED  : 'Credit Card Expired',
        OUTOFSTOCK : 'Out of Stock'
    },

    DATE : {
        INVALID    : 'Invalid Date'
    },

    NAVIGATION : {
        ADDRESS : 'address',
        EDIT    : 'edit',
        CANCEL  : 'cancel',
        CARD    : 'card'
    }

}

module.exports = SORConstants;