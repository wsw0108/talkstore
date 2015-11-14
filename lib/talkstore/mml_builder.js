var _      = require('underscore');
var carto  = require('carto');
var millstone = require('millstone');
var os = require('os');
var path = require('path');

var StyleTrans = require('./style_trans');

var default_cache_dir = path.join(os.tmpdir(), 'millstone');

// configure talkstore from optional args passed + defaults
var talkstore_defaults = {
    map: {
        // fixed for now
        srid: 4326
    },
    datasource: {
        type: "maptalks",
        // fixed for now
        srid: 4326
    }
};

// MML builder interface
//
// opts must have:
// `dbname`          - name of database
// `query`           - query condition to constrain the map by (can be an array)
// `style`           - Carto style to override the built in style store (can be an array)
//
// opts may have:
// `extra_ds_opts`   - optional array of extra datasource options
// `style_version`   - Version of the carto style override (can be an array)
// `interactivity`   - Comma separated list of grid fields (can be an array)
// `layer`           - Interactivity layer index, to use with token and grids
//
// @param optional_args
//     You may pass in a third argument to override talkstore defaults.
//     `cachedir` is base directory to put localized external resources into
//     `carto_env` carto renderer environment options, see
//                 http://github.com/mapbox/carto/blob/v0.9.5/lib/carto/renderer.js#L71
//     `mapnik_version` is target version of mapnik, defaults to ``2.0.2``
//     `mapnik_tile_format` for the tiles, see https://github.com/mapnik/mapnik/wiki/OutputFormats
//     `default_style_version` is the default version for CartoCSS styles. Defaults to '2.0.0'
//
function MMLBuilder(params, options) {
    this.params = params || {};
    // core variables
    var requiredParams = ['dbname', 'query'];
    requiredParams.forEach(function(paramKey) {
        if (!params.hasOwnProperty(paramKey)) {
            throw new Error("Options must include '" + paramKey + "'");
        }
    });
    // TODO: check required [layer, filter, engine_home]

    this.options = options || {};
    this.options.cachedir = this.options.cachedir || default_cache_dir;
    this.target_mapnik_version = options.mapnik_version || '2.0.2';
    this.default_style_version = options.default_style_version || '2.0.0';

    this.talkstore_datasource = _.defaults({}, talkstore_defaults.datasource);

    this.talkstore_map = _.defaults({}, talkstore_defaults.map);
    if ( options.mapnik_tile_format ) {
        this.talkstore_map.format = options.mapnik_tile_format;
    }

    this.interactivity = params.interactivity;
    if ( _.isString(this.interactivity) ) {
      this.interactivity = [ this.interactivity ];
    } else if ( this.interactivity )  {
      for (var i=0; i<this.interactivity.length; ++i) {
        if ( this.interactivity[i] && ! _.isString(this.interactivity[i]) ) {
          throw new Error("Invalid interactivity value type for layer " + i + ": " + typeof(this.interactivity[i]));
        }
      }
    }
    this.interactivity_layer = params.layer || 0;
    if (!Number.isFinite(this.interactivity_layer)) {
        throw new Error("Invalid (non-integer) layer value type: " + this.interactivity_layer);
    }
}

module.exports = MMLBuilder;

MMLBuilder.prototype.set = function (property, value) {
    var isOption = this.hasOwnProperty(property) && !_.isFunction(this[property]);

    if (!isOption) {
        throw new Error('Setting "' + property + '" is not allowed');
    }

    this[property] = _.extend(this[property], value);

    return this; // allow chaining
};

MMLBuilder.prototype.toXML = function(callback) {
    var style = this.params.style;
    var style_version = this.params.style_version || this.default_style_version;

    this.render(style, style_version, callback);
};

MMLBuilder.prototype.render = function(style_in, version, callback){
    var self = this;

    style_in = Array.isArray(style_in) ? style_in : [ style_in ];

    var style = [];

    // TODO: rewrite this horrible function

    var t = new StyleTrans();

    try {
        for ( var i=0; i<style_in.length; ++i ) {
            if ( style_in[i].replace(/^\s+|\s+$/g, '').length === 0 ) {
                return callback(new Error("style"+i+": CartoCSS is empty"));
            }
            var v = _.isArray(version) ? version[i] : version;
            if ( ! v ) {
                v = this.default_style_version;
            }
            style[i] = t.transform(style_in[i], v, this.target_mapnik_version);
        }
    } catch (err) {
        return callback(err, null);
    }

    var mml;
    try {
        mml = this.toMML(style);
    } catch (err) {
        return callback(err, null);
    }

    // Millstone configuration
    //
    // Resources are shared between all maps, and ensured
    // to be localized on every call to the "toXML" method.
    //
    // Caller should take care of purging unused resources based
    // on its usage of the "toXML" method.
    //
    var millstoneOptions = {
        mml: mml,
        base:  path.join(this.options.cachedir, 'base'),
        cache: path.join(this.options.cachedir, 'cache')
    };
    millstone.resolve(millstoneOptions, function renderResolvedMml(err, mml) {

        if ( err ) {
            return callback(err, null);
        }

        // NOTE: we _need_ a new object here because carto writes into it
        var carto_env = _.defaults({}, self.options.carto_env);
        var carto_options = { mapnik_version: self.target_mapnik_version };

        // carto.Renderer may throw during parse time (before nextTick is called)
        // See https://github.com/mapbox/carto/pull/187
        try {
            var r = new carto.Renderer(carto_env, carto_options);
            r.render(mml, function(err, output){
                callback(err, output);
            });
        } catch (err) {
            callback(err, null);
        }
    });
};

MMLBuilder.prototype.baseMML = function() {
    var queries = Array.isArray(this.params.query) ? this.params.query : [ this.params.query ];

    var mml   = {};
    mml.srs   = '+init=epsg:' + this.talkstore_map.srid;
    mml.format = this.talkstore_map.format || 'png';
    mml.Layer = [];

    for (var i=0; i<queries.length; ++i) {
        var query = queries[i];

        var datasource = _.clone(this.talkstore_datasource);
        datasource.engine_home = query.engine_home;
        datasource.layer = query.layer;
        datasource.filter = query.filter;
        datasource.dbname = this.params.dbname;

        if ( this.params.datasource_extend && this.params.datasource_extend[i] ) {
            datasource = _.extend(datasource, this.params.datasource_extend[i]);
        }

        if ( this.params.extra_ds_opts ) {
            datasource = _.defaults(datasource, this.params.extra_ds_opts[i]);
        }

        var layer        = {};
        layer.id = 'layer' + i;

        layer.name       = layer.id;
        layer.srs        = '+init=epsg:' + this.talkstore_datasource.srid;
        layer.Datasource = datasource;

        mml.Layer.push(layer);
    }

    if ( this.interactivity ) {
        if ( this.interactivity[this.interactivity_layer] ) {
            if ( _.isString(this.interactivity[this.interactivity_layer]) ) {
                mml.interactivity = {
                    layer: mml.Layer[this.interactivity_layer].id,
                    fields: this.interactivity[this.interactivity_layer].split(',')
                };
            } else {
                throw new Error("Unexpected interactivity format: " + this.interactivity[this.interactivity_layer]);
            }
        }
    }

    return mml;
};

MMLBuilder.prototype.toMML = function(style_in){

    var base_mml = this.baseMML();
    base_mml.Stylesheet = [];

    var style = Array.isArray(style_in) ? style_in : [ style_in ];
    var t = new StyleTrans();

    for (var i=0; i<style.length; ++i) {
        var stylesheet  = {};
        if ( _.isArray(style_in) ) {
            stylesheet.id   = 'style' + i;
            stylesheet.data = t.setLayerName(style[i], 'layer' + i);
        } else {
            stylesheet.id   = 'style.mss';
            stylesheet.data = style[i];
        }
        base_mml.Stylesheet.push(stylesheet);
    }

    return base_mml;
};
