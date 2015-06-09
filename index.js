var WeMo = require('./lib/WeMo');

exports.discoverer = require('./lib/Discoverer');

exports.createClient = function(config) {
  return new WeMo(config);
};