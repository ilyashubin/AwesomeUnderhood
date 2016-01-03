(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// get successful control from form and assemble into object
// http://www.w3.org/TR/html401/interact/forms.html#h-17.13.2

// types which indicate a submit action and are not successful controls
// these will be ignored
var k_r_submitter = /^(?:submit|button|image|reset|file)$/i;

// node names which could be successful controls
var k_r_success_contrls = /^(?:input|select|textarea|keygen)/i;

// Matches bracket notation.
var brackets = /(\[[^\[\]]*\])/g;

// serializes form fields
// @param form MUST be an HTMLForm element
// @param options is an optional argument to configure the serialization. Default output
// with no options specified is a url encoded string
//    - hash: [true | false] Configure the output type. If true, the output will
//    be a js object.
//    - serializer: [function] Optional serializer function to override the default one.
//    The function takes 3 arguments (result, key, value) and should return new result
//    hash and url encoded str serializers are provided with this module
//    - disabled: [true | false]. If true serialize disabled fields.
//    - empty: [true | false]. If true serialize empty fields
function serialize(form, options) {
    if (typeof options != 'object') {
        options = { hash: !!options };
    }
    else if (options.hash === undefined) {
        options.hash = true;
    }

    var result = (options.hash) ? {} : '';
    var serializer = options.serializer || ((options.hash) ? hash_serializer : str_serialize);

    var elements = form && form.elements ? form.elements : [];

    //Object store each radio and set if it's empty or not
    var radio_store = Object.create(null);

    for (var i=0 ; i<elements.length ; ++i) {
        var element = elements[i];

        // ingore disabled fields
        if ((!options.disabled && element.disabled) || !element.name) {
            continue;
        }
        // ignore anyhting that is not considered a success field
        if (!k_r_success_contrls.test(element.nodeName) ||
            k_r_submitter.test(element.type)) {
            continue;
        }

        var key = element.name;
        var val = element.value;

        // we can't just use element.value for checkboxes cause some browsers lie to us
        // they say "on" for value when the box isn't checked
        if ((element.type === 'checkbox' || element.type === 'radio') && !element.checked) {
            val = undefined;
        }

        // If we want empty elements
        if (options.empty) {
            // for checkbox
            if (element.type === 'checkbox' && !element.checked) {
                val = '';
            }

            // for radio
            if (element.type === 'radio') {
                if (!radio_store[element.name] && !element.checked) {
                    radio_store[element.name] = false;
                }
                else if (element.checked) {
                    radio_store[element.name] = true;
                }
            }

            // if options empty is true, continue only if its radio
            if (!val && element.type == 'radio') {
                continue;
            }
        }
        else {
            // value-less fields are ignored unless options.empty is true
            if (!val) {
                continue;
            }
        }

        // multi select boxes
        if (element.type === 'select-multiple') {
            val = [];

            var selectOptions = element.options;
            var isSelectedOptions = false;
            for (var j=0 ; j<selectOptions.length ; ++j) {
                var option = selectOptions[j];
                var allowedEmpty = options.empty && !option.value;
                var hasValue = (option.value || allowedEmpty);
                if (option.selected && hasValue) {
                    isSelectedOptions = true;

                    // If using a hash serializer be sure to add the
                    // correct notation for an array in the multi-select
                    // context. Here the name attribute on the select element
                    // might be missing the trailing bracket pair. Both names
                    // "foo" and "foo[]" should be arrays.
                    if (options.hash && key.slice(key.length - 2) !== '[]') {
                        result = serializer(result, key + '[]', option.value);
                    }
                    else {
                        result = serializer(result, key, option.value);
                    }
                }
            }

            // Serialize if no selected options and options.empty is true
            if (!isSelectedOptions && options.empty) {
                result = serializer(result, key, '');
            }

            continue;
        }

        result = serializer(result, key, val);
    }

    // Check for all empty radio buttons and serialize them with key=""
    if (options.empty) {
        for (var key in radio_store) {
            if (!radio_store[key]) {
                result = serializer(result, key, '');
            }
        }
    }

    return result;
}

function parse_keys(string) {
    var keys = [];
    var prefix = /^([^\[\]]*)/;
    var children = new RegExp(brackets);
    var match = prefix.exec(string);

    if (match[1]) {
        keys.push(match[1]);
    }

    while ((match = children.exec(string)) !== null) {
        keys.push(match[1]);
    }

    return keys;
}

function hash_assign(result, keys, value) {
    if (keys.length === 0) {
        result = value;
        return result;
    }

    var key = keys.shift();
    var between = key.match(/^\[(.+?)\]$/);

    if (key === '[]') {
        result = result || [];

        if (Array.isArray(result)) {
            result.push(hash_assign(null, keys, value));
        }
        else {
            // This might be the result of bad name attributes like "[][foo]",
            // in this case the original `result` object will already be
            // assigned to an object literal. Rather than coerce the object to
            // an array, or cause an exception the attribute "_values" is
            // assigned as an array.
            result._values = result._values || [];
            result._values.push(hash_assign(null, keys, value));
        }

        return result;
    }

    // Key is an attribute name and can be assigned directly.
    if (!between) {
        result[key] = hash_assign(result[key], keys, value);
    }
    else {
        var string = between[1];
        var index = parseInt(string, 10);

        // If the characters between the brackets is not a number it is an
        // attribute name and can be assigned directly.
        if (isNaN(index)) {
            result = result || {};
            result[string] = hash_assign(result[string], keys, value);
        }
        else {
            result = result || [];
            result[index] = hash_assign(result[index], keys, value);
        }
    }

    return result;
}

// Object/hash encoding serializer.
function hash_serializer(result, key, value) {
    var matches = key.match(brackets);

    // Has brackets? Use the recursive assignment function to walk the keys,
    // construct any missing objects in the result tree and make the assignment
    // at the end of the chain.
    if (matches) {
        var keys = parse_keys(key);
        hash_assign(result, keys, value);
    }
    else {
        // Non bracket notation can make assignments directly.
        var existing = result[key];

        // If the value has been assigned already (for instance when a radio and
        // a checkbox have the same name attribute) convert the previous value
        // into an array before pushing into it.
        //
        // NOTE: If this requirement were removed all hash creation and
        // assignment could go through `hash_assign`.
        if (existing) {
            if (!Array.isArray(existing)) {
                result[key] = [ existing ];
            }

            result[key].push(value);
        }
        else {
            result[key] = value;
        }
    }

    return result;
}

// urlform encoding serializer
function str_serialize(result, key, value) {
    // encode newlines as \r\n cause the html spec says so
    value = value.replace(/(\r)?\n/g, '\r\n');
    value = encodeURIComponent(value);

    // spaces should be '+' rather than '%20'.
    value = value.replace(/%20/g, '+');
    return result + (result ? '&' : '') + encodeURIComponent(key) + '=' + value;
}

module.exports = serialize;

},{}],2:[function(require,module,exports){
(function (global){
/*!
 * Jump.js 0.3.1 - A small, modern, dependency-free smooth scrolling library.
 * Copyright (c) 2015 Michael Cavalea - https://github.com/callmecavs/jump.js
 * License: MIT
 */
!function(t){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=t();else if("function"==typeof define&&define.amd)define([],t);else{var e;e="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this,e.Jump=t()}}(function(){return function t(e,n,i){function o(s,u){if(!n[s]){if(!e[s]){var a="function"==typeof require&&require;if(!u&&a)return a(s,!0);if(r)return r(s,!0);var f=new Error("Cannot find module '"+s+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[s]={exports:{}};e[s][0].call(l.exports,function(t){var n=e[s][1][t];return o(n?n:t)},l,l.exports,t,e,n,i)}return n[s].exports}for(var r="function"==typeof require&&require,s=0;s<i.length;s++)o(i[s]);return o}({1:[function(t,e,n){"use strict";Object.defineProperty(n,"__esModule",{value:!0}),n["default"]=function(t,e,n,i){return t/=i/2,1>t?n/2*t*t+e:(t--,-n/2*(t*(t-2)-1)+e)},e.exports=n["default"]},{}],2:[function(t,e,n){"use strict";function i(t){return t&&t.__esModule?t:{"default":t}}function o(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}var r=function(){function t(t,e){for(var n=0;n<e.length;n++){var i=e[n];i.enumerable=i.enumerable||!1,i.configurable=!0,"value"in i&&(i.writable=!0),Object.defineProperty(t,i.key,i)}}return function(e,n,i){return n&&t(e.prototype,n),i&&t(e,i),e}}();Object.defineProperty(n,"__esModule",{value:!0});var s=t("./easing"),u=i(s),a=function(){function t(){o(this,t)}return r(t,[{key:"jump",value:function(t){var e=this,n=arguments.length<=1||void 0===arguments[1]?{}:arguments[1];this.start=window.pageYOffset,this.options={duration:n.duration,offset:n.offset||0,callback:n.callback,easing:n.easing||u["default"]},this.distance="string"==typeof t?this.options.offset+document.querySelector(t).getBoundingClientRect().top:t,this.duration="function"==typeof this.options.duration?this.options.duration(this.distance):this.options.duration,requestAnimationFrame(function(t){return e._loop(t)})}},{key:"_loop",value:function(t){var e=this;this.timeStart||(this.timeStart=t),this.timeElapsed=t-this.timeStart,this.next=this.options.easing(this.timeElapsed,this.start,this.distance,this.duration),window.scrollTo(0,this.next),this.timeElapsed<this.duration?requestAnimationFrame(function(t){return e._loop(t)}):this._end()}},{key:"_end",value:function(){window.scrollTo(0,this.start+this.distance),"function"==typeof this.options.callback&&this.options.callback(),this.timeStart=!1}}]),t}();n["default"]=a,e.exports=n["default"]},{"./easing":1}]},{},[2])(2)});
}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _formSerialize = require('form-serialize');

var _formSerialize2 = _interopRequireDefault(_formSerialize);

var _jumpJs = require('jump.js');

var _jumpJs2 = _interopRequireDefault(_jumpJs);

var _hood = require('./hood');

var _hood2 = _interopRequireDefault(_hood);

var d = $(document);
var jump = new _jumpJs2['default']();

/**
 * DOM sync and manipulations
 */

var Face = (function () {
  function Face() {
    _classCallCheck(this, Face);

    this.container = $('.content__tweets');
    this.status = $('.content__status');
    this.settings = $('.header__settings');
    this.select = $('select');

    this.initEvents();
  }

  /**
   * Helpers
   */

  _createClass(Face, [{
    key: 'syncFormControls',
    value: function syncFormControls(params) {
      this.select.find('option[value="' + params.from + '"]').prop('selected', true);
      for (var p in params) {
        $('input[name="' + p + '"][value="' + params[p] + '"]').prop('checked', true);
      }
      this.select.selectOrDie('update');
      this.settings.addClass('is-visible');
    }
  }, {
    key: 'setStatus',
    value: function setStatus(value) {
      this.status.attr('s', value);
      _hood2['default'].status = value;
    }
  }, {
    key: 'clearList',
    value: function clearList() {
      this.container.html('');
      this.setStatus('loading');
    }
  }, {
    key: 'onPageRenderEnd',
    value: function onPageRenderEnd() {
      this.setStatus('loaded');
      $('.content__page').addClass('is-visible');
    }
  }, {
    key: 'renderPage',
    value: function renderPage(ids, currentTweetNumber) {
      this.setStatus('loading');

      var fragment = document.createDocumentFragment();
      var tweets = [];
      ids.forEach(function (id) {
        var tweetEl = $("<div class='content__tweet'>");
        var numberEl = $("<div class='content__tweet-number'>").text(currentTweetNumber++);

        tweetEl.append(numberEl);

        tweets.push(tweetEl[0]);
        fragment.appendChild(tweetEl[0]);
      });

      $("<div class='content__page'>").append(fragment).appendTo(this.container);

      // render tweets itself
      ids.forEach(function (id, i) {
        twttr.widgets.createTweet(id, tweets[i], { linkColor: '#58cb73' }).then(function (e) {
          return d.trigger('tweetRendered');
        });
      });
    }
  }, {
    key: 'onSettingsChange',
    value: function onSettingsChange(isForm) {
      var settings = isForm ? '?' + (0, _formSerialize2['default'])(this.settings[0]) : location.search;

      isForm && history.pushState({ path: settings }, '', settings);
      this.clearList();
      d.trigger('settingsChanged');
    }
  }, {
    key: 'initEvents',
    value: function initEvents() {
      var offset = undefined;
      var cont = this.container[0];
      $(window).on('scroll', debounce(function (e) {
        offset = cont.getBoundingClientRect().bottom - window.innerHeight;
        if (offset > 0 || _hood2['default'].loading || _hood2['default'].status === 'empty' || _hood2['default'].status === 'error') return;
        _hood2['default'].loading = true;
        d.trigger('loadMoreTweets');
      }, 250));

      this.settings.on('change', this.onSettingsChange.bind(this, true));
      $(window).on('popstate', this.onSettingsChange.bind(this, false));

      $('#scrolltop').on('click', function (e) {
        e.preventDefault();
        jump.jump('body', {
          duration: 500
        });
      });

      this.select.selectOrDie();
    }
  }]);

  return Face;
})();

exports['default'] = Face;
function debounce(func, wait, immediate) {
  var timeout;
  return function () {
    var context = this,
        args = arguments;
    var later = function later() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};
module.exports = exports['default'];

},{"./hood":4,"form-serialize":1,"jump.js":2}],4:[function(require,module,exports){
/**
 * Common state object
 */
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = {
  loading: true,
  status: 'ok'
};
module.exports = exports['default'];

},{}],5:[function(require,module,exports){
'use strict';

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _bFace = require('./b/face');

var _bFace2 = _interopRequireDefault(_bFace);

var _bHood = require('./b/hood');

var _bHood2 = _interopRequireDefault(_bHood);

var ref = new Firebase('https://underhood.firebaseio.com/');
var face = new _bFace2['default']();
var d = $(document);

var sortFuncs = {
  favs: function favs(a, b) {
    return b.favs - a.favs;
  },
  rt: function rt(a, b) {
    return b.rt - a.rt;
  }
};

// simple error handler
window.onerror = function (m) {
  return face.setStatus('error');
};

var Underhood = (function () {
  function Underhood() {
    _classCallCheck(this, Underhood);

    this.tweetsToLoad = 84;
    this.tweetsPerPage = 24;

    this.setParams();
    this.loadTweets();
    this.initEvents();
  }

  _createClass(Underhood, [{
    key: 'setParams',
    value: function setParams() {
      this.currentEndingTweet = 0;
      this.current = 0;

      this.params = new URI().search(true);
      this.ids = [];

      this.params.sort = this.params.sort || 'favs';
      this.params.from = this.params.from || 'cssunderhood';
      this.params.timeline = this.params.timeline || 'all';

      if (! ~['favs', 'rt'].indexOf(this.params.sort)) throw new Error('Invalid sortby value.');

      var uhs = ['cssunderhood', 'jsunderhood', 'iamspacegray', 'backendsecret'];
      if (! ~uhs.indexOf(this.params.from)) throw new Error('Invalid underhood type.');

      face.syncFormControls(this.params);
    }
  }, {
    key: 'loadTweets',
    value: function loadTweets() {
      var _this = this;

      if (!this.params.from) throw new Error('Tweets source is not defined.');

      face.setStatus('loading');

      var underhoodRef = ref.child(this.params.from).child('tweets');
      var orderBy = this.params.timeline !== 'all' ? 'time' : this.params.sort;

      underhoodRef.orderByChild(orderBy).limitToLast(this.tweetsToLoad).once('value', function (snap) {
        _this.extractIds(snap.val());
        if (_this.tweetsCount) {
          _this.appendPage();
        } else {
          face.setStatus('empty');
        }
      });
    }
  }, {
    key: 'extractIds',
    value: function extractIds(obj) {
      // convert tweets object to array
      var arr = Object.keys(obj).map(function (key) {
        return obj[key];
      });
      // sort tweets by criteria
      arr = arr.sort(sortFuncs[this.params.sort]);

      if (this.params.timeline !== 'all') {
        (function () {
          var now = new Date();
          var msDaysDivider = 1000 * 60 * 60 * 24;

          arr = arr.filter(function (el) {
            var diff = (now - el.time) / msDaysDivider;
            if (diff > 8) return false;
            return true;
          });
        })();
      }

      this.tweetsCount = arr.length;
      this.ids = arr.map(function (el) {
        return el.id;
      });
    }
  }, {
    key: 'appendPage',
    value: function appendPage() {
      var fr = this.currentEndingTweet;
      var to = fr + this.tweetsPerPage;
      var newPageTweets = this.ids.slice(fr, to);

      face.renderPage(newPageTweets, this.currentEndingTweet + 1);
      this.currentEndingTweet += this.tweetsPerPage;
      this.currentEndingTweet = Math.min(this.currentEndingTweet, this.tweetsCount);
    }
  }, {
    key: 'onSettingsChange',
    value: function onSettingsChange() {
      this.setParams();
      this.loadTweets();
    }
  }, {
    key: 'onTweetRender',
    value: function onTweetRender() {
      var _this2 = this;

      if (++this.current < this.currentEndingTweet) return;

      setTimeout(function () {
        face.onPageRenderEnd();

        if (_this2.current >= _this2.tweetsCount) {
          face.setStatus('end');
          _bHood2['default'].loading = true;
        } else {
          _bHood2['default'].loading = false;
        }
      }, 500);
    }
  }, {
    key: 'initEvents',
    value: function initEvents() {
      d.on({
        tweetRendered: this.onTweetRender.bind(this),
        loadMoreTweets: this.appendPage.bind(this),
        settingsChanged: this.onSettingsChange.bind(this)
      });
    }
  }]);

  return Underhood;
})();

new Underhood();

},{"./b/face":3,"./b/hood":4}]},{},[5])
