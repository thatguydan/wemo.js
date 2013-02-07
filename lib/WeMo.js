var util         = require('util');
var request      = require('request');
var EventEmitter = require('events').EventEmitter;
var dgram        = require('dgram');
var xml          = require('libxml-to-js');

module.exports = WeMo;
util.inherits(WeMo,EventEmitter);

var SOAPPAYLOAD = ['<?xml version="1.0" encoding="utf-8"?>'
  , '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
  , ' <s:Body>'
  , '  <u:%s xmlns:u="urn:Belkin:service:basicevent:1">'
  , '   <BinaryState>%s</BinaryState>'
  , '  </u:%s>'
  , ' </s:Body>'
  , '</s:Envelope>'].join('\n');

function WeMo(host) {

  EventEmitter.call(this);
  if (!host) throw new Error("Invalid Parameters to WeMo")
  this._host = host;
};


WeMo.prototype.on = function(cb) {

  var payload = util.format(SOAPPAYLOAD,'SetBinaryState',1,'SetBinaryState')

  var opts = {
    method:"POST",
    body:payload,
    headers:{
      'Content-Type':'text/xml; charset="utf-8"',
      'SOAPACTION':'"urn:Belkin:service:basicevent:1#SetBinaryState"',
      'Content-Length':payload.length
    },
    uri:'http://'+this._host+'/upnp/control/basicevent1',
  };

  request(opts,cb);
};

WeMo.prototype.off = function(cb) {

  var payload = util.format(SOAPPAYLOAD,'SetBinaryState',0,'SetBinaryState')

  var opts = {
    method:"POST",
    body:payload,
    headers:{
      'Content-Type':'text/xml; charset="utf-8"',
      'SOAPACTION':'"urn:Belkin:service:basicevent:1#SetBinaryState"',
      'Content-Length':payload.length
    },
    uri:'http://'+this._host+'/upnp/control/basicevent1',
  };

  request(opts,cb);
};

WeMo.prototype.state = function(cb) {

  var payload = util.format(SOAPPAYLOAD,'GetBinaryState','','GetBinaryState')

  var opts = {
    method:"POST",
    body:payload,
    headers:{
      'Content-Type':'text/xml; charset="utf-8"',
      'SOAPACTION':'"urn:Belkin:service:basicevent:1#GetBinaryState"',
      'Content-Length':payload.length
    },
    uri:'http://'+this._host+'/upnp/control/basicevent1',
  };

  request(opts,function(e,r,b) {
    xml(b, function (error, result) {

      if (error) {
        return cb(error);
      }
      try {
        var state = result['s:Body']['u:GetBinaryStateResponse'].BinaryState
      } catch (err) {
        var error = {error:'Unkown Error'}
      }
      cb(error||null,parseInt(state));
    });
  });
};