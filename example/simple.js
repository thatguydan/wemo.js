var WeMo = require('../index.js');

WeMo.discover(function(WeMos) {

  WeMos.forEach(function(thisWeMo) {

    console.log('Found %s at %s',thisWeMo.info.device.friendlyName,thisWeMo.location.host);
    var client = WeMo.createClient(thisWeMo.location.host);
    client.state(function(err,state) {

      if (state===1) {
        // WeMo if on, turn it off
        console.log('Turning %s Off',thisWeMo.info.device.friendlyName)
        client.off();
      } else {
        // WeMo is off, turn it on
        console.log('Turning %s On',thisWeMo.info.device.friendlyName)
        client.on();
      }
    });
  });
});