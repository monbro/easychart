/**
 * easychart - Easychart is a graphical user interface, built on top of the stunning Highcharts-javascript library
 * @version v3.0.0
 * @link 
 * @license MIT
 */
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Standalone extraction of Backbone.Events, no external dependency required.
 * Degrades nicely when Backone/underscore are already available in the current
 * global context.
 *
 * Note that docs suggest to use underscore's `_.extend()` method to add Events
 * support to some given object. A `mixin()` method has been added to the Events
 * prototype to avoid using underscore for that sole purpose:
 *
 *     var myEventEmitter = BackboneEvents.mixin({});
 *
 * Or for a function constructor:
 *
 *     function MyConstructor(){}
 *     MyConstructor.prototype.foo = function(){}
 *     BackboneEvents.mixin(MyConstructor.prototype);
 *
 * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * (c) 2013 Nicolas Perriault
 */
/* global exports:true, define, module */
(function() {
  var root = this,
      nativeForEach = Array.prototype.forEach,
      hasOwnProperty = Object.prototype.hasOwnProperty,
      slice = Array.prototype.slice,
      idCounter = 0;

  // Returns a partial implementation matching the minimal API subset required
  // by Backbone.Events
  function miniscore() {
    return {
      keys: Object.keys || function (obj) {
        if (typeof obj !== "object" && typeof obj !== "function" || obj === null) {
          throw new TypeError("keys() called on a non-object");
        }
        var key, keys = [];
        for (key in obj) {
          if (obj.hasOwnProperty(key)) {
            keys[keys.length] = key;
          }
        }
        return keys;
      },

      uniqueId: function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
      },

      has: function(obj, key) {
        return hasOwnProperty.call(obj, key);
      },

      each: function(obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
          obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
          for (var i = 0, l = obj.length; i < l; i++) {
            iterator.call(context, obj[i], i, obj);
          }
        } else {
          for (var key in obj) {
            if (this.has(obj, key)) {
              iterator.call(context, obj[key], key, obj);
            }
          }
        }
      },

      once: function(func) {
        var ran = false, memo;
        return function() {
          if (ran) return memo;
          ran = true;
          memo = func.apply(this, arguments);
          func = null;
          return memo;
        };
      }
    };
  }

  var _ = miniscore(), Events;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = {};
        return this;
      }

      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeners = this._listeners;
      if (!listeners) return this;
      var deleteListener = !name && !callback;
      if (typeof name === 'object') callback = this;
      if (obj) (listeners = {})[obj._listenerId] = obj;
      for (var id in listeners) {
        listeners[id].off(name, callback, this);
        if (deleteListener) delete this._listeners[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeners = this._listeners || (this._listeners = {});
      var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
      listeners[id] = obj;
      if (typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Mixin utility
  Events.mixin = function(proto) {
    var exports = ['on', 'once', 'off', 'trigger', 'stopListening', 'listenTo',
                   'listenToOnce', 'bind', 'unbind'];
    _.each(exports, function(name) {
      proto[name] = this[name];
    }, this);
    return proto;
  };

  // Export Events as BackboneEvents depending on current context
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Events;
    }
    exports.BackboneEvents = Events;
  }else if (typeof define === "function"  && typeof define.amd == "object") {
    define(function() {
      return Events;
    });
  } else {
    root.BackboneEvents = Events;
  }
})(this);

},{}],2:[function(require,module,exports){
module.exports = require('./backbone-events-standalone');

},{"./backbone-events-standalone":1}],3:[function(require,module,exports){

},{}],4:[function(require,module,exports){
/*!
 * Cross-Browser Split 1.1.1
 * Copyright 2007-2012 Steven Levithan <stevenlevithan.com>
 * Available under the MIT License
 * ECMAScript compliant, uniform cross-browser split method
 */

/**
 * Splits a string into an array of strings using a regex or string separator. Matches of the
 * separator are not included in the result array. However, if `separator` is a regex that contains
 * capturing groups, backreferences are spliced into the result each time `separator` is matched.
 * Fixes browser bugs compared to the native `String.prototype.split` and can be used reliably
 * cross-browser.
 * @param {String} str String to split.
 * @param {RegExp|String} separator Regex or string to use for separating the string.
 * @param {Number} [limit] Maximum number of items to include in the result array.
 * @returns {Array} Array of substrings.
 * @example
 *
 * // Basic use
 * split('a b c d', ' ');
 * // -> ['a', 'b', 'c', 'd']
 *
 * // With limit
 * split('a b c d', ' ', 2);
 * // -> ['a', 'b']
 *
 * // Backreferences in result array
 * split('..word1 word2..', /([a-z]+)(\d+)/i);
 * // -> ['..', 'word', '1', ' ', 'word', '2', '..']
 */
module.exports = (function split(undef) {

  var nativeSplit = String.prototype.split,
    compliantExecNpcg = /()??/.exec("")[1] === undef,
    // NPCG: nonparticipating capturing group
    self;

  self = function(str, separator, limit) {
    // If `separator` is not a regex, use `nativeSplit`
    if (Object.prototype.toString.call(separator) !== "[object RegExp]") {
      return nativeSplit.call(str, separator, limit);
    }
    var output = [],
      flags = (separator.ignoreCase ? "i" : "") + (separator.multiline ? "m" : "") + (separator.extended ? "x" : "") + // Proposed for ES6
      (separator.sticky ? "y" : ""),
      // Firefox 3+
      lastLastIndex = 0,
      // Make `global` and avoid `lastIndex` issues by working with a copy
      separator = new RegExp(separator.source, flags + "g"),
      separator2, match, lastIndex, lastLength;
    str += ""; // Type-convert
    if (!compliantExecNpcg) {
      // Doesn't need flags gy, but they don't hurt
      separator2 = new RegExp("^" + separator.source + "$(?!\\s)", flags);
    }
    /* Values for `limit`, per the spec:
     * If undefined: 4294967295 // Math.pow(2, 32) - 1
     * If 0, Infinity, or NaN: 0
     * If positive number: limit = Math.floor(limit); if (limit > 4294967295) limit -= 4294967296;
     * If negative number: 4294967296 - Math.floor(Math.abs(limit))
     * If other: Type-convert, then use the above rules
     */
    limit = limit === undef ? -1 >>> 0 : // Math.pow(2, 32) - 1
    limit >>> 0; // ToUint32(limit)
    while (match = separator.exec(str)) {
      // `separator.lastIndex` is not reliable cross-browser
      lastIndex = match.index + match[0].length;
      if (lastIndex > lastLastIndex) {
        output.push(str.slice(lastLastIndex, match.index));
        // Fix browsers whose `exec` methods don't consistently return `undefined` for
        // nonparticipating capturing groups
        if (!compliantExecNpcg && match.length > 1) {
          match[0].replace(separator2, function() {
            for (var i = 1; i < arguments.length - 2; i++) {
              if (arguments[i] === undef) {
                match[i] = undef;
              }
            }
          });
        }
        if (match.length > 1 && match.index < str.length) {
          Array.prototype.push.apply(output, match.slice(1));
        }
        lastLength = match[0].length;
        lastLastIndex = lastIndex;
        if (output.length >= limit) {
          break;
        }
      }
      if (separator.lastIndex === match.index) {
        separator.lastIndex++; // Avoid an infinite loop
      }
    }
    if (lastLastIndex === str.length) {
      if (lastLength || !separator.test("")) {
        output.push("");
      }
    } else {
      output.push(str.slice(lastLastIndex));
    }
    return output.length > limit ? output.slice(0, limit) : output;
  };

  return self;
})();

},{}],5:[function(require,module,exports){
'use strict';
// For more information about browser field, check out the browser field at https://github.com/substack/browserify-handbook#browser-field.

module.exports = {
    // Create a <link> tag with optional data attributes
    createLink: function(href, attributes) {
        var head = document.head || document.getElementsByTagName('head')[0];
        var link = document.createElement('link');

        link.href = href;
        link.rel = 'stylesheet';

        for (var key in attributes) {
            if ( ! attributes.hasOwnProperty(key)) {
                continue;
            }
            var value = attributes[key];
            link.setAttribute('data-' + key, value);
        }

        head.appendChild(link);
    },
    // Create a <style> tag with optional data attributes
    createStyle: function(cssText, attributes) {
        var head = document.head || document.getElementsByTagName('head')[0],
            style = document.createElement('style');

        style.type = 'text/css';

        for (var key in attributes) {
            if ( ! attributes.hasOwnProperty(key)) {
                continue;
            }
            var value = attributes[key];
            style.setAttribute('data-' + key, value);
        }
        
        if (style.sheet) { // for jsdom and IE9+
            style.innerHTML = cssText;
            style.sheet.cssText = cssText;
            head.appendChild(style);
        } else if (style.styleSheet) { // for IE8 and below
            head.appendChild(style);
            style.styleSheet.cssText = cssText;
        } else { // for Chrome, Firefox, and Safari
            style.appendChild(document.createTextNode(cssText));
            head.appendChild(style);
        }
    }
};

},{}],6:[function(require,module,exports){
arguments[4][3][0].apply(exports,arguments)
},{"dup":3}],7:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],8:[function(require,module,exports){
module.exports = function(obj) {
    if (typeof obj === 'string') return camelCase(obj);
    return walk(obj);
};

function walk (obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (isDate(obj) || isRegex(obj)) return obj;
    if (isArray(obj)) return map(obj, walk);
    return reduce(objectKeys(obj), function (acc, key) {
        var camel = camelCase(key);
        acc[camel] = walk(obj[key]);
        return acc;
    }, {});
}

function camelCase(str) {
    return str.replace(/[_.-](\w|$)/g, function (_,x) {
        return x.toUpperCase();
    });
}

var isArray = Array.isArray || function (obj) {
    return Object.prototype.toString.call(obj) === '[object Array]';
};

var isDate = function (obj) {
    return Object.prototype.toString.call(obj) === '[object Date]';
};

var isRegex = function (obj) {
    return Object.prototype.toString.call(obj) === '[object RegExp]';
};

var has = Object.prototype.hasOwnProperty;
var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) {
        if (has.call(obj, key)) keys.push(key);
    }
    return keys;
};

function map (xs, f) {
    if (xs.map) return xs.map(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        res.push(f(xs[i], i));
    }
    return res;
}

function reduce (xs, f, acc) {
    if (xs.reduce) return xs.reduce(f, acc);
    for (var i = 0; i < xs.length; i++) {
        acc = f(acc, xs[i], i);
    }
    return acc;
}

},{}],9:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks['$' + event] = this._callbacks['$' + event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  function on() {
    this.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks['$' + event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks['$' + event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks['$' + event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks['$' + event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],10:[function(require,module,exports){
/**
 * cuid.js
 * Collision-resistant UID generator for browsers and node.
 * Sequential for fast db lookups and recency sorting.
 * Safe for element IDs and server-side lookups.
 *
 * Extracted from CLCTR
 *
 * Copyright (c) Eric Elliott 2012
 * MIT License
 */

/*global window, navigator, document, require, process, module */
(function (app) {
  'use strict';
  var namespace = 'cuid',
    c = 0,
    blockSize = 4,
    base = 36,
    discreteValues = Math.pow(base, blockSize),

    pad = function pad(num, size) {
      var s = "000000000" + num;
      return s.substr(s.length-size);
    },

    randomBlock = function randomBlock() {
      return pad((Math.random() *
            discreteValues << 0)
            .toString(base), blockSize);
    },

    safeCounter = function () {
      c = (c < discreteValues) ? c : 0;
      c++; // this is not subliminal
      return c - 1;
    },

    api = function cuid() {
      // Starting with a lowercase letter makes
      // it HTML element ID friendly.
      var letter = 'c', // hard-coded allows for sequential access

        // timestamp
        // warning: this exposes the exact date and time
        // that the uid was created.
        timestamp = (new Date().getTime()).toString(base),

        // Prevent same-machine collisions.
        counter,

        // A few chars to generate distinct ids for different
        // clients (so different computers are far less
        // likely to generate the same id)
        fingerprint = api.fingerprint(),

        // Grab some more chars from Math.random()
        random = randomBlock() + randomBlock();

        counter = pad(safeCounter().toString(base), blockSize);

      return  (letter + timestamp + counter + fingerprint + random);
    };

  api.slug = function slug() {
    var date = new Date().getTime().toString(36),
      counter,
      print = api.fingerprint().slice(0,1) +
        api.fingerprint().slice(-1),
      random = randomBlock().slice(-2);

      counter = safeCounter().toString(36).slice(-4);

    return date.slice(-2) +
      counter + print + random;
  };

  api.globalCount = function globalCount() {
    // We want to cache the results of this
    var cache = (function calc() {
        var i,
          count = 0;

        for (i in window) {
          count++;
        }

        return count;
      }());

    api.globalCount = function () { return cache; };
    return cache;
  };

  api.fingerprint = function browserPrint() {
    return pad((navigator.mimeTypes.length +
      navigator.userAgent.length).toString(36) +
      api.globalCount().toString(36), 4);
  };

  // don't change anything from here down.
  if (app.register) {
    app.register(namespace, api);
  } else if (typeof module !== 'undefined') {
    module.exports = api;
  } else {
    app[namespace] = api;
  }

}(this.applitude || this));

},{}],11:[function(require,module,exports){
var EvStore = require("ev-store")

module.exports = addEvent

function addEvent(target, type, handler) {
    var events = EvStore(target)
    var event = events[type]

    if (!event) {
        events[type] = handler
    } else if (Array.isArray(event)) {
        if (event.indexOf(handler) === -1) {
            event.push(handler)
        }
    } else if (event !== handler) {
        events[type] = [event, handler]
    }
}

},{"ev-store":21}],12:[function(require,module,exports){
var globalDocument = require("global/document")
var EvStore = require("ev-store")
var createStore = require("weakmap-shim/create-store")

var addEvent = require("./add-event.js")
var removeEvent = require("./remove-event.js")
var ProxyEvent = require("./proxy-event.js")

var HANDLER_STORE = createStore()

module.exports = DOMDelegator

function DOMDelegator(document) {
    if (!(this instanceof DOMDelegator)) {
        return new DOMDelegator(document);
    }

    document = document || globalDocument

    this.target = document.documentElement
    this.events = {}
    this.rawEventListeners = {}
    this.globalListeners = {}
}

DOMDelegator.prototype.addEventListener = addEvent
DOMDelegator.prototype.removeEventListener = removeEvent

DOMDelegator.allocateHandle =
    function allocateHandle(func) {
        var handle = new Handle()

        HANDLER_STORE(handle).func = func;

        return handle
    }

DOMDelegator.transformHandle =
    function transformHandle(handle, broadcast) {
        var func = HANDLER_STORE(handle).func

        return this.allocateHandle(function (ev) {
            broadcast(ev, func);
        })
    }

DOMDelegator.prototype.addGlobalEventListener =
    function addGlobalEventListener(eventName, fn) {
        var listeners = this.globalListeners[eventName] || [];
        if (listeners.indexOf(fn) === -1) {
            listeners.push(fn)
        }

        this.globalListeners[eventName] = listeners;
    }

DOMDelegator.prototype.removeGlobalEventListener =
    function removeGlobalEventListener(eventName, fn) {
        var listeners = this.globalListeners[eventName] || [];

        var index = listeners.indexOf(fn)
        if (index !== -1) {
            listeners.splice(index, 1)
        }
    }

DOMDelegator.prototype.listenTo = function listenTo(eventName) {
    if (!(eventName in this.events)) {
        this.events[eventName] = 0;
    }

    this.events[eventName]++;

    if (this.events[eventName] !== 1) {
        return
    }

    var listener = this.rawEventListeners[eventName]
    if (!listener) {
        listener = this.rawEventListeners[eventName] =
            createHandler(eventName, this)
    }

    this.target.addEventListener(eventName, listener, true)
}

DOMDelegator.prototype.unlistenTo = function unlistenTo(eventName) {
    if (!(eventName in this.events)) {
        this.events[eventName] = 0;
    }

    if (this.events[eventName] === 0) {
        throw new Error("already unlistened to event.");
    }

    this.events[eventName]--;

    if (this.events[eventName] !== 0) {
        return
    }

    var listener = this.rawEventListeners[eventName]

    if (!listener) {
        throw new Error("dom-delegator#unlistenTo: cannot " +
            "unlisten to " + eventName)
    }

    this.target.removeEventListener(eventName, listener, true)
}

function createHandler(eventName, delegator) {
    var globalListeners = delegator.globalListeners;
    var delegatorTarget = delegator.target;

    return handler

    function handler(ev) {
        var globalHandlers = globalListeners[eventName] || []

        if (globalHandlers.length > 0) {
            var globalEvent = new ProxyEvent(ev);
            globalEvent.currentTarget = delegatorTarget;
            callListeners(globalHandlers, globalEvent)
        }

        findAndInvokeListeners(ev.target, ev, eventName)
    }
}

function findAndInvokeListeners(elem, ev, eventName) {
    var listener = getListener(elem, eventName)

    if (listener && listener.handlers.length > 0) {
        var listenerEvent = new ProxyEvent(ev);
        listenerEvent.currentTarget = listener.currentTarget
        callListeners(listener.handlers, listenerEvent)

        if (listenerEvent._bubbles) {
            var nextTarget = listener.currentTarget.parentNode
            findAndInvokeListeners(nextTarget, ev, eventName)
        }
    }
}

function getListener(target, type) {
    // terminate recursion if parent is `null`
    if (target === null || typeof target === "undefined") {
        return null
    }

    var events = EvStore(target)
    // fetch list of handler fns for this event
    var handler = events[type]
    var allHandler = events.event

    if (!handler && !allHandler) {
        return getListener(target.parentNode, type)
    }

    var handlers = [].concat(handler || [], allHandler || [])
    return new Listener(target, handlers)
}

function callListeners(handlers, ev) {
    handlers.forEach(function (handler) {
        if (typeof handler === "function") {
            handler(ev)
        } else if (typeof handler.handleEvent === "function") {
            handler.handleEvent(ev)
        } else if (handler.type === "dom-delegator-handle") {
            HANDLER_STORE(handler).func(ev)
        } else {
            throw new Error("dom-delegator: unknown handler " +
                "found: " + JSON.stringify(handlers));
        }
    })
}

function Listener(target, handlers) {
    this.currentTarget = target
    this.handlers = handlers
}

function Handle() {
    this.type = "dom-delegator-handle"
}

},{"./add-event.js":11,"./proxy-event.js":14,"./remove-event.js":15,"ev-store":21,"global/document":26,"weakmap-shim/create-store":129}],13:[function(require,module,exports){
var Individual = require("individual")
var cuid = require("cuid")
var globalDocument = require("global/document")

var DOMDelegator = require("./dom-delegator.js")

var versionKey = "13"
var cacheKey = "__DOM_DELEGATOR_CACHE@" + versionKey
var cacheTokenKey = "__DOM_DELEGATOR_CACHE_TOKEN@" + versionKey
var delegatorCache = Individual(cacheKey, {
    delegators: {}
})
var commonEvents = [
    "blur", "change", "click",  "contextmenu", "dblclick",
    "error","focus", "focusin", "focusout", "input", "keydown",
    "keypress", "keyup", "load", "mousedown", "mouseup",
    "resize", "select", "submit", "touchcancel",
    "touchend", "touchstart", "unload"
]

/*  Delegator is a thin wrapper around a singleton `DOMDelegator`
        instance.

    Only one DOMDelegator should exist because we do not want
        duplicate event listeners bound to the DOM.

    `Delegator` will also `listenTo()` all events unless
        every caller opts out of it
*/
module.exports = Delegator

function Delegator(opts) {
    opts = opts || {}
    var document = opts.document || globalDocument

    var cacheKey = document[cacheTokenKey]

    if (!cacheKey) {
        cacheKey =
            document[cacheTokenKey] = cuid()
    }

    var delegator = delegatorCache.delegators[cacheKey]

    if (!delegator) {
        delegator = delegatorCache.delegators[cacheKey] =
            new DOMDelegator(document)
    }

    if (opts.defaultEvents !== false) {
        for (var i = 0; i < commonEvents.length; i++) {
            delegator.listenTo(commonEvents[i])
        }
    }

    return delegator
}

Delegator.allocateHandle = DOMDelegator.allocateHandle;
Delegator.transformHandle = DOMDelegator.transformHandle;

},{"./dom-delegator.js":12,"cuid":10,"global/document":26,"individual":31}],14:[function(require,module,exports){
var inherits = require("inherits")

var ALL_PROPS = [
    "altKey", "bubbles", "cancelable", "ctrlKey",
    "eventPhase", "metaKey", "relatedTarget", "shiftKey",
    "target", "timeStamp", "type", "view", "which"
]
var KEY_PROPS = ["char", "charCode", "key", "keyCode"]
var MOUSE_PROPS = [
    "button", "buttons", "clientX", "clientY", "layerX",
    "layerY", "offsetX", "offsetY", "pageX", "pageY",
    "screenX", "screenY", "toElement"
]

var rkeyEvent = /^key|input/
var rmouseEvent = /^(?:mouse|pointer|contextmenu)|click/

module.exports = ProxyEvent

function ProxyEvent(ev) {
    if (!(this instanceof ProxyEvent)) {
        return new ProxyEvent(ev)
    }

    if (rkeyEvent.test(ev.type)) {
        return new KeyEvent(ev)
    } else if (rmouseEvent.test(ev.type)) {
        return new MouseEvent(ev)
    }

    for (var i = 0; i < ALL_PROPS.length; i++) {
        var propKey = ALL_PROPS[i]
        this[propKey] = ev[propKey]
    }

    this._rawEvent = ev
    this._bubbles = false;
}

ProxyEvent.prototype.preventDefault = function () {
    this._rawEvent.preventDefault()
}

ProxyEvent.prototype.startPropagation = function () {
    this._bubbles = true;
}

function MouseEvent(ev) {
    for (var i = 0; i < ALL_PROPS.length; i++) {
        var propKey = ALL_PROPS[i]
        this[propKey] = ev[propKey]
    }

    for (var j = 0; j < MOUSE_PROPS.length; j++) {
        var mousePropKey = MOUSE_PROPS[j]
        this[mousePropKey] = ev[mousePropKey]
    }

    this._rawEvent = ev
}

inherits(MouseEvent, ProxyEvent)

function KeyEvent(ev) {
    for (var i = 0; i < ALL_PROPS.length; i++) {
        var propKey = ALL_PROPS[i]
        this[propKey] = ev[propKey]
    }

    for (var j = 0; j < KEY_PROPS.length; j++) {
        var keyPropKey = KEY_PROPS[j]
        this[keyPropKey] = ev[keyPropKey]
    }

    this._rawEvent = ev
}

inherits(KeyEvent, ProxyEvent)

},{"inherits":32}],15:[function(require,module,exports){
var EvStore = require("ev-store")

module.exports = removeEvent

function removeEvent(target, type, handler) {
    var events = EvStore(target)
    var event = events[type]

    if (!event) {
        return
    } else if (Array.isArray(event)) {
        var index = event.indexOf(handler)
        if (index !== -1) {
            event.splice(index, 1)
        }
    } else if (event === handler) {
        events[type] = null
    }
}

},{"ev-store":21}],16:[function(require,module,exports){
'use strict';

var trim = require('trim');
var prefix = require('prefix');
var prop = prefix('transform');
var propTransOrigin = prefix('transformOrigin');
var fns = require('./lib/properties');

var _has = Object.prototype.hasOwnProperty;

var shortcuts = {
  x: 'translateX',
  y: 'translateY',
  z: 'translateZ'
};


exports = module.exports = transform;

function transform(target, properties) {
  var output = [];
  var i;
  var name;
  var propValue;

  for (i in properties) {
    propValue = properties[i];

    // replace shortcut with its transform value.
    name = _has.call(shortcuts, i)
      ? name = shortcuts[i]
      : name = i;

    if (_has.call(fns, name)) {
      output.push(fns[name](numToString(propValue)));
      continue;
    }

    if (name === 'origin') {
      target.style[propTransOrigin] = propValue;
      continue;
    }

    console.warn(name, 'is not a valid property');
  }

  target.style[prop] = output.join(' ');
}


exports.get = get;

function get(target) {
  return style(target);
}


exports.none = none;

function none(target) {
  target.style[prop] = '';
  target.style[propTransOrigin] = '';
}


exports.isSupported = isSupported;

function isSupported() {
  return prop.length > 0;
}


function style(target) {
  return target.style[prop];
}


function numToString(value) {
  if (typeof value === 'number') {
    value += '';
  } else {
    value = trim(value);
  }

  return value;
}

},{"./lib/properties":18,"prefix":92,"trim":100}],17:[function(require,module,exports){
'use strict';

exports = module.exports = compose;

function compose() {
  var funcs = arguments;

  return function() {
    var args = arguments;
    for (var i = funcs.length-1; i >= 0; i--) {
      args = [funcs[i].apply(this, args)];
    }
    return args[0];
  };
}

},{}],18:[function(require,module,exports){
'use strict';

var trim = require('trim');
var compose = require('./compose');

var NUMBER_REGEX = /^-?\d+(\.\d+)?$/;

module.exports = {
  translate: compose(function(value) {
    return 'translate(' + value + ')';
  }, defaultUnit('px'), comma),

  translate3d: compose(function(value) {
    return 'translate3d(' + value + ')';
  }, defaultUnit('px'), comma),

  translateX: compose(function(x) {
    return 'translateX(' + x + ')';
  }, defaultUnit('px')),

  translateY: compose(function(y) {
    return 'translateY(' + y + ')';
  }, defaultUnit('px')),

  translateZ: compose(function(z) {
    return 'translateZ(' + z + ')';
  }, defaultUnit('px')),


  scale: compose(function(value) {
    return 'scale(' + value + ')';
  }, comma),

  scale3d: compose(function(value) {
    return 'scale3d(' + value + ')';
  }, comma),

  scaleX: function(value) {
    return 'scaleX(' + value + ')';
  },

  scaleY: function(value) {
    return 'scaleY(' + value + ')';
  },

  scaleZ: function(value) {
    return 'scaleZ(' + value + ')';
  },


  rotate: compose(function(value) {
    return 'rotate(' + value + ')';
  }, defaultUnit('deg'), comma),

  rotate3d: compose(function(value) {
    return 'rotate3d(' + value + ')';
  }, comma),

  rotateX: compose(function(value) {
    return 'rotateX(' + value + ')';
  }, defaultUnit('deg')),

  rotateY: compose(function(value) {
    return 'rotateY(' + value + ')';
  }, defaultUnit('deg')),

  rotateZ: compose(function(value) {
    return 'rotateZ(' + value + ')';
  }, defaultUnit('deg')),


  skew: compose(function(value) {
    return 'skew(' + value + ')';
  }, defaultUnit('deg'), comma),

  skewX: compose(function(value) {
    return 'skewX(' + value + ')';
  }, defaultUnit('deg')),

  skewY: compose(function(value) {
    return 'skewY(' + value + ')';
  }, defaultUnit('deg')),


  matrix: compose(function(value) {
    return 'matrix(' + value + ')';
  }, comma),

  matrix3d: compose(function(value) {
    return 'matrix3d(' + value + ')';
  }, comma),


  perspective: compose(function(value) {
    return 'perspective(' + value + ')';
  }, defaultUnit('px')),
};


function comma(value) {
  if (!/,/.test(value)) {
    value = value.split(' ').join(',');
  }

  return value;
}


function defaultUnit(unit) {
  return function(value) {
    return value.split(',').map(function(v) {
      v = trim(v);

      if (NUMBER_REGEX.test(v)) {
        v += unit;
      }

      return v;
    }).join(',');
  };
}

},{"./compose":17,"trim":100}],19:[function(require,module,exports){
module.exports = dragDrop

var flatten = require('flatten')
var parallel = require('run-parallel')

function dragDrop (elem, listeners) {
  if (typeof elem === 'string') elem = window.document.querySelector(elem)
  if (typeof listeners === 'function') listeners = { onDrop: listeners }

  var onDragOver = makeOnDragOver(elem, listeners.onDragOver)
  var onDragLeave = makeOnDragLeave(elem, listeners.onDragLeave)
  var onDrop = makeOnDrop(elem, listeners.onDrop, listeners.onDragLeave)

  elem.addEventListener('dragenter', stopEvent, false)
  elem.addEventListener('dragover', onDragOver, false)
  elem.addEventListener('dragleave', onDragLeave, false)
  elem.addEventListener('drop', onDrop, false)

  // Function to remove drag-drop listeners
  return function remove () {
    if (elem instanceof window.Element) elem.classList.remove('drag')
    elem.removeEventListener('dragenter', stopEvent, false)
    elem.removeEventListener('dragover', onDragOver, false)
    elem.removeEventListener('dragleave', onDragLeave, false)
    elem.removeEventListener('drop', onDrop, false)
  }
}

function stopEvent (e) {
  e.stopPropagation()
  e.preventDefault()
  return false
}

function makeOnDragOver (elem, ondragover) {
  return function (e) {
    e.stopPropagation()
    e.preventDefault()
    if (e.dataTransfer.items) {
      // Only add "drag" class when `items` contains a file
      var items = toArray(e.dataTransfer.items).filter(function (item) {
        return item.kind === 'file'
      })
      if (items.length === 0) return
    }

    if (elem instanceof window.Element) elem.classList.add('drag')
    e.dataTransfer.dropEffect = 'copy'
    if (ondragover) ondragover(e)
    return false
  }
}

function makeOnDragLeave (elem, ondragleave) {
  return function (e) {
    if (e.target !== elem) return
    e.stopPropagation()
    e.preventDefault()
    if (ondragleave) ondragleave(e)
    if (elem instanceof window.Element) elem.classList.remove('drag')
    return false
  }
}

function makeOnDrop (elem, ondrop, ondragleave) {
  return function (e) {
    e.stopPropagation()
    e.preventDefault()
    if (ondragleave) ondragleave(e)
    if (elem instanceof window.Element) elem.classList.remove('drag')
    var pos = { x: e.clientX, y: e.clientY }
    if (e.dataTransfer.items) {
      // Handle directories in Chrome using the proprietary FileSystem API
      var items = toArray(e.dataTransfer.items).filter(function (item) {
        return item.kind === 'file'
      })
      if (items.length === 0) return
      parallel(items.map(function (item) {
        return function (cb) {
          processEntry(item.webkitGetAsEntry(), cb)
        }
      }), function (err, results) {
        // There should never be an error in production code. This catches permission
        // errors with file:// in Chrome.
        if (err) throw err
        ondrop(flatten(results), pos)
      })
    } else {
      var files = toArray(e.dataTransfer.files)
      if (files.length === 0) return
      files.forEach(function (file) {
        file.fullPath = '/' + file.name
      })
      ondrop(files, pos)
    }

    return false
  }
}

function processEntry (entry, cb) {
  var entries = []

  if (entry.isFile) {
    entry.file(function (file) {
      file.fullPath = entry.fullPath  // preserve pathing for consumer
      cb(null, file)
    }, function (err) {
      cb(err)
    })
  } else if (entry.isDirectory) {
    var reader = entry.createReader()
    readEntries()
  }

  function readEntries () {
    reader.readEntries(function (entries_) {
      if (entries_.length > 0) {
        entries = entries.concat(toArray(entries_))
        readEntries() // continue reading entries until `readEntries` returns no more
      } else {
        doneEntries()
      }
    })
  }

  function doneEntries () {
    parallel(entries.map(function (entry) {
      return function (cb) {
        processEntry(entry, cb)
      }
    }), cb)
  }
}

function toArray (list) {
  return Array.prototype.slice.call(list || [], 0)
}

},{"flatten":24,"run-parallel":94}],20:[function(require,module,exports){
var camelize = require("camelize")
var template = require("string-template")
var extend = require("xtend/mutable")

module.exports = TypedError

function TypedError(args) {
    if (!args) {
        throw new Error("args is required");
    }
    if (!args.type) {
        throw new Error("args.type is required");
    }
    if (!args.message) {
        throw new Error("args.message is required");
    }

    var message = args.message

    if (args.type && !args.name) {
        var errorName = camelize(args.type) + "Error"
        args.name = errorName[0].toUpperCase() + errorName.substr(1)
    }

    extend(createError, args);
    createError._name = args.name;

    return createError;

    function createError(opts) {
        var result = new Error()

        Object.defineProperty(result, "type", {
            value: result.type,
            enumerable: true,
            writable: true,
            configurable: true
        })

        var options = extend({}, args, opts)

        extend(result, options)
        result.message = template(message, options)

        return result
    }
}


},{"camelize":8,"string-template":98,"xtend/mutable":135}],21:[function(require,module,exports){
'use strict';

var OneVersionConstraint = require('individual/one-version');

var MY_VERSION = '7';
OneVersionConstraint('ev-store', MY_VERSION);

var hashKey = '__EV_STORE_KEY@' + MY_VERSION;

module.exports = EvStore;

function EvStore(elem) {
    var hash = elem[hashKey];

    if (!hash) {
        hash = elem[hashKey] = {};
    }

    return hash;
}

},{"individual/one-version":23}],22:[function(require,module,exports){
(function (global){
'use strict';

/*global window, global*/

var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual;

function Individual(key, value) {
    if (key in root) {
        return root[key];
    }

    root[key] = value;

    return value;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],23:[function(require,module,exports){
'use strict';

var Individual = require('./index.js');

module.exports = OneVersion;

function OneVersion(moduleName, version, defaultValue) {
    var key = '__INDIVIDUAL_ONE_VERSION_' + moduleName;
    var enforceKey = key + '_ENFORCE_SINGLETON';

    var versionValue = Individual(enforceKey, version);

    if (versionValue !== version) {
        throw new Error('Can only have one copy of ' +
            moduleName + '.\n' +
            'You already have version ' + versionValue +
            ' installed.\n' +
            'This means you cannot install version ' + version);
    }

    return Individual(key, defaultValue);
}

},{"./index.js":22}],24:[function(require,module,exports){
module.exports = function flatten(list, depth) {
  depth = (typeof depth == 'number') ? depth : Infinity;

  if (!depth) {
    if (Array.isArray(list)) {
      return list.map(function(i) { return i; });
    }
    return list;
  }

  return _flatten(list, 1);

  function _flatten(list, d) {
    return list.reduce(function (acc, item) {
      if (Array.isArray(item) && d < depth) {
        return acc.concat(_flatten(item, d + 1));
      }
      else {
        return acc.concat(item);
      }
    }, []);
  }
};

},{}],25:[function(require,module,exports){
var isFunction = require('is-function')

module.exports = forEach

var toString = Object.prototype.toString
var hasOwnProperty = Object.prototype.hasOwnProperty

function forEach(list, iterator, context) {
    if (!isFunction(iterator)) {
        throw new TypeError('iterator must be a function')
    }

    if (arguments.length < 3) {
        context = this
    }
    
    if (toString.call(list) === '[object Array]')
        forEachArray(list, iterator, context)
    else if (typeof list === 'string')
        forEachString(list, iterator, context)
    else
        forEachObject(list, iterator, context)
}

function forEachArray(array, iterator, context) {
    for (var i = 0, len = array.length; i < len; i++) {
        if (hasOwnProperty.call(array, i)) {
            iterator.call(context, array[i], i, array)
        }
    }
}

function forEachString(string, iterator, context) {
    for (var i = 0, len = string.length; i < len; i++) {
        // no such thing as a sparse string.
        iterator.call(context, string.charAt(i), i, string)
    }
}

function forEachObject(object, iterator, context) {
    for (var k in object) {
        if (hasOwnProperty.call(object, k)) {
            iterator.call(context, object[k], k, object)
        }
    }
}

},{"is-function":33}],26:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":3}],27:[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window;
} else if (typeof global !== "undefined") {
    module.exports = global;
} else if (typeof self !== "undefined"){
    module.exports = self;
} else {
    module.exports = {};
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],28:[function(require,module,exports){
/*
Syntax highlighting with language autodetection.
https://highlightjs.org/
*/

(function(factory) {

  // Setup highlight.js for different environments. First is Node.js or
  // CommonJS.
  if(typeof exports !== 'undefined') {
    factory(exports);
  } else {
    // Export hljs globally even when using AMD for cases when this script
    // is loaded with others that may still expect a global hljs.
    self.hljs = factory({});

    // Finally register the global hljs with AMD.
    if(typeof define === 'function' && define.amd) {
      define('hljs', [], function() {
        return self.hljs;
      });
    }
  }

}(function(hljs) {

  /* Utility functions */

  function escape(value) {
    return value.replace(/&/gm, '&amp;').replace(/</gm, '&lt;').replace(/>/gm, '&gt;');
  }

  function tag(node) {
    return node.nodeName.toLowerCase();
  }

  function testRe(re, lexeme) {
    var match = re && re.exec(lexeme);
    return match && match.index == 0;
  }

  function isNotHighlighted(language) {
    return (/^(no-?highlight|plain|text)$/i).test(language);
  }

  function blockLanguage(block) {
    var i, match, length,
        classes = block.className + ' ';

    classes += block.parentNode ? block.parentNode.className : '';

    // language-* takes precedence over non-prefixed class names
    match = (/\blang(?:uage)?-([\w-]+)\b/i).exec(classes);
    if (match) {
      return getLanguage(match[1]) ? match[1] : 'no-highlight';
    }

    classes = classes.split(/\s+/);
    for (i = 0, length = classes.length; i < length; i++) {
      if (getLanguage(classes[i]) || isNotHighlighted(classes[i])) {
        return classes[i];
      }
    }
  }

  function inherit(parent, obj) {
    var result = {}, key;
    for (key in parent)
      result[key] = parent[key];
    if (obj)
      for (key in obj)
        result[key] = obj[key];
    return result;
  }

  /* Stream merging */

  function nodeStream(node) {
    var result = [];
    (function _nodeStream(node, offset) {
      for (var child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType == 3)
          offset += child.nodeValue.length;
        else if (child.nodeType == 1) {
          result.push({
            event: 'start',
            offset: offset,
            node: child
          });
          offset = _nodeStream(child, offset);
          // Prevent void elements from having an end tag that would actually
          // double them in the output. There are more void elements in HTML
          // but we list only those realistically expected in code display.
          if (!tag(child).match(/br|hr|img|input/)) {
            result.push({
              event: 'stop',
              offset: offset,
              node: child
            });
          }
        }
      }
      return offset;
    })(node, 0);
    return result;
  }

  function mergeStreams(original, highlighted, value) {
    var processed = 0;
    var result = '';
    var nodeStack = [];

    function selectStream() {
      if (!original.length || !highlighted.length) {
        return original.length ? original : highlighted;
      }
      if (original[0].offset != highlighted[0].offset) {
        return (original[0].offset < highlighted[0].offset) ? original : highlighted;
      }

      /*
      To avoid starting the stream just before it should stop the order is
      ensured that original always starts first and closes last:

      if (event1 == 'start' && event2 == 'start')
        return original;
      if (event1 == 'start' && event2 == 'stop')
        return highlighted;
      if (event1 == 'stop' && event2 == 'start')
        return original;
      if (event1 == 'stop' && event2 == 'stop')
        return highlighted;

      ... which is collapsed to:
      */
      return highlighted[0].event == 'start' ? original : highlighted;
    }

    function open(node) {
      function attr_str(a) {return ' ' + a.nodeName + '="' + escape(a.value) + '"';}
      result += '<' + tag(node) + Array.prototype.map.call(node.attributes, attr_str).join('') + '>';
    }

    function close(node) {
      result += '</' + tag(node) + '>';
    }

    function render(event) {
      (event.event == 'start' ? open : close)(event.node);
    }

    while (original.length || highlighted.length) {
      var stream = selectStream();
      result += escape(value.substr(processed, stream[0].offset - processed));
      processed = stream[0].offset;
      if (stream == original) {
        /*
        On any opening or closing tag of the original markup we first close
        the entire highlighted node stack, then render the original tag along
        with all the following original tags at the same offset and then
        reopen all the tags on the highlighted stack.
        */
        nodeStack.reverse().forEach(close);
        do {
          render(stream.splice(0, 1)[0]);
          stream = selectStream();
        } while (stream == original && stream.length && stream[0].offset == processed);
        nodeStack.reverse().forEach(open);
      } else {
        if (stream[0].event == 'start') {
          nodeStack.push(stream[0].node);
        } else {
          nodeStack.pop();
        }
        render(stream.splice(0, 1)[0]);
      }
    }
    return result + escape(value.substr(processed));
  }

  /* Initialization */

  function compileLanguage(language) {

    function reStr(re) {
        return (re && re.source) || re;
    }

    function langRe(value, global) {
      return new RegExp(
        reStr(value),
        'm' + (language.case_insensitive ? 'i' : '') + (global ? 'g' : '')
      );
    }

    function compileMode(mode, parent) {
      if (mode.compiled)
        return;
      mode.compiled = true;

      mode.keywords = mode.keywords || mode.beginKeywords;
      if (mode.keywords) {
        var compiled_keywords = {};

        var flatten = function(className, str) {
          if (language.case_insensitive) {
            str = str.toLowerCase();
          }
          str.split(' ').forEach(function(kw) {
            var pair = kw.split('|');
            compiled_keywords[pair[0]] = [className, pair[1] ? Number(pair[1]) : 1];
          });
        };

        if (typeof mode.keywords == 'string') { // string
          flatten('keyword', mode.keywords);
        } else {
          Object.keys(mode.keywords).forEach(function (className) {
            flatten(className, mode.keywords[className]);
          });
        }
        mode.keywords = compiled_keywords;
      }
      mode.lexemesRe = langRe(mode.lexemes || /\b\w+\b/, true);

      if (parent) {
        if (mode.beginKeywords) {
          mode.begin = '\\b(' + mode.beginKeywords.split(' ').join('|') + ')\\b';
        }
        if (!mode.begin)
          mode.begin = /\B|\b/;
        mode.beginRe = langRe(mode.begin);
        if (!mode.end && !mode.endsWithParent)
          mode.end = /\B|\b/;
        if (mode.end)
          mode.endRe = langRe(mode.end);
        mode.terminator_end = reStr(mode.end) || '';
        if (mode.endsWithParent && parent.terminator_end)
          mode.terminator_end += (mode.end ? '|' : '') + parent.terminator_end;
      }
      if (mode.illegal)
        mode.illegalRe = langRe(mode.illegal);
      if (mode.relevance === undefined)
        mode.relevance = 1;
      if (!mode.contains) {
        mode.contains = [];
      }
      var expanded_contains = [];
      mode.contains.forEach(function(c) {
        if (c.variants) {
          c.variants.forEach(function(v) {expanded_contains.push(inherit(c, v));});
        } else {
          expanded_contains.push(c == 'self' ? mode : c);
        }
      });
      mode.contains = expanded_contains;
      mode.contains.forEach(function(c) {compileMode(c, mode);});

      if (mode.starts) {
        compileMode(mode.starts, parent);
      }

      var terminators =
        mode.contains.map(function(c) {
          return c.beginKeywords ? '\\.?(' + c.begin + ')\\.?' : c.begin;
        })
        .concat([mode.terminator_end, mode.illegal])
        .map(reStr)
        .filter(Boolean);
      mode.terminators = terminators.length ? langRe(terminators.join('|'), true) : {exec: function(/*s*/) {return null;}};
    }

    compileMode(language);
  }

  /*
  Core highlighting function. Accepts a language name, or an alias, and a
  string with the code to highlight. Returns an object with the following
  properties:

  - relevance (int)
  - value (an HTML string with highlighting markup)

  */
  function highlight(name, value, ignore_illegals, continuation) {

    function subMode(lexeme, mode) {
      for (var i = 0; i < mode.contains.length; i++) {
        if (testRe(mode.contains[i].beginRe, lexeme)) {
          return mode.contains[i];
        }
      }
    }

    function endOfMode(mode, lexeme) {
      if (testRe(mode.endRe, lexeme)) {
        while (mode.endsParent && mode.parent) {
          mode = mode.parent;
        }
        return mode;
      }
      if (mode.endsWithParent) {
        return endOfMode(mode.parent, lexeme);
      }
    }

    function isIllegal(lexeme, mode) {
      return !ignore_illegals && testRe(mode.illegalRe, lexeme);
    }

    function keywordMatch(mode, match) {
      var match_str = language.case_insensitive ? match[0].toLowerCase() : match[0];
      return mode.keywords.hasOwnProperty(match_str) && mode.keywords[match_str];
    }

    function buildSpan(classname, insideSpan, leaveOpen, noPrefix) {
      var classPrefix = noPrefix ? '' : options.classPrefix,
          openSpan    = '<span class="' + classPrefix,
          closeSpan   = leaveOpen ? '' : '</span>';

      openSpan += classname + '">';

      return openSpan + insideSpan + closeSpan;
    }

    function processKeywords() {
      if (!top.keywords)
        return escape(mode_buffer);
      var result = '';
      var last_index = 0;
      top.lexemesRe.lastIndex = 0;
      var match = top.lexemesRe.exec(mode_buffer);
      while (match) {
        result += escape(mode_buffer.substr(last_index, match.index - last_index));
        var keyword_match = keywordMatch(top, match);
        if (keyword_match) {
          relevance += keyword_match[1];
          result += buildSpan(keyword_match[0], escape(match[0]));
        } else {
          result += escape(match[0]);
        }
        last_index = top.lexemesRe.lastIndex;
        match = top.lexemesRe.exec(mode_buffer);
      }
      return result + escape(mode_buffer.substr(last_index));
    }

    function processSubLanguage() {
      var explicit = typeof top.subLanguage == 'string';
      if (explicit && !languages[top.subLanguage]) {
        return escape(mode_buffer);
      }

      var result = explicit ?
                   highlight(top.subLanguage, mode_buffer, true, continuations[top.subLanguage]) :
                   highlightAuto(mode_buffer, top.subLanguage.length ? top.subLanguage : undefined);

      // Counting embedded language score towards the host language may be disabled
      // with zeroing the containing mode relevance. Usecase in point is Markdown that
      // allows XML everywhere and makes every XML snippet to have a much larger Markdown
      // score.
      if (top.relevance > 0) {
        relevance += result.relevance;
      }
      if (explicit) {
        continuations[top.subLanguage] = result.top;
      }
      return buildSpan(result.language, result.value, false, true);
    }

    function processBuffer() {
      return top.subLanguage !== undefined ? processSubLanguage() : processKeywords();
    }

    function startNewMode(mode, lexeme) {
      var markup = mode.className? buildSpan(mode.className, '', true): '';
      if (mode.returnBegin) {
        result += markup;
        mode_buffer = '';
      } else if (mode.excludeBegin) {
        result += escape(lexeme) + markup;
        mode_buffer = '';
      } else {
        result += markup;
        mode_buffer = lexeme;
      }
      top = Object.create(mode, {parent: {value: top}});
    }

    function processLexeme(buffer, lexeme) {

      mode_buffer += buffer;
      if (lexeme === undefined) {
        result += processBuffer();
        return 0;
      }

      var new_mode = subMode(lexeme, top);
      if (new_mode) {
        result += processBuffer();
        startNewMode(new_mode, lexeme);
        return new_mode.returnBegin ? 0 : lexeme.length;
      }

      var end_mode = endOfMode(top, lexeme);
      if (end_mode) {
        var origin = top;
        if (!(origin.returnEnd || origin.excludeEnd)) {
          mode_buffer += lexeme;
        }
        result += processBuffer();
        do {
          if (top.className) {
            result += '</span>';
          }
          relevance += top.relevance;
          top = top.parent;
        } while (top != end_mode.parent);
        if (origin.excludeEnd) {
          result += escape(lexeme);
        }
        mode_buffer = '';
        if (end_mode.starts) {
          startNewMode(end_mode.starts, '');
        }
        return origin.returnEnd ? 0 : lexeme.length;
      }

      if (isIllegal(lexeme, top))
        throw new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.className || '<unnamed>') + '"');

      /*
      Parser should not reach this point as all types of lexemes should be caught
      earlier, but if it does due to some bug make sure it advances at least one
      character forward to prevent infinite looping.
      */
      mode_buffer += lexeme;
      return lexeme.length || 1;
    }

    var language = getLanguage(name);
    if (!language) {
      throw new Error('Unknown language: "' + name + '"');
    }

    compileLanguage(language);
    var top = continuation || language;
    var continuations = {}; // keep continuations for sub-languages
    var result = '', current;
    for(current = top; current != language; current = current.parent) {
      if (current.className) {
        result = buildSpan(current.className, '', true) + result;
      }
    }
    var mode_buffer = '';
    var relevance = 0;
    try {
      var match, count, index = 0;
      while (true) {
        top.terminators.lastIndex = index;
        match = top.terminators.exec(value);
        if (!match)
          break;
        count = processLexeme(value.substr(index, match.index - index), match[0]);
        index = match.index + count;
      }
      processLexeme(value.substr(index));
      for(current = top; current.parent; current = current.parent) { // close dangling modes
        if (current.className) {
          result += '</span>';
        }
      }
      return {
        relevance: relevance,
        value: result,
        language: name,
        top: top
      };
    } catch (e) {
      if (e.message.indexOf('Illegal') != -1) {
        return {
          relevance: 0,
          value: escape(value)
        };
      } else {
        throw e;
      }
    }
  }

  /*
  Highlighting with language detection. Accepts a string with the code to
  highlight. Returns an object with the following properties:

  - language (detected language)
  - relevance (int)
  - value (an HTML string with highlighting markup)
  - second_best (object with the same structure for second-best heuristically
    detected language, may be absent)

  */
  function highlightAuto(text, languageSubset) {
    languageSubset = languageSubset || options.languages || Object.keys(languages);
    var result = {
      relevance: 0,
      value: escape(text)
    };
    var second_best = result;
    languageSubset.forEach(function(name) {
      if (!getLanguage(name)) {
        return;
      }
      var current = highlight(name, text, false);
      current.language = name;
      if (current.relevance > second_best.relevance) {
        second_best = current;
      }
      if (current.relevance > result.relevance) {
        second_best = result;
        result = current;
      }
    });
    if (second_best.language) {
      result.second_best = second_best;
    }
    return result;
  }

  /*
  Post-processing of the highlighted markup:

  - replace TABs with something more useful
  - replace real line-breaks with '<br>' for non-pre containers

  */
  function fixMarkup(value) {
    if (options.tabReplace) {
      value = value.replace(/^((<[^>]+>|\t)+)/gm, function(match, p1 /*..., offset, s*/) {
        return p1.replace(/\t/g, options.tabReplace);
      });
    }
    if (options.useBR) {
      value = value.replace(/\n/g, '<br>');
    }
    return value;
  }

  function buildClassName(prevClassName, currentLang, resultLang) {
    var language = currentLang ? aliases[currentLang] : resultLang,
        result   = [prevClassName.trim()];

    if (!prevClassName.match(/\bhljs\b/)) {
      result.push('hljs');
    }

    if (prevClassName.indexOf(language) === -1) {
      result.push(language);
    }

    return result.join(' ').trim();
  }

  /*
  Applies highlighting to a DOM node containing code. Accepts a DOM node and
  two optional parameters for fixMarkup.
  */
  function highlightBlock(block) {
    var language = blockLanguage(block);
    if (isNotHighlighted(language))
        return;

    var node;
    if (options.useBR) {
      node = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      node.innerHTML = block.innerHTML.replace(/\n/g, '').replace(/<br[ \/]*>/g, '\n');
    } else {
      node = block;
    }
    var text = node.textContent;
    var result = language ? highlight(language, text, true) : highlightAuto(text);

    var originalStream = nodeStream(node);
    if (originalStream.length) {
      var resultNode = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      resultNode.innerHTML = result.value;
      result.value = mergeStreams(originalStream, nodeStream(resultNode), text);
    }
    result.value = fixMarkup(result.value);

    block.innerHTML = result.value;
    block.className = buildClassName(block.className, language, result.language);
    block.result = {
      language: result.language,
      re: result.relevance
    };
    if (result.second_best) {
      block.second_best = {
        language: result.second_best.language,
        re: result.second_best.relevance
      };
    }
  }

  var options = {
    classPrefix: 'hljs-',
    tabReplace: null,
    useBR: false,
    languages: undefined
  };

  /*
  Updates highlight.js global options with values passed in the form of an object
  */
  function configure(user_options) {
    options = inherit(options, user_options);
  }

  /*
  Applies highlighting to all <pre><code>..</code></pre> blocks on a page.
  */
  function initHighlighting() {
    if (initHighlighting.called)
      return;
    initHighlighting.called = true;

    var blocks = document.querySelectorAll('pre code');
    Array.prototype.forEach.call(blocks, highlightBlock);
  }

  /*
  Attaches highlighting to the page load event.
  */
  function initHighlightingOnLoad() {
    addEventListener('DOMContentLoaded', initHighlighting, false);
    addEventListener('load', initHighlighting, false);
  }

  var languages = {};
  var aliases = {};

  function registerLanguage(name, language) {
    var lang = languages[name] = language(hljs);
    if (lang.aliases) {
      lang.aliases.forEach(function(alias) {aliases[alias] = name;});
    }
  }

  function listLanguages() {
    return Object.keys(languages);
  }

  function getLanguage(name) {
    name = (name || '').toLowerCase();
    return languages[name] || languages[aliases[name]];
  }

  /* Interface definition */

  hljs.highlight = highlight;
  hljs.highlightAuto = highlightAuto;
  hljs.fixMarkup = fixMarkup;
  hljs.highlightBlock = highlightBlock;
  hljs.configure = configure;
  hljs.initHighlighting = initHighlighting;
  hljs.initHighlightingOnLoad = initHighlightingOnLoad;
  hljs.registerLanguage = registerLanguage;
  hljs.listLanguages = listLanguages;
  hljs.getLanguage = getLanguage;
  hljs.inherit = inherit;

  // Common regexps
  hljs.IDENT_RE = '[a-zA-Z]\\w*';
  hljs.UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
  hljs.NUMBER_RE = '\\b\\d+(\\.\\d+)?';
  hljs.C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
  hljs.BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
  hljs.RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';

  // Common modes
  hljs.BACKSLASH_ESCAPE = {
    begin: '\\\\[\\s\\S]', relevance: 0
  };
  hljs.APOS_STRING_MODE = {
    className: 'string',
    begin: '\'', end: '\'',
    illegal: '\\n',
    contains: [hljs.BACKSLASH_ESCAPE]
  };
  hljs.QUOTE_STRING_MODE = {
    className: 'string',
    begin: '"', end: '"',
    illegal: '\\n',
    contains: [hljs.BACKSLASH_ESCAPE]
  };
  hljs.PHRASAL_WORDS_MODE = {
    begin: /\b(a|an|the|are|I|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|like)\b/
  };
  hljs.COMMENT = function (begin, end, inherits) {
    var mode = hljs.inherit(
      {
        className: 'comment',
        begin: begin, end: end,
        contains: []
      },
      inherits || {}
    );
    mode.contains.push(hljs.PHRASAL_WORDS_MODE);
    mode.contains.push({
      className: 'doctag',
      begin: "(?:TODO|FIXME|NOTE|BUG|XXX):",
      relevance: 0
    });
    return mode;
  };
  hljs.C_LINE_COMMENT_MODE = hljs.COMMENT('//', '$');
  hljs.C_BLOCK_COMMENT_MODE = hljs.COMMENT('/\\*', '\\*/');
  hljs.HASH_COMMENT_MODE = hljs.COMMENT('#', '$');
  hljs.NUMBER_MODE = {
    className: 'number',
    begin: hljs.NUMBER_RE,
    relevance: 0
  };
  hljs.C_NUMBER_MODE = {
    className: 'number',
    begin: hljs.C_NUMBER_RE,
    relevance: 0
  };
  hljs.BINARY_NUMBER_MODE = {
    className: 'number',
    begin: hljs.BINARY_NUMBER_RE,
    relevance: 0
  };
  hljs.CSS_NUMBER_MODE = {
    className: 'number',
    begin: hljs.NUMBER_RE + '(' +
      '%|em|ex|ch|rem'  +
      '|vw|vh|vmin|vmax' +
      '|cm|mm|in|pt|pc|px' +
      '|deg|grad|rad|turn' +
      '|s|ms' +
      '|Hz|kHz' +
      '|dpi|dpcm|dppx' +
      ')?',
    relevance: 0
  };
  hljs.REGEXP_MODE = {
    className: 'regexp',
    begin: /\//, end: /\/[gimuy]*/,
    illegal: /\n/,
    contains: [
      hljs.BACKSLASH_ESCAPE,
      {
        begin: /\[/, end: /\]/,
        relevance: 0,
        contains: [hljs.BACKSLASH_ESCAPE]
      }
    ]
  };
  hljs.TITLE_MODE = {
    className: 'title',
    begin: hljs.IDENT_RE,
    relevance: 0
  };
  hljs.UNDERSCORE_TITLE_MODE = {
    className: 'title',
    begin: hljs.UNDERSCORE_IDENT_RE,
    relevance: 0
  };

  return hljs;
}));

},{}],29:[function(require,module,exports){
module.exports = function(hljs) {
  var LITERALS = {literal: 'true false null'};
  var TYPES = [
    hljs.QUOTE_STRING_MODE,
    hljs.C_NUMBER_MODE
  ];
  var VALUE_CONTAINER = {
    end: ',', endsWithParent: true, excludeEnd: true,
    contains: TYPES,
    keywords: LITERALS
  };
  var OBJECT = {
    begin: '{', end: '}',
    contains: [
      {
        className: 'attr',
        begin: '\\s*"', end: '"\\s*:\\s*', excludeBegin: true, excludeEnd: true,
        contains: [hljs.BACKSLASH_ESCAPE],
        illegal: '\\n',
        starts: VALUE_CONTAINER
      }
    ],
    illegal: '\\S'
  };
  var ARRAY = {
    begin: '\\[', end: '\\]',
    contains: [hljs.inherit(VALUE_CONTAINER)], // inherit is a workaround for a bug that makes shared modes with endsWithParent compile only the ending of one of the parents
    illegal: '\\S'
  };
  TYPES.splice(TYPES.length, 0, OBJECT, ARRAY);
  return {
    contains: TYPES,
    keywords: LITERALS,
    illegal: '\\S'
  };
};
},{}],30:[function(require,module,exports){
var css = "/*\nMonokai style - ported by Luigi Maselli - http://grigio.org\n*/\n.hljs {\n  display: block;\n  overflow-x: auto;\n  padding: 0.5em;\n  background: #272822;\n  color: #ddd;\n}\n.hljs-tag,\n.hljs-keyword,\n.hljs-selector-tag,\n.hljs-literal,\n.hljs-strong,\n.hljs-name {\n  color: #f92672;\n}\n.hljs-code {\n  color: #66d9ef;\n}\n.hljs-class .hljs-title {\n  color: white;\n}\n.hljs-attribute,\n.hljs-symbol,\n.hljs-regexp,\n.hljs-link {\n  color: #bf79db;\n}\n.hljs-string,\n.hljs-bullet,\n.hljs-subst,\n.hljs-title,\n.hljs-section,\n.hljs-emphasis,\n.hljs-type,\n.hljs-built_in,\n.hljs-builtin-name,\n.hljs-selector-attr,\n.hljs-selector-pseudo,\n.hljs-addition,\n.hljs-variable,\n.hljs-template-tag,\n.hljs-template-variable {\n  color: #a6e22e;\n}\n.hljs-comment,\n.hljs-quote,\n.hljs-deletion,\n.hljs-meta {\n  color: #75715e;\n}\n.hljs-keyword,\n.hljs-selector-tag,\n.hljs-literal,\n.hljs-doctag,\n.hljs-title,\n.hljs-section,\n.hljs-type,\n.hljs-selector-id {\n  font-weight: bold;\n}\n"; (require("browserify-css").createStyle(css, { "href": "node_modules/highlight.js/styles/monokai.css"})); module.exports = css;
},{"browserify-css":5}],31:[function(require,module,exports){
(function (global){
var root = typeof window !== 'undefined' ?
    window : typeof global !== 'undefined' ?
    global : {};

module.exports = Individual

function Individual(key, value) {
    if (root[key]) {
        return root[key]
    }

    Object.defineProperty(root, key, {
        value: value
        , configurable: true
    })

    return value
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],32:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],33:[function(require,module,exports){
module.exports = isFunction

var toString = Object.prototype.toString

function isFunction (fn) {
  var string = toString.call(fn)
  return string === '[object Function]' ||
    (typeof fn === 'function' && string !== '[object RegExp]') ||
    (typeof window !== 'undefined' &&
     // IE8 and below
     (fn === window.setTimeout ||
      fn === window.alert ||
      fn === window.confirm ||
      fn === window.prompt))
};

},{}],34:[function(require,module,exports){
/*!
 * is-number <https://github.com/jonschlinkert/is-number>
 *
 * Copyright (c) 2014-2015, Jon Schlinkert.
 * Licensed under the MIT License.
 */

'use strict';

module.exports = function isNumber(n) {
  return (!!(+n) && !Array.isArray(n)) && isFinite(n)
    || n === '0'
    || n === 0;
};

},{}],35:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],36:[function(require,module,exports){
(function (global){
/**
 * lodash 4.5.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to match `RegExp` flags from their coerced string values. */
var reFlags = /\w*$/;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values supported by `_.clone`. */
var cloneableTags = {};
cloneableTags[argsTag] = cloneableTags[arrayTag] =
cloneableTags[arrayBufferTag] = cloneableTags[boolTag] =
cloneableTags[dateTag] = cloneableTags[float32Tag] =
cloneableTags[float64Tag] = cloneableTags[int8Tag] =
cloneableTags[int16Tag] = cloneableTags[int32Tag] =
cloneableTags[mapTag] = cloneableTags[numberTag] =
cloneableTags[objectTag] = cloneableTags[regexpTag] =
cloneableTags[setTag] = cloneableTags[stringTag] =
cloneableTags[symbolTag] = cloneableTags[uint8Tag] =
cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] =
cloneableTags[uint32Tag] = true;
cloneableTags[errorTag] = cloneableTags[funcTag] =
cloneableTags[weakMapTag] = false;

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect the popular CommonJS extension `module.exports`. */
var moduleExports = (freeModule && freeModule.exports === freeExports)
  ? freeExports
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Adds the key-value `pair` to `map`.
 *
 * @private
 * @param {Object} map The map to modify.
 * @param {Array} pair The key-value pair to add.
 * @returns {Object} Returns `map`.
 */
function addMapEntry(map, pair) {
  map.set(pair[0], pair[1]);
  return map;
}

/**
 * Adds `value` to `set`.
 *
 * @private
 * @param {Object} set The set to modify.
 * @param {*} value The value to add.
 * @returns {Object} Returns `set`.
 */
function addSetEntry(set, value) {
  set.add(value);
  return set;
}

/**
 * A specialized version of `_.forEach` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

/**
 * A specialized version of `_.reduce` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {*} [accumulator] The initial value.
 * @param {boolean} [initAccum] Specify using the first element of `array` as the initial value.
 * @returns {*} Returns the accumulated value.
 */
function arrayReduce(array, iteratee, accumulator, initAccum) {
  var index = -1,
      length = array.length;

  if (initAccum && length) {
    accumulator = array[++index];
  }
  while (++index < length) {
    accumulator = iteratee(accumulator, array[index], index, array);
  }
  return accumulator;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Converts `map` to an array.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the converted array.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Converts `set` to an array.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the converted array.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Buffer = moduleExports ? root.Buffer : undefined,
    Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    getPrototypeOf = Object.getPrototypeOf,
    getOwnPropertySymbols = Object.getOwnPropertySymbols,
    objectCreate = Object.create,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    splice = arrayProto.splice;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = Object.keys;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap'),
    nativeCreate = getNative(Object, 'create');

/** Used to detect maps, sets, and weakmaps. */
var mapCtorString = Map ? funcToString.call(Map) : '',
    setCtorString = Set ? funcToString.call(Set) : '',
    weakMapCtorString = WeakMap ? funcToString.call(WeakMap) : '';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = Symbol ? symbolProto.valueOf : undefined;

/**
 * Creates an hash object.
 *
 * @private
 * @constructor
 * @returns {Object} Returns the new hash object.
 */
function Hash() {}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(hash, key) {
  return hashHas(hash, key) && delete hash[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(hash, key) {
  if (nativeCreate) {
    var result = hash[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(hash, key) ? hash[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(hash, key) {
  return nativeCreate ? hash[key] !== undefined : hasOwnProperty.call(hash, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function hashSet(hash, key, value) {
  hash[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
}

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function MapCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': Map ? new Map : [],
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapDelete(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashDelete(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map['delete'](key) : assocDelete(data.map, key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapGet(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashGet(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.get(key) : assocGet(data.map, key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapHas(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashHas(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.has(key) : assocHas(data.map, key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache object.
 */
function mapSet(key, value) {
  var data = this.__data__;
  if (isKeyable(key)) {
    hashSet(typeof key == 'string' ? data.string : data.hash, key, value);
  } else if (Map) {
    data.map.set(key, value);
  } else {
    assocSet(data.map, key, value);
  }
  return this;
}

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function Stack(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = { 'array': [], 'map': null };
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocDelete(array, key) : data.map['delete'](key);
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocGet(array, key) : data.map.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocHas(array, key) : data.map.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache object.
 */
function stackSet(key, value) {
  var data = this.__data__,
      array = data.array;

  if (array) {
    if (array.length < (LARGE_ARRAY_SIZE - 1)) {
      assocSet(array, key, value);
    } else {
      data.array = null;
      data.map = new MapCache(array);
    }
  }
  var map = data.map;
  if (map) {
    map.set(key, value);
  }
  return this;
}

/**
 * Removes `key` and its value from the associative array.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function assocDelete(array, key) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = array.length - 1;
  if (index == lastIndex) {
    array.pop();
  } else {
    splice.call(array, index, 1);
  }
  return true;
}

/**
 * Gets the associative array value for `key`.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function assocGet(array, key) {
  var index = assocIndexOf(array, key);
  return index < 0 ? undefined : array[index][1];
}

/**
 * Checks if an associative array value for `key` exists.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function assocHas(array, key) {
  return assocIndexOf(array, key) > -1;
}

/**
 * Gets the index at which the first occurrence of `key` is found in `array`
 * of key-value pairs.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * Sets the associative array `key` to `value`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function assocSet(array, key, value) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    array.push([key, value]);
  } else {
    array[index][1] = value;
  }
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if ((!eq(objValue, value) ||
        (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * The base implementation of `_.assign` without support for multiple sources
 * or `customizer` functions.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @returns {Object} Returns `object`.
 */
function baseAssign(object, source) {
  return object && copyObject(source, keys(source), object);
}

/**
 * The base implementation of `_.clone` and `_.cloneDeep` which tracks
 * traversed objects.
 *
 * @private
 * @param {*} value The value to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @param {Function} [customizer] The function to customize cloning.
 * @param {string} [key] The key of `value`.
 * @param {Object} [object] The parent object of `value`.
 * @param {Object} [stack] Tracks traversed objects and their clone counterparts.
 * @returns {*} Returns the cloned value.
 */
function baseClone(value, isDeep, customizer, key, object, stack) {
  var result;
  if (customizer) {
    result = object ? customizer(value, key, object, stack) : customizer(value);
  }
  if (result !== undefined) {
    return result;
  }
  if (!isObject(value)) {
    return value;
  }
  var isArr = isArray(value);
  if (isArr) {
    result = initCloneArray(value);
    if (!isDeep) {
      return copyArray(value, result);
    }
  } else {
    var tag = getTag(value),
        isFunc = tag == funcTag || tag == genTag;

    if (isBuffer(value)) {
      return cloneBuffer(value, isDeep);
    }
    if (tag == objectTag || tag == argsTag || (isFunc && !object)) {
      if (isHostObject(value)) {
        return object ? value : {};
      }
      result = initCloneObject(isFunc ? {} : value);
      if (!isDeep) {
        return copySymbols(value, baseAssign(result, value));
      }
    } else {
      if (!cloneableTags[tag]) {
        return object ? value : {};
      }
      result = initCloneByTag(value, tag, isDeep);
    }
  }
  // Check for circular references and return its corresponding clone.
  stack || (stack = new Stack);
  var stacked = stack.get(value);
  if (stacked) {
    return stacked;
  }
  stack.set(value, result);

  // Recursively populate clone (susceptible to call stack limits).
  (isArr ? arrayEach : baseForOwn)(value, function(subValue, key) {
    assignValue(result, key, baseClone(subValue, isDeep, customizer, key, value, stack));
  });
  return isArr ? result : copySymbols(value, result);
}

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} prototype The object to inherit from.
 * @returns {Object} Returns the new object.
 */
function baseCreate(proto) {
  return isObject(proto) ? objectCreate(proto) : {};
}

/**
 * The base implementation of `baseForIn` and `baseForOwn` which iterates
 * over `object` properties returned by `keysFunc` invoking `iteratee` for
 * each property. Iteratee functions may exit iteration early by explicitly
 * returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

/**
 * The base implementation of `_.has` without support for deep paths.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHas(object, key) {
  // Avoid a bug in IE 10-11 where objects with a [[Prototype]] of `null`,
  // that are composed entirely of index properties, return `false` for
  // `hasOwnProperty` checks of them.
  return hasOwnProperty.call(object, key) ||
    (typeof object == 'object' && key in object && getPrototypeOf(object) === null);
}

/**
 * The base implementation of `_.keys` which doesn't skip the constructor
 * property of prototypes or treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  return nativeKeys(Object(object));
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Creates a clone of  `buffer`.
 *
 * @private
 * @param {Buffer} buffer The buffer to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Buffer} Returns the cloned buffer.
 */
function cloneBuffer(buffer, isDeep) {
  if (isDeep) {
    return buffer.slice();
  }
  var Ctor = buffer.constructor,
      result = new Ctor(buffer.length);

  buffer.copy(result);
  return result;
}

/**
 * Creates a clone of `arrayBuffer`.
 *
 * @private
 * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
 * @returns {ArrayBuffer} Returns the cloned array buffer.
 */
function cloneArrayBuffer(arrayBuffer) {
  var Ctor = arrayBuffer.constructor,
      result = new Ctor(arrayBuffer.byteLength),
      view = new Uint8Array(result);

  view.set(new Uint8Array(arrayBuffer));
  return result;
}

/**
 * Creates a clone of `map`.
 *
 * @private
 * @param {Object} map The map to clone.
 * @returns {Object} Returns the cloned map.
 */
function cloneMap(map) {
  var Ctor = map.constructor;
  return arrayReduce(mapToArray(map), addMapEntry, new Ctor);
}

/**
 * Creates a clone of `regexp`.
 *
 * @private
 * @param {Object} regexp The regexp to clone.
 * @returns {Object} Returns the cloned regexp.
 */
function cloneRegExp(regexp) {
  var Ctor = regexp.constructor,
      result = new Ctor(regexp.source, reFlags.exec(regexp));

  result.lastIndex = regexp.lastIndex;
  return result;
}

/**
 * Creates a clone of `set`.
 *
 * @private
 * @param {Object} set The set to clone.
 * @returns {Object} Returns the cloned set.
 */
function cloneSet(set) {
  var Ctor = set.constructor;
  return arrayReduce(setToArray(set), addSetEntry, new Ctor);
}

/**
 * Creates a clone of the `symbol` object.
 *
 * @private
 * @param {Object} symbol The symbol object to clone.
 * @returns {Object} Returns the cloned symbol object.
 */
function cloneSymbol(symbol) {
  return Symbol ? Object(symbolValueOf.call(symbol)) : {};
}

/**
 * Creates a clone of `typedArray`.
 *
 * @private
 * @param {Object} typedArray The typed array to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the cloned typed array.
 */
function cloneTypedArray(typedArray, isDeep) {
  var arrayBuffer = typedArray.buffer,
      buffer = isDeep ? cloneArrayBuffer(arrayBuffer) : arrayBuffer,
      Ctor = typedArray.constructor;

  return new Ctor(buffer, typedArray.byteOffset, typedArray.length);
}

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object) {
  return copyObjectWith(source, props, object);
}

/**
 * This function is like `copyObject` except that it accepts a function to
 * customize copied values.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObjectWith(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : source[key];

    assignValue(object, key, newValue);
  }
  return object;
}

/**
 * Copies own symbol properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy symbols from.
 * @param {Object} [object={}] The object to copy symbols to.
 * @returns {Object} Returns `object`.
 */
function copySymbols(source, object) {
  return copyObject(source, getSymbols(source), object);
}

/**
 * Creates a base function for methods like `_.forIn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Creates an array of the own symbol properties of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of symbols.
 */
var getSymbols = getOwnPropertySymbols || function() {
  return [];
};

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function getTag(value) {
  return objectToString.call(value);
}

// Fallback for IE 11 providing `toStringTag` values for maps, sets, and weakmaps.
if ((Map && getTag(new Map) != mapTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : null,
        ctorString = typeof Ctor == 'function' ? funcToString.call(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case mapCtorString: return mapTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Initializes an array clone.
 *
 * @private
 * @param {Array} array The array to clone.
 * @returns {Array} Returns the initialized clone.
 */
function initCloneArray(array) {
  var length = array.length,
      result = array.constructor(length);

  // Add properties assigned by `RegExp#exec`.
  if (length && typeof array[0] == 'string' && hasOwnProperty.call(array, 'index')) {
    result.index = array.index;
    result.input = array.input;
  }
  return result;
}

/**
 * Initializes an object clone.
 *
 * @private
 * @param {Object} object The object to clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneObject(object) {
  if (isPrototype(object)) {
    return {};
  }
  var Ctor = object.constructor;
  return baseCreate(isFunction(Ctor) ? Ctor.prototype : undefined);
}

/**
 * Initializes an object clone based on its `toStringTag`.
 *
 * **Note:** This function only supports cloning values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to clone.
 * @param {string} tag The `toStringTag` of the object to clone.
 * @param {boolean} [isDeep] Specify a deep clone.
 * @returns {Object} Returns the initialized clone.
 */
function initCloneByTag(object, tag, isDeep) {
  var Ctor = object.constructor;
  switch (tag) {
    case arrayBufferTag:
      return cloneArrayBuffer(object);

    case boolTag:
    case dateTag:
      return new Ctor(+object);

    case float32Tag: case float64Tag:
    case int8Tag: case int16Tag: case int32Tag:
    case uint8Tag: case uint8ClampedTag: case uint16Tag: case uint32Tag:
      return cloneTypedArray(object, isDeep);

    case mapTag:
      return cloneMap(object);

    case numberTag:
    case stringTag:
      return new Ctor(object);

    case regexpTag:
      return cloneRegExp(object);

    case setTag:
      return cloneSet(object);

    case symbolTag:
      return cloneSymbol(object);
  }
}

/**
 * Creates an array of index keys for `object` values of arrays,
 * `arguments` objects, and strings, otherwise `null` is returned.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array|null} Returns index keys, else `null`.
 */
function indexKeys(object) {
  var length = object ? object.length : undefined;
  if (isLength(length) &&
      (isArray(object) || isString(object) || isArguments(object))) {
    return baseTimes(length, String);
  }
  return null;
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'number' || type == 'boolean' ||
    (type == 'string' && value != '__proto__') || value == null;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is a buffer.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
 * @example
 *
 * _.isBuffer(new Buffer(2));
 * // => true
 *
 * _.isBuffer(new Uint8Array(2));
 * // => false
 */
var isBuffer = !Buffer ? constant(false) : function(value) {
  return value instanceof Buffer;
};

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  var isProto = isPrototype(object);
  if (!(isProto || isArrayLike(object))) {
    return baseKeys(object);
  }
  var indexes = indexKeys(object),
      skipIndexes = !!indexes,
      result = indexes || [],
      length = result.length;

  for (var key in object) {
    if (baseHas(object, key) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length))) &&
        !(isProto && key == 'constructor')) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Creates a function that returns `value`.
 *
 * @static
 * @memberOf _
 * @category Util
 * @param {*} value The value to return from the new function.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var getter = _.constant(object);
 *
 * getter() === object;
 * // => true
 */
function constant(value) {
  return function() {
    return value;
  };
}

// Avoid inheriting from `Object.prototype` when possible.
Hash.prototype = nativeCreate ? nativeCreate(null) : objectProto;

// Add functions to the `MapCache`.
MapCache.prototype.clear = mapClear;
MapCache.prototype['delete'] = mapDelete;
MapCache.prototype.get = mapGet;
MapCache.prototype.has = mapHas;
MapCache.prototype.set = mapSet;

// Add functions to the `Stack` cache.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = baseClone;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],37:[function(require,module,exports){
/**
 * lodash 4.0.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var keys = require('lodash.keys');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `_.forEach` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array|Object} Returns `collection`.
 */
var baseEach = createBaseEach(baseForOwn);

/**
 * The base implementation of `baseForIn` and `baseForOwn` which iterates
 * over `object` properties returned by `keysFunc` invoking `iteratee` for
 * each property. Iteratee functions may exit iteration early by explicitly
 * returning `false`.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @param {Function} keysFunc The function to get the keys of `object`.
 * @returns {Object} Returns `object`.
 */
var baseFor = createBaseFor();

/**
 * The base implementation of `_.forOwn` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Object} Returns `object`.
 */
function baseForOwn(object, iteratee) {
  return object && baseFor(object, iteratee, keys);
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Creates a `baseEach` or `baseEachRight` function.
 *
 * @private
 * @param {Function} eachFunc The function to iterate over a collection.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseEach(eachFunc, fromRight) {
  return function(collection, iteratee) {
    if (collection == null) {
      return collection;
    }
    if (!isArrayLike(collection)) {
      return eachFunc(collection, iteratee);
    }
    var length = collection.length,
        index = fromRight ? length : -1,
        iterable = Object(collection);

    while ((fromRight ? index-- : ++index < length)) {
      if (iteratee(iterable[index], index, iterable) === false) {
        break;
      }
    }
    return collection;
  };
}

/**
 * Creates a base function for methods like `_.forIn`.
 *
 * @private
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {Function} Returns the new base function.
 */
function createBaseFor(fromRight) {
  return function(object, iteratee, keysFunc) {
    var index = -1,
        iterable = Object(object),
        props = keysFunc(object),
        length = props.length;

    while (length--) {
      var key = props[fromRight ? length : ++index];
      if (iteratee(iterable[key], key, iterable) === false) {
        break;
      }
    }
    return object;
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = baseEach;

},{"lodash.keys":38}],38:[function(require,module,exports){
/**
 * lodash 4.0.3 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var getPrototypeOf = Object.getPrototypeOf,
    propertyIsEnumerable = objectProto.propertyIsEnumerable;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = Object.keys;

/**
 * The base implementation of `_.has` without support for deep paths.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHas(object, key) {
  // Avoid a bug in IE 10-11 where objects with a [[Prototype]] of `null`,
  // that are composed entirely of index properties, return `false` for
  // `hasOwnProperty` checks of them.
  return hasOwnProperty.call(object, key) ||
    (typeof object == 'object' && key in object && getPrototypeOf(object) === null);
}

/**
 * The base implementation of `_.keys` which doesn't skip the constructor
 * property of prototypes or treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  return nativeKeys(Object(object));
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Creates an array of index keys for `object` values of arrays,
 * `arguments` objects, and strings, otherwise `null` is returned.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array|null} Returns index keys, else `null`.
 */
function indexKeys(object) {
  var length = object ? object.length : undefined;
  if (isLength(length) &&
      (isArray(object) || isString(object) || isArguments(object))) {
    return baseTimes(length, String);
  }
  return null;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  var isProto = isPrototype(object);
  if (!(isProto || isArrayLike(object))) {
    return baseKeys(object);
  }
  var indexes = indexKeys(object),
      skipIndexes = !!indexes,
      result = indexes || [],
      length = result.length;

  for (var key in object) {
    if (baseHas(object, key) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length))) &&
        !(isProto && key == 'constructor')) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keys;

},{}],39:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * The base implementation of `_.find`, `_.findLast`, `_.findKey`, and `_.findLastKey`,
 * without support for callback shorthands and `this` binding, which iterates
 * over `collection` using the provided `eachFunc`.
 *
 * @private
 * @param {Array|Object|string} collection The collection to search.
 * @param {Function} predicate The function invoked per iteration.
 * @param {Function} eachFunc The function to iterate over `collection`.
 * @param {boolean} [retKey] Specify returning the key of the found element
 *  instead of the element itself.
 * @returns {*} Returns the found element or its key, else `undefined`.
 */
function baseFind(collection, predicate, eachFunc, retKey) {
  var result;
  eachFunc(collection, function(value, key, collection) {
    if (predicate(value, key, collection)) {
      result = retKey ? key : value;
      return false;
    }
  });
  return result;
}

module.exports = baseFind;

},{}],40:[function(require,module,exports){
/**
 * lodash 3.6.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * The base implementation of `_.findIndex` and `_.findLastIndex` without
 * support for callback shorthands and `this` binding.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {Function} predicate The function invoked per iteration.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseFindIndex(array, predicate, fromRight) {
  var length = array.length,
      index = fromRight ? length : -1;

  while ((fromRight ? index-- : ++index < length)) {
    if (predicate(array[index], index, array)) {
      return index;
    }
  }
  return -1;
}

module.exports = baseFindIndex;

},{}],41:[function(require,module,exports){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.flatten` with support for restricting flattening.
 *
 * @private
 * @param {Array} array The array to flatten.
 * @param {number} depth The maximum recursion depth.
 * @param {boolean} [isStrict] Restrict flattening to arrays-like objects.
 * @param {Array} [result=[]] The initial result value.
 * @returns {Array} Returns the new flattened array.
 */
function baseFlatten(array, depth, isStrict, result) {
  result || (result = []);

  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index];
    if (depth > 0 && isArrayLikeObject(value) &&
        (isStrict || isArray(value) || isArguments(value))) {
      if (depth > 1) {
        // Recursively flatten arrays (susceptible to call stack limits).
        baseFlatten(value, depth - 1, isStrict, result);
      } else {
        arrayPush(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = baseFlatten;

},{}],42:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var isFunction = require('lodash.isfunction');

/**
 * The base implementation of `_.functions` which creates an array of
 * `object` function property names filtered from those provided.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Array} props The property names to filter.
 * @returns {Array} Returns the new array of filtered property names.
 */
function baseFunctions(object, props) {
  var index = -1,
      length = props.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    var key = props[index];
    if (isFunction(object[key])) {
      result[++resIndex] = key;
    }
  }
  return result;
}

module.exports = baseFunctions;

},{"lodash.isfunction":68}],43:[function(require,module,exports){
(function (global){
/**
 * lodash 4.5.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to compose bitmasks for comparison styles. */
var UNORDERED_COMPARE_FLAG = 1,
    PARTIAL_COMPARE_FLAG = 2;

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/,
    rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]/g;

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dateTag] = typedArrayTags[errorTag] =
typedArrayTags[funcTag] = typedArrayTags[mapTag] =
typedArrayTags[numberTag] = typedArrayTags[objectTag] =
typedArrayTags[regexpTag] = typedArrayTags[setTag] =
typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check, else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * The base implementation of `_.toPairs` and `_.toPairsIn` which creates an array
 * of key-value pairs for `object` corresponding to the property names of `props`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} props The property names to get values for.
 * @returns {Object} Returns the new array of key-value pairs.
 */
function baseToPairs(object, props) {
  return arrayMap(props, function(key) {
    return [key, object[key]];
  });
}

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Converts `map` to an array.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the converted array.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Converts `set` to an array.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the converted array.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    getPrototypeOf = Object.getPrototypeOf,
    propertyIsEnumerable = objectProto.propertyIsEnumerable,
    splice = arrayProto.splice;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeKeys = Object.keys;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap'),
    nativeCreate = getNative(Object, 'create');

/** Used to detect maps, sets, and weakmaps. */
var mapCtorString = Map ? funcToString.call(Map) : '',
    setCtorString = Set ? funcToString.call(Set) : '',
    weakMapCtorString = WeakMap ? funcToString.call(WeakMap) : '';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = Symbol ? symbolProto.valueOf : undefined,
    symbolToString = Symbol ? symbolProto.toString : undefined;

/**
 * Creates an hash object.
 *
 * @private
 * @constructor
 * @returns {Object} Returns the new hash object.
 */
function Hash() {}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(hash, key) {
  return hashHas(hash, key) && delete hash[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(hash, key) {
  if (nativeCreate) {
    var result = hash[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(hash, key) ? hash[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(hash, key) {
  return nativeCreate ? hash[key] !== undefined : hasOwnProperty.call(hash, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function hashSet(hash, key, value) {
  hash[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
}

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function MapCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': Map ? new Map : [],
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapDelete(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashDelete(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map['delete'](key) : assocDelete(data.map, key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapGet(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashGet(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.get(key) : assocGet(data.map, key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapHas(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashHas(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.has(key) : assocHas(data.map, key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache object.
 */
function mapSet(key, value) {
  var data = this.__data__;
  if (isKeyable(key)) {
    hashSet(typeof key == 'string' ? data.string : data.hash, key, value);
  } else if (Map) {
    data.map.set(key, value);
  } else {
    assocSet(data.map, key, value);
  }
  return this;
}

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function Stack(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = { 'array': [], 'map': null };
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocDelete(array, key) : data.map['delete'](key);
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocGet(array, key) : data.map.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocHas(array, key) : data.map.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache object.
 */
function stackSet(key, value) {
  var data = this.__data__,
      array = data.array;

  if (array) {
    if (array.length < (LARGE_ARRAY_SIZE - 1)) {
      assocSet(array, key, value);
    } else {
      data.array = null;
      data.map = new MapCache(array);
    }
  }
  var map = data.map;
  if (map) {
    map.set(key, value);
  }
  return this;
}

/**
 * Removes `key` and its value from the associative array.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function assocDelete(array, key) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = array.length - 1;
  if (index == lastIndex) {
    array.pop();
  } else {
    splice.call(array, index, 1);
  }
  return true;
}

/**
 * Gets the associative array value for `key`.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function assocGet(array, key) {
  var index = assocIndexOf(array, key);
  return index < 0 ? undefined : array[index][1];
}

/**
 * Checks if an associative array value for `key` exists.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function assocHas(array, key) {
  return assocIndexOf(array, key) > -1;
}

/**
 * Gets the index at which the first occurrence of `key` is found in `array`
 * of key-value pairs.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * Sets the associative array `key` to `value`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function assocSet(array, key, value) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    array.push([key, value]);
  } else {
    array[index][1] = value;
  }
}

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Array} Returns the cast property path array.
 */
function baseCastPath(value) {
  return isArray(value) ? value : stringToPath(value);
}

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = isKey(path, object) ? [path + ''] : baseCastPath(path);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[path[index++]];
  }
  return (index && index == length) ? object : undefined;
}

/**
 * The base implementation of `_.has` without support for deep paths.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHas(object, key) {
  // Avoid a bug in IE 10-11 where objects with a [[Prototype]] of `null`,
  // that are composed entirely of index properties, return `false` for
  // `hasOwnProperty` checks of them.
  return hasOwnProperty.call(object, key) ||
    (typeof object == 'object' && key in object && getPrototypeOf(object) === null);
}

/**
 * The base implementation of `_.hasIn` without support for deep paths.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHasIn(object, key) {
  return key in Object(object);
}

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {boolean} [bitmask] The bitmask of comparison flags.
 *  The bitmask may be composed of the following flags:
 *     1 - Unordered comparison
 *     2 - Partial comparison
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, customizer, bitmask, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, baseIsEqual, customizer, bitmask, stack);
}

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, equalFunc, customizer, bitmask, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = arrayTag,
      othTag = arrayTag;

  if (!objIsArr) {
    objTag = getTag(object);
    if (objTag == argsTag) {
      objTag = objectTag;
    } else if (objTag != objectTag) {
      objIsArr = isTypedArray(object);
    }
  }
  if (!othIsArr) {
    othTag = getTag(other);
    if (othTag == argsTag) {
      othTag = objectTag;
    } else if (othTag != objectTag) {
      othIsArr = isTypedArray(other);
    }
  }
  var objIsObj = objTag == objectTag && !isHostObject(object),
      othIsObj = othTag == objectTag && !isHostObject(other),
      isSameTag = objTag == othTag;

  if (isSameTag && !(objIsArr || objIsObj)) {
    return equalByTag(object, other, objTag, equalFunc, customizer, bitmask);
  }
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
  if (!isPartial) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      return equalFunc(objIsWrapped ? object.value() : object, othIsWrapped ? other.value() : other, customizer, bitmask, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return (objIsArr ? equalArrays : equalObjects)(object, other, equalFunc, customizer, bitmask, stack);
}

/**
 * The base implementation of `_.isMatch` without support for iteratee shorthands.
 *
 * @private
 * @param {Object} object The object to inspect.
 * @param {Object} source The object of property values to match.
 * @param {Array} matchData The property names, values, and compare flags to match.
 * @param {Function} [customizer] The function to customize comparisons.
 * @returns {boolean} Returns `true` if `object` is a match, else `false`.
 */
function baseIsMatch(object, source, matchData, customizer) {
  var index = matchData.length,
      length = index,
      noCustomizer = !customizer;

  if (object == null) {
    return !length;
  }
  object = Object(object);
  while (index--) {
    var data = matchData[index];
    if ((noCustomizer && data[2])
          ? data[1] !== object[data[0]]
          : !(data[0] in object)
        ) {
      return false;
    }
  }
  while (++index < length) {
    data = matchData[index];
    var key = data[0],
        objValue = object[key],
        srcValue = data[1];

    if (noCustomizer && data[2]) {
      if (objValue === undefined && !(key in object)) {
        return false;
      }
    } else {
      var stack = new Stack,
          result = customizer ? customizer(objValue, srcValue, key, object, source, stack) : undefined;

      if (!(result === undefined
            ? baseIsEqual(srcValue, objValue, customizer, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG, stack)
            : result
          )) {
        return false;
      }
    }
  }
  return true;
}

/**
 * The base implementation of `_.iteratee`.
 *
 * @private
 * @param {*} [value=_.identity] The value to convert to an iteratee.
 * @returns {Function} Returns the iteratee.
 */
function baseIteratee(value) {
  var type = typeof value;
  if (type == 'function') {
    return value;
  }
  if (value == null) {
    return identity;
  }
  if (type == 'object') {
    return isArray(value)
      ? baseMatchesProperty(value[0], value[1])
      : baseMatches(value);
  }
  return property(value);
}

/**
 * The base implementation of `_.keys` which doesn't skip the constructor
 * property of prototypes or treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeys(object) {
  return nativeKeys(Object(object));
}

/**
 * The base implementation of `_.matches` which doesn't clone `source`.
 *
 * @private
 * @param {Object} source The object of property values to match.
 * @returns {Function} Returns the new function.
 */
function baseMatches(source) {
  var matchData = getMatchData(source);
  if (matchData.length == 1 && matchData[0][2]) {
    var key = matchData[0][0],
        value = matchData[0][1];

    return function(object) {
      if (object == null) {
        return false;
      }
      return object[key] === value &&
        (value !== undefined || (key in Object(object)));
    };
  }
  return function(object) {
    return object === source || baseIsMatch(object, source, matchData);
  };
}

/**
 * The base implementation of `_.matchesProperty` which doesn't clone `srcValue`.
 *
 * @private
 * @param {string} path The path of the property to get.
 * @param {*} srcValue The value to match.
 * @returns {Function} Returns the new function.
 */
function baseMatchesProperty(path, srcValue) {
  return function(object) {
    var objValue = get(object, path);
    return (objValue === undefined && objValue === srcValue)
      ? hasIn(object, path)
      : baseIsEqual(srcValue, objValue, undefined, UNORDERED_COMPARE_FLAG | PARTIAL_COMPARE_FLAG);
  };
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * A specialized version of `baseProperty` which supports deep paths.
 *
 * @private
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new function.
 */
function basePropertyDeep(path) {
  return function(object) {
    return baseGet(object, path);
  };
}

/**
 * The base implementation of `_.slice` without an iteratee call guard.
 *
 * @private
 * @param {Array} array The array to slice.
 * @param {number} [start=0] The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the slice of `array`.
 */
function baseSlice(array, start, end) {
  var index = -1,
      length = array.length;

  if (start < 0) {
    start = -start > length ? 0 : (length + start);
  }
  end = end > length ? length : end;
  if (end < 0) {
    end += length;
  }
  length = start > end ? 0 : ((end - start) >>> 0);
  start >>>= 0;

  var result = Array(length);
  while (++index < length) {
    result[index] = array[index + start];
  }
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, equalFunc, customizer, bitmask, stack) {
  var index = -1,
      isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      isUnordered = bitmask & UNORDERED_COMPARE_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(array);
  if (stacked) {
    return stacked == other;
  }
  var result = true;
  stack.set(array, other);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (isUnordered) {
      if (!arraySome(other, function(othValue) {
            return arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack);
          })) {
        result = false;
        break;
      }
    } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack))) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, equalFunc, customizer, bitmask) {
  switch (tag) {
    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
      // Coerce dates and booleans to numbers, dates to milliseconds and booleans
      // to `1` or `0` treating invalid dates coerced to `NaN` as not equal.
      return +object == +other;

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case numberTag:
      // Treat `NaN` vs. `NaN` as equal.
      return (object != +object) ? other != +other : object == +other;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings primitives and string
      // objects as equal. See https://es5.github.io/#x15.10.6.4 for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
      convert || (convert = setToArray);

      // Recursively compare objects (susceptible to call stack limits).
      return (isPartial || object.size == other.size) &&
        equalFunc(convert(object), convert(other), customizer, bitmask | UNORDERED_COMPARE_FLAG);

    case symbolTag:
      return !!Symbol && (symbolValueOf.call(object) == symbolValueOf.call(other));
  }
  return false;
}

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, equalFunc, customizer, bitmask, stack) {
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      objProps = keys(object),
      objLength = objProps.length,
      othProps = keys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : baseHas(other, key))) {
      return false;
    }
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(object);
  if (stacked) {
    return stacked == other;
  }
  var result = true;
  stack.set(object, other);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, customizer, bitmask, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  return result;
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Gets the property names, values, and compare flags of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the match data of `object`.
 */
function getMatchData(object) {
  var result = toPairs(object),
      length = result.length;

  while (length--) {
    result[length][2] = isStrictComparable(result[length][1]);
  }
  return result;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function getTag(value) {
  return objectToString.call(value);
}

// Fallback for IE 11 providing `toStringTag` values for maps, sets, and weakmaps.
if ((Map && getTag(new Map) != mapTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : null,
        ctorString = typeof Ctor == 'function' ? funcToString.call(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case mapCtorString: return mapTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Checks if `path` exists on `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @param {Function} hasFunc The function to check properties.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 */
function hasPath(object, path, hasFunc) {
  if (object == null) {
    return false;
  }
  var result = hasFunc(object, path);
  if (!result && !isKey(path)) {
    path = baseCastPath(path);
    object = parent(object, path);
    if (object != null) {
      path = last(path);
      result = hasFunc(object, path);
    }
  }
  var length = object ? object.length : undefined;
  return result || (
    !!length && isLength(length) && isIndex(path, length) &&
    (isArray(object) || isString(object) || isArguments(object))
  );
}

/**
 * Creates an array of index keys for `object` values of arrays,
 * `arguments` objects, and strings, otherwise `null` is returned.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array|null} Returns index keys, else `null`.
 */
function indexKeys(object) {
  var length = object ? object.length : undefined;
  if (isLength(length) &&
      (isArray(object) || isString(object) || isArguments(object))) {
    return baseTimes(length, String);
  }
  return null;
}

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (typeof value == 'number') {
    return true;
  }
  return !isArray(value) &&
    (reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
      (object != null && value in Object(object)));
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'number' || type == 'boolean' ||
    (type == 'string' && value != '__proto__') || value == null;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is suitable for strict equality comparisons, i.e. `===`.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` if suitable for strict
 *  equality comparisons, else `false`.
 */
function isStrictComparable(value) {
  return value === value && !isObject(value);
}

/**
 * Gets the parent value at `path` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} path The path to get the parent value of.
 * @returns {*} Returns the parent value.
 */
function parent(object, path) {
  return path.length == 1 ? object : get(object, baseSlice(path, 0, -1));
}

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
function stringToPath(string) {
  var result = [];
  toString(string).replace(rePropName, function(match, number, quote, string) {
    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
}

/**
 * Gets the last element of `array`.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to query.
 * @returns {*} Returns the last element of `array`.
 * @example
 *
 * _.last([1, 2, 3]);
 * // => 3
 */
function last(array) {
  var length = array ? array.length : 0;
  return length ? array[length - 1] : undefined;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
function isTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
}

/**
 * Converts `value` to a string if it's not one. An empty string is returned
 * for `null` and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  if (isSymbol(value)) {
    return Symbol ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined` the `defaultValue` is used in its place.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned if the resolved value is `undefined`.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

/**
 * Checks if `path` is a direct or inherited property of `object`.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path to check.
 * @returns {boolean} Returns `true` if `path` exists, else `false`.
 * @example
 *
 * var object = _.create({ 'a': _.create({ 'b': _.create({ 'c': 3 }) }) });
 *
 * _.hasIn(object, 'a');
 * // => true
 *
 * _.hasIn(object, 'a.b.c');
 * // => true
 *
 * _.hasIn(object, ['a', 'b', 'c']);
 * // => true
 *
 * _.hasIn(object, 'b');
 * // => false
 */
function hasIn(object, path) {
  return hasPath(object, path, baseHasIn);
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
function keys(object) {
  var isProto = isPrototype(object);
  if (!(isProto || isArrayLike(object))) {
    return baseKeys(object);
  }
  var indexes = indexKeys(object),
      skipIndexes = !!indexes,
      result = indexes || [],
      length = result.length;

  for (var key in object) {
    if (baseHas(object, key) &&
        !(skipIndexes && (key == 'length' || isIndex(key, length))) &&
        !(isProto && key == 'constructor')) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Creates an array of own enumerable key-value pairs for `object` which
 * can be consumed by `_.fromPairs`.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the new array of key-value pairs.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.toPairs(new Foo);
 * // => [['a', 1], ['b', 2]] (iteration order is not guaranteed)
 */
function toPairs(object) {
  return baseToPairs(object, keys(object));
}

/**
 * This method returns the first argument given to it.
 *
 * @static
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

/**
 * Creates a function that returns the value at `path` of a given object.
 *
 * @static
 * @memberOf _
 * @category Util
 * @param {Array|string} path The path of the property to get.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var objects = [
 *   { 'a': { 'b': { 'c': 2 } } },
 *   { 'a': { 'b': { 'c': 1 } } }
 * ];
 *
 * _.map(objects, _.property('a.b.c'));
 * // => [2, 1]
 *
 * _.map(_.sortBy(objects, _.property(['a', 'b', 'c'])), 'a.b.c');
 * // => [1, 2]
 */
function property(path) {
  return isKey(path) ? baseProperty(path) : basePropertyDeep(path);
}

// Avoid inheriting from `Object.prototype` when possible.
Hash.prototype = nativeCreate ? nativeCreate(null) : objectProto;

// Add functions to the `MapCache`.
MapCache.prototype.clear = mapClear;
MapCache.prototype['delete'] = mapDelete;
MapCache.prototype.get = mapGet;
MapCache.prototype.has = mapHas;
MapCache.prototype.set = mapSet;

// Add functions to the `Stack` cache.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = baseIteratee;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],44:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseSlice = require('lodash._baseslice'),
    toString = require('lodash.tostring');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** Used to match property names within property paths. */
var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
    reIsPlainProp = /^\w*$/,
    rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]/g;

/** Used to match backslashes in property paths. */
var reEscapeChar = /\\(\\)?/g;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype;

/** Built-in value references. */
var splice = arrayProto.splice;

/**
 * Casts `value` to a path array if it's not one.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Array} Returns the cast property path array.
 */
function baseCastPath(value) {
  return isArray(value) ? value : stringToPath(value);
}

/**
 * The base implementation of `_.get` without support for default values.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @returns {*} Returns the resolved value.
 */
function baseGet(object, path) {
  path = isKey(path, object) ? [path + ''] : baseCastPath(path);

  var index = 0,
      length = path.length;

  while (object != null && index < length) {
    object = object[path[index++]];
  }
  return (index && index == length) ? object : undefined;
}

/**
 * The base implementation of `_.pullAt` without support for individual
 * indexes or capturing the removed elements.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {number[]} indexes The indexes of elements to remove.
 * @returns {Array} Returns `array`.
 */
function basePullAt(array, indexes) {
  var length = array ? indexes.length : 0,
      lastIndex = length - 1;

  while (length--) {
    var index = indexes[length];
    if (lastIndex == length || index != previous) {
      var previous = index;
      if (isIndex(index)) {
        splice.call(array, index, 1);
      }
      else if (!isKey(index, array)) {
        var path = baseCastPath(index),
            object = parent(array, path);

        if (object != null) {
          delete object[last(path)];
        }
      }
      else {
        delete array[index];
      }
    }
  }
  return array;
}

/**
 * Checks if `value` is a property name and not a property path.
 *
 * @private
 * @param {*} value The value to check.
 * @param {Object} [object] The object to query keys on.
 * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
 */
function isKey(value, object) {
  if (typeof value == 'number') {
    return true;
  }
  return !isArray(value) &&
    (reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
      (object != null && value in Object(object)));
}

/**
 * Gets the parent value at `path` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array} path The path to get the parent value of.
 * @returns {*} Returns the parent value.
 */
function parent(object, path) {
  return path.length == 1 ? object : get(object, baseSlice(path, 0, -1));
}

/**
 * Converts `string` to a property path array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the property path array.
 */
function stringToPath(string) {
  var result = [];
  toString(string).replace(rePropName, function(match, number, quote, string) {
    result.push(quote ? string.replace(reEscapeChar, '$1') : (number || match));
  });
  return result;
}

/**
 * Gets the last element of `array`.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to query.
 * @returns {*} Returns the last element of `array`.
 * @example
 *
 * _.last([1, 2, 3]);
 * // => 3
 */
function last(array) {
  var length = array ? array.length : 0;
  return length ? array[length - 1] : undefined;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Gets the value at `path` of `object`. If the resolved value is
 * `undefined` the `defaultValue` is used in its place.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @param {Array|string} path The path of the property to get.
 * @param {*} [defaultValue] The value returned if the resolved value is `undefined`.
 * @returns {*} Returns the resolved value.
 * @example
 *
 * var object = { 'a': [{ 'b': { 'c': 3 } }] };
 *
 * _.get(object, 'a[0].b.c');
 * // => 3
 *
 * _.get(object, ['a', '0', 'b', 'c']);
 * // => 3
 *
 * _.get(object, 'a.b.c', 'default');
 * // => 'default'
 */
function get(object, path, defaultValue) {
  var result = object == null ? undefined : baseGet(object, path);
  return result === undefined ? defaultValue : result;
}

module.exports = basePullAt;

},{"lodash._baseslice":45,"lodash.tostring":84}],45:[function(require,module,exports){
/**
 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * The base implementation of `_.slice` without an iteratee call guard.
 *
 * @private
 * @param {Array} array The array to slice.
 * @param {number} [start=0] The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the slice of `array`.
 */
function baseSlice(array, start, end) {
  var index = -1,
      length = array.length;

  if (start < 0) {
    start = -start > length ? 0 : (length + start);
  }
  end = end > length ? length : end;
  if (end < 0) {
    end += length;
  }
  length = start > end ? 0 : ((end - start) >>> 0);
  start >>>= 0;

  var result = Array(length);
  while (++index < length) {
    result[index] = array[index + start];
  }
  return result;
}

module.exports = baseSlice;

},{}],46:[function(require,module,exports){
/**
 * lodash 4.4.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var SetCache = require('lodash._setcache'),
    root = require('lodash._root');

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * A specialized version of `_.includes` for arrays without support for
 * specifying an index to search from.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} target The value to search for.
 * @returns {boolean} Returns `true` if `target` is found, else `false`.
 */
function arrayIncludes(array, value) {
  return !!array.length && baseIndexOf(array, value, 0) > -1;
}

/**
 * A specialized version of `_.includesWith` for arrays without support for
 * specifying an index to search from.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} target The value to search for.
 * @param {Function} comparator The comparator invoked per element.
 * @returns {boolean} Returns `true` if `target` is found, else `false`.
 */
function arrayIncludesWith(array, value, comparator) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (comparator(value, array[index])) {
      return true;
    }
  }
  return false;
}

/**
 * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} value The value to search for.
 * @param {number} fromIndex The index to search from.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseIndexOf(array, value, fromIndex) {
  if (value !== value) {
    return indexOfNaN(array, fromIndex);
  }
  var index = fromIndex - 1,
      length = array.length;

  while (++index < length) {
    if (array[index] === value) {
      return index;
    }
  }
  return -1;
}

/**
 * Gets the index at which the first occurrence of `NaN` is found in `array`.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {number} fromIndex The index to search from.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched `NaN`, else `-1`.
 */
function indexOfNaN(array, fromIndex, fromRight) {
  var length = array.length,
      index = fromIndex + (fromRight ? 0 : -1);

  while ((fromRight ? index-- : ++index < length)) {
    var other = array[index];
    if (other !== other) {
      return index;
    }
  }
  return -1;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Converts `set` to an array.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the converted array.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/* Built-in method references that are verified to be native. */
var Set = getNative(root, 'Set');

/**
 * Checks if `value` is in `cache`.
 *
 * @private
 * @param {Object} cache The set cache to search.
 * @param {*} value The value to search for.
 * @returns {number} Returns `true` if `value` is found, else `false`.
 */
function cacheHas(cache, value) {
  var map = cache.__data__;
  if (isKeyable(value)) {
    var data = map.__data__,
        hash = typeof value == 'string' ? data.string : data.hash;

    return hash[value] === HASH_UNDEFINED;
  }
  return map.has(value);
}

/**
 * The base implementation of `_.uniqBy` without support for iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to inspect.
 * @param {Function} [iteratee] The iteratee invoked per element.
 * @param {Function} [comparator] The comparator invoked per element.
 * @returns {Array} Returns the new duplicate free array.
 */
function baseUniq(array, iteratee, comparator) {
  var index = -1,
      includes = arrayIncludes,
      length = array.length,
      isCommon = true,
      result = [],
      seen = result;

  if (comparator) {
    isCommon = false;
    includes = arrayIncludesWith;
  }
  else if (length >= LARGE_ARRAY_SIZE) {
    var set = iteratee ? null : createSet(array);
    if (set) {
      return setToArray(set);
    }
    isCommon = false;
    includes = cacheHas;
    seen = new SetCache;
  }
  else {
    seen = iteratee ? [] : result;
  }
  outer:
  while (++index < length) {
    var value = array[index],
        computed = iteratee ? iteratee(value) : value;

    if (isCommon && computed === computed) {
      var seenIndex = seen.length;
      while (seenIndex--) {
        if (seen[seenIndex] === computed) {
          continue outer;
        }
      }
      if (iteratee) {
        seen.push(computed);
      }
      result.push(value);
    }
    else if (!includes(seen, computed, comparator)) {
      if (seen !== result) {
        seen.push(computed);
      }
      result.push(value);
    }
  }
  return result;
}

/**
 * Creates a set of `values`.
 *
 * @private
 * @param {Array} values The values to add to the set.
 * @returns {Object} Returns the new set.
 */
var createSet = !(Set && new Set([1, 2]).size === 2) ? noop : function(values) {
  return new Set(values);
};

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'number' || type == 'boolean' ||
    (type == 'string' && value != '__proto__') || value == null;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

/**
 * A no-operation function that returns `undefined` regardless of the
 * arguments it receives.
 *
 * @static
 * @memberOf _
 * @category Util
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.noop(object) === undefined;
 * // => true
 */
function noop() {
  // No operation performed.
}

module.exports = baseUniq;

},{"lodash._root":49,"lodash._setcache":50}],47:[function(require,module,exports){
/**
 * lodash 3.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var root = require('lodash._root');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1,
    BIND_KEY_FLAG = 2,
    CURRY_BOUND_FLAG = 4,
    CURRY_FLAG = 8,
    CURRY_RIGHT_FLAG = 16,
    PARTIAL_FLAG = 32,
    PARTIAL_RIGHT_FLAG = 64,
    ARY_FLAG = 128,
    FLIP_FLAG = 512;

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** Used as the internal argument placeholder. */
var PLACEHOLDER = '__lodash_placeholder__';

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {...*} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  var length = args.length;
  switch (length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Replaces all `placeholder` elements in `array` with an internal placeholder
 * and returns an array of their indexes.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {*} placeholder The placeholder to replace.
 * @returns {Array} Returns the new array of placeholder indexes.
 */
function replaceHolders(array, placeholder) {
  var index = -1,
      length = array.length,
      resIndex = -1,
      result = [];

  while (++index < length) {
    if (array[index] === placeholder) {
      array[index] = PLACEHOLDER;
      result[++resIndex] = index;
    }
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max,
    nativeMin = Math.min;

/**
 * The base implementation of `_.create` without support for assigning
 * properties to the created object.
 *
 * @private
 * @param {Object} prototype The object to inherit from.
 * @returns {Object} Returns the new object.
 */
var baseCreate = (function() {
  function object() {}
  return function(prototype) {
    if (isObject(prototype)) {
      object.prototype = prototype;
      var result = new object;
      object.prototype = undefined;
    }
    return result || {};
  };
}());

/**
 * Creates an array that is the composition of partially applied arguments,
 * placeholders, and provided arguments into a single array of arguments.
 *
 * @private
 * @param {Array|Object} args The provided arguments.
 * @param {Array} partials The arguments to prepend to those provided.
 * @param {Array} holders The `partials` placeholder indexes.
 * @returns {Array} Returns the new array of composed arguments.
 */
function composeArgs(args, partials, holders) {
  var holdersLength = holders.length,
      argsIndex = -1,
      argsLength = nativeMax(args.length - holdersLength, 0),
      leftIndex = -1,
      leftLength = partials.length,
      result = Array(leftLength + argsLength);

  while (++leftIndex < leftLength) {
    result[leftIndex] = partials[leftIndex];
  }
  while (++argsIndex < holdersLength) {
    result[holders[argsIndex]] = args[argsIndex];
  }
  while (argsLength--) {
    result[leftIndex++] = args[argsIndex++];
  }
  return result;
}

/**
 * This function is like `composeArgs` except that the arguments composition
 * is tailored for `_.partialRight`.
 *
 * @private
 * @param {Array|Object} args The provided arguments.
 * @param {Array} partials The arguments to append to those provided.
 * @param {Array} holders The `partials` placeholder indexes.
 * @returns {Array} Returns the new array of composed arguments.
 */
function composeArgsRight(args, partials, holders) {
  var holdersIndex = -1,
      holdersLength = holders.length,
      argsIndex = -1,
      argsLength = nativeMax(args.length - holdersLength, 0),
      rightIndex = -1,
      rightLength = partials.length,
      result = Array(argsLength + rightLength);

  while (++argsIndex < argsLength) {
    result[argsIndex] = args[argsIndex];
  }
  var offset = argsIndex;
  while (++rightIndex < rightLength) {
    result[offset + rightIndex] = partials[rightIndex];
  }
  while (++holdersIndex < holdersLength) {
    result[offset + holders[holdersIndex]] = args[argsIndex++];
  }
  return result;
}

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

/**
 * Creates a function that wraps `func` to invoke it with the optional `this`
 * binding of `thisArg`.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createBaseWrapper(func, bitmask, thisArg) {
  var isBind = bitmask & BIND_FLAG,
      Ctor = createCtorWrapper(func);

  function wrapper() {
    var fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;
    return fn.apply(isBind ? thisArg : this, arguments);
  }
  return wrapper;
}

/**
 * Creates a function that produces an instance of `Ctor` regardless of
 * whether it was invoked as part of a `new` expression or by `call` or `apply`.
 *
 * @private
 * @param {Function} Ctor The constructor to wrap.
 * @returns {Function} Returns the new wrapped function.
 */
function createCtorWrapper(Ctor) {
  return function() {
    // Use a `switch` statement to work with class constructors.
    // See http://ecma-international.org/ecma-262/6.0/#sec-ecmascript-function-objects-call-thisargument-argumentslist
    // for more details.
    var args = arguments;
    switch (args.length) {
      case 0: return new Ctor;
      case 1: return new Ctor(args[0]);
      case 2: return new Ctor(args[0], args[1]);
      case 3: return new Ctor(args[0], args[1], args[2]);
      case 4: return new Ctor(args[0], args[1], args[2], args[3]);
      case 5: return new Ctor(args[0], args[1], args[2], args[3], args[4]);
      case 6: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5]);
      case 7: return new Ctor(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
    }
    var thisBinding = baseCreate(Ctor.prototype),
        result = Ctor.apply(thisBinding, args);

    // Mimic the constructor's `return` behavior.
    // See https://es5.github.io/#x13.2.2 for more details.
    return isObject(result) ? result : thisBinding;
  };
}

/**
 * Creates a function that wraps `func` to enable currying.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {number} arity The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createCurryWrapper(func, bitmask, arity) {
  var Ctor = createCtorWrapper(func);

  function wrapper() {
    var length = arguments.length,
        index = length,
        args = Array(length),
        fn = (this && this !== root && this instanceof wrapper) ? Ctor : func,
        placeholder = wrapper.placeholder;

    while (index--) {
      args[index] = arguments[index];
    }
    var holders = (length < 3 && args[0] !== placeholder && args[length - 1] !== placeholder)
      ? []
      : replaceHolders(args, placeholder);

    length -= holders.length;
    return length < arity
      ? createRecurryWrapper(func, bitmask, createHybridWrapper, placeholder, undefined, args, holders, undefined, undefined, arity - length)
      : apply(fn, this, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to invoke it with optional `this`
 * binding of `thisArg`, partial application, and currying.
 *
 * @private
 * @param {Function|string} func The function or method name to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to prepend to those provided to the new function.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [partialsRight] The arguments to append to those provided to the new function.
 * @param {Array} [holdersRight] The `partialsRight` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createHybridWrapper(func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity) {
  var isAry = bitmask & ARY_FLAG,
      isBind = bitmask & BIND_FLAG,
      isBindKey = bitmask & BIND_KEY_FLAG,
      isCurry = bitmask & CURRY_FLAG,
      isCurryRight = bitmask & CURRY_RIGHT_FLAG,
      isFlip = bitmask & FLIP_FLAG,
      Ctor = isBindKey ? undefined : createCtorWrapper(func);

  function wrapper() {
    var length = arguments.length,
        index = length,
        args = Array(length);

    while (index--) {
      args[index] = arguments[index];
    }
    if (partials) {
      args = composeArgs(args, partials, holders);
    }
    if (partialsRight) {
      args = composeArgsRight(args, partialsRight, holdersRight);
    }
    if (isCurry || isCurryRight) {
      var placeholder = wrapper.placeholder,
          argsHolders = replaceHolders(args, placeholder);

      length -= argsHolders.length;
      if (length < arity) {
        return createRecurryWrapper(func, bitmask, createHybridWrapper, placeholder, thisArg, args, argsHolders, argPos, ary, arity - length);
      }
    }
    var thisBinding = isBind ? thisArg : this,
        fn = isBindKey ? thisBinding[func] : func;

    if (argPos) {
      args = reorder(args, argPos);
    } else if (isFlip && args.length > 1) {
      args.reverse();
    }
    if (isAry && ary < args.length) {
      args.length = ary;
    }
    if (this && this !== root && this instanceof wrapper) {
      fn = Ctor || createCtorWrapper(fn);
    }
    return fn.apply(thisBinding, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to invoke it with the optional `this`
 * binding of `thisArg` and the `partials` prepended to those provided to
 * the wrapper.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {Array} partials The arguments to prepend to those provided to the new function.
 * @returns {Function} Returns the new wrapped function.
 */
function createPartialWrapper(func, bitmask, thisArg, partials) {
  var isBind = bitmask & BIND_FLAG,
      Ctor = createCtorWrapper(func);

  function wrapper() {
    var argsIndex = -1,
        argsLength = arguments.length,
        leftIndex = -1,
        leftLength = partials.length,
        args = Array(leftLength + argsLength),
        fn = (this && this !== root && this instanceof wrapper) ? Ctor : func;

    while (++leftIndex < leftLength) {
      args[leftIndex] = partials[leftIndex];
    }
    while (argsLength--) {
      args[leftIndex++] = arguments[++argsIndex];
    }
    return apply(fn, isBind ? thisArg : this, args);
  }
  return wrapper;
}

/**
 * Creates a function that wraps `func` to continue currying.
 *
 * @private
 * @param {Function} func The function to wrap.
 * @param {number} bitmask The bitmask of wrapper flags. See `createWrapper` for more details.
 * @param {Function} wrapFunc The function to create the `func` wrapper.
 * @param {*} placeholder The placeholder to replace.
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to prepend to those provided to the new function.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createRecurryWrapper(func, bitmask, wrapFunc, placeholder, thisArg, partials, holders, argPos, ary, arity) {
  var isCurry = bitmask & CURRY_FLAG,
      newArgPos = argPos ? copyArray(argPos) : undefined,
      newsHolders = isCurry ? holders : undefined,
      newHoldersRight = isCurry ? undefined : holders,
      newPartials = isCurry ? partials : undefined,
      newPartialsRight = isCurry ? undefined : partials;

  bitmask |= (isCurry ? PARTIAL_FLAG : PARTIAL_RIGHT_FLAG);
  bitmask &= ~(isCurry ? PARTIAL_RIGHT_FLAG : PARTIAL_FLAG);

  if (!(bitmask & CURRY_BOUND_FLAG)) {
    bitmask &= ~(BIND_FLAG | BIND_KEY_FLAG);
  }
  var result = wrapFunc(func, bitmask, thisArg, newPartials, newsHolders, newPartialsRight, newHoldersRight, newArgPos, ary, arity);

  result.placeholder = placeholder;
  return result;
}

/**
 * Creates a function that either curries or invokes `func` with optional
 * `this` binding and partially applied arguments.
 *
 * @private
 * @param {Function|string} func The function or method name to wrap.
 * @param {number} bitmask The bitmask of wrapper flags.
 *  The bitmask may be composed of the following flags:
 *     1 - `_.bind`
 *     2 - `_.bindKey`
 *     4 - `_.curry` or `_.curryRight` of a bound function
 *     8 - `_.curry`
 *    16 - `_.curryRight`
 *    32 - `_.partial`
 *    64 - `_.partialRight`
 *   128 - `_.rearg`
 *   256 - `_.ary`
 * @param {*} [thisArg] The `this` binding of `func`.
 * @param {Array} [partials] The arguments to be partially applied.
 * @param {Array} [holders] The `partials` placeholder indexes.
 * @param {Array} [argPos] The argument positions of the new function.
 * @param {number} [ary] The arity cap of `func`.
 * @param {number} [arity] The arity of `func`.
 * @returns {Function} Returns the new wrapped function.
 */
function createWrapper(func, bitmask, thisArg, partials, holders, argPos, ary, arity) {
  var isBindKey = bitmask & BIND_KEY_FLAG;
  if (!isBindKey && typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  var length = partials ? partials.length : 0;
  if (!length) {
    bitmask &= ~(PARTIAL_FLAG | PARTIAL_RIGHT_FLAG);
    partials = holders = undefined;
  }
  ary = ary === undefined ? ary : nativeMax(toInteger(ary), 0);
  arity = arity === undefined ? arity : toInteger(arity);
  length -= holders ? holders.length : 0;

  if (bitmask & PARTIAL_RIGHT_FLAG) {
    var partialsRight = partials,
        holdersRight = holders;

    partials = holders = undefined;
  }
  var newData = [func, bitmask, thisArg, partials, holders, partialsRight, holdersRight, argPos, ary, arity];

  func = newData[0];
  bitmask = newData[1];
  thisArg = newData[2];
  partials = newData[3];
  holders = newData[4];
  arity = newData[9] = newData[9] == null
    ? (isBindKey ? 0 : func.length)
    : nativeMax(newData[9] - length, 0);

  if (!arity && bitmask & (CURRY_FLAG | CURRY_RIGHT_FLAG)) {
    bitmask &= ~(CURRY_FLAG | CURRY_RIGHT_FLAG);
  }
  if (!bitmask || bitmask == BIND_FLAG) {
    var result = createBaseWrapper(func, bitmask, thisArg);
  } else if (bitmask == CURRY_FLAG || bitmask == CURRY_RIGHT_FLAG) {
    result = createCurryWrapper(func, bitmask, arity);
  } else if ((bitmask == PARTIAL_FLAG || bitmask == (BIND_FLAG | PARTIAL_FLAG)) && !holders.length) {
    result = createPartialWrapper(func, bitmask, thisArg, partials);
  } else {
    result = createHybridWrapper.apply(undefined, newData);
  }
  return result;
}

/**
 * Reorder `array` according to the specified indexes where the element at
 * the first index is assigned as the first element, the element at
 * the second index is assigned as the second element, and so on.
 *
 * @private
 * @param {Array} array The array to reorder.
 * @param {Array} indexes The arranged array indexes.
 * @returns {Array} Returns `array`.
 */
function reorder(array, indexes) {
  var arrLength = array.length,
      length = nativeMin(indexes.length, arrLength),
      oldArray = copyArray(array);

  while (length--) {
    var index = indexes[length];
    array[length] = isIndex(index, arrLength) ? oldArray[index] : undefined;
  }
  return array;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = createWrapper;

},{"lodash._root":49}],48:[function(require,module,exports){
/**
 * lodash 3.9.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = getNative;

},{}],49:[function(require,module,exports){
(function (global){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

module.exports = root;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],50:[function(require,module,exports){
(function (global){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var splice = arrayProto.splice;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    nativeCreate = getNative(Object, 'create');

/**
 * Creates an hash object.
 *
 * @private
 * @constructor
 * @returns {Object} Returns the new hash object.
 */
function Hash() {}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(hash, key) {
  return hashHas(hash, key) && delete hash[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(hash, key) {
  if (nativeCreate) {
    var result = hash[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(hash, key) ? hash[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(hash, key) {
  return nativeCreate ? hash[key] !== undefined : hasOwnProperty.call(hash, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function hashSet(hash, key, value) {
  hash[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
}

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function MapCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': Map ? new Map : [],
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapDelete(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashDelete(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map['delete'](key) : assocDelete(data.map, key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapGet(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashGet(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.get(key) : assocGet(data.map, key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapHas(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashHas(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.has(key) : assocHas(data.map, key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache object.
 */
function mapSet(key, value) {
  var data = this.__data__;
  if (isKeyable(key)) {
    hashSet(typeof key == 'string' ? data.string : data.hash, key, value);
  } else if (Map) {
    data.map.set(key, value);
  } else {
    assocSet(data.map, key, value);
  }
  return this;
}

/**
 *
 * Creates a set cache object to store unique values.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function SetCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.__data__ = new MapCache;
  while (++index < length) {
    this.push(values[index]);
  }
}

/**
 * Adds `value` to the set cache.
 *
 * @private
 * @name push
 * @memberOf SetCache
 * @param {*} value The value to cache.
 */
function cachePush(value) {
  var map = this.__data__;
  if (isKeyable(value)) {
    var data = map.__data__,
        hash = typeof value == 'string' ? data.string : data.hash;

    hash[value] = HASH_UNDEFINED;
  }
  else {
    map.set(value, HASH_UNDEFINED);
  }
}

/**
 * Removes `key` and its value from the associative array.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function assocDelete(array, key) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = array.length - 1;
  if (index == lastIndex) {
    array.pop();
  } else {
    splice.call(array, index, 1);
  }
  return true;
}

/**
 * Gets the associative array value for `key`.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function assocGet(array, key) {
  var index = assocIndexOf(array, key);
  return index < 0 ? undefined : array[index][1];
}

/**
 * Checks if an associative array value for `key` exists.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function assocHas(array, key) {
  return assocIndexOf(array, key) > -1;
}

/**
 * Gets the index at which the first occurrence of `key` is found in `array`
 * of key-value pairs.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * Sets the associative array `key` to `value`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function assocSet(array, key, value) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    array.push([key, value]);
  } else {
    array[index][1] = value;
  }
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'number' || type == 'boolean' ||
    (type == 'string' && value != '__proto__') || value == null;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

// Avoid inheriting from `Object.prototype` when possible.
Hash.prototype = nativeCreate ? nativeCreate(null) : objectProto;

// Add functions to the `MapCache`.
MapCache.prototype.clear = mapClear;
MapCache.prototype['delete'] = mapDelete;
MapCache.prototype.get = mapGet;
MapCache.prototype.has = mapHas;
MapCache.prototype.set = mapSet;

// Add functions to the `SetCache`.
SetCache.prototype.push = cachePush;

module.exports = SetCache;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],51:[function(require,module,exports){
(function (global){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the size to enable large array optimizations. */
var LARGE_ARRAY_SIZE = 200;

/** Used to stand-in for `undefined` hash values. */
var HASH_UNDEFINED = '__lodash_hash_undefined__';

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/** Used for built-in method references. */
var arrayProto = Array.prototype,
    objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var splice = arrayProto.splice;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    nativeCreate = getNative(Object, 'create');

/**
 * Creates an hash object.
 *
 * @private
 * @constructor
 * @returns {Object} Returns the new hash object.
 */
function Hash() {}

/**
 * Removes `key` and its value from the hash.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function hashDelete(hash, key) {
  return hashHas(hash, key) && delete hash[key];
}

/**
 * Gets the hash value for `key`.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function hashGet(hash, key) {
  if (nativeCreate) {
    var result = hash[key];
    return result === HASH_UNDEFINED ? undefined : result;
  }
  return hasOwnProperty.call(hash, key) ? hash[key] : undefined;
}

/**
 * Checks if a hash value for `key` exists.
 *
 * @private
 * @param {Object} hash The hash to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function hashHas(hash, key) {
  return nativeCreate ? hash[key] !== undefined : hasOwnProperty.call(hash, key);
}

/**
 * Sets the hash `key` to `value`.
 *
 * @private
 * @param {Object} hash The hash to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function hashSet(hash, key, value) {
  hash[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
}

/**
 * Creates a map cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function MapCache(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the map.
 *
 * @private
 * @name clear
 * @memberOf MapCache
 */
function mapClear() {
  this.__data__ = {
    'hash': new Hash,
    'map': Map ? new Map : [],
    'string': new Hash
  };
}

/**
 * Removes `key` and its value from the map.
 *
 * @private
 * @name delete
 * @memberOf MapCache
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function mapDelete(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashDelete(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map['delete'](key) : assocDelete(data.map, key);
}

/**
 * Gets the map value for `key`.
 *
 * @private
 * @name get
 * @memberOf MapCache
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function mapGet(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashGet(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.get(key) : assocGet(data.map, key);
}

/**
 * Checks if a map value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf MapCache
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function mapHas(key) {
  var data = this.__data__;
  if (isKeyable(key)) {
    return hashHas(typeof key == 'string' ? data.string : data.hash, key);
  }
  return Map ? data.map.has(key) : assocHas(data.map, key);
}

/**
 * Sets the map `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf MapCache
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the map cache object.
 */
function mapSet(key, value) {
  var data = this.__data__;
  if (isKeyable(key)) {
    hashSet(typeof key == 'string' ? data.string : data.hash, key, value);
  } else if (Map) {
    data.map.set(key, value);
  } else {
    assocSet(data.map, key, value);
  }
  return this;
}

/**
 * Creates a stack cache object to store key-value pairs.
 *
 * @private
 * @constructor
 * @param {Array} [values] The values to cache.
 */
function Stack(values) {
  var index = -1,
      length = values ? values.length : 0;

  this.clear();
  while (++index < length) {
    var entry = values[index];
    this.set(entry[0], entry[1]);
  }
}

/**
 * Removes all key-value entries from the stack.
 *
 * @private
 * @name clear
 * @memberOf Stack
 */
function stackClear() {
  this.__data__ = { 'array': [], 'map': null };
}

/**
 * Removes `key` and its value from the stack.
 *
 * @private
 * @name delete
 * @memberOf Stack
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function stackDelete(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocDelete(array, key) : data.map['delete'](key);
}

/**
 * Gets the stack value for `key`.
 *
 * @private
 * @name get
 * @memberOf Stack
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function stackGet(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocGet(array, key) : data.map.get(key);
}

/**
 * Checks if a stack value for `key` exists.
 *
 * @private
 * @name has
 * @memberOf Stack
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function stackHas(key) {
  var data = this.__data__,
      array = data.array;

  return array ? assocHas(array, key) : data.map.has(key);
}

/**
 * Sets the stack `key` to `value`.
 *
 * @private
 * @name set
 * @memberOf Stack
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 * @returns {Object} Returns the stack cache object.
 */
function stackSet(key, value) {
  var data = this.__data__,
      array = data.array;

  if (array) {
    if (array.length < (LARGE_ARRAY_SIZE - 1)) {
      assocSet(array, key, value);
    } else {
      data.array = null;
      data.map = new MapCache(array);
    }
  }
  var map = data.map;
  if (map) {
    map.set(key, value);
  }
  return this;
}

/**
 * Removes `key` and its value from the associative array.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to remove.
 * @returns {boolean} Returns `true` if the entry was removed, else `false`.
 */
function assocDelete(array, key) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = array.length - 1;
  if (index == lastIndex) {
    array.pop();
  } else {
    splice.call(array, index, 1);
  }
  return true;
}

/**
 * Gets the associative array value for `key`.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the value to get.
 * @returns {*} Returns the entry value.
 */
function assocGet(array, key) {
  var index = assocIndexOf(array, key);
  return index < 0 ? undefined : array[index][1];
}

/**
 * Checks if an associative array value for `key` exists.
 *
 * @private
 * @param {Array} array The array to query.
 * @param {string} key The key of the entry to check.
 * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
 */
function assocHas(array, key) {
  return assocIndexOf(array, key) > -1;
}

/**
 * Gets the index at which the first occurrence of `key` is found in `array`
 * of key-value pairs.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} key The key to search for.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}

/**
 * Sets the associative array `key` to `value`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {string} key The key of the value to set.
 * @param {*} value The value to set.
 */
function assocSet(array, key, value) {
  var index = assocIndexOf(array, key);
  if (index < 0) {
    array.push([key, value]);
  } else {
    array[index][1] = value;
  }
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is suitable for use as unique object key.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
 */
function isKeyable(value) {
  var type = typeof value;
  return type == 'number' || type == 'boolean' ||
    (type == 'string' && value != '__proto__') || value == null;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

// Avoid inheriting from `Object.prototype` when possible.
Hash.prototype = nativeCreate ? nativeCreate(null) : objectProto;

// Add functions to the `MapCache`.
MapCache.prototype.clear = mapClear;
MapCache.prototype['delete'] = mapDelete;
MapCache.prototype.get = mapGet;
MapCache.prototype.has = mapHas;
MapCache.prototype.set = mapSet;

// Add functions to the `Stack` cache.
Stack.prototype.clear = stackClear;
Stack.prototype['delete'] = stackDelete;
Stack.prototype.get = stackGet;
Stack.prototype.has = stackHas;
Stack.prototype.set = stackSet;

module.exports = Stack;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],52:[function(require,module,exports){
/**
 * lodash 3.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseFlatten = require('lodash._baseflatten'),
    createWrapper = require('lodash._createwrapper'),
    functions = require('lodash.functions'),
    restParam = require('lodash.restparam');

/** Used to compose bitmasks for wrapper metadata. */
var BIND_FLAG = 1;

/**
 * Binds methods of an object to the object itself, overwriting the existing
 * method. Method names may be specified as individual arguments or as arrays
 * of method names. If no method names are provided all enumerable function
 * properties, own and inherited, of `object` are bound.
 *
 * **Note:** This method does not set the `length` property of bound functions.
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Object} object The object to bind and assign the bound methods to.
 * @param {...(string|string[])} [methodNames] The object method names to bind,
 *  specified as individual method names or arrays of method names.
 * @returns {Object} Returns `object`.
 * @example
 *
 * var view = {
 *   'label': 'docs',
 *   'onClick': function() {
 *     console.log('clicked ' + this.label);
 *   }
 * };
 *
 * _.bindAll(view);
 * jQuery('#docs').on('click', view.onClick);
 * // => logs 'clicked docs' when the element is clicked
 */
var bindAll = restParam(function(object, methodNames) {
  methodNames = methodNames.length ? baseFlatten(methodNames) : functions(object);

  var index = -1,
      length = methodNames.length;

  while (++index < length) {
    var key = methodNames[index];
    object[key] = createWrapper(object[key], BIND_FLAG, object);
  }
  return object;
});

module.exports = bindAll;

},{"lodash._baseflatten":53,"lodash._createwrapper":47,"lodash.functions":60,"lodash.restparam":80}],53:[function(require,module,exports){
/**
 * lodash 3.1.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var isArguments = require('lodash.isarguments'),
    isArray = require('lodash.isarray');

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Appends the elements of `values` to `array`.
 *
 * @private
 * @param {Array} array The array to modify.
 * @param {Array} values The values to append.
 * @returns {Array} Returns `array`.
 */
function arrayPush(array, values) {
  var index = -1,
      length = values.length,
      offset = array.length;

  while (++index < length) {
    array[offset + index] = values[index];
  }
  return array;
}

/**
 * The base implementation of `_.flatten` with added support for restricting
 * flattening and specifying the start index.
 *
 * @private
 * @param {Array} array The array to flatten.
 * @param {boolean} [isDeep] Specify a deep flatten.
 * @param {boolean} [isStrict] Restrict flattening to arrays-like objects.
 * @param {Array} [result=[]] The initial result value.
 * @returns {Array} Returns the new flattened array.
 */
function baseFlatten(array, isDeep, isStrict, result) {
  result || (result = []);

  var index = -1,
      length = array.length;

  while (++index < length) {
    var value = array[index];
    if (isObjectLike(value) && isArrayLike(value) &&
        (isStrict || isArray(value) || isArguments(value))) {
      if (isDeep) {
        // Recursively flatten arrays (susceptible to call stack limits).
        baseFlatten(value, isDeep, isStrict, result);
      } else {
        arrayPush(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

module.exports = baseFlatten;

},{"lodash.isarguments":63,"lodash.isarray":54}],54:[function(require,module,exports){
/**
 * lodash 3.0.4 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var arrayTag = '[object Array]',
    funcTag = '[object Function]';

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/**
 * Checks if `value` is object-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var fnToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  fnToString.call(hasOwnProperty).replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/* Native method references for those with the same name as other `lodash` methods. */
var nativeIsArray = getNative(Array, 'isArray');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(function() { return arguments; }());
 * // => false
 */
var isArray = nativeIsArray || function(value) {
  return isObjectLike(value) && isLength(value.length) && objToString.call(value) == arrayTag;
};

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in older versions of Chrome and Safari which return 'function' for regexes
  // and Safari 8 equivalents which return 'object' for typed array constructors.
  return isObject(value) && objToString.call(value) == funcTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(fnToString.call(value));
  }
  return isObjectLike(value) && reIsHostCtor.test(value);
}

module.exports = isArray;

},{}],55:[function(require,module,exports){
/**
 * lodash 4.3.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseClone = require('lodash._baseclone');

/**
 * This method is like `_.clone` except that it recursively clones `value`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to recursively clone.
 * @returns {*} Returns the deep cloned value.
 * @example
 *
 * var objects = [{ 'a': 1 }, { 'b': 2 }];
 *
 * var deep = _.cloneDeep(objects);
 * console.log(deep[0] === objects[0]);
 * // => false
 */
function cloneDeep(value) {
  return baseClone(value, true);
}

module.exports = cloneDeep;

},{"lodash._baseclone":36}],56:[function(require,module,exports){
/**
 * lodash 4.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseSlice = require('lodash._baseslice');

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Creates a slice of `array` with `n` elements dropped from the beginning.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to query.
 * @param {number} [n=1] The number of elements to drop.
 * @param- {Object} [guard] Enables use as an iteratee for functions like `_.map`.
 * @returns {Array} Returns the slice of `array`.
 * @example
 *
 * _.drop([1, 2, 3]);
 * // => [2, 3]
 *
 * _.drop([1, 2, 3], 2);
 * // => [3]
 *
 * _.drop([1, 2, 3], 5);
 * // => []
 *
 * _.drop([1, 2, 3], 0);
 * // => [1, 2, 3]
 */
function drop(array, n, guard) {
  var length = array ? array.length : 0;
  if (!length) {
    return [];
  }
  n = (guard || n === undefined) ? 1 : toInteger(n);
  return baseSlice(array, n < 0 ? 0 : n, length);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = drop;

},{"lodash._baseslice":45}],57:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseEach = require('lodash._baseeach'),
    baseFind = require('lodash._basefind'),
    baseFindIndex = require('lodash._basefindindex'),
    baseIteratee = require('lodash._baseiteratee');

/**
 * Iterates over elements of `collection`, returning the first element
 * `predicate` returns truthy for. The predicate is invoked with three arguments:
 * (value, index|key, collection).
 *
 * @static
 * @memberOf _
 * @category Collection
 * @param {Array|Object} collection The collection to search.
 * @param {Function|Object|string} [predicate=_.identity] The function invoked per iteration.
 * @returns {*} Returns the matched element, else `undefined`.
 * @example
 *
 * var users = [
 *   { 'user': 'barney',  'age': 36, 'active': true },
 *   { 'user': 'fred',    'age': 40, 'active': false },
 *   { 'user': 'pebbles', 'age': 1,  'active': true }
 * ];
 *
 * _.find(users, function(o) { return o.age < 40; });
 * // => object for 'barney'
 *
 * // The `_.matches` iteratee shorthand.
 * _.find(users, { 'age': 1, 'active': true });
 * // => object for 'pebbles'
 *
 * // The `_.matchesProperty` iteratee shorthand.
 * _.find(users, ['active', false]);
 * // => object for 'fred'
 *
 * // The `_.property` iteratee shorthand.
 * _.find(users, 'active');
 * // => object for 'barney'
 */
function find(collection, predicate) {
  predicate = baseIteratee(predicate, 3);
  if (isArray(collection)) {
    var index = baseFindIndex(collection, predicate);
    return index > -1 ? collection[index] : undefined;
  }
  return baseFind(collection, predicate, baseEach);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

module.exports = find;

},{"lodash._baseeach":37,"lodash._basefind":39,"lodash._basefindindex":40,"lodash._baseiteratee":43}],58:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Gets the first element of `array`.
 *
 * @static
 * @memberOf _
 * @alias head
 * @category Array
 * @param {Array} array The array to query.
 * @returns {*} Returns the first element of `array`.
 * @example
 *
 * _.first([1, 2, 3]);
 * // => 1
 *
 * _.first([]);
 * // => undefined
 */
function first(array) {
  return array ? array[0] : undefined;
}

module.exports = first;

},{}],59:[function(require,module,exports){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseEach = require('lodash._baseeach');

/**
 * A specialized version of `_.forEach` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

/**
 * Casts `value` to `identity` if it's not a function.
 *
 * @private
 * @param {*} value The value to inspect.
 * @returns {Array} Returns the array-like object.
 */
function baseCastFunction(value) {
  return typeof value == 'function' ? value : identity;
}

/**
 * Iterates over elements of `collection` invoking `iteratee` for each element.
 * The iteratee is invoked with three arguments: (value, index|key, collection).
 * Iteratee functions may exit iteration early by explicitly returning `false`.
 *
 * **Note:** As with other "Collections" methods, objects with a "length" property
 * are iterated like arrays. To avoid this behavior use `_.forIn` or `_.forOwn`
 * for object iteration.
 *
 * @static
 * @memberOf _
 * @alias each
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} [iteratee=_.identity] The function invoked per iteration.
 * @returns {Array|Object} Returns `collection`.
 * @example
 *
 * _([1, 2]).forEach(function(value) {
 *   console.log(value);
 * });
 * // => logs `1` then `2`
 *
 * _.forEach({ 'a': 1, 'b': 2 }, function(value, key) {
 *   console.log(key);
 * });
 * // => logs 'a' then 'b' (iteration order is not guaranteed)
 */
function forEach(collection, iteratee) {
  return (typeof iteratee == 'function' && isArray(collection))
    ? arrayEach(collection, iteratee)
    : baseEach(collection, baseCastFunction(iteratee));
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * This method returns the first argument given to it.
 *
 * @static
 * @memberOf _
 * @category Util
 * @param {*} value Any value.
 * @returns {*} Returns `value`.
 * @example
 *
 * var object = { 'user': 'fred' };
 *
 * _.identity(object) === object;
 * // => true
 */
function identity(value) {
  return value;
}

module.exports = forEach;

},{"lodash._baseeach":37}],60:[function(require,module,exports){
/**
 * lodash 3.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.7.0 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseFunctions = require('lodash._basefunctions'),
    keysIn = require('lodash.keysin');

/**
 * Creates an array of function property names from all enumerable properties,
 * own and inherited, of `object`.
 *
 * @static
 * @memberOf _
 * @alias methods
 * @category Object
 * @param {Object} object The object to inspect.
 * @returns {Array} Returns the new array of property names.
 * @example
 *
 * _.functions(_);
 * // => ['all', 'any', 'bind', ...]
 */
function functions(object) {
  return baseFunctions(object, keysIn(object));
}

module.exports = functions;

},{"lodash._basefunctions":42,"lodash.keysin":62}],61:[function(require,module,exports){
arguments[4][54][0].apply(exports,arguments)
},{"dup":54}],62:[function(require,module,exports){
/**
 * lodash 3.0.8 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var isArguments = require('lodash.isarguments'),
    isArray = require('lodash.isarray');

/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used as the [maximum length](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keysIn;

},{"lodash.isarguments":63,"lodash.isarray":61}],63:[function(require,module,exports){
/**
 * lodash 3.0.7 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

module.exports = isArguments;

},{}],64:[function(require,module,exports){
/**
 * lodash 4.0.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type Function
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

module.exports = isArray;

},{}],65:[function(require,module,exports){
/**
 * lodash 4.1.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is empty. A value is considered empty unless it's an
 * `arguments` object, array, string, or jQuery-like collection with a length
 * greater than `0` or an object with own enumerable properties.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {Array|Object|string} value The value to inspect.
 * @returns {boolean} Returns `true` if `value` is empty, else `false`.
 * @example
 *
 * _.isEmpty(null);
 * // => true
 *
 * _.isEmpty(true);
 * // => true
 *
 * _.isEmpty(1);
 * // => true
 *
 * _.isEmpty([1, 2, 3]);
 * // => false
 *
 * _.isEmpty({ 'a': 1 });
 * // => false
 */
function isEmpty(value) {
  if (isArrayLike(value) &&
      (isArray(value) || isString(value) ||
        isFunction(value.splice) || isArguments(value))) {
    return !value.length;
  }
  for (var key in value) {
    if (hasOwnProperty.call(value, key)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

module.exports = isEmpty;

},{}],66:[function(require,module,exports){
/**
 * lodash 4.1.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var Stack = require('lodash._stack'),
    keys = require('lodash.keys'),
    root = require('lodash._root');

/** Used to compose bitmasks for comparison styles. */
var UNORDERED_COMPARE_FLAG = 1,
    PARTIAL_COMPARE_FLAG = 2;

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    symbolTag = '[object Symbol]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to match `RegExp` [syntax characters](http://ecma-international.org/ecma-262/6.0/#sec-patterns). */
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

/** Used to detect host constructors (Safari > 5). */
var reIsHostCtor = /^\[object .+?Constructor\]$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dateTag] = typedArrayTags[errorTag] =
typedArrayTags[funcTag] = typedArrayTags[mapTag] =
typedArrayTags[numberTag] = typedArrayTags[objectTag] =
typedArrayTags[regexpTag] = typedArrayTags[setTag] =
typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

/**
 * A specialized version of `_.some` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} predicate The function invoked per iteration.
 * @returns {boolean} Returns `true` if any element passes the predicate check, else `false`.
 */
function arraySome(array, predicate) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (predicate(array[index], index, array)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/**
 * Converts `map` to an array.
 *
 * @private
 * @param {Object} map The map to convert.
 * @returns {Array} Returns the converted array.
 */
function mapToArray(map) {
  var index = -1,
      result = Array(map.size);

  map.forEach(function(value, key) {
    result[++index] = [key, value];
  });
  return result;
}

/**
 * Converts `set` to an array.
 *
 * @private
 * @param {Object} set The set to convert.
 * @returns {Array} Returns the converted array.
 */
function setToArray(set) {
  var index = -1,
      result = Array(set.size);

  set.forEach(function(value) {
    result[++index] = value;
  });
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Used to detect if a method is native. */
var reIsNative = RegExp('^' +
  funcToString.call(hasOwnProperty).replace(reRegExpChar, '\\$&')
  .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
);

/** Built-in value references. */
var Symbol = root.Symbol,
    Uint8Array = root.Uint8Array,
    getPrototypeOf = Object.getPrototypeOf;

/* Built-in method references that are verified to be native. */
var Map = getNative(root, 'Map'),
    Set = getNative(root, 'Set'),
    WeakMap = getNative(root, 'WeakMap');

/** Used to detect maps, sets, and weakmaps. */
var mapCtorString = Map ? funcToString.call(Map) : '',
    setCtorString = Set ? funcToString.call(Set) : '',
    weakMapCtorString = WeakMap ? funcToString.call(WeakMap) : '';

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolValueOf = Symbol ? symbolProto.valueOf : undefined;

/**
 * The base implementation of `_.has` without support for deep paths.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {Array|string} key The key to check.
 * @returns {boolean} Returns `true` if `key` exists, else `false`.
 */
function baseHas(object, key) {
  // Avoid a bug in IE 10-11 where objects with a [[Prototype]] of `null`,
  // that are composed entirely of index properties, return `false` for
  // `hasOwnProperty` checks of them.
  return hasOwnProperty.call(object, key) ||
    (typeof object == 'object' && key in object && getPrototypeOf(object) === null);
}

/**
 * The base implementation of `_.isEqual` which supports partial comparisons
 * and tracks traversed objects.
 *
 * @private
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {boolean} [bitmask] The bitmask of comparison flags.
 *  The bitmask may be composed of the following flags:
 *     1 - Unordered comparison
 *     2 - Partial comparison
 * @param {Object} [stack] Tracks traversed `value` and `other` objects.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 */
function baseIsEqual(value, other, customizer, bitmask, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || (!isObject(value) && !isObjectLike(other))) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep(value, other, baseIsEqual, customizer, bitmask, stack);
}

/**
 * A specialized version of `baseIsEqual` for arrays and objects which performs
 * deep comparisons and tracks traversed objects enabling objects with circular
 * references to be compared.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function baseIsEqualDeep(object, other, equalFunc, customizer, bitmask, stack) {
  var objIsArr = isArray(object),
      othIsArr = isArray(other),
      objTag = arrayTag,
      othTag = arrayTag;

  if (!objIsArr) {
    objTag = getTag(object);
    if (objTag == argsTag) {
      objTag = objectTag;
    } else if (objTag != objectTag) {
      objIsArr = isTypedArray(object);
    }
  }
  if (!othIsArr) {
    othTag = getTag(other);
    if (othTag == argsTag) {
      othTag = objectTag;
    } else if (othTag != objectTag) {
      othIsArr = isTypedArray(other);
    }
  }
  var objIsObj = objTag == objectTag && !isHostObject(object),
      othIsObj = othTag == objectTag && !isHostObject(other),
      isSameTag = objTag == othTag;

  if (isSameTag && !(objIsArr || objIsObj)) {
    return equalByTag(object, other, objTag, equalFunc, customizer, bitmask);
  }
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
  if (!isPartial) {
    var objIsWrapped = objIsObj && hasOwnProperty.call(object, '__wrapped__'),
        othIsWrapped = othIsObj && hasOwnProperty.call(other, '__wrapped__');

    if (objIsWrapped || othIsWrapped) {
      return equalFunc(objIsWrapped ? object.value() : object, othIsWrapped ? other.value() : other, customizer, bitmask, stack);
    }
  }
  if (!isSameTag) {
    return false;
  }
  stack || (stack = new Stack);
  return (objIsArr ? equalArrays : equalObjects)(object, other, equalFunc, customizer, bitmask, stack);
}

/**
 * A specialized version of `baseIsEqualDeep` for arrays with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Array} array The array to compare.
 * @param {Array} other The other array to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `array` and `other` objects.
 * @returns {boolean} Returns `true` if the arrays are equivalent, else `false`.
 */
function equalArrays(array, other, equalFunc, customizer, bitmask, stack) {
  var index = -1,
      isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      isUnordered = bitmask & UNORDERED_COMPARE_FLAG,
      arrLength = array.length,
      othLength = other.length;

  if (arrLength != othLength && !(isPartial && othLength > arrLength)) {
    return false;
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(array);
  if (stacked) {
    return stacked == other;
  }
  var result = true;
  stack.set(array, other);

  // Ignore non-index properties.
  while (++index < arrLength) {
    var arrValue = array[index],
        othValue = other[index];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, arrValue, index, other, array, stack)
        : customizer(arrValue, othValue, index, array, other, stack);
    }
    if (compared !== undefined) {
      if (compared) {
        continue;
      }
      result = false;
      break;
    }
    // Recursively compare arrays (susceptible to call stack limits).
    if (isUnordered) {
      if (!arraySome(other, function(othValue) {
            return arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack);
          })) {
        result = false;
        break;
      }
    } else if (!(arrValue === othValue || equalFunc(arrValue, othValue, customizer, bitmask, stack))) {
      result = false;
      break;
    }
  }
  stack['delete'](array);
  return result;
}

/**
 * A specialized version of `baseIsEqualDeep` for comparing objects of
 * the same `toStringTag`.
 *
 * **Note:** This function only supports comparing values with tags of
 * `Boolean`, `Date`, `Error`, `Number`, `RegExp`, or `String`.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {string} tag The `toStringTag` of the objects to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalByTag(object, other, tag, equalFunc, customizer, bitmask) {
  switch (tag) {
    case arrayBufferTag:
      if ((object.byteLength != other.byteLength) ||
          !equalFunc(new Uint8Array(object), new Uint8Array(other))) {
        return false;
      }
      return true;

    case boolTag:
    case dateTag:
      // Coerce dates and booleans to numbers, dates to milliseconds and booleans
      // to `1` or `0` treating invalid dates coerced to `NaN` as not equal.
      return +object == +other;

    case errorTag:
      return object.name == other.name && object.message == other.message;

    case numberTag:
      // Treat `NaN` vs. `NaN` as equal.
      return (object != +object) ? other != +other : object == +other;

    case regexpTag:
    case stringTag:
      // Coerce regexes to strings and treat strings primitives and string
      // objects as equal. See https://es5.github.io/#x15.10.6.4 for more details.
      return object == (other + '');

    case mapTag:
      var convert = mapToArray;

    case setTag:
      var isPartial = bitmask & PARTIAL_COMPARE_FLAG;
      convert || (convert = setToArray);

      // Recursively compare objects (susceptible to call stack limits).
      return (isPartial || object.size == other.size) &&
        equalFunc(convert(object), convert(other), customizer, bitmask | UNORDERED_COMPARE_FLAG);

    case symbolTag:
      return !!Symbol && (symbolValueOf.call(object) == symbolValueOf.call(other));
  }
  return false;
}

/**
 * A specialized version of `baseIsEqualDeep` for objects with support for
 * partial deep comparisons.
 *
 * @private
 * @param {Object} object The object to compare.
 * @param {Object} other The other object to compare.
 * @param {Function} equalFunc The function to determine equivalents of values.
 * @param {Function} [customizer] The function to customize comparisons.
 * @param {number} [bitmask] The bitmask of comparison flags. See `baseIsEqual` for more details.
 * @param {Object} [stack] Tracks traversed `object` and `other` objects.
 * @returns {boolean} Returns `true` if the objects are equivalent, else `false`.
 */
function equalObjects(object, other, equalFunc, customizer, bitmask, stack) {
  var isPartial = bitmask & PARTIAL_COMPARE_FLAG,
      objProps = keys(object),
      objLength = objProps.length,
      othProps = keys(other),
      othLength = othProps.length;

  if (objLength != othLength && !isPartial) {
    return false;
  }
  var index = objLength;
  while (index--) {
    var key = objProps[index];
    if (!(isPartial ? key in other : baseHas(other, key))) {
      return false;
    }
  }
  // Assume cyclic values are equal.
  var stacked = stack.get(object);
  if (stacked) {
    return stacked == other;
  }
  var result = true;
  stack.set(object, other);

  var skipCtor = isPartial;
  while (++index < objLength) {
    key = objProps[index];
    var objValue = object[key],
        othValue = other[key];

    if (customizer) {
      var compared = isPartial
        ? customizer(othValue, objValue, key, other, object, stack)
        : customizer(objValue, othValue, key, object, other, stack);
    }
    // Recursively compare objects (susceptible to call stack limits).
    if (!(compared === undefined
          ? (objValue === othValue || equalFunc(objValue, othValue, customizer, bitmask, stack))
          : compared
        )) {
      result = false;
      break;
    }
    skipCtor || (skipCtor = key == 'constructor');
  }
  if (result && !skipCtor) {
    var objCtor = object.constructor,
        othCtor = other.constructor;

    // Non `Object` object instances with different constructors are not equal.
    if (objCtor != othCtor &&
        ('constructor' in object && 'constructor' in other) &&
        !(typeof objCtor == 'function' && objCtor instanceof objCtor &&
          typeof othCtor == 'function' && othCtor instanceof othCtor)) {
      result = false;
    }
  }
  stack['delete'](object);
  return result;
}

/**
 * Gets the native function at `key` of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @param {string} key The key of the method to get.
 * @returns {*} Returns the function if it's native, else `undefined`.
 */
function getNative(object, key) {
  var value = object == null ? undefined : object[key];
  return isNative(value) ? value : undefined;
}

/**
 * Gets the `toStringTag` of `value`.
 *
 * @private
 * @param {*} value The value to query.
 * @returns {string} Returns the `toStringTag`.
 */
function getTag(value) {
  return objectToString.call(value);
}

// Fallback for IE 11 providing `toStringTag` values for maps, sets, and weakmaps.
if ((Map && getTag(new Map) != mapTag) ||
    (Set && getTag(new Set) != setTag) ||
    (WeakMap && getTag(new WeakMap) != weakMapTag)) {
  getTag = function(value) {
    var result = objectToString.call(value),
        Ctor = result == objectTag ? value.constructor : null,
        ctorString = typeof Ctor == 'function' ? funcToString.call(Ctor) : '';

    if (ctorString) {
      switch (ctorString) {
        case mapCtorString: return mapTag;
        case setCtorString: return setTag;
        case weakMapCtorString: return weakMapTag;
      }
    }
    return result;
  };
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Performs a deep comparison between two values to determine if they are
 * equivalent.
 *
 * **Note:** This method supports comparing arrays, array buffers, booleans,
 * date objects, error objects, maps, numbers, `Object` objects, regexes,
 * sets, strings, symbols, and typed arrays. `Object` objects are compared
 * by their own, not inherited, enumerable properties. Functions and DOM
 * nodes are **not** supported.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.isEqual(object, other);
 * // => true
 *
 * object === other;
 * // => false
 */
function isEqual(value, other) {
  return baseIsEqual(value, other);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a native function.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a native function, else `false`.
 * @example
 *
 * _.isNative(Array.prototype.push);
 * // => true
 *
 * _.isNative(_);
 * // => false
 */
function isNative(value) {
  if (value == null) {
    return false;
  }
  if (isFunction(value)) {
    return reIsNative.test(funcToString.call(value));
  }
  return isObjectLike(value) &&
    (isHostObject(value) ? reIsNative : reIsHostCtor).test(value);
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
function isTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
}

module.exports = isEqual;

},{"lodash._root":49,"lodash._stack":51,"lodash.keys":67}],67:[function(require,module,exports){
arguments[4][38][0].apply(exports,arguments)
},{"dup":38}],68:[function(require,module,exports){
/**
 * lodash 3.0.8 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = isFunction;

},{}],69:[function(require,module,exports){
/**
 * lodash 3.0.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var numberTag = '[object Number]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is `NaN`.
 *
 * **Note:** This method is not the same as [`isNaN`](https://es5.github.io/#x15.1.2.4)
 * which returns `true` for `undefined` and other non-numeric values.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `NaN`, else `false`.
 * @example
 *
 * _.isNaN(NaN);
 * // => true
 *
 * _.isNaN(new Number(NaN));
 * // => true
 *
 * isNaN(undefined);
 * // => true
 *
 * _.isNaN(undefined);
 * // => false
 */
function isNaN(value) {
  // An `NaN` primitive is the only value that is not equal to itself.
  // Perform the `toStringTag` check first to avoid errors with some ActiveX objects in IE.
  return isNumber(value) && value != +value;
}

/**
 * Checks if `value` is classified as a `Number` primitive or object.
 *
 * **Note:** To exclude `Infinity`, `-Infinity`, and `NaN`, which are classified
 * as numbers, use the `_.isFinite` method.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isNumber(3);
 * // => true
 *
 * _.isNumber(Number.MIN_VALUE);
 * // => true
 *
 * _.isNumber(Infinity);
 * // => true
 *
 * _.isNumber('3');
 * // => false
 */
function isNumber(value) {
  return typeof value == 'number' ||
    (isObjectLike(value) && objectToString.call(value) == numberTag);
}

module.exports = isNaN;

},{}],70:[function(require,module,exports){
/**
 * lodash 4.0.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var objectTag = '[object Object]';

/**
 * Checks if `value` is a host object in IE < 9.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a host object, else `false`.
 */
function isHostObject(value) {
  // Many host objects are `Object` objects that can coerce to strings
  // despite having improperly defined `toString` methods.
  var result = false;
  if (value != null && typeof value.toString != 'function') {
    try {
      result = !!(value + '');
    } catch (e) {}
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to resolve the decompiled source of functions. */
var funcToString = Function.prototype.toString;

/** Used to infer the `Object` constructor. */
var objectCtorString = funcToString.call(Object);

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var getPrototypeOf = Object.getPrototypeOf;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is a plain object, that is, an object created by the
 * `Object` constructor or one with a `[[Prototype]]` of `null`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 * }
 *
 * _.isPlainObject(new Foo);
 * // => false
 *
 * _.isPlainObject([1, 2, 3]);
 * // => false
 *
 * _.isPlainObject({ 'x': 0, 'y': 0 });
 * // => true
 *
 * _.isPlainObject(Object.create(null));
 * // => true
 */
function isPlainObject(value) {
  if (!isObjectLike(value) ||
      objectToString.call(value) != objectTag || isHostObject(value)) {
    return false;
  }
  var proto = objectProto;
  if (typeof value.constructor == 'function') {
    proto = getPrototypeOf(value);
  }
  if (proto === null) {
    return true;
  }
  var Ctor = proto.constructor;
  return (typeof Ctor == 'function' &&
    Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString);
}

module.exports = isPlainObject;

},{}],71:[function(require,module,exports){
/**
 * lodash 4.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** `Object#toString` result references. */
var stringTag = '[object String]';

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type Function
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

module.exports = isString;

},{}],72:[function(require,module,exports){
/**
 * lodash 3.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/**
 * Checks if `value` is `undefined`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
 * @example
 *
 * _.isUndefined(void 0);
 * // => true
 *
 * _.isUndefined(null);
 * // => false
 */
function isUndefined(value) {
  return value === undefined;
}

module.exports = isUndefined;

},{}],73:[function(require,module,exports){
/**
 * lodash 3.1.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var getNative = require('lodash._getnative'),
    isArguments = require('lodash.isarguments'),
    isArray = require('lodash.isarray');

/** Used to detect unsigned integer values. */
var reIsUint = /^\d+$/;

/** Used for native method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/* Native method references for those with the same name as other `lodash` methods. */
var nativeKeys = getNative(Object, 'keys');

/**
 * Used as the [maximum length](http://ecma-international.org/ecma-262/6.0/#sec-number.max_safe_integer)
 * of an array-like value.
 */
var MAX_SAFE_INTEGER = 9007199254740991;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if `value` is array-like.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 */
function isArrayLike(value) {
  return value != null && isLength(getLength(value));
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 */
function isLength(value) {
  return typeof value == 'number' && value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * A fallback implementation of `Object.keys` which creates an array of the
 * own enumerable property names of `object`.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function shimKeys(object) {
  var props = keysIn(object),
      propsLength = props.length,
      length = propsLength && object.length;

  var allowIndexes = !!length && isLength(length) &&
    (isArray(object) || isArguments(object));

  var index = -1,
      result = [];

  while (++index < propsLength) {
    var key = props[index];
    if ((allowIndexes && isIndex(key, length)) || hasOwnProperty.call(object, key)) {
      result.push(key);
    }
  }
  return result;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(1);
 * // => false
 */
function isObject(value) {
  // Avoid a V8 JIT bug in Chrome 19-20.
  // See https://code.google.com/p/v8/issues/detail?id=2291 for more details.
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Creates an array of the own enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects. See the
 * [ES spec](http://ecma-international.org/ecma-262/6.0/#sec-object.keys)
 * for more details.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keys(new Foo);
 * // => ['a', 'b'] (iteration order is not guaranteed)
 *
 * _.keys('hi');
 * // => ['0', '1']
 */
var keys = !nativeKeys ? shimKeys : function(object) {
  var Ctor = object == null ? undefined : object.constructor;
  if ((typeof Ctor == 'function' && Ctor.prototype === object) ||
      (typeof object != 'function' && isArrayLike(object))) {
    return shimKeys(object);
  }
  return isObject(object) ? nativeKeys(object) : [];
};

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  if (object == null) {
    return [];
  }
  if (!isObject(object)) {
    object = Object(object);
  }
  var length = object.length;
  length = (length && isLength(length) &&
    (isArray(object) || isArguments(object)) && length) || 0;

  var Ctor = object.constructor,
      index = -1,
      isProto = typeof Ctor == 'function' && Ctor.prototype === object,
      result = Array(length),
      skipIndexes = length > 0;

  while (++index < length) {
    result[index] = (index + '');
  }
  for (var key in object) {
    if (!(skipIndexes && isIndex(key, length)) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keys;

},{"lodash._getnative":48,"lodash.isarguments":63,"lodash.isarray":74}],74:[function(require,module,exports){
arguments[4][54][0].apply(exports,arguments)
},{"dup":54}],75:[function(require,module,exports){
/**
 * lodash 4.1.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var root = require('lodash._root');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/**
 * The base implementation of `_.times` without support for iteratee shorthands
 * or max array length checks.
 *
 * @private
 * @param {number} n The number of times to invoke `iteratee`.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the array of results.
 */
function baseTimes(n, iteratee) {
  var index = -1,
      result = Array(n);

  while (++index < n) {
    result[index] = iteratee(index);
  }
  return result;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/**
 * Converts `iterator` to an array.
 *
 * @private
 * @param {Object} iterator The iterator to convert.
 * @returns {Array} Returns the converted array.
 */
function iteratorToArray(iterator) {
  var data,
      result = [];

  while (!(data = iterator.next()).done) {
    result.push(data.value);
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var Reflect = root.Reflect,
    enumerate = Reflect ? Reflect.enumerate : undefined,
    propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * The base implementation of `_.keysIn` which doesn't skip the constructor
 * property of prototypes or treat sparse arrays as dense.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 */
function baseKeysIn(object) {
  object = object == null ? object : Object(object);

  var result = [];
  for (var key in object) {
    result.push(key);
  }
  return result;
}

// Fallback for IE < 9 with es6-shim.
if (enumerate && !propertyIsEnumerable.call({ 'valueOf': 1 }, 'valueOf')) {
  baseKeysIn = function(object) {
    return iteratorToArray(enumerate(object));
  };
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Creates an array of index keys for `object` values of arrays,
 * `arguments` objects, and strings, otherwise `null` is returned.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {Array|null} Returns index keys, else `null`.
 */
function indexKeys(object) {
  var length = object ? object.length : undefined;
  if (isLength(length) &&
      (isArray(object) || isString(object) || isArguments(object))) {
    return baseTimes(length, String);
  }
  return null;
}

/**
 * Checks if `value` is likely a prototype object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
 */
function isPrototype(value) {
  var Ctor = value && value.constructor,
      proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto;

  return value === proto;
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

/**
 * Creates an array of the own and inherited enumerable property names of `object`.
 *
 * **Note:** Non-object values are coerced to objects.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The object to query.
 * @returns {Array} Returns the array of property names.
 * @example
 *
 * function Foo() {
 *   this.a = 1;
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.keysIn(new Foo);
 * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
 */
function keysIn(object) {
  var index = -1,
      isProto = isPrototype(object),
      props = baseKeysIn(object),
      propsLength = props.length,
      indexes = indexKeys(object),
      skipIndexes = !!indexes,
      result = indexes || [],
      length = result.length;

  while (++index < propsLength) {
    var key = props[index];
    if (!(skipIndexes && (key == 'length' || isIndex(key, length))) &&
        !(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}

module.exports = keysIn;

},{"lodash._root":49}],76:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseEach = require('lodash._baseeach'),
    baseIteratee = require('lodash._baseiteratee');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/**
 * A specialized version of `_.map` for arrays without support for iteratee
 * shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function arrayMap(array, iteratee) {
  var index = -1,
      length = array.length,
      result = Array(length);

  while (++index < length) {
    result[index] = iteratee(array[index], index, array);
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `_.map` without support for iteratee shorthands.
 *
 * @private
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 */
function baseMap(collection, iteratee) {
  var index = -1,
      result = isArrayLike(collection) ? Array(collection.length) : [];

  baseEach(collection, function(value, key, collection) {
    result[++index] = iteratee(value, key, collection);
  });
  return result;
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Creates an array of values by running each element in `collection` through
 * `iteratee`. The iteratee is invoked with three arguments:
 * (value, index|key, collection).
 *
 * Many lodash methods are guarded to work as iteratees for methods like
 * `_.every`, `_.filter`, `_.map`, `_.mapValues`, `_.reject`, and `_.some`.
 *
 * The guarded methods are:
 * `ary`, `curry`, `curryRight`, `drop`, `dropRight`, `every`, `fill`,
 * `invert`, `parseInt`, `random`, `range`, `rangeRight`, `slice`, `some`,
 * `sortBy`, `take`, `takeRight`, `template`, `trim`, `trimEnd`, `trimStart`,
 * and `words`
 *
 * @static
 * @memberOf _
 * @category Collection
 * @param {Array|Object} collection The collection to iterate over.
 * @param {Function|Object|string} [iteratee=_.identity] The function invoked per iteration.
 * @returns {Array} Returns the new mapped array.
 * @example
 *
 * function square(n) {
 *   return n * n;
 * }
 *
 * _.map([4, 8], square);
 * // => [16, 64]
 *
 * _.map({ 'a': 4, 'b': 8 }, square);
 * // => [16, 64] (iteration order is not guaranteed)
 *
 * var users = [
 *   { 'user': 'barney' },
 *   { 'user': 'fred' }
 * ];
 *
 * // The `_.property` iteratee shorthand.
 * _.map(users, 'user');
 * // => ['barney', 'fred']
 */
function map(collection, iteratee) {
  var func = isArray(collection) ? arrayMap : baseMap;
  return func(collection, baseIteratee(iteratee, 3));
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

module.exports = map;

},{"lodash._baseeach":37,"lodash._baseiteratee":43}],77:[function(require,module,exports){
/**
 * lodash 4.3.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var Stack = require('lodash._stack'),
    baseClone = require('lodash._baseclone'),
    isPlainObject = require('lodash.isplainobject'),
    keysIn = require('lodash.keysin'),
    rest = require('lodash.rest');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var argsTag = '[object Arguments]',
    arrayTag = '[object Array]',
    boolTag = '[object Boolean]',
    dateTag = '[object Date]',
    errorTag = '[object Error]',
    funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    mapTag = '[object Map]',
    numberTag = '[object Number]',
    objectTag = '[object Object]',
    regexpTag = '[object RegExp]',
    setTag = '[object Set]',
    stringTag = '[object String]',
    weakMapTag = '[object WeakMap]';

var arrayBufferTag = '[object ArrayBuffer]',
    float32Tag = '[object Float32Array]',
    float64Tag = '[object Float64Array]',
    int8Tag = '[object Int8Array]',
    int16Tag = '[object Int16Array]',
    int32Tag = '[object Int32Array]',
    uint8Tag = '[object Uint8Array]',
    uint8ClampedTag = '[object Uint8ClampedArray]',
    uint16Tag = '[object Uint16Array]',
    uint32Tag = '[object Uint32Array]';

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Used to identify `toStringTag` values of typed arrays. */
var typedArrayTags = {};
typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
typedArrayTags[uint32Tag] = true;
typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
typedArrayTags[dateTag] = typedArrayTags[errorTag] =
typedArrayTags[funcTag] = typedArrayTags[mapTag] =
typedArrayTags[numberTag] = typedArrayTags[objectTag] =
typedArrayTags[regexpTag] = typedArrayTags[setTag] =
typedArrayTags[stringTag] = typedArrayTags[weakMapTag] = false;

/**
 * A specialized version of `_.forEach` for arrays without support for
 * iteratee shorthands.
 *
 * @private
 * @param {Array} array The array to iterate over.
 * @param {Function} iteratee The function invoked per iteration.
 * @returns {Array} Returns `array`.
 */
function arrayEach(array, iteratee) {
  var index = -1,
      length = array.length;

  while (++index < length) {
    if (iteratee(array[index], index, array) === false) {
      break;
    }
  }
  return array;
}

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/** Used to check objects for own properties. */
var hasOwnProperty = objectProto.hasOwnProperty;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var propertyIsEnumerable = objectProto.propertyIsEnumerable;

/**
 * This function is like `assignValue` except that it doesn't assign `undefined` values.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignMergeValue(object, key, value) {
  if ((value !== undefined && !eq(object[key], value)) ||
      (typeof key == 'number' && value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * Assigns `value` to `key` of `object` if the existing value is not equivalent
 * using [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @private
 * @param {Object} object The object to modify.
 * @param {string} key The key of the property to assign.
 * @param {*} value The value to assign.
 */
function assignValue(object, key, value) {
  var objValue = object[key];
  if ((!eq(objValue, value) ||
        (eq(objValue, objectProto[key]) && !hasOwnProperty.call(object, key))) ||
      (value === undefined && !(key in object))) {
    object[key] = value;
  }
}

/**
 * The base implementation of `_.merge` without support for multiple sources.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {number} srcIndex The index of `source`.
 * @param {Function} [customizer] The function to customize merged values.
 * @param {Object} [stack] Tracks traversed source values and their merged counterparts.
 */
function baseMerge(object, source, srcIndex, customizer, stack) {
  if (object === source) {
    return;
  }
  var props = (isArray(source) || isTypedArray(source))
    ? undefined
    : keysIn(source);

  arrayEach(props || source, function(srcValue, key) {
    if (props) {
      key = srcValue;
      srcValue = source[key];
    }
    if (isObject(srcValue)) {
      stack || (stack = new Stack);
      baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
    }
    else {
      var newValue = customizer
        ? customizer(object[key], srcValue, (key + ''), object, source, stack)
        : undefined;

      if (newValue === undefined) {
        newValue = srcValue;
      }
      assignMergeValue(object, key, newValue);
    }
  });
}

/**
 * A specialized version of `baseMerge` for arrays and objects which performs
 * deep merges and tracks traversed objects enabling objects with circular
 * references to be merged.
 *
 * @private
 * @param {Object} object The destination object.
 * @param {Object} source The source object.
 * @param {string} key The key of the value to merge.
 * @param {number} srcIndex The index of `source`.
 * @param {Function} mergeFunc The function to merge values.
 * @param {Function} [customizer] The function to customize assigned values.
 * @param {Object} [stack] Tracks traversed source values and their merged counterparts.
 */
function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
  var objValue = object[key],
      srcValue = source[key],
      stacked = stack.get(srcValue);

  if (stacked) {
    assignMergeValue(object, key, stacked);
    return;
  }
  var newValue = customizer
    ? customizer(objValue, srcValue, (key + ''), object, source, stack)
    : undefined;

  var isCommon = newValue === undefined;

  if (isCommon) {
    newValue = srcValue;
    if (isArray(srcValue) || isTypedArray(srcValue)) {
      if (isArray(objValue)) {
        newValue = objValue;
      }
      else if (isArrayLikeObject(objValue)) {
        newValue = copyArray(objValue);
      }
      else {
        isCommon = false;
        newValue = baseClone(srcValue, true);
      }
    }
    else if (isPlainObject(srcValue) || isArguments(srcValue)) {
      if (isArguments(objValue)) {
        newValue = toPlainObject(objValue);
      }
      else if (!isObject(objValue) || (srcIndex && isFunction(objValue))) {
        isCommon = false;
        newValue = baseClone(srcValue, true);
      }
      else {
        newValue = objValue;
      }
    }
    else {
      isCommon = false;
    }
  }
  stack.set(srcValue, newValue);

  if (isCommon) {
    // Recursively merge objects and arrays (susceptible to call stack limits).
    mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
  }
  assignMergeValue(object, key, newValue);
}

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Copies the values of `source` to `array`.
 *
 * @private
 * @param {Array} source The array to copy values from.
 * @param {Array} [array=[]] The array to copy values to.
 * @returns {Array} Returns `array`.
 */
function copyArray(source, array) {
  var index = -1,
      length = source.length;

  array || (array = Array(length));
  while (++index < length) {
    array[index] = source[index];
  }
  return array;
}

/**
 * Copies properties of `source` to `object`.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @returns {Object} Returns `object`.
 */
function copyObject(source, props, object) {
  return copyObjectWith(source, props, object);
}

/**
 * This function is like `copyObject` except that it accepts a function to
 * customize copied values.
 *
 * @private
 * @param {Object} source The object to copy properties from.
 * @param {Array} props The property names to copy.
 * @param {Object} [object={}] The object to copy properties to.
 * @param {Function} [customizer] The function to customize copied values.
 * @returns {Object} Returns `object`.
 */
function copyObjectWith(source, props, object, customizer) {
  object || (object = {});

  var index = -1,
      length = props.length;

  while (++index < length) {
    var key = props[index];

    var newValue = customizer
      ? customizer(object[key], source[key], key, object, source)
      : source[key];

    assignValue(object, key, newValue);
  }
  return object;
}

/**
 * Creates a function like `_.assign`.
 *
 * @private
 * @param {Function} assigner The function to assign values.
 * @returns {Function} Returns the new assigner function.
 */
function createAssigner(assigner) {
  return rest(function(object, sources) {
    var index = -1,
        length = sources.length,
        customizer = length > 1 ? sources[length - 1] : undefined,
        guard = length > 2 ? sources[2] : undefined;

    customizer = typeof customizer == 'function'
      ? (length--, customizer)
      : undefined;

    if (guard && isIterateeCall(sources[0], sources[1], guard)) {
      customizer = length < 3 ? undefined : customizer;
      length = 1;
    }
    object = Object(object);
    while (++index < length) {
      var source = sources[index];
      if (source) {
        assigner(object, source, index, customizer);
      }
    }
    return object;
  });
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
      ? (isArrayLike(object) && isIndex(index, object.length))
      : (type == 'string' && index in object)) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is likely an `arguments` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArguments(function() { return arguments; }());
 * // => true
 *
 * _.isArguments([1, 2, 3]);
 * // => false
 */
function isArguments(value) {
  // Safari 8.1 incorrectly makes `arguments.callee` enumerable in strict mode.
  return isArrayLikeObject(value) && hasOwnProperty.call(value, 'callee') &&
    (!propertyIsEnumerable.call(value, 'callee') || objectToString.call(value) == argsTag);
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * This method is like `_.isArrayLike` except that it also checks if `value`
 * is an object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an array-like object, else `false`.
 * @example
 *
 * _.isArrayLikeObject([1, 2, 3]);
 * // => true
 *
 * _.isArrayLikeObject(document.body.children);
 * // => true
 *
 * _.isArrayLikeObject('abc');
 * // => false
 *
 * _.isArrayLikeObject(_.noop);
 * // => false
 */
function isArrayLikeObject(value) {
  return isObjectLike(value) && isArrayLike(value);
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a typed array.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isTypedArray(new Uint8Array);
 * // => true
 *
 * _.isTypedArray([]);
 * // => false
 */
function isTypedArray(value) {
  return isObjectLike(value) &&
    isLength(value.length) && !!typedArrayTags[objectToString.call(value)];
}

/**
 * Converts `value` to a plain object flattening inherited enumerable
 * properties of `value` to own properties of the plain object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {Object} Returns the converted plain object.
 * @example
 *
 * function Foo() {
 *   this.b = 2;
 * }
 *
 * Foo.prototype.c = 3;
 *
 * _.assign({ 'a': 1 }, new Foo);
 * // => { 'a': 1, 'b': 2 }
 *
 * _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
 * // => { 'a': 1, 'b': 2, 'c': 3 }
 */
function toPlainObject(value) {
  return copyObject(value, keysIn(value));
}

/**
 * Recursively merges own and inherited enumerable properties of source objects
 * into the destination object. Source properties that resolve to `undefined`
 * are skipped if a destination value exists. Array and plain object properties
 * are merged recursively. Other objects and value types are overridden by
 * assignment. Source objects are applied from left to right. Subsequent
 * sources overwrite property assignments of previous sources.
 *
 * **Note:** This method mutates `object`.
 *
 * @static
 * @memberOf _
 * @category Object
 * @param {Object} object The destination object.
 * @param {...Object} [sources] The source objects.
 * @returns {Object} Returns `object`.
 * @example
 *
 * var users = {
 *   'data': [{ 'user': 'barney' }, { 'user': 'fred' }]
 * };
 *
 * var ages = {
 *   'data': [{ 'age': 36 }, { 'age': 40 }]
 * };
 *
 * _.merge(users, ages);
 * // => { 'data': [{ 'user': 'barney', 'age': 36 }, { 'user': 'fred', 'age': 40 }] }
 */
var merge = createAssigner(function(object, source, srcIndex) {
  baseMerge(object, source, srcIndex);
});

module.exports = merge;

},{"lodash._baseclone":36,"lodash._stack":51,"lodash.isplainobject":70,"lodash.keysin":75,"lodash.rest":79}],78:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseIteratee = require('lodash._baseiteratee'),
    basePullAt = require('lodash._basepullat');

/**
 * Removes all elements from `array` that `predicate` returns truthy for
 * and returns an array of the removed elements. The predicate is invoked with
 * three arguments: (value, index, array).
 *
 * **Note:** Unlike `_.filter`, this method mutates `array`.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to modify.
 * @param {Function|Object|string} [predicate=_.identity] The function invoked per iteration.
 * @returns {Array} Returns the new array of removed elements.
 * @example
 *
 * var array = [1, 2, 3, 4];
 * var evens = _.remove(array, function(n) {
 *   return n % 2 == 0;
 * });
 *
 * console.log(array);
 * // => [1, 3]
 *
 * console.log(evens);
 * // => [2, 4]
 */
function remove(array, predicate) {
  var result = [];
  if (!(array && array.length)) {
    return result;
  }
  var index = -1,
      indexes = [],
      length = array.length;

  predicate = baseIteratee(predicate, 3);
  while (++index < length) {
    var value = array[index];
    if (predicate(value, index, array)) {
      result.push(value);
      indexes.push(index);
    }
  }
  basePullAt(array, indexes);
  return result;
}

module.exports = remove;

},{"lodash._baseiteratee":43,"lodash._basepullat":44}],79:[function(require,module,exports){
/**
 * lodash 4.0.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * A faster alternative to `Function#apply`, this function invokes `func`
 * with the `this` binding of `thisArg` and the arguments of `args`.
 *
 * @private
 * @param {Function} func The function to invoke.
 * @param {*} thisArg The `this` binding of `func`.
 * @param {...*} args The arguments to invoke `func` with.
 * @returns {*} Returns the result of `func`.
 */
function apply(func, thisArg, args) {
  var length = args.length;
  switch (length) {
    case 0: return func.call(thisArg);
    case 1: return func.call(thisArg, args[0]);
    case 2: return func.call(thisArg, args[0], args[1]);
    case 3: return func.call(thisArg, args[0], args[1], args[2]);
  }
  return func.apply(thisArg, args);
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/* Built-in method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://mdn.io/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.rest(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function rest(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : toInteger(start), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        array = Array(length);

    while (++index < length) {
      array[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, array);
      case 1: return func.call(this, args[0], array);
      case 2: return func.call(this, args[0], args[1], array);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = array;
    return apply(func, this, otherArgs);
  };
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = rest;

},{}],80:[function(require,module,exports){
/**
 * lodash 3.6.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modern modularize exports="npm" -o ./`
 * Copyright 2012-2015 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as the `TypeError` message for "Functions" methods. */
var FUNC_ERROR_TEXT = 'Expected a function';

/* Native method references for those with the same name as other `lodash` methods. */
var nativeMax = Math.max;

/**
 * Creates a function that invokes `func` with the `this` binding of the
 * created function and arguments from `start` and beyond provided as an array.
 *
 * **Note:** This method is based on the [rest parameter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/rest_parameters).
 *
 * @static
 * @memberOf _
 * @category Function
 * @param {Function} func The function to apply a rest parameter to.
 * @param {number} [start=func.length-1] The start position of the rest parameter.
 * @returns {Function} Returns the new function.
 * @example
 *
 * var say = _.restParam(function(what, names) {
 *   return what + ' ' + _.initial(names).join(', ') +
 *     (_.size(names) > 1 ? ', & ' : '') + _.last(names);
 * });
 *
 * say('hello', 'fred', 'barney', 'pebbles');
 * // => 'hello fred, barney, & pebbles'
 */
function restParam(func, start) {
  if (typeof func != 'function') {
    throw new TypeError(FUNC_ERROR_TEXT);
  }
  start = nativeMax(start === undefined ? (func.length - 1) : (+start || 0), 0);
  return function() {
    var args = arguments,
        index = -1,
        length = nativeMax(args.length - start, 0),
        rest = Array(length);

    while (++index < length) {
      rest[index] = args[start + index];
    }
    switch (start) {
      case 0: return func.call(this, rest);
      case 1: return func.call(this, args[0], rest);
      case 2: return func.call(this, args[0], args[1], rest);
    }
    var otherArgs = Array(start + 1);
    index = -1;
    while (++index < start) {
      otherArgs[index] = args[index];
    }
    otherArgs[start] = rest;
    return func.apply(this, otherArgs);
  };
}

module.exports = restParam;

},{}],81:[function(require,module,exports){
/**
 * lodash 4.0.3 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var keys = require('lodash.keys');

/** Used as references for various `Number` constants. */
var MAX_SAFE_INTEGER = 9007199254740991;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]',
    stringTag = '[object String]';

/** Used to compose unicode character classes. */
var rsAstralRange = '\\ud800-\\udfff',
    rsComboMarksRange = '\\u0300-\\u036f\\ufe20-\\ufe23',
    rsComboSymbolsRange = '\\u20d0-\\u20f0',
    rsVarRange = '\\ufe0e\\ufe0f';

/** Used to compose unicode capture groups. */
var rsAstral = '[' + rsAstralRange + ']',
    rsCombo = '[' + rsComboMarksRange + rsComboSymbolsRange + ']',
    rsFitz = '\\ud83c[\\udffb-\\udfff]',
    rsModifier = '(?:' + rsCombo + '|' + rsFitz + ')',
    rsNonAstral = '[^' + rsAstralRange + ']',
    rsRegional = '(?:\\ud83c[\\udde6-\\uddff]){2}',
    rsSurrPair = '[\\ud800-\\udbff][\\udc00-\\udfff]',
    rsZWJ = '\\u200d';

/** Used to compose unicode regexes. */
var reOptMod = rsModifier + '?',
    rsOptVar = '[' + rsVarRange + ']?',
    rsOptJoin = '(?:' + rsZWJ + '(?:' + [rsNonAstral, rsRegional, rsSurrPair].join('|') + ')' + rsOptVar + reOptMod + ')*',
    rsSeq = rsOptVar + reOptMod + rsOptJoin,
    rsSymbol = '(?:' + [rsNonAstral + rsCombo + '?', rsCombo, rsRegional, rsSurrPair, rsAstral].join('|') + ')';

/** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
var reComplexSymbol = RegExp(rsFitz + '(?=' + rsFitz + ')|' + rsSymbol + rsSeq, 'g');

/** Used to detect strings with [zero-width joiners or code points from the astral planes](http://eev.ee/blog/2015/09/12/dark-corners-of-unicode/). */
var reHasComplexSymbol = RegExp('[' + rsZWJ + rsAstralRange  + rsComboMarksRange + rsComboSymbolsRange + rsVarRange + ']');

/**
 * Gets the number of symbols in `string`.
 *
 * @private
 * @param {string} string The string to inspect.
 * @returns {number} Returns the string size.
 */
function stringSize(string) {
  if (!(string && reHasComplexSymbol.test(string))) {
    return string.length;
  }
  var result = reComplexSymbol.lastIndex = 0;
  while (reComplexSymbol.test(string)) {
    result++;
  }
  return result;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Gets the size of `collection` by returning its length for array-like
 * values or the number of own enumerable properties for objects.
 *
 * @static
 * @memberOf _
 * @category Collection
 * @param {Array|Object} collection The collection to inspect.
 * @returns {number} Returns the collection size.
 * @example
 *
 * _.size([1, 2, 3]);
 * // => 3
 *
 * _.size({ 'a': 1, 'b': 2 });
 * // => 2
 *
 * _.size('pebbles');
 * // => 7
 */
function size(collection) {
  if (collection == null) {
    return 0;
  }
  if (isArrayLike(collection)) {
    var result = collection.length;
    return (result && isString(collection)) ? stringSize(collection) : result;
  }
  return keys(collection).length;
}

/**
 * Checks if `value` is classified as an `Array` object.
 *
 * @static
 * @memberOf _
 * @type {Function}
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isArray([1, 2, 3]);
 * // => true
 *
 * _.isArray(document.body.children);
 * // => false
 *
 * _.isArray('abc');
 * // => false
 *
 * _.isArray(_.noop);
 * // => false
 */
var isArray = Array.isArray;

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `String` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isString('abc');
 * // => true
 *
 * _.isString(1);
 * // => false
 */
function isString(value) {
  return typeof value == 'string' ||
    (!isArray(value) && isObjectLike(value) && objectToString.call(value) == stringTag);
}

module.exports = size;

},{"lodash.keys":82}],82:[function(require,module,exports){
arguments[4][38][0].apply(exports,arguments)
},{"dup":38}],83:[function(require,module,exports){
/**
 * lodash 4.0.2 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseSlice = require('lodash._baseslice');

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0,
    MAX_SAFE_INTEGER = 9007199254740991,
    MAX_INTEGER = 1.7976931348623157e+308,
    NAN = 0 / 0;

/** `Object#toString` result references. */
var funcTag = '[object Function]',
    genTag = '[object GeneratorFunction]';

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to detect bad signed hexadecimal string values. */
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

/** Used to detect binary string values. */
var reIsBinary = /^0b[01]+$/i;

/** Used to detect octal string values. */
var reIsOctal = /^0o[0-7]+$/i;

/** Used to detect unsigned integer values. */
var reIsUint = /^(?:0|[1-9]\d*)$/;

/** Built-in method references without a dependency on `root`. */
var freeParseInt = parseInt;

/**
 * Checks if `value` is a valid array-like index.
 *
 * @private
 * @param {*} value The value to check.
 * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
 * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
 */
function isIndex(value, length) {
  value = (typeof value == 'number' || reIsUint.test(value)) ? +value : -1;
  length = length == null ? MAX_SAFE_INTEGER : length;
  return value > -1 && value % 1 == 0 && value < length;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/**
 * The base implementation of `_.property` without support for deep paths.
 *
 * @private
 * @param {string} key The key of the property to get.
 * @returns {Function} Returns the new function.
 */
function baseProperty(key) {
  return function(object) {
    return object == null ? undefined : object[key];
  };
}

/**
 * Gets the "length" property value of `object`.
 *
 * **Note:** This function is used to avoid a [JIT bug](https://bugs.webkit.org/show_bug.cgi?id=142792)
 * that affects Safari on at least iOS 8.1-8.3 ARM64.
 *
 * @private
 * @param {Object} object The object to query.
 * @returns {*} Returns the "length" value.
 */
var getLength = baseProperty('length');

/**
 * Checks if the given arguments are from an iteratee call.
 *
 * @private
 * @param {*} value The potential iteratee value argument.
 * @param {*} index The potential iteratee index or key argument.
 * @param {*} object The potential iteratee object argument.
 * @returns {boolean} Returns `true` if the arguments are from an iteratee call, else `false`.
 */
function isIterateeCall(value, index, object) {
  if (!isObject(object)) {
    return false;
  }
  var type = typeof index;
  if (type == 'number'
      ? (isArrayLike(object) && isIndex(index, object.length))
      : (type == 'string' && index in object)) {
    return eq(object[index], value);
  }
  return false;
}

/**
 * Creates a slice of `array` from `start` up to, but not including, `end`.
 *
 * **Note:** This method is used instead of [`Array#slice`](https://mdn.io/Array/slice)
 * to ensure dense arrays are returned.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {Array} array The array to slice.
 * @param {number} [start=0] The start position.
 * @param {number} [end=array.length] The end position.
 * @returns {Array} Returns the slice of `array`.
 */
function slice(array, start, end) {
  var length = array ? array.length : 0;
  if (!length) {
    return [];
  }
  if (end && typeof end != 'number' && isIterateeCall(array, start, end)) {
    start = 0;
    end = length;
  }
  else {
    start = start == null ? 0 : toInteger(start);
    end = end === undefined ? length : toInteger(end);
  }
  return baseSlice(array, start, end);
}

/**
 * Performs a [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * comparison between two values to determine if they are equivalent.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to compare.
 * @param {*} other The other value to compare.
 * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
 * @example
 *
 * var object = { 'user': 'fred' };
 * var other = { 'user': 'fred' };
 *
 * _.eq(object, object);
 * // => true
 *
 * _.eq(object, other);
 * // => false
 *
 * _.eq('a', 'a');
 * // => true
 *
 * _.eq('a', Object('a'));
 * // => false
 *
 * _.eq(NaN, NaN);
 * // => true
 */
function eq(value, other) {
  return value === other || (value !== value && other !== other);
}

/**
 * Checks if `value` is array-like. A value is considered array-like if it's
 * not a function and has a `value.length` that's an integer greater than or
 * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
 * @example
 *
 * _.isArrayLike([1, 2, 3]);
 * // => true
 *
 * _.isArrayLike(document.body.children);
 * // => true
 *
 * _.isArrayLike('abc');
 * // => true
 *
 * _.isArrayLike(_.noop);
 * // => false
 */
function isArrayLike(value) {
  return value != null &&
    !(typeof value == 'function' && isFunction(value)) && isLength(getLength(value));
}

/**
 * Checks if `value` is classified as a `Function` object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isFunction(_);
 * // => true
 *
 * _.isFunction(/abc/);
 * // => false
 */
function isFunction(value) {
  // The use of `Object#toString` avoids issues with the `typeof` operator
  // in Safari 8 which returns 'object' for typed array constructors, and
  // PhantomJS 1.9 which returns 'function' for `NodeList` instances.
  var tag = isObject(value) ? objectToString.call(value) : '';
  return tag == funcTag || tag == genTag;
}

/**
 * Checks if `value` is a valid array-like length.
 *
 * **Note:** This function is loosely based on [`ToLength`](http://ecma-international.org/ecma-262/6.0/#sec-tolength).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
 * @example
 *
 * _.isLength(3);
 * // => true
 *
 * _.isLength(Number.MIN_VALUE);
 * // => false
 *
 * _.isLength(Infinity);
 * // => false
 *
 * _.isLength('3');
 * // => false
 */
function isLength(value) {
  return typeof value == 'number' &&
    value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
}

/**
 * Checks if `value` is the [language type](https://es5.github.io/#x8) of `Object`.
 * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is an object, else `false`.
 * @example
 *
 * _.isObject({});
 * // => true
 *
 * _.isObject([1, 2, 3]);
 * // => true
 *
 * _.isObject(_.noop);
 * // => true
 *
 * _.isObject(null);
 * // => false
 */
function isObject(value) {
  var type = typeof value;
  return !!value && (type == 'object' || type == 'function');
}

/**
 * Converts `value` to an integer.
 *
 * **Note:** This function is loosely based on [`ToInteger`](http://www.ecma-international.org/ecma-262/6.0/#sec-tointeger).
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to convert.
 * @returns {number} Returns the converted integer.
 * @example
 *
 * _.toInteger(3);
 * // => 3
 *
 * _.toInteger(Number.MIN_VALUE);
 * // => 0
 *
 * _.toInteger(Infinity);
 * // => 1.7976931348623157e+308
 *
 * _.toInteger('3');
 * // => 3
 */
function toInteger(value) {
  if (!value) {
    return value === 0 ? value : 0;
  }
  value = toNumber(value);
  if (value === INFINITY || value === -INFINITY) {
    var sign = (value < 0 ? -1 : 1);
    return sign * MAX_INTEGER;
  }
  var remainder = value % 1;
  return value === value ? (remainder ? value - remainder : value) : 0;
}

/**
 * Converts `value` to a number.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {number} Returns the number.
 * @example
 *
 * _.toNumber(3);
 * // => 3
 *
 * _.toNumber(Number.MIN_VALUE);
 * // => 5e-324
 *
 * _.toNumber(Infinity);
 * // => Infinity
 *
 * _.toNumber('3');
 * // => 3
 */
function toNumber(value) {
  if (isObject(value)) {
    var other = isFunction(value.valueOf) ? value.valueOf() : value;
    value = isObject(other) ? (other + '') : other;
  }
  if (typeof value != 'string') {
    return value === 0 ? value : +value;
  }
  value = value.replace(reTrim, '');
  var isBinary = reIsBinary.test(value);
  return (isBinary || reIsOctal.test(value))
    ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
    : (reIsBadHex.test(value) ? NAN : +value);
}

module.exports = slice;

},{"lodash._baseslice":45}],84:[function(require,module,exports){
(function (global){
/**
 * lodash 4.1.1 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */

/** Used as references for various `Number` constants. */
var INFINITY = 1 / 0;

/** `Object#toString` result references. */
var symbolTag = '[object Symbol]';

/** Used to determine if values are of the language type `Object`. */
var objectTypes = {
  'function': true,
  'object': true
};

/** Detect free variable `exports`. */
var freeExports = (objectTypes[typeof exports] && exports && !exports.nodeType)
  ? exports
  : undefined;

/** Detect free variable `module`. */
var freeModule = (objectTypes[typeof module] && module && !module.nodeType)
  ? module
  : undefined;

/** Detect free variable `global` from Node.js. */
var freeGlobal = checkGlobal(freeExports && freeModule && typeof global == 'object' && global);

/** Detect free variable `self`. */
var freeSelf = checkGlobal(objectTypes[typeof self] && self);

/** Detect free variable `window`. */
var freeWindow = checkGlobal(objectTypes[typeof window] && window);

/** Detect `this` as the global object. */
var thisGlobal = checkGlobal(objectTypes[typeof this] && this);

/**
 * Used as a reference to the global object.
 *
 * The `this` value is used if it's the global object to avoid Greasemonkey's
 * restricted `window` object, otherwise the `window` object is used.
 */
var root = freeGlobal ||
  ((freeWindow !== (thisGlobal && thisGlobal.window)) && freeWindow) ||
    freeSelf || thisGlobal || Function('return this')();

/**
 * Checks if `value` is a global object.
 *
 * @private
 * @param {*} value The value to check.
 * @returns {null|Object} Returns `value` if it's a global object, else `null`.
 */
function checkGlobal(value) {
  return (value && value.Object === Object) ? value : null;
}

/** Used for built-in method references. */
var objectProto = Object.prototype;

/**
 * Used to resolve the [`toStringTag`](http://ecma-international.org/ecma-262/6.0/#sec-object.prototype.tostring)
 * of values.
 */
var objectToString = objectProto.toString;

/** Built-in value references. */
var Symbol = root.Symbol;

/** Used to convert symbols to primitives and strings. */
var symbolProto = Symbol ? Symbol.prototype : undefined,
    symbolToString = Symbol ? symbolProto.toString : undefined;

/**
 * Checks if `value` is object-like. A value is object-like if it's not `null`
 * and has a `typeof` result of "object".
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
 * @example
 *
 * _.isObjectLike({});
 * // => true
 *
 * _.isObjectLike([1, 2, 3]);
 * // => true
 *
 * _.isObjectLike(_.noop);
 * // => false
 *
 * _.isObjectLike(null);
 * // => false
 */
function isObjectLike(value) {
  return !!value && typeof value == 'object';
}

/**
 * Checks if `value` is classified as a `Symbol` primitive or object.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to check.
 * @returns {boolean} Returns `true` if `value` is correctly classified, else `false`.
 * @example
 *
 * _.isSymbol(Symbol.iterator);
 * // => true
 *
 * _.isSymbol('abc');
 * // => false
 */
function isSymbol(value) {
  return typeof value == 'symbol' ||
    (isObjectLike(value) && objectToString.call(value) == symbolTag);
}

/**
 * Converts `value` to a string if it's not one. An empty string is returned
 * for `null` and `undefined` values. The sign of `-0` is preserved.
 *
 * @static
 * @memberOf _
 * @category Lang
 * @param {*} value The value to process.
 * @returns {string} Returns the string.
 * @example
 *
 * _.toString(null);
 * // => ''
 *
 * _.toString(-0);
 * // => '-0'
 *
 * _.toString([1, 2, 3]);
 * // => '1,2,3'
 */
function toString(value) {
  // Exit early for strings to avoid a performance hit in some environments.
  if (typeof value == 'string') {
    return value;
  }
  if (value == null) {
    return '';
  }
  if (isSymbol(value)) {
    return Symbol ? symbolToString.call(value) : '';
  }
  var result = (value + '');
  return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
}

module.exports = toString;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],85:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var toString = require('lodash.tostring');

/** Used to match leading and trailing whitespace. */
var reTrim = /^\s+|\s+$/g;

/** Used to compose unicode character classes. */
var rsAstralRange = '\\ud800-\\udfff',
    rsComboMarksRange = '\\u0300-\\u036f\\ufe20-\\ufe23',
    rsComboSymbolsRange = '\\u20d0-\\u20f0',
    rsVarRange = '\\ufe0e\\ufe0f';

/** Used to compose unicode capture groups. */
var rsAstral = '[' + rsAstralRange + ']',
    rsCombo = '[' + rsComboMarksRange + rsComboSymbolsRange + ']',
    rsFitz = '\\ud83c[\\udffb-\\udfff]',
    rsModifier = '(?:' + rsCombo + '|' + rsFitz + ')',
    rsNonAstral = '[^' + rsAstralRange + ']',
    rsRegional = '(?:\\ud83c[\\udde6-\\uddff]){2}',
    rsSurrPair = '[\\ud800-\\udbff][\\udc00-\\udfff]',
    rsZWJ = '\\u200d';

/** Used to compose unicode regexes. */
var reOptMod = rsModifier + '?',
    rsOptVar = '[' + rsVarRange + ']?',
    rsOptJoin = '(?:' + rsZWJ + '(?:' + [rsNonAstral, rsRegional, rsSurrPair].join('|') + ')' + rsOptVar + reOptMod + ')*',
    rsSeq = rsOptVar + reOptMod + rsOptJoin,
    rsSymbol = '(?:' + [rsNonAstral + rsCombo + '?', rsCombo, rsRegional, rsSurrPair, rsAstral].join('|') + ')';

/** Used to match [string symbols](https://mathiasbynens.be/notes/javascript-unicode). */
var reComplexSymbol = RegExp(rsFitz + '(?=' + rsFitz + ')|' + rsSymbol + rsSeq, 'g');

/**
 * The base implementation of `_.indexOf` without `fromIndex` bounds checks.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {*} value The value to search for.
 * @param {number} fromIndex The index to search from.
 * @returns {number} Returns the index of the matched value, else `-1`.
 */
function baseIndexOf(array, value, fromIndex) {
  if (value !== value) {
    return indexOfNaN(array, fromIndex);
  }
  var index = fromIndex - 1,
      length = array.length;

  while (++index < length) {
    if (array[index] === value) {
      return index;
    }
  }
  return -1;
}

/**
 * Used by `_.trim` and `_.trimStart` to get the index of the first string symbol
 * that is not found in the character symbols.
 *
 * @private
 * @param {Array} strSymbols The string symbols to inspect.
 * @param {Array} chrSymbols The character symbols to find.
 * @returns {number} Returns the index of the first unmatched string symbol.
 */
function charsStartIndex(strSymbols, chrSymbols) {
  var index = -1,
      length = strSymbols.length;

  while (++index < length && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
  return index;
}

/**
 * Used by `_.trim` and `_.trimEnd` to get the index of the last string symbol
 * that is not found in the character symbols.
 *
 * @private
 * @param {Array} strSymbols The string symbols to inspect.
 * @param {Array} chrSymbols The character symbols to find.
 * @returns {number} Returns the index of the last unmatched string symbol.
 */
function charsEndIndex(strSymbols, chrSymbols) {
  var index = strSymbols.length;

  while (index-- && baseIndexOf(chrSymbols, strSymbols[index], 0) > -1) {}
  return index;
}

/**
 * Gets the index at which the first occurrence of `NaN` is found in `array`.
 *
 * @private
 * @param {Array} array The array to search.
 * @param {number} fromIndex The index to search from.
 * @param {boolean} [fromRight] Specify iterating from right to left.
 * @returns {number} Returns the index of the matched `NaN`, else `-1`.
 */
function indexOfNaN(array, fromIndex, fromRight) {
  var length = array.length,
      index = fromIndex + (fromRight ? 0 : -1);

  while ((fromRight ? index-- : ++index < length)) {
    var other = array[index];
    if (other !== other) {
      return index;
    }
  }
  return -1;
}

/**
 * Converts `string` to an array.
 *
 * @private
 * @param {string} string The string to convert.
 * @returns {Array} Returns the converted array.
 */
function stringToArray(string) {
  return string.match(reComplexSymbol);
}

/**
 * Removes leading and trailing whitespace or specified characters from `string`.
 *
 * @static
 * @memberOf _
 * @category String
 * @param {string} [string=''] The string to trim.
 * @param {string} [chars=whitespace] The characters to trim.
 * @param- {Object} [guard] Enables use as an iteratee for functions like `_.map`.
 * @returns {string} Returns the trimmed string.
 * @example
 *
 * _.trim('  abc  ');
 * // => 'abc'
 *
 * _.trim('-_-abc-_-', '_-');
 * // => 'abc'
 *
 * _.map(['  foo  ', '  bar  '], _.trim);
 * // => ['foo', 'bar']
 */
function trim(string, chars, guard) {
  string = toString(string);
  if (!string) {
    return string;
  }
  if (guard || chars === undefined) {
    return string.replace(reTrim, '');
  }
  chars = (chars + '');
  if (!chars) {
    return string;
  }
  var strSymbols = stringToArray(string),
      chrSymbols = stringToArray(chars);

  return strSymbols
    .slice(charsStartIndex(strSymbols, chrSymbols), charsEndIndex(strSymbols, chrSymbols) + 1)
    .join('');
}

module.exports = trim;

},{"lodash.tostring":84}],86:[function(require,module,exports){
/**
 * lodash 4.2.0 (Custom Build) <https://lodash.com/>
 * Build: `lodash modularize exports="npm" -o ./`
 * Copyright 2012-2016 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.8.3 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2016 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <https://lodash.com/license>
 */
var baseFlatten = require('lodash._baseflatten'),
    baseUniq = require('lodash._baseuniq'),
    rest = require('lodash.rest');

/**
 * Creates an array of unique values, in order, from all given arrays using
 * [`SameValueZero`](http://ecma-international.org/ecma-262/6.0/#sec-samevaluezero)
 * for equality comparisons.
 *
 * @static
 * @memberOf _
 * @category Array
 * @param {...Array} [arrays] The arrays to inspect.
 * @returns {Array} Returns the new array of combined values.
 * @example
 *
 * _.union([2, 1], [4, 2], [1, 2]);
 * // => [2, 1, 4]
 */
var union = rest(function(arrays) {
  return baseUniq(baseFlatten(arrays, 1, true));
});

module.exports = union;

},{"lodash._baseflatten":41,"lodash._baseuniq":46,"lodash.rest":79}],87:[function(require,module,exports){
var raf = require("raf")
var TypedError = require("error/typed")

var InvalidUpdateInRender = TypedError({
    type: "main-loop.invalid.update.in-render",
    message: "main-loop: Unexpected update occurred in loop.\n" +
        "We are currently rendering a view, " +
            "you can't change state right now.\n" +
        "The diff is: {stringDiff}.\n" +
        "SUGGESTED FIX: find the state mutation in your view " +
            "or rendering function and remove it.\n" +
        "The view should not have any side effects.\n",
    diff: null,
    stringDiff: null
})

module.exports = main

function main(initialState, view, opts) {
    opts = opts || {}

    var currentState = initialState
    var create = opts.create
    var diff = opts.diff
    var patch = opts.patch
    var redrawScheduled = false

    var tree = opts.initialTree || view(currentState)
    var target = opts.target || create(tree, opts)
    var inRenderingTransaction = false

    currentState = null

    var loop = {
        state: initialState,
        target: target,
        update: update
    }
    return loop

    function update(state) {
        if (inRenderingTransaction) {
            throw InvalidUpdateInRender({
                diff: state._diff,
                stringDiff: JSON.stringify(state._diff)
            })
        }

        if (currentState === null && !redrawScheduled) {
            redrawScheduled = true
            raf(redraw)
        }

        currentState = state
        loop.state = state
    }

    function redraw() {
        redrawScheduled = false
        if (currentState === null) {
            return
        }

        inRenderingTransaction = true
        var newTree = view(currentState)

        if (opts.createOnly) {
            inRenderingTransaction = false
            create(newTree, opts)
        } else {
            var patches = diff(tree, newTree, opts)
            inRenderingTransaction = false
            target = patch(target, patches, opts)
        }

        tree = newTree
        currentState = null
    }
}

},{"error/typed":20,"raf":93}],88:[function(require,module,exports){
// Generated by CoffeeScript 1.8.0
(function() {
  var Events, Mediator, mediator;

  Events = require('backbone-events-standalone');

  Mediator = (function() {
    Mediator.prototype.attributes = {};

    function Mediator() {}

    Mediator.prototype.set = function(key, data) {
      return this.attributes[key] = data;
    };

    Mediator.prototype.get = function(key) {
      return this.attributes[key];
    };

    return Mediator;

  })();

  Events.mixin(Mediator.prototype);

  mediator = new Mediator;

  mediator.Mediator = Mediator;

  module.exports = mediator;

}).call(this);

},{"backbone-events-standalone":2}],89:[function(require,module,exports){
/*!
	Papa Parse
	v4.1.2
	https://github.com/mholt/PapaParse
*/
(function(global)
{
	"use strict";

	var IS_WORKER = !global.document && !!global.postMessage,
		IS_PAPA_WORKER = IS_WORKER && /(\?|&)papaworker(=|&|$)/.test(global.location.search),
		LOADED_SYNC = false, AUTO_SCRIPT_PATH;
	var workers = {}, workerIdCounter = 0;

	var Papa = {};

	Papa.parse = CsvToJson;
	Papa.unparse = JsonToCsv;

	Papa.RECORD_SEP = String.fromCharCode(30);
	Papa.UNIT_SEP = String.fromCharCode(31);
	Papa.BYTE_ORDER_MARK = "\ufeff";
	Papa.BAD_DELIMITERS = ["\r", "\n", "\"", Papa.BYTE_ORDER_MARK];
	Papa.WORKERS_SUPPORTED = !IS_WORKER && !!global.Worker;
	Papa.SCRIPT_PATH = null;	// Must be set by your code if you use workers and this lib is loaded asynchronously

	// Configurable chunk sizes for local and remote files, respectively
	Papa.LocalChunkSize = 1024 * 1024 * 10;	// 10 MB
	Papa.RemoteChunkSize = 1024 * 1024 * 5;	// 5 MB
	Papa.DefaultDelimiter = ",";			// Used if not specified and detection fails

	// Exposed for testing and development only
	Papa.Parser = Parser;
	Papa.ParserHandle = ParserHandle;
	Papa.NetworkStreamer = NetworkStreamer;
	Papa.FileStreamer = FileStreamer;
	Papa.StringStreamer = StringStreamer;

	if (typeof module !== 'undefined' && module.exports)
	{
		// Export to Node...
		module.exports = Papa;
	}
	else if (isFunction(global.define) && global.define.amd)
	{
		// Wireup with RequireJS
		define(function() { return Papa; });
	}
	else
	{
		// ...or as browser global
		global.Papa = Papa;
	}

	if (global.jQuery)
	{
		var $ = global.jQuery;
		$.fn.parse = function(options)
		{
			var config = options.config || {};
			var queue = [];

			this.each(function(idx)
			{
				var supported = $(this).prop('tagName').toUpperCase() == "INPUT"
								&& $(this).attr('type').toLowerCase() == "file"
								&& global.FileReader;

				if (!supported || !this.files || this.files.length == 0)
					return true;	// continue to next input element

				for (var i = 0; i < this.files.length; i++)
				{
					queue.push({
						file: this.files[i],
						inputElem: this,
						instanceConfig: $.extend({}, config)
					});
				}
			});

			parseNextFile();	// begin parsing
			return this;		// maintains chainability


			function parseNextFile()
			{
				if (queue.length == 0)
				{
					if (isFunction(options.complete))
						options.complete();
					return;
				}

				var f = queue[0];

				if (isFunction(options.before))
				{
					var returned = options.before(f.file, f.inputElem);

					if (typeof returned === 'object')
					{
						if (returned.action == "abort")
						{
							error("AbortError", f.file, f.inputElem, returned.reason);
							return;	// Aborts all queued files immediately
						}
						else if (returned.action == "skip")
						{
							fileComplete();	// parse the next file in the queue, if any
							return;
						}
						else if (typeof returned.config === 'object')
							f.instanceConfig = $.extend(f.instanceConfig, returned.config);
					}
					else if (returned == "skip")
					{
						fileComplete();	// parse the next file in the queue, if any
						return;
					}
				}

				// Wrap up the user's complete callback, if any, so that ours also gets executed
				var userCompleteFunc = f.instanceConfig.complete;
				f.instanceConfig.complete = function(results)
				{
					if (isFunction(userCompleteFunc))
						userCompleteFunc(results, f.file, f.inputElem);
					fileComplete();
				};

				Papa.parse(f.file, f.instanceConfig);
			}

			function error(name, file, elem, reason)
			{
				if (isFunction(options.error))
					options.error({name: name}, file, elem, reason);
			}

			function fileComplete()
			{
				queue.splice(0, 1);
				parseNextFile();
			}
		}
	}


	if (IS_PAPA_WORKER)
	{
		global.onmessage = workerThreadReceivedMessage;
	}
	else if (Papa.WORKERS_SUPPORTED)
	{
		AUTO_SCRIPT_PATH = getScriptPath();

		// Check if the script was loaded synchronously
		if (!document.body)
		{
			// Body doesn't exist yet, must be synchronous
			LOADED_SYNC = true;
		}
		else
		{
			document.addEventListener('DOMContentLoaded', function () {
				LOADED_SYNC = true;
			}, true);
		}
	}




	function CsvToJson(_input, _config)
	{
		_config = _config || {};

		if (_config.worker && Papa.WORKERS_SUPPORTED)
		{
			var w = newWorker();

			w.userStep = _config.step;
			w.userChunk = _config.chunk;
			w.userComplete = _config.complete;
			w.userError = _config.error;

			_config.step = isFunction(_config.step);
			_config.chunk = isFunction(_config.chunk);
			_config.complete = isFunction(_config.complete);
			_config.error = isFunction(_config.error);
			delete _config.worker;	// prevent infinite loop

			w.postMessage({
				input: _input,
				config: _config,
				workerId: w.id
			});

			return;
		}

		var streamer = null;
		if (typeof _input === 'string')
		{
			if (_config.download)
				streamer = new NetworkStreamer(_config);
			else
				streamer = new StringStreamer(_config);
		}
		else if ((global.File && _input instanceof File) || _input instanceof Object)	// ...Safari. (see issue #106)
			streamer = new FileStreamer(_config);

		return streamer.stream(_input);
	}






	function JsonToCsv(_input, _config)
	{
		var _output = "";
		var _fields = [];

		// Default configuration

		/** whether to surround every datum with quotes */
		var _quotes = false;

		/** delimiting character */
		var _delimiter = ",";

		/** newline character(s) */
		var _newline = "\r\n";

		unpackConfig();

		if (typeof _input === 'string')
			_input = JSON.parse(_input);

		if (_input instanceof Array)
		{
			if (!_input.length || _input[0] instanceof Array)
				return serialize(null, _input);
			else if (typeof _input[0] === 'object')
				return serialize(objectKeys(_input[0]), _input);
		}
		else if (typeof _input === 'object')
		{
			if (typeof _input.data === 'string')
				_input.data = JSON.parse(_input.data);

			if (_input.data instanceof Array)
			{
				if (!_input.fields)
					_input.fields = _input.data[0] instanceof Array
									? _input.fields
									: objectKeys(_input.data[0]);

				if (!(_input.data[0] instanceof Array) && typeof _input.data[0] !== 'object')
					_input.data = [_input.data];	// handles input like [1,2,3] or ["asdf"]
			}

			return serialize(_input.fields || [], _input.data || []);
		}

		// Default (any valid paths should return before this)
		throw "exception: Unable to serialize unrecognized input";


		function unpackConfig()
		{
			if (typeof _config !== 'object')
				return;

			if (typeof _config.delimiter === 'string'
				&& _config.delimiter.length == 1
				&& Papa.BAD_DELIMITERS.indexOf(_config.delimiter) == -1)
			{
				_delimiter = _config.delimiter;
			}

			if (typeof _config.quotes === 'boolean'
				|| _config.quotes instanceof Array)
				_quotes = _config.quotes;

			if (typeof _config.newline === 'string')
				_newline = _config.newline;
		}


		/** Turns an object's keys into an array */
		function objectKeys(obj)
		{
			if (typeof obj !== 'object')
				return [];
			var keys = [];
			for (var key in obj)
				keys.push(key);
			return keys;
		}

		/** The double for loop that iterates the data and writes out a CSV string including header row */
		function serialize(fields, data)
		{
			var csv = "";

			if (typeof fields === 'string')
				fields = JSON.parse(fields);
			if (typeof data === 'string')
				data = JSON.parse(data);

			var hasHeader = fields instanceof Array && fields.length > 0;
			var dataKeyedByField = !(data[0] instanceof Array);

			// If there a header row, write it first
			if (hasHeader)
			{
				for (var i = 0; i < fields.length; i++)
				{
					if (i > 0)
						csv += _delimiter;
					csv += safe(fields[i], i);
				}
				if (data.length > 0)
					csv += _newline;
			}

			// Then write out the data
			for (var row = 0; row < data.length; row++)
			{
				var maxCol = hasHeader ? fields.length : data[row].length;

				for (var col = 0; col < maxCol; col++)
				{
					if (col > 0)
						csv += _delimiter;
					var colIdx = hasHeader && dataKeyedByField ? fields[col] : col;
					csv += safe(data[row][colIdx], col);
				}

				if (row < data.length - 1)
					csv += _newline;
			}

			return csv;
		}

		/** Encloses a value around quotes if needed (makes a value safe for CSV insertion) */
		function safe(str, col)
		{
			if (typeof str === "undefined" || str === null)
				return "";

			str = str.toString().replace(/"/g, '""');

			var needsQuotes = (typeof _quotes === 'boolean' && _quotes)
							|| (_quotes instanceof Array && _quotes[col])
							|| hasAny(str, Papa.BAD_DELIMITERS)
							|| str.indexOf(_delimiter) > -1
							|| str.charAt(0) == ' '
							|| str.charAt(str.length - 1) == ' ';

			return needsQuotes ? '"' + str + '"' : str;
		}

		function hasAny(str, substrings)
		{
			for (var i = 0; i < substrings.length; i++)
				if (str.indexOf(substrings[i]) > -1)
					return true;
			return false;
		}
	}

	/** ChunkStreamer is the base prototype for various streamer implementations. */
	function ChunkStreamer(config)
	{
		this._handle = null;
		this._paused = false;
		this._finished = false;
		this._input = null;
		this._baseIndex = 0;
		this._partialLine = "";
		this._rowCount = 0;
		this._start = 0;
		this._nextChunk = null;
		this.isFirstChunk = true;
		this._completeResults = {
			data: [],
			errors: [],
			meta: {}
		};
		replaceConfig.call(this, config);

		this.parseChunk = function(chunk)
		{
			// First chunk pre-processing
			if (this.isFirstChunk && isFunction(this._config.beforeFirstChunk))
			{
				var modifiedChunk = this._config.beforeFirstChunk(chunk);
				if (modifiedChunk !== undefined)
					chunk = modifiedChunk;
			}
			this.isFirstChunk = false;

			// Rejoin the line we likely just split in two by chunking the file
			var aggregate = this._partialLine + chunk;
			this._partialLine = "";

			var results = this._handle.parse(aggregate, this._baseIndex, !this._finished);
			
			if (this._handle.paused() || this._handle.aborted())
				return;
			
			var lastIndex = results.meta.cursor;
			
			if (!this._finished)
			{
				this._partialLine = aggregate.substring(lastIndex - this._baseIndex);
				this._baseIndex = lastIndex;
			}

			if (results && results.data)
				this._rowCount += results.data.length;

			var finishedIncludingPreview = this._finished || (this._config.preview && this._rowCount >= this._config.preview);

			if (IS_PAPA_WORKER)
			{
				global.postMessage({
					results: results,
					workerId: Papa.WORKER_ID,
					finished: finishedIncludingPreview
				});
			}
			else if (isFunction(this._config.chunk))
			{
				this._config.chunk(results, this._handle);
				if (this._paused)
					return;
				results = undefined;
				this._completeResults = undefined;
			}

			if (!this._config.step && !this._config.chunk) {
				this._completeResults.data = this._completeResults.data.concat(results.data);
				this._completeResults.errors = this._completeResults.errors.concat(results.errors);
				this._completeResults.meta = results.meta;
			}

			if (finishedIncludingPreview && isFunction(this._config.complete) && (!results || !results.meta.aborted))
				this._config.complete(this._completeResults);

			if (!finishedIncludingPreview && (!results || !results.meta.paused))
				this._nextChunk();

			return results;
		};

		this._sendError = function(error)
		{
			if (isFunction(this._config.error))
				this._config.error(error);
			else if (IS_PAPA_WORKER && this._config.error)
			{
				global.postMessage({
					workerId: Papa.WORKER_ID,
					error: error,
					finished: false
				});
			}
		};

		function replaceConfig(config)
		{
			// Deep-copy the config so we can edit it
			var configCopy = copy(config);
			configCopy.chunkSize = parseInt(configCopy.chunkSize);	// parseInt VERY important so we don't concatenate strings!
			if (!config.step && !config.chunk)
				configCopy.chunkSize = null;  // disable Range header if not streaming; bad values break IIS - see issue #196
			this._handle = new ParserHandle(configCopy);
			this._handle.streamer = this;
			this._config = configCopy;	// persist the copy to the caller
		}
	}


	function NetworkStreamer(config)
	{
		config = config || {};
		if (!config.chunkSize)
			config.chunkSize = Papa.RemoteChunkSize;
		ChunkStreamer.call(this, config);

		var xhr;

		if (IS_WORKER)
		{
			this._nextChunk = function()
			{
				this._readChunk();
				this._chunkLoaded();
			};
		}
		else
		{
			this._nextChunk = function()
			{
				this._readChunk();
			};
		}

		this.stream = function(url)
		{
			this._input = url;
			this._nextChunk();	// Starts streaming
		};

		this._readChunk = function()
		{
			if (this._finished)
			{
				this._chunkLoaded();
				return;
			}

			xhr = new XMLHttpRequest();
			
			if (!IS_WORKER)
			{
				xhr.onload = bindFunction(this._chunkLoaded, this);
				xhr.onerror = bindFunction(this._chunkError, this);
			}

			xhr.open("GET", this._input, !IS_WORKER);
			
			if (this._config.chunkSize)
			{
				var end = this._start + this._config.chunkSize - 1;	// minus one because byte range is inclusive
				xhr.setRequestHeader("Range", "bytes="+this._start+"-"+end);
				xhr.setRequestHeader("If-None-Match", "webkit-no-cache"); // https://bugs.webkit.org/show_bug.cgi?id=82672
			}

			try {
				xhr.send();
			}
			catch (err) {
				this._chunkError(err.message);
			}

			if (IS_WORKER && xhr.status == 0)
				this._chunkError();
			else
				this._start += this._config.chunkSize;
		}

		this._chunkLoaded = function()
		{
			if (xhr.readyState != 4)
				return;

			if (xhr.status < 200 || xhr.status >= 400)
			{
				this._chunkError();
				return;
			}

			this._finished = !this._config.chunkSize || this._start > getFileSize(xhr);
			this.parseChunk(xhr.responseText);
		}

		this._chunkError = function(errorMessage)
		{
			var errorText = xhr.statusText || errorMessage;
			this._sendError(errorText);
		}

		function getFileSize(xhr)
		{
			var contentRange = xhr.getResponseHeader("Content-Range");
			return parseInt(contentRange.substr(contentRange.lastIndexOf("/") + 1));
		}
	}
	NetworkStreamer.prototype = Object.create(ChunkStreamer.prototype);
	NetworkStreamer.prototype.constructor = NetworkStreamer;


	function FileStreamer(config)
	{
		config = config || {};
		if (!config.chunkSize)
			config.chunkSize = Papa.LocalChunkSize;
		ChunkStreamer.call(this, config);

		var reader, slice;

		// FileReader is better than FileReaderSync (even in worker) - see http://stackoverflow.com/q/24708649/1048862
		// But Firefox is a pill, too - see issue #76: https://github.com/mholt/PapaParse/issues/76
		var usingAsyncReader = typeof FileReader !== 'undefined';	// Safari doesn't consider it a function - see issue #105

		this.stream = function(file)
		{
			this._input = file;
			slice = file.slice || file.webkitSlice || file.mozSlice;

			if (usingAsyncReader)
			{
				reader = new FileReader();		// Preferred method of reading files, even in workers
				reader.onload = bindFunction(this._chunkLoaded, this);
				reader.onerror = bindFunction(this._chunkError, this);
			}
			else
				reader = new FileReaderSync();	// Hack for running in a web worker in Firefox

			this._nextChunk();	// Starts streaming
		};

		this._nextChunk = function()
		{
			if (!this._finished && (!this._config.preview || this._rowCount < this._config.preview))
				this._readChunk();
		}

		this._readChunk = function()
		{
			var input = this._input;
			if (this._config.chunkSize)
			{
				var end = Math.min(this._start + this._config.chunkSize, this._input.size);
				input = slice.call(input, this._start, end);
			}
			var txt = reader.readAsText(input, this._config.encoding);
			if (!usingAsyncReader)
				this._chunkLoaded({ target: { result: txt } });	// mimic the async signature
		}

		this._chunkLoaded = function(event)
		{
			// Very important to increment start each time before handling results
			this._start += this._config.chunkSize;
			this._finished = !this._config.chunkSize || this._start >= this._input.size;
			this.parseChunk(event.target.result);
		}

		this._chunkError = function()
		{
			this._sendError(reader.error);
		}

	}
	FileStreamer.prototype = Object.create(ChunkStreamer.prototype);
	FileStreamer.prototype.constructor = FileStreamer;


	function StringStreamer(config)
	{
		config = config || {};
		ChunkStreamer.call(this, config);

		var string;
		var remaining;
		this.stream = function(s)
		{
			string = s;
			remaining = s;
			return this._nextChunk();
		}
		this._nextChunk = function()
		{
			if (this._finished) return;
			var size = this._config.chunkSize;
			var chunk = size ? remaining.substr(0, size) : remaining;
			remaining = size ? remaining.substr(size) : '';
			this._finished = !remaining;
			return this.parseChunk(chunk);
		}
	}
	StringStreamer.prototype = Object.create(StringStreamer.prototype);
	StringStreamer.prototype.constructor = StringStreamer;



	// Use one ParserHandle per entire CSV file or string
	function ParserHandle(_config)
	{
		// One goal is to minimize the use of regular expressions...
		var FLOAT = /^\s*-?(\d*\.?\d+|\d+\.?\d*)(e[-+]?\d+)?\s*$/i;

		var self = this;
		var _stepCounter = 0;	// Number of times step was called (number of rows parsed)
		var _input;				// The input being parsed
		var _parser;			// The core parser being used
		var _paused = false;	// Whether we are paused or not
		var _aborted = false;   // Whether the parser has aborted or not
		var _delimiterError;	// Temporary state between delimiter detection and processing results
		var _fields = [];		// Fields are from the header row of the input, if there is one
		var _results = {		// The last results returned from the parser
			data: [],
			errors: [],
			meta: {}
		};

		if (isFunction(_config.step))
		{
			var userStep = _config.step;
			_config.step = function(results)
			{
				_results = results;

				if (needsHeaderRow())
					processResults();
				else	// only call user's step function after header row
				{
					processResults();

					// It's possbile that this line was empty and there's no row here after all
					if (_results.data.length == 0)
						return;

					_stepCounter += results.data.length;
					if (_config.preview && _stepCounter > _config.preview)
						_parser.abort();
					else
						userStep(_results, self);
				}
			};
		}

		/**
		 * Parses input. Most users won't need, and shouldn't mess with, the baseIndex
		 * and ignoreLastRow parameters. They are used by streamers (wrapper functions)
		 * when an input comes in multiple chunks, like from a file.
		 */
		this.parse = function(input, baseIndex, ignoreLastRow)
		{
			if (!_config.newline)
				_config.newline = guessLineEndings(input);

			_delimiterError = false;
			if (!_config.delimiter)
			{
				var delimGuess = guessDelimiter(input);
				if (delimGuess.successful)
					_config.delimiter = delimGuess.bestDelimiter;
				else
				{
					_delimiterError = true;	// add error after parsing (otherwise it would be overwritten)
					_config.delimiter = Papa.DefaultDelimiter;
				}
				_results.meta.delimiter = _config.delimiter;
			}

			var parserConfig = copy(_config);
			if (_config.preview && _config.header)
				parserConfig.preview++;	// to compensate for header row

			_input = input;
			_parser = new Parser(parserConfig);
			_results = _parser.parse(_input, baseIndex, ignoreLastRow);
			processResults();
			return _paused ? { meta: { paused: true } } : (_results || { meta: { paused: false } });
		};

		this.paused = function()
		{
			return _paused;
		};

		this.pause = function()
		{
			_paused = true;
			_parser.abort();
			_input = _input.substr(_parser.getCharIndex());
		};

		this.resume = function()
		{
			_paused = false;
			self.streamer.parseChunk(_input);
		};

		this.aborted = function () {
			return _aborted;
		}

		this.abort = function()
		{
			_aborted = true;
			_parser.abort();
			_results.meta.aborted = true;
			if (isFunction(_config.complete))
				_config.complete(_results);
			_input = "";
		};

		function processResults()
		{
			if (_results && _delimiterError)
			{
				addError("Delimiter", "UndetectableDelimiter", "Unable to auto-detect delimiting character; defaulted to '"+Papa.DefaultDelimiter+"'");
				_delimiterError = false;
			}

			if (_config.skipEmptyLines)
			{
				for (var i = 0; i < _results.data.length; i++)
					if (_results.data[i].length == 1 && _results.data[i][0] == "")
						_results.data.splice(i--, 1);
			}

			if (needsHeaderRow())
				fillHeaderFields();

			return applyHeaderAndDynamicTyping();
		}

		function needsHeaderRow()
		{
			return _config.header && _fields.length == 0;
		}

		function fillHeaderFields()
		{
			if (!_results)
				return;
			for (var i = 0; needsHeaderRow() && i < _results.data.length; i++)
				for (var j = 0; j < _results.data[i].length; j++)
					_fields.push(_results.data[i][j]);
			_results.data.splice(0, 1);
		}

		function applyHeaderAndDynamicTyping()
		{
			if (!_results || (!_config.header && !_config.dynamicTyping))
				return _results;

			for (var i = 0; i < _results.data.length; i++)
			{
				var row = {};

				for (var j = 0; j < _results.data[i].length; j++)
				{
					if (_config.dynamicTyping)
					{
						var value = _results.data[i][j];
						if (value == "true" || value == "TRUE")
							_results.data[i][j] = true;
						else if (value == "false" || value == "FALSE")
							_results.data[i][j] = false;
						else
							_results.data[i][j] = tryParseFloat(value);
					}

					if (_config.header)
					{
						if (j >= _fields.length)
						{
							if (!row["__parsed_extra"])
								row["__parsed_extra"] = [];
							row["__parsed_extra"].push(_results.data[i][j]);
						}
						else
							row[_fields[j]] = _results.data[i][j];
					}
				}

				if (_config.header)
				{
					_results.data[i] = row;
					if (j > _fields.length)
						addError("FieldMismatch", "TooManyFields", "Too many fields: expected " + _fields.length + " fields but parsed " + j, i);
					else if (j < _fields.length)
						addError("FieldMismatch", "TooFewFields", "Too few fields: expected " + _fields.length + " fields but parsed " + j, i);
				}
			}

			if (_config.header && _results.meta)
				_results.meta.fields = _fields;
			return _results;
		}

		function guessDelimiter(input)
		{
			var delimChoices = [",", "\t", "|", ";", Papa.RECORD_SEP, Papa.UNIT_SEP];
			var bestDelim, bestDelta, fieldCountPrevRow;

			for (var i = 0; i < delimChoices.length; i++)
			{
				var delim = delimChoices[i];
				var delta = 0, avgFieldCount = 0;
				fieldCountPrevRow = undefined;

				var preview = new Parser({
					delimiter: delim,
					preview: 10
				}).parse(input);

				for (var j = 0; j < preview.data.length; j++)
				{
					var fieldCount = preview.data[j].length;
					avgFieldCount += fieldCount;

					if (typeof fieldCountPrevRow === 'undefined')
					{
						fieldCountPrevRow = fieldCount;
						continue;
					}
					else if (fieldCount > 1)
					{
						delta += Math.abs(fieldCount - fieldCountPrevRow);
						fieldCountPrevRow = fieldCount;
					}
				}

				if (preview.data.length > 0)
					avgFieldCount /= preview.data.length;

				if ((typeof bestDelta === 'undefined' || delta < bestDelta)
					&& avgFieldCount > 1.99)
				{
					bestDelta = delta;
					bestDelim = delim;
				}
			}

			_config.delimiter = bestDelim;

			return {
				successful: !!bestDelim,
				bestDelimiter: bestDelim
			}
		}

		function guessLineEndings(input)
		{
			input = input.substr(0, 1024*1024);	// max length 1 MB

			var r = input.split('\r');

			if (r.length == 1)
				return '\n';

			var numWithN = 0;
			for (var i = 0; i < r.length; i++)
			{
				if (r[i][0] == '\n')
					numWithN++;
			}

			return numWithN >= r.length / 2 ? '\r\n' : '\r';
		}

		function tryParseFloat(val)
		{
			var isNumber = FLOAT.test(val);
			return isNumber ? parseFloat(val) : val;
		}

		function addError(type, code, msg, row)
		{
			_results.errors.push({
				type: type,
				code: code,
				message: msg,
				row: row
			});
		}
	}





	/** The core parser implements speedy and correct CSV parsing */
	function Parser(config)
	{
		// Unpack the config object
		config = config || {};
		var delim = config.delimiter;
		var newline = config.newline;
		var comments = config.comments;
		var step = config.step;
		var preview = config.preview;
		var fastMode = config.fastMode;

		// Delimiter must be valid
		if (typeof delim !== 'string'
			|| Papa.BAD_DELIMITERS.indexOf(delim) > -1)
			delim = ",";

		// Comment character must be valid
		if (comments === delim)
			throw "Comment character same as delimiter";
		else if (comments === true)
			comments = "#";
		else if (typeof comments !== 'string'
			|| Papa.BAD_DELIMITERS.indexOf(comments) > -1)
			comments = false;

		// Newline must be valid: \r, \n, or \r\n
		if (newline != '\n' && newline != '\r' && newline != '\r\n')
			newline = '\n';

		// We're gonna need these at the Parser scope
		var cursor = 0;
		var aborted = false;

		this.parse = function(input, baseIndex, ignoreLastRow)
		{
			// For some reason, in Chrome, this speeds things up (!?)
			if (typeof input !== 'string')
				throw "Input must be a string";

			// We don't need to compute some of these every time parse() is called,
			// but having them in a more local scope seems to perform better
			var inputLen = input.length,
				delimLen = delim.length,
				newlineLen = newline.length,
				commentsLen = comments.length;
			var stepIsFunction = typeof step === 'function';

			// Establish starting state
			cursor = 0;
			var data = [], errors = [], row = [], lastCursor = 0;

			if (!input)
				return returnable();

			if (fastMode || (fastMode !== false && input.indexOf('"') === -1))
			{
				var rows = input.split(newline);
				for (var i = 0; i < rows.length; i++)
				{
					var row = rows[i];
					cursor += row.length;
					if (i !== rows.length - 1)
						cursor += newline.length;
					else if (ignoreLastRow)
						return returnable();
					if (comments && row.substr(0, commentsLen) == comments)
						continue;
					if (stepIsFunction)
					{
						data = [];
						pushRow(row.split(delim));
						doStep();
						if (aborted)
							return returnable();
					}
					else
						pushRow(row.split(delim));
					if (preview && i >= preview)
					{
						data = data.slice(0, preview);
						return returnable(true);
					}
				}
				return returnable();
			}

			var nextDelim = input.indexOf(delim, cursor);
			var nextNewline = input.indexOf(newline, cursor);

			// Parser loop
			for (;;)
			{
				// Field has opening quote
				if (input[cursor] == '"')
				{
					// Start our search for the closing quote where the cursor is
					var quoteSearch = cursor;

					// Skip the opening quote
					cursor++;

					for (;;)
					{
						// Find closing quote
						var quoteSearch = input.indexOf('"', quoteSearch+1);

						if (quoteSearch === -1)
						{
							if (!ignoreLastRow) {
								// No closing quote... what a pity
								errors.push({
									type: "Quotes",
									code: "MissingQuotes",
									message: "Quoted field unterminated",
									row: data.length,	// row has yet to be inserted
									index: cursor
								});
							}
							return finish();
						}

						if (quoteSearch === inputLen-1)
						{
							// Closing quote at EOF
							var value = input.substring(cursor, quoteSearch).replace(/""/g, '"');
							return finish(value);
						}

						// If this quote is escaped, it's part of the data; skip it
						if (input[quoteSearch+1] == '"')
						{
							quoteSearch++;
							continue;
						}

						if (input[quoteSearch+1] == delim)
						{
							// Closing quote followed by delimiter
							row.push(input.substring(cursor, quoteSearch).replace(/""/g, '"'));
							cursor = quoteSearch + 1 + delimLen;
							nextDelim = input.indexOf(delim, cursor);
							nextNewline = input.indexOf(newline, cursor);
							break;
						}

						if (input.substr(quoteSearch+1, newlineLen) === newline)
						{
							// Closing quote followed by newline
							row.push(input.substring(cursor, quoteSearch).replace(/""/g, '"'));
							saveRow(quoteSearch + 1 + newlineLen);
							nextDelim = input.indexOf(delim, cursor);	// because we may have skipped the nextDelim in the quoted field

							if (stepIsFunction)
							{
								doStep();
								if (aborted)
									return returnable();
							}
							
							if (preview && data.length >= preview)
								return returnable(true);

							break;
						}
					}

					continue;
				}

				// Comment found at start of new line
				if (comments && row.length === 0 && input.substr(cursor, commentsLen) === comments)
				{
					if (nextNewline == -1)	// Comment ends at EOF
						return returnable();
					cursor = nextNewline + newlineLen;
					nextNewline = input.indexOf(newline, cursor);
					nextDelim = input.indexOf(delim, cursor);
					continue;
				}

				// Next delimiter comes before next newline, so we've reached end of field
				if (nextDelim !== -1 && (nextDelim < nextNewline || nextNewline === -1))
				{
					row.push(input.substring(cursor, nextDelim));
					cursor = nextDelim + delimLen;
					nextDelim = input.indexOf(delim, cursor);
					continue;
				}

				// End of row
				if (nextNewline !== -1)
				{
					row.push(input.substring(cursor, nextNewline));
					saveRow(nextNewline + newlineLen);

					if (stepIsFunction)
					{
						doStep();
						if (aborted)
							return returnable();
					}

					if (preview && data.length >= preview)
						return returnable(true);

					continue;
				}

				break;
			}


			return finish();


			function pushRow(row)
			{
				data.push(row);
				lastCursor = cursor;
			}

			/**
			 * Appends the remaining input from cursor to the end into
			 * row, saves the row, calls step, and returns the results.
			 */
			function finish(value)
			{
				if (ignoreLastRow)
					return returnable();
				if (typeof value === 'undefined')
					value = input.substr(cursor);
				row.push(value);
				cursor = inputLen;	// important in case parsing is paused
				pushRow(row);
				if (stepIsFunction)
					doStep();
				return returnable();
			}

			/**
			 * Appends the current row to the results. It sets the cursor
			 * to newCursor and finds the nextNewline. The caller should
			 * take care to execute user's step function and check for
			 * preview and end parsing if necessary.
			 */
			function saveRow(newCursor)
			{
				cursor = newCursor;
				pushRow(row);
				row = [];
				nextNewline = input.indexOf(newline, cursor);
			}

			/** Returns an object with the results, errors, and meta. */
			function returnable(stopped)
			{
				return {
					data: data,
					errors: errors,
					meta: {
						delimiter: delim,
						linebreak: newline,
						aborted: aborted,
						truncated: !!stopped,
						cursor: lastCursor + (baseIndex || 0)
					}
				};
			}

			/** Executes the user's step function and resets data & errors. */
			function doStep()
			{
				step(returnable());
				data = [], errors = [];
			}
		};

		/** Sets the abort flag */
		this.abort = function()
		{
			aborted = true;
		};

		/** Gets the cursor position */
		this.getCharIndex = function()
		{
			return cursor;
		};
	}


	// If you need to load Papa Parse asynchronously and you also need worker threads, hard-code
	// the script path here. See: https://github.com/mholt/PapaParse/issues/87#issuecomment-57885358
	function getScriptPath()
	{
		var scripts = document.getElementsByTagName('script');
		return scripts.length ? scripts[scripts.length - 1].src : '';
	}

	function newWorker()
	{
		if (!Papa.WORKERS_SUPPORTED)
			return false;
		if (!LOADED_SYNC && Papa.SCRIPT_PATH === null)
			throw new Error(
				'Script path cannot be determined automatically when Papa Parse is loaded asynchronously. ' +
				'You need to set Papa.SCRIPT_PATH manually.'
			);
		var workerUrl = Papa.SCRIPT_PATH || AUTO_SCRIPT_PATH;
		// Append "papaworker" to the search string to tell papaparse that this is our worker.
		workerUrl += (workerUrl.indexOf('?') !== -1 ? '&' : '?') + 'papaworker';
		var w = new global.Worker(workerUrl);
		w.onmessage = mainThreadReceivedMessage;
		w.id = workerIdCounter++;
		workers[w.id] = w;
		return w;
	}

	/** Callback when main thread receives a message */
	function mainThreadReceivedMessage(e)
	{
		var msg = e.data;
		var worker = workers[msg.workerId];
		var aborted = false;

		if (msg.error)
			worker.userError(msg.error, msg.file);
		else if (msg.results && msg.results.data)
		{
			var abort = function() {
				aborted = true;
				completeWorker(msg.workerId, { data: [], errors: [], meta: { aborted: true } });
			};

			var handle = {
				abort: abort,
				pause: notImplemented,
				resume: notImplemented
			};

			if (isFunction(worker.userStep))
			{
				for (var i = 0; i < msg.results.data.length; i++)
				{
					worker.userStep({
						data: [msg.results.data[i]],
						errors: msg.results.errors,
						meta: msg.results.meta
					}, handle);
					if (aborted)
						break;
				}
				delete msg.results;	// free memory ASAP
			}
			else if (isFunction(worker.userChunk))
			{
				worker.userChunk(msg.results, handle, msg.file);
				delete msg.results;
			}
		}

		if (msg.finished && !aborted)
			completeWorker(msg.workerId, msg.results);
	}

	function completeWorker(workerId, results) {
		var worker = workers[workerId];
		if (isFunction(worker.userComplete))
			worker.userComplete(results);
		worker.terminate();
		delete workers[workerId];
	}

	function notImplemented() {
		throw "Not implemented.";
	}

	/** Callback when worker thread receives a message */
	function workerThreadReceivedMessage(e)
	{
		var msg = e.data;

		if (typeof Papa.WORKER_ID === 'undefined' && msg)
			Papa.WORKER_ID = msg.workerId;

		if (typeof msg.input === 'string')
		{
			global.postMessage({
				workerId: Papa.WORKER_ID,
				results: Papa.parse(msg.input, msg.config),
				finished: true
			});
		}
		else if ((global.File && msg.input instanceof File) || msg.input instanceof Object)	// thank you, Safari (see issue #106)
		{
			var results = Papa.parse(msg.input, msg.config);
			if (results)
				global.postMessage({
					workerId: Papa.WORKER_ID,
					results: results,
					finished: true
				});
		}
	}

	/** Makes a deep copy of an array or object (mostly) */
	function copy(obj)
	{
		if (typeof obj !== 'object')
			return obj;
		var cpy = obj instanceof Array ? [] : {};
		for (var key in obj)
			cpy[key] = copy(obj[key]);
		return cpy;
	}

	function bindFunction(f, self)
	{
		return function() { f.apply(self, arguments); };
	}

	function isFunction(func)
	{
		return typeof func === 'function';
	}
})(typeof window !== 'undefined' ? window : this);

},{}],90:[function(require,module,exports){
var trim = require('trim')
  , forEach = require('for-each')
  , isArray = function(arg) {
      return Object.prototype.toString.call(arg) === '[object Array]';
    }

module.exports = function (headers) {
  if (!headers)
    return {}

  var result = {}

  forEach(
      trim(headers).split('\n')
    , function (row) {
        var index = row.indexOf(':')
          , key = trim(row.slice(0, index)).toLowerCase()
          , value = trim(row.slice(index + 1))

        if (typeof(result[key]) === 'undefined') {
          result[key] = value
        } else if (isArray(result[key])) {
          result[key].push(value)
        } else {
          result[key] = [ result[key], value ]
        }
      }
  )

  return result
}
},{"for-each":25,"trim":100}],91:[function(require,module,exports){
(function (process){
// Generated by CoffeeScript 1.6.3
(function() {
  var getNanoSeconds, hrtime, loadTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - loadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    loadTime = getNanoSeconds();
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);

/*

*/

}).call(this,require('_process'))
},{"_process":7}],92:[function(require,module,exports){
function identity(x) { return x; }

module.exports = identity;
module.exports.dash = identity;
module.exports.dash = identity;

},{}],93:[function(require,module,exports){
var now = require('performance-now')
  , global = typeof window === 'undefined' ? {} : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = global['request' + suffix]
  , caf = global['cancel' + suffix] || global['cancelRequest' + suffix]
  , isNative = true

for(var i = 0; i < vendors.length && !raf; i++) {
  raf = global[vendors[i] + 'Request' + suffix]
  caf = global[vendors[i] + 'Cancel' + suffix]
      || global[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  isNative = false

  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  if(!isNative) {
    return raf.call(global, fn)
  }
  return raf.call(global, function() {
    try{
      fn.apply(this, arguments)
    } catch(e) {
      setTimeout(function() { throw e }, 0)
    }
  })
}
module.exports.cancel = function() {
  caf.apply(global, arguments)
}

},{"performance-now":91}],94:[function(require,module,exports){
(function (process){
module.exports = function (tasks, cb) {
  var results, pending, keys
  var isSync = true

  if (Array.isArray(tasks)) {
    results = []
    pending = tasks.length
  } else {
    keys = Object.keys(tasks)
    results = {}
    pending = keys.length
  }

  function done (err) {
    function end () {
      if (cb) cb(err, results)
      cb = null
    }
    if (isSync) process.nextTick(end)
    else end()
  }

  function each (i, err, result) {
    results[i] = result
    if (--pending === 0 || err) {
      done(err)
    }
  }

  if (!pending) {
    // empty
    done(null)
  } else if (keys) {
    // object
    keys.forEach(function (key) {
      tasks[key](each.bind(undefined, key))
    })
  } else {
    // array
    tasks.forEach(function (task, i) {
      task(each.bind(undefined, i))
    })
  }

  isSync = false
}

}).call(this,require('_process'))
},{"_process":7}],95:[function(require,module,exports){
'use strict';

var bindAll = require('lodash.bindall');
var transform = require('dom-transform');
var tinycolor = require('tinycolor2');
var Emitter = require('component-emitter');
var isNumber = require('is-number');
var clamp = require('./src/utils/maths/clamp');

/**
 * Creates a new Colorpicker
 * @param {Object} options
 * @param {String|Number|Object} options.color The default color that the colorpicker will display. Default is #FFFFFF. It can be a hexadecimal number or an hex String.
 * @param {String|Number|Object} options.background The background color of the colorpicker. Default is transparent. It can be a hexadecimal number or an hex String.
 * @param {DomElement} options.el A dom node to add the colorpicker to. You can also use `colorPicker.appendTo(domNode)` afterwards if you prefer.
 * @param {Number} options.width Desired width of the color picker. Default is 175.
 * @param {Number} options.height Desired height of the color picker. Default is 150.
 */
function SimpleColorPicker(options) {
  // options
  options = options || {};

  // properties
  this.color = null;
  this.width = 0;
  this.height = 0;
  this.hue = 0;
  this.choosing = false;
  this.position = {x: 0, y: 0};
  this.huePosition = 0;
  this.saturationWidth = 0;
  this.maxHue = 0;
  this.inputIsNumber = false;

  // bind methods to scope (only if needed)
  bindAll(this, '_onSaturationMouseMove', '_onSaturationMouseDown', '_onSaturationMouseUp', '_onHueMouseDown', '_onHueMouseUp', '_onHueMouseMove');

  // create dom
  this.$el = document.createElement('div');
  this.$el.className = 'Scp';
  this.$el.innerHTML = [
    '<div class="Scp-saturation">',
      '<div class="Scp-brightness"></div>',
      '<div class="Scp-sbSelector"></div>',
    '</div>',
    '<div class="Scp-hue">',
      '<div class="Scp-hSelector"></div>',
    '</div>'
  ].join('\n');

  // dom accessors
  this.$saturation = this.$el.querySelector('.Scp-saturation');
  this.$hue = this.$el.querySelector('.Scp-hue');
  this.$sbSelector = this.$el.querySelector('.Scp-sbSelector');
  this.$hSelector = this.$el.querySelector('.Scp-hSelector');

  // event listeners
  this.$saturation.addEventListener('mousedown', this._onSaturationMouseDown);
  this.$saturation.addEventListener('touchstart', this._onSaturationMouseDown);
  this.$hue.addEventListener('mousedown', this._onHueMouseDown);
  this.$hue.addEventListener('touchstart', this._onHueMouseDown);

  // some styling and DOMing from options
  if (options.el) {
    this.appendTo(options.el);
  }
  if (options.background) {
    this.setBackgroundColor(options.background);
  }
  this.setSize(options.width || 175, options.height || 150);
  this.setColor(options.color);

  return this;
}

Emitter(SimpleColorPicker.prototype);

/* =============================================================================
  Public API
============================================================================= */
/**
 * Add the colorPicker instance to a domElement.
 * @param  {domElement} domElement
 * @return {colorPicker} returns itself for chaining purpose
 */
SimpleColorPicker.prototype.appendTo = function(domElement) {
  domElement.appendChild(this.$el);
  return this;
};

/**
 * Removes colorpicker from is parent and kill all listeners.
 * Call this method for proper destroy.
 */
SimpleColorPicker.prototype.remove = function() {
  this.$saturation.removeEventListener('mousedown', this._onSaturationMouseDown);
  this.$saturation.removeEventListener('touchstart', this._onSaturationMouseDown);
  this.$hue.removeEventListener('mousedown', this._onHueMouseDown);
  this.$hue.removeEventListener('touchstart', this._onHueMouseDown);
  this._onSaturationMouseUp();
  this._onHueMouseUp();
  this.off();
  if (this.$el.parentNode) {
    this.$el.parentNode.removeChild(this.$el);
  }
};

/**
 * Manually set the current color of the colorpicker. This is the method
 * used on instantiation to convert `color` option to actual color for
 * the colorpicker. Param can be a hexadecimal number or an hex String.
 * @param {String|Number} color hex color desired
 */
SimpleColorPicker.prototype.setColor = function(color) {
  if(isNumber(color)) {
    this.inputIsNumber = true;
    color = '#' + ('00000' + (color | 0).toString(16)).substr(-6);
  }
  else {
    this.inputIsNumber = false;
  }
  this.color = tinycolor(color);

  var hsvColor = this.color.toHsv();

  if(!isNaN(hsvColor.h)) {
    this.hue = hsvColor.h;
  }

  this._moveSelectorTo(this.saturationWidth * hsvColor.s, (1 - hsvColor.v) * this.height);
  this._moveHueTo((1 - (this.hue / 360)) * this.height);

  this._updateHue();
  return this;
};

/**
 * Set size of the color picker for a given width and height. Note that
 * a padding of 5px will be added if you chose to use the background option
 * of the constructor.
 * @param {Number} width
 * @param {Number} height
 */
SimpleColorPicker.prototype.setSize = function(width, height) {
  this.width = width;
  this.height = height;
  this.$el.style.width = this.width + 'px';
  this.$el.style.height = this.height + 'px';
  this.saturationWidth = this.width - 25;
  this.maxHue = this.height - 2;
  return this;
};

/**
 * Set the background color of the colorpicker. It also adds a 5px padding
 * for design purpose.
 * @param {String|Number} color hex color desired for background
 */
SimpleColorPicker.prototype.setBackgroundColor = function(color) {
  if(isNumber(color)) {
    color = '#' + ('00000' + (color | 0).toString(16)).substr(-6);
  }
  this.$el.style.padding = '5px';
  this.$el.style.background = tinycolor(color).toHexString();
};

/**
 * Removes background of the colorpicker if previously set. It's no use
 * calling this method if you didn't set the background option on start
 * or if you didn't call setBackgroundColor previously.
 */
SimpleColorPicker.prototype.setNoBackground = function() {
  this.$el.style.padding = '0px';
  this.$el.style.background = 'none';
};

/**
 * Registers callback to the update event of the colorpicker.
 * ColorPicker inherits from [component/emitter](https://github.com/component/emitter)
 * so you could do the same thing by calling `colorPicker.on('update');`
 * @param  {Function} callback
 * @return {colorPicker} returns itself for chaining purpose
 */
SimpleColorPicker.prototype.onChange = function(callback) {
  this.on('update', callback);
  this.emit('update', this.getHexString());
  return this;
};

/* =============================================================================
  Color getters
============================================================================= */
/**
 * Main color getter, will return a formatted color string depending on input
 * or a number depending on the last setColor call.
 * @return {Number|String}
 */
SimpleColorPicker.prototype.getColor = function() {
  if(this.inputIsNumber) {
    return this.getHexNumber();
  }
  return this.color.toString();
};

/**
 * Returns color as css hex string (ex: '#FF0000').
 * @return {String}
 */
SimpleColorPicker.prototype.getHexString = function() {
  return this.color.toHexString().toUpperCase();
};

/**
 * Returns color as number (ex: 0xFF0000).
 * @return {Number}
 */
SimpleColorPicker.prototype.getHexNumber = function() {
  return parseInt(this.color.toHex(), 16);
};

/**
 * Returns color as {r: 255, g: 0, b: 0} object.
 * @return {Object}
 */
SimpleColorPicker.prototype.getRGB = function() {
  return this.color.toRgb();
};

/**
 * Returns color as {h: 100, s: 1, v: 1} object.
 * @return {Object}
 */
SimpleColorPicker.prototype.getHSV = function() {
  return this.color.toHsv();
};

/**
 * Returns true if color is perceived as dark
 * @return {Boolean}
 */
SimpleColorPicker.prototype.isDark = function() {
  return this.color.isDark();
};

/**
 * Returns true if color is perceived as light
 * @return {Boolean}
 */
SimpleColorPicker.prototype.isLight = function() {
  return this.color.isLight();
};

/* =============================================================================
  "Private" Methods LOL silly javascript
============================================================================= */
SimpleColorPicker.prototype._moveSelectorTo = function(x, y) {
  this.position.x = clamp(x, 0, this.saturationWidth);
  this.position.y = clamp(y, 0, this.height);

  transform(this.$sbSelector, {
    x: this.position.x,
    y: this.position.y
  });

};

SimpleColorPicker.prototype._updateColorFromPosition = function() {
  this.color = tinycolor({h: this.hue, s: this.position.x / this.saturationWidth, v: 1 - (this.position.y / this.height)});
  this._updateColor();
};

SimpleColorPicker.prototype._moveHueTo = function(y) {
  this.huePosition = clamp(y, 0, this.maxHue);

  transform(this.$hSelector, {
    y: this.huePosition
  });

};

SimpleColorPicker.prototype._updateHueFromPosition = function() {
  var hsvColor = this.color.toHsv();
  this.hue = 360 * (1 - (this.huePosition / this.maxHue));
  this.color = tinycolor({h: this.hue, s: hsvColor.s, v: hsvColor.v});
  this._updateHue();
};

SimpleColorPicker.prototype._updateHue = function() {
  var hueColor = tinycolor({h: this.hue, s: 1, v: 1});
  this.$saturation.style.background = 'linear-gradient(to right, #fff 0%, ' + hueColor.toHexString() + ' 100%)';
  this._updateColor();
};

SimpleColorPicker.prototype._updateColor = function() {
  this.$sbSelector.style.background = this.color.toHexString();
  this.$sbSelector.style.borderColor = this.color.isDark() ? '#FFF' : '#000';
  this.emit('update', this.color.toHexString());
};

/* =============================================================================
  Events handlers
============================================================================= */
SimpleColorPicker.prototype._onSaturationMouseDown = function(e) {
  this.choosing = true;
  var sbOffset = this.$saturation.getBoundingClientRect();
  var xPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientX : e.clientX;
  var yPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientY : e.clientY;
  this._moveSelectorTo(xPos - sbOffset.left, yPos - sbOffset.top);
  this._updateColorFromPosition();
  window.addEventListener('mouseup', this._onSaturationMouseUp);
  window.addEventListener('touchend', this._onSaturationMouseUp);
  window.addEventListener('mousemove', this._onSaturationMouseMove);
  window.addEventListener('touchmove', this._onSaturationMouseMove);
  e.preventDefault();
};

SimpleColorPicker.prototype._onSaturationMouseMove = function(e) {
  var sbOffset = this.$saturation.getBoundingClientRect();
  var xPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientX : e.clientX;
  var yPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientY : e.clientY;
  this._moveSelectorTo(xPos - sbOffset.left, yPos - sbOffset.top);
  this._updateColorFromPosition();
};

SimpleColorPicker.prototype._onSaturationMouseUp = function() {
  this.choosing = false;
  window.removeEventListener('mouseup', this._onSaturationMouseUp);
  window.removeEventListener('touchend', this._onSaturationMouseUp);
  window.removeEventListener('mousemove', this._onSaturationMouseMove);
  window.removeEventListener('touchmove', this._onSaturationMouseMove);
};

SimpleColorPicker.prototype._onHueMouseDown = function(e) {
  this.choosing = true;
  var hOffset = this.$hue.getBoundingClientRect();
  var yPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientY : e.clientY;
  this._moveHueTo(yPos - hOffset.top);
  this._updateHueFromPosition();
  window.addEventListener('mouseup', this._onHueMouseUp);
  window.addEventListener('touchend', this._onHueMouseUp);
  window.addEventListener('mousemove', this._onHueMouseMove);
  window.addEventListener('touchmove', this._onHueMouseMove);
  e.preventDefault();
};

SimpleColorPicker.prototype._onHueMouseMove = function(e) {
  var hOffset = this.$hue.getBoundingClientRect();
  var yPos = (e.type.indexOf('touch') === 0) ? e.touches[0].clientY : e.clientY;
  this._moveHueTo(yPos - hOffset.top);
  this._updateHueFromPosition();
};

SimpleColorPicker.prototype._onHueMouseUp = function() {
  this.choosing = false;
  window.removeEventListener('mouseup', this._onHueMouseUp);
  window.removeEventListener('touchend', this._onHueMouseUp);
  window.removeEventListener('mousemove', this._onHueMouseMove);
  window.removeEventListener('touchmove', this._onHueMouseMove);
};

module.exports = SimpleColorPicker;

},{"./src/utils/maths/clamp":97,"component-emitter":9,"dom-transform":16,"is-number":34,"lodash.bindall":52,"tinycolor2":99}],96:[function(require,module,exports){
var css = ".Scp {\n  width: 175px;\n  height: 150px;\n  -webkit-user-select: none;\n  -moz-user-select: none;\n  -ms-user-select: none;\n  user-select: none;\n  position: relative;\n}\n.Scp-saturation {\n  position: relative;\n  width: calc(100% - 25px);\n  height: 100%;\n  background: linear-gradient(to right, #fff 0%, #f00 100%);\n  float: left;\n  margin-right: 5px;\n}\n.Scp-brightness {\n  width: 100%;\n  height: 100%;\n  background: linear-gradient(to top, #000 0%, rgba(255,255,255,0) 100%);\n}\n.Scp-sbSelector {\n  border: 2px solid;\n  border-color: #fff;\n  position: absolute;\n  width: 14px;\n  height: 14px;\n  background: #fff;\n  border-radius: 10px;\n  top: -7px;\n  left: -7px;\n  box-sizing: border-box;\n  z-index: 10;\n}\n.Scp-hue {\n  width: 20px;\n  height: 100%;\n  position: relative;\n  float: left;\n  background: linear-gradient(to bottom, #f00 0%, #f0f 17%, #00f 34%, #0ff 50%, #0f0 67%, #ff0 84%, #f00 100%);\n}\n.Scp-hSelector {\n  position: absolute;\n  background: #fff;\n  border-bottom: 1px solid #000;\n  right: -3px;\n  width: 10px;\n  height: 2px;\n}\n"; (require("browserify-css").createStyle(css, { "href": "node_modules/simple-color-picker/simple-color-picker.css"})); module.exports = css;
},{"browserify-css":5}],97:[function(require,module,exports){
'use strict';

module.exports = function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
};
},{}],98:[function(require,module,exports){
var nargs = /\{([0-9a-zA-Z]+)\}/g
var slice = Array.prototype.slice

module.exports = template

function template(string) {
    var args

    if (arguments.length === 2 && typeof arguments[1] === "object") {
        args = arguments[1]
    } else {
        args = slice.call(arguments, 1)
    }

    if (!args || !args.hasOwnProperty) {
        args = {}
    }

    return string.replace(nargs, function replaceArg(match, i, index) {
        var result

        if (string[index - 1] === "{" &&
            string[index + match.length] === "}") {
            return i
        } else {
            result = args.hasOwnProperty(i) ? args[i] : null
            if (result === null || result === undefined) {
                return ""
            }

            return result
        }
    })
}

},{}],99:[function(require,module,exports){
// TinyColor v1.3.0
// https://github.com/bgrins/TinyColor
// Brian Grinstead, MIT License

(function() {

var trimLeft = /^\s+/,
    trimRight = /\s+$/,
    tinyCounter = 0,
    math = Math,
    mathRound = math.round,
    mathMin = math.min,
    mathMax = math.max,
    mathRandom = math.random;

function tinycolor (color, opts) {

    color = (color) ? color : '';
    opts = opts || { };

    // If input is already a tinycolor, return itself
    if (color instanceof tinycolor) {
       return color;
    }
    // If we are called as a function, call using new instead
    if (!(this instanceof tinycolor)) {
        return new tinycolor(color, opts);
    }

    var rgb = inputToRGB(color);
    this._originalInput = color,
    this._r = rgb.r,
    this._g = rgb.g,
    this._b = rgb.b,
    this._a = rgb.a,
    this._roundA = mathRound(100*this._a) / 100,
    this._format = opts.format || rgb.format;
    this._gradientType = opts.gradientType;

    // Don't let the range of [0,255] come back in [0,1].
    // Potentially lose a little bit of precision here, but will fix issues where
    // .5 gets interpreted as half of the total, instead of half of 1
    // If it was supposed to be 128, this was already taken care of by `inputToRgb`
    if (this._r < 1) { this._r = mathRound(this._r); }
    if (this._g < 1) { this._g = mathRound(this._g); }
    if (this._b < 1) { this._b = mathRound(this._b); }

    this._ok = rgb.ok;
    this._tc_id = tinyCounter++;
}

tinycolor.prototype = {
    isDark: function() {
        return this.getBrightness() < 128;
    },
    isLight: function() {
        return !this.isDark();
    },
    isValid: function() {
        return this._ok;
    },
    getOriginalInput: function() {
      return this._originalInput;
    },
    getFormat: function() {
        return this._format;
    },
    getAlpha: function() {
        return this._a;
    },
    getBrightness: function() {
        //http://www.w3.org/TR/AERT#color-contrast
        var rgb = this.toRgb();
        return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    },
    getLuminance: function() {
        //http://www.w3.org/TR/2008/REC-WCAG20-20081211/#relativeluminancedef
        var rgb = this.toRgb();
        var RsRGB, GsRGB, BsRGB, R, G, B;
        RsRGB = rgb.r/255;
        GsRGB = rgb.g/255;
        BsRGB = rgb.b/255;

        if (RsRGB <= 0.03928) {R = RsRGB / 12.92;} else {R = Math.pow(((RsRGB + 0.055) / 1.055), 2.4);}
        if (GsRGB <= 0.03928) {G = GsRGB / 12.92;} else {G = Math.pow(((GsRGB + 0.055) / 1.055), 2.4);}
        if (BsRGB <= 0.03928) {B = BsRGB / 12.92;} else {B = Math.pow(((BsRGB + 0.055) / 1.055), 2.4);}
        return (0.2126 * R) + (0.7152 * G) + (0.0722 * B);
    },
    setAlpha: function(value) {
        this._a = boundAlpha(value);
        this._roundA = mathRound(100*this._a) / 100;
        return this;
    },
    toHsv: function() {
        var hsv = rgbToHsv(this._r, this._g, this._b);
        return { h: hsv.h * 360, s: hsv.s, v: hsv.v, a: this._a };
    },
    toHsvString: function() {
        var hsv = rgbToHsv(this._r, this._g, this._b);
        var h = mathRound(hsv.h * 360), s = mathRound(hsv.s * 100), v = mathRound(hsv.v * 100);
        return (this._a == 1) ?
          "hsv("  + h + ", " + s + "%, " + v + "%)" :
          "hsva(" + h + ", " + s + "%, " + v + "%, "+ this._roundA + ")";
    },
    toHsl: function() {
        var hsl = rgbToHsl(this._r, this._g, this._b);
        return { h: hsl.h * 360, s: hsl.s, l: hsl.l, a: this._a };
    },
    toHslString: function() {
        var hsl = rgbToHsl(this._r, this._g, this._b);
        var h = mathRound(hsl.h * 360), s = mathRound(hsl.s * 100), l = mathRound(hsl.l * 100);
        return (this._a == 1) ?
          "hsl("  + h + ", " + s + "%, " + l + "%)" :
          "hsla(" + h + ", " + s + "%, " + l + "%, "+ this._roundA + ")";
    },
    toHex: function(allow3Char) {
        return rgbToHex(this._r, this._g, this._b, allow3Char);
    },
    toHexString: function(allow3Char) {
        return '#' + this.toHex(allow3Char);
    },
    toHex8: function() {
        return rgbaToHex(this._r, this._g, this._b, this._a);
    },
    toHex8String: function() {
        return '#' + this.toHex8();
    },
    toRgb: function() {
        return { r: mathRound(this._r), g: mathRound(this._g), b: mathRound(this._b), a: this._a };
    },
    toRgbString: function() {
        return (this._a == 1) ?
          "rgb("  + mathRound(this._r) + ", " + mathRound(this._g) + ", " + mathRound(this._b) + ")" :
          "rgba(" + mathRound(this._r) + ", " + mathRound(this._g) + ", " + mathRound(this._b) + ", " + this._roundA + ")";
    },
    toPercentageRgb: function() {
        return { r: mathRound(bound01(this._r, 255) * 100) + "%", g: mathRound(bound01(this._g, 255) * 100) + "%", b: mathRound(bound01(this._b, 255) * 100) + "%", a: this._a };
    },
    toPercentageRgbString: function() {
        return (this._a == 1) ?
          "rgb("  + mathRound(bound01(this._r, 255) * 100) + "%, " + mathRound(bound01(this._g, 255) * 100) + "%, " + mathRound(bound01(this._b, 255) * 100) + "%)" :
          "rgba(" + mathRound(bound01(this._r, 255) * 100) + "%, " + mathRound(bound01(this._g, 255) * 100) + "%, " + mathRound(bound01(this._b, 255) * 100) + "%, " + this._roundA + ")";
    },
    toName: function() {
        if (this._a === 0) {
            return "transparent";
        }

        if (this._a < 1) {
            return false;
        }

        return hexNames[rgbToHex(this._r, this._g, this._b, true)] || false;
    },
    toFilter: function(secondColor) {
        var hex8String = '#' + rgbaToHex(this._r, this._g, this._b, this._a);
        var secondHex8String = hex8String;
        var gradientType = this._gradientType ? "GradientType = 1, " : "";

        if (secondColor) {
            var s = tinycolor(secondColor);
            secondHex8String = s.toHex8String();
        }

        return "progid:DXImageTransform.Microsoft.gradient("+gradientType+"startColorstr="+hex8String+",endColorstr="+secondHex8String+")";
    },
    toString: function(format) {
        var formatSet = !!format;
        format = format || this._format;

        var formattedString = false;
        var hasAlpha = this._a < 1 && this._a >= 0;
        var needsAlphaFormat = !formatSet && hasAlpha && (format === "hex" || format === "hex6" || format === "hex3" || format === "name");

        if (needsAlphaFormat) {
            // Special case for "transparent", all other non-alpha formats
            // will return rgba when there is transparency.
            if (format === "name" && this._a === 0) {
                return this.toName();
            }
            return this.toRgbString();
        }
        if (format === "rgb") {
            formattedString = this.toRgbString();
        }
        if (format === "prgb") {
            formattedString = this.toPercentageRgbString();
        }
        if (format === "hex" || format === "hex6") {
            formattedString = this.toHexString();
        }
        if (format === "hex3") {
            formattedString = this.toHexString(true);
        }
        if (format === "hex8") {
            formattedString = this.toHex8String();
        }
        if (format === "name") {
            formattedString = this.toName();
        }
        if (format === "hsl") {
            formattedString = this.toHslString();
        }
        if (format === "hsv") {
            formattedString = this.toHsvString();
        }

        return formattedString || this.toHexString();
    },
    clone: function() {
        return tinycolor(this.toString());
    },

    _applyModification: function(fn, args) {
        var color = fn.apply(null, [this].concat([].slice.call(args)));
        this._r = color._r;
        this._g = color._g;
        this._b = color._b;
        this.setAlpha(color._a);
        return this;
    },
    lighten: function() {
        return this._applyModification(lighten, arguments);
    },
    brighten: function() {
        return this._applyModification(brighten, arguments);
    },
    darken: function() {
        return this._applyModification(darken, arguments);
    },
    desaturate: function() {
        return this._applyModification(desaturate, arguments);
    },
    saturate: function() {
        return this._applyModification(saturate, arguments);
    },
    greyscale: function() {
        return this._applyModification(greyscale, arguments);
    },
    spin: function() {
        return this._applyModification(spin, arguments);
    },

    _applyCombination: function(fn, args) {
        return fn.apply(null, [this].concat([].slice.call(args)));
    },
    analogous: function() {
        return this._applyCombination(analogous, arguments);
    },
    complement: function() {
        return this._applyCombination(complement, arguments);
    },
    monochromatic: function() {
        return this._applyCombination(monochromatic, arguments);
    },
    splitcomplement: function() {
        return this._applyCombination(splitcomplement, arguments);
    },
    triad: function() {
        return this._applyCombination(triad, arguments);
    },
    tetrad: function() {
        return this._applyCombination(tetrad, arguments);
    }
};

// If input is an object, force 1 into "1.0" to handle ratios properly
// String input requires "1.0" as input, so 1 will be treated as 1
tinycolor.fromRatio = function(color, opts) {
    if (typeof color == "object") {
        var newColor = {};
        for (var i in color) {
            if (color.hasOwnProperty(i)) {
                if (i === "a") {
                    newColor[i] = color[i];
                }
                else {
                    newColor[i] = convertToPercentage(color[i]);
                }
            }
        }
        color = newColor;
    }

    return tinycolor(color, opts);
};

// Given a string or object, convert that input to RGB
// Possible string inputs:
//
//     "red"
//     "#f00" or "f00"
//     "#ff0000" or "ff0000"
//     "#ff000000" or "ff000000"
//     "rgb 255 0 0" or "rgb (255, 0, 0)"
//     "rgb 1.0 0 0" or "rgb (1, 0, 0)"
//     "rgba (255, 0, 0, 1)" or "rgba 255, 0, 0, 1"
//     "rgba (1.0, 0, 0, 1)" or "rgba 1.0, 0, 0, 1"
//     "hsl(0, 100%, 50%)" or "hsl 0 100% 50%"
//     "hsla(0, 100%, 50%, 1)" or "hsla 0 100% 50%, 1"
//     "hsv(0, 100%, 100%)" or "hsv 0 100% 100%"
//
function inputToRGB(color) {

    var rgb = { r: 0, g: 0, b: 0 };
    var a = 1;
    var ok = false;
    var format = false;

    if (typeof color == "string") {
        color = stringInputToObject(color);
    }

    if (typeof color == "object") {
        if (color.hasOwnProperty("r") && color.hasOwnProperty("g") && color.hasOwnProperty("b")) {
            rgb = rgbToRgb(color.r, color.g, color.b);
            ok = true;
            format = String(color.r).substr(-1) === "%" ? "prgb" : "rgb";
        }
        else if (color.hasOwnProperty("h") && color.hasOwnProperty("s") && color.hasOwnProperty("v")) {
            color.s = convertToPercentage(color.s);
            color.v = convertToPercentage(color.v);
            rgb = hsvToRgb(color.h, color.s, color.v);
            ok = true;
            format = "hsv";
        }
        else if (color.hasOwnProperty("h") && color.hasOwnProperty("s") && color.hasOwnProperty("l")) {
            color.s = convertToPercentage(color.s);
            color.l = convertToPercentage(color.l);
            rgb = hslToRgb(color.h, color.s, color.l);
            ok = true;
            format = "hsl";
        }

        if (color.hasOwnProperty("a")) {
            a = color.a;
        }
    }

    a = boundAlpha(a);

    return {
        ok: ok,
        format: color.format || format,
        r: mathMin(255, mathMax(rgb.r, 0)),
        g: mathMin(255, mathMax(rgb.g, 0)),
        b: mathMin(255, mathMax(rgb.b, 0)),
        a: a
    };
}


// Conversion Functions
// --------------------

// `rgbToHsl`, `rgbToHsv`, `hslToRgb`, `hsvToRgb` modified from:
// <http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript>

// `rgbToRgb`
// Handle bounds / percentage checking to conform to CSS color spec
// <http://www.w3.org/TR/css3-color/>
// *Assumes:* r, g, b in [0, 255] or [0, 1]
// *Returns:* { r, g, b } in [0, 255]
function rgbToRgb(r, g, b){
    return {
        r: bound01(r, 255) * 255,
        g: bound01(g, 255) * 255,
        b: bound01(b, 255) * 255
    };
}

// `rgbToHsl`
// Converts an RGB color value to HSL.
// *Assumes:* r, g, and b are contained in [0, 255] or [0, 1]
// *Returns:* { h, s, l } in [0,1]
function rgbToHsl(r, g, b) {

    r = bound01(r, 255);
    g = bound01(g, 255);
    b = bound01(b, 255);

    var max = mathMax(r, g, b), min = mathMin(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min) {
        h = s = 0; // achromatic
    }
    else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
    }

    return { h: h, s: s, l: l };
}

// `hslToRgb`
// Converts an HSL color value to RGB.
// *Assumes:* h is contained in [0, 1] or [0, 360] and s and l are contained [0, 1] or [0, 100]
// *Returns:* { r, g, b } in the set [0, 255]
function hslToRgb(h, s, l) {
    var r, g, b;

    h = bound01(h, 360);
    s = bound01(s, 100);
    l = bound01(l, 100);

    function hue2rgb(p, q, t) {
        if(t < 0) t += 1;
        if(t > 1) t -= 1;
        if(t < 1/6) return p + (q - p) * 6 * t;
        if(t < 1/2) return q;
        if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }

    if(s === 0) {
        r = g = b = l; // achromatic
    }
    else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return { r: r * 255, g: g * 255, b: b * 255 };
}

// `rgbToHsv`
// Converts an RGB color value to HSV
// *Assumes:* r, g, and b are contained in the set [0, 255] or [0, 1]
// *Returns:* { h, s, v } in [0,1]
function rgbToHsv(r, g, b) {

    r = bound01(r, 255);
    g = bound01(g, 255);
    b = bound01(b, 255);

    var max = mathMax(r, g, b), min = mathMin(r, g, b);
    var h, s, v = max;

    var d = max - min;
    s = max === 0 ? 0 : d / max;

    if(max == min) {
        h = 0; // achromatic
    }
    else {
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h: h, s: s, v: v };
}

// `hsvToRgb`
// Converts an HSV color value to RGB.
// *Assumes:* h is contained in [0, 1] or [0, 360] and s and v are contained in [0, 1] or [0, 100]
// *Returns:* { r, g, b } in the set [0, 255]
 function hsvToRgb(h, s, v) {

    h = bound01(h, 360) * 6;
    s = bound01(s, 100);
    v = bound01(v, 100);

    var i = math.floor(h),
        f = h - i,
        p = v * (1 - s),
        q = v * (1 - f * s),
        t = v * (1 - (1 - f) * s),
        mod = i % 6,
        r = [v, q, p, p, t, v][mod],
        g = [t, v, v, q, p, p][mod],
        b = [p, p, t, v, v, q][mod];

    return { r: r * 255, g: g * 255, b: b * 255 };
}

// `rgbToHex`
// Converts an RGB color to hex
// Assumes r, g, and b are contained in the set [0, 255]
// Returns a 3 or 6 character hex
function rgbToHex(r, g, b, allow3Char) {

    var hex = [
        pad2(mathRound(r).toString(16)),
        pad2(mathRound(g).toString(16)),
        pad2(mathRound(b).toString(16))
    ];

    // Return a 3 character hex if possible
    if (allow3Char && hex[0].charAt(0) == hex[0].charAt(1) && hex[1].charAt(0) == hex[1].charAt(1) && hex[2].charAt(0) == hex[2].charAt(1)) {
        return hex[0].charAt(0) + hex[1].charAt(0) + hex[2].charAt(0);
    }

    return hex.join("");
}

// `rgbaToHex`
// Converts an RGBA color plus alpha transparency to hex
// Assumes r, g, b and a are contained in the set [0, 255]
// Returns an 8 character hex
function rgbaToHex(r, g, b, a) {

    var hex = [
        pad2(convertDecimalToHex(a)),
        pad2(mathRound(r).toString(16)),
        pad2(mathRound(g).toString(16)),
        pad2(mathRound(b).toString(16))
    ];

    return hex.join("");
}

// `equals`
// Can be called with any tinycolor input
tinycolor.equals = function (color1, color2) {
    if (!color1 || !color2) { return false; }
    return tinycolor(color1).toRgbString() == tinycolor(color2).toRgbString();
};

tinycolor.random = function() {
    return tinycolor.fromRatio({
        r: mathRandom(),
        g: mathRandom(),
        b: mathRandom()
    });
};


// Modification Functions
// ----------------------
// Thanks to less.js for some of the basics here
// <https://github.com/cloudhead/less.js/blob/master/lib/less/functions.js>

function desaturate(color, amount) {
    amount = (amount === 0) ? 0 : (amount || 10);
    var hsl = tinycolor(color).toHsl();
    hsl.s -= amount / 100;
    hsl.s = clamp01(hsl.s);
    return tinycolor(hsl);
}

function saturate(color, amount) {
    amount = (amount === 0) ? 0 : (amount || 10);
    var hsl = tinycolor(color).toHsl();
    hsl.s += amount / 100;
    hsl.s = clamp01(hsl.s);
    return tinycolor(hsl);
}

function greyscale(color) {
    return tinycolor(color).desaturate(100);
}

function lighten (color, amount) {
    amount = (amount === 0) ? 0 : (amount || 10);
    var hsl = tinycolor(color).toHsl();
    hsl.l += amount / 100;
    hsl.l = clamp01(hsl.l);
    return tinycolor(hsl);
}

function brighten(color, amount) {
    amount = (amount === 0) ? 0 : (amount || 10);
    var rgb = tinycolor(color).toRgb();
    rgb.r = mathMax(0, mathMin(255, rgb.r - mathRound(255 * - (amount / 100))));
    rgb.g = mathMax(0, mathMin(255, rgb.g - mathRound(255 * - (amount / 100))));
    rgb.b = mathMax(0, mathMin(255, rgb.b - mathRound(255 * - (amount / 100))));
    return tinycolor(rgb);
}

function darken (color, amount) {
    amount = (amount === 0) ? 0 : (amount || 10);
    var hsl = tinycolor(color).toHsl();
    hsl.l -= amount / 100;
    hsl.l = clamp01(hsl.l);
    return tinycolor(hsl);
}

// Spin takes a positive or negative amount within [-360, 360] indicating the change of hue.
// Values outside of this range will be wrapped into this range.
function spin(color, amount) {
    var hsl = tinycolor(color).toHsl();
    var hue = (mathRound(hsl.h) + amount) % 360;
    hsl.h = hue < 0 ? 360 + hue : hue;
    return tinycolor(hsl);
}

// Combination Functions
// ---------------------
// Thanks to jQuery xColor for some of the ideas behind these
// <https://github.com/infusion/jQuery-xcolor/blob/master/jquery.xcolor.js>

function complement(color) {
    var hsl = tinycolor(color).toHsl();
    hsl.h = (hsl.h + 180) % 360;
    return tinycolor(hsl);
}

function triad(color) {
    var hsl = tinycolor(color).toHsl();
    var h = hsl.h;
    return [
        tinycolor(color),
        tinycolor({ h: (h + 120) % 360, s: hsl.s, l: hsl.l }),
        tinycolor({ h: (h + 240) % 360, s: hsl.s, l: hsl.l })
    ];
}

function tetrad(color) {
    var hsl = tinycolor(color).toHsl();
    var h = hsl.h;
    return [
        tinycolor(color),
        tinycolor({ h: (h + 90) % 360, s: hsl.s, l: hsl.l }),
        tinycolor({ h: (h + 180) % 360, s: hsl.s, l: hsl.l }),
        tinycolor({ h: (h + 270) % 360, s: hsl.s, l: hsl.l })
    ];
}

function splitcomplement(color) {
    var hsl = tinycolor(color).toHsl();
    var h = hsl.h;
    return [
        tinycolor(color),
        tinycolor({ h: (h + 72) % 360, s: hsl.s, l: hsl.l}),
        tinycolor({ h: (h + 216) % 360, s: hsl.s, l: hsl.l})
    ];
}

function analogous(color, results, slices) {
    results = results || 6;
    slices = slices || 30;

    var hsl = tinycolor(color).toHsl();
    var part = 360 / slices;
    var ret = [tinycolor(color)];

    for (hsl.h = ((hsl.h - (part * results >> 1)) + 720) % 360; --results; ) {
        hsl.h = (hsl.h + part) % 360;
        ret.push(tinycolor(hsl));
    }
    return ret;
}

function monochromatic(color, results) {
    results = results || 6;
    var hsv = tinycolor(color).toHsv();
    var h = hsv.h, s = hsv.s, v = hsv.v;
    var ret = [];
    var modification = 1 / results;

    while (results--) {
        ret.push(tinycolor({ h: h, s: s, v: v}));
        v = (v + modification) % 1;
    }

    return ret;
}

// Utility Functions
// ---------------------

tinycolor.mix = function(color1, color2, amount) {
    amount = (amount === 0) ? 0 : (amount || 50);

    var rgb1 = tinycolor(color1).toRgb();
    var rgb2 = tinycolor(color2).toRgb();

    var p = amount / 100;
    var w = p * 2 - 1;
    var a = rgb2.a - rgb1.a;

    var w1;

    if (w * a == -1) {
        w1 = w;
    } else {
        w1 = (w + a) / (1 + w * a);
    }

    w1 = (w1 + 1) / 2;

    var w2 = 1 - w1;

    var rgba = {
        r: rgb2.r * w1 + rgb1.r * w2,
        g: rgb2.g * w1 + rgb1.g * w2,
        b: rgb2.b * w1 + rgb1.b * w2,
        a: rgb2.a * p  + rgb1.a * (1 - p)
    };

    return tinycolor(rgba);
};


// Readability Functions
// ---------------------
// <http://www.w3.org/TR/2008/REC-WCAG20-20081211/#contrast-ratiodef (WCAG Version 2)

// `contrast`
// Analyze the 2 colors and returns the color contrast defined by (WCAG Version 2)
tinycolor.readability = function(color1, color2) {
    var c1 = tinycolor(color1);
    var c2 = tinycolor(color2);
    return (Math.max(c1.getLuminance(),c2.getLuminance())+0.05) / (Math.min(c1.getLuminance(),c2.getLuminance())+0.05);
};

// `isReadable`
// Ensure that foreground and background color combinations meet WCAG2 guidelines.
// The third argument is an optional Object.
//      the 'level' property states 'AA' or 'AAA' - if missing or invalid, it defaults to 'AA';
//      the 'size' property states 'large' or 'small' - if missing or invalid, it defaults to 'small'.
// If the entire object is absent, isReadable defaults to {level:"AA",size:"small"}.

// *Example*
//    tinycolor.isReadable("#000", "#111") => false
//    tinycolor.isReadable("#000", "#111",{level:"AA",size:"large"}) => false
tinycolor.isReadable = function(color1, color2, wcag2) {
    var readability = tinycolor.readability(color1, color2);
    var wcag2Parms, out;

    out = false;

    wcag2Parms = validateWCAG2Parms(wcag2);
    switch (wcag2Parms.level + wcag2Parms.size) {
        case "AAsmall":
        case "AAAlarge":
            out = readability >= 4.5;
            break;
        case "AAlarge":
            out = readability >= 3;
            break;
        case "AAAsmall":
            out = readability >= 7;
            break;
    }
    return out;

};

// `mostReadable`
// Given a base color and a list of possible foreground or background
// colors for that base, returns the most readable color.
// Optionally returns Black or White if the most readable color is unreadable.
// *Example*
//    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:false}).toHexString(); // "#112255"
//    tinycolor.mostReadable(tinycolor.mostReadable("#123", ["#124", "#125"],{includeFallbackColors:true}).toHexString();  // "#ffffff"
//    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"large"}).toHexString(); // "#faf3f3"
//    tinycolor.mostReadable("#a8015a", ["#faf3f3"],{includeFallbackColors:true,level:"AAA",size:"small"}).toHexString(); // "#ffffff"
tinycolor.mostReadable = function(baseColor, colorList, args) {
    var bestColor = null;
    var bestScore = 0;
    var readability;
    var includeFallbackColors, level, size ;
    args = args || {};
    includeFallbackColors = args.includeFallbackColors ;
    level = args.level;
    size = args.size;

    for (var i= 0; i < colorList.length ; i++) {
        readability = tinycolor.readability(baseColor, colorList[i]);
        if (readability > bestScore) {
            bestScore = readability;
            bestColor = tinycolor(colorList[i]);
        }
    }

    if (tinycolor.isReadable(baseColor, bestColor, {"level":level,"size":size}) || !includeFallbackColors) {
        return bestColor;
    }
    else {
        args.includeFallbackColors=false;
        return tinycolor.mostReadable(baseColor,["#fff", "#000"],args);
    }
};


// Big List of Colors
// ------------------
// <http://www.w3.org/TR/css3-color/#svg-color>
var names = tinycolor.names = {
    aliceblue: "f0f8ff",
    antiquewhite: "faebd7",
    aqua: "0ff",
    aquamarine: "7fffd4",
    azure: "f0ffff",
    beige: "f5f5dc",
    bisque: "ffe4c4",
    black: "000",
    blanchedalmond: "ffebcd",
    blue: "00f",
    blueviolet: "8a2be2",
    brown: "a52a2a",
    burlywood: "deb887",
    burntsienna: "ea7e5d",
    cadetblue: "5f9ea0",
    chartreuse: "7fff00",
    chocolate: "d2691e",
    coral: "ff7f50",
    cornflowerblue: "6495ed",
    cornsilk: "fff8dc",
    crimson: "dc143c",
    cyan: "0ff",
    darkblue: "00008b",
    darkcyan: "008b8b",
    darkgoldenrod: "b8860b",
    darkgray: "a9a9a9",
    darkgreen: "006400",
    darkgrey: "a9a9a9",
    darkkhaki: "bdb76b",
    darkmagenta: "8b008b",
    darkolivegreen: "556b2f",
    darkorange: "ff8c00",
    darkorchid: "9932cc",
    darkred: "8b0000",
    darksalmon: "e9967a",
    darkseagreen: "8fbc8f",
    darkslateblue: "483d8b",
    darkslategray: "2f4f4f",
    darkslategrey: "2f4f4f",
    darkturquoise: "00ced1",
    darkviolet: "9400d3",
    deeppink: "ff1493",
    deepskyblue: "00bfff",
    dimgray: "696969",
    dimgrey: "696969",
    dodgerblue: "1e90ff",
    firebrick: "b22222",
    floralwhite: "fffaf0",
    forestgreen: "228b22",
    fuchsia: "f0f",
    gainsboro: "dcdcdc",
    ghostwhite: "f8f8ff",
    gold: "ffd700",
    goldenrod: "daa520",
    gray: "808080",
    green: "008000",
    greenyellow: "adff2f",
    grey: "808080",
    honeydew: "f0fff0",
    hotpink: "ff69b4",
    indianred: "cd5c5c",
    indigo: "4b0082",
    ivory: "fffff0",
    khaki: "f0e68c",
    lavender: "e6e6fa",
    lavenderblush: "fff0f5",
    lawngreen: "7cfc00",
    lemonchiffon: "fffacd",
    lightblue: "add8e6",
    lightcoral: "f08080",
    lightcyan: "e0ffff",
    lightgoldenrodyellow: "fafad2",
    lightgray: "d3d3d3",
    lightgreen: "90ee90",
    lightgrey: "d3d3d3",
    lightpink: "ffb6c1",
    lightsalmon: "ffa07a",
    lightseagreen: "20b2aa",
    lightskyblue: "87cefa",
    lightslategray: "789",
    lightslategrey: "789",
    lightsteelblue: "b0c4de",
    lightyellow: "ffffe0",
    lime: "0f0",
    limegreen: "32cd32",
    linen: "faf0e6",
    magenta: "f0f",
    maroon: "800000",
    mediumaquamarine: "66cdaa",
    mediumblue: "0000cd",
    mediumorchid: "ba55d3",
    mediumpurple: "9370db",
    mediumseagreen: "3cb371",
    mediumslateblue: "7b68ee",
    mediumspringgreen: "00fa9a",
    mediumturquoise: "48d1cc",
    mediumvioletred: "c71585",
    midnightblue: "191970",
    mintcream: "f5fffa",
    mistyrose: "ffe4e1",
    moccasin: "ffe4b5",
    navajowhite: "ffdead",
    navy: "000080",
    oldlace: "fdf5e6",
    olive: "808000",
    olivedrab: "6b8e23",
    orange: "ffa500",
    orangered: "ff4500",
    orchid: "da70d6",
    palegoldenrod: "eee8aa",
    palegreen: "98fb98",
    paleturquoise: "afeeee",
    palevioletred: "db7093",
    papayawhip: "ffefd5",
    peachpuff: "ffdab9",
    peru: "cd853f",
    pink: "ffc0cb",
    plum: "dda0dd",
    powderblue: "b0e0e6",
    purple: "800080",
    rebeccapurple: "663399",
    red: "f00",
    rosybrown: "bc8f8f",
    royalblue: "4169e1",
    saddlebrown: "8b4513",
    salmon: "fa8072",
    sandybrown: "f4a460",
    seagreen: "2e8b57",
    seashell: "fff5ee",
    sienna: "a0522d",
    silver: "c0c0c0",
    skyblue: "87ceeb",
    slateblue: "6a5acd",
    slategray: "708090",
    slategrey: "708090",
    snow: "fffafa",
    springgreen: "00ff7f",
    steelblue: "4682b4",
    tan: "d2b48c",
    teal: "008080",
    thistle: "d8bfd8",
    tomato: "ff6347",
    turquoise: "40e0d0",
    violet: "ee82ee",
    wheat: "f5deb3",
    white: "fff",
    whitesmoke: "f5f5f5",
    yellow: "ff0",
    yellowgreen: "9acd32"
};

// Make it easy to access colors via `hexNames[hex]`
var hexNames = tinycolor.hexNames = flip(names);


// Utilities
// ---------

// `{ 'name1': 'val1' }` becomes `{ 'val1': 'name1' }`
function flip(o) {
    var flipped = { };
    for (var i in o) {
        if (o.hasOwnProperty(i)) {
            flipped[o[i]] = i;
        }
    }
    return flipped;
}

// Return a valid alpha value [0,1] with all invalid values being set to 1
function boundAlpha(a) {
    a = parseFloat(a);

    if (isNaN(a) || a < 0 || a > 1) {
        a = 1;
    }

    return a;
}

// Take input from [0, n] and return it as [0, 1]
function bound01(n, max) {
    if (isOnePointZero(n)) { n = "100%"; }

    var processPercent = isPercentage(n);
    n = mathMin(max, mathMax(0, parseFloat(n)));

    // Automatically convert percentage into number
    if (processPercent) {
        n = parseInt(n * max, 10) / 100;
    }

    // Handle floating point rounding errors
    if ((math.abs(n - max) < 0.000001)) {
        return 1;
    }

    // Convert into [0, 1] range if it isn't already
    return (n % max) / parseFloat(max);
}

// Force a number between 0 and 1
function clamp01(val) {
    return mathMin(1, mathMax(0, val));
}

// Parse a base-16 hex value into a base-10 integer
function parseIntFromHex(val) {
    return parseInt(val, 16);
}

// Need to handle 1.0 as 100%, since once it is a number, there is no difference between it and 1
// <http://stackoverflow.com/questions/7422072/javascript-how-to-detect-number-as-a-decimal-including-1-0>
function isOnePointZero(n) {
    return typeof n == "string" && n.indexOf('.') != -1 && parseFloat(n) === 1;
}

// Check to see if string passed in is a percentage
function isPercentage(n) {
    return typeof n === "string" && n.indexOf('%') != -1;
}

// Force a hex value to have 2 characters
function pad2(c) {
    return c.length == 1 ? '0' + c : '' + c;
}

// Replace a decimal with it's percentage value
function convertToPercentage(n) {
    if (n <= 1) {
        n = (n * 100) + "%";
    }

    return n;
}

// Converts a decimal to a hex value
function convertDecimalToHex(d) {
    return Math.round(parseFloat(d) * 255).toString(16);
}
// Converts a hex value to a decimal
function convertHexToDecimal(h) {
    return (parseIntFromHex(h) / 255);
}

var matchers = (function() {

    // <http://www.w3.org/TR/css3-values/#integers>
    var CSS_INTEGER = "[-\\+]?\\d+%?";

    // <http://www.w3.org/TR/css3-values/#number-value>
    var CSS_NUMBER = "[-\\+]?\\d*\\.\\d+%?";

    // Allow positive/negative integer/number.  Don't capture the either/or, just the entire outcome.
    var CSS_UNIT = "(?:" + CSS_NUMBER + ")|(?:" + CSS_INTEGER + ")";

    // Actual matching.
    // Parentheses and commas are optional, but not required.
    // Whitespace can take the place of commas or opening paren
    var PERMISSIVE_MATCH3 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";
    var PERMISSIVE_MATCH4 = "[\\s|\\(]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")[,|\\s]+(" + CSS_UNIT + ")\\s*\\)?";

    return {
        rgb: new RegExp("rgb" + PERMISSIVE_MATCH3),
        rgba: new RegExp("rgba" + PERMISSIVE_MATCH4),
        hsl: new RegExp("hsl" + PERMISSIVE_MATCH3),
        hsla: new RegExp("hsla" + PERMISSIVE_MATCH4),
        hsv: new RegExp("hsv" + PERMISSIVE_MATCH3),
        hsva: new RegExp("hsva" + PERMISSIVE_MATCH4),
        hex3: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
        hex6: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
        hex8: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/
    };
})();

// `stringInputToObject`
// Permissive string parsing.  Take in a number of formats, and output an object
// based on detected format.  Returns `{ r, g, b }` or `{ h, s, l }` or `{ h, s, v}`
function stringInputToObject(color) {

    color = color.replace(trimLeft,'').replace(trimRight, '').toLowerCase();
    var named = false;
    if (names[color]) {
        color = names[color];
        named = true;
    }
    else if (color == 'transparent') {
        return { r: 0, g: 0, b: 0, a: 0, format: "name" };
    }

    // Try to match string input using regular expressions.
    // Keep most of the number bounding out of this function - don't worry about [0,1] or [0,100] or [0,360]
    // Just return an object and let the conversion functions handle that.
    // This way the result will be the same whether the tinycolor is initialized with string or object.
    var match;
    if ((match = matchers.rgb.exec(color))) {
        return { r: match[1], g: match[2], b: match[3] };
    }
    if ((match = matchers.rgba.exec(color))) {
        return { r: match[1], g: match[2], b: match[3], a: match[4] };
    }
    if ((match = matchers.hsl.exec(color))) {
        return { h: match[1], s: match[2], l: match[3] };
    }
    if ((match = matchers.hsla.exec(color))) {
        return { h: match[1], s: match[2], l: match[3], a: match[4] };
    }
    if ((match = matchers.hsv.exec(color))) {
        return { h: match[1], s: match[2], v: match[3] };
    }
    if ((match = matchers.hsva.exec(color))) {
        return { h: match[1], s: match[2], v: match[3], a: match[4] };
    }
    if ((match = matchers.hex8.exec(color))) {
        return {
            a: convertHexToDecimal(match[1]),
            r: parseIntFromHex(match[2]),
            g: parseIntFromHex(match[3]),
            b: parseIntFromHex(match[4]),
            format: named ? "name" : "hex8"
        };
    }
    if ((match = matchers.hex6.exec(color))) {
        return {
            r: parseIntFromHex(match[1]),
            g: parseIntFromHex(match[2]),
            b: parseIntFromHex(match[3]),
            format: named ? "name" : "hex"
        };
    }
    if ((match = matchers.hex3.exec(color))) {
        return {
            r: parseIntFromHex(match[1] + '' + match[1]),
            g: parseIntFromHex(match[2] + '' + match[2]),
            b: parseIntFromHex(match[3] + '' + match[3]),
            format: named ? "name" : "hex"
        };
    }

    return false;
}

function validateWCAG2Parms(parms) {
    // return valid WCAG2 parms for isReadable.
    // If input parms are invalid, return {"level":"AA", "size":"small"}
    var level, size;
    parms = parms || {"level":"AA", "size":"small"};
    level = (parms.level || "AA").toUpperCase();
    size = (parms.size || "small").toLowerCase();
    if (level !== "AA" && level !== "AAA") {
        level = "AA";
    }
    if (size !== "small" && size !== "large") {
        size = "small";
    }
    return {"level":level, "size":size};
}

// Node: Export function
if (typeof module !== "undefined" && module.exports) {
    module.exports = tinycolor;
}
// AMD/requirejs: Define the module
else if (typeof define === 'function' && define.amd) {
    define(function () {return tinycolor;});
}
// Browser: Expose to window
else {
    window.tinycolor = tinycolor;
}

})();

},{}],100:[function(require,module,exports){

exports = module.exports = trim;

function trim(str){
  return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function(str){
  return str.replace(/^\s*/, '');
};

exports.right = function(str){
  return str.replace(/\s*$/, '');
};

},{}],101:[function(require,module,exports){
/*!
* vdom-virtualize
* Copyright 2014 by Marcel Klehr <mklehr@gmx.net>
*
* (MIT LICENSE)
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in
* all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
* THE SOFTWARE.
*/
var VNode = require("virtual-dom/vnode/vnode")
  , VText = require("virtual-dom/vnode/vtext")
  , VComment = require("./vcomment")

module.exports = createVNode

function createVNode(domNode, key) {
  key = key || null // XXX: Leave out `key` for now... merely used for (re-)ordering

  if(domNode.nodeType == 1) return createFromElement(domNode, key)
  if(domNode.nodeType == 3) return createFromTextNode(domNode, key)
  if(domNode.nodeType == 8) return createFromCommentNode(domNode, key)
  return
}

createVNode.fromHTML = function(html, key) {
  var rootNode = null;

  try {
    // Everything except iOS 7 Safari, IE 8/9, Andriod Browser 4.1/4.3
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    rootNode = doc.documentElement;
  } catch(e) {
    // Old browsers
    var ifr = document.createElement('iframe');
    ifr.setAttribute('data-content', html);
    ifr.src = 'javascript: window.frameElement.getAttribute("data-content");';
    document.head.appendChild(ifr);
    rootNode = ifr.contentDocument.documentElement;
    setTimeout(function() {
      ifr.remove(); // Garbage collection
    }, 0);
  }

  return createVNode(rootNode, key);
};

function createFromTextNode(tNode) {
  return new VText(tNode.nodeValue)
}


function createFromCommentNode(cNode) {
  return new VComment(cNode.nodeValue)
}


function createFromElement(el) {
  var tagName = el.tagName
  , namespace = el.namespaceURI == 'http://www.w3.org/1999/xhtml'? null : el.namespaceURI
  , properties = getElementProperties(el)
  , children = []

  for (var i = 0; i < el.childNodes.length; i++) {
    children.push(createVNode(el.childNodes[i]/*, i*/))
  }

  return new VNode(tagName, properties, children, null, namespace)
}


function getElementProperties(el) {
  var obj = {}

  for(var i=0; i<props.length; i++) {
    var propName = props[i]
    if(!el[propName]) continue

    // Special case: style
    // .style is a DOMStyleDeclaration, thus we need to iterate over all
    // rules to create a hash of applied css properties.
    //
    // You can directly set a specific .style[prop] = value so patching with vdom
    // is possible.
    if("style" == propName) {
      var css = {}
        , styleProp
      if ('undefined' !== typeof el.style.length) {
        for(var j=0; j<el.style.length; j++) {
          styleProp = el.style[i]
          css[styleProp] = el.style.getPropertyValue(styleProp) // XXX: add support for "!important" via getPropertyPriority()!
        }
      } else { // IE8
        for (var styleProp in el.style) {
          if (el.style[styleProp] && el.style.hasOwnProperty(styleProp)) {
            css[styleProp] = el.style[styleProp];
          }
        }
      }

      if(Object.keys(css).length) obj[propName] = css
      continue
    }

    // https://msdn.microsoft.com/en-us/library/cc848861%28v=vs.85%29.aspx
    // The img element does not support the HREF content attribute.
    // In addition, the href property is read-only for the img Document Object Model (DOM) object
    if (el.tagName.toLowerCase() === 'img' && propName === 'href') {
      continue;
    }

    // Special case: dataset
    // we can iterate over .dataset with a simple for..in loop.
    // The all-time foo with data-* attribs is the dash-snake to camelCase
    // conversion.
    //
    // *This is compatible with h(), but not with every browser, thus this section was removed in favor
    // of attributes (specified below)!*
    //
    // .dataset properties are directly accessible as transparent getters/setters, so
    // patching with vdom is possible.
    /*if("dataset" == propName) {
      var data = {}
      for(var p in el.dataset) {
        data[p] = el.dataset[p]
      }
      obj[propName] = data
      return
    }*/

    // Special case: attributes
    // these are a NamedNodeMap, but we can just convert them to a hash for vdom,
    // because of https://github.com/Matt-Esch/virtual-dom/blob/master/vdom/apply-properties.js#L57
    if("attributes" == propName){
      var atts = Array.prototype.slice.call(el[propName]);
      var hash = {}
      for(var k=0; k<atts.length; k++){
        var name = atts[k].name;
        if(obj[name] || obj[attrBlacklist[name]]) continue;
        hash[name] = el.getAttribute(name);
      }
      obj[propName] = hash;
      continue
    }
    if("tabIndex" == propName && el.tabIndex === -1) continue

    // Special case: contentEditable
    // browser use 'inherit' by default on all nodes, but does not allow setting it to ''
    // diffing virtualize dom will trigger error
    // ref: https://github.com/Matt-Esch/virtual-dom/issues/176
    if("contentEditable" == propName && el[propName] === 'inherit') continue

    if('object' === typeof el[propName]) continue

    // default: just copy the property
    obj[propName] = el[propName]
  }

  return obj
}

/**
 * DOMNode property white list
 * Taken from https://github.com/Raynos/react/blob/dom-property-config/src/browser/ui/dom/DefaultDOMPropertyConfig.js
 */
var props =

module.exports.properties = [
 "accept"
,"accessKey"
,"action"
,"alt"
,"async"
,"autoComplete"
,"autoPlay"
,"cellPadding"
,"cellSpacing"
,"checked"
,"className"
,"colSpan"
,"content"
,"contentEditable"
,"controls"
,"crossOrigin"
,"data"
//,"dataset" removed since attributes handles data-attributes
,"defer"
,"dir"
,"download"
,"draggable"
,"encType"
,"formNoValidate"
,"href"
,"hrefLang"
,"htmlFor"
,"httpEquiv"
,"icon"
,"id"
,"label"
,"lang"
,"list"
,"loop"
,"max"
,"mediaGroup"
,"method"
,"min"
,"multiple"
,"muted"
,"name"
,"noValidate"
,"pattern"
,"placeholder"
,"poster"
,"preload"
,"radioGroup"
,"readOnly"
,"rel"
,"required"
,"rowSpan"
,"sandbox"
,"scope"
,"scrollLeft"
,"scrolling"
,"scrollTop"
,"selected"
,"span"
,"spellCheck"
,"src"
,"srcDoc"
,"srcSet"
,"start"
,"step"
,"style"
,"tabIndex"
,"target"
,"title"
,"type"
,"value"

// Non-standard Properties
,"autoCapitalize"
,"autoCorrect"
,"property"

, "attributes"
]

var attrBlacklist =
module.exports.attrBlacklist = {
  'class': 'className'
}
},{"./vcomment":102,"virtual-dom/vnode/vnode":124,"virtual-dom/vnode/vtext":126}],102:[function(require,module,exports){
module.exports = VirtualComment

function VirtualComment(text) {
  this.text = String(text)
}

VirtualComment.prototype.type = 'Widget'

VirtualComment.prototype.init = function() {
  return document.createComment(this.text)
}

VirtualComment.prototype.update = function(previous, domNode) {
  if(this.text === previous.text) return
  domNode.nodeValue = this.text
}

},{}],103:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":108}],104:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":128}],105:[function(require,module,exports){
var h = require("./virtual-hyperscript/index.js")

module.exports = h

},{"./virtual-hyperscript/index.js":115}],106:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":111}],107:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":119,"is-object":35}],108:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":117,"../vnode/is-vnode.js":120,"../vnode/is-vtext.js":121,"../vnode/is-widget.js":122,"./apply-properties":107,"global/document":26}],109:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],110:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = renderOptions.render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = renderOptions.render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":122,"../vnode/vpatch.js":125,"./apply-properties":107,"./update-widget":112}],111:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var render = require("./create-element")
var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches, renderOptions) {
    renderOptions = renderOptions || {}
    renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
        ? renderOptions.patch
        : patchRecursive
    renderOptions.render = renderOptions.render || render

    return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions.document && ownerDocument !== document) {
        renderOptions.document = ownerDocument
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./create-element":108,"./dom-index":109,"./patch-op":110,"global/document":26,"x-is-array":131}],112:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":122}],113:[function(require,module,exports){
'use strict';

var EvStore = require('ev-store');

module.exports = EvHook;

function EvHook(value) {
    if (!(this instanceof EvHook)) {
        return new EvHook(value);
    }

    this.value = value;
}

EvHook.prototype.hook = function (node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = this.value;
};

EvHook.prototype.unhook = function(node, propertyName) {
    var es = EvStore(node);
    var propName = propertyName.substr(3);

    es[propName] = undefined;
};

},{"ev-store":21}],114:[function(require,module,exports){
'use strict';

module.exports = SoftSetHook;

function SoftSetHook(value) {
    if (!(this instanceof SoftSetHook)) {
        return new SoftSetHook(value);
    }

    this.value = value;
}

SoftSetHook.prototype.hook = function (node, propertyName) {
    if (node[propertyName] !== this.value) {
        node[propertyName] = this.value;
    }
};

},{}],115:[function(require,module,exports){
'use strict';

var isArray = require('x-is-array');

var VNode = require('../vnode/vnode.js');
var VText = require('../vnode/vtext.js');
var isVNode = require('../vnode/is-vnode');
var isVText = require('../vnode/is-vtext');
var isWidget = require('../vnode/is-widget');
var isHook = require('../vnode/is-vhook');
var isVThunk = require('../vnode/is-thunk');

var parseTag = require('./parse-tag.js');
var softSetHook = require('./hooks/soft-set-hook.js');
var evHook = require('./hooks/ev-hook.js');

module.exports = h;

function h(tagName, properties, children) {
    var childNodes = [];
    var tag, props, key, namespace;

    if (!children && isChildren(properties)) {
        children = properties;
        props = {};
    }

    props = props || properties || {};
    tag = parseTag(tagName, props);

    // support keys
    if (props.hasOwnProperty('key')) {
        key = props.key;
        props.key = undefined;
    }

    // support namespace
    if (props.hasOwnProperty('namespace')) {
        namespace = props.namespace;
        props.namespace = undefined;
    }

    // fix cursor bug
    if (tag === 'INPUT' &&
        !namespace &&
        props.hasOwnProperty('value') &&
        props.value !== undefined &&
        !isHook(props.value)
    ) {
        props.value = softSetHook(props.value);
    }

    transformProperties(props);

    if (children !== undefined && children !== null) {
        addChild(children, childNodes, tag, props);
    }


    return new VNode(tag, props, childNodes, key, namespace);
}

function addChild(c, childNodes, tag, props) {
    if (typeof c === 'string') {
        childNodes.push(new VText(c));
    } else if (typeof c === 'number') {
        childNodes.push(new VText(String(c)));
    } else if (isChild(c)) {
        childNodes.push(c);
    } else if (isArray(c)) {
        for (var i = 0; i < c.length; i++) {
            addChild(c[i], childNodes, tag, props);
        }
    } else if (c === null || c === undefined) {
        return;
    } else {
        throw UnexpectedVirtualElement({
            foreignObject: c,
            parentVnode: {
                tagName: tag,
                properties: props
            }
        });
    }
}

function transformProperties(props) {
    for (var propName in props) {
        if (props.hasOwnProperty(propName)) {
            var value = props[propName];

            if (isHook(value)) {
                continue;
            }

            if (propName.substr(0, 3) === 'ev-') {
                // add ev-foo support
                props[propName] = evHook(value);
            }
        }
    }
}

function isChild(x) {
    return isVNode(x) || isVText(x) || isWidget(x) || isVThunk(x);
}

function isChildren(x) {
    return typeof x === 'string' || isArray(x) || isChild(x);
}

function UnexpectedVirtualElement(data) {
    var err = new Error();

    err.type = 'virtual-hyperscript.unexpected.virtual-element';
    err.message = 'Unexpected virtual child passed to h().\n' +
        'Expected a VNode / Vthunk / VWidget / string but:\n' +
        'got:\n' +
        errorString(data.foreignObject) +
        '.\n' +
        'The parent vnode is:\n' +
        errorString(data.parentVnode)
        '\n' +
        'Suggested fix: change your `h(..., [ ... ])` callsite.';
    err.foreignObject = data.foreignObject;
    err.parentVnode = data.parentVnode;

    return err;
}

function errorString(obj) {
    try {
        return JSON.stringify(obj, null, '    ');
    } catch (e) {
        return String(obj);
    }
}

},{"../vnode/is-thunk":118,"../vnode/is-vhook":119,"../vnode/is-vnode":120,"../vnode/is-vtext":121,"../vnode/is-widget":122,"../vnode/vnode.js":124,"../vnode/vtext.js":126,"./hooks/ev-hook.js":113,"./hooks/soft-set-hook.js":114,"./parse-tag.js":116,"x-is-array":131}],116:[function(require,module,exports){
'use strict';

var split = require('browser-split');

var classIdSplit = /([\.#]?[a-zA-Z0-9\u007F-\uFFFF_:-]+)/;
var notClassId = /^\.|#/;

module.exports = parseTag;

function parseTag(tag, props) {
    if (!tag) {
        return 'DIV';
    }

    var noId = !(props.hasOwnProperty('id'));

    var tagParts = split(tag, classIdSplit);
    var tagName = null;

    if (notClassId.test(tagParts[1])) {
        tagName = 'DIV';
    }

    var classes, part, type, i;

    for (i = 0; i < tagParts.length; i++) {
        part = tagParts[i];

        if (!part) {
            continue;
        }

        type = part.charAt(0);

        if (!tagName) {
            tagName = part;
        } else if (type === '.') {
            classes = classes || [];
            classes.push(part.substring(1, part.length));
        } else if (type === '#' && noId) {
            props.id = part.substring(1, part.length);
        }
    }

    if (classes) {
        if (props.className) {
            classes.push(props.className);
        }

        props.className = classes.join(' ');
    }

    return props.namespace ? tagName : tagName.toUpperCase();
}

},{"browser-split":4}],117:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":118,"./is-vnode":120,"./is-vtext":121,"./is-widget":122}],118:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],119:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],120:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":123}],121:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":123}],122:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],123:[function(require,module,exports){
module.exports = "2"

},{}],124:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":118,"./is-vhook":119,"./is-vnode":120,"./is-widget":122,"./version":123}],125:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":123}],126:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":123}],127:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":119,"is-object":35}],128:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free      // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":117,"../vnode/is-thunk":118,"../vnode/is-vnode":120,"../vnode/is-vtext":121,"../vnode/is-widget":122,"../vnode/vpatch":125,"./diff-props":127,"x-is-array":131}],129:[function(require,module,exports){
var hiddenStore = require('./hidden-store.js');

module.exports = createStore;

function createStore() {
    var key = {};

    return function (obj) {
        if ((typeof obj !== 'object' || obj === null) &&
            typeof obj !== 'function'
        ) {
            throw new Error('Weakmap-shim: Key must be object')
        }

        var store = obj.valueOf(key);
        return store && store.identity === key ?
            store : hiddenStore(obj, key);
    };
}

},{"./hidden-store.js":130}],130:[function(require,module,exports){
module.exports = hiddenStore;

function hiddenStore(obj, key) {
    var store = { identity: key };
    var valueOf = obj.valueOf;

    Object.defineProperty(obj, "valueOf", {
        value: function (value) {
            return value !== key ?
                valueOf.apply(this, arguments) : store;
        },
        writable: true
    });

    return store;
}

},{}],131:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],132:[function(require,module,exports){
"use strict";
var window = require("global/window")
var once = require("once")
var isFunction = require("is-function")
var parseHeaders = require("parse-headers")
var xtend = require("xtend")

module.exports = createXHR
createXHR.XMLHttpRequest = window.XMLHttpRequest || noop
createXHR.XDomainRequest = "withCredentials" in (new createXHR.XMLHttpRequest()) ? createXHR.XMLHttpRequest : window.XDomainRequest

forEachArray(["get", "put", "post", "patch", "head", "delete"], function(method) {
    createXHR[method === "delete" ? "del" : method] = function(uri, options, callback) {
        options = initParams(uri, options, callback)
        options.method = method.toUpperCase()
        return _createXHR(options)
    }
})

function forEachArray(array, iterator) {
    for (var i = 0; i < array.length; i++) {
        iterator(array[i])
    }
}

function isEmpty(obj){
    for(var i in obj){
        if(obj.hasOwnProperty(i)) return false
    }
    return true
}

function initParams(uri, options, callback) {
    var params = uri

    if (isFunction(options)) {
        callback = options
        if (typeof uri === "string") {
            params = {uri:uri}
        }
    } else {
        params = xtend(options, {uri: uri})
    }

    params.callback = callback
    return params
}

function createXHR(uri, options, callback) {
    options = initParams(uri, options, callback)
    return _createXHR(options)
}

function _createXHR(options) {
    var callback = options.callback
    if(typeof callback === "undefined"){
        throw new Error("callback argument missing")
    }
    callback = once(callback)

    function readystatechange() {
        if (xhr.readyState === 4) {
            loadFunc()
        }
    }

    function getBody() {
        // Chrome with requestType=blob throws errors arround when even testing access to responseText
        var body = undefined

        if (xhr.response) {
            body = xhr.response
        } else if (xhr.responseType === "text" || !xhr.responseType) {
            body = xhr.responseText || xhr.responseXML
        }

        if (isJson) {
            try {
                body = JSON.parse(body)
            } catch (e) {}
        }

        return body
    }

    var failureResponse = {
                body: undefined,
                headers: {},
                statusCode: 0,
                method: method,
                url: uri,
                rawRequest: xhr
            }

    function errorFunc(evt) {
        clearTimeout(timeoutTimer)
        if(!(evt instanceof Error)){
            evt = new Error("" + (evt || "Unknown XMLHttpRequest Error") )
        }
        evt.statusCode = 0
        callback(evt, failureResponse)
    }

    // will load the data & process the response in a special response object
    function loadFunc() {
        if (aborted) return
        var status
        clearTimeout(timeoutTimer)
        if(options.useXDR && xhr.status===undefined) {
            //IE8 CORS GET successful response doesn't have a status field, but body is fine
            status = 200
        } else {
            status = (xhr.status === 1223 ? 204 : xhr.status)
        }
        var response = failureResponse
        var err = null

        if (status !== 0){
            response = {
                body: getBody(),
                statusCode: status,
                method: method,
                headers: {},
                url: uri,
                rawRequest: xhr
            }
            if(xhr.getAllResponseHeaders){ //remember xhr can in fact be XDR for CORS in IE
                response.headers = parseHeaders(xhr.getAllResponseHeaders())
            }
        } else {
            err = new Error("Internal XMLHttpRequest Error")
        }
        callback(err, response, response.body)

    }

    var xhr = options.xhr || null

    if (!xhr) {
        if (options.cors || options.useXDR) {
            xhr = new createXHR.XDomainRequest()
        }else{
            xhr = new createXHR.XMLHttpRequest()
        }
    }

    var key
    var aborted
    var uri = xhr.url = options.uri || options.url
    var method = xhr.method = options.method || "GET"
    var body = options.body || options.data || null
    var headers = xhr.headers = options.headers || {}
    var sync = !!options.sync
    var isJson = false
    var timeoutTimer

    if ("json" in options) {
        isJson = true
        headers["accept"] || headers["Accept"] || (headers["Accept"] = "application/json") //Don't override existing accept header declared by user
        if (method !== "GET" && method !== "HEAD") {
            headers["content-type"] || headers["Content-Type"] || (headers["Content-Type"] = "application/json") //Don't override existing accept header declared by user
            body = JSON.stringify(options.json)
        }
    }

    xhr.onreadystatechange = readystatechange
    xhr.onload = loadFunc
    xhr.onerror = errorFunc
    // IE9 must have onprogress be set to a unique function.
    xhr.onprogress = function () {
        // IE must die
    }
    xhr.ontimeout = errorFunc
    xhr.open(method, uri, !sync, options.username, options.password)
    //has to be after open
    if(!sync) {
        xhr.withCredentials = !!options.withCredentials
    }
    // Cannot set timeout with sync request
    // not setting timeout on the xhr object, because of old webkits etc. not handling that correctly
    // both npm's request and jquery 1.x use this kind of timeout, so this is being consistent
    if (!sync && options.timeout > 0 ) {
        timeoutTimer = setTimeout(function(){
            aborted=true//IE9 may still call readystatechange
            xhr.abort("timeout")
            var e = new Error("XMLHttpRequest timeout")
            e.code = "ETIMEDOUT"
            errorFunc(e)
        }, options.timeout )
    }

    if (xhr.setRequestHeader) {
        for(key in headers){
            if(headers.hasOwnProperty(key)){
                xhr.setRequestHeader(key, headers[key])
            }
        }
    } else if (options.headers && !isEmpty(options.headers)) {
        throw new Error("Headers cannot be set on an XDomainRequest object")
    }

    if ("responseType" in options) {
        xhr.responseType = options.responseType
    }

    if ("beforeSend" in options &&
        typeof options.beforeSend === "function"
    ) {
        options.beforeSend(xhr)
    }

    xhr.send(body)

    return xhr


}

function noop() {}

},{"global/window":27,"is-function":33,"once":133,"parse-headers":90,"xtend":134}],133:[function(require,module,exports){
module.exports = once

once.proto = once(function () {
  Object.defineProperty(Function.prototype, 'once', {
    value: function () {
      return once(this)
    },
    configurable: true
  })
})

function once (fn) {
  var called = false
  return function () {
    if (called) return
    called = true
    return fn.apply(this, arguments)
  }
}

},{}],134:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],135:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend(target) {
    for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}],136:[function(require,module,exports){
var css = "html {\n  box-sizing: border-box;\n}\n*,\n*::after,\n*::before {\n  box-sizing: inherit;\n}\n.ec {\n  font-size: 14px;\n  line-height: 1.5;\n  background: #f5f5f5;\n  float: left;\n  width: 100%;\n  /*!*\n *\n * @csswizardry -- csswizardry.com/beautons\n *\n */\n}\n.ec .table {\n  width: 100%;\n}\n.ec .table [contenteditable=\"true\"]:active,\n.ec .table [contenteditable=\"true\"]:focus {\n  border: none;\n  outline: none;\n  background: #f5f5f5;\n}\n.ec .table th,\n.ec .table td {\n  padding: 0.375em;\n  text-align: left;\n}\n@media screen and (min-width: 480px) {\n  .ec .table th,\n  .ec .table td {\n    padding: 0.75em;\n  }\n}\n.ec [colspan] {\n  text-align: center;\n}\n.ec [colspan=\"1\"] {\n  text-align: left;\n}\n.ec [rowspan] {\n  vertical-align: middle;\n}\n.ec [rowspan=\"1\"] {\n  vertical-align: top;\n}\n.ec .numerical {\n  text-align: right;\n}\n.ec .t5 {\n  width: 5%;\n}\n.ec .t10 {\n  width: 10%;\n}\n.ec .t12 {\n  width: 12.5%;\n}\n.ec .t15 {\n  width: 15%;\n}\n.ec .t20 {\n  width: 20%;\n}\n.ec .t25 {\n  width: 25%;\n}\n.ec .t30 {\n  width: 30%;\n}\n.ec .t33 {\n  width: 33.333%;\n}\n.ec .t35 {\n  width: 35%;\n}\n.ec .t37 {\n  width: 37.5%;\n}\n.ec .t40 {\n  width: 40%;\n}\n.ec .t45 {\n  width: 45%;\n}\n.ec .t50 {\n  width: 50%;\n}\n.ec .t55 {\n  width: 55%;\n}\n.ec .t60 {\n  width: 60%;\n}\n.ec .t62 {\n  width: 62.5%;\n}\n.ec .t65 {\n  width: 65%;\n}\n.ec .t66 {\n  width: 66.666%;\n}\n.ec .t70 {\n  width: 70%;\n}\n.ec .t75 {\n  width: 75%;\n}\n.ec .t80 {\n  width: 80%;\n}\n.ec .t85 {\n  width: 85%;\n}\n.ec .t87 {\n  width: 87.5%;\n}\n.ec .t90 {\n  width: 90%;\n}\n.ec .t95 {\n  width: 95%;\n}\n.ec .table--bordered {\n  border-collapse: collapse;\n}\n.ec .table--bordered tr {\n  border: 1px solid #DDD;\n}\n.ec .table--bordered th,\n.ec .table--bordered td {\n  border-right: 1px solid #DDD;\n}\n.ec .table--bordered thead tr:last-child th {\n  border-bottom-width: 2px;\n}\n.ec .table--bordered tbody tr th:last-of-type {\n  border-right-width: 2px;\n}\n.ec .table--striped tbody tr:nth-of-type(odd) {\n  background-color: #ffc;\n}\n.ec .table--data {\n  font: 12px/1.5 sans-serif;\n}\n.ec .table--disabled {\n  color: #777;\n  border-color: #777;\n}\n.ec fieldset {\n  background-color: #f5f5f5;\n  border: 1px solid #DDD;\n  margin: 0 0 0.75em;\n  padding: 1.5em;\n}\n.ec input,\n.ec label,\n.ec select {\n  display: block;\n  font-family: \"sans-serif\";\n  font-size: 14px;\n}\n.ec label {\n  font-weight: 600;\n}\n.ec label.required::after {\n  content: \"*\";\n}\n.ec label abbr {\n  display: none;\n}\n.ec input[type=\"color\"],\n.ec input[type=\"date\"],\n.ec input[type=\"datetime\"],\n.ec input[type=\"datetime-local\"],\n.ec input[type=\"email\"],\n.ec input[type=\"month\"],\n.ec input[type=\"number\"],\n.ec input[type=\"password\"],\n.ec input[type=\"search\"],\n.ec input[type=\"tel\"],\n.ec input[type=\"text\"],\n.ec input[type=\"time\"],\n.ec input[type=\"url\"],\n.ec input[type=\"week\"],\n.ec textarea,\n.ec select {\n  background-color: #fff;\n  border: 1px solid #bfbfbf;\n  border-radius: 3px;\n  box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);\n  box-sizing: border-box;\n  font-family: \"sans-serif\";\n  font-size: 14px;\n  padding: 0.375em;\n  transition: border-color 0.2s ease-in;\n  max-width: 100%;\n}\n.ec input[type=\"color\"]:hover,\n.ec input[type=\"date\"]:hover,\n.ec input[type=\"datetime\"]:hover,\n.ec input[type=\"datetime-local\"]:hover,\n.ec input[type=\"email\"]:hover,\n.ec input[type=\"month\"]:hover,\n.ec input[type=\"number\"]:hover,\n.ec input[type=\"password\"]:hover,\n.ec input[type=\"search\"]:hover,\n.ec input[type=\"tel\"]:hover,\n.ec input[type=\"text\"]:hover,\n.ec input[type=\"time\"]:hover,\n.ec input[type=\"url\"]:hover,\n.ec input[type=\"week\"]:hover,\n.ec textarea:hover,\n.ec select:hover {\n  border-color: #b1b1b1;\n}\n.ec input[type=\"color\"]:focus,\n.ec input[type=\"date\"]:focus,\n.ec input[type=\"datetime\"]:focus,\n.ec input[type=\"datetime-local\"]:focus,\n.ec input[type=\"email\"]:focus,\n.ec input[type=\"month\"]:focus,\n.ec input[type=\"number\"]:focus,\n.ec input[type=\"password\"]:focus,\n.ec input[type=\"search\"]:focus,\n.ec input[type=\"tel\"]:focus,\n.ec input[type=\"text\"]:focus,\n.ec input[type=\"time\"]:focus,\n.ec input[type=\"url\"]:focus,\n.ec input[type=\"week\"]:focus,\n.ec textarea:focus,\n.ec select:focus {\n  border-color: #477dca;\n  box-shadow: inset 0 1px 3px rgba(0,0,0,0.06),0 0 5px rgba(55,112,192,0.7);\n  outline: none;\n}\n.ec input[type=\"color\"]:disabled,\n.ec input[type=\"date\"]:disabled,\n.ec input[type=\"datetime\"]:disabled,\n.ec input[type=\"datetime-local\"]:disabled,\n.ec input[type=\"email\"]:disabled,\n.ec input[type=\"month\"]:disabled,\n.ec input[type=\"number\"]:disabled,\n.ec input[type=\"password\"]:disabled,\n.ec input[type=\"search\"]:disabled,\n.ec input[type=\"tel\"]:disabled,\n.ec input[type=\"text\"]:disabled,\n.ec input[type=\"time\"]:disabled,\n.ec input[type=\"url\"]:disabled,\n.ec input[type=\"week\"]:disabled,\n.ec textarea:disabled,\n.ec select:disabled {\n  background-color: #f2f2f2;\n  cursor: not-allowed;\n}\n.ec input[type=\"color\"]:disabled:hover,\n.ec input[type=\"date\"]:disabled:hover,\n.ec input[type=\"datetime\"]:disabled:hover,\n.ec input[type=\"datetime-local\"]:disabled:hover,\n.ec input[type=\"email\"]:disabled:hover,\n.ec input[type=\"month\"]:disabled:hover,\n.ec input[type=\"number\"]:disabled:hover,\n.ec input[type=\"password\"]:disabled:hover,\n.ec input[type=\"search\"]:disabled:hover,\n.ec input[type=\"tel\"]:disabled:hover,\n.ec input[type=\"text\"]:disabled:hover,\n.ec input[type=\"time\"]:disabled:hover,\n.ec input[type=\"url\"]:disabled:hover,\n.ec input[type=\"week\"]:disabled:hover,\n.ec textarea:disabled:hover,\n.ec select:disabled:hover {\n  border: 1px solid #DDD;\n}\n.ec textarea {\n  width: 100%;\n  resize: vertical;\n}\n.ec input[type=\"search\"] {\n  appearance: none;\n}\n.ec input[type=\"checkbox\"],\n.ec input[type=\"radio\"] {\n  display: inline;\n  margin-right: 0.375em;\n}\n.ec input[type=\"checkbox\"]+label,\n.ec input[type=\"radio\"]+label {\n  display: inline-block;\n}\n.ec input[type=\"file\"] {\n  width: 100%;\n}\n.ec select {\n  max-width: 100%;\n  width: auto;\n}\n.ec .form-item {\n  width: 100%;\n  color: #333;\n  margin-bottom: 0.75em;\n}\n@media screen and (min-width: 600px) {\n  .ec .form-item {\n    display: flex;\n    align-items: center;\n    justify-content: center;\n  }\n}\n.ec .form-item__input {\n  width: 100%;\n}\n@media screen and (min-width: 600px) {\n  .ec .form-item__input {\n    width: 60%;\n  }\n}\n.ec .form-item__label {\n  width: 100%;\n  padding-bottom: 0.75em;\n}\n@media screen and (min-width: 600px) {\n  .ec .form-item__label {\n    padding: 0;\n    width: 40%;\n    text-align: right;\n    margin-right: 1.5em;\n  }\n}\n.ec .field-group {\n  padding: 0.375em 0 0.75em 0;\n}\n.ec .field-group__title {\n  padding-bottom: 0.75em;\n}\n.ec h1 {\n  margin: 0;\n  padding: 0;\n  font-size: 28px;\n}\n.ec h2 {\n  margin: 0;\n  padding: 0;\n  font-size: 24.5px;\n}\n.ec h3 {\n  margin: 0;\n  padding: 0;\n  font-size: 21px;\n}\n.ec h4 {\n  margin: 0;\n  padding: 0;\n  font-size: 17.5px;\n}\n.ec h5 {\n  margin: 0;\n  padding: 0;\n  font-size: 15.75px;\n}\n.ec h6 {\n  margin: 0;\n  padding: 0;\n  font-size: 14px;\n}\n.ec .vertical-tabs-container {\n  margin-bottom: 1.5em;\n  overflow: hidden;\n  display: flex;\n}\n.ec .vertical-tabs-container::after {\n  clear: both;\n  content: \"\";\n  display: table;\n}\n.ec .vertical-tabs-container .vertical-tabs {\n  padding: 0;\n  margin: 0;\n  display: inline;\n  float: left;\n  width: 20%;\n  list-style: none;\n  border-right: 1px solid #DDD;\n}\n.ec .vertical-tabs-container li.active {\n  background-color: white;\n  margin-right: -1px;\n  border: 1px solid #DDD;\n  border-right-color: white;\n}\n.ec .vertical-tabs-container li.active .sub-active {\n  color: #477dca;\n}\n.ec .vertical-tabs-container li.active .sub-non-active {\n  color: #333;\n}\n.ec .vertical-tabs-container li a {\n  padding: 0.75em 0.809em;\n  text-decoration: none;\n  color: inherit;\n  display: block;\n}\n.ec .vertical-tabs-container li ul {\n  list-style: none;\n  padding: 0;\n  margin: 0;\n}\n.ec .vertical-tabs-container li ul li {\n  padding-bottom: 5px;\n  padding-left: 20px;\n}\n.ec .vertical-tabs-container .vertical-tab:focus {\n  outline: none;\n}\n.ec .vertical-tabs-container .vertical-tab-content-container {\n  border: 1px solid #DDD;\n  border-left: none;\n  display: inline-block;\n  width: 80%;\n  background-color: white;\n  margin: 0 auto;\n}\n.ec .vertical-tabs-container .vertical-tab-content-container a:focus {\n  outline: none;\n}\n.ec .vertical-tabs-container .vertical-tab-content {\n  display: inline-block;\n  background-color: white;\n  padding: 1.5em 1.618em;\n  border: none;\n  width: 100%;\n}\n.ec .vertical-tabs-container .vertical-tab-accordion-heading {\n  border-top: 1px solid #DDD;\n  cursor: pointer;\n  display: block;\n  font-weight: bold;\n  padding: 0.75em 0.809em;\n}\n.ec .vertical-tabs-container .vertical-tab-accordion-heading:hover {\n  color: #477dca;\n}\n.ec .vertical-tabs-container .vertical-tab-accordion-heading:first-child {\n  border-top: none;\n}\n.ec .vertical-tabs-container .vertical-tab-accordion-heading.active {\n  background: white;\n  border-bottom: none;\n}\n.ec .accordion-tabs-minimal {\n  margin: 0 0.75em;\n  line-height: 1.5;\n  padding: 0;\n}\n.ec .accordion-tabs-minimal::after {\n  clear: both;\n  content: \"\";\n  display: table;\n}\n.ec .accordion-tabs-minimal ul.tab-list {\n  margin: 0;\n  padding: 0;\n}\n.ec .accordion-tabs-minimal li.tab-header-and-content {\n  list-style: none;\n  display: inline;\n}\n.ec .accordion-tabs-minimal .tab-link {\n  border-top: 1px solid #DDD;\n  display: inline-block;\n  border-top: 0;\n}\n.ec .accordion-tabs-minimal .tab-link a {\n  text-decoration: none;\n  display: block;\n  padding: 0.75em 1.618em;\n}\n.ec .accordion-tabs-minimal .tab-link a:hover {\n  color: #2c5999;\n}\n.ec .accordion-tabs-minimal .tab-link a:focus {\n  outline: none;\n}\n.ec .accordion-tabs-minimal .tab-link a.is-active {\n  border: 1px solid #DDD;\n  border-bottom-color: white;\n  background: white;\n  margin-bottom: -1px;\n  color: #477dca;\n}\n.ec .accordion-tabs-minimal .tab-content {\n  border: 1px solid #DDD;\n  padding: 1.5em 1.618em;\n  width: 100%;\n  float: left;\n  background: white;\n  min-height: 250px;\n}\n.ec .btn {\n  display: inline-block;\n  vertical-align: middle;\n  white-space: nowrap;\n  font-family: inherit;\n  font-size: 100%;\n  cursor: pointer;\n  border: none;\n  margin: 0;\n  padding-top: 0;\n  padding-bottom: 0;\n  line-height: 3;\n  padding-right: 1em;\n  padding-left: 1em;\n  border-radius: 3px;\n  background: #477dca;\n  color: white;\n}\n.ec .btn,\n.ec .btn:hover {\n  text-decoration: none;\n  background: #2c5999;\n}\n.ec .btn:active,\n.ec .btn:focus {\n  outline: none;\n}\n.ec .btn--small {\n  padding-right: 0.5em;\n  padding-left: 0.5em;\n  line-height: 2;\n}\n.ec .btn--large {\n  padding-right: 1.5em;\n  padding-left: 1.5em;\n  line-height: 4;\n}\n.ec .btn--huge {\n  padding-right: 2em;\n  padding-left: 2em;\n  line-height: 5;\n}\n.ec .btn--full {\n  width: 100%;\n  padding-right: 0;\n  padding-left: 0;\n  text-align: center;\n}\n.ec .btn--alpha {\n  font-size: 3rem;\n}\n.ec .btn--beta {\n  font-size: 2rem;\n}\n.ec .btn--gamma {\n  font-size: 1rem;\n}\n.ec .btn--natural {\n  vertical-align: baseline;\n  font-size: inherit;\n  line-height: inherit;\n  padding-right: 0.5em;\n  padding-left: 0.5em;\n}\n.ec .btn--positive {\n  background-color: #4A993E;\n  color: #fff;\n}\n.ec .btn--negative {\n  background-color: #b33630;\n  color: #fff;\n}\n.ec .btn--inactive,\n.ec .btn--inactive:hover,\n.ec .btn--inactive:active,\n.ec .btn--inactive:focus {\n  background-color: #ddd;\n  color: #777;\n  cursor: text;\n}\n.ec .btn--soft {\n  border-radius: 200px;\n}\n.ec .btn--hard {\n  border-radius: 0;\n}\n@media screen and (min-width: 800px) {\n  .ec .left {\n    width: 49%;\n    margin-right: 2%;\n    float: left;\n  }\n}\n@media screen and (min-width: 800px) {\n  .ec .right {\n    width: 49%;\n    float: left;\n  }\n}\n.ec .navigation {\n  padding: 0;\n  margin: 0;\n  display: block;\n}\n.ec .navigation__item {\n  margin: 20px 10px 20px 10px;\n  padding-bottom: 10px;\n  cursor: pointer;\n  display: inline-block;\n}\n.ec .navigation--steps .ec .navigation__item {\n  border-bottom: 5px solid;\n}\n.ec .float--right {\n  float: right !important;\n}\n.ec .float--left {\n  float: left !important;\n}\n.ec .float--none {\n  float: none !important;\n}\n.ec .text--left {\n  text-align: left  !important;\n}\n.ec .text--center {\n  text-align: center !important;\n}\n.ec .text--right {\n  text-align: right !important;\n}\n.ec .weight--light {\n  font-weight: 300 !important;\n}\n.ec .weight--normal {\n  font-weight: 400 !important;\n}\n.ec .weight--semibold {\n  font-weight: 600 !important;\n}\n.ec .push {\n  margin: 1.5em !important;\n}\n.ec .push--top {\n  margin-top: 1.5em !important;\n}\n.ec .push--right {\n  margin-right: 1.5em !important;\n}\n.ec .push--bottom {\n  margin-bottom: 1.5em !important;\n}\n.ec .push--left {\n  margin-left: 1.5em !important;\n}\n.ec .push--ends {\n  margin-top: 1.5em !important;\n  margin-bottom: 1.5em !important;\n}\n.ec .push--sides {\n  margin-right: 1.5em !important;\n  margin-left: 1.5em !important;\n}\n.ec .push-half {\n  margin: 0.75em !important;\n}\n.ec .push-half--top {\n  margin-top: 0.75em !important;\n}\n.ec .push-half--right {\n  margin-right: 0.75em !important;\n}\n.ec .push-half--bottom {\n  margin-bottom: 0.75em !important;\n}\n.ec .push-half--left {\n  margin-left: 0.75em !important;\n}\n.ec .push-half--ends {\n  margin-top: 0.75em !important;\n  margin-bottom: 0.75em !important;\n}\n.ec .push-half--sides {\n  margin-right: 0.75em !important;\n  margin-left: 0.75em !important;\n}\n.ec .flush {\n  margin: 0 !important;\n}\n.ec .flush--top {\n  margin-top: 0 !important;\n}\n.ec .flush--right {\n  margin-right: 0 !important;\n}\n.ec .flush--bottom {\n  margin-bottom: 0 !important;\n}\n.ec .flush--left {\n  margin-left: 0 !important;\n}\n.ec .flush--ends {\n  margin-top: 0 !important;\n  margin-bottom: 0 !important;\n}\n.ec .flush--sides {\n  margin-right: 0 !important;\n  margin-left: 0 !important;\n}\n.ec .soft {\n  padding: 1.5em !important;\n}\n.ec .soft--top {\n  padding-top: 1.5em !important;\n}\n.ec .soft--right {\n  padding-right: 1.5em !important;\n}\n.ec .soft--bottom {\n  padding-bottom: 1.5em !important;\n}\n.ec .soft--left {\n  padding-left: 1.5em !important;\n}\n.ec .soft--ends {\n  padding-top: 1.5em !important;\n  padding-bottom: 1.5em !important;\n}\n.ec .soft--sides {\n  padding-right: 1.5em !important;\n  padding-left: 1.5em !important;\n}\n.ec .soft-half {\n  padding: 0.75em !important;\n}\n.ec .soft-half--top {\n  padding-top: 0.75em !important;\n}\n.ec .soft-half--right {\n  padding-right: 0.75em !important;\n}\n.ec .soft-half--bottom {\n  padding-bottom: 0.75em !important;\n}\n.ec .soft-half--left {\n  padding-left: 0.75em !important;\n}\n.ec .soft-half--ends {\n  padding-top: 0.75em !important;\n  padding-bottom: 0.75em !important;\n}\n.ec .soft-half--sides {\n  padding-right: 0.75em !important;\n  padding-left: 0.75em !important;\n}\n.ec .hard {\n  padding: 0 !important;\n}\n.ec .hard--top {\n  padding-top: 0 !important;\n}\n.ec .hard--right {\n  padding-right: 0 !important;\n}\n.ec .hard--bottom {\n  padding-bottom: 0 !important;\n}\n.ec .hard--left {\n  padding-left: 0 !important;\n}\n.ec .hard--ends {\n  padding-top: 0 !important;\n  padding-bottom: 0 !important;\n}\n.ec .hard--sides {\n  padding-right: 0 !important;\n  padding-left: 0 !important;\n}\n.ec .full-bleed {\n  margin-right: -1.5em !important;\n  margin-left: -1.5em !important;\n}\n.islet .ec .full-bleed {\n  margin-right: -0.75em !important;\n  margin-left: -0.75em !important;\n}\n.ec .loader,\n.ec .loader:before,\n.ec .loader:after {\n  border-radius: 50%;\n}\n.ec .loader:before,\n.ec .loader:after {\n  position: absolute;\n  content: '';\n}\n.ec .loader:before {\n  width: 5.2em;\n  height: 10.2em;\n  background: #DDD;\n  border-radius: 10.2em 0 0 10.2em;\n  top: -0.1em;\n  left: -0.1em;\n  -webkit-transform-origin: 5.2em 5.1em;\n  transform-origin: 5.2em 5.1em;\n  -webkit-animation: load2 2s infinite ease 1.5s;\n  animation: load2 2s infinite ease 1.5s;\n}\n.ec .loader {\n  font-size: 11px;\n  text-indent: -99999em;\n  margin: 55px auto;\n  position: relative;\n  width: 10em;\n  height: 10em;\n  box-shadow: inset 0 0 0 1em #ffffff;\n  -webkit-transform: translateZ(0);\n  -ms-transform: translateZ(0);\n  transform: translateZ(0);\n}\n.ec .loader:after {\n  width: 5.2em;\n  height: 10.2em;\n  background: #DDD;\n  border-radius: 0 10.2em 10.2em 0;\n  top: -0.1em;\n  left: 5.1em;\n  -webkit-transform-origin: 0px 5.1em;\n  transform-origin: 0px 5.1em;\n  -webkit-animation: load2 2s infinite ease;\n  animation: load2 2s infinite ease;\n}\n@-webkit-keyframes load2 {\n  0% {\n    -webkit-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n\n  100% {\n    -webkit-transform: rotate(360deg);\n    transform: rotate(360deg);\n  }\n}\n@keyframes load2 {\n  0% {\n    -webkit-transform: rotate(0deg);\n    transform: rotate(0deg);\n  }\n\n  100% {\n    -webkit-transform: rotate(360deg);\n    transform: rotate(360deg);\n  }\n}\n.ec a,\n.ec .hover {\n  color: #477dca;\n  cursor: pointer;\n}\n.ec .active {\n  color: #477dca;\n}\n.ec .container {\n  clear: both;\n}\n.ec .Scp {\n  position: absolute;\n  margin-top: 5px;\n  width: 200px;\n  height: 150px;\n  border: 1px solid #DDD;\n  border-radius: 3px;\n}\n.ec .header {\n  margin-bottom: 20px;\n  background-color: #333;\n  width: 100%;\n  display: inline-block;\n}\n.ec .header .logo {\n  float: right;\n  text-align: right;\n  padding: 7px 1em;\n  height: 64px;\n}\n.ec .header .logo svg {\n  height: 50px;\n}\n.ec .header .navigation {\n  margin-left: 20px;\n  margin-top: 22px;\n  float: left;\n}\n.ec .header .navigation .tab-link a {\n  text-decoration: none;\n  color: white;\n}\n.ec .header .navigation .tab-link.is-active {\n  background: #f5f5f5;\n  border: none;\n}\n.ec .header .navigation .tab-link.is-active a {\n  color: #477dca;\n}\n.ec .header:after {\n  clear: both;\n}\n.ec .revisionElement {\n  margin-top: 20px;\n  border: 1px solid #DDD;\n  background: white;\n  padding: 20px;\n  display: block;\n  float: left;\n  width: 100%;\n}\n.ec .objectArray {\n  border: 1px solid #DDD;\n  display: inline-block;\n  width: 100%;\n}\n.ec .objectArray .title {\n  width: 100%;\n  float: left;\n  padding: 7.5px 10px;\n  background: #f5f5f5;\n}\n.ec .objectArray .title h4,\n.ec .objectArray .title h5 {\n  float: left;\n}\n.ec .objectArray .title .btn {\n  float: right;\n}\n.ec .objectArray .list {\n  width: 100%;\n  float: left;\n}\n.ec .objectArray .list .item {\n  width: 100%;\n  float: left;\n}\n.ec .objectArray .list .item .title {\n  border-bottom: 1px solid #DDD;\n  border-top: 1px solid #DDD;\n}\n.ec .objectArray .list .item .options {\n  float: left;\n  width: 100%;\n  padding-top: 20px;\n}\n.ec .readOnlyBox {\n  border: 1px solid #DDD;\n  background: white;\n  padding: 10px 20px;\n  display: block;\n  margin-bottom: 10px;\n}\n.ec .titleBar {\n  display: inline-block;\n  width: 100%;\n  padding-bottom: 20px;\n}\n.ec .titleBar h3 {\n  float: left;\n}\n.ec .titleBar .btn {\n  margin-left: 10px;\n  float: right;\n}\n.ec .templatelist {\n  display: flex;\n  flex-wrap: wrap;\n}\n.ec .templatelist__item {\n  float: left;\n  width: 33%;\n  padding: 0.75em;\n  margin: 5px;\n  width: 125px;\n  cursor: pointer;\n  border: 1px solid white;\n  background: white;\n  transition: background-color ease-in 0.2s,border-color ease-in 0.2s;\n}\n.ec .templatelist__item:hover {\n  background: #f5f5f5;\n  border: 1px solid #DDD;\n}\n.ec .templatelist__item svg {\n  max-height: 120px;\n}\n.ec .file_drop {\n  padding: 50px;\n  background: #DDD;\n}\n"; (require("browserify-css").createStyle(css, { "href": "src/css/style.css"})); module.exports = css;
},{"browserify-css":5}],137:[function(require,module,exports){
(function () {
    var css = require('../css/style.css');
    var Delegator = require("dom-delegator");
    Delegator();
    function constructor(opts) {
        var router = require('./services/router.js');
        var dataService = require('./services/data');
        var confService = require('./services/config');
        var optionsService = require('./services/options');
        var revisionService = require('./services/revision');
        var templateService = require('./services/templates');
        var initializer = require('./services/initializer');
        var Api = require('./services/api');
        var mediator = require('mediatorjs');
        var h = require('virtual-dom/h');
        var mInstance = new mediator.Mediator();
        var data = new dataService(mInstance);
        var config = new confService(mInstance, data);

        var services = {
            data: data,
            config: config,
            mediator: mInstance,
            options: optionsService(mInstance),
            templates: templateService(),
            revision: revisionService(mInstance)
        };

        var states = {
            'data': {
                title: 'Data',
                dependencies: function () {
                    var that = {};
                    that.import = require('./components/import.js')(services);
                    return that;
                },
                template: function (dependencies) {
                    return h('div', [dependencies.import.template()]);
                },
                destroy: function (dependencies) {
                    dependencies.import.destroy()
                }
            },
            'templates': {
                title: 'Templates',
                dependencies: function () {
                    var that = {};
                    that.templateSelection = require('./components/templateSelection.js')(services);
                    return that;
                },
                template: function (dependencies) {
                    return h('div', [dependencies.templateSelection.template()]);
                }
            }
        };
        if (opts.customise == true) {
            states.customise = {
                title: 'Customise',
                dependencies: function () {
                    var that = {};
                    that.configurate = require('./components/configure.js')(services);
                    return that;
                },
                template: function (dependencies) {
                    return h('div', [dependencies.configurate.template()]);
                },
                destroy: function (dependencies) {
                    dependencies.configurate.destroy()
                }
            }
        }
        if (opts.debugger == true) {
            states.debugger = {
                title: 'Debug',
                dependencies: function () {
                    var that = {};
                    that.debug = require('./components/debug.js')(services);
                    return that;
                },
                template: function (dependencies) {
                    return h('div', [dependencies.debug.template()]);
                }
            }
        }

        // initialise the application with given options
        initializer(opts, services);
        if (typeof opts.element !== 'undefined') {
            opts.element.className += ' ec';
            var mainRouter = new router(opts.element, states, services);
            mainRouter.goToState('data');

        }

        return new Api(services);
    }

    window.ec = constructor;
})();

},{"../css/style.css":136,"./components/configure.js":139,"./components/debug.js":143,"./components/import.js":145,"./components/templateSelection.js":152,"./services/api":165,"./services/config":166,"./services/data":167,"./services/initializer":168,"./services/options":169,"./services/revision":170,"./services/router.js":171,"./services/templates":172,"dom-delegator":13,"mediatorjs":88,"virtual-dom/h":105}],138:[function(require,module,exports){
(function() {
    // Load the framework and Highcharts. Framework is passed as a parameter.
    var mediator;
    var configService;
    var that = {};

    that.load = function (element, services) {
        mediator = services.mediator;
        configService = services.config;
        var options = configService.get();
        options.chart.renderTo = element;
        var chart = new Highcharts.Chart(options);
        mediator.on('configUpdate', function (config) {
            config.chart.renderTo = element;
            chart = new Highcharts.Chart(config);
        });
    };

    module.exports = that;
})();
},{}],139:[function(require,module,exports){
(function () {
    var constructor = function (services) {
        var optionsService = services.options;
        var mediator = services.mediator;
        var configService = services.config;
        var genericTabs = require('./configure/genericTabs')(services);
        var seriesTabs = require('./configure/seriesTabs')(services);
        var axisTabs = require('./configure/axisTabs')(services);
        var config = configService.get();
        var options = optionsService.get();
        var context = 'configUpdate';
        var _ = {
            isUndefined: require('lodash.isundefined'),
            find: require('lodash.find'),
            map: require('lodash.map'),
            cloneDeep: require('lodash.clonedeep'),
            remove: require('lodash.remove'),
            forEach: require('lodash.foreach'),
            first: require('lodash.first')
        };
        var h = require('virtual-dom/h');
        var tabs;
        var activeTab = _.first(options).id;
        var activeTabChild;

        // when any config is updated we just re diff the ui -> e.g series labels

        mediator.on('configUpdate', function (_config_) {
            config = _config_;
            mediator.trigger('treeUpdate');
        }, context);

        function template() {

            var tabs = h('ul', {className: "vertical-tabs"},
                [
                    genericTabs.tabs(options, setActive, activeTab),
                    axisTabs.tabs(typeConfig(options, 'axis'), setActive, activeTab, activeTabChild, config),
                    seriesTabs.tabs(typeConfig(options, 'series'), setActive, activeTab, activeTabChild, config)
                ]);

            var content = h('div.vertical-tab-content-container', [
                generateContent(options, activeTab, activeTabChild)
            ]);

            return h('div', {className: 'vertical-tabs-container'}, [tabs, content]);
        }

        function typeConfig(options, type) {
            return _.find(options, function (item) {
                return item.id == type;
            })
        }

        function generateContent(panels, activeId, activeChildId) {
            var activePanel = _.find(panels, function (panel) {
                return panel.id == activeId;
            });
            var content;
            switch (activePanel.id) {
                case 'series':
                    content = seriesTabs.content(activePanel, activeChildId, config);
                    break;
                case 'axis':
                    content = axisTabs.content(activePanel, activeChildId, config, setActive);
                    break;
                default:
                    content = genericTabs.content(activePanel);
            }
            return content;
        }

        function setActive(id, child) {
            activeTab = id;
            activeTabChild = _.isUndefined(child) ? 0 : child;
            mediator.trigger('treeUpdate');
        }

        function destroy() {
            mediator.off(null, null, context);
        }
        return {
            template: template,
            destroy: destroy
        };
    };

    module.exports = constructor;

})();
},{"./configure/axisTabs":140,"./configure/genericTabs":141,"./configure/seriesTabs":142,"lodash.clonedeep":55,"lodash.find":57,"lodash.first":58,"lodash.foreach":59,"lodash.isundefined":72,"lodash.map":76,"lodash.remove":78,"virtual-dom/h":105}],140:[function(require,module,exports){
var propertyServices = require('../../factories/properties');
var _ = {
    isUndefined: require('lodash.isundefined'),
    find: require('lodash.find'),
    map: require('lodash.map'),
    cloneDeep: require('lodash.clonedeep'),
    remove: require('lodash.remove'),
    forEach: require('lodash.foreach'),
    first: require('lodash.first')
};
var h = require('virtual-dom/h');

function constructor(services) {
    var configService = services.config;
    var axesTabTitle = 'Axes';

    function tabs(options, setActive, activeTab, activeTabChild, config) {
        if (!_.isUndefined(options)) {
            var links = [];
            if (options.id == activeTab) {
                if (generalOptions(options.panes)) {
                    links.push(
                        h('li.hover', {
                            'className': activeTabChild === 'general' ? 'sub-active' : 'sub-non-active',
                            'ev-click': function (e) {
                                e.preventDefault();
                                setActive(options.id, 'general');
                            }
                        }, 'general')
                    )
                }
                if (config.xAxis) {
                    _.forEach(config.xAxis, function (axis, index) {
                        var titleText = !_.isUndefined(axis) && !_.isUndefined(axis.title) && !_.isUndefined(axis.title.text) ? axis.title.text : 'X axis ' + (index + 1);
                        links.push(
                            h('li.hover', {
                                'className': activeTabChild === 'xAxis' + index ? 'sub-active' : 'sub-non-active',
                                'ev-click': function (e) {
                                    e.preventDefault();
                                    setActive(options.id, 'xAxis' + index);
                                }
                            }, titleText)
                        )
                    });
                }


                if (config.yAxis) {
                    _.forEach(config.yAxis, function (axis, index) {
                        var titleText = !_.isUndefined(axis) && !_.isUndefined(axis.title) && !_.isUndefined(axis.title.text) ? axis.title.text : 'Y axis ' + (index + 1);
                        links.push(
                            h('li.hover', {
                                'className': activeTabChild === 'yAxis' + index ? 'sub-active' : 'sub-non-active',
                                'ev-click': function (e) {
                                    e.preventDefault();
                                    setActive(options.id, 'yAxis' + index);
                                }
                            }, titleText)
                        )
                    });
                }

                return h('li.active',
                    [
                        h('a', {
                            'href': '#data-series',
                            'ev-click': function (e) {
                                e.preventDefault();
                                setActive(options.id, 'general');
                            }
                        }, axesTabTitle),
                        h('ul', links)
                    ])
            }
            else {
                return h('li',
                    [
                        h('a', {
                            'href': '#data-series',
                            'ev-click': function (e) {
                                e.preventDefault();
                                setActive(options.id, 'general');
                            }
                        }, axesTabTitle)
                    ])
            }
        }
    }

    function generalOptions(panes) {
        return _.find(panes, function (pane) {
            return pane.id == "general";
        })
    }

    function generalContent(pane) {
        return h('div.vertical-tab-content', [generateContent({panes:[pane]})]);
    }

    function generateContent(panel) {
        var list = [];
        _.forEach(panel.panes, function (pane) {
            var inputs = [];
            _.forEach(pane.options, function (option) {
                inputs.push(propertyServices.get(option, configService));
            });
            var subPanes = pane.panes ? generateContent(pane) : '';
            var item = h('h3', pane.title);
            list.push(h('div.field-group',
                [
                    h('div.field-group__title', [item]),
                    h('div.field-group__items', inputs),
                    h('div', subPanes)
                ]
            ))
        });
        return list;
    }


    function axisContent(panes, child, config, setActive) {
        var type = child.substring(0, 5);
        var index = child.substring(5, 6);
        var pane = _.find(panes, function (pane) {
            return pane.id == type;
        });
        if (pane) {
            return h('div.vertical-tab-content', [h('div.titleBar',
                [
                    removeButton(type, index, pane.title, config[type], setActive),
                    addButton(type, config[type], setActive)
                ]
            ), generateAxisContentPane({panes:[pane]}, index, type)]);
        }
    }
    function generateAxisContentPane(panel, index, type){
        var list = [];
        _.forEach(panel.panes, function (pane) {
            var inputs = [];
            _.forEach(pane.options, function (option) {
                inputs.push(propertyServices.get(option, configService, type + '.' + index + '.' + option.fullname.replace(type + '.', "")));
            });
            var subPanes = pane.panes ? generateAxisContentPane(pane, index) : '';
            var item = h('h3', pane.title);
            list.push(h('div.field-group',
                [
                    h('div.field-group__title', [item]),
                    h('div.field-group__items', inputs),
                    h('div', subPanes)
                ]
            ))
        });
        return list;
    }

    function removeButton(type, index, title, typeConfig, setActive) {
        if (typeConfig.length > 1) {
            return h('button.btn.btn--small', {
                'ev-click': function () {
                    configService.removeValue(type + '.' + index, {});
                    setActive('axis', 'general');
                }
            }, 'remove axis');
        }

    }

    function addButton(type, typeConfig, setActive) {
        return h('button.btn.btn--small', {
            'ev-click': function () {
                configService.setValue(type + '.' + typeConfig.length, {})
                setActive('axis', type + typeConfig.length);
            }
        }, 'add ' + type)
    }

    function content(panel, child, config, setActive) {
        if (child == 'general') {
            return generalContent(generalOptions(panel.panes));
        } else {
            return axisContent(panel.panes, child, config, setActive);
        }
    }

    return {
        tabs: tabs,
        content: content
    }
}
module.exports = constructor;
},{"../../factories/properties":156,"lodash.clonedeep":55,"lodash.find":57,"lodash.first":58,"lodash.foreach":59,"lodash.isundefined":72,"lodash.map":76,"lodash.remove":78,"virtual-dom/h":105}],141:[function(require,module,exports){
var propertyServices = require('../../factories/properties');
var _ = {
    isUndefined: require('lodash.isundefined'),
    find: require('lodash.find'),
    map: require('lodash.map'),
    cloneDeep: require('lodash.clonedeep'),
    remove: require('lodash.remove'),
    forEach: require('lodash.foreach'),
    first: require('lodash.first')
};
var h = require('virtual-dom/h');

function constructor(services) {
    var configService = services.config;

    function genericConfig(options) {
        var newOptions = _.cloneDeep(options);
        return _.remove(newOptions, function (panel) {
            return panel.id !== "series" && panel.id !== "axis";
        })
    }

    function tabs(options, setActive, activeTab) {
        var links = [];
        var panes = genericConfig(options);
        _.forEach(panes, function (pane, index) {
            var children = [];
            var className = pane.id === activeTab ? 'active' : '';
            var link = h('li', {className: className},
                h('a', {
                        'href': '#' + pane.panelTitle,
                        'ev-click': function (e) {
                            e.preventDefault();
                            setActive(pane.id);
                        }
                    }, [pane.panelTitle, children]
                )
            );

            links.push(link);
        });
        return links;
    }


    function content(panel) {
        return h('div.vertical-tab-content', [generateContent(panel)]);
    }

    function generateContent(panel) {
        var list = [];
        _.forEach(panel.panes, function (pane) {
            var inputs = [];
            _.forEach(pane.options, function (option) {
                inputs.push(propertyServices.get(option, configService));
            });
            var subPanes = pane.panes ? generateContent(pane) : '';
            var item = h('h3', pane.title);
            list.push(h('div.field-group',
                [
                    h('div.field-group__title', [item]),
                    h('div.field-group__items', inputs),
                    h('div', subPanes)
                ]
            ))
        });
        return list;
    }

    return {
        tabs: tabs,
        content: content
    }
}
module.exports = constructor;
},{"../../factories/properties":156,"lodash.clonedeep":55,"lodash.find":57,"lodash.first":58,"lodash.foreach":59,"lodash.isundefined":72,"lodash.map":76,"lodash.remove":78,"virtual-dom/h":105}],142:[function(require,module,exports){
var propertyServices = require('../../factories/properties');
var _ = {
    isUndefined: require('lodash.isundefined'),
    find: require('lodash.find'),
    map: require('lodash.map'),
    cloneDeep: require('lodash.clonedeep'),
    remove: require('lodash.remove'),
    forEach: require('lodash.foreach'),
    first: require('lodash.first')
};
var h = require('virtual-dom/h');

function constructor (services){
    var configService = services.config;
    var seriesTabTitle = 'Data series';

    function tabs(options, setActive, activeTab, activeTabChild, config) {
        if (!_.isUndefined(options) && config.series.length > 1) {
            var links = [];
            if (options.id == activeTab) {
                _.forEach(config.series, function (serie, index) {
                    links.push(
                        h('li.hover', {
                            'className': activeTabChild === index ? 'sub-active' : 'sub-non-active',
                            'ev-click': function (e) {
                                e.preventDefault();
                                setActive(options.id, index);
                            }
                        }, serie.name ? serie.name : 'serie ' + index)
                    )
                });
                return h('li.active',
                    [
                        h('a', {
                            'href': '#data-series',
                            'ev-click': function (e) {
                                e.preventDefault();
                                setActive(options.id);
                            }
                        }, seriesTabTitle),
                        h('ul', links)
                    ])
            }
            else {
                return h('li',
                    [
                        h('a', {
                            'href': '#data-series',
                            'ev-click': function (e) {
                                e.preventDefault();
                                setActive(options.id);
                            }
                        }, seriesTabTitle),
                        h('ul', links)
                    ])
            }
        }

    }
    function panelContent(panel, series, index) {
        return h('div.vertical-tab-content', [generatePanelContent(panel, index)]);
    }

    function generatePanelContent(panel, index) {
        var list = [];
        _.forEach(panel.panes, function (pane) {
            var inputs = [];
            _.forEach(pane.options, function (option) {
                inputs.push(propertyServices.get(option, configService, 'series.' + index + option.fullname.replace("series", "")));
            });
            var subPanes = pane.panes ? generatePanelContent(pane, index) : '';
            var item = h('h3', pane.title);
            list.push(h('div.field-group',
                [
                    h('div.field-group__title', [item]),
                    h('div.field-group__items', inputs),
                    h('div', subPanes)
                ]
            ))
        });
        return list;
    }


    function content(panel, child, config) {
        if (!_.isUndefined(child)) {
            return panelContent(panel, config.series[child], child, config);
        } else {
            return panelContent(panel, config.series[0], 0, config);
        }
    }

    return{
        tabs: tabs,
        content: content
    }
}
module.exports = constructor;
},{"../../factories/properties":156,"lodash.clonedeep":55,"lodash.find":57,"lodash.first":58,"lodash.foreach":59,"lodash.isundefined":72,"lodash.map":76,"lodash.remove":78,"virtual-dom/h":105}],143:[function(require,module,exports){
(function () {
    var constructor = function (services) {
        var h = require('virtual-dom/h');
        var hljs = require('../../../node_modules/highlight.js/lib/highlight');
        var css = require('../../../node_modules/highlight.js/styles/monokai.css');
        hljs.registerLanguage('json', require('../../../node_modules/highlight.js/lib/languages/json'));
        window.hljs = hljs;

        var configService = services.config;
        var that = {};
        var config = JSON.stringify(configService.get(),null,4);
        services.mediator.on('configUpdate', function (_config_) {
            config = _config_;
        });
        var Hook = function(){};
        Hook.prototype.hook = function(node){
            setTimeout(function(){
                hljs.highlightBlock(node);
            });
        };
        that.template = function () {
            return h('pre', h('code', {'afterRender': new Hook()}, config));
        };

        return that;
    };

    module.exports = constructor;
})();

},{"../../../node_modules/highlight.js/lib/highlight":28,"../../../node_modules/highlight.js/lib/languages/json":29,"../../../node_modules/highlight.js/styles/monokai.css":30,"virtual-dom/h":105}],144:[function(require,module,exports){
(function () {
    //var _ = require('lodash');

    var _ = {
        forEach: require('lodash.foreach'),
        isEmpty: require('lodash.isempty'),
        isUndefined: require('lodash.isundefined')
    };


    var h = require('virtual-dom/h');
    var createElement = require('virtual-dom/create-element');
    var hot;
    function constructor(services) {
        var that = {};
        var element;
        var readOnly;
        that.load = function (_element_) {
            element = _element_;
            var wrapper = createElement(h('div'));


            readOnly = services.data.getUrl() ? true : false;
            if (readOnly){
                element.appendChild(createElement(h('div.readOnlyBox', h('span', 'A data url was found, the data will be read only'))));
            }
            element.appendChild(wrapper);
            var data = services.data.get();
            data = _.isUndefined(data[0]) ? [[]] : data;

            hot = new Handsontable(wrapper, {
                minRows: 1,
                minCols: 2,
                minSpareRows: 1,
                //minSpareCols: 1,
                height: 500,
                stretchH: 'all',
                rowHeaders: true,
                colHeaders: true,
                contextMenu: true,
                data: data,
                afterChange: function () {
                    services.data.set(removeEmptyRows(this));
                },
                afterRemoveRow:function () {
                    services.data.set(removeEmptyRows(this));
                },
                afterRemoveCol:function (test) {
                    services.data.set(removeEmptyRows(this));
                }
            });
            hot.updateSettings({
                cells: function (row, col, prop) {
                    var cellProperties = {};
                    cellProperties.readOnly = readOnly;
                    return cellProperties;
                }
            });

            services.mediator.on('dataUpdate', function (_data_) {
                readOnly = services.data.getUrl() ? true : false;
                if(_data_.length > 0){
                    hot.updateSettings({
                        data: _data_,
                        cells: function (row, col, prop) {
                            var cellProperties = {};
                            cellProperties.readOnly = readOnly;
                            return cellProperties;
                        }
                    });
                } else {
                    hot.clear();
                }

            }, 'hot');
        };

        var Hook = function () {};
        Hook.prototype.hook = function (node) {
            setTimeout(function () {
                that.load(node);
            });
        };

        that.template = function () {
            return h('div', {
                'afterRender': new Hook()
            });
        };


        that.destroy = function () {
            services.mediator.off(null, null, 'hot');
            var data = removeEmptyRows(hot);
            if (!_.isEmpty(data)) {
                services.data.set(removeEmptyRows(hot));
            }
            hot.destroy();
            element.innerHTML = '';
        };

        function removeEmptyRows(hot) {
            var gridData = hot.getData();
            var cleanedGridData = [];
            _.forEach(gridData, function (object, rowKey) {
                if (!hot.isEmptyRow(rowKey)) cleanedGridData[rowKey] = object;
            });
            return cleanedGridData;
        }

        return that;
    }

    module.exports = constructor;
})();

},{"lodash.foreach":59,"lodash.isempty":65,"lodash.isundefined":72,"virtual-dom/create-element":103,"virtual-dom/h":105}],145:[function(require,module,exports){
(function () {
    var constructor = function (services) {
        var h = require('virtual-dom/h');
        var paste = require('./import/paste');
        var upload = require('./import/upload');
        var dad = require('./import/dragAndDrop');
        var url = require('./import/url');
        var table = require('./table')(services);
        var hot = require('./hot')(services);
        var activeTab = services.data.getUrl() ? 'url' : services.data.get().length == 0 ? 'paste' : 'data';
        var mediator = services.mediator;
        mediator.on('goToTable', goToTable);
        var tabOptions = {
            paste: {
                label: 'Paste CSV',
                template: function () {
                    return paste.template(services);
                }
            },
            upload: {
                label: 'upload CSV',
                template: function () {
                    return h('div', [
                        upload.template(services),
                        dad.template(services)
                    ]);
                }
            },
            url: {
                label: 'url CSV',
                template: function () {
                    return url.template(services);
                }
            },
            data: {
                label: 'Data table',
                template: function () {
                    if (typeof Handsontable !== 'undefined') {
                        return hot.template(services);
                    } else {
                        return table.template(services);
                    }

                },
                destroy: function () {
                    if (typeof Handsontable !== 'undefined') {
                        hot.destroy();
                    } else {
                        table.destroy();
                    }
                }
            }
        };

        function tabLinks() {
            var links = ['paste', 'upload', 'url', 'data'];
            return h('ul.vertical-tabs', links.map(function (id) {
                    var className = activeTab === id ? 'active' : '';
                    return h('li', {
                            'className': className
                        }, h('a', {
                            'href': '#' + tabOptions[id].label,
                            'ev-click': function () {
                                load(id);
                            }
                        }, tabOptions[id].label)
                    )
                })
            )
        }

        function load(id) {
            if (tabOptions[activeTab].destroy) {
                tabOptions[activeTab].destroy();
            }
            activeTab = id;
            mediator.trigger('treeUpdate');
        }

        function goToTable() {
            activeTab = 'data';
            mediator.trigger('treeUpdate');
        }

        function destroy() {
            mediator.off('goToTable', goToTable);
            if (tabOptions[activeTab]['destroy']) {
                tabOptions[activeTab]['destroy']();
            }
        }

        function template() {
            return h('div.vertical-tabs-container', [
                tabLinks(),
                h('div.vertical-tab-content-container',
                    h('div.vertical-tab-content', tabOptions[activeTab].template())
                )
            ]);
        }

        return {
            template: template,
            destroy: destroy
        };
    };


    module.exports = constructor;
})();




},{"./hot":144,"./import/dragAndDrop":146,"./import/paste":147,"./import/upload":148,"./import/url":149,"./table":151,"virtual-dom/h":105}],146:[function(require,module,exports){
(function () {
    var dragDrop = require('drag-drop');
    var dataService;
    var h = require('virtual-dom/h');
    var that = {};
    that.template = function (services) {
        dataService = services.data;
        var mediator = services.mediator;
        var Hook = function () {};
        var content = 'Drop your CSV file here';
        Hook.prototype.hook = function (node) {
            dragDrop(node, function (files) {
                // `files` is an Array!
                files.forEach(function (file) {
                    // convert the file to a Buffer that we can use!
                    var reader = new FileReader();
                    reader.addEventListener('loadstart', function (e) {
                        console.log('start');
                        node.innerHTML = '<div class="loader"></div>'
                    });
                    reader.addEventListener('load', function (e) {
                        saveData(reader.result);
                        node.innerHTML = 'Drop your files here';
                        mediator.trigger('goToTable');
                    });

                    reader.addEventListener('error', function (err) {
                        console.error('FileReader error' + err)
                    });
                    reader.readAsText(file);
                })
            });
        };

        return h('div.file_drop', {
            'hook': new Hook()
        }, content);
    };

    function saveData(value) {
        dataService.setCSV(value);
    }

    module.exports = that;
})();

},{"drag-drop":19,"virtual-dom/h":105}],147:[function(require,module,exports){
(function () {
    var h = require('virtual-dom/h');

    var that = {};
    that.template = function (services) {
        var dataService = services.data;
        var mediator = services.mediator;
        var inputNode;
        var Hook = function(){};
        Hook.prototype.hook = function(node) {
            inputNode = node;
        };

        var input = h('textArea', {
            'style': {'height': '200px'},
            "hook": new Hook()
        });

        var importElement = h('button.btn.btn--small', {
            'ev-click': function(e){
                e.preventDefault();
                saveData(inputNode.value);
            }
        }, 'import');

        function saveData(value) {
            dataService.setCSV(value);
            mediator.trigger('goToTable');
        }

        return h('div', [input, importElement])
    };
    module.exports = that;
})();

},{"virtual-dom/h":105}],148:[function(require,module,exports){
(function () {
    var h = require('virtual-dom/h');
    var that = {};
    that.template = function (services) {
        var dataService = services.data;
        var mediator = services.mediator;
        var uploadElement;
        // Check for the various File API support.
        if (window.FileReader) {
            uploadElement =
                h('input.soft--ends', {
                    type: 'file',
                    "size": 50,
                    onchange: function(e){
                        loadFile(e);
                    }
                }, 'upload');
        }

        function loadFile(e) {
            var file = e.target.files[0];
            var reader  = new FileReader();
            reader.onloadend = function () {
                saveData(reader.result)
            };
            if (file) {
                reader.readAsText(file);
            }
        }

        function saveData(value) {
            dataService.setCSV(value);
            mediator.trigger('goToTable');
        }

        return uploadElement;
    };

    module.exports = that;
})();
},{"virtual-dom/h":105}],149:[function(require,module,exports){
(function () {
    var that = {};
    var h = require('virtual-dom/h');
    that.template = function (services) {
        var dataService = services.data;
        var mediator = services.mediator;
        var inputNode;

        var Hook = function(){};

        Hook.prototype.hook = function(node) {
            inputNode = node;
        };
        var input = h('input.push-half', {
            "size": 50,
            "type": "text",
            "style" : {
                display: "inline"
            },
            value: services.data.getUrl(),
            "hook": new Hook()
        });


        var importElement = h('button.btn.btn--small.push-half', {
            "style" : {
                display: "inline"
            },
            'ev-click': function (e) {
                e.preventDefault();
                dataService.setUrl(inputNode.value);
                mediator.trigger('goToTable');
            }
        }, 'save');

        return h('div', [input, importElement])
    };
    module.exports = that;
})();

},{"virtual-dom/h":105}],150:[function(require,module,exports){
var constructor = function (mediator, list) {
    var h = require('virtual-dom/h');
    var createElement = require('virtual-dom/create-element');
    var template = createElement(h('div'));

    function update(_list_) {
        list = _list_;
        template.innerHTML = '';
        if (list.length > 0) {
            var item = list.pop();
            template.appendChild(
                createElement(h('div.revisionElement', [
                    h('span', 'Data updated on ' + new Date(item.time).toTimeString().replace(/.*(\d{2}:\d{2}:\d{2}).*/, "$1") + '. '),
                    h('a',
                        {
                            'ev-click': function () {
                                mediator.trigger('backup.revert.last');
                            }
                        }
                        , 'Undo last update'
                    )]
                ))
            );
        }
    }


    mediator.on('backup.list.update', function (_list_) {
        update(_list_);
    });

    function toHHMMSS(string) {
        var sec_num = parseInt(string, 10); // don't forget the second param
        var hours = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
        var seconds = sec_num - (hours * 3600) - (minutes * 60);

        if (hours < 10) {
            hours = "0" + hours;
        }
        if (minutes < 10) {
            minutes = "0" + minutes;
        }
        if (seconds < 10) {
            seconds = "0" + seconds;
        }
        var time = hours + ':' + minutes + ':' + seconds;

        return time;
    }

    update(list);
    return {
        template: function () {
            return template;
        }
    };
};

module.exports = constructor;



},{"virtual-dom/create-element":103,"virtual-dom/h":105}],151:[function(require,module,exports){
(function () {
    var constructor = function (services) {
        var _ = {
            forEach: require('lodash.foreach'),
            trim: require('lodash.trim'),
            isEqual: require('lodash.isequal')
        };
        var h = require('virtual-dom/h');
        var mediator = services.mediator;
        var data;

        function template() {
            data = services.data.get();
            mediator.on('dataUpdate', updateData);
            var editable = services.data.getUrl() ? false : true;
            var rows = [];
            var readOnly = !editable ? h('div.readOnlyBox', h('span', 'A data url was found, the data will be read only')) : '';
            var editRow = [];
            // only add if there is data
            if (data[0]) {
                rows.push(h('tr', editRow));
                _.forEach(data, function (row, rowIndex) {
                    var cells = [];
                    _.forEach(row, function (cell, cellIndex) {
                        cells.push(h('td', {
                            contentEditable: services.data.getUrl() ? false : true,
                            "ev-input": function (e) {
                                var value = _.trim(e.target.innerHTML);
                                data[rowIndex][cellIndex] = value;
                                services.data.setValue(rowIndex, cellIndex, value);
                            }
                        }, cell));
                    });
                    rows.push(h('tr', cells));
                });
            }

            return h('div', [
                readOnly,
                h('table.table.table--data.table--bordered', {
                    className: !editable ? "table--disabled" : ""
                }, rows)
            ]);
        }


        function updateData(_data_) {
            console.log(_data_);
            console.log(data);
            if (!_.isEqual(_data_, data)) {
                data = _data_;
                mediator.trigger('treeUpdate');
            }
        }

        function destroy() {
            mediator.off('dataUpdate', updateData);
        }

        return {
            template: template,
            destroy: destroy
        };
    };

    module.exports = constructor;
})();





},{"lodash.foreach":59,"lodash.isequal":66,"lodash.trim":85,"virtual-dom/h":105}],152:[function(require,module,exports){
(function () {
    var constructor = function (services) {
        var that = {};
        var _ = {
            find: require('lodash.find'),
            forEach: require('lodash.foreach'),
            first: require('lodash.first')
        };
        var h = require('virtual-dom/h');
        var iconLoader = require('../factories/iconLoader');
        var mediator = services.mediator;
        var activeId = _.first(services.templates.get()).id;
        var config = services.config;

        that.template = function () {
            var activeType = _.find(services.templates.get(), function (type) {
                return type.id == activeId;
            });
            var templates = services.templates.get();
            var tabs = generateTabs(templates, activeId);
            var content = generateContent(activeType);
            return h('div', {className: 'vertical-tabs-container'}, [tabs, content]);
        };

        function generateContent(activeType) {
            var templateList = [];

            _.forEach(activeType.templates, function (template) {
                var svg = iconLoader.get(template.icon ? template.icon : activeType.icon);
                var item = h('a',
                    {
                        className: "templatelist__item",
                        'ev-click': function () {
                            config.loadTemplate(template.definition);
                        }
                    }, [
                        svg,
                        h('div', template.title)
                    ]);
                templateList.push(item)
            });
            var templateGrid = h('div', {className: "templatelist"}, templateList);
            return h('div.vertical-tab-content-container', h('div.vertical-tab-content', templateGrid));
        }

        function generateTabs(types, active) {
            var links = [];
            _.forEach(types, function (type, index) {
                var className = type.id === active ? 'active' : '';

                var link = h('li', {
                    'className': className
                }, h('a', {
                    'href': '#' + type.type,
                    'ev-click': function (e) {
                        e.preventDefault();
                        activeId = type.id;
                        mediator.trigger('treeUpdate');
                    }
                }, type.type));

                links.push(link);
            });
            return h('ul', {className: "vertical-tabs"}, links);
        }

        return that;
    };


    module.exports = constructor;
})();
},{"../factories/iconLoader":155,"lodash.find":57,"lodash.first":58,"lodash.foreach":59,"virtual-dom/h":105}],153:[function(require,module,exports){
module.exports=module.exports = [
    {
        "id": "chart",
        "panelTitle": "Chart settings",
        "panes": [
            {
                "title": "Chart type and interaction",
                "options": [
                    {
                        "name": "chart--type",
                        "fullname": "chart.type",
                        "title": "type",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "line",
                        "values": "[\"line\", \"spline\", \"column\", \"bar\", \"area\", \"areaspline\", \"pie\", \"arearange\", \"areasplinerange\", \"boxplot\", \"bubble\", \"columnrange\", \"errorbar\", \"funnel\", \"gauge\", \"heatmap\", \"polygon\", \"pyramid\", \"scatter\", \"solidgauge\", \"treemap\", \"waterfall\"]",
                        "since": "2.1.0",
                        "description": "The default series type for the chart. Can be any of the chart types listed under <a href=\"#plotOptions\">plotOptions</a>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/type-bar/\" target=\"_blank\">Bar</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--inverted",
                        "fullname": "chart.inverted",
                        "title": "inverted",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "since": "",
                        "description": "Whether to invert the axes so that the x axis is vertical and y axis is horizontal.\r When true, the x axis is reversed by default. If a bar series is present in the chart,\r it will be inverted automatically.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/inverted/\" target=\"_blank\">Inverted line</a>",
                        "seeAlso": "",
                        "deprecated": false
                    },
                    {
                        "name": "chart--zoomType",
                        "fullname": "chart.zoomType",
                        "title": "zoomType",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "String",
                        "values": "[null, \"x\", \"y\", \"xy\"]",
                        "description": "Decides in what dimensions the user can zoom by dragging the mouse. Can be one of <code>x</code>, <code>y</code> or <code>xy</code>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/zoomtype-none/\" target=\"_blank\">None by default</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/zoomtype-x/\" target=\"_blank\">x</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/zoomtype-y/\" target=\"_blank\">y</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/zoomtype-xy/\" target=\"_blank\">xy</a>",
                        "seeAlso": "<a href=\"#chart.panKey\">panKey</a>",
                        "deprecated": false
                    },
                    {
                        "name": "plotOptions-column--stacking",
                        "fullname": "plotOptions.column.stacking",
                        "title": "column stacking",
                        "parent": "plotOptions-column",
                        "isParent": false,
                        "returnType": "String",
                        "values": "[null, \"normal\", \"percent\"]",
                        "description": "Whether to stack the values of each series on top of each other. Possible values are null to disable, \"normal\" to stack by value or \"percent\".",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-line/\" target=\"_blank\">Line</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-column/\" target=\"_blank\">column</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-bar/\" target=\"_blank\">bar</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-area/\" target=\"_blank\">area</a> with \"normal\" stacking. \r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-line/\" target=\"_blank\">Line</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-column/\" target=\"_blank\">column</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-bar/\" target=\"_blank\">bar</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-area/\" target=\"_blank\">area</a> with \"percent\" stacking.",
                        "seeAlso": "<a href=\"#yAxis.reversedStacks\">yAxis.reversedStacks</a>",
                        "deprecated": false
                    },
                    {
                        "name": "plotOptions-bar--stacking",
                        "fullname": "plotOptions.bar.stacking",
                        "title": "bar stacking",
                        "parent": "plotOptions-bar",
                        "isParent": false,
                        "returnType": "String",
                        "values": "[null, \"normal\", \"percent\"]",
                        "description": "Whether to stack the values of each series on top of each other. Possible values are null to disable, \"normal\" to stack by value or \"percent\".",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-line/\" target=\"_blank\">Line</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-column/\" target=\"_blank\">column</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-bar/\" target=\"_blank\">bar</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-area/\" target=\"_blank\">area</a> with \"normal\" stacking. \r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-line/\" target=\"_blank\">Line</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-column/\" target=\"_blank\">column</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-bar/\" target=\"_blank\">bar</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/plotoptions/series-stacking-percent-area/\" target=\"_blank\">area</a> with \"percent\" stacking.",
                        "seeAlso": "<a href=\"#yAxis.reversedStacks\">yAxis.reversedStacks</a>",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "Size and margins",
                "options": [
                    {
                        "name": "chart--width",
                        "fullname": "chart.width",
                        "title": "width",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "An explicit width for the chart. By default the width is calculated from the offset width of the containing element.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/width/\" target=\"_blank\">800px wide</a>"
                    },
                    {
                        "name": "chart--height",
                        "fullname": "chart.height",
                        "title": "height",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "An explicit height for the chart. By default the height is calculated from the offset height of the containing element, or 400 pixels if the containing element's height is 0.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/height/\" target=\"_blank\">500px height</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--spacingTop",
                        "fullname": "chart.spacingTop",
                        "title": "spacingTop",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "10",
                        "since": "2.1",
                        "description": "<p>The space between the top edge of the chart and the content (plot area, axis title and labels, title, subtitle or \r\n legend in top position).</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingtop-100/\" target=\"_blank\">A top spacing of 100</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingtop-10/\" target=\"_blank\">floating chart title makes the plot area align to the \r\n\t\t\tdefault spacingTop of 10.</a>.",
                        "deprecated": false
                    },
                    {
                        "name": "chart--spacingRight",
                        "fullname": "chart.spacingRight",
                        "title": "spacingRight",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "10",
                        "since": "2.1",
                        "description": "<p>The space between the right edge of the chart and the content (plot area, axis title and labels, title, subtitle or \r legend in top position).</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingright-100/\" target=\"_blank\">Spacing set to 100</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingright-legend/\" target=\"_blank\">legend in right position with default spacing</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--spacingBottom",
                        "fullname": "chart.spacingBottom",
                        "title": "spacingBottom",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "15",
                        "since": "2.1",
                        "description": "<p>The space between the bottom edge of the chart and the content (plot area, axis title and labels, title, subtitle or \r legend in top position).</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingbottom/\" target=\"_blank\">Spacing bottom set to 100</a>.",
                        "deprecated": false
                    },
                    {
                        "name": "chart--spacingLeft",
                        "fullname": "chart.spacingLeft",
                        "title": "spacingLeft",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "10",
                        "since": "2.1",
                        "description": "<p>The space between the left edge of the chart and the content (plot area, axis title and labels, title, subtitle or \r legend in top position).</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/spacingleft/\" target=\"_blank\">Spacing left set to 100</a>",
                        "deprecated": false
                    }
                ]
            }
        ]
    },
    {
        "id": "colorsAndBorders",
        "panelTitle": "Colors and borders",
        "panes": [
            {
                "title": "default colors",
                "options": [
                    {
                        "name": "colors",
                        "fullname": "colors",
                        "title": "colors",
                        "isParent": false,
                        "returnType": "Array<Color>",
                        "defaults": "[ \"#7cb5ec\" , \"#434348\" , \"#90ed7d\" , \"#f7a35c\" , \"#8085e9\" , \"#f15c80\" , \"#e4d354\" , \"#2b908f\" , \"#f45b5b\" , \"#91e8e1\"]",
                        "description": "<p>An array containing the default colors for the chart's series. When all colors are used, new colors are pulled from the start again. Defaults to:\r\n<pre>colors: ['#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9', \r\n   '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1']</pre>\r\n\r\nDefault colors can also be set on a series or series.type basis, see <a href=\"#plotOptions.column.colors\">column.colors</a>, <a href=\"#plotOptions.pie.colors\">pie.colors</a>.\r\n</p>\r\n\r\n<h3>Legacy</h3>\r\n<p>In Highcharts 3.x, the default colors were:\r\n<pre>colors: ['#2f7ed8', '#0d233a', '#8bbc21', '#910000', '#1aadce', \r\n   '#492970', '#f28f43', '#77a1e5', '#c42525', '#a6c96a']</pre>\r\n</p>\r\n\r\n<p>In Highcharts 2.x, the default colors were:\r\n<pre>colors: ['#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE', \r\n   '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92']</pre></p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/colors/\" target=\"_blank\">Assign a global color theme</a>",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "Chart area",
                "options": [
                    {
                        "name": "chart--backgroundColor",
                        "fullname": "chart.backgroundColor",
                        "title": "backgroundColor",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Color",
                        "defaults": "#FFFFFF",
                        "description": "The background color or gradient for the outer chart area.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/backgroundcolor-color/\" target=\"_blank\">Color</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/backgroundcolor-gradient/\" target=\"_blank\">gradient</a>"
                    },
                    {
                        "name": "chart--borderWidth",
                        "fullname": "chart.borderWidth",
                        "title": "borderWidth",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "0",
                        "description": "The pixel width of the outer chart border.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/borderwidth/\" target=\"_blank\">5px border</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--borderRadius",
                        "fullname": "chart.borderRadius",
                        "title": "borderRadius",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "0",
                        "description": "The corner radius of the outer chart border.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/borderradius/\" target=\"_blank\">20px radius</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--borderColor",
                        "fullname": "chart.borderColor",
                        "title": "borderColor",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Color",
                        "defaults": "#4572A7",
                        "description": "The color of the outer chart border.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/bordercolor/\" target=\"_blank\">Brown border</a>",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "Plot area",
                "options": [
                    {
                        "name": "chart--plotBackgroundColor",
                        "fullname": "chart.plotBackgroundColor",
                        "title": "plotBackgroundColor",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Color",
                        "description": "The background color or gradient for the plot area.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/plotbackgroundcolor-color/\" target=\"_blank\">Color</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/plotbackgroundcolor-gradient/\" target=\"_blank\">gradient</a>"
                    },
                    {
                        "name": "chart--plotBackgroundImage",
                        "fullname": "chart.plotBackgroundImage",
                        "title": "plotBackgroundImage",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "String",
                        "description": "The URL for an image to use as the plot background. To set an image as the background for the entire chart, set a CSS background image to the container element. Note that for the image to be applied to exported charts, its URL needs to be accessible by the export server.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/plotbackgroundimage/\" target=\"_blank\">Skies</a>",
                        "deprecated": false
                    },
                    {
                        "name": "chart--plotBorderWidth",
                        "fullname": "chart.plotBorderWidth",
                        "title": "plotBorderWidth",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "0",
                        "description": "The pixel width of the plot area border.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/plotborderwidth/\" target=\"_blank\">1px border</a>"
                    },
                    {
                        "name": "chart--plotBorderColor",
                        "fullname": "chart.plotBorderColor",
                        "title": "plotBorderColor",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Color",
                        "defaults": "#C0C0C0",
                        "description": "The color of the inner chart or plot area border.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/plotbordercolor/\" target=\"_blank\">Blue border</a>"
                    }
                ]
            }
        ]
    },
    {
        "id": "titles",
        "panelTitle": "Titles",
        "panes": [
            {
                "title": "Titles",
                "options": [
                    {
                        "name": "title--text",
                        "fullname": "title.text",
                        "title": "chart title",
                        "parent": "title",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "Chart title",
                        "description": "The title of the chart. To disable the title, set the <code>text</code> to <code>null</code>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/title/text/\" target=\"_blank\">Custom title</a>"
                    },
                    {
                        "name": "subtitle--text",
                        "fullname": "subtitle.text",
                        "title": "chart subtitle",
                        "parent": "subtitle",
                        "isParent": false,
                        "returnType": "String",
                        "description": "The subtitle of the chart.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/subtitle/text/\" target=\"_blank\">Custom subtitle</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/subtitle/text-formatted/\" target=\"_blank\">formatted and linked text.</a>"
                    }
                ]
            },
            {
                "title": "Title advanced",
                "options": [
                    {
                        "name": "title--style",
                        "fullname": "title.style",
                        "title": "style",
                        "parent": "title",
                        "isParent": false,
                        "returnType": "CSSObject",
                        "defaults": "{ \"color\": \"#333333\", \"fontSize\": \"18px\" }",
                        "description": "CSS styles for the title. Use this for font styling, but use <code>align</code>, <code>x</code> and <code>y</code> for text alignment.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/title/style/\" target=\"_blank\">Custom color and weight</a>",
                        "deprecated": false
                    }
                ]
            }
        ]
    },
    {
        "id": "axis",
        "panelTitle": "Axis",
        "panes": [
            {
                "title": "Axes setup",
                "id": "general",
                "options": [
                    {
                        "name": "chart--inverted",
                        "fullname": "chart.inverted",
                        "title": "inverted",
                        "parent": "chart",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "since": "",
                        "description": "Whether to invert the axes so that the x axis is vertical and y axis is horizontal.\r When true, the x axis is reversed by default. If a bar series is present in the chart,\r it will be inverted automatically.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/chart/inverted/\" target=\"_blank\">Inverted line</a>",
                        "seeAlso": "",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "X axis",
                "id": "xAxis",
                "options": [
                    {
                        "name": "xAxis-title--text",
                        "fullname": "xAxis.title.text",
                        "title": "text",
                        "parent": "xAxis-title",
                        "isParent": false,
                        "returnType": "String",
                        "description": "The actual text of the axis title. It can contain basic HTML text markup like &lt;b&gt;, &lt;i&gt; and spans with style.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/title-text/\" target=\"_blank\">Custom HTML</a> title for X axis"
                    },
                    {
                        "name": "xAxis--type",
                        "fullname": "xAxis.type",
                        "title": "type",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "linear",
                        "values": "[\"linear\", \"logarithmic\", \"datetime\", \"category\"]",
                        "description": "The type of axis. Can be one of <code>\"linear\"</code>, <code>\"logarithmic\"</code>, <code>\"datetime\"</code> or <code>\"category\"</code>. In a datetime axis, the numbers are given in milliseconds, and tick marks are placed \t\ton appropriate values like full hours or days. In a category axis, the <a href=\"#series.data\">point names</a> of the chart's series are used for categories, if not a <a href=\"#xAxis.categories\">categories</a> array is defined.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-linear/\" target=\"_blank\">\"linear\"</a>, \r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-datetime/\" target=\"_blank\">\"datetime\" with regular intervals</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-datetime-irregular/\" target=\"_blank\">\"datetime\" with irregular intervals</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/type-log/\" target=\"_blank\">\"logarithmic\"</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/type-log-minorgrid/\" target=\"_blank\">\"logarithmic\" with minor grid lines</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-log-both/\" target=\"_blank\">\"logarithmic\" on two axes</a>.",
                        "deprecated": false
                    },
                    {
                        "name": "xAxis--min",
                        "fullname": "xAxis.min",
                        "title": "min",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "The minimum value of the axis. If <code>null</code> the min value is automatically calculated. If the <code>startOnTick</code> option is true, the <code>min</code> value might be rounded down.",
                        "demo": "Y axis min of <a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/min-startontick-false/\" target=\"_blank\">-50 with startOnTick to false</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/min-startontick-true/\" target=\"_blank\">-50 with startOnTick true by default</a>"
                    },
                    {
                        "name": "xAxis--max",
                        "fullname": "xAxis.max",
                        "title": "max",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "The maximum value of the axis. If <code>null</code>, the max value is automatically calculated. If the <code>endOnTick</code> option is true, the <code>max</code> value might be rounded up. The actual maximum value is also influenced by  <a class=\"internal\" href=\"#chart\">chart.alignTicks</a>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/max-200/\" target=\"_blank\">Y axis max of 200</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/max-logarithmic/\" target=\"_blank\">Y axis max on logarithmic axis</a>"
                    },
                    {
                        "name": "xAxis--opposite",
                        "fullname": "xAxis.opposite",
                        "title": "opposite",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "description": "Whether to display the axis on the opposite side of the normal. The normal is on the left side for vertical axes and bottom for horizontal, so the opposite sides will be right and top respectively. This is typically used with dual or multiple axes.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/opposite/\" target=\"_blank\">Secondary Y axis opposite</a>"
                    },
                    {
                        "name": "xAxis--reversed",
                        "fullname": "xAxis.reversed",
                        "title": "reversed",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "description": "Whether to reverse the axis so that the highest number is closest to the origin. If the chart is inverted, the x axis is reversed by default.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/reversed/\" target=\"_blank\">Reversed Y axis</a>",
                        "deprecated": false
                    },
                    {
                        "name": "xAxis--tickInterval",
                        "fullname": "xAxis.tickInterval",
                        "title": "tickInterval",
                        "parent": "xAxis",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "<p>The interval of the tick marks in axis units. When <code>null</code>, the tick interval\r\n is computed to approximately follow the <a href=\"#xAxis.tickPixelInterval\">tickPixelInterval</a> on linear and datetime axes.\r\n On categorized axes, a <code>null</code> tickInterval will default to 1, one category. \r\n Note that datetime axes are based on milliseconds, so for \r\n example an interval of one day is expressed as <code>24 * 3600 * 1000</code>.</p>\r\n <p>On logarithmic axes, the tickInterval is based on powers, so a tickInterval of 1 means\r\n \tone tick on each of 0.1, 1, 10, 100 etc. A tickInterval of 2 means a tick of 0.1, 10, 1000 etc.\r\n \tA tickInterval of 0.2 puts a tick on 0.1, 0.2, 0.4, 0.6, 0.8, 1, 2, 4, 6, 8, 10, 20, 40 etc.</p>\r\n<p>If the tickInterval is too dense for labels to be drawn, Highcharts may remove ticks.</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/tickinterval-5/\" target=\"_blank\">Tick interval of 5 on a linear axis</a>",
                        "seeAlso": "<a href=\"#xAxis.tickPixelInterval\">tickPixelInterval</a>, <a href=\"#xAxis.tickPositions\">tickPositions</a>, <a href=\"#xAxis.tickPositioner\">tickPositioner</a>",
                        "deprecated": false
                    },
                    {
                        "name": "xAxis-labels--format",
                        "fullname": "xAxis.labels.format",
                        "title": "format",
                        "parent": "xAxis-labels",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "{value}",
                        "since": "3.0",
                        "description": "A <a href=\"http://www.highcharts.com/docs/chart-concepts/labels-and-string-formatting\">format string</a> for the axis label. ",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/labels-format/\" target=\"_blank\">Add units to Y axis label</a>",
                        "deprecated": false
                    },
                    {
                        "name": "xAxis-labels--rotation",
                        "fullname": "xAxis.labels.rotation",
                        "title": "rotation",
                        "parent": "xAxis-labels",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "0",
                        "description": "Rotation of the labels in degrees.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/labels-rotation/\" target=\"_blank\">X axis labels rotated 90°</a>"
                    },
                    {
                        "name": "xAxis-labels--align",
                        "fullname": "xAxis.labels.align",
                        "title": "align",
                        "parent": "xAxis-labels",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "center",
                        "values": "[\"left\", \"center\", \"right\"]",
                        "description": "What part of the string the given position is anchored to. Can be one of <code>\"left\"</code>, <code>\"center\"</code> or <code>\"right\"</code>. Defaults to an intelligent guess based on which side of the chart the axis is on and the rotation of the label.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/labels-align-left/\" target=\"_blank\">\"left\"</a>, \r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/labels-align-right/\" target=\"_blank\">\"right\"</a> on X axis",
                        "deprecated": false
                    },
                    {
                        "name": "xAxis-plotBands",
                        "fullname": "xAxis.plotBands",
                        "title": "plotBands",
                        "parent": "xAxis",
                        "isParent": true,
                        "returnType": "Array<Object>",
                        "description": "<p>An array of colored bands stretching across the plot area marking an interval on the axis.</p>\r\n\r\n<p>In a gauge, a plot band on the Y axis (value axis) will stretch along the perimeter of the gauge.</p>",
                        "deprecated": false,
                        "options": [
                            {
                                "name": "xAxis-plotBands--color",
                                "fullname": "xAxis.plotBands.color",
                                "title": "color",
                                "parent": "xAxis-plotBands",
                                "isParent": false,
                                "returnType": "Color",
                                "description": "The color of the plot band.",
                                "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/plotbands-color/\" target=\"_blank\">Color band</a>"
                            },
                            {
                                "name": "xAxis-plotBands--from",
                                "fullname": "xAxis.plotBands.from",
                                "title": "from",
                                "parent": "xAxis-plotBands",
                                "isParent": false,
                                "returnType": "Number",
                                "description": "The start position of the plot band in axis units.",
                                "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/plotbands-color/\" target=\"_blank\">Datetime axis</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/plotbands-from/\" target=\"_blank\">categorized axis</a>,"
                            },
                            {
                                "name": "xAxis-plotBands--to",
                                "fullname": "xAxis.plotBands.to",
                                "title": "to",
                                "parent": "xAxis-plotBands",
                                "isParent": false,
                                "returnType": "Number",
                                "description": "The end position of the plot band in axis units.",
                                "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/plotbands-color/\" target=\"_blank\">Datetime axis</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/plotbands-from/\" target=\"_blank\">categorized axis</a>,"
                            },
                            {
                                "name": "xAxis-plotBands-label--text",
                                "fullname": "xAxis.plotBands.label.text",
                                "title": "text",
                                "parent": "xAxis-plotBands-label",
                                "isParent": false,
                                "returnType": "String",
                                "since": "2.1",
                                "description": "The string text itself. A subset of HTML is supported."
                            }
                        ]
                    }
                ]
            },
            {
                "title": "Value axis",
                "id": "yAxis",
                "options": [
                    {
                        "name": "yAxis-title--text",
                        "fullname": "yAxis.title.text",
                        "title": "text",
                        "parent": "yAxis-title",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "Values",
                        "description": "The actual text of the axis title. Horizontal texts can contain HTML, \r but rotated texts are painted using vector techniques and must be \r clean text. The Y axis title is disabled by setting the <code>text</code>\r option to <code>null</code>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/title-text/\" target=\"_blank\">Custom HTML</a> title for X axis",
                        "deprecated": false
                    },
                    {
                        "name": "yAxis--type",
                        "fullname": "yAxis.type",
                        "title": "type",
                        "parent": "yAxis",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "linear",
                        "values": "[\"linear\", \"logarithmic\", \"datetime\", \"category\"]",
                        "description": "The type of axis. Can be one of <code>\"linear\"</code>, <code>\"logarithmic\"</code>, <code>\"datetime\"</code> or <code>\"category\"</code>. In a datetime axis, the numbers are given in milliseconds, and tick marks are placed \t\ton appropriate values like full hours or days. In a category axis, the <a href=\"#series.data\">point names</a> of the chart's series are used for categories, if not a <a href=\"#xAxis.categories\">categories</a> array is defined.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-linear/\" target=\"_blank\">\"linear\"</a>, \r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-datetime/\" target=\"_blank\">\"datetime\" with regular intervals</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-datetime-irregular/\" target=\"_blank\">\"datetime\" with irregular intervals</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/type-log/\" target=\"_blank\">\"logarithmic\"</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/type-log-minorgrid/\" target=\"_blank\">\"logarithmic\" with minor grid lines</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/type-log-both/\" target=\"_blank\">\"logarithmic\" on two axes</a>.",
                        "deprecated": false
                    },
                    {
                        "name": "yAxis--min",
                        "fullname": "yAxis.min",
                        "title": "min",
                        "parent": "yAxis",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "<p>The minimum value of the axis. If <code>null</code> the min value is automatically calculated.</p>\r\n\r\n<p>If the <code>startOnTick</code> option is true, the <code>min</code> value might be rounded down.</p>\r\n\r\n<p>The automatically calculated minimum value is also affected by <a href=\"#yAxis.floor\">floor</a>, <a href=\"#yAxis.minPadding\">minPadding</a>, <a href=\"#yAxis.minRange\">minRange</a> as well as <a href=\"#plotOptions.series.threshold\">series.threshold</a> and <a href=\"#plotOptions.series.softThreshold\">series.softThreshold</a>.</p>",
                        "demo": "Y axis min of <a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/min-startontick-false/\" target=\"_blank\">-50 with startOnTick to false</a>,\r\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/min-startontick-true/\" target=\"_blank\">-50 with startOnTick true by default</a>",
                        "deprecated": false
                    },
                    {
                        "name": "yAxis--max",
                        "fullname": "yAxis.max",
                        "title": "max",
                        "parent": "yAxis",
                        "isParent": false,
                        "returnType": "Number",
                        "description": "The maximum value of the axis. If <code>null</code>, the max value is automatically calculated. If the <code>endOnTick</code> option is true, the <code>max</code> value might be rounded up. The actual maximum value is also influenced by  <a class=\"internal\" href=\"#chart\">chart.alignTicks</a>.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/max-200/\" target=\"_blank\">Y axis max of 200</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/max-logarithmic/\" target=\"_blank\">Y axis max on logarithmic axis</a>"
                    },
                    {
                        "name": "yAxis--opposite",
                        "fullname": "yAxis.opposite",
                        "title": "opposite",
                        "parent": "yAxis",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "description": "Whether to display the axis on the opposite side of the normal. The normal is on the left side for vertical axes and bottom for horizontal, so the opposite sides will be right and top respectively. This is typically used with dual or multiple axes.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/opposite/\" target=\"_blank\">Secondary Y axis opposite</a>"
                    },
                    {
                        "name": "yAxis--reversed",
                        "fullname": "yAxis.reversed",
                        "title": "reversed",
                        "parent": "yAxis",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "false",
                        "description": "Whether to reverse the axis so that the highest number is closest to the origin. If the chart is inverted, the x axis is reversed by default.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/reversed/\" target=\"_blank\">Reversed Y axis</a>",
                        "deprecated": false
                    },
                    {
                        "name": "yAxis-labels--format",
                        "fullname": "yAxis.labels.format",
                        "title": "format",
                        "parent": "yAxis-labels",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "{value}",
                        "since": "3.0",
                        "description": "A <a href=\"http://www.highcharts.com/docs/chart-concepts/labels-and-string-formatting\">format string</a> for the axis label. ",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/yaxis/labels-format/\" target=\"_blank\">Add units to Y axis label</a>",
                        "deprecated": false
                    },
                    {
                        "name": "yAxis-labels--rotation",
                        "fullname": "yAxis.labels.rotation",
                        "title": "rotation",
                        "parent": "yAxis-labels",
                        "isParent": false,
                        "returnType": "Number",
                        "defaults": "0",
                        "description": "Rotation of the labels in degrees.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/xaxis/labels-rotation/\" target=\"_blank\">X axis labels rotated 90°</a>"
                    }
                ]
            }
        ]
    },
    {
        "id": "legend",
        "panelTitle": "Legend",
        "panes": [
            {
                "title": "General",
                "options": [
                    {
                        "name": "legend--enabled",
                        "fullname": "legend.enabled",
                        "title": "enabled",
                        "parent": "legend",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "true",
                        "description": "Enable or disable the legend.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/legend/enabled-false/\" target=\"_blank\">Legend disabled</a>"
                    },
                    {
                        "name": "legend--layout",
                        "fullname": "legend.layout",
                        "title": "layout",
                        "parent": "legend",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "horizontal",
                        "values": "[\"horizontal\", \"vertical\"]",
                        "description": "The layout of the legend items. Can be one of \"horizontal\" or \"vertical\".",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/legend/layout-horizontal/\" target=\"_blank\">Horizontal by default</a>,\n\t\t\t<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/legend/layout-vertical/\" target=\"_blank\">vertical</a>"
                    }
                ]
            },
            {
                "title": "Placement",
                "options": [
                    {
                        "name": "legend--align",
                        "fullname": "legend.align",
                        "title": "align",
                        "parent": "legend",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "center",
                        "values": "[\"left\", \"center\", \"right\"]",
                        "since": "2.0",
                        "description": "<p>The horizontal alignment of the legend box within the chart area. Valid values are <code>left</code>, <code>center</code> and <code>right</code>.</p>\r\n\r\n<p>In the case that the legend is aligned in a corner position, the <code>layout</code> option will determine whether to place it above/below or on the side of the plot area.</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/legend/align/\" target=\"_blank\">Legend at the right of the chart</a>",
                        "deprecated": false
                    },
                    {
                        "name": "legend--verticalAlign",
                        "fullname": "legend.verticalAlign",
                        "title": "verticalAlign",
                        "parent": "legend",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "bottom",
                        "values": "[\"top\", \"middle\", \"bottom\"]",
                        "since": "2.0",
                        "description": "<p>The vertical alignment of the legend box. Can be one of <code>top</code>, <code>middle</code> or  <code>bottom</code>. Vertical position can be further determined by the <code>y</code> option.</p>\r\n\r\n<p>In the case that the legend is aligned in a corner position, the <code>layout</code> option will determine whether to place it above/below or on the side of the plot area.</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/legend/verticalalign/\" target=\"_blank\">Legend 100px from the top of the chart</a>",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "Color and border",
                "options": []
            }
        ]
    },
    {
        "id": "tooltip",
        "panelTitle": "Tooltip",
        "panes": [
            {
                "title": "General",
                "options": [
                    {
                        "name": "tooltip--headerFormat",
                        "fullname": "tooltip.headerFormat",
                        "title": "headerFormat",
                        "parent": "tooltip",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "",
                        "values": "",
                        "since": "",
                        "description": "<p>The HTML of the tooltip header line. Variables are enclosed by curly brackets. Available variables\t\t\tare <code>point.key</code>, <code>series.name</code>, <code>series.color</code> and other members from the <code>point</code> and <code>series</code> objects. The <code>point.key</code> variable contains the category name, x value or datetime string depending on the type of axis. For datetime axes, the <code>point.key</code> date format can be set using tooltip.xDateFormat.</p>\r \r\n<p>Defaults to <code>&lt;span style=\"font-size: 10px\"&gt;{point.key}&lt;/span&gt;&lt;br/&gt;</code></p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/tooltip/footerformat/\" target=\"_blank\">A HTML table in the tooltip</a>",
                        "seeAlso": "",
                        "deprecated": false
                    },
                    {
                        "name": "tooltip--pointFormat",
                        "fullname": "tooltip.pointFormat",
                        "title": "pointFormat",
                        "parent": "tooltip",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "<span style=\"color:{point.color}\">\\u25CF</span> {series.name}: <b>{point.y}</b><br/>",
                        "since": "2.2",
                        "description": "<p>The HTML of the point's line in the tooltip. Variables are enclosed by curly brackets. Available variables are point.x, point.y, series.name and series.color and other properties on the same form. Furthermore,  point.y can be extended by the <code>tooltip.valuePrefix</code> and <code>tooltip.valueSuffix</code> variables. This can also be overridden for each series, which makes it a good hook for displaying units.</p>",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/tooltip/pointformat/\" target=\"_blank\">A different point format with value suffix</a>",
                        "deprecated": false
                    },
                    {
                        "name": "tooltip--valuePrefix",
                        "fullname": "tooltip.valuePrefix",
                        "title": "valuePrefix",
                        "parent": "tooltip",
                        "isParent": false,
                        "returnType": "String",
                        "since": "2.2",
                        "description": "A string to prepend to each series' y value. Overridable in each series' tooltip options object.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/tooltip/valuedecimals/\" target=\"_blank\">Set decimals, prefix and suffix for the value</a>"
                    },
                    {
                        "name": "tooltip--valueSuffix",
                        "fullname": "tooltip.valueSuffix",
                        "title": "valueSuffix",
                        "parent": "tooltip",
                        "isParent": false,
                        "returnType": "String",
                        "since": "2.2",
                        "description": "A string to append to each series' y value. Overridable in each series' tooltip options object.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/tooltip/valuedecimals/\" target=\"_blank\">Set decimals, prefix and suffix for the value</a>"
                    }
                ]
            },
            {
                "title": "Color and border",
                "options": []
            }
        ]
    },
    {
        "id": "exportingCredits",
        "panelTitle": "Exporting/Credits",
        "panes": [
            {
                "title": "Exporting",
                "options": [
                    {
                        "name": "exporting--enabled",
                        "fullname": "exporting.enabled",
                        "title": "enabled",
                        "parent": "exporting",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "true",
                        "since": "2.0",
                        "description": "Whether to enable the exporting module. Disabling the module will hide the context button, but API methods will still be available.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/exporting/enabled-false/\" target=\"_blank\">Exporting module is loaded but disabled</a>",
                        "deprecated": false
                    }
                ]
            },
            {
                "title": "Credits",
                "options": [
                    {
                        "name": "credits--enabled",
                        "fullname": "credits.enabled",
                        "title": "enabled",
                        "parent": "credits",
                        "isParent": false,
                        "returnType": "Boolean",
                        "defaults": "true",
                        "description": "Whether to show the credits text.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/credits/enabled-false/\" target=\"_blank\">Credits disabled</a>"
                    },
                    {
                        "name": "credits--text",
                        "fullname": "credits.text",
                        "title": "text",
                        "parent": "credits",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "Highcharts.com",
                        "description": "The text for the credits label.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/credits/href/\" target=\"_blank\">Custom URL and text</a>"
                    },
                    {
                        "name": "credits--href",
                        "fullname": "credits.href",
                        "title": "href",
                        "parent": "credits",
                        "isParent": false,
                        "returnType": "String",
                        "defaults": "http://www.highcharts.com",
                        "description": "The URL for the credits label.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/credits/href/\" target=\"_blank\">Custom URL and text</a>"
                    }
                ]
            }
        ]
    },
    {
        "id": "series",
        "panelTitle": "Series",
        "panes": [
            {
                "title": "Series configuration",
                "options": [
                    {
                        "name": "series--name",
                        "fullname": "series.name",
                        "title": "name",
                        "parent": "series",
                        "isParent": false,
                        "returnType": "String",
                        "description": "The name of the series as shown in the legend, tooltip etc.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/series/name/\" target=\"_blank\">Series name</a>"
                    },
                    {
                        "name": "series--type",
                        "fullname": "series.type",
                        "title": "type",
                        "parent": "series",
                        "isParent": false,
                        "returnType": "String",
                        "values": "[null, \"line\", \"spline\", \"column\", \"area\", \"areaspline\", \"pie\", \"arearange\", \"areasplinerange\", \"boxplot\", \"bubble\", \"columnrange\", \"errorbar\", \"funnel\", \"gauge\", \"scatter\", \"waterfall\"]",
                        "since": "",
                        "description": "The type of series. Can be one of <code>area</code>, <code>areaspline</code>,\r <code>bar</code>, <code>column</code>, <code>line</code>, <code>pie</code>,\r <code>scatter</code> or <code>spline</code>. From version 2.3, <code>arearange</code>, <code>areasplinerange</code> and <code>columnrange</code> are supported with the highcharts-more.js component.",
                        "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/series/type/\" target=\"_blank\">Line and column in the same chart</a>",
                        "seeAlso": "",
                        "deprecated": false
                    },
                    {
                        "name": "series--index",
                        "fullname": "series.index",
                        "title": "index",
                        "parent": "series",
                        "isParent": false,
                        "returnType": "Number",
                        "since": "2.3.0",
                        "description": "The index of the series in the chart, affecting the internal index in the <code>chart.series</code> array, the visible Z index as well as the order in the legend.",
                        "demo": "",
                        "seeAlso": "",
                        "deprecated": false
                    }
                ],
                "panes": [
                    {
                        "title": "axis",
                        "options": [
                            {
                                "name": "series--xAxis",
                                "fullname": "series.xAxis",
                                "title": "xAxis",
                                "parent": "series",
                                "isParent": false,
                                "returnType": "Number|String",
                                "defaults": "0",
                                "description": "When using dual or multiple x axes, this number defines which xAxis the particular series is connected to. It refers to either the <a href=\"#xAxis.id\">axis id</a> or the index of the axis in the xAxis array, with 0 being the first.",
                                "deprecated": false
                            },
                            {
                                "name": "series--yAxis",
                                "fullname": "series.yAxis",
                                "title": "yAxis",
                                "parent": "series",
                                "isParent": false,
                                "returnType": "Number|String",
                                "defaults": "0",
                                "description": "When using dual or multiple y axes, this number defines which yAxis the particular series is connected to. It refers to either the <a href=\"#yAxis.id\">axis id</a> or the index of the axis in the yAxis array, with 0 being the first.",
                                "demo": "<a href=\"http://jsfiddle.net/gh/get/jquery/1.7.2/highslide-software/highcharts.com/tree/master/samples/highcharts/series/yaxis/\" target=\"_blank\">Apply the column series to the secondary Y axis</a>",
                                "deprecated": false
                            }
                        ]
                    }
                ]
            }
        ]
    }
]
},{}],154:[function(require,module,exports){
var templates = [
    {
        "id": "line",
        "type": "Line charts",
        "icon": "line",
        "templates": [
            {
                "id": "basic",
                "icon": "line_basic",
                "title": "Line chart",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "dataLabels",
                "icon": "line_labels",
                "title": "With data labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values. Data labels by default displays the Y value.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "spline",
                "icon": "spline_basic",
                "title": "Spline",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "spline"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "splineDataLabels",
                "icon": "spline_labels",
                "title": "Spline with labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "spline"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "splineLogarithmic",

                "title": "Logarithmic",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "spline"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "yAxis": [{
                        "type": "logarithmic"
                    }],
                    "plotOptions": {
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "step",
                "icon": "line_step",
                "title": "Step line",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "step": "left"
                        }
                    }
                }
            },
            {
                "id": "stepWithLabels",
                "icon": "line_step_labels",
                "title": "Step line with labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "step": "left",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "inverted",
                "icon": "line_inverted",
                "title": "Inverted",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "negativeColor",
                "icon": "line_negative_color",
                "title": "Negative color",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "negativeColor": "#0088FF"
                        }
                    }
                }
            },
            {
                "id": "errorBar",
                "icon": "line_errorbar",
                "title": "Error bar",
                "desc": "Requires one data column for X values or categories, subsequently one data column for the series' Y values and two columns for the error bar series maximum and minimum.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "series": [
                        {"type": null},
                        {"type": "errorbar"}
                    ]
                }
            }
        ]
    },
    {
        "id": "area",
        "type": "Area charts",
        "icon": "area",
        "templates": [
            {
                "id": "basic",
                "title": "Area Chart",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "withLabels",
                "title": "Area with labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "stacked",
                "title": "Stacked",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "stacking": "normal"
                        }
                    }
                }
            },
            {
                "id": "stackedWithLabels",
                "title": "Stacked with labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "stacking": "normal",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "stackedPercentage",
                "title": "Stacked percentage",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "stacking": "percent"
                        }
                    }
                }
            },
            {
                "id": "inverted",
                "title": "Inverted",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "invertedWithLabels",
                "title": "Inverted with labels",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "stacking": "normal",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "stepLine",
                "title": "Step line",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "step": "left"
                        }
                    }
                }
            },
            {
                "id": "negativeColor",
                "title": "Negative color",
                "desc": "Displays negative values with an alternative color. Colors can be set in plotOptions.series.negativeColor. Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "area"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions": {
                        "series": {
                            "negativeColor": "#0088FF",
                            "color": "#FF000000"
                        }
                    }
                }
            },
            {
                "id": "range",
                "title": "Area range",
                "desc": "Requires one data column for X values or categories, subsequently two data column for each arearange series' Y values.",
                "definition": {
                    "chart": {
                        "type": "arearange"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            }
        ]
    },
    {
        "id": "column",
        "type": "Column charts",
        "icon": "column",
        "templates": [
            {
                "id": "basic",
                "title": "Basic",
                "description": "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "withLabels",
                "title": "With labels",
                "description": "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions":{
                        "series":{
                            "dataLabels":{
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "fixedPlacement",
                "title": "Column with fixed placement",
                "description": "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    chart: {
                        type: 'column'
                    },
                    yAxis: [{
                        min: 0,
                        title: {
                            text: 'Employees'
                        }
                    }, {
                        title: {
                            text: 'Profit (millions)'
                        },
                        opposite: true
                    }],
                    xAxis:[{type:'category'}],
                    tooltip: {
                        shared: true
                    },
                    plotOptions: {
                        column: {
                            grouping: false,
                            shadow: false,
                            borderWidth: 0
                        }
                    },
                    series: [{
                        color: 'rgba(165,170,217,1)',
                        pointPadding: 0.3,
                        pointPlacement: -0.2
                    }, {
                        color: 'rgba(126,86,134,.9)',
                        pointPadding: 0.4,
                        pointPlacement: -0.2
                    }, {
                        color: 'rgba(248,161,63,1)',
                        tooltip: {
                            valuePrefix: '$',
                            valueSuffix: ' M'
                        },
                        pointPadding: 0.3,
                        pointPlacement: 0.2,
                        yAxis: 1
                    }, {
                        color: 'rgba(186,60,61,.9)',
                        tooltip: {
                            valuePrefix: '$',
                            valueSuffix: ' M'
                        },
                        pointPadding: 0.4,
                        pointPlacement: 0.2,
                        yAxis: 1
                    }]
                }
            },
            {
                "id": "3d",
                "title": "Column 3D",
                "description": "Grouped column chart. Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "margin": 75,
                        "options3d": {
                            "enabled": true,
                            "alpha": 15,
                            "beta": 15,
                            "depth": 50,
                            "viewDistance": 15
                        }
                    },
                    "plotOptions": {
                        "column": {
                            "depth": 25
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stacked",
                "title": "Stacked",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "normal"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedWithLabels",
                "title": "Stacked with labels",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "normal",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stacked3d",
                "title": "Stacked 3D",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "margin": 75,
                        "options3d": {
                            "enabled": true,
                            "alpha": 15,
                            "beta": 15,
                            "depth": 50,
                            "viewDistance": 15
                        }
                    },
                    "plotOptions": {
                        "column": {
                            "depth": 25
                        },
                        "series": {
                            "stacking": "normal"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedPercent",
                "title": "Stacked percent",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "percent"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedPercentWithLabels",
                "title": "Stacked percent with labels",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "percent",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "negativeColor",
                "title": "Negative color",
                "desc": "Displays negative values with an alternative color. Colors can be set in plotOptions.series.negativeColor. Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions":{
                        "series":{
                            "negativeColor": "#0088FF",
                            "color": "#FF0000"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "multiColor",
                "title": "Multi color",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions":{
                        "series":{
                            "colorByPoint": true
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "logarithmic",
                "title": "Logarithmic",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "yAxis": [{
                        "type": "logarithmic",
                        "minorTickInterval": "auto"
                    }]
                }
            },
            {
                "id": "range",
                "title": "Columnrange",
                "desc": "Requires one data column for X values or categories, subsequently two data columns for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "columnrange"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "rangeWithLabels",
                "title": "Columnrange with labels",
                "desc": "Requires one data column for X values or categories, subsequently two data columns for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "columnrange"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions":{
                        "series":{
                            "dataLabels":{
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "packed",
                "title": "Packed Columns",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "plotOptions": {
                        "series": {
                            "pointPadding": 0,
                            "groupPadding": 0,
                            "borderWidth": 0,
                            "shadow": false
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "errorbar",
                "title": "Error bar",
                "desc": "Requires one data column for X values or categories, subsequently one data column for the series' Y values. and two columns for the error bar series maximum and minimum.",
                "definition": {
                    "chart": {
                        "type": "column"
                    },
                    "series": [
                        {"type": null},
                        {
                            "type": "errorbar",
                            "showInLegend": true
                        }
                    ],
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            }
        ]
    },
    {
        "id": "bar",
        "type": "Bar charts",
        "icon": "bar",
        "templates": [
            {
                "id": "basic",
                "title": "Basic bar",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "barWithNegativeStack",
                "title": "Bar with negative stack",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    chart: {
                        type: 'bar'
                    },
                    xAxis: [{
                        reversed: false,
                        labels: {
                            step: 1
                        }
                    }, { // mirror axis on right side
                        opposite: true,
                        reversed: false,
                        linkedTo: 0,
                        labels: {
                            step: 1
                        }
                    }],
                    yAxis: [{
                        title: {
                            text: null
                        },
                        labels: {
                            formatter: function () {
                                return Math.abs(this.value) + '%';
                            }
                        }
                    }],
                    plotOptions: {
                        series: {
                            stacking: 'normal'
                        }
                    },
                    tooltip: {
                        formatter: function () {
                            return '<b>' + this.series.name + ', age ' + this.point.category + '</b><br/>' +
                                'Population: ' + Highcharts.numberFormat(Math.abs(this.point.y), 0);
                        }
                    }
                }
            },
            {
                "id": "basicWithLabels",
                "title": "Basic with labels",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "plotOptions":{
                        "series":{
                            "dataLabels":{
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "stacked",
                "title": "Stacked bar",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "normal"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedWithLabels",
                "title": "Stacked with labels",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "normal",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedPercentage",
                "title": "Stacked percentage bar",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "percent"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "stackedPercentageWithLabels",
                "title": "Stacked percentage bar with labels",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "stacking": "percent",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "negativeColor",
                "title": "Negative color",
                "description": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions":{
                        "series":{
                            "negativeColor": "#0088FF",
                            "color": "#FF0000"
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "multiColor",
                "title": "Multi color",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "colorByPoint": true
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "horizontalColumnrange",
                "title": "Horizontal columnrange",
                "desc": "Requires one data column for X values or categories, subsequently two data columns for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "columnrange",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "logarithmic",
                "title": "Logarithmic",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "yAxis": [{
                        "type": "logarithmic",
                        "minorTickInterval": "auto"
                    }],
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "horizontalColumnrangeWithLabels",
                "title": "Horizontal columnrange with labels",
                "desc": "Requires one data column for X values or categories, subsequently two data columns for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "columnrange",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "packedBars",
                "title": "Packed Bars",
                "desc": "Requires one data column for X values or categories, subsequently one data column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "plotOptions": {
                        "series": {
                            "pointPadding": 0,
                            "groupPadding": 0,
                            "borderWidth": 0,
                            "shadow": false
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "errorbar",
                "title": "Error bar",
                "desc": "Requires one data column for X values or categories, subsequently one data column for the series' Y values. and two columns for the error bar series maximum and minimum.",
                "definition": {
                    "chart": {
                        "type": "column",
                        "inverted": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "series": [
                        {"type": null},
                        {"type": "errorbar"}
                    ]
                }
            }
        ]
    },
    {
        "id": "scatterAndBubble",
        "type": "Scatter and bubble",
        "icon": "spider",
        "templates": [
            {
                "id": "scatter",
                "title": "Scatter chart",
                "description": "Requires one data column for X values and one for Y values.",
                "definition": {
                    "chart": {
                        "type": "scatter"
                    }
                }
            },
            {
                "id": "bubble",
                "title": "Bubble chart",
                "description": "Requires three data columns: one for X values, one for Y values and one for the size of the bubble (Z value).",
                "definition": {
                    "chart": {
                        "type": "bubble"
                    }
                }
            }
        ]
    },
    {
        "id": "pie",
        "type": "Pie charts",
        "icon": "spider",
        "templates": [
            {
                "id": "basic",
                "title": "Pie chart",
                "description": "Requires two data columns: one for slice names (shown in data labels) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie"
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "3d",
                "title": "3D pie chart",
                "description": "Requires two data columns: one for slice names (shown in data labels) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie",
                        "options3d": {
                            "enabled": true,
                            "alpha": 45,
                            "beta": 0
                        }
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "depth": 35,
                            "cursor": "pointer"
                        },
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "withLegend",
                "title": "Pie chart",
                "description": "Requires two data columns: one for slice names (shown in legend) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie"
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "cursor": true,
                            "showInLegend": true,
                            "dataLabels": {
                                "enabled": false
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "3dWithLegend",
                "title": "3D pie with legend",
                "description": "Requires two data columns: one for slice names (shown in legend) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie",
                        "options3d": {
                            "enabled": true,
                            "alpha": 45,
                            "beta": 0
                        }
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "depth": 35,
                            "cursor": "pointer",
                            "showInLegend": true,
                            "dataLabels": {
                                "enabled": false
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "donut",
                "title": "Donut",
                "description": "Requires two data columns: one for slice names (shown in data labels) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie"
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "cursor": true,
                            "innerSize": "60%",
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "donutWithLegend",
                "title": "Donut with legend",
                "description": "Requires two data columns: one for slice names (shown in legend) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie"
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "cursor": true,
                            "showInLegend": true,
                            "innerSize": "60%",
                            "dataLabels": {
                                "enabled": false
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "3dDonut",
                "title": "3D donut chart",
                "description": "Requires two data columns: one for slice names (shown in data labels) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie",
                        "options3d": {
                            "enabled": true,
                            "alpha": 45,
                            "beta": 0
                        }
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "depth": 35,
                            "innerSize": "60%",
                            "cursor": "pointer"
                        },
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    }
                }
            },
            {
                "id": "3dDonutWithLegend",
                "title": "3D donut chart with legend",
                "description": "Requires two data columns: one for slice names (shown in legend) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie",
                        "options3d": {
                            "enabled": true,
                            "alpha": 45,
                            "beta": 0
                        }
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": true,
                            "depth": 35,
                            "cursor": "pointer",
                            "showInLegend": true,
                            "innerSize": "60%"
                        },
                        "series": {
                            "dataLabels": {
                                "enabled": false
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "semiCircleDonut",
                "title": "Semi circle donut",
                "description": "Requires two data columns: one for slice names (shown in data labels) and one for their values.",
                "definition": {
                    "chart": {
                        "type": "pie"
                    },
                    "plotOptions": {
                        "pie": {
                            "allowPointSelect": false,
                            "dataLabels": {
                                "distance": -30,
                                "style": {
                                    "fontWeight": "bold",
                                    "color": "white",
                                    "textShadow": "0px 1px 2px black"
                                }
                            },
                            "innerSize": "50%",
                            "startAngle": -90,
                            "endAngle": 90,
                            "center": ["50%", "75%"]
                        },
                        "series": {
                            "dataLabels": {
                                "enabled": true
                            }
                        }
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            }
        ]
    },
    {
        "id": "polar",
        "type": "Polar charts",
        "icon": "bar",
        "templates": [
            {
                "id": "line",
                "title": "Polar line",
                "description": "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out).",
                "definition": {
                    "chart": {
                        "type": "line",
                        "polar": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "spider",
                "title": "Spider line",
                "description": "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out).",
                "definition": {
                    "chart": {
                        "type": "line",
                        "polar": true
                    },
                    "xAxis": [{
                        "type": "category",
                        "tickmarkPlacement": "on",
                        "lineWidth": 0
                    }],
                    "yAxis": [{
                        "lineWidth": 0,
                        "gridLineInterpolation": "polygon"
                    }]
                }
            },
            {
                "id": "area",
                "title": "Polar area",
                "description": "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out).",
                "definition": {
                    "chart": {
                        "type": "area",
                        "polar": true
                    },
                    "xAxis": [{
                        "type": "category"
                    }]
                }
            },
            {
                "id": "spiderArea",
                "title": "Spider area",
                "description": "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out).",
                "definition": {
                    "chart": {
                        "type": "area",
                        "polar": true
                    },
                    "xAxis": [{
                        "type": "category",
                        "tickmarkPlacement": "on",
                        "lineWidth": 0
                    }],
                    "yAxis": [{
                        "lineWidth": 0,
                        "gridLineInterpolation": "polygon"
                    }]
                }
            },
            {
                "id": "appleWatchIsh",
                "title": "Activity Gauge",
                "description": "",
                "definition": {
                    chart: {
                        type: 'solidgauge',
                        marginTop: 50
                    },
                    tooltip: {
                        borderWidth: 0,
                        backgroundColor: 'none',
                        shadow: false,
                        style: {
                            fontSize: '16px'
                        },
                        positioner: function (labelWidth, labelHeight) {
                            return {
                                x: 200 - labelWidth / 2,
                                y: 180
                            };
                        },
                        pointFormat: '{series.name}<br><span style="font-size:2em; color: {point.color}; font-weight: bold">{point.y}%</span>'
                    },

                    pane: {
                        startAngle: 0,
                        endAngle: 360,
                        background: [{ // Track for Move
                            outerRadius: '112%',
                            innerRadius: '88%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }, { // Track for Exercise
                            outerRadius: '87%',
                            innerRadius: '63%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[1]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }, { // Track for Stand
                            outerRadius: '62%',
                            innerRadius: '38%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[2]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }]
                    },

                    yAxis: [{
                        min: 0,
                        max: 100,
                        lineWidth: 0,
                        tickPositions: []
                    }],

                    plotOptions: {
                        solidgauge: {
                            borderWidth: '34px',
                            dataLabels: {
                                enabled: false
                            },
                            linecap: 'round',
                            stickyTracking: false
                        }
                    },

                    series: [{
                        borderColor: Highcharts.getOptions().colors[0],
                        data: {
                            color: Highcharts.getOptions().colors[0],
                            radius: '100%',
                            innerRadius: '100%'

                        }
                    }, {

                        borderColor: Highcharts.getOptions().colors[1],
                        data: {
                            color: Highcharts.getOptions().colors[1],
                            radius: '75%',
                            innerRadius: '75%'
                        }
                    }, {
                        borderColor: Highcharts.getOptions().colors[2],
                        data: {
                            color: Highcharts.getOptions().colors[2],
                            radius: '50%',
                            innerRadius: '50%'
                        }
                    }]

                }
            },
            {
                "id": "appleWatch",
                "title": "Activity Gauge (Apple Watch)",
                "description": "",
                "definition": {
                    chart: {
                        type: 'solidgauge',
                        marginTop: 50,
                        backgroundColor: 'black',
                        width:400,
                        events:{
                            load: function(){
                                this.renderer.path(['M', -8, 0, 'L', 8, 0, 'M', 0, -8, 'L', 8, 0, 0, 8])
                                    .attr({
                                        'stroke': '#303030',
                                        'stroke-linecap': 'round',
                                        'stroke-linejoin': 'round',
                                        'stroke-width': 2,
                                        'zIndex': 10
                                    })
                                    .translate(190, 26)
                                    .add(this.series[2].group);

                                // Exercise icon
                                this.renderer.path(['M', -8, 0, 'L', 8, 0, 'M', 0, -8, 'L', 8, 0, 0, 8, 'M', 8, -8, 'L', 16, 0, 8, 8])
                                    .attr({
                                        'stroke': '#303030',
                                        'stroke-linecap': 'round',
                                        'stroke-linejoin': 'round',
                                        'stroke-width': 2,
                                        'zIndex': 10
                                    })
                                    .translate(190, 61)
                                    .add(this.series[2].group);

                                // Stand icon
                                this.renderer.path(['M', 0, 8, 'L', 0, -8, 'M', -8, 0, 'L', 0, -8, 8, 0])
                                    .attr({
                                        'stroke': '#303030',
                                        'stroke-linecap': 'round',
                                        'stroke-linejoin': 'round',
                                        'stroke-width': 2,
                                        'zIndex': 10
                                    })
                                    .translate(190, 96)
                                    .add(this.series[2].group);
                            }
                        }
                    },
                    //colors: ['#F62366', '#9DFF02', '#0CCDD6'],

                    title: {
                        text: 'Activity',
                        style: {
                            fontSize: '24px',
                            color: 'silver'
                        }
                    },

                    tooltip: {
                        borderWidth: 0,
                        backgroundColor: 'none',
                        shadow: false,
                        style: {
                            fontSize: '16px',
                            color: 'silver'
                        },
                        positioner: function (labelWidth, labelHeight) {
                            return {
                                x: 200 - labelWidth / 2,
                                y: 180
                            };
                        },
                        pointFormat: '{series.name}<br><span style="font-size:2em; color: {point.color}; font-weight: bold">{point.y}%</span>'
                    },

                    pane: {
                        startAngle: 0,
                        endAngle: 360,
                        background: [{ // Track for Move
                            outerRadius: '112%',
                            innerRadius: '88%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[0]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }, { // Track for Exercise
                            outerRadius: '87%',
                            innerRadius: '63%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[1]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }, { // Track for Stand
                            outerRadius: '62%',
                            innerRadius: '38%',
                            backgroundColor: Highcharts.Color(Highcharts.getOptions().colors[2]).setOpacity(0.3).get(),
                            borderWidth: 0
                        }]
                    },

                    yAxis: [{
                        min: 0,
                        max: 100,
                        lineWidth: 0,
                        tickPositions: []
                    }],

                    plotOptions: {
                        solidgauge: {
                            borderWidth: '34px',
                            dataLabels: {
                                enabled: false
                            },
                            linecap: 'round',
                            stickyTracking: false
                        }
                    },

                    series: [{
                        borderColor: Highcharts.getOptions().colors[0],
                        data: {
                            color: Highcharts.getOptions().colors[0],
                            radius: '100%',
                            innerRadius: '100%'

                        }
                    }, {

                        borderColor: Highcharts.getOptions().colors[1],
                        data: {
                            color: Highcharts.getOptions().colors[1],
                            radius: '75%',
                            innerRadius: '75%'
                        }
                    }, {
                        borderColor: Highcharts.getOptions().colors[2],
                        data: {
                            color: Highcharts.getOptions().colors[2],
                            radius: '50%',
                            innerRadius: '50%'
                        }
                    }]

                }
            }
        ]
    },
    {
        "id": "combinationCharts",
        "type": "combination charts",
        "icon": "line",
        "templates": [
            {
                "id": "multipleAxes",
                "title": "Multiple axes",
                "description": "Requires one column for X values or categories (labels around the perimeter), subsequently one column for each series' Y values (plotted from center and out).",
                "definition": {
                    chart: {
                        zoomType: 'xy'
                    },
                    title: {
                        text: 'Average Monthly Weather Data for Tokyo'
                    },
                    subtitle: {
                        text: 'Source: WorldClimate.com'
                    },
                    xAxis: [{
                        type: 'category',
                        crosshair: true
                    }],
                    yAxis: [{ // Primary yAxis
                        labels: {
                            format: '{value}°C',
                            style: {
                                color: Highcharts.getOptions().colors[2]
                            }
                        },
                        title: {
                            text: 'Temperature',
                            style: {
                                color: Highcharts.getOptions().colors[2]
                            }
                        },
                        opposite: true

                    }, { // Secondary yAxis
                        gridLineWidth: 0,
                        title: {
                            text: 'Rainfall',
                            style: {
                                color: Highcharts.getOptions().colors[0]
                            }
                        },
                        labels: {
                            format: '{value} mm',
                            style: {
                                color: Highcharts.getOptions().colors[0]
                            }
                        }

                    }, { // Tertiary yAxis
                        gridLineWidth: 0,
                        title: {
                            text: 'Sea-Level Pressure',
                            style: {
                                color: Highcharts.getOptions().colors[1]
                            }
                        },
                        labels: {
                            format: '{value} mb',
                            style: {
                                color: Highcharts.getOptions().colors[1]
                            }
                        },
                        opposite: true
                    }],
                    tooltip: {
                        shared: true
                    },
                    legend: {
                        layout: 'vertical',
                        align: 'left',
                        x: 80,
                        verticalAlign: 'top',
                        y: 55,
                        floating: true,
                        backgroundColor: (Highcharts.theme && Highcharts.theme.legendBackgroundColor) || '#FFFFFF'
                    },
                    series: [{
                        type: 'column',
                        yAxis: 1,
                        tooltip: {
                            valueSuffix: ' mm'
                        }

                    }, {
                        type: 'spline',
                        yAxis: 2,
                        marker: {
                            enabled: false
                        },
                        dashStyle: 'shortdot',
                        tooltip: {
                            valueSuffix: ' mb'
                        }

                    }, {
                        type: 'spline',
                        tooltip: {
                            valueSuffix: ' °C'
                        }
                    }]
                }
            },
            {
                "id": "scatterWithLine",
                "title": "Scatter with line",
                "description": "Requires one data column for X values and one for Y values.",
                "definition": {
                    "chart": {
                        "type": "scatter"
                    },
                    "plotOptions":{
                        "series":{
                            "lineWidth": 1
                        }
                    }
                }
            },
            {
                "id": "scatterWithLineNoMarker",
                "title": "Scatter with line, no marker",
                "description": "Requires one data column for X values and one for Y values.",
                "definition": {
                    "chart": {
                        "type": "scatter"
                    },
                    "plotOptions":{
                        "series":{
                            "lineWidth": 1,
                            "marker":{
                                "enabled": false
                            }
                        }
                    }
                }
            },
            {
                "id": "combinationColumn",
                "title": "Combination chart",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    "chart": {
                        "type": "line"
                    },
                    "xAxis": [{
                        "type": "category"
                    }],
                    "series": [
                        {"type": null},
                        {"type": "column"}
                    ]
                }
            },
            // todo
            {
                "id": "colSplinePie",
                "title": "Combination chart (col, spline, pie)",
                "desc": "Requires one column for X values or categories, subsequently one column for each series' Y values.",
                "definition": {
                    title: {
                        text: 'Combination chart'
                    },
                    xAxis: {
                        type: 'category'
                    },
                    labels: {
                        items: [{
                            html: 'Total fruit consumption',
                            style: {
                                left: '50px',
                                top: '18px',
                                color: (Highcharts.theme && Highcharts.theme.textColor) || 'black'
                            }
                        }]
                    },
                    series: [{
                        type: 'column',
                        name: 'Jane'
                    }, {
                        type: 'column',
                        name: 'John'
                    }, {
                        type: 'column',
                        name: 'Joe'
                    }, {
                        type: 'spline',
                        name: 'Average',
                        marker: {
                            lineWidth: 2,
                            lineColor: Highcharts.getOptions().colors[3],
                            fillColor: 'white'
                        }
                    }, {
                        type: 'pie',
                        //name: 'Total consumption',
                        /*data: [{
                            name: 'Jane',
                            color: Highcharts.getOptions().colors[0] // Jane's color
                        }, {
                            name: 'John',
                            color: Highcharts.getOptions().colors[1] // John's color
                        }, {
                            name: 'Joe',
                            color: Highcharts.getOptions().colors[2] // Joe's color
                        }],*/
                        center: [100, 80],
                        size: 100,
                        showInLegend: false,
                        dataLabels: {
                            enabled: false
                        }
                    }]
                }
            }
        ]
    }
];
module.exports = templates;
},{}],155:[function(require,module,exports){
(function () {
    var includeFolder = undefined,
        icons = (function(){var self={},fs = require("fs");
self["area"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-366,419h-90.5c-0.8,0-1.5-0.7-1.5-1.5V327c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-365.2,419-366,419z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-402,382c-0.3,0-0.5-0.1-0.7-0.3l-30.3-30.3l-22.3,22.3c-0.4,0.4-1,0.4-1.4,0s-0.4-1,0-1.4l23-23c0.4-0.4,1-0.4,1.4,0\r\n\t\t\tl31,31c0.4,0.4,0.4,1,0,1.4C-401.5,381.9-401.7,382-402,382z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-372,418c-0.6,0-1-0.4-1-1v-65.5l-37.3,40.1c-0.2,0.2-0.4,0.3-0.7,0.3c-0.3,0-0.5-0.1-0.7-0.3l-21.3-21.3l-22.3,22.3\r\n\t\t\tc-0.4,0.4-1,0.4-1.4,0s-0.4-1,0-1.4l23-23c0.4-0.4,1-0.4,1.4,0l21.3,21.3l38.3-41.2c0.3-0.3,0.7-0.4,1.1-0.2\r\n\t\t\tc0.4,0.1,0.6,0.5,0.6,0.9v68C-371,417.6-371.4,418-372,418z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["bar"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-366,419h-90.5c-0.8,0-1.5-0.7-1.5-1.5V327c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-365.2,419-366,419z\"/>\r\n\t</g>\r\n\t<path d=\"M-421,365v16h-34v-16H-421 M-421,363h-34c-1.1,0-2,0.9-2,2v16c0,1.1,0.9,2,2,2h34c1.1,0,2-0.9,2-2v-16\r\n\t\tC-419,363.9-419.9,363-421,363L-421,363z\"/>\r\n\t<path d=\"M-401,340v17h-54v-17H-401 M-401,338h-54c-1.1,0-2,0.9-2,2v17c0,1.1,0.9,2,2,2h54c1.1,0,2-0.9,2-2v-17\r\n\t\tC-399,338.9-399.9,338-401,338L-401,338z\"/>\r\n\t<path d=\"M-381,389v17h-74v-17H-381 M-381,387h-74c-1.1,0-2,0.9-2,2v17c0,1.1,0.9,2,2,2h74c1.1,0,2-0.9,2-2v-17\r\n\t\tC-379,387.9-379.9,387-381,387L-381,387z\"/>\r\n</g>\r\n</svg>\r\n";
self["bubble"] = "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1.1\" x=\"0px\" y=\"0px\" viewBox=\"0 0 100 125\" enable-background=\"new 0 0 100 100\" xml:space=\"preserve\"><g><g><path d=\"M95,97H4.5C3.671,97,3,96.328,3,95.5V5c0-0.829,0.671-1.5,1.5-1.5S6,4.171,6,5v89h89c0.828,0,1.5,0.672,1.5,1.5    S95.828,97,95,97z\"/></g><g><path d=\"M50.5,63.5C42.505,63.5,36,56.995,36,49s6.505-14.5,14.5-14.5S65,41.005,65,49S58.495,63.5,50.5,63.5z M50.5,36.5    C43.607,36.5,38,42.107,38,49s5.607,12.5,12.5,12.5S63,55.893,63,49S57.393,36.5,50.5,36.5z\"/></g><g><path d=\"M23.5,71.5c-4.687,0-8.5-3.813-8.5-8.5s3.813-8.5,8.5-8.5S32,58.313,32,63S28.187,71.5,23.5,71.5z M23.5,56.5    c-3.584,0-6.5,2.916-6.5,6.5s2.916,6.5,6.5,6.5S30,66.584,30,63S27.084,56.5,23.5,56.5z\"/></g><g><path d=\"M76.5,58.5c-4.687,0-8.5-3.813-8.5-8.5c0-4.687,3.813-8.5,8.5-8.5S85,45.313,85,50C85,54.687,81.187,58.5,76.5,58.5z     M76.5,43.5c-3.584,0-6.5,2.916-6.5,6.5s2.916,6.5,6.5,6.5S83,53.584,83,50S80.084,43.5,76.5,43.5z\"/></g><g><path d=\"M51.5,31.5c-4.687,0-8.5-3.813-8.5-8.5s3.813-8.5,8.5-8.5c4.687,0,8.5,3.813,8.5,8.5S56.187,31.5,51.5,31.5z M51.5,16.5    c-3.584,0-6.5,2.916-6.5,6.5s2.916,6.5,6.5,6.5S58,26.584,58,23S55.084,16.5,51.5,16.5z\"/></g></g><text x=\"0\" y=\"115\" fill=\"#000000\" font-size=\"5px\" font-weight=\"bold\" font-family=\"'Helvetica Neue', Helvetica, Arial-Unicode, Arial, Sans-serif\">Created by Agus Purwanto</text><text x=\"0\" y=\"120\" fill=\"#000000\" font-size=\"5px\" font-weight=\"bold\" font-family=\"'Helvetica Neue', Helvetica, Arial-Unicode, Arial, Sans-serif\">from the Noun Project</text></svg>";
self["chart"] = "<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\"><svg xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1.1\" style=\"font-family:'lucida grande', 'lucida sans unicode', arial, helvetica, sans-serif;font-size:12px;\" xmlns=\"http://www.w3.org/2000/svg\" width=\"600\" height=\"400\"><desc>Created with Highcharts 4.1.9</desc><defs><clipPath id=\"highcharts-10\"><rect x=\"0\" y=\"0\" width=\"273\" height=\"497\"></rect></clipPath></defs><rect x=\"0\" y=\"0\" width=\"600\" height=\"400\" strokeWidth=\"0\" fill=\"#FFFFFF\" class=\" highcharts-background\"></rect><g class=\"highcharts-grid\" ></g><g class=\"highcharts-grid\" ><path fill=\"none\" d=\"M 92.5 42 L 92.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 142.5 42 L 142.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 191.5 42 L 191.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 241.5 42 L 241.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 291.5 42 L 291.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 341.5 42 L 341.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 390.5 42 L 390.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 440.5 42 L 440.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 490.5 42 L 490.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 539.5 42 L 539.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path><path fill=\"none\" d=\"M 590.5 42 L 590.5 315\" stroke=\"#D8D8D8\" stroke-width=\"1\"  opacity=\"1\"></path></g><g class=\"highcharts-axis\" ><path fill=\"none\" d=\"M 93 97.5 L 83 97.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 93 151.5 L 83 151.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 93 206.5 L 83 206.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 93 260.5 L 83 260.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 93 315.5 L 83 315.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 93 41.5 L 83 41.5\" stroke=\"#C0D0E0\" stroke-width=\"1\" opacity=\"1\"></path><path fill=\"none\" d=\"M 92.5 42 L 92.5 315\" stroke=\"#C0D0E0\" stroke-width=\"1\"  visibility=\"visible\"></path></g><g class=\"highcharts-axis\" ><text x=\"341.5\"  text-anchor=\"middle\" transform=\"translate(0,0)\" class=\" highcharts-yaxis-title\" style=\"color:#707070;fill:#707070;\" visibility=\"visible\" y=\"350\">Values</text></g><g class=\"highcharts-series-group\" ><g class=\"highcharts-series highcharts-series-0\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"url(#highcharts-10)\"><rect x=\"218\" y=\"399\" width=\"19\" height=\"99\" fill=\"#7cb5ec\" rx=\"0\" ry=\"0\"></rect><rect x=\"164\" y=\"399\" width=\"18\" height=\"99\" fill=\"#7cb5ec\" rx=\"0\" ry=\"0\"></rect><rect x=\"109\" y=\"399\" width=\"18\" height=\"99\" fill=\"#7cb5ec\" rx=\"0\" ry=\"0\"></rect><rect x=\"55\" y=\"399\" width=\"18\" height=\"99\" fill=\"#7cb5ec\" rx=\"0\" ry=\"0\"></rect><rect x=\"0\" y=\"399\" width=\"18\" height=\"99\" fill=\"#7cb5ec\" rx=\"0\" ry=\"0\"></rect></g><g class=\"highcharts-markers highcharts-series-0\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"none\"></g><g class=\"highcharts-series highcharts-series-1\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"url(#highcharts-10)\"><rect x=\"237\" y=\"158\" width=\"18\" height=\"340\" fill=\"#434348\" rx=\"0\" ry=\"0\"></rect><rect x=\"182\" y=\"230\" width=\"18\" height=\"268\" fill=\"#434348\" rx=\"0\" ry=\"0\"></rect><rect x=\"127\" y=\"216\" width=\"19\" height=\"282\" fill=\"#434348\" rx=\"0\" ry=\"0\"></rect><rect x=\"73\" y=\"92\" width=\"18\" height=\"406\" fill=\"#434348\" rx=\"0\" ry=\"0\"></rect><rect x=\"18\" y=\"122\" width=\"18\" height=\"376\" fill=\"#434348\" rx=\"0\" ry=\"0\"></rect></g><g class=\"highcharts-markers highcharts-series-1\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"none\"></g><g class=\"highcharts-series highcharts-series-2\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"url(#highcharts-10)\"><rect x=\"255\" y=\"142\" width=\"18\" height=\"356\" fill=\"#90ed7d\" rx=\"0\" ry=\"0\"></rect><rect x=\"200\" y=\"214\" width=\"18\" height=\"284\" fill=\"#90ed7d\" rx=\"0\" ry=\"0\"></rect><rect x=\"146\" y=\"202\" width=\"18\" height=\"296\" fill=\"#90ed7d\" rx=\"0\" ry=\"0\"></rect><rect x=\"91\" y=\"61\" width=\"18\" height=\"437\" fill=\"#90ed7d\" rx=\"0\" ry=\"0\"></rect><rect x=\"36\" y=\"102\" width=\"19\" height=\"396\" fill=\"#90ed7d\" rx=\"0\" ry=\"0\"></rect></g><g class=\"highcharts-markers highcharts-series-2\" visibility=\"visible\"  transform=\"translate(590,315) rotate(90) scale(-1,1) scale(1 1)\" width=\"497\" height=\"273\" clip-path=\"none\"></g></g><text x=\"300\" text-anchor=\"middle\" class=\"highcharts-title\"  style=\"color:#333333;font-size:18px;fill:#333333;width:536px;\" y=\"24\"><tspan>Chart title</tspan></text><g class=\"highcharts-legend\"  transform=\"translate(180,362)\"><g ><g><g class=\"highcharts-legend-item\"  transform=\"translate(8,3)\"><text x=\"21\" style=\"color:#333333;font-size:12px;font-weight:bold;cursor:pointer;fill:#333333;\" text-anchor=\"start\"  y=\"15\">test</text><rect x=\"0\" y=\"4\" width=\"16\" height=\"12\"  fill=\"#7cb5ec\"></rect></g><g class=\"highcharts-legend-item\"  transform=\"translate(71,3)\"><text x=\"21\" y=\"15\" style=\"color:#333333;font-size:12px;font-weight:bold;cursor:pointer;fill:#333333;\" text-anchor=\"start\" >lowpoint</text><rect x=\"0\" y=\"4\" width=\"16\" height=\"12\"  fill=\"#434348\"></rect></g><g class=\"highcharts-legend-item\"  transform=\"translate(159,3)\"><text x=\"21\" y=\"15\" style=\"color:#333333;font-size:12px;font-weight:bold;cursor:pointer;fill:#333333;\" text-anchor=\"start\" >highpoint</text><rect x=\"0\" y=\"4\" width=\"16\" height=\"12\"  fill=\"#90ed7d\"></rect></g></g></g></g><g class=\"highcharts-axis-labels highcharts-xaxis-labels\" ><text x=\"78\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;width:188px;text-overflow:clip;\" text-anchor=\"end\" transform=\"translate(0,0)\" y=\"75\" opacity=\"1\"><tspan>experiment 6</tspan></text><text x=\"78\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;width:188px;text-overflow:clip;\" text-anchor=\"end\" transform=\"translate(0,0)\" y=\"130\" opacity=\"1\"><tspan>experiment 7</tspan></text><text x=\"78\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;width:188px;text-overflow:clip;\" text-anchor=\"end\" transform=\"translate(0,0)\" y=\"185\" opacity=\"1\"><tspan>experiment 8</tspan></text><text x=\"78\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;width:188px;text-overflow:clip;\" text-anchor=\"end\" transform=\"translate(0,0)\" y=\"239\" opacity=\"1\"><tspan>experiment 9</tspan></text><text x=\"78\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;width:188px;text-overflow:clip;\" text-anchor=\"end\" transform=\"translate(0,0)\" y=\"294\" opacity=\"1\"><tspan>experiment 10</tspan></text></g><g class=\"highcharts-axis-labels highcharts-yaxis-labels\" ><text x=\"93\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">0</text><text x=\"142.7\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">25</text><text x=\"192.4\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">50</text><text x=\"242.1\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">75</text><text x=\"291.8\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">100</text><text x=\"341.5\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">125</text><text x=\"391.2\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">150</text><text x=\"440.9\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">175</text><text x=\"490.6\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">200</text><text x=\"540.3\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">225</text><text x=\"581\" style=\"color:#606060;cursor:default;font-size:11px;fill:#606060;\" text-anchor=\"middle\" transform=\"translate(0,0)\" y=\"334\" opacity=\"1\">250</text></g><g class=\"highcharts-tooltip\"  style=\"cursor:default;padding:0;pointer-events:none;white-space:nowrap;\" transform=\"translate(0,-9999)\"><path fill=\"none\" d=\"M 3.5 0.5 L 13.5 0.5 C 16.5 0.5 16.5 0.5 16.5 3.5 L 16.5 13.5 C 16.5 16.5 16.5 16.5 13.5 16.5 L 3.5 16.5 C 0.5 16.5 0.5 16.5 0.5 13.5 L 0.5 3.5 C 0.5 0.5 0.5 0.5 3.5 0.5\"  stroke=\"black\" stroke-opacity=\"0.049999999999999996\" stroke-width=\"5\" transform=\"translate(1, 1)\"></path><path fill=\"none\" d=\"M 3.5 0.5 L 13.5 0.5 C 16.5 0.5 16.5 0.5 16.5 3.5 L 16.5 13.5 C 16.5 16.5 16.5 16.5 13.5 16.5 L 3.5 16.5 C 0.5 16.5 0.5 16.5 0.5 13.5 L 0.5 3.5 C 0.5 0.5 0.5 0.5 3.5 0.5\"  stroke=\"black\" stroke-opacity=\"0.09999999999999999\" stroke-width=\"3\" transform=\"translate(1, 1)\"></path><path fill=\"none\" d=\"M 3.5 0.5 L 13.5 0.5 C 16.5 0.5 16.5 0.5 16.5 3.5 L 16.5 13.5 C 16.5 16.5 16.5 16.5 13.5 16.5 L 3.5 16.5 C 0.5 16.5 0.5 16.5 0.5 13.5 L 0.5 3.5 C 0.5 0.5 0.5 0.5 3.5 0.5\"  stroke=\"black\" stroke-opacity=\"0.15\" stroke-width=\"1\" transform=\"translate(1, 1)\"></path><path fill=\"rgb(249, 249, 249)\" fill-opacity=\" .85\" d=\"M 3.5 0.5 L 13.5 0.5 C 16.5 0.5 16.5 0.5 16.5 3.5 L 16.5 13.5 C 16.5 16.5 16.5 16.5 13.5 16.5 L 3.5 16.5 C 0.5 16.5 0.5 16.5 0.5 13.5 L 0.5 3.5 C 0.5 0.5 0.5 0.5 3.5 0.5\"></path><text x=\"8\"  style=\"font-size:12px;color:#333333;fill:#333333;\" y=\"20\"></text></g><text x=\"590\" text-anchor=\"end\"  style=\"cursor:pointer;color:#909090;font-size:9px;fill:#909090;\" y=\"395\">Highcharts.com</text></svg>";
self["columnStackedPercent"] = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<!-- Generator: Adobe Illustrator 19.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\r\n<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-545 791.8 100 100\" style=\"enable-background:new -545 791.8 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-453,891.8h-90.5c-0.8,0-1.5-0.7-1.5-1.5v-90.5c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-452.2,891.8-453,891.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-490,844.8v44h-16v-44H-490 M-490,842.8h-16c-1.1,0-2,0.9-2,2v44c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2v-44\r\n\t\t\tC-488,843.7-488.9,842.8-490,842.8L-490,842.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-490,818.8v24h-16v-24H-490 M-490,816.8h-16c-1.1,0-2,0.9-2,2v24c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2v-24\r\n\t\t\tC-488,817.7-488.9,816.8-490,816.8L-490,816.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-514,854.8v34h-17v-34H-514 M-514,852.8h-17c-1.1,0-2,0.9-2,2v34c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-34\r\n\t\t\tC-512,853.7-512.9,852.8-514,852.8L-514,852.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-514,818.8v34h-17v-34H-514 M-514,816.8h-17c-1.1,0-2,0.9-2,2v34c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-34\r\n\t\t\tC-512,817.7-512.9,816.8-514,816.8L-514,816.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-465,864.8v24h-17v-24H-465 M-465,862.8h-17c-1.1,0-2,0.9-2,2v24c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-24\r\n\t\t\tC-463,863.7-463.9,862.8-465,862.8L-465,862.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-465,818.8v44h-17v-44H-465 M-465,816.8h-17c-1.1,0-2,0.9-2,2v44c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-44\r\n\t\t\tC-463,817.7-463.9,816.8-465,816.8L-465,816.8z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["columnStacked"] = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<!-- Generator: Adobe Illustrator 19.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\r\n<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-545 791.8 100 100\" style=\"enable-background:new -545 791.8 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-453,891.8h-90.5c-0.8,0-1.5-0.7-1.5-1.5v-90.5c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-452.2,891.8-453,891.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-490,854.8v34h-16v-34H-490 M-490,852.8h-16c-1.1,0-2,0.9-2,2v34c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2v-34\r\n\t\t\tC-488,853.7-488.9,852.8-490,852.8L-490,852.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-490,838.8v14h-16v-14H-490 M-490,836.8h-16c-1.1,0-2,0.9-2,2v14c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2v-14\r\n\t\t\tC-488,837.7-488.9,836.8-490,836.8L-490,836.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-514,864.8v24h-17v-24H-514 M-514,862.8h-17c-1.1,0-2,0.9-2,2v24c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-24\r\n\t\t\tC-512,863.7-512.9,862.8-514,862.8L-514,862.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-514,818.8v44h-17v-44H-514 M-514,816.8h-17c-1.1,0-2,0.9-2,2v44c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-44\r\n\t\t\tC-512,817.7-512.9,816.8-514,816.8L-514,816.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-465,874.8v14h-17v-14H-465 M-465,872.8h-17c-1.1,0-2,0.9-2,2v14c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-14\r\n\t\t\tC-463,873.7-463.9,872.8-465,872.8L-465,872.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-465,828.8v44h-17v-44H-465 M-465,826.8h-17c-1.1,0-2,0.9-2,2v44c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-44\r\n\t\t\tC-463,827.7-463.9,826.8-465,826.8L-465,826.8z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["column"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-366,419h-90.5c-0.8,0-1.5-0.7-1.5-1.5V327c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-365.2,419-366,419z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-403,382v34h-16v-34H-403 M-403,380h-16c-1.1,0-2,0.9-2,2v34c0,1.1,0.9,2,2,2h16c1.1,0,2-0.9,2-2v-34\r\n\t\t\tC-401,380.9-401.9,380-403,380L-403,380z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-427,362v54h-17v-54H-427 M-427,360h-17c-1.1,0-2,0.9-2,2v54c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-54\r\n\t\t\tC-425,360.9-425.9,360-427,360L-427,360z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-378,342v74h-17v-74H-378 M-378,340h-17c-1.1,0-2,0.9-2,2v74c0,1.1,0.9,2,2,2h17c1.1,0,2-0.9,2-2v-74\r\n\t\t\tC-376,340.9-376.9,340-378,340L-378,340z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["iconInfo"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t width=\"512px\" height=\"512px\" viewBox=\"0 0 512 512\" enable-background=\"new 0 0 512 512\" xml:space=\"preserve\">\r\n<g>\r\n\t<path fill=\"#aaa\" d=\"M256,0C114.609,0,0,114.609,0,256s114.609,256,256,256s256-114.609,256-256S397.391,0,256,0z M256,472\r\n\t\tc-119.297,0-216-96.703-216-216S136.703,40,256,40s216,96.703,216,216S375.297,472,256,472z\"/>\r\n\t<rect fill=\"#aaa\" x=\"240\" y=\"352\" width=\"32\" height=\"32\"/>\r\n\t<path fill=\"#aaa\" d=\"M317.734,150.148c-6.484-6.625-14.688-11.922-24.766-16.031c-10.203-4.102-22.172-6.117-36.281-6.117\r\n\t\tc-11.969,0-22.875,2.016-32.781,6.117c-9.938,4.109-18.5,9.773-25.688,17.125c-7.125,7.289-12.672,14.508-16.5,24.773\r\n\t\tC177.906,186.281,176,192,176,208h32.656c0-16,4.234-28.109,12.938-38.516c8.594-10.453,20.266-14.82,35.094-14.82\r\n\t\tc14.438,0,25.234,3.914,32.172,10.938c6.875,7.023,10.391,17.086,10.391,29.797c0,9.883-3.25,18.758-9.734,26.492\r\n\t\tc-6.375,7.75-13.359,15.297-20.844,22.438c-7.594,7.141-13.672,14.766-19.953,22.641S240,284.016,240,294.469V320h32v-13.75\r\n\t\tc0-8.203,1.203-15.312,4.406-21.516c3.094-6.219,6.953-11.859,11.844-16.891c4.734-5.094,9.812-10,15.469-14.828\r\n\t\tc5.5-4.766,10.781-9.859,15.531-15.172c4.844-5.344,8.875-11.344,11.938-17.969c3.219-6.625,4.828-14.406,4.828-23.477\r\n\t\tc0-7.875-1.422-15.891-4.391-24.039C328.719,164.148,324.031,156.766,317.734,150.148z\"/>\r\n</g>\r\n</svg>\r\n";
self["line"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-366,419h-90.5c-0.8,0-1.5-0.7-1.5-1.5V327c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v89h89c0.8,0,1.5,0.7,1.5,1.5\r\n\t\t\tS-365.2,419-366,419z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-456,385c-0.3,0-0.5-0.1-0.7-0.3c-0.4-0.4-0.4-1,0-1.4l23-23c0.4-0.4,1-0.4,1.4,0l21.3,21.3l38.3-41.2\r\n\t\t\tc0.4-0.4,1-0.4,1.4-0.1s0.4,1,0.1,1.4l-39,42c-0.2,0.2-0.4,0.3-0.7,0.3c-0.3,0-0.5-0.1-0.7-0.3l-21.3-21.3l-22.3,22.3\r\n\t\t\tC-455.5,384.9-455.7,385-456,385z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-456,404c-0.3,0-0.5-0.1-0.7-0.3c-0.4-0.4-0.4-1,0-1.4l23-23c0.4-0.4,1-0.4,1.4,0l21.3,21.3l38.3-41.2\r\n\t\t\tc0.4-0.4,1-0.4,1.4-0.1s0.4,1,0.1,1.4l-39,42c-0.2,0.2-0.4,0.3-0.7,0.3c-0.3,0-0.5-0.1-0.7-0.3l-21.3-21.3l-22.3,22.3\r\n\t\t\tC-455.5,403.9-455.7,404-456,404z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["line_basic"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st4{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st5{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"1.8,64.2 15,37 29,43.8 43,23 57,51 71,29.2 \"/>\r\n<polyline class=\"st2\" points=\"1.8,78.2 15,73 29,57.8 43,57 57,69 71,53.2 \"/>\r\n</svg>";
self["line_errorbar"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st4{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st5{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<g>\r\n\t<g>\r\n\t\t<line class=\"st4\" x1=\"42.5\" y1=\"14\" x2=\"42.5\" y2=\"32\"/>\r\n\t\t<g>\r\n\t\t\t<rect x=\"40\" y=\"14\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"40\" y=\"31\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t</g>\r\n</g>\r\n<g>\r\n\t<g>\r\n\t\t<line class=\"st4\" x1=\"56.5\" y1=\"38\" x2=\"56.5\" y2=\"64\"/>\r\n\t\t<g>\r\n\t\t\t<rect x=\"54\" y=\"38\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"54\" y=\"63\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t</g>\r\n</g>\r\n<g>\r\n\t<g>\r\n\t\t<line class=\"st4\" x1=\"70.5\" y1=\"21\" x2=\"70.5\" y2=\"38\"/>\r\n\t\t<g>\r\n\t\t\t<rect x=\"68\" y=\"21\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"68\" y=\"37\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t</g>\r\n</g>\r\n<g>\r\n\t<g>\r\n\t\t<line class=\"st4\" x1=\"28.5\" y1=\"31\" x2=\"28.5\" y2=\"56\"/>\r\n\t\t<g>\r\n\t\t\t<rect x=\"26\" y=\"31\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"26\" y=\"55\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t</g>\r\n</g>\r\n<g>\r\n\t<g>\r\n\t\t<line class=\"st4\" x1=\"14.5\" y1=\"27\" x2=\"14.5\" y2=\"48\"/>\r\n\t\t<g>\r\n\t\t\t<rect x=\"12\" y=\"27\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t\t<g>\r\n\t\t\t<rect x=\"12\" y=\"47\" class=\"st5\" width=\"5\" height=\"1\"/>\r\n\t\t</g>\r\n\t</g>\r\n</g>\r\n<polyline class=\"st2\" points=\"1.8,64.2 15,37 29,43.8 43,23 57,51 71,29.2 \"/>\r\n</svg>";
self["line_inverted"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st4{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st5{fill:#989898;}\r\n</style>\r\n<polyline class=\"st2\" points=\"50,77.2 22.8,64 29.5,50 8.8,36 36.8,22 15,8 \"/>\r\n<polyline class=\"st2\" points=\"64,77.2 58.8,64 43.5,50 42.8,36 54.8,22 39,8 \"/>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n</svg>";
self["line_labels"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{font-family:'FlandersArtSans-Light';}\r\n\t.st4{font-size:12px;}\r\n\t.st5{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st6{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st7{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"1.8,64.2 15,37 29,43.8 43,23 57,51 71,29.2 \"/>\r\n<text transform=\"matrix(1 0 0 1 9.083 32.75)\" class=\"st3 st4\">30</text>\r\n<text transform=\"matrix(1 0 0 1 36.668 20)\" class=\"st3 st4\">40</text>\r\n</svg>";
self["line_logaritmic_labels"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{font-family:'FlandersArtSans-Light';}\r\n\t.st4{font-size:12px;}\r\n\t.st5{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st6{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st7{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"1.8,64.2 15,37 29,43.8 43,23 57,51 71,29.2 \"/>\r\n<text transform=\"matrix(1 0 0 1 10.167 32.75)\" class=\"st3 st4\">10</text>\r\n<text transform=\"matrix(1 0 0 1 34.3945 20)\" class=\"st3 st4\">100</text>\r\n</svg>";
self["line_negative_color"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{font-family:'FlandersArtSans-Light';}\r\n\t.st4{font-size:12px;}\r\n\t.st5{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st6{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st7{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"1.8,45.2 15,37 29,43.8 43,73 57,64 71,29.2 \"/>\r\n<text transform=\"matrix(1 0 0 1 10.167 32.75)\" class=\"st3 st4\">10</text>\r\n<text transform=\"matrix(1 0 0 1 34.3945 20)\" class=\"st3 st4\">100</text>\r\n<polyline class=\"st5\" points=\"32.7,51.5 43,73 57,64 62,51.5 \"/>\r\n<line class=\"st2\" x1=\"2\" y1=\"51.5\" x2=\"72\" y2=\"51.5\"/>\r\n</svg>";
self["line_step"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st4{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st5{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"2,62.5 14.5,62.5 14.5,37.5 28.5,37.5 28.5,44.5 42.5,44.5 42.5,23.5 56.5,23.5 56.5,51.5 70.5,51.5 \r\n\t70.5,31 \"/>\r\n</svg>";
self["line_step_labels"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{font-family:'FlandersArtSans-Light';}\r\n\t.st4{font-size:12px;}\r\n\t.st5{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st6{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st7{fill:#989898;}\r\n</style>\r\n<text transform=\"matrix(1 0 0 1 8.333 32.75)\" class=\"st3 st4\">30</text>\r\n<text transform=\"matrix(1 0 0 1 35.918 20)\" class=\"st3 st4\">40</text>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<polyline class=\"st2\" points=\"2,62.5 14.5,62.5 14.5,37.5 28.5,37.5 28.5,44.5 42.5,44.5 42.5,23.5 56.5,23.5 56.5,51.5 70.5,51.5 \r\n\t70.5,31 \"/>\r\n</svg>";
self["logo"] = "<svg version=\"1.1\" id=\"Laag_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 247.8 61.6\" enable-background=\"new 0 0 247.8 61.6\" xml:space=\"preserve\">\r\n<circle fill=\"#C6F4C3\" cx=\"237.8\" cy=\"25.1\" r=\"5.8\"/>\r\n<g>\r\n\t<path fill=\"#ffffff\" d=\"M24,6v6.8H10v5.5H24v6.4H10v5.5H24V37H2.8V6H24z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M36.6,31.5L34.7,37h-7.6L37.7,6h10.5l10.7,31h-7.7l-1.9-5.5H36.6z M46.9,24.7l-4-11.6l-4,11.6H46.9z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M59.6,28.6c2.8,1.2,5.4,2.1,8.6,2.1c1.9,0,3.3-0.4,4.1-0.9c0.9-0.5,1.3-1.2,1.3-1.9c0-1.1-0.9-1.9-2.3-2.5\r\n\t\tc-0.7-0.3-1.5-0.6-2.4-0.9c-1.8-0.6-3.7-1.3-5.5-2.3c-1.8-1-3.3-2.3-4.1-4.3c-0.4-1-0.7-2.1-0.7-3.5c0-3.5,1.5-5.7,3.8-7\r\n\t\ts5.1-1.8,7.8-1.8c3.2,0,6,0.7,7.8,1.3v6.2L78,13.2c-0.5-0.2-1.6-0.4-2.9-0.6c-1.3-0.2-2.8-0.4-4.3-0.4c-1.3,0-2.6,0.1-3.6,0.5\r\n\t\ts-1.6,0.9-1.6,1.8c0,1.1,1,1.9,2.4,2.5c0.7,0.4,1.6,0.7,2.5,1c1.9,0.7,3.9,1.4,5.8,2.3c1.9,1,3.4,2.3,4.3,4.1\r\n\t\tc0.4,0.9,0.7,2,0.7,3.2c0,3.2-1.7,5.6-4.2,7.3c-2.5,1.7-5.8,2.5-9.1,2.5c-3.1,0-6.1-0.8-8.4-2.4V28.6z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M83.3,6h7.2l5.8,11.8L102.1,6h7.3l-9.4,19.4V37h-7.2V25.4L83.3,6z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M129.3,34.1v2.2c-2,0.8-3.8,1.2-5.7,1.2c-2.9,0-5.7-0.9-7.8-3s-3.4-5.3-3.4-9.8c0-4.5,1.3-7.6,3.3-9.6c2-2,4.8-2.9,7.8-2.9\r\n\t\tc1.9,0,3.7,0.3,5.7,1.2v2.1l-0.2,0.3c-1.7-0.7-3.3-0.9-5-0.9c-2.4,0-4.6,0.6-6.2,2.2c-1.6,1.5-2.6,4-2.6,7.6s1,6.2,2.6,7.9\r\n\t\tc1.6,1.7,3.8,2.5,6.2,2.5c1.6,0,3.3-0.3,5-0.9L129.3,34.1z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M138.6,3.4v11.4c2.3-1.5,4.8-2.7,7.5-2.7c1.9,0,3.9,0.6,5.4,1.8c1.5,1.3,2.5,3.2,2.5,6v17h-2.7v-16c0-2.2-0.7-3.7-1.7-4.8\r\n\t\tc-1-1-2.4-1.5-3.9-1.5c-1.2,0-2.5,0.3-3.7,0.8c-1.2,0.5-2.4,1.2-3.3,2V37h-2.7V3.9l2.4-0.5H138.6z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M177.2,28.8c0,1.4,0.3,2.8,0.9,3.9c0.6,1.1,1.6,1.9,2.9,2.2l-1.5,2.5c-1.8-0.6-3.1-2-3.9-3.8c-0.6,1.1-1.6,2-2.8,2.7\r\n\t\tc-1.2,0.7-2.8,1.1-4.5,1.1c-1.6,0-3.6-0.4-5.1-1.5c-1.6-1.1-2.7-3-2.7-6c0-2.3,0.7-4,2.2-5.2s3.9-1.8,7.2-1.8\r\n\t\tc1.2,0,2.7,0.1,4.9,0.3v-3.4c0-1.9-0.7-3.2-1.6-4c-1-0.8-2.3-1.1-3.6-1.1c-1.8,0-4.4,0.5-6.6,1.6l-0.7-2.5c2.3-1.1,5-1.7,7.4-1.7\r\n\t\tc2.1,0,4,0.5,5.5,1.7c1.4,1.2,2.3,3.3,2.3,6.3V28.8z M174.5,25.6c-1.8-0.2-2.7-0.2-3.8-0.2c-1.4,0-3.3,0-4.9,0.6\r\n\t\tc-1.6,0.6-2.8,1.7-2.8,3.8c0,1.3,0.5,2.6,1.4,3.5c0.9,0.9,2.2,1.5,3.9,1.5c2.6,0,4.7-1.3,6.1-4V25.6z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M187.6,12.6l0.8,2.5c1.8-2,3.9-3,6.1-3c1.2,0,2.2,0.3,3.3,0.7l-0.9,2.4c-1.2-0.4-1.7-0.6-2.7-0.6c-2.4,0-4.2,1.2-5.9,3.4\r\n\t\tV37h-2.7V12.6H187.6z\"/>\r\n\t<path fill=\"#ffffff\" d=\"M215.1,36.6c-1.7,0.6-3.2,0.9-4.6,0.9c-1.3,0-3.1-0.3-4.6-1.4c-1.5-1.2-2.6-3.2-2.6-6.8v-14h-2.7v-2.7h2.7V8.2l2.4-0.4h0.3\r\n\t\tv4.9h6v2.7h-6v12.5c0,2.6,0.4,4.3,1.3,5.4c0.8,1.1,2,1.6,3.4,1.6c1.1,0,2.3-0.3,3.7-0.8L215.1,36.6z\"/>\r\n</g>\r\n<g>\r\n\t<path fill=\"#97CCC2\" d=\"M4,46.5v3.3C4.7,49.3,5.4,49,6.2,49c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5H7.7v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4c-0.3-0.3-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7H3.3v-9.6L4,46.5L4,46.5z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M11.6,47.4c0-0.2,0.1-0.3,0.2-0.4c0.1-0.1,0.3-0.2,0.4-0.2s0.3,0.1,0.4,0.2c0.1,0.1,0.2,0.2,0.2,0.4\r\n\t\tc0,0.1-0.1,0.3-0.2,0.4c-0.1,0.1-0.3,0.2-0.4,0.2s-0.3-0.1-0.4-0.2C11.7,47.7,11.6,47.5,11.6,47.4z M11.8,56.2v-7.1h0.8v7.1H11.8z\"\r\n\t\t/>\r\n\t<path fill=\"#97CCC2\" d=\"M18.8,54.8c1,0,1.7,0.2,2.1,0.6c0.5,0.4,0.7,0.9,0.7,1.4c0,0.7-0.5,1.4-1.2,1.9s-1.6,0.8-2.5,0.8\r\n\t\tc-0.8,0-1.5-0.3-1.9-0.7c-0.5-0.4-0.7-1-0.7-1.5c0-0.7,0.3-1.4,0.9-1.9c-0.4-0.2-0.6-0.6-0.6-1c0-0.4,0.2-0.9,0.5-1.3\r\n\t\tc-0.4-0.4-0.6-1-0.6-1.6c0-0.7,0.3-1.3,0.7-1.7c0.5-0.4,1.1-0.7,1.9-0.7c0.6,0,1.1,0.2,1.5,0.4c0.3-0.2,0.6-0.4,0.9-0.6\r\n\t\tc0.3-0.1,0.6-0.2,0.8-0.2l0.3,0.7c-0.4,0-0.9,0.2-1.3,0.6c0.3,0.4,0.5,0.9,0.5,1.4c0,0.7-0.3,1.3-0.7,1.7s-1.1,0.7-1.9,0.7\r\n\t\tc-0.6,0-1-0.1-1.4-0.4c-0.2,0.2-0.3,0.5-0.3,0.6c0,0.1,0.1,0.3,0.2,0.4c0.1,0.1,0.4,0.2,0.6,0.2H18.8z M16.8,55.5\r\n\t\tc-0.5,0.5-0.8,1.1-0.8,1.7c0,0.4,0.2,0.8,0.5,1.1s0.8,0.5,1.5,0.5c0.8,0,1.5-0.2,2-0.6s0.8-0.8,0.8-1.3c0-0.6-0.3-0.9-0.8-1.1\r\n\t\ts-1.3-0.2-2.1-0.2H16.8z M18.1,49.8c-0.6,0-1.1,0.2-1.4,0.5c-0.3,0.3-0.5,0.7-0.5,1.1s0.2,0.8,0.5,1.1s0.8,0.5,1.4,0.5\r\n\t\tc0.6,0,1.1-0.2,1.4-0.5s0.4-0.7,0.4-1.1s-0.2-0.8-0.5-1.1C19.1,50,18.7,49.8,18.1,49.8z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M24.7,46.5v3.3c0.7-0.4,1.4-0.8,2.2-0.8c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5h-0.8v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4c-0.3-0.3-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7h-0.8v-9.6L24.7,46.5\r\n\t\tL24.7,46.5z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M36.7,55.4V56c-0.6,0.2-1.1,0.3-1.7,0.3c-0.9,0-1.7-0.3-2.3-0.9s-1-1.5-1-2.9c0-1.3,0.4-2.2,1-2.8\r\n\t\ts1.4-0.8,2.3-0.8c0.6,0,1.1,0.1,1.7,0.3V50L36.7,50c-0.5-0.2-1-0.3-1.5-0.3c-0.7,0-1.4,0.2-1.8,0.6s-0.8,1.2-0.8,2.2\r\n\t\ts0.3,1.8,0.8,2.3s1.1,0.7,1.8,0.7C35.7,55.6,36.2,55.5,36.7,55.4L36.7,55.4z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M40.2,46.5v3.3c0.7-0.4,1.4-0.8,2.2-0.8c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5h-0.8v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4c-0.3-0.3-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7h-0.8v-9.6L40.2,46.5\r\n\t\tL40.2,46.5z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M52.3,53.9c0,0.4,0.1,0.8,0.3,1.1s0.5,0.6,0.8,0.6l-0.4,0.7c-0.5-0.2-0.9-0.6-1.1-1.1\r\n\t\tc-0.2,0.3-0.5,0.6-0.8,0.8s-0.8,0.3-1.3,0.3c-0.5,0-1-0.1-1.5-0.4c-0.5-0.3-0.8-0.9-0.8-1.8c0-0.7,0.2-1.2,0.6-1.5s1.1-0.5,2.1-0.5\r\n\t\tc0.4,0,0.8,0,1.4,0.1v-1c0-0.5-0.2-0.9-0.5-1.2s-0.7-0.3-1.1-0.3c-0.5,0-1.3,0.2-1.9,0.5l-0.2-0.7c0.7-0.3,1.4-0.5,2.2-0.5\r\n\t\tc0.6,0,1.2,0.1,1.6,0.5c0.4,0.4,0.7,1,0.7,1.8V53.9z M51.5,52.9c-0.5-0.1-0.8-0.1-1.1-0.1c-0.4,0-1,0-1.4,0.2\r\n\t\tc-0.5,0.2-0.8,0.5-0.8,1.1c0,0.4,0.1,0.8,0.4,1c0.3,0.3,0.6,0.4,1.1,0.4c0.8,0,1.4-0.4,1.8-1.2V52.9z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M56.1,49.1l0.2,0.7c0.5-0.6,1.1-0.9,1.8-0.9c0.3,0,0.6,0.1,1,0.2l-0.3,0.7c-0.3-0.1-0.5-0.2-0.8-0.2\r\n\t\tc-0.7,0-1.2,0.3-1.7,1v5.5h-0.8v-7.1H56.1z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M64.9,56.1c-0.5,0.2-0.9,0.3-1.3,0.3c-0.4,0-0.9-0.1-1.3-0.4s-0.8-0.9-0.8-2v-4.1h-0.8v-0.8h0.8v-1.3\r\n\t\tl0.7-0.1h0.1v1.4H64v0.8h-1.7v3.7c0,0.7,0.1,1.3,0.4,1.6c0.2,0.3,0.6,0.5,1,0.5c0.3,0,0.7-0.1,1.1-0.2L64.9,56.1z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M66.6,55.4c0.2,0.1,0.4,0.1,0.7,0.2c0.3,0,0.5,0.1,0.8,0.1c0.4,0,0.9-0.1,1.3-0.3c0.4-0.2,0.7-0.5,0.7-1\r\n\t\tc0-0.5-0.4-0.8-0.9-1.1c-0.3-0.1-0.5-0.3-0.8-0.4c-0.6-0.2-1.1-0.6-1.5-1.1c-0.2-0.2-0.3-0.6-0.3-0.9c0-0.6,0.3-1.1,0.7-1.4\r\n\t\tc0.4-0.3,1-0.5,1.7-0.5c0.5,0,0.9,0.1,1.3,0.2v0.7l0,0c-0.3-0.1-0.8-0.2-1.3-0.2c-0.4,0-0.8,0.1-1,0.2c-0.3,0.2-0.4,0.4-0.4,0.8\r\n\t\tc0,0.4,0.2,0.7,0.5,0.9c0.3,0.2,0.8,0.4,1.2,0.6c0.4,0.2,0.9,0.4,1.2,0.7c0.3,0.3,0.5,0.7,0.5,1.3c0,0.7-0.3,1.3-0.9,1.6\r\n\t\tc-0.5,0.4-1.2,0.6-2,0.6c-0.5,0-1-0.1-1.5-0.3L66.6,55.4L66.6,55.4z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M76.2,51.9v0.8h-3.4v-0.8H76.2z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M79.4,49.1l0.2,0.6c0.5-0.5,1.2-0.8,2-0.8c1,0,1.7,0.4,2.2,1.1s0.8,1.6,0.8,2.6c0,1.1-0.4,2-1,2.7\r\n\t\ts-1.5,1-2.5,1c-0.4,0-1-0.1-1.5-0.2v3.2h-0.8V49.1H79.4z M79.6,55.3c0.5,0.2,1,0.3,1.5,0.3c0.7,0,1.4-0.3,1.9-0.8s0.8-1.3,0.8-2.2\r\n\t\tc0-0.8-0.2-1.5-0.6-2s-1-0.9-1.8-0.9c-0.8,0-1.4,0.3-1.8,0.9V55.3z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M86.7,52.7c0-1,0.3-2,0.9-2.6S89,49,89.9,49c1,0,1.8,0.4,2.3,1.1c0.5,0.7,0.9,1.6,0.9,2.6\r\n\t\tc0,1-0.3,1.9-0.9,2.6s-1.4,1.1-2.3,1.1c-1,0-1.8-0.4-2.3-1.1S86.7,53.7,86.7,52.7z M87.5,52.6c0,0.8,0.2,1.6,0.6,2.1\r\n\t\tc0.4,0.5,1,0.9,1.8,0.9c0.8,0,1.4-0.3,1.8-0.8c0.4-0.5,0.6-1.2,0.6-2.1c0-0.8-0.2-1.6-0.6-2.1c-0.4-0.5-1-0.9-1.8-0.9\r\n\t\tc-0.8,0-1.4,0.3-1.8,0.8S87.5,51.8,87.5,52.6z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M101.7,56.2h-0.9l-1.7-5.7l-1.7,5.7h-0.9l-2.2-7.1h0.9l1.8,5.7l1.7-5.7h0.8l1.7,5.7l1.8-5.7h0.9L101.7,56.2\r\n\t\tz\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M110.4,52.9H106c0,0.9,0.3,1.6,0.8,2.1c0.5,0.5,1.1,0.7,1.8,0.7c0.3,0,0.6,0,0.9-0.1\r\n\t\tc0.3-0.1,0.6-0.2,0.9-0.4l0,0v0.7c-0.7,0.4-1.4,0.5-2,0.5c-0.9,0-1.7-0.3-2.3-0.9s-1-1.6-1-2.9c0-1,0.2-1.9,0.7-2.6s1.2-1,2.3-1\r\n\t\tc0.7,0,1.2,0.2,1.5,0.5c0.3,0.3,0.5,0.7,0.6,1.2s0.1,1,0.1,1.4V52.9z M109.6,52.1c0-0.6-0.1-1.2-0.3-1.6c-0.2-0.4-0.6-0.7-1.3-0.7\r\n\t\tc-0.7,0-1.1,0.2-1.5,0.7c-0.3,0.4-0.5,1-0.6,1.7H109.6z\"/>\r\n\t<path fill=\"#97CCC2\" d=\"M113.7,49.1l0.2,0.7c0.5-0.6,1.1-0.9,1.8-0.9c0.3,0,0.6,0.1,1,0.2l-0.3,0.7c-0.3-0.1-0.5-0.2-0.8-0.2\r\n\t\tc-0.7,0-1.2,0.3-1.7,1v5.5h-0.8v-7.1H113.7z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M123.9,47.4c0-0.2,0.1-0.3,0.2-0.4c0.1-0.1,0.3-0.2,0.4-0.2s0.3,0.1,0.4,0.2c0.1,0.1,0.2,0.2,0.2,0.4\r\n\t\tc0,0.1-0.1,0.3-0.2,0.4c-0.1,0.1-0.3,0.2-0.4,0.2s-0.3-0.1-0.4-0.2C124,47.7,123.9,47.5,123.9,47.4z M124.1,56.2v-7.1h0.8v7.1\r\n\t\tH124.1z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M128.9,49.1l0.2,0.7c0.7-0.4,1.4-0.8,2.2-0.8c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5h-0.8v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4s-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7h-0.8v-7.1H128.9z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M143.6,55l2-5.8h0.9l-3.1,8.9c-0.2,0.5-0.5,0.9-0.8,1.1s-0.7,0.3-1.1,0.3c-0.5,0-1-0.1-1.4-0.4l0.4-0.9\r\n\t\tc0.3,0.2,0.6,0.3,0.9,0.3c0.6,0,1.1-0.3,1.3-1l0.4-1.3l-2.4-7.1h0.9L143.6,55z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M148.1,52.7c0-1,0.3-2,0.9-2.6s1.4-1.1,2.3-1.1c1,0,1.8,0.4,2.3,1.1c0.5,0.7,0.9,1.6,0.9,2.6\r\n\t\tc0,1-0.3,1.9-0.9,2.6s-1.4,1.1-2.3,1.1c-1,0-1.8-0.4-2.3-1.1S148.1,53.7,148.1,52.7z M148.9,52.6c0,0.8,0.2,1.6,0.6,2.1\r\n\t\tc0.4,0.5,1,0.9,1.8,0.9c0.8,0,1.4-0.3,1.8-0.8c0.4-0.5,0.6-1.2,0.6-2.1c0-0.8-0.2-1.6-0.6-2.1c-0.4-0.5-1-0.9-1.8-0.9\r\n\t\tc-0.8,0-1.4,0.3-1.8,0.8S148.9,51.8,148.9,52.6z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M161.9,56.2l-0.2-0.7c-0.3,0.2-0.7,0.4-1.1,0.6s-0.8,0.2-1.2,0.2c-0.5,0-1.1-0.2-1.6-0.5\r\n\t\tc-0.4-0.4-0.7-0.9-0.7-1.7v-5h0.8v4.7c0,0.6,0.2,1.1,0.5,1.4c0.3,0.3,0.7,0.4,1.1,0.4c0.4,0,0.7-0.1,1.1-0.3c0.3-0.2,0.7-0.4,1-0.6\r\n\t\tv-5.7h0.8v7.1H161.9z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M166.4,49.1l0.2,0.7c0.5-0.6,1.1-0.9,1.8-0.9c0.3,0,0.6,0.1,1,0.2l-0.3,0.7c-0.3-0.1-0.5-0.2-0.8-0.2\r\n\t\tc-0.7,0-1.2,0.3-1.7,1v5.5h-0.8v-7.1H166.4z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M177.6,46.5v3.3c0.7-0.4,1.4-0.8,2.2-0.8c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5h-0.8v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4c-0.3-0.3-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7h-0.8v-9.6L177.6,46.5\r\n\t\tL177.6,46.5z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M189.7,53.9c0,0.4,0.1,0.8,0.3,1.1s0.5,0.6,0.8,0.6l-0.4,0.7c-0.5-0.2-0.9-0.6-1.1-1.1\r\n\t\tc-0.2,0.3-0.5,0.6-0.8,0.8s-0.8,0.3-1.3,0.3c-0.5,0-1-0.1-1.5-0.4c-0.5-0.3-0.8-0.9-0.8-1.8c0-0.7,0.2-1.2,0.6-1.5s1.1-0.5,2.1-0.5\r\n\t\tc0.4,0,0.8,0,1.4,0.1v-1c0-0.5-0.2-0.9-0.5-1.2s-0.7-0.3-1.1-0.3c-0.5,0-1.3,0.2-1.9,0.5l-0.2-0.7c0.7-0.3,1.4-0.5,2.2-0.5\r\n\t\tc0.6,0,1.2,0.1,1.6,0.5c0.4,0.4,0.7,1,0.7,1.8V53.9z M188.9,52.9c-0.5-0.1-0.8-0.1-1.1-0.1c-0.4,0-1,0-1.4,0.2\r\n\t\tc-0.5,0.2-0.8,0.5-0.8,1.1c0,0.4,0.1,0.8,0.4,1c0.3,0.3,0.6,0.4,1.1,0.4c0.8,0,1.4-0.4,1.8-1.2V52.9z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M193.8,49.1l0.2,0.7c0.7-0.4,1.4-0.8,2.2-0.8c0.5,0,1.1,0.2,1.6,0.5c0.4,0.4,0.7,0.9,0.7,1.7v5h-0.8v-4.7\r\n\t\tc0-0.6-0.2-1.1-0.5-1.4s-0.7-0.4-1.1-0.4c-0.4,0-0.7,0.1-1.1,0.2c-0.4,0.2-0.7,0.4-1,0.6v5.7h-0.8v-7.1H193.8z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M206.9,56.2h-0.6l-0.2-0.6c-0.5,0.5-1.2,0.8-2,0.8c-0.9,0-1.7-0.4-2.2-1.1c-0.5-0.7-0.8-1.6-0.8-2.7\r\n\t\tc0-1,0.3-1.9,0.8-2.5s1.4-1,2.7-1c0.5,0,1,0.1,1.5,0.2v-2.6l0.7-0.1h0.1V56.2z M206.2,50.1c-0.5-0.2-1-0.4-1.5-0.4\r\n\t\tc-0.8,0-1.4,0.2-1.9,0.7s-0.8,1.2-0.8,2.2c0,0.8,0.2,1.5,0.6,2c0.4,0.5,1,0.9,1.8,0.9c0.8,0,1.4-0.3,1.9-0.9V50.1z\"/>\r\n\t<path fill=\"#9ABF99\" d=\"M209.7,55.4c0.2,0.1,0.4,0.1,0.7,0.2s0.5,0.1,0.8,0.1c0.4,0,0.9-0.1,1.3-0.3c0.4-0.2,0.7-0.5,0.7-1\r\n\t\tc0-0.5-0.4-0.8-0.9-1.1c-0.3-0.1-0.5-0.3-0.8-0.4c-0.6-0.2-1.1-0.6-1.5-1.1c-0.2-0.2-0.3-0.6-0.3-0.9c0-0.6,0.3-1.1,0.7-1.4\r\n\t\ts1-0.5,1.7-0.5c0.5,0,0.9,0.1,1.3,0.2v0.7l0,0c-0.3-0.1-0.8-0.2-1.3-0.2c-0.4,0-0.8,0.1-1,0.2c-0.3,0.2-0.4,0.4-0.4,0.8\r\n\t\tc0,0.4,0.2,0.7,0.5,0.9c0.3,0.2,0.8,0.4,1.2,0.6c0.4,0.2,0.9,0.4,1.2,0.7c0.3,0.3,0.5,0.7,0.5,1.3c0,0.7-0.3,1.3-0.9,1.6\r\n\t\tc-0.5,0.4-1.2,0.6-2,0.6c-0.5,0-1-0.1-1.5-0.3L209.7,55.4L209.7,55.4z\"/>\r\n</g>\r\n<circle fill=\"#97CCC2\" cx=\"231.8\" cy=\"31.1\" r=\"5.8\"/>\r\n</svg>\r\n";
self["pie"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-411,420.5c-26.7,0-48.5-21.8-48.5-48.5s21.8-48.5,48.5-48.5c26.7,0,48.5,21.8,48.5,48.5\r\n\t\t\tC-362.5,398.7-384.3,420.5-411,420.5z M-411,326.5c-25.1,0-45.5,20.4-45.5,45.5s20.4,45.5,45.5,45.5s45.5-20.4,45.5-45.5\r\n\t\t\tS-385.9,326.5-411,326.5z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-378.2,406.8c-0.3,0-0.5-0.1-0.7-0.3l-33.8-33.8c-0.2-0.2-0.3-0.4-0.3-0.7v-47c0-0.6,0.4-1,1-1s1,0.4,1,1v46.6l33.5,33.5\r\n\t\t\tc0.4,0.4,0.4,1,0,1.4C-377.7,406.7-378,406.8-378.2,406.8z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-364,373h-48c-0.6,0-1-0.4-1-1s0.4-1,1-1h48c0.6,0,1,0.4,1,1S-363.4,373-364,373z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["readme"] = "\nIMPORTANT NOTICE:\n-----------------\n\nAll icons by Agus Purwanto from the Noun Project. Thanks a lot!\nhttps://thenounproject.com/Brexebrex/collection/chart-icons/";
self["spider"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"-461 322 100 100\" style=\"enable-background:new -461 322 100 100;\" xml:space=\"preserve\">\r\n<g>\r\n\t<g>\r\n\t\t<path d=\"M-375,417.5c-0.4,0-0.9-0.2-1.2-0.5l-34.8-42.6l-34.8,42.6c-0.5,0.6-1.5,0.7-2.1,0.2c-0.6-0.5-0.7-1.5-0.2-2.1l36-44\r\n\t\t\tc0.6-0.7,1.8-0.7,2.3,0l36,44c0.5,0.6,0.4,1.6-0.2,2.1C-374.3,417.4-374.7,417.5-375,417.5z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-411.4,374c-0.2,0-0.5-0.1-0.7-0.2l-45.6-23.5c-0.7-0.4-1-1.3-0.6-2c0.4-0.7,1.3-1,2-0.6l44.9,23.2l44.7-23.2\r\n\t\t\tc0.7-0.4,1.6-0.1,2,0.6s0.1,1.6-0.6,2l-45.4,23.5C-411,374-411.2,374-411.4,374z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-411.5,374.5c-0.8,0-1.5-0.7-1.5-1.5v-49c0-0.8,0.7-1.5,1.5-1.5s1.5,0.7,1.5,1.5v49C-410,373.8-410.7,374.5-411.5,374.5z\r\n\t\t\t\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-412,339.1l32,17.8l-6.8,45.1H-436l-6.4-45.1L-412,339.1 M-412,337.1c-0.3,0-0.7,0.1-1,0.3l-30.5,17.5\r\n\t\t\tc-0.7,0.4-1.1,1.2-1,2l6.4,45.1c0.1,1,1,2,2,2h49.2c1,0,1.8-1,2-1.9l6.8-44.9c0.1-0.8-0.3-1.7-1-2.1l-32-17.6\r\n\t\t\tC-411.3,337.2-411.7,337.1-412,337.1L-412,337.1z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-411.8,349.1l21.7,12.2l-4.6,30.7h-33.4l-4.4-30.7L-411.8,349.1 M-411.8,347.1c-0.3,0-0.7,0.1-1,0.3l-20.7,11.9\r\n\t\t\tc-0.7,0.4-1.1,1.2-1,2l4.4,30.7c0.1,1,1,2,2,2h33.4c1,0,1.8-1,2-1.9l4.6-30.6c0.1-0.8-0.3-1.7-1-2.1l-21.7-12\r\n\t\t\tC-411.1,347.2-411.4,347.1-411.8,347.1L-411.8,347.1z\"/>\r\n\t</g>\r\n\t<g>\r\n\t\t<path d=\"M-411.5,358.1l12.5,7.1l-2.7,17.8h-19.2l-2.5-17.8L-411.5,358.1 M-411.5,356.1c-0.3,0-0.7,0.1-1,0.3l-11.9,6.8\r\n\t\t\tc-0.7,0.4-1.1,1.2-1,2l2.5,17.8c0.1,1,1,2,2,2h19.2c1,0,1.8-1,2-1.9l2.7-17.6c0.1-0.8-0.3-1.7-1-2.1l-12.5-6.9\r\n\t\t\tC-410.9,356.2-411.2,356.1-411.5,356.1L-411.5,356.1z\"/>\r\n\t</g>\r\n</g>\r\n</svg>\r\n";
self["spline_basic"] = "<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st4{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st5{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<path class=\"st2\" d=\"M1.8,64.2c0,0,8.5-27.2,13.2-27.2s9.5,6.8,14,6.8S38.8,23,43,23s10.8,28,14,28s14-21.8,14-21.8\"/>\r\n<path class=\"st2\" d=\"M1.8,77.2c0,0,8.5-17.2,13.2-17.2s9.5-3.2,14-3.2S38.8,71,43,71s10.8-15,14-15s14,9.2,14,9.2\"/>\r\n</svg>";
self["spline_labels"] = "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n<!-- Generator: Adobe Illustrator 19.1.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  -->\r\n<svg version=\"1.1\" id=\"Layer_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"\r\n\t viewBox=\"0 0 80 80\" style=\"enable-background:new 0 0 80 80;\" xml:space=\"preserve\">\r\n<style type=\"text/css\">\r\n\t.st0{fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-miterlimit:10;}\r\n\t.st1{fill:none;}\r\n\t.st2{fill:none;stroke:#000000;stroke-miterlimit:10;}\r\n\t.st3{font-family:'FlandersArtSans-Light';}\r\n\t.st4{font-size:12px;}\r\n\t.st5{fill:none;stroke:#8EEED4;stroke-miterlimit:10;}\r\n\t.st6{fill:none;stroke:#989898;stroke-miterlimit:10;}\r\n\t.st7{fill:#989898;}\r\n</style>\r\n<g>\r\n\t<polyline class=\"st0\" points=\"72,78 2,78 2,8 \t\"/>\r\n\t<rect class=\"st1\" width=\"80\" height=\"80\"/>\r\n</g>\r\n<path class=\"st2\" d=\"M1.8,64.2c0,0,8.5-27.2,13.2-27.2s9.5,6.8,14,6.8S38.8,23,43,23s10.8,28,14,28s14-21.8,14-21.8\"/>\r\n<text transform=\"matrix(1 0 0 1 9.083 32.75)\" class=\"st3 st4\">30</text>\r\n<text transform=\"matrix(1 0 0 1 36.668 20)\" class=\"st3 st4\">40</text>\r\n</svg>\r\n";
return self})();
    var virtualize = require('vdom-virtualize');
    var _ = {
        isUndefined: require('lodash.isundefined')
    };
    var that = {};
    that.get = function(id){
        if(!_.isUndefined(icons[id])){
            var logo = document.createElement('div');
            logo.innerHTML = icons[id];
            return virtualize(logo.firstChild);

        } else {
            console.log('Icon not found');
        }
    };

    module.exports = that;
})();

},{"fs":6,"lodash.isundefined":72,"vdom-virtualize":101}],156:[function(require,module,exports){
(function () {
    var _ = {
        isUndefined: require('lodash.isundefined'),
        cloneDeep: require('lodash.clonedeep'),
        forEach: require('lodash.foreach'),
        first: require('lodash.first'),
        isArray: require('lodash.isarray'),
        isString: require('lodash.isstring')
    };

    var that = {};

    that.get = function (option, configService, indexName) {
        if (option) {
            var localProperty = _.cloneDeep(option);
            // sometimes we will get an index name, this will be a name with an index.
            // e.g. series are arrays and have indexes : series.0.name
            localProperty.fullname = !_.isUndefined(indexName) ? indexName : option.fullname;
            return that.createProperty(localProperty, configService);
        }
    };

    that.createProperty = function (property, configService) {
        var element;
        var configValue = configService.getValue(property.fullname);
        var disabled = !configService.isEditable(property.fullname);

        // set the default/configvalue

        if (!_.isUndefined(property.defaults) && !_.isArray(property.defaults)) {
            // defaults is a string
            if (_.isString(property.defaults)) {
                property.defaults = property.defaults.replace(/\[|\]|\"/g, '').split(',');
            }
            if (property.defaults.length == 1) {
                property.defaults = _.first(property.defaults).trim();
            }
        }

        var returnType = property.returnType ? property.returnType : "string";
        // select
        if (property.hasOwnProperty('values') && property.values !== '') {
            element = require('./properties/select')(property, configService, configValue, disabled);
        }
        else {
            switch (true) {
                // Color array
                case returnType.toLowerCase() == 'array<color>':
                    element = require('./properties/arrayColor')(property, configService, configValue, disabled);
                    break;
                case returnType.toLowerCase() == 'array<object>':
                    element = require('./properties/arrayObject')(property, configService, configValue, that);
                    break;
                // array
                case (returnType.lastIndexOf('Array', 0) === 0):
                    element = require('./properties/array')(property, configService, configValue, disabled);
                    break;
                // number
                case returnType.toLowerCase().indexOf('number') > -1:
                    element = require('./properties/number')(property, configService, configValue, disabled);
                    break;
                // boolean
                case returnType.toLowerCase() == 'boolean':
                    element = require('./properties/boolean')(property, configService, configValue, disabled);
                    break;

                case returnType.toLowerCase() == 'string':
                    element = require('./properties/string')(property, configService, configValue, disabled);
                    break;

                default:
                    element = require('./properties/string')(property, configService, configValue, disabled);
                    break;
            }
        }
        return element;
    };

    module.exports = that;
})();
},{"./properties/array":157,"./properties/arrayColor":158,"./properties/arrayObject":159,"./properties/boolean":160,"./properties/number":161,"./properties/select":162,"./properties/string":163,"lodash.clonedeep":55,"lodash.first":58,"lodash.foreach":59,"lodash.isarray":64,"lodash.isstring":71,"lodash.isundefined":72}],157:[function(require,module,exports){
(function () {
  var h = require('virtual-dom/h');
  var _ = {
    isUndefined: require('lodash.isundefined'),
    forEach    : require('lodash.foreach'),
    isEqual    : require('lodash.isequal'),
    merge      : require('lodash.merge'),
    cloneDeep  : require('lodash.clonedeep')
  };

  function constructor(property, configService, configValue, disabled) {
    var list = [];
    var values = _.merge(_.cloneDeep(property.defaults), configValue, []);
    _.forEach(property.defaults, function (value, index) {
      //values.push(configValue[index]);
      list.push(h('div.form-item', [
        h('div.form-item__label', h('label', {
          title     : property.description,
          'ev-click': function (e) {
            if(!disabled){
              e.target.parentNode.parentNode.querySelector('input').focus();
            }
          }
        }, property.title + ' ' + index + ' :')),
        h('div.form-item__input', h('input', {
          disabled  : disabled,
          'type'    : 'text',
          'placeholder': property.defaults[index],
          'value'   : !_.isUndefined(configValue) && !_.isUndefined(configValue[index]) && configValue[index] !== property.defaults[index] ? configValue[index] : '',
          'ev-input': function (e) {
            values[index] = e.target.value != '' ? e.target.value : property.defaults[index];
            if (_.isEqual(property.defaults, values)) {
              configService.removeValue(property.fullname);
            } else {
              configService.setValue(property.fullname, values);
            }
          }
        }))
      ]))
    });

    return h('div', [
      h('div', h('h4', [property.title])),
      h('div', list)
    ]);
  }

  module.exports = constructor;
})();

},{"lodash.clonedeep":55,"lodash.foreach":59,"lodash.isequal":66,"lodash.isundefined":72,"lodash.merge":77,"virtual-dom/h":105}],158:[function(require,module,exports){
(function () {
    var ColorPicker = require('simple-color-picker');
    var css = require('../../../../node_modules/simple-color-picker/simple-color-picker.css');
    var h = require('virtual-dom/h');
    var _ = {
        isUndefined: require('lodash.isundefined'),
        forEach: require('lodash.foreach'),
        isEqual: require('lodash.isequal'),
        merge: require('lodash.merge'),
        cloneDeep: require('lodash.clonedeep')
    };

    function constructor(property, configService, configValue, disabled) {
        var Hook = function () {
        };
        Hook.prototype.hook = function (node) {

        };
        var list = [];
        var values = _.merge(_.cloneDeep(property.defaults), configValue, []);
        _.forEach(property.defaults, function (value, index) {
            var colorPicker = new ColorPicker({
                background: 'white',
                width: 200
            });
            var test = 'notest';
            list.push(h('div.form-item', [
                h('div.form-item__label', h('label', {
                    title: property.description,
                    'ev-click': function (e) {
                        if (!disabled) {
                            e.target.parentNode.parentNode.querySelector('input').focus();
                        }
                    }
                }, property.title + ' ' + index + ' :')),
                h('div.form-item__input', h('input', {
                    'type': 'text',
                    'hook': new Hook(),
                    'disabled': disabled,
                    'placeholder': property.defaults[index],
                    'value': !_.isUndefined(configValue) && !_.isUndefined(configValue[index]) && configValue[index] !== property.defaults[index] ? configValue[index] : '',
                    'ev-focus': function (e) {
                        colorPicker.setColor(e.target.value? e.target.value : property.defaults[index]);
                        colorPicker.appendTo(e.target.parentNode);
                        colorPicker.onChange(function () {
                            e.target.value = colorPicker.getHexString();
                            values[index] = colorPicker.getHexString();
                            if (_.isEqual(property.defaults, values)) {
                                configService.removeValue(property.fullname);
                            } else {
                                configService.setValue(property.fullname, values);
                            }
                        });
                        e.target.onblur = function () {
                            colorPicker.remove();
                            e.target.onblur = undefined;
                        }
                    }
                }))
            ]))
        });
        return h('div', [
            h('div', h('h4', [property.title])),
            h('div', list)
        ]);
    }

    module.exports = constructor;
})();

},{"../../../../node_modules/simple-color-picker/simple-color-picker.css":96,"lodash.clonedeep":55,"lodash.foreach":59,"lodash.isequal":66,"lodash.isundefined":72,"lodash.merge":77,"simple-color-picker":95,"virtual-dom/h":105}],159:[function(require,module,exports){
(function () {
  var h = require('virtual-dom/h');
  var _ = {
    isUndefined: require('lodash.isundefined'),
    forEach    : require('lodash.foreach'),
    isEqual    : require('lodash.isequal'),
    merge      : require('lodash.merge'),
    cloneDeep  : require('lodash.clonedeep')
  };

  function constructor(property, configService, configValue, propertyService) {
    var list = [];
    _.forEach(configValue, function(value, index){
      var optionsList = [];
      var title = h('div.title',[h('h4', '' + (index + 1)), removeButton(property.fullname + '.' + index)]);
      _.forEach(property.options, function(option){
        var fullnamePartial = option.fullname.split(property.title)[1];
        optionsList.push(propertyService.get(option, configService, property.fullname + '.' + index + fullnamePartial))
      });
      list.push(h('div.item', [title, h('div.options', optionsList)]))
    });

    function removeButton(name){
      return h('button.btn.btn--small', {
        'ev-click': function () {
          configService.removeValue(name);
        }
      }, 'remove')
    }

    function addButton(type, typeConfig, label) {
      return h('button.btn.btn--small', {
        'ev-click': function () {
          if(typeof typeConfig == 'undefined'){
            configService.setValue(type, []);
            configService.setValue(type + '.' + 0, {});
          } else {
            configService.setValue(type + '.' + typeConfig.length, {});
          }

        }
      }, 'add ' + label)
    }

    return h('div.objectArray', [
      h('div.title', [h('h4', [property.title]), addButton(property.fullname, configValue, property.title)]),
      h('div.list', list)
    ]);
  }
  module.exports = constructor;

})();

},{"lodash.clonedeep":55,"lodash.foreach":59,"lodash.isequal":66,"lodash.isundefined":72,"lodash.merge":77,"virtual-dom/h":105}],160:[function(require,module,exports){
(function () {
  var h = require('virtual-dom/h');
  var _ = {
    isString: require('lodash.isstring'),
    isUndefined: require('lodash.isundefined')
  };

  function constructor(property, configService, configValue, disabled) {

    if (_.isString(configValue)) {
      configValue = configValue == 'true';
    }
    property.defaults = property.defaults === 'true';

    return h('div.form-item', [
      h('div.form-item__label', h('label', {
        title     : property.description,
        'ev-click': function (e) {
          if(!disabled) {
            var _checkbox = e.target.parentNode.parentNode.querySelector('input');
            var _val = _checkbox.checked;
            _checkbox.checked = !_val;
            if (property.defaults !== !_val) {
              configService.setValue(property.fullname, !_val);
            } else {
              configService.removeValue(property.fullname);
            }
          }
        }
      }, [property.title])),
      h('div.form-item__input', h('input', {
        disabled  : disabled,
        'type'    : 'checkbox',
        'checked': _.isUndefined(configValue) ? property.defaults : !property.defaults,
        'ev-click': function (e) {
          if (property.defaults !== e.target.checked) {
            configService.setValue(property.fullname, e.target.checked);
          } else {
            configService.removeValue(property.fullname);
          }
        }
      }))
    ]);
  }

  module.exports = constructor;
})();

},{"lodash.isstring":71,"lodash.isundefined":72,"virtual-dom/h":105}],161:[function(require,module,exports){
(function () {
    var h = require('virtual-dom/h');

    function constructor(property, configService, configValue, disabled) {
        return h('div.form-item', [
            h('div.form-item__label', h('label', {
                title: property.description,
                'ev-click': function (e) {
                    if (!disabled) {
                        e.target.parentNode.parentNode.querySelector('input').focus();
                    }
                }
            }, [property.title])),
            h('div.form-item__input', h('input', {
                disabled: disabled,
                'placeholder': property.defaults,
                'type': 'number',
                'value': typeof configValue !== 'undefined' ? configValue : "",
                'ev-blur': function (e) {
                    if (e.target.value !== '') {
                        configService.setValue(property.fullname, parseInt(e.target.value));
                    } else {
                        configService.removeValue(property.fullname);
                    }
                }
            }))
        ]);
    }

    module.exports = constructor;
})();
},{"virtual-dom/h":105}],162:[function(require,module,exports){
(function () {
  var h = require('virtual-dom/h');
  var _ = {
    forEach: require('lodash.foreach')
  };

  function constructor(property, configService, configValue, disabled) {
    var options = [];
    values = property.values.replace(/\[|\]|\"|\s/g, '').split(',');
    _.forEach(values, function (value) {
      var selected = value == configValue;

      var item = h('option', {
        value   : value,
        selected: selected
      }, value === 'null' ? '' : value);
      options.push(item);
    });

    return h('div.form-item', [
      h('div.form-item__label', h('label', {
        title     : property.description,
        'ev-click': function (e) {
          if(!disabled) {
            e.target.parentNode.parentNode.querySelector('select').focus();
          }
        }
      }, [property.title])),
      h('div.form-item__input', h('select', {
        disabled  : disabled,
        'ev-input': function (e) {
          if (e.target.value === 'null') {
            configService.removeValue(property.fullname);
          } else {
            configService.setValue(property.fullname, e.target.value);
          }
        }
      }, options))
    ]);
  }

  module.exports = constructor;
})();

},{"lodash.foreach":59,"virtual-dom/h":105}],163:[function(require,module,exports){
(function () {
  var h = require('virtual-dom/h');

  function constructor(property, configService, configValue, disabled, defaultValue) {
    return h('div.form-item', [
      h('div.form-item__label', h('label', {
        title: property.description,
        'ev-click': function (e) {
          if(!disabled) {
            e.target.parentNode.parentNode.querySelector('input').focus();
          }
        }
      }, [property.title])),
      h('div.form-item__input', h('input', {
        disabled  : disabled,
        'type'    : 'text',
        'placeholder' : property.defaults,
        'value': configValue ? configValue : '',
        'ev-input': function (e) {
          if (e.target.value !== '') {
            configService.setValue(property.fullname, e.target.value);
          } else {
            configService.removeValue(property.fullname);
          }
        }
      }))
    ]);
  }

  module.exports = constructor;
})();

},{"virtual-dom/h":105}],164:[function(require,module,exports){
(function () {
    var that = {};
    var _ = {
        isUndefined: require('lodash.isundefined'),
        find: require('lodash.find'),
        map: require('lodash.map'),
        cloneDeep: require('lodash.clonedeep'),
        remove: require('lodash.remove'),
        forEach: require('lodash.foreach'),
        first: require('lodash.first'),
        union: require('lodash.union'),
        slice: require('lodash.slice'),
        drop: require('lodash.drop'),
        size: require('lodash.size'),
        isArray: require('lodash.isarray'),
        isEmpty: require('lodash.isempty'),
        merge: require('lodash.merge')
    };

    that.get = function (data, config, labels, categories, series) {
        var object = generateDataSeries(config, data);
        if (labels.categories) {
            object = setCategories(object, categories);
        }
        if (labels.series) {
            object = setSeries(object, series);
        }
        return object;
    };


    function setCategories(series, categorieLabels) {
        _.forEach(series, function (item, index) {
            _.forEach(item.data, function (row, dataIndex) {
                // depending on the notation we add it to the array or set its as property
                if(series[index]['data'][dataIndex].isArray){
                    series[index]['data'][dataIndex] = _.union([categorieLabels[dataIndex]], row);
                } else {
                    series[index]['data'][dataIndex].name = categorieLabels[dataIndex];
                }
            });
        });
        return series;
    }

    function setSeries(series, seriesLabels) {
        seriesLabels = _.remove(seriesLabels, function (n) {
            return !_.isEmpty(n);
        });

        _.forEach(series, function (item, index) {
            if (_.isUndefined(series[index].name)) {
                series[index].name = seriesLabels[index];
            }
        });

        return series;
    }

    function generateEmptySeries(series, defaultType, size, animation) {
        var array = [];
        var index = 0;
        while (size > 0) {
            var object = {};
            // look for settings for the series;
            if (series && series[index]) {
                object = _.merge(object, series[index]);
            } else {
                object.type = defaultType;
            }
            object.animation = animation ? animation : false;
            object.data = [];
            size = size - getValuesPerPoint(object.type).points;
            array.push(object);
            index++;
        }

        return array;
    }

    function generateDataSeries(config, data) {
        // check for series config for the data and apply this
        var configClone = _.cloneDeep(config);
        var emptySeries = generateEmptySeries(configClone.series, configClone.chart.type, _.size(_.first(data)), configClone.chart.animation);
        return _.map(emptySeries, function (item, index) {
            var vpp = getValuesPerPoint(_.isUndefined(item.type) || item.type === null ? config.chart.type : item.type);
            _.forEach(data, function (row, rowIndex) {
                var cell = {};
                var points = parseDataFloat(_.slice(row, 0, vpp.points));
                // check for turboThreshold
                if(data.length >= 1000){
                    cell = points;
                } else {

                    _.forEach(vpp.definition, function(label, pointIndex){
                        if( points[pointIndex] !== 'null'){
                            cell[label] = points[pointIndex];
                        } else {
                            cell[label] = null;
                        }
                    });
                    if (!_.isUndefined(configClone.series) && !_.isUndefined(configClone.series[index]) && !_.isUndefined(configClone.series[index].data)) {
                        cell = _.merge(configClone.series[index].data, cell);
                    }
                }
                item.data.push(cell);
                data[rowIndex] = _.drop(data[rowIndex], vpp.points);
            });
            return item;
        });
    }


    function getValuesPerPoint(type) {
        var vpp;
        switch (type) {
            case 'scatter':
                vpp = {
                    points: 2,
                    definition: ['x', 'y']
                };
                break;
            case 'bubble':
                vpp = {
                    points: 3,
                    definition: ['x', 'y', 'z']
                };
                break;
            case 'heatmap':
                vpp = {
                    points: 2,
                    definition: ['y', 'value']
                };
                break;
            case 'boxplot':
                vpp = {
                    points: 5,
                    definition: ['low', 'q1', 'median', 'q3', 'high']
                };
                break;
            case 'errorbar':
            case 'areasplinerange':
            case 'arearange':
            case 'columnrange':
                vpp = {
                    points: 2,
                    definition: ['low', 'high']
                };
                break;
            case 'line':
            case 'spline':
            case 'treemap':
            case 'solidgauge':
            case 'polygon':
            case 'pyramid':
            case 'pie':
            case 'funnel':
            case 'gauge':
            case 'areaspline':
            case 'waterfall':
            case 'column':
            case 'bar':
                vpp = {
                    points: 1,
                    definition: ['y']
                };
                break;
            default:
                vpp = {
                    points: 1,
                    definition: ['y']
                };
                break;
        }
        return vpp;
    }

    function parseDataFloat(data) {
        var newData = [];
        _.forEach(data, function (value, index) {
            if (_.isArray(value)) {
                newData[index] = parseDataFloat(value);
            }
            else {
                newData[index] = value === '' || value === 'null' || isNaN(value) || value === null ? null : parseFloat(value);
            }
        });
        return newData;
    }

    module.exports = that;
})();

},{"lodash.clonedeep":55,"lodash.drop":56,"lodash.find":57,"lodash.first":58,"lodash.foreach":59,"lodash.isarray":64,"lodash.isempty":65,"lodash.isundefined":72,"lodash.map":76,"lodash.merge":77,"lodash.remove":78,"lodash.size":81,"lodash.slice":83,"lodash.union":86}],165:[function(require,module,exports){

(function () {
    function constructor(services){
        // data
        function setData (data){
            services.data.set(data);
        }
        function getData (){
            return services.data.get();
        }
        // data csv
        function setDataCSV(csv){
            services.data.setCSV(csv);
        }
        // data url
        function setDataUrl(url){
            services.data.setUrl(url);
        }
        function getDataUrl(){
            return services.data.getUrl();
        }
        // options
        function setOptions(options){
            services.options.set(options);
        }
        function getOptions(){
            return services.options.get();
        }
        function setOptionsUrl(url){
            services.options.setUrl(url);
        }
        function getOptionsUrl(){
            return services.options.getUrl();
        }
        // templates
        function setTemplates(templates){
            services.templates.set(templates);
        }
        function getTemplates(){
            return services.templates.get();
        }
        // config
        function setConfig(config){
            services.config.set(config);
        }
        function getConfig(config){
            return services.config.getRaw(config);
        }

        // presets
        function setPresets(presets){
            services.config.setPresets(presets);
        }
        function getPresets(presets){
            services.config.getPresets(presets);
        }
        // events
        function on(event, callback){
            services.mediator.on(event, function (data) {
                callback(data);
            });
        }

        return {
            setData:setData,
            getData:getData,
            setDataUrl:setDataUrl,
            getDataUrl:getDataUrl,
            setDataCSV: setDataCSV,
            setOptions:setOptions,
            getOptions: getOptions,
            setTemplates:setTemplates,
            getTemplates:getTemplates,
            setConfig:setConfig,
            getConfig:getConfig,
            setOptionsUrl:setOptionsUrl,
            getOptionsUrl:getOptionsUrl,
            setPresets:setPresets,
            getPresets:getPresets,
            on:on
        }
    }

    module.exports = constructor;
})();

},{}],166:[function(require,module,exports){
(function () {
    function constructor(mediator, data) {
        var _ = {
            isUndefined: require('lodash.isundefined'),
            find: require('lodash.find'),
            cloneDeep: require('lodash.clonedeep'),
            forEach: require('lodash.foreach'),
            merge: require('lodash.merge'),
            isEmpty: require('lodash.isempty')
        };
        var series = require('../factories/series.js');
        var that = {};
        var presets = {
            chart:{

            },
            xAxis:[{
            }],
            yAxis:[{
            }]
        };


        var config = _.cloneDeep(presets);
        var configCache;
        that.get = function () {
            var labels = hasLabels(data.get());
            var object = _.merge(_.cloneDeep(config), _.cloneDeep(presets));
            object.series = series.get(data.getData(labels.series, labels.categories), object, labels, data.getCategories(), data.getSeries());
            configCache = _.cloneDeep(object);
            return configCache;
        };

        that.getRaw = function () {
            return _.cloneDeep(config);
        };

        that.set = function (_config_) {
            delete _config_.series;
            config = _.cloneDeep(_config_);
        };

        that.setValue = function (path, value) {
            var ids = path.split('.');
            var step;
            var object = config;
            while (step = ids.shift()) {
                if (ids.length > 0) {
                    if (!_.isUndefined(object[step])) {
                        object = object[step];
                    } else {
                        object[step] = {};
                        object = object[step];
                    }
                } else {
                    object[step] = value;
                }
            }
            configUpdate();
        };

        that.setValues = function (array) {
            _.forEach(array, function (row) {
                that.setValue(row[0], row[1]);
            });
            configUpdate();
        };

        that.getValue = function (path) {
            var object = that.get();
            path = path.split('.');
            var step;
            while (step = path.shift()) {
                if (!_.isUndefined(object[step])) {
                    object = object[step];
                } else {
                    object = undefined;
                    break;
                }
            }
            return object;
        };

        that.isEditable = function (path) {
            var object = _.cloneDeep(presets);
            path = path.split('.');
            var step;
            while (step = path.shift()) {
                if (!_.isUndefined(object[step])) {
                    object = object[step];
                } else {
                    object = undefined;
                    break;
                }
            }
            return _.isUndefined(object);
        };

        that.removeValue = function (path) {
            var temp = config;
            path = path.split('.');
            while (step = path.shift()) {
                if (!_.isUndefined(temp[step])) {
                    if (path.length > 0) {
                        temp = temp[step];
                    } else {
                        if(Object.prototype.toString.call( temp ) === '[object Array]'){
                            temp.splice(step, 1);
                        } else {
                            delete temp[step];
                        }
                    }
                }
            }
            configUpdate();
        };

        that.loadTemplate = function (template) {
            config = _.merge(template, _.cloneDeep(presets));
            configUpdate();
        };

        that.setPresets = function (_presets_) {
            presets = _presets_;
            configUpdate();
        };

        that.getPresets = function () {
            return _.cloneDeep(presets);
        };

        function hasLabels(data) {
            var labels = {
                categories: false,
                series: true
            };
            if (data[0]) {
                // if the first cell is empty, make the assumption that the first column are labels.
                if (_.isEmpty(data[0][0]) || data[0][0] == 'cat' || data[0][0] == 'categories') {
                    labels.categories = true;
                } else {
                    labels.categories = false;
                }
            }
            return labels;
        }

        function configUpdate(){
            mediator.trigger('configUpdate', that.get());
        }

        mediator.on('dataUpdate', function(data){
            configUpdate();
        });

        return that;

    }

    module.exports = constructor;
})();
},{"../factories/series.js":164,"lodash.clonedeep":55,"lodash.find":57,"lodash.foreach":59,"lodash.isempty":65,"lodash.isundefined":72,"lodash.merge":77}],167:[function(require,module,exports){
(function () {
    function constructor (_mediator_){
        var mediator = _mediator_;
        var xhr = require("xhr");
        var _ = {
            isUndefined: require('lodash.isundefined'),
            find: require('lodash.find'),
            map: require('lodash.map'),
            cloneDeep: require('lodash.clonedeep'),
            slice: require('lodash.slice'),
            forEach: require('lodash.foreach'),
            first: require('lodash.first'),
            isEqual: require('lodash.isequal'),
            isNaN: require('lodash.isnan')
        };
        var papa = require('papaparse');
        var that = {};
        var dataSet = [];
        var dataUrl;

        that.getSeries = function () {
            return _.cloneDeep(_.first(dataSet));
        };

        that.getCategories = function () {
            return _.cloneDeep(_.map(_.slice(dataSet, 1), function (row) {
                return _.first(row);
            }));
        };

        that.get = function () {
            return _.cloneDeep(dataSet);
        };

        that.getData = function (series, categories) {
            var data = _.cloneDeep(dataSet);

            if (series) {
                data = _.slice(data, 1);
            }

            if (categories) {
                data = _.map(data, function (row) {
                    row.shift();
                    return row;
                });
            }

            return _.cloneDeep(data);
        };

        that.set = function (newDataSet, init) {
            if (!_.isEqual(dataSet, newDataSet)) {
                if(!init){
                    mediator.trigger('backup', _.cloneDeep(dataSet));
                }
                dataSet = _.cloneDeep(newDataSet);
                var data = that.get();
                mediator.trigger('dataUpdate', data);
                dataUrl = undefined;
            }
        };

        that.revert = function(oldDataSet){
            if (!_.isEqual(dataSet, oldDataSet)) {
                dataSet = oldDataSet;
                mediator.trigger('dataUpdate', _.cloneDeep(dataSet));
            }
        };

        mediator.on('backup.revert', that.revert);

        that.setValue = function(row, cell, value){
            if(!_.isUndefined(dataSet[row]) && !_.isUndefined(dataSet[row][cell])){
                mediator.trigger('backup',_.cloneDeep(dataSet));
                dataSet[row][cell] = _.isNaN(value) ? null : value;
            }
            mediator.trigger('dataUpdate', _.cloneDeep(dataSet));
            dataUrl = undefined;
        };

        that.setCSV = function(csv, init){
            if(!init){
                mediator.trigger('backup', _.cloneDeep(dataSet));
            }
            dataSet = papa.parse(csv).data;
            mediator.trigger('dataUpdate', dataSet);
            dataUrl = undefined;
        };


        that.getUrl = function (){
            return _.cloneDeep(dataUrl);
        };

        that.setUrl = function(url, init){
            if(url !== ''){
                xhr.get(url, function(err, resp){

                    if (resp.statusCode == "200") {
                        if(!init){
                            mediator.trigger('backup', _.cloneDeep(dataSet));
                        }
                        dataSet = papa.parse(resp.body).data;
                        dataUrl = url;

                        mediator.trigger('dataUpdate', _.cloneDeep(dataSet));
                    }
                    else {
                        dataUrl = undefined;
                    }
                })
            } else {
                dataUrl = undefined;
            }
        };

        return that;
    }
    module.exports = constructor;
})
();


},{"lodash.clonedeep":55,"lodash.find":57,"lodash.first":58,"lodash.foreach":59,"lodash.isequal":66,"lodash.isnan":69,"lodash.isundefined":72,"lodash.map":76,"lodash.slice":83,"papaparse":89,"xhr":132}],168:[function(require,module,exports){
var _ = {
    forEach: require('lodash.foreach')
};

function constructor(opts, services) {

    if(typeof opts.data !== 'undefined'){
        services.data.set(opts.data, true);
    }
    if(typeof opts.dataCSV !== 'undefined'){
        services.data.setCSV(opts.dataCSV, true);
    }
    if(typeof opts.dataUrl !== 'undefined'){
        services.data.setUrl(opts.dataUrl, true);
    }
    if(typeof opts.options !== 'undefined'){
        services.options.set(opts.options);
    }
    if(typeof opts.optionsUrl !== 'undefined'){
        services.options.setUrl(opts.optionsUrl);
    }
    if(typeof opts.templates !== 'undefined'){
        services.templates.set(opts.templates);
    }
    if(typeof opts.config !== 'undefined'){
        services.config.set(opts.config);
    }
    if(typeof opts.presets !== 'undefined'){
        services.config.setPresets(opts.presets);
    }
    if(typeof opts.events !== 'undefined'){
        _.forEach(opts.events, function(callback, event){
            services.mediator.on(event, function (data) {
                callback(data);
            });
        });
    }
}

module.exports = constructor;

},{"lodash.foreach":59}],169:[function(require,module,exports){
(function () {
    /**
     * Service for setting and getting the customisable options list for the customise page.
     * @param mediator
     * @returns {{}}
     */
    var constructor = function (mediator){
        var options = require('../config/options.json');
        var configUrl;
        var that = {};

        var xhr = require("xhr");
        var _ = {
            cloneDeep: require('lodash.clonedeep')
        };
        that.get = function(){
            return _.cloneDeep(options);
        };

        that.set = function(_options_){
            options = _.cloneDeep(_options_);
        };

        that.setUrl = function(url){
            if(url !== ''){
                xhr.get(url, function(err, resp){
                    if (resp.statusCode === 200) {
                        options = JSON.parse(resp.body);
                        configUrl = url;
                        mediator.trigger('configUpdate', that.get());
                    }
                });
            } else {
                configUrl = undefined;
            }
        };


        that.getUrl = function(){
            return _.cloneDeep(configUrl);
        };

        return that;
    };
    module.exports = constructor;
})();

},{"../config/options.json":153,"lodash.clonedeep":55,"xhr":132}],170:[function(require,module,exports){
function constructor(mediator) {
    var undoAmount = 5;
    var backup = [];
    var _ = {
        cloneDeep: require('lodash.clonedeep')
    };

    mediator.on('backup',function(value){
        backup.push({
            time: Date.now(),
            value: value
        });
        mediator.trigger('backup.list.update', getList());
        if (backup.length > undoAmount){
            backup.shift();
        }
    });

    mediator.on('backup.revert.last',function(value){
        revertLastChange();
    });

    function revertLastChange(){
        var slice = backup.pop();
        if(slice){
            mediator.trigger('backup.revert', slice.value);
            mediator.trigger('backup.list.update', getList());
        }
    }

    function getList(){
        return _.cloneDeep(backup);
    }

    return {
        revertLastChange: revertLastChange,
        getList: getList
    }
}

module.exports = constructor;
},{"lodash.clonedeep":55}],171:[function(require,module,exports){
(function () {
    var h = require('virtual-dom/h');
    var diff = require('virtual-dom/diff');
    var patch = require('virtual-dom/patch');
    var createElement = require('virtual-dom/create-element');
    var logo = require('./../templates/logo');

    var mainLoop = require("main-loop");
    var _ = {
        keys: require('lodash.keys')
    };

    function constructor(element, states, services) {
        var initState = {
            links: _.keys(states)
        };

        var loop = mainLoop(initState, render, {
            create: require("virtual-dom/create-element"),
            diff: require("virtual-dom/diff"),
            patch: require("virtual-dom/patch")
        });
        var revisionElement = require('./../components/revision')(services.mediator, services.revision.getList());

        element.appendChild(loop.target);

        function goToState(state) {
            var newState = loop.state;
            if (loop.state.destroy && newState.dependencies) {
                loop.state.destroy(newState.dependencies);
            }
            newState.dependencies = states[state].dependencies();
            newState.template = states[state].template;
            newState.title = states[state].title;
            newState.destroy = states[state].destroy;
            loop.update(newState);
        }

        function render(state) {
            if (state.dependencies && state.template) {
                return h('div', [
                    h('div.header', [
                        logo,
                        h('div.navigation.accordion-tabs-minimal',[
                            h('ul.tab-list', state.links.map(function (id) {
                                var className = state.title === states[id].title ? 'is-active' : '';
                                return h('li.tab-link', {
                                    'className': className
                                }, h('a', {
                                    'href': '#' + id,
                                    'ev-click': function (e) {
                                        e.preventDefault();
                                        goToState(id);
                                    }
                                }, states[id].title))
                            }))
                        ])
                    ]),
                    h('div.left', state.template(state.dependencies))
                ])
            } else {
                return h('div', logo)
            }
        }

        services.mediator.on('treeUpdate', function () {
            loop.update(loop.state);
        });

        // chart stuff
        var chartElement;
        var chart = require('./../components/chart.js');

        chartElement = createElement(h('div.right', {id: 'chartContainer'}));
        element.appendChild(chartElement);
        chart.load(chartElement, services);
        element.appendChild(revisionElement.template());
        return {
            goToState: goToState
        };
    }

    module.exports = constructor;
})();
},{"./../components/chart.js":138,"./../components/revision":150,"./../templates/logo":173,"lodash.keys":73,"main-loop":87,"virtual-dom/create-element":103,"virtual-dom/diff":104,"virtual-dom/h":105,"virtual-dom/patch":106}],172:[function(require,module,exports){
(function () {
    function constructor(){
        var templates = require('../config/templates');
        var that = {};
        var _ = {
            cloneDeep: require('lodash.clonedeep')
        };
        that.get = function(){
            return _.cloneDeep(templates);
        };

        that.set = function(_templates_){
            templates = _templates_;
        };
        return that;
    }

    module.exports = constructor;
})();

},{"../config/templates":154,"lodash.clonedeep":55}],173:[function(require,module,exports){
(function () {
    var h = require('virtual-dom/h');
    var iconLoader = require('../factories/iconLoader');
    var logo = iconLoader.get('logo');
    logo.properties.height = '50px';
    module.exports = h('div.logo',[logo]);
})();

},{"../factories/iconLoader":155,"virtual-dom/h":105}]},{},[137]);