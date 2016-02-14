var util         = require('util');
var request      = require('request');
var EventEmitter = require('events').EventEmitter;
var http         = require('http');
var os           = require('os');
var xml          = require('xml2js');

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

  var _this = this;
  if (!host) throw new Error("Invalid Parameters to WeMo");
  this._host = host;

  var eventServer = http.createServer(handleEventNotification);
  var subids = {};
  var subscriptionTimeout = 600;

  this.notificationPort = 3500;
  this._localAddress = null;

  // Determine local ip for subscription hooks
  var ips = [];
  var interfaces = os.networkInterfaces();
  for (var name in interfaces) {
    if (!/(loopback|vmware|internal)/gi.test(name)) {
      for (var key in interfaces[name]) {
        var ipInfo = interfaces[name][key];
        if (!ipInfo.internal && ipInfo.family == 'IPv4')
          ips.push(ipInfo.address);
      }
    }
  }
  this._localAddress = ips[0];

  eventServer.on('error', function(e) {
    if (e.code == 'EADDRINUSE')
      startServerOnPort(++_this.notificationPort);
    else
      console.log('listen error: ' + e.toString());
  });

  eventServer.on('listening', function() {
    subscribe('/upnp/event/basicevent1');
  });

  function handleEventNotification(req, res) {
    var buffer = [];
    res.statusCode = 200;
    req.setEncoding('utf-8');
    req.on('data', function(chunk) {
      buffer.push(chunk);
    });
    req.on('end', function() {
      res.end();
      var message = buffer.join('');
      xml.Parser({
        explicitRoot: false,
        explicitArray: false
      }).parseString(message, function (error, result) {
        if (error)
          return;
        var data = {};
        var property = result['e:property'];
        if (property.hasOwnProperty('BinaryState')) {
          data.state = result['e:property'].BinaryState;
          _this.emit('state', data);
        } else if (property.hasOwnProperty('attributeList')) {
          var attListValue = '<attributeList>' + result['e:property'].attributeList.replace(/[&]lt;/gi, '<').replace(/[&]gt;/gi, '>') + '</attributeList>';
          xml.Parser({ explicitRoot: false, explicitArray: false }).parseString(attListValue, function (error, result) {
            if (error)
              return;
            if (result.hasOwnProperty('attribute')) {
              if (Array.isArray(result.attribute)) {
                for (var i in result.attribute) {
                  if (result.attribute[i].name == 'Mode')
                    data.mode = result.attribute[i].value
                }
                _this.emit('mode', data);
              } else if (result.attribute.name == 'Mode') {
                _this.emit('mode', { mode: result.attribute.value });
              }
            }
          });
        }
      });
    });
  }

  function startServerOnPort(port) {
    eventServer.listen(port);
  }

  function subscribe(path) {
    var headers = {
      'TIMEOUT': 'Second-' + subscriptionTimeout
    };

    if (subids[path])
      headers['SID'] = subids[path];
    else {
      headers['CALLBACK'] = '<http://' + _this._localAddress + ':' + _this.notificationPort + '>';
      headers['NT'] = 'upnp:event';
    }

    var opts = {
      headers: headers,
      method: 'SUBSCRIBE',
      uri: 'http://' + _this._host + path
    };
    request(opts, function(e,r,b) {
      if (e) {
        console.log('error', e);
        return;
      }
      
      subids[path] = r.headers.sid;
      if (r.statusCode == 200)
        setTimeout(function() { subscribe(path); }, subscriptionTimeout * 500);
      else {
        delete subids[path];
        setTimeout(function() { subscribe(path); }, 30000);
      }
    });
  }

  startServerOnPort(this.notificationPort);
};


WeMo.prototype.switchOn = function(cb) {

  var payload = util.format(SOAPPAYLOAD,'SetBinaryState',1,'SetBinaryState')

  var opts = {
    method:"POST",
    body:payload,
    headers:{
      'Content-Type':'text/xml; charset="utf-8"',
      'SOAPACTION':'"urn:Belkin:service:basicevent:1#SetBinaryState"',
      'Content-Length':payload.length
    },
    uri:'http://'+this._host+'/upnp/control/basicevent1'
  };

  request(opts,cb);
};

