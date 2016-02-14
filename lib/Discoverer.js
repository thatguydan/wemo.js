var async = require('async');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var SSDP = require('node-ssdp').Client;
var url = require('url');
var util = require('util');
var xml = require('xml2js');

module.exports = Discoverer;
util.inherits(Discoverer,EventEmitter);

function Discoverer() {
    EventEmitter.call(this);
    
    this.client = new SSDP();
    this.found = {};
    
    this.client.on('response', handleUDPResponse.bind(this));
    
    function handleUDPResponse (headers, statusCode, rinfo) {
        // Ignore devices that don't match the WeMo LOCATION pattern
        if (!headers.LOCATION || !/^(?:.*)setup[.]xml$/.test(headers.LOCATION))
            return;
            
        // Ensure headers to get unique identifier
        if (!headers.ST || !headers.USN)
            return;

        var idRegex = new RegExp('^(uuid:.+)::' + headers.ST + '$');
        var match = headers.USN.match(idRegex);
        // Cannot extract identifier from USN
        if (!match)
            return;
            
        var identifier = match[1];
        if (this.found[identifier]) {
            if (this.found[identifier].location.hostname == rinfo.address)
                 return;
            console.log('ip changed', identifier);
            // Wemo has changed IP address since last discovery 
            this.found[identifier].location = url.parse(headers.LOCATION);
            this.emit('ipchange', { identifier: identifier, ip: this.found[identifier].location });
            return;
        }
        
        var discoveryData = {
            identifier: identifier,
            location: url.parse(headers.LOCATION)
        };
        this.found[identifier] = discoveryData;
        if (!this.found[identifier].info)
            getDescription.bind(this)(identifier);
    }
    
    function getDescription(identifier) {
        request(this.found[identifier].location.href, function (e, r, b) {
            if (!b)
                return;
            xml.Parser({ explicitRoot: false, explicitArray: false })
                .parseString(b, function (error, result) {
                    if (error)
                        return;
                    var valid = [/WeMo Switch/g, /WeMo Insight/g, /WeMo LightSwitch/g, /CoffeeMaker/g];
                    if (valid.some(function(pattern) { return pattern.test(b); })) {
                        this.found[identifier].info = result;
                        this.emit('discovered', this.found[identifier]);
                    }
                }.bind(this));
        }.bind(this));
    }
}

Discoverer.prototype.discover = function () {
    this.client.search('urn:Belkin:service:basicevent:1');
}