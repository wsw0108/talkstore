Talkstore
===========

[![Build Status](http://travis-ci.org/wsw0108/talkstore.png)]
(http://travis-ci.org/wsw0108/talkstore)

Similar as [GrainStore](http://github.com/CartoDB/grainstore) but works with
maptalks's database interface.

Typical use
-----------
For using multiple layers use an array type for the 'filter' parameter and
for the 'style' parameter. Each resulting layer will be named 'layerN'
with N starting from 0 (needed to  properly reference the layers from
the 'style' values).


Install
--------
npm install


Dependencies
------------
* node.js (tested from 0.8.x to 0.10.x)
* npm


Additional test dependencies
-----------------------------
* libxml2
* libxml2-devel


Examples
---------

```javascript

var talkstore = require('talkstore');

var queryFilter = {
}

var params = {
  dbname: 'my_database',
  layer: 'my_layer',
  filter: JSON.stringify(queryFilter),
  style: '#my_layer { polygon-fill: #fff; }'
}

var mmls = new talkstore.MMLStore();
var mmlb = mmls.mml_builder(params);
mmlb.toMML(function(err, data){
    console.log(data) // => Carto ready MML
});

mmlb.toXML(function(err, data){
    console.log(data); // => Mapnik XML of database with custom style
});
```

For more examples, see the tests.


Tests
-----
To run the tests, from the project root:

```
npm test
```


Release
-------

```
npm publish
```