WeMo.prototype.switchOff = function(cb) {

  var payload = util.format(SOAPPAYLOAD,'SetBinaryState',0,'SetBinaryState')

  var opts = {
    method:"POST",
    body:payload,
    headers:{
      'Content-Type':'text/xml; charset="utf-8"',
      'SOAPACTION':'"urn:Belkin:service:basicevent:1#SetBinaryState"',
      'Content-Length':payload.length
    },
    uri:'http://'+this._host+'/upnp/control/basicevent1'
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
    uri:'http://'+this._host+'/upnp/control/basicevent1'
  };

  request(opts,function(e,r,b) {
    if(!b)
        return cb();
    xml.Parser({
        explicitRoot: false,
        explicitArray: false
      }).parseString(b, function (error, result) {
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

WeMo.prototype.getAttributes = function (cb) {
    var payload = ['<?xml version="1.0" encoding="utf-8"?>'
        , '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">'
        , ' <s:Body>'
        , '  <u:GetAttributes xmlns:u="urn:Belkin:service:deviceevent:1"></u:GetAttributes>'
        , ' </s:Body>'
        , '</s:Envelope>'].join('\n');

    var opts = {
        method: "POST",
        body: payload,
        headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPACTION': '"urn:Belkin:service:deviceevent:1#GetAttributes"',
            'Content-Length': payload.length
        },
        uri: 'http://' + this._host + '/upnp/control/deviceevent1'
    };

    request(opts, function (e, r, b) {
        if (!b)
            return cb();
        xml.Parser({
            explicitRoot: false,
            explicitArray: false
        }).parseString(b, function (error, result) {
            if (error)
                return cb(error);
            if (result['s:Body']['s:Fault'])
                cb({ error: result['s:Body']['s:Fault'].detail });
            else {
                var state = result['s:Body']['u:GetAttributesResponse'].attributeList.replace(/[&]lt;/gi, '<').replace(/[&]gt;/gi, '>');
                xml.Parser({ explicitRoot: false, explicitArray: false }).parseString(state, function (error, result) {
                    cb(error || null, result);
                });
            }

        });
    });
};

WeMo.prototype.brew = function (cb) {
    var payload = '<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:SetAttributes xmlns:u="urn:Belkin:service:deviceevent:1"><attributeList>&lt;attribute&gt;&lt;name&gt;Mode&lt;/name&gt;&lt;value&gt;4&lt;/value&gt;&lt;/attribute&gt;&lt;attribute&gt;&lt;name&gt;ModeTime&lt;/name&gt;&lt;value&gt;NULL&lt;/value&gt;&lt;/attribute&gt;&lt;attribute&gt;&lt;name&gt;TimeRemaining&lt;/name&gt;&lt;value&gt;NULL&lt;/value&gt;&lt;/attribute&gt;&lt;attribute&gt;&lt;name&gt;WaterLevelReached&lt;/name&gt;&lt;value&gt;NULL&lt;/value&gt;&lt;/attribute&gt;&lt;attribute&gt;&lt;name&gt;CleanAdvise&lt;/name&gt;&lt;value&gt;NULL&lt;/value&gt;&lt;/attribute&gt;&lt;attribute&gt;&lt;name&gt;FilterAdvise&lt;/name&gt;&lt;value&gt;NULL&lt;/value&gt;&lt;/attribute&gt;&lt;attribute&gt;&lt;name&gt;Brewing&lt;/name&gt;&lt;value&gt;NULL&lt;/value&gt;&lt;/attribute&gt;&lt;attribute&gt;&lt;name&gt;Brewed&lt;/name&gt;&lt;value&gt;NULL&lt;/value&gt;&lt;/attribute&gt;&lt;attribute&gt;&lt;name&gt;Cleaning&lt;/name&gt;&lt;value&gt;NULL&lt;/value&gt;&lt;/attribute&gt;&lt;attribute&gt;&lt;name&gt;LastCleaned&lt;/name&gt;&lt;value&gt;NULL&lt;/value&gt;&lt;/attribute&gt;</attributeList></u:SetAttributes></s:Body></s:Envelope>';

    var opts = {
        method: "POST",
        body: payload,
        headers: {
            'Content-Type': 'text/xml; charset="utf-8"',
            'SOAPACTION': '"urn:Belkin:service:deviceevent:1#SetAttributes"',
            'Content-Length': payload.length
        },
        uri: 'http://' + this._host + '/upnp/control/deviceevent1'
    };

    request(opts, function (e, r, b) {
        if (!b)
            return cb();
        xml.Parser({
            explicitRoot: false,
            explicitArray: false
        }).parseString(b, function (error, result) {
            if (error)
                return cb(error);
            cb(error || null, null);
        });
    });
};