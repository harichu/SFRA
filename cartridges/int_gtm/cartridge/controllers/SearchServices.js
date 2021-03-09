/** DISCLAIMER
* "Property of OSF Global Services, Inc., (with its brand OSF Commerce). OSF remains the sole owner of all right, title and interest in the software. 
* Do not copy, reverse engineer or otherwise attempt to derive or obtain information about the functioning, manufacture or operation therein."
*/

"use strict";

const server = require("server");
const gtmHelper = require("*/cartridge/scripts/gtm");

server.extend(module.superModule);

server.append("GetSuggestions", function (req, res, next) {
    if (!res.view) {
        res.json({
            gtm_data : gtmHelper.gtmEventData("searchSearchBar", req.querystring.q, req.path)
        });
    }

    next();
});

module.exports = server.exports();
