Node WeMo Module
---
This library aims to provide a simple interface to a Belkin WeMo Power Sockets (http://www.belkin.com/wemo).


## To install
```
npm install wemo.js
```

## To use
```javascript
var WeMo = require('wemo.js');
```

## Discover WeMo sockets
```javascript

WeMo.discover(function(wemos) {

  console.log(wemos);
});
```

## Simple example to toggle a WeMo
```javascript

var client = WeMo.createClient('x.x.x.x'); // x.x.x.x being the IP of the WeMo obtained in the previous step

client.state(function(err,state) {

  if (state===1) {
    // WeMo if on, turn it off
    client.off();
  } else {
    // WeMo is off, turn it on
    client.on();
  }
});
```

## WeMo API
### WeMo.createClient(hostname)
`hostname` being the IP of the WeMo.

### WeMo.Discover(cb)
Discovers WeMo power sockets on your local network.

## Client API

### client.on(cb)
Attempts to turn the WeMo on. `cb` will be passed an error if this failed, or if the device is already on.

### client.off(cb)
Attempts to turn the WeMo off. `cb` will be passed an error if this failed, or if the device is already off.

### client.state(cb)
Fetch the state of the WeMo, 1 is on, 0 is off.
