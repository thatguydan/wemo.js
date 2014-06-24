var dgram = require('dgram');
var async = require('async');
var request = require('request');
var SSDP = require('node-ssdp-lite');
var url = require('url');
var xml = require('xml2js');

module.exports = function(cb) {

  var client = new SSDP;
  var found = [];

  var handleUDPResponse = function(msg, rinfo) {

    var regex = new RegExp('location: (.*?)\\r\\n','i')
    var location = regex.exec(msg.toString());
    var wemo = location && location[1] || undefined;

    if (wemo && found.indexOf(wemo)===-1) {
      found.push(wemo);
    }
  };

  var handleSearchResults = function(){
    async.map(found,wemoFinder,function(err,results) {
      cb(results.filter(function(item,index,arr) {
        return item;
      }));
    });
  };

  client.on('response',handleUDPResponse);
  client.search('ssdp:all');
  setTimeout(handleSearchResults,10000);
};

function wemoFinder(wemo,cb) {

  request(wemo,function(e,r,b) {

    xml.Parser({
            explicitRoot: false,
            explicitArray: false
        }).parseString(b, function (error, result) {

            if (error) {
                return cb(error);
            }
            else if (/WeMo Switch/g.test(b)) {
                return cb(null, { location: url.parse(wemo), info: result });
            }
            else if (/WeMo Insight/g.test(b)) {
                return cb(null, { location: url.parse(wemo), info: result });
            } else {
                return cb();
            }
        });

  });
};
