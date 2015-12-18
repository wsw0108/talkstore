var assert     = require('assert');
var talkstore  = require('../lib/talkstore');
var libxmljs   = require('libxmljs');
var step       = require('step');
var http       = require('http');
var fs         = require('fs');

var server;

var server_port = 8033;

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

suite('mml_builder multilayer', function() {

  var queryPoint = {
    engine_home: '/path/to/engine/home',
    dbname: 'dbname',
    layer: 'my_layer_0',
    filter: 'dummy'
  };
  var queryLine = {
    engine_home: '/path/to/engine/home',
    dbname: 'dbname',
    layer: 'my_layer_1',
    filter: 'dummy'
  };

  var stylePoint = "#layer0 { marker-width:3; }";
  var styleLine = "#layer1 { line-color:red; }";

  suiteSetup(function(done) {
    // Start a server to test external resources
    server = http.createServer( function(request, response) {
      var filename = 'test/support/resources' + request.url;
      fs.readFile(filename, "binary", function(err, file) {
        if ( err ) {
          response.writeHead(404, {'Content-Type': 'text/plain'});
          console.log("File '" + filename + "' not found");
          response.write("404 Not Found\n");
        } else {
          response.writeHead(200);
          response.write(file, "binary");
        }
        response.end();
      });
    });
    server.listen(server_port, done);

  });

  suiteTeardown(function() {
    server.close();
  });

  test('accept query array with style array', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var mml_store = new talkstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
          dbname: 'my_database',
          query: [queryPoint, queryLine],
          style: [style0, style1],
          style_version:'2.1.0'
        }).toXML(this);
      },
      function checkXML0(err, xml) {
        if ( err ) { done(err); return; }
        var xmlDoc = libxmljs.parseXmlString(xml);

        var layer0 = xmlDoc.get("Layer[@name='layer0']");
        assert.ok(layer0, "Layer0 not found in XML");

        var layer1 = xmlDoc.get("Layer[@name='layer1']");
        assert.ok(layer1, "Layer1 not found in XML");

        var style0 = xmlDoc.get("Style[@name='layer0']");
        assert.ok(style0, "Style for layer0 not found in XML");

        var style1 = xmlDoc.get("Style[@name='layer1']");
        assert.ok(style1, "Style for layer1 not found in XML");

        done();
      }
    );
  });

  test('error out on blank CartoCSS in a style array', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "";
    var mml_store = new talkstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
          dbname: 'my_database',
          query: [queryPoint, queryLine],
          style: [style0, style1],
          style_version:'2.1.0'
        }).toXML(this);
      },
      function checkError(err) {
        assert(err);
        assert.equal(err.message, "style1: CartoCSS is empty");
        return null;
      },
      function finish(err) {
        done(err);
      }
    );
  });

  test('accept query with style and style_version array', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { marker-width:4; }";
    var query0 = queryPoint;
    var query1 = queryLine;
    var style_version0 = "3.0.0";
    var style_version1 = "3.0.0";
    var mml_store = new talkstore.MMLStore({mapnik_version: '3.0.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
          dbname: 'my_database',
          query: [query0, query1],
          style: [style0, style1],
          style_version: [style_version0, style_version1]
        }).toXML(this);
      },
      function checkXML0(err, xml) {
        if ( err ) {
          throw err;
        }
        var xmlDoc = libxmljs.parseXmlString(xml);

        var layer0 = xmlDoc.get("Layer[@name='layer0']");
        assert.ok(layer0, "Layer0 not found in XML");
        var table0 = layer0.get("Datasource/Parameter[@name='layer']");
        assert.ok(table0, "Layer0.layer not found in XML");
        var table0txt = table0.toString();
        assert.ok(
          table0txt.indexOf(query0.layer) !== -1,
          'Cannot find query [' + query0.layer + '] in layer datasource, got ' + table0txt
        );

        var layer1 = xmlDoc.get("Layer[@name='layer1']");
        assert.ok(layer1, "Layer1 not found in XML");
        var table1 = layer1.get("Datasource/Parameter[@name='layer']");
        assert.ok(table1, "Layer1.layer not found in XML");
        var table1txt = table1.toString();
        assert.ok(
          table1txt.indexOf(query1.layer) !== -1,
          'Cannot find query [' + query1.layer + '] in layer datasource, got ' + table1txt
        );

        var style0 = xmlDoc.get("Style[@name='layer0']");
        assert.ok(style0, "Style for layer0 not found in XML");
        var style0txt = style0.toString();
        var re = /MarkersSymbolizer width="3"/;
        assert.ok(re.test(style0txt), 'Expected ' + re + ' -- got ' + style0txt);

        var style1 = xmlDoc.get("Style[@name='layer1']");
        assert.ok(style1, "Style for layer1 not found in XML");
        var style1txt = style1.toString();
        re = /MarkersSymbolizer width="4"/;
        assert.ok(re.test(style1txt), 'Expected ' + re + ' -- got ' + style1txt);

        return true;
      },
      done
    );
  });

  test('layer name in style array is only a placeholder', function(done) {
    var style0 = "#layer { marker-width:3; }";
    var style1 = "#style { line-color:red; }";
    var mml_store = new talkstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
          dbname: 'my_database',
          query: [queryPoint, queryLine],
          style: [style0, style1],
          style_version:'2.1.0'
        }).toXML(this);
      },
      function checkXML0(err, xml) {
        if ( err ) { done(err); return; }
        var xmlDoc = libxmljs.parseXmlString(xml);

        var layer0 = xmlDoc.get("Layer[@name='layer0']");
        assert.ok(layer0, "Layer0 not found in XML");

        var layer1 = xmlDoc.get("Layer[@name='layer1']");
        assert.ok(layer1, "Layer1 not found in XML");

        var style0 = xmlDoc.get("Style[@name='layer0']");
        assert.ok(style0, "Style for layer0 not found in XML");

        var style1 = xmlDoc.get("Style[@name='layer1']");
        assert.ok(style1, "Style for layer1 not found in XML");

        done();
      }
    );
  });

  test('layer name in single style is only a placeholder', function(done) {
    var style0 = "#layer { marker-width:3; } #layer[a=1] { marker-fill:#ff0000 }";
    var mml_store = new talkstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
          dbname: 'my_database',
          query: [queryPoint],
          style: [style0],
          style_version:'2.1.0'
        }).toXML(this);
      },
      function checkXML0(err, xml) {
        if ( err ) { done(err); return; }
        var xmlDoc = libxmljs.parseXmlString(xml);

        var layer0 = xmlDoc.get("Layer[@name='layer0']");
        assert.ok(layer0, "Layer0 not found in XML");

        var style0 = xmlDoc.get("Style[@name='layer0']");
        assert.ok(style0, "Style for layer0 not found in XML");
        var style0txt = style0.toString();
        var re = /MarkersSymbolizer fill="#ff0000" width="3"/;
        assert.ok(re.test(style0txt), 'Expected ' + re + ' -- got ' + style0txt);

        done();
      }
    );
  });

  test('accept query array with single style string', function(done) {
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var mml_store = new talkstore.MMLStore({mapnik_version: '2.1.0'});

    step(
      function initBuilder() {
        mml_store.mml_builder({
          dbname: 'my_database',
          query: [queryPoint, queryLine],
          style: [style0, style1],
          style_version:'2.1.0'
        }).toXML(this);
      },
      function checkXML0(err, xml) {
        if ( err ) { done(err); return; }
        var xmlDoc = libxmljs.parseXmlString(xml);

        var layer0 = xmlDoc.get("Layer[@name='layer0']");
        assert.ok(layer0, "Layer0 not found in XML");

        var layer1 = xmlDoc.get("Layer[@name='layer1']");
        assert.ok(layer1, "Layer1 not found in XML");

        var style0 = xmlDoc.get("Style[@name='layer0']");
        assert.ok(style0, "Style for layer0 not found in XML");

        var style1 = xmlDoc.get("Style[@name='layer1']");
        assert.ok(style1, "Style for layer1 not found in XML");

        done();
      }
    );
  });

  test('Error out on malformed interactivity', function(done) {
    var query0 = queryPoint;
    var query1 = queryLine;
    var style0 = "#layer0 { marker-width:3; }";
    var style1 = "#layer1 { line-color:red; }";
    var fullstyle = style0 + style1;
    var mml_store = new talkstore.MMLStore({mapnik_version: '2.1.0'});
    var iact0;
    var iact1 = ['a','b'];

    step(
      function initBuilder() {
        mml_store.mml_builder({
          dbname: 'my_database',
          query: [query0, query1],
          interactivity: [iact0, iact1],
          style: fullstyle,
          style_version:'2.1.0'
        }).toXML(this);
      },
      function checkError(err) {
        assert.ok(err);
        assert.equal(err.message, 'Invalid interactivity value type for layer 1: object');
        done();
      }
    );
  });

  test('Error out on malformed layer', function(done) {
    var mml_store = new talkstore.MMLStore({mapnik_version: '2.1.0'});
    var q = {
      engine_home: '/path/to/engine/home',
      dbname: 'dbname',
      layer: 'whatever',
      filter: 'dummy'
    };

    step(
      function initBuilder() {
        mml_store.mml_builder({
          dbname: 'my_database',
          query: q,
          style: DEFAULT_POINT_STYLE,
          layer: 'cipz'
        }).toXML(this);
      },
      function checkError(err) {
        assert.ok(err);
        assert.equal(err.message, 'Invalid (non-integer) layer value type: cipz');
        done();
      }
    );
  });

});
