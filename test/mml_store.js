var assert     = require('assert');
var _          = require('underscore');
var talkstore = require('../lib/talkstore');

var DEFAULT_POINT_STYLE = [
  '#layer {',
  '  marker-fill: #FF6600;',
  '  marker-opacity: 1;',
  '  marker-width: 16;',
  '  marker-line-color: white;',
  '  marker-line-width: 3;',
  '  marker-line-opacity: 0.9;',
  '  marker-placement: point;',
  '  marker-type: ellipse;',
  '  marker-allow-overlap: true;',
  '}'
].join('');

suite('mml_store', function() {

  test('can create new instance of mml_store', function() {
    var mml_store = new talkstore.MMLStore();
    assert.ok(_.functions(mml_store).indexOf('mml_builder') >= 0, "mml_store doesn't include 'mml_builder'");
  });

  test('cannot create new mml_builders with blank opts', function() {
    var mml_store = new talkstore.MMLStore();
    assert.throws(function(){
      mml_store.mml_builder();
    }, Error, "Options must include dbname and query");
  });

  test('can create new mml_builders with normal ops', function(done) {
    var mml_store = new talkstore.MMLStore();
    var query = {
      layer: 'whatever',
      filter: 'dummy'
    };
    mml_store.mml_builder({dbname: 'my_database', query: query, style: DEFAULT_POINT_STYLE}).toXML(done);
  });

  test('can create new mml_builders with normal ops and sql', function(done) {
    var mml_store = new talkstore.MMLStore();
    var query = {
      layer: 'whatever',
      filter: 'dummy'
    };
    mml_store.mml_builder({dbname: 'my_database', query: query, style: DEFAULT_POINT_STYLE}).toXML(done);
  });

});
