var WeMo = require('./lib/WeMo');

exports.discover = require('./lib/Discoverer');

exports.createClient = function(config) {
  return new WeMo(config);
};