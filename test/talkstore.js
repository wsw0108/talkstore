var assert     = require('assert');
var talkstore = require('../lib/talkstore');

suite('talkstore', function() {

  test('version', function() {
    var version = talkstore.version();
    assert.equal(typeof(version), 'string');
    assert.equal(version, require('../package.json').version);
  });

});
