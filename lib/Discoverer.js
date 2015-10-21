var async = require('async');
var request = require('request');
var SSDP = require('node-ssdp').Client;
var url = require('url');
var xml = require('xml2js');

module.exports = Discoverer;

function Discoverer() {
    var _this = this;
    this.client = new SSDP();
    this.found = [];

    this.client.on('response', handleUDPResponse);

    this.handleSearchResults = function(cb) {
        async.map(_this.found, wemoFinder, function (err, results) {
            cb(results.filter(function (item, index, arr) {
                return item;
            }));
        });
    }

    function handleUDPResponse (headers, statusCode, rinfo) {
        var regex = /^(?:.*)setup[.]xml$/;
        if (headers.LOCATION && regex.test(headers.LOCATION)) {
            var wemo = headers.LOCATION || undefined;
            if (wemo && _this.found.indexOf(wemo) === -1)
                _this.found.push(wemo);
        }
    }

    function wemoFinder(wemo, cb) {
        request(wemo, function (e, r, b) {
            if (!b)
                return cb();
            xml.Parser({
                explicitRoot: false,
                explicitArray: false
            }).parseString(b, function (error, result) {
                if (error)
                    return cb(error);
                else if (/WeMo Switch/g.test(b))
                    return cb(null, { location: url.parse(wemo), info: result });
                else if (/WeMo Insight/g.test(b))
                    return cb(null, { location: url.parse(wemo), info: result });
                else if (/WeMo LightSwitch/g.test(b))
                    return cb(null, { location: url.parse(wemo), info: result });
                else if (/CoffeeMaker/g.test(b))
                    return cb(null, { location: url.parse(wemo), info: result });
                else
                    return cb();
            });

        });
    };
}

Discoverer.prototype.discover = function (cb) {
    this.client.search('upnp:rootdevice');
    setTimeout(this.handleSearchResults, 10000, cb);
}