var MMLBuilder = require('./mml_builder');
var fs = require('fs');
var _ = require('underscore');
var os = require('os');
var path = require('path');

var default_cache_dir = path.join(os.tmpdir(), 'millstone');

// @param optional_args
//    optional configurations. valid elements:
//    cachedir: is base directory to put localized external resources into
//              Defaults to '/tmp/millstone'
//    *: anything else that is accepted by mml_builder "optional_args"
//       parameter, see mml_builder.js
//
//
function MMLStore(options) {
  var me = {};

  options = options || {};
  options.cachedir = options.cachedir || default_cache_dir;

  // @param callback(err, payload) called on initialization
  me.mml_builder = function(params, overrideOptions) {
    return new MMLBuilder(params, _.extend({}, options, overrideOptions));
  };

  /// API: Purge cache of localized resources for this store
  //
  /// @param ttl time to leave for each file, in seconds
  ///            NOTE: you can use 0 to clean all resources
  ///
  /// @param lbl label prefix for logs
  ///
  me.purgeLocalizedResources = function(ttl, callback, lbl)
  {
    if ( lbl ) {
        lbl += ': ';
    } else {
        lbl = '';
    }
    var now = Date.now();
    // TODO: check if "base" should also be cleared
    var toclear = path.join(options.cachedir, 'cache');
    //console.log("Scanning cache dir " + toclear);
    fs.readdir(toclear, function(err, files) {
      if ( err ) {
        if ( err.code !== 'ENOENT' ) {
            callback(err);
        } else {
            callback(null);
        } // nothing to clear
      }
      else {
        var purgeNext = function() {
          var name = files.shift();
          if ( ! name ) {
            callback(null); // end of files
            return;
          }
          var file = path.join(toclear, name);
          fs.stat(file, function(err, stats) {
            if ( err ) {
              console.log(lbl + "cannot stat file " + file + ': ' + err);
              purgeNext();
            }
            if ( ttl ) {
              var cage = ( now - stats.ctime.getTime() ) / 1000;
              var aage = ( now - stats.atime.getTime() ) / 1000;
              if ( cage < ttl || aage < ttl )
              {
                purgeNext();
                return;
              }
              console.log(lbl + "unlinking " + file + " created " + cage +
                          " seconds ago and accessed " + aage +
                          " seconds ago (ttl is " + ttl + ")");
            } else {
              console.log(lbl + "unlinking " + file +
                          " (ttl is " + ttl + ")");
            }
            fs.unlink(file, function(err) {
              if (err) {
                console.log(lbl + "error unlinking " + file +
                            ": " + err);
              }
              purgeNext();
            });
          });
        };
        purgeNext();
      }
    });
  };

  return me;
}

module.exports = MMLStore;
