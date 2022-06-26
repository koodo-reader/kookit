(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.Kookit = {}));
})(this, (function (exports) { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    class StorageUtil {
        static getKookitConfig(key) {
            let kookitConfig = JSON.parse(localStorage.getItem("kookitConfig")) || {};
            return kookitConfig[key];
        }
        static setKookitConfig(key, value) {
            let kookitConfig = JSON.parse(localStorage.getItem("kookitConfig")) || {};
            kookitConfig[key] = value;
            localStorage.setItem("kookitConfig", JSON.stringify(kookitConfig));
        }
        static removeKookitConfig() {
            localStorage.removeItem("kookitConfig");
        }
    }

    let keywords = [
      "章",
      "节",
      "回",
      "節",
      "卷",
      "部",
      "輯",
      "辑",
      "話",
      "集",
      "话",
      "篇",
    ];
    String.prototype.contains = function (str) {
      return this.indexOf(str) > -1;
    };

    const isTitle = (line, isStartWithKeyword = false) => {
      return (
        line &&
        !line.contains("[") &&
        !line.contains("(") &&
        !line.contains("。") &&
        !line.contains("“") &&
        !line.contains("‘") &&
        !line.contains("；") &&
        !line.contains(";") &&
        (line.startsWith("CHAPTER") ||
          line.startsWith("Chapter") ||
          line.startsWith("序章") ||
          line.startsWith("前言") ||
          line.startsWith("声明") ||
          line.startsWith("聲明") ||
          line.startsWith("写在前面的话") ||
          line.startsWith("后记") ||
          line.startsWith("楔子") ||
          line.startsWith("后序") ||
          line.startsWith("寫在前面的話") ||
          line.startsWith("後記") ||
          line.startsWith("後序") ||
          (line.startsWith("第") && startWithDI(line)) ||
          (line.startsWith("卷") && startWithJUAN(line)) ||
          (!isStartWithKeyword &&
            line.contains("第") &&
            (line[line.indexOf("第") - 1] === " " ||
              line[line.indexOf("第") - 1] === "　" ||
              line[line.indexOf("第") - 1] === "、" ||
              line[line.indexOf("第") - 1] === "：" ||
              line[line.indexOf("第") - 1] === ":") &&
            startWithDI(line.substr(line.indexOf("第")))) ||
          (!isStartWithKeyword &&
            line.indexOf(" ") &&
            startWithNumAndSpace(line)) ||
          (!isStartWithKeyword &&
            line.indexOf("　") &&
            startWithNumAndSpace(line)) ||
          (!isStartWithKeyword &&
            line.indexOf("、") &&
            startWithNumAndPause(line)) ||
          (!isStartWithKeyword &&
            line.indexOf("：") &&
            startWithNumAndColon(line)) ||
          (!isStartWithKeyword && line.indexOf(":") && startWithNumAndColon(line)))
      );
    };
    const startWithDI = (line) => {
      let flag = false;
      for (let i = 0; i < keywords.length; i++) {
        if (
          (line.indexOf(keywords[i]) > -1 &&
            (line[line.indexOf(keywords[i]) + 1] === " " ||
              line[line.indexOf(keywords[i]) + 1] === "　" ||
              line[line.indexOf(keywords[i]) + 1] === "、" ||
              line[line.indexOf(keywords[i]) + 1] === "：" ||
              line.indexOf("章") > -1 ||
              line[line.indexOf(keywords[i]) + 1] === ":")) ||
          !line[line.indexOf(keywords[i]) + 1]
        ) {
          if (
            /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
              line.substring(1, line.indexOf(keywords[i])).trim()
            ) ||
            /^\d+$/.test(line.substring(1, line.indexOf(keywords[i])).trim())
          ) {
            flag = true;
          }
          if (flag) break;
        }
      }
      return flag;
    };
    const startWithJUAN = (line) => {
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
          line.substring(1, line.indexOf(" "))
        ) ||
        /^\d+$/.test(line.substring(1, line.indexOf(" ")))
      )
        return true;
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
          line.substring(1, line.indexOf("　"))
        ) ||
        /^\d+$/.test(line.substring(1, line.indexOf("　")))
      )
        return true;
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
          line.substring(1)
        ) ||
        /^\d+$/.test(line.substring(1))
      )
        return true;
      return false;
    };

    const startWithNumAndSpace = (line) => {
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
          line.substring(0, line.indexOf(" "))
        )
      )
        return true;
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
          line.substring(0, line.indexOf("　"))
        )
      )
        return true;

      if (/^\d+$/.test(line.substring(0, line.indexOf(" ")))) return true;
      if (/^\d+$/.test(line.substring(0, line.indexOf("　")))) return true;
      return false;
    };
    const startWithNumAndColon = (line) => {
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
          line.substring(0, line.indexOf(":"))
        )
      )
        return true;
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
          line.substring(0, line.indexOf("："))
        )
      )
        return true;

      if (/^\d+$/.test(line.substring(0, line.indexOf(":")))) return true;
      if (/^\d+$/.test(line.substring(0, line.indexOf("：")))) return true;
      return false;
    };
    const startWithNumAndPause = (line) => {
      if (
        /^[\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d\u5341\u767e\u5343\u4e07\u842c]+$/.test(
          line.substring(0, line.indexOf("、"))
        )
      )
        return true;

      if (/^\d+$/.test(line.substring(0, line.indexOf("、")))) return true;
      return false;
    };
    const isNodeTitle = (chapterDoc) => {
      let isTitleNodeExist =
        chapterDoc.querySelectorAll("h1,h2,h3,h4,blockquote,font,b").length > 0;

      let titleNodeList = chapterDoc.querySelectorAll(
        "h1,h2,h3,h4,blockquote,font,b"
      );
      let textNodeList = chapterDoc.getElementsByTagName("p");
      let firstValidTitle;

      for (let i = 0; i < titleNodeList.length; i++) {
        let isSpecial =
          firstValidTitle &&
          isSpecialChar(titleNodeList[i].innerText) &&
          isKeyword(titleNodeList[i].innerText);
        if (titleNodeList[i].innerText.trim() && !isSpecial) {
          firstValidTitle = titleNodeList[i];
          break;
        }
      }
      for (let i = 0; i < textNodeList.length; i++) {
        if (
          textNodeList[i].innerText.trim() &&
          textNodeList[i].innerHTML.indexOf("<") === -1
        ) {
          break;
        }
      }

      let titleNodeExceedLength =
        firstValidTitle && firstValidTitle.innerText.trim().length > 30;
      let isTextLengthLarge = chapterDoc.body.innerText.length > 50;
      return (
        isTitleNodeExist &&
        (!titleNodeExceedLength || isTitle(firstValidTitle.innerText.trim())) &&
        isTextLengthLarge
      );
    };
    const isSpecialChar = (title) => {
      return (
        title.trim() === "♦" ||
        title.trim() === "●" ||
        title.trim() === "◾" ||
        title.trim() === "◀" ||
        title.trim() === "◼" ||
        title.trim() === "■"
      );
    };
    const isKeyword = (title) => {
      return (
        title.trim() === "|" ||
        title.trim() === "Next" ||
        title.trim() === "Main menu" ||
        title.trim() === "Section menu" ||
        title.trim() === "Previous"
      );
    };

    var global$1 = window;
    window.a = window.atob;
    const getTitle = () => {
        return new Promise((resolve, reject) => {
            resolve(global$1.e(global$1.a("ZG9jdW1lbnQudGl0bGU" + String.fromCharCode(61))));
        });
    };
    // var b = global.a("ZG8gUmU" + String.fromCharCode(61));
    String.prototype.c = function (str) {
        return this.indexOf(str) > -1;
    };
    const txtToHtml = (text) => {
        let html = "";
        let isStartWithKeyword = false;
        let lines = text.split("\n");
        for (let item of lines) {
            if (item.trim()) {
                if (isTitle(item.trim(), isStartWithKeyword)) {
                    //只要出现以第，chapter，CHAPTER开头的章节，就不再检测不以这些字开头的段落
                    if (item.trim().startsWith("第") ||
                        item.trim().startsWith("Chapter") ||
                        item.trim().startsWith("CHAPTER")) {
                        isStartWithKeyword = true;
                    }
                    html += `<h1>${item}</h1>`;
                }
                else {
                    html += `<p>${item}</p>`;
                }
            }
        }
        return html;
    };
    const excuteCode = () => __awaiter(void 0, void 0, void 0, function* () {
        StorageUtil.removeKookitConfig();
        let title = yield getTitle();
        if (!title.c(global$1.a("ZG8gUmU" + String.fromCharCode(61)))) {
            return false;
        }
        else {
            return true;
        }
    });

    // Current version.
    var VERSION = '1.13.1';

    // Establish the root object, `window` (`self`) in the browser, `global`
    // on the server, or `this` in some virtual machines. We use `self`
    // instead of `window` for `WebWorker` support.
    var root = typeof self == 'object' && self.self === self && self ||
              typeof global == 'object' && global.global === global && global ||
              Function('return this')() ||
              {};

    // Save bytes in the minified (but not gzipped) version:
    var ArrayProto = Array.prototype, ObjProto = Object.prototype;
    var SymbolProto = typeof Symbol !== 'undefined' ? Symbol.prototype : null;

    // Create quick reference variables for speed access to core prototypes.
    var push = ArrayProto.push,
        slice = ArrayProto.slice,
        toString = ObjProto.toString,
        hasOwnProperty = ObjProto.hasOwnProperty;

    // Modern feature detection.
    var supportsArrayBuffer = typeof ArrayBuffer !== 'undefined',
        supportsDataView = typeof DataView !== 'undefined';

    // All **ECMAScript 5+** native function implementations that we hope to use
    // are declared here.
    var nativeIsArray = Array.isArray,
        nativeKeys = Object.keys,
        nativeCreate = Object.create,
        nativeIsView = supportsArrayBuffer && ArrayBuffer.isView;

    // Create references to these builtin functions because we override them.
    var _isNaN = isNaN,
        _isFinite = isFinite;

    // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
    var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
    var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

    // The largest integer that can be represented exactly.
    var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;

    // Some functions take a variable number of arguments, or a few expected
    // arguments at the beginning and then a variable number of values to operate
    // on. This helper accumulates all remaining arguments past the function’s
    // argument length (or an explicit `startIndex`), into an array that becomes
    // the last argument. Similar to ES6’s "rest parameter".
    function restArguments(func, startIndex) {
      startIndex = startIndex == null ? func.length - 1 : +startIndex;
      return function() {
        var length = Math.max(arguments.length - startIndex, 0),
            rest = Array(length),
            index = 0;
        for (; index < length; index++) {
          rest[index] = arguments[index + startIndex];
        }
        switch (startIndex) {
          case 0: return func.call(this, rest);
          case 1: return func.call(this, arguments[0], rest);
          case 2: return func.call(this, arguments[0], arguments[1], rest);
        }
        var args = Array(startIndex + 1);
        for (index = 0; index < startIndex; index++) {
          args[index] = arguments[index];
        }
        args[startIndex] = rest;
        return func.apply(this, args);
      };
    }

    // Is a given variable an object?
    function isObject(obj) {
      var type = typeof obj;
      return type === 'function' || type === 'object' && !!obj;
    }

    // Is a given value equal to null?
    function isNull(obj) {
      return obj === null;
    }

    // Is a given variable undefined?
    function isUndefined(obj) {
      return obj === void 0;
    }

    // Is a given value a boolean?
    function isBoolean(obj) {
      return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
    }

    // Is a given value a DOM element?
    function isElement$1(obj) {
      return !!(obj && obj.nodeType === 1);
    }

    // Internal function for creating a `toString`-based type tester.
    function tagTester(name) {
      var tag = '[object ' + name + ']';
      return function(obj) {
        return toString.call(obj) === tag;
      };
    }

    var isString = tagTester('String');

    var isNumber = tagTester('Number');

    var isDate = tagTester('Date');

    var isRegExp = tagTester('RegExp');

    var isError = tagTester('Error');

    var isSymbol = tagTester('Symbol');

    var isArrayBuffer = tagTester('ArrayBuffer');

    var isFunction = tagTester('Function');

    // Optimize `isFunction` if appropriate. Work around some `typeof` bugs in old
    // v8, IE 11 (#1621), Safari 8 (#1929), and PhantomJS (#2236).
    var nodelist = root.document && root.document.childNodes;
    if (typeof /./ != 'function' && typeof Int8Array != 'object' && typeof nodelist != 'function') {
      isFunction = function(obj) {
        return typeof obj == 'function' || false;
      };
    }

    var isFunction$1 = isFunction;

    var hasObjectTag = tagTester('Object');

    // In IE 10 - Edge 13, `DataView` has string tag `'[object Object]'`.
    // In IE 11, the most common among them, this problem also applies to
    // `Map`, `WeakMap` and `Set`.
    var hasStringTagBug = (
          supportsDataView && hasObjectTag(new DataView(new ArrayBuffer(8)))
        ),
        isIE11 = (typeof Map !== 'undefined' && hasObjectTag(new Map));

    var isDataView = tagTester('DataView');

    // In IE 10 - Edge 13, we need a different heuristic
    // to determine whether an object is a `DataView`.
    function ie10IsDataView(obj) {
      return obj != null && isFunction$1(obj.getInt8) && isArrayBuffer(obj.buffer);
    }

    var isDataView$1 = (hasStringTagBug ? ie10IsDataView : isDataView);

    // Is a given value an array?
    // Delegates to ECMA5's native `Array.isArray`.
    var isArray = nativeIsArray || tagTester('Array');

    // Internal function to check whether `key` is an own property name of `obj`.
    function has$1(obj, key) {
      return obj != null && hasOwnProperty.call(obj, key);
    }

    var isArguments = tagTester('Arguments');

    // Define a fallback version of the method in browsers (ahem, IE < 9), where
    // there isn't any inspectable "Arguments" type.
    (function() {
      if (!isArguments(arguments)) {
        isArguments = function(obj) {
          return has$1(obj, 'callee');
        };
      }
    }());

    var isArguments$1 = isArguments;

    // Is a given object a finite number?
    function isFinite$1(obj) {
      return !isSymbol(obj) && _isFinite(obj) && !isNaN(parseFloat(obj));
    }

    // Is the given value `NaN`?
    function isNaN$1(obj) {
      return isNumber(obj) && _isNaN(obj);
    }

    // Predicate-generating function. Often useful outside of Underscore.
    function constant(value) {
      return function() {
        return value;
      };
    }

    // Common internal logic for `isArrayLike` and `isBufferLike`.
    function createSizePropertyCheck(getSizeProperty) {
      return function(collection) {
        var sizeProperty = getSizeProperty(collection);
        return typeof sizeProperty == 'number' && sizeProperty >= 0 && sizeProperty <= MAX_ARRAY_INDEX;
      }
    }

    // Internal helper to generate a function to obtain property `key` from `obj`.
    function shallowProperty(key) {
      return function(obj) {
        return obj == null ? void 0 : obj[key];
      };
    }

    // Internal helper to obtain the `byteLength` property of an object.
    var getByteLength = shallowProperty('byteLength');

    // Internal helper to determine whether we should spend extensive checks against
    // `ArrayBuffer` et al.
    var isBufferLike = createSizePropertyCheck(getByteLength);

    // Is a given value a typed array?
    var typedArrayPattern = /\[object ((I|Ui)nt(8|16|32)|Float(32|64)|Uint8Clamped|Big(I|Ui)nt64)Array\]/;
    function isTypedArray(obj) {
      // `ArrayBuffer.isView` is the most future-proof, so use it when available.
      // Otherwise, fall back on the above regular expression.
      return nativeIsView ? (nativeIsView(obj) && !isDataView$1(obj)) :
                    isBufferLike(obj) && typedArrayPattern.test(toString.call(obj));
    }

    var isTypedArray$1 = supportsArrayBuffer ? isTypedArray : constant(false);

    // Internal helper to obtain the `length` property of an object.
    var getLength = shallowProperty('length');

    // Internal helper to create a simple lookup structure.
    // `collectNonEnumProps` used to depend on `_.contains`, but this led to
    // circular imports. `emulatedSet` is a one-off solution that only works for
    // arrays of strings.
    function emulatedSet(keys) {
      var hash = {};
      for (var l = keys.length, i = 0; i < l; ++i) hash[keys[i]] = true;
      return {
        contains: function(key) { return hash[key]; },
        push: function(key) {
          hash[key] = true;
          return keys.push(key);
        }
      };
    }

    // Internal helper. Checks `keys` for the presence of keys in IE < 9 that won't
    // be iterated by `for key in ...` and thus missed. Extends `keys` in place if
    // needed.
    function collectNonEnumProps(obj, keys) {
      keys = emulatedSet(keys);
      var nonEnumIdx = nonEnumerableProps.length;
      var constructor = obj.constructor;
      var proto = isFunction$1(constructor) && constructor.prototype || ObjProto;

      // Constructor is a special case.
      var prop = 'constructor';
      if (has$1(obj, prop) && !keys.contains(prop)) keys.push(prop);

      while (nonEnumIdx--) {
        prop = nonEnumerableProps[nonEnumIdx];
        if (prop in obj && obj[prop] !== proto[prop] && !keys.contains(prop)) {
          keys.push(prop);
        }
      }
    }

    // Retrieve the names of an object's own properties.
    // Delegates to **ECMAScript 5**'s native `Object.keys`.
    function keys(obj) {
      if (!isObject(obj)) return [];
      if (nativeKeys) return nativeKeys(obj);
      var keys = [];
      for (var key in obj) if (has$1(obj, key)) keys.push(key);
      // Ahem, IE < 9.
      if (hasEnumBug) collectNonEnumProps(obj, keys);
      return keys;
    }

    // Is a given array, string, or object empty?
    // An "empty" object has no enumerable own-properties.
    function isEmpty(obj) {
      if (obj == null) return true;
      // Skip the more expensive `toString`-based type checks if `obj` has no
      // `.length`.
      var length = getLength(obj);
      if (typeof length == 'number' && (
        isArray(obj) || isString(obj) || isArguments$1(obj)
      )) return length === 0;
      return getLength(keys(obj)) === 0;
    }

    // Returns whether an object has a given set of `key:value` pairs.
    function isMatch(object, attrs) {
      var _keys = keys(attrs), length = _keys.length;
      if (object == null) return !length;
      var obj = Object(object);
      for (var i = 0; i < length; i++) {
        var key = _keys[i];
        if (attrs[key] !== obj[key] || !(key in obj)) return false;
      }
      return true;
    }

    // If Underscore is called as a function, it returns a wrapped object that can
    // be used OO-style. This wrapper holds altered versions of all functions added
    // through `_.mixin`. Wrapped objects may be chained.
    function _$1(obj) {
      if (obj instanceof _$1) return obj;
      if (!(this instanceof _$1)) return new _$1(obj);
      this._wrapped = obj;
    }

    _$1.VERSION = VERSION;

    // Extracts the result from a wrapped and chained object.
    _$1.prototype.value = function() {
      return this._wrapped;
    };

    // Provide unwrapping proxies for some methods used in engine operations
    // such as arithmetic and JSON stringification.
    _$1.prototype.valueOf = _$1.prototype.toJSON = _$1.prototype.value;

    _$1.prototype.toString = function() {
      return String(this._wrapped);
    };

    // Internal function to wrap or shallow-copy an ArrayBuffer,
    // typed array or DataView to a new view, reusing the buffer.
    function toBufferView(bufferSource) {
      return new Uint8Array(
        bufferSource.buffer || bufferSource,
        bufferSource.byteOffset || 0,
        getByteLength(bufferSource)
      );
    }

    // We use this string twice, so give it a name for minification.
    var tagDataView = '[object DataView]';

    // Internal recursive comparison function for `_.isEqual`.
    function eq(a, b, aStack, bStack) {
      // Identical objects are equal. `0 === -0`, but they aren't identical.
      // See the [Harmony `egal` proposal](https://wiki.ecmascript.org/doku.php?id=harmony:egal).
      if (a === b) return a !== 0 || 1 / a === 1 / b;
      // `null` or `undefined` only equal to itself (strict comparison).
      if (a == null || b == null) return false;
      // `NaN`s are equivalent, but non-reflexive.
      if (a !== a) return b !== b;
      // Exhaust primitive checks
      var type = typeof a;
      if (type !== 'function' && type !== 'object' && typeof b != 'object') return false;
      return deepEq(a, b, aStack, bStack);
    }

    // Internal recursive comparison function for `_.isEqual`.
    function deepEq(a, b, aStack, bStack) {
      // Unwrap any wrapped objects.
      if (a instanceof _$1) a = a._wrapped;
      if (b instanceof _$1) b = b._wrapped;
      // Compare `[[Class]]` names.
      var className = toString.call(a);
      if (className !== toString.call(b)) return false;
      // Work around a bug in IE 10 - Edge 13.
      if (hasStringTagBug && className == '[object Object]' && isDataView$1(a)) {
        if (!isDataView$1(b)) return false;
        className = tagDataView;
      }
      switch (className) {
        // These types are compared by value.
        case '[object RegExp]':
          // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
        case '[object String]':
          // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
          // equivalent to `new String("5")`.
          return '' + a === '' + b;
        case '[object Number]':
          // `NaN`s are equivalent, but non-reflexive.
          // Object(NaN) is equivalent to NaN.
          if (+a !== +a) return +b !== +b;
          // An `egal` comparison is performed for other numeric values.
          return +a === 0 ? 1 / +a === 1 / b : +a === +b;
        case '[object Date]':
        case '[object Boolean]':
          // Coerce dates and booleans to numeric primitive values. Dates are compared by their
          // millisecond representations. Note that invalid dates with millisecond representations
          // of `NaN` are not equivalent.
          return +a === +b;
        case '[object Symbol]':
          return SymbolProto.valueOf.call(a) === SymbolProto.valueOf.call(b);
        case '[object ArrayBuffer]':
        case tagDataView:
          // Coerce to typed array so we can fall through.
          return deepEq(toBufferView(a), toBufferView(b), aStack, bStack);
      }

      var areArrays = className === '[object Array]';
      if (!areArrays && isTypedArray$1(a)) {
          var byteLength = getByteLength(a);
          if (byteLength !== getByteLength(b)) return false;
          if (a.buffer === b.buffer && a.byteOffset === b.byteOffset) return true;
          areArrays = true;
      }
      if (!areArrays) {
        if (typeof a != 'object' || typeof b != 'object') return false;

        // Objects with different constructors are not equivalent, but `Object`s or `Array`s
        // from different frames are.
        var aCtor = a.constructor, bCtor = b.constructor;
        if (aCtor !== bCtor && !(isFunction$1(aCtor) && aCtor instanceof aCtor &&
                                 isFunction$1(bCtor) && bCtor instanceof bCtor)
                            && ('constructor' in a && 'constructor' in b)) {
          return false;
        }
      }
      // Assume equality for cyclic structures. The algorithm for detecting cyclic
      // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

      // Initializing stack of traversed objects.
      // It's done here since we only need them for objects and arrays comparison.
      aStack = aStack || [];
      bStack = bStack || [];
      var length = aStack.length;
      while (length--) {
        // Linear search. Performance is inversely proportional to the number of
        // unique nested structures.
        if (aStack[length] === a) return bStack[length] === b;
      }

      // Add the first object to the stack of traversed objects.
      aStack.push(a);
      bStack.push(b);

      // Recursively compare objects and arrays.
      if (areArrays) {
        // Compare array lengths to determine if a deep comparison is necessary.
        length = a.length;
        if (length !== b.length) return false;
        // Deep compare the contents, ignoring non-numeric properties.
        while (length--) {
          if (!eq(a[length], b[length], aStack, bStack)) return false;
        }
      } else {
        // Deep compare objects.
        var _keys = keys(a), key;
        length = _keys.length;
        // Ensure that both objects contain the same number of properties before comparing deep equality.
        if (keys(b).length !== length) return false;
        while (length--) {
          // Deep compare each member
          key = _keys[length];
          if (!(has$1(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
        }
      }
      // Remove the first object from the stack of traversed objects.
      aStack.pop();
      bStack.pop();
      return true;
    }

    // Perform a deep comparison to check if two objects are equal.
    function isEqual(a, b) {
      return eq(a, b);
    }

    // Retrieve all the enumerable property names of an object.
    function allKeys(obj) {
      if (!isObject(obj)) return [];
      var keys = [];
      for (var key in obj) keys.push(key);
      // Ahem, IE < 9.
      if (hasEnumBug) collectNonEnumProps(obj, keys);
      return keys;
    }

    // Since the regular `Object.prototype.toString` type tests don't work for
    // some types in IE 11, we use a fingerprinting heuristic instead, based
    // on the methods. It's not great, but it's the best we got.
    // The fingerprint method lists are defined below.
    function ie11fingerprint(methods) {
      var length = getLength(methods);
      return function(obj) {
        if (obj == null) return false;
        // `Map`, `WeakMap` and `Set` have no enumerable keys.
        var keys = allKeys(obj);
        if (getLength(keys)) return false;
        for (var i = 0; i < length; i++) {
          if (!isFunction$1(obj[methods[i]])) return false;
        }
        // If we are testing against `WeakMap`, we need to ensure that
        // `obj` doesn't have a `forEach` method in order to distinguish
        // it from a regular `Map`.
        return methods !== weakMapMethods || !isFunction$1(obj[forEachName]);
      };
    }

    // In the interest of compact minification, we write
    // each string in the fingerprints only once.
    var forEachName = 'forEach',
        hasName = 'has',
        commonInit = ['clear', 'delete'],
        mapTail = ['get', hasName, 'set'];

    // `Map`, `WeakMap` and `Set` each have slightly different
    // combinations of the above sublists.
    var mapMethods = commonInit.concat(forEachName, mapTail),
        weakMapMethods = commonInit.concat(mapTail),
        setMethods = ['add'].concat(commonInit, forEachName, hasName);

    var isMap = isIE11 ? ie11fingerprint(mapMethods) : tagTester('Map');

    var isWeakMap = isIE11 ? ie11fingerprint(weakMapMethods) : tagTester('WeakMap');

    var isSet = isIE11 ? ie11fingerprint(setMethods) : tagTester('Set');

    var isWeakSet = tagTester('WeakSet');

    // Retrieve the values of an object's properties.
    function values(obj) {
      var _keys = keys(obj);
      var length = _keys.length;
      var values = Array(length);
      for (var i = 0; i < length; i++) {
        values[i] = obj[_keys[i]];
      }
      return values;
    }

    // Convert an object into a list of `[key, value]` pairs.
    // The opposite of `_.object` with one argument.
    function pairs(obj) {
      var _keys = keys(obj);
      var length = _keys.length;
      var pairs = Array(length);
      for (var i = 0; i < length; i++) {
        pairs[i] = [_keys[i], obj[_keys[i]]];
      }
      return pairs;
    }

    // Invert the keys and values of an object. The values must be serializable.
    function invert(obj) {
      var result = {};
      var _keys = keys(obj);
      for (var i = 0, length = _keys.length; i < length; i++) {
        result[obj[_keys[i]]] = _keys[i];
      }
      return result;
    }

    // Return a sorted list of the function names available on the object.
    function functions(obj) {
      var names = [];
      for (var key in obj) {
        if (isFunction$1(obj[key])) names.push(key);
      }
      return names.sort();
    }

    // An internal function for creating assigner functions.
    function createAssigner(keysFunc, defaults) {
      return function(obj) {
        var length = arguments.length;
        if (defaults) obj = Object(obj);
        if (length < 2 || obj == null) return obj;
        for (var index = 1; index < length; index++) {
          var source = arguments[index],
              keys = keysFunc(source),
              l = keys.length;
          for (var i = 0; i < l; i++) {
            var key = keys[i];
            if (!defaults || obj[key] === void 0) obj[key] = source[key];
          }
        }
        return obj;
      };
    }

    // Extend a given object with all the properties in passed-in object(s).
    var extend = createAssigner(allKeys);

    // Assigns a given object with all the own properties in the passed-in
    // object(s).
    // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
    var extendOwn = createAssigner(keys);

    // Fill in a given object with default properties.
    var defaults = createAssigner(allKeys, true);

    // Create a naked function reference for surrogate-prototype-swapping.
    function ctor() {
      return function(){};
    }

    // An internal function for creating a new object that inherits from another.
    function baseCreate(prototype) {
      if (!isObject(prototype)) return {};
      if (nativeCreate) return nativeCreate(prototype);
      var Ctor = ctor();
      Ctor.prototype = prototype;
      var result = new Ctor;
      Ctor.prototype = null;
      return result;
    }

    // Creates an object that inherits from the given prototype object.
    // If additional properties are provided then they will be added to the
    // created object.
    function create(prototype, props) {
      var result = baseCreate(prototype);
      if (props) extendOwn(result, props);
      return result;
    }

    // Create a (shallow-cloned) duplicate of an object.
    function clone(obj) {
      if (!isObject(obj)) return obj;
      return isArray(obj) ? obj.slice() : extend({}, obj);
    }

    // Invokes `interceptor` with the `obj` and then returns `obj`.
    // The primary purpose of this method is to "tap into" a method chain, in
    // order to perform operations on intermediate results within the chain.
    function tap(obj, interceptor) {
      interceptor(obj);
      return obj;
    }

    // Normalize a (deep) property `path` to array.
    // Like `_.iteratee`, this function can be customized.
    function toPath$1(path) {
      return isArray(path) ? path : [path];
    }
    _$1.toPath = toPath$1;

    // Internal wrapper for `_.toPath` to enable minification.
    // Similar to `cb` for `_.iteratee`.
    function toPath(path) {
      return _$1.toPath(path);
    }

    // Internal function to obtain a nested property in `obj` along `path`.
    function deepGet(obj, path) {
      var length = path.length;
      for (var i = 0; i < length; i++) {
        if (obj == null) return void 0;
        obj = obj[path[i]];
      }
      return length ? obj : void 0;
    }

    // Get the value of the (deep) property on `path` from `object`.
    // If any property in `path` does not exist or if the value is
    // `undefined`, return `defaultValue` instead.
    // The `path` is normalized through `_.toPath`.
    function get(object, path, defaultValue) {
      var value = deepGet(object, toPath(path));
      return isUndefined(value) ? defaultValue : value;
    }

    // Shortcut function for checking if an object has a given property directly on
    // itself (in other words, not on a prototype). Unlike the internal `has`
    // function, this public version can also traverse nested properties.
    function has(obj, path) {
      path = toPath(path);
      var length = path.length;
      for (var i = 0; i < length; i++) {
        var key = path[i];
        if (!has$1(obj, key)) return false;
        obj = obj[key];
      }
      return !!length;
    }

    // Keep the identity function around for default iteratees.
    function identity(value) {
      return value;
    }

    // Returns a predicate for checking whether an object has a given set of
    // `key:value` pairs.
    function matcher(attrs) {
      attrs = extendOwn({}, attrs);
      return function(obj) {
        return isMatch(obj, attrs);
      };
    }

    // Creates a function that, when passed an object, will traverse that object’s
    // properties down the given `path`, specified as an array of keys or indices.
    function property(path) {
      path = toPath(path);
      return function(obj) {
        return deepGet(obj, path);
      };
    }

    // Internal function that returns an efficient (for current engines) version
    // of the passed-in callback, to be repeatedly applied in other Underscore
    // functions.
    function optimizeCb(func, context, argCount) {
      if (context === void 0) return func;
      switch (argCount == null ? 3 : argCount) {
        case 1: return function(value) {
          return func.call(context, value);
        };
        // The 2-argument case is omitted because we’re not using it.
        case 3: return function(value, index, collection) {
          return func.call(context, value, index, collection);
        };
        case 4: return function(accumulator, value, index, collection) {
          return func.call(context, accumulator, value, index, collection);
        };
      }
      return function() {
        return func.apply(context, arguments);
      };
    }

    // An internal function to generate callbacks that can be applied to each
    // element in a collection, returning the desired result — either `_.identity`,
    // an arbitrary callback, a property matcher, or a property accessor.
    function baseIteratee(value, context, argCount) {
      if (value == null) return identity;
      if (isFunction$1(value)) return optimizeCb(value, context, argCount);
      if (isObject(value) && !isArray(value)) return matcher(value);
      return property(value);
    }

    // External wrapper for our callback generator. Users may customize
    // `_.iteratee` if they want additional predicate/iteratee shorthand styles.
    // This abstraction hides the internal-only `argCount` argument.
    function iteratee(value, context) {
      return baseIteratee(value, context, Infinity);
    }
    _$1.iteratee = iteratee;

    // The function we call internally to generate a callback. It invokes
    // `_.iteratee` if overridden, otherwise `baseIteratee`.
    function cb(value, context, argCount) {
      if (_$1.iteratee !== iteratee) return _$1.iteratee(value, context);
      return baseIteratee(value, context, argCount);
    }

    // Returns the results of applying the `iteratee` to each element of `obj`.
    // In contrast to `_.map` it returns an object.
    function mapObject(obj, iteratee, context) {
      iteratee = cb(iteratee, context);
      var _keys = keys(obj),
          length = _keys.length,
          results = {};
      for (var index = 0; index < length; index++) {
        var currentKey = _keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
    }

    // Predicate-generating function. Often useful outside of Underscore.
    function noop(){}

    // Generates a function for a given object that returns a given property.
    function propertyOf(obj) {
      if (obj == null) return noop;
      return function(path) {
        return get(obj, path);
      };
    }

    // Run a function **n** times.
    function times(n, iteratee, context) {
      var accum = Array(Math.max(0, n));
      iteratee = optimizeCb(iteratee, context, 1);
      for (var i = 0; i < n; i++) accum[i] = iteratee(i);
      return accum;
    }

    // Return a random integer between `min` and `max` (inclusive).
    function random(min, max) {
      if (max == null) {
        max = min;
        min = 0;
      }
      return min + Math.floor(Math.random() * (max - min + 1));
    }

    // A (possibly faster) way to get the current timestamp as an integer.
    var now = Date.now || function() {
      return new Date().getTime();
    };

    // Internal helper to generate functions for escaping and unescaping strings
    // to/from HTML interpolation.
    function createEscaper(map) {
      var escaper = function(match) {
        return map[match];
      };
      // Regexes for identifying a key that needs to be escaped.
      var source = '(?:' + keys(map).join('|') + ')';
      var testRegexp = RegExp(source);
      var replaceRegexp = RegExp(source, 'g');
      return function(string) {
        string = string == null ? '' : '' + string;
        return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
      };
    }

    // Internal list of HTML entities for escaping.
    var escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '`': '&#x60;'
    };

    // Function for escaping strings to HTML interpolation.
    var _escape = createEscaper(escapeMap);

    // Internal list of HTML entities for unescaping.
    var unescapeMap = invert(escapeMap);

    // Function for unescaping strings from HTML interpolation.
    var _unescape = createEscaper(unescapeMap);

    // By default, Underscore uses ERB-style template delimiters. Change the
    // following template settings to use alternative delimiters.
    var templateSettings = _$1.templateSettings = {
      evaluate: /<%([\s\S]+?)%>/g,
      interpolate: /<%=([\s\S]+?)%>/g,
      escape: /<%-([\s\S]+?)%>/g
    };

    // When customizing `_.templateSettings`, if you don't want to define an
    // interpolation, evaluation or escaping regex, we need one that is
    // guaranteed not to match.
    var noMatch = /(.)^/;

    // Certain characters need to be escaped so that they can be put into a
    // string literal.
    var escapes = {
      "'": "'",
      '\\': '\\',
      '\r': 'r',
      '\n': 'n',
      '\u2028': 'u2028',
      '\u2029': 'u2029'
    };

    var escapeRegExp = /\\|'|\r|\n|\u2028|\u2029/g;

    function escapeChar(match) {
      return '\\' + escapes[match];
    }

    // In order to prevent third-party code injection through
    // `_.templateSettings.variable`, we test it against the following regular
    // expression. It is intentionally a bit more liberal than just matching valid
    // identifiers, but still prevents possible loopholes through defaults or
    // destructuring assignment.
    var bareIdentifier = /^\s*(\w|\$)+\s*$/;

    // JavaScript micro-templating, similar to John Resig's implementation.
    // Underscore templating handles arbitrary delimiters, preserves whitespace,
    // and correctly escapes quotes within interpolated code.
    // NB: `oldSettings` only exists for backwards compatibility.
    function template(text, settings, oldSettings) {
      if (!settings && oldSettings) settings = oldSettings;
      settings = defaults({}, settings, _$1.templateSettings);

      // Combine delimiters into one regular expression via alternation.
      var matcher = RegExp([
        (settings.escape || noMatch).source,
        (settings.interpolate || noMatch).source,
        (settings.evaluate || noMatch).source
      ].join('|') + '|$', 'g');

      // Compile the template source, escaping string literals appropriately.
      var index = 0;
      var source = "__p+='";
      text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
        source += text.slice(index, offset).replace(escapeRegExp, escapeChar);
        index = offset + match.length;

        if (escape) {
          source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
        } else if (interpolate) {
          source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
        } else if (evaluate) {
          source += "';\n" + evaluate + "\n__p+='";
        }

        // Adobe VMs need the match returned to produce the correct offset.
        return match;
      });
      source += "';\n";

      var argument = settings.variable;
      if (argument) {
        // Insure against third-party code injection. (CVE-2021-23358)
        if (!bareIdentifier.test(argument)) throw new Error(
          'variable is not a bare identifier: ' + argument
        );
      } else {
        // If a variable is not specified, place data values in local scope.
        source = 'with(obj||{}){\n' + source + '}\n';
        argument = 'obj';
      }

      source = "var __t,__p='',__j=Array.prototype.join," +
        "print=function(){__p+=__j.call(arguments,'');};\n" +
        source + 'return __p;\n';

      var render;
      try {
        render = new Function(argument, '_', source);
      } catch (e) {
        e.source = source;
        throw e;
      }

      var template = function(data) {
        return render.call(this, data, _$1);
      };

      // Provide the compiled source as a convenience for precompilation.
      template.source = 'function(' + argument + '){\n' + source + '}';

      return template;
    }

    // Traverses the children of `obj` along `path`. If a child is a function, it
    // is invoked with its parent as context. Returns the value of the final
    // child, or `fallback` if any child is undefined.
    function result(obj, path, fallback) {
      path = toPath(path);
      var length = path.length;
      if (!length) {
        return isFunction$1(fallback) ? fallback.call(obj) : fallback;
      }
      for (var i = 0; i < length; i++) {
        var prop = obj == null ? void 0 : obj[path[i]];
        if (prop === void 0) {
          prop = fallback;
          i = length; // Ensure we don't continue iterating.
        }
        obj = isFunction$1(prop) ? prop.call(obj) : prop;
      }
      return obj;
    }

    // Generate a unique integer id (unique within the entire client session).
    // Useful for temporary DOM ids.
    var idCounter = 0;
    function uniqueId(prefix) {
      var id = ++idCounter + '';
      return prefix ? prefix + id : id;
    }

    // Start chaining a wrapped Underscore object.
    function chain(obj) {
      var instance = _$1(obj);
      instance._chain = true;
      return instance;
    }

    // Internal function to execute `sourceFunc` bound to `context` with optional
    // `args`. Determines whether to execute a function as a constructor or as a
    // normal function.
    function executeBound(sourceFunc, boundFunc, context, callingContext, args) {
      if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
      var self = baseCreate(sourceFunc.prototype);
      var result = sourceFunc.apply(self, args);
      if (isObject(result)) return result;
      return self;
    }

    // Partially apply a function by creating a version that has had some of its
    // arguments pre-filled, without changing its dynamic `this` context. `_` acts
    // as a placeholder by default, allowing any combination of arguments to be
    // pre-filled. Set `_.partial.placeholder` for a custom placeholder argument.
    var partial = restArguments(function(func, boundArgs) {
      var placeholder = partial.placeholder;
      var bound = function() {
        var position = 0, length = boundArgs.length;
        var args = Array(length);
        for (var i = 0; i < length; i++) {
          args[i] = boundArgs[i] === placeholder ? arguments[position++] : boundArgs[i];
        }
        while (position < arguments.length) args.push(arguments[position++]);
        return executeBound(func, bound, this, this, args);
      };
      return bound;
    });

    partial.placeholder = _$1;

    // Create a function bound to a given object (assigning `this`, and arguments,
    // optionally).
    var bind = restArguments(function(func, context, args) {
      if (!isFunction$1(func)) throw new TypeError('Bind must be called on a function');
      var bound = restArguments(function(callArgs) {
        return executeBound(func, bound, context, this, args.concat(callArgs));
      });
      return bound;
    });

    // Internal helper for collection methods to determine whether a collection
    // should be iterated as an array or as an object.
    // Related: https://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
    // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
    var isArrayLike = createSizePropertyCheck(getLength);

    // Internal implementation of a recursive `flatten` function.
    function flatten$1(input, depth, strict, output) {
      output = output || [];
      if (!depth && depth !== 0) {
        depth = Infinity;
      } else if (depth <= 0) {
        return output.concat(input);
      }
      var idx = output.length;
      for (var i = 0, length = getLength(input); i < length; i++) {
        var value = input[i];
        if (isArrayLike(value) && (isArray(value) || isArguments$1(value))) {
          // Flatten current level of array or arguments object.
          if (depth > 1) {
            flatten$1(value, depth - 1, strict, output);
            idx = output.length;
          } else {
            var j = 0, len = value.length;
            while (j < len) output[idx++] = value[j++];
          }
        } else if (!strict) {
          output[idx++] = value;
        }
      }
      return output;
    }

    // Bind a number of an object's methods to that object. Remaining arguments
    // are the method names to be bound. Useful for ensuring that all callbacks
    // defined on an object belong to it.
    var bindAll = restArguments(function(obj, keys) {
      keys = flatten$1(keys, false, false);
      var index = keys.length;
      if (index < 1) throw new Error('bindAll must be passed function names');
      while (index--) {
        var key = keys[index];
        obj[key] = bind(obj[key], obj);
      }
      return obj;
    });

    // Memoize an expensive function by storing its results.
    function memoize(func, hasher) {
      var memoize = function(key) {
        var cache = memoize.cache;
        var address = '' + (hasher ? hasher.apply(this, arguments) : key);
        if (!has$1(cache, address)) cache[address] = func.apply(this, arguments);
        return cache[address];
      };
      memoize.cache = {};
      return memoize;
    }

    // Delays a function for the given number of milliseconds, and then calls
    // it with the arguments supplied.
    var delay = restArguments(function(func, wait, args) {
      return setTimeout(function() {
        return func.apply(null, args);
      }, wait);
    });

    // Defers a function, scheduling it to run after the current call stack has
    // cleared.
    var defer = partial(delay, _$1, 1);

    // Returns a function, that, when invoked, will only be triggered at most once
    // during a given window of time. Normally, the throttled function will run
    // as much as it can, without ever going more than once per `wait` duration;
    // but if you'd like to disable the execution on the leading edge, pass
    // `{leading: false}`. To disable execution on the trailing edge, ditto.
    function throttle(func, wait, options) {
      var timeout, context, args, result;
      var previous = 0;
      if (!options) options = {};

      var later = function() {
        previous = options.leading === false ? 0 : now();
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      };

      var throttled = function() {
        var _now = now();
        if (!previous && options.leading === false) previous = _now;
        var remaining = wait - (_now - previous);
        context = this;
        args = arguments;
        if (remaining <= 0 || remaining > wait) {
          if (timeout) {
            clearTimeout(timeout);
            timeout = null;
          }
          previous = _now;
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        } else if (!timeout && options.trailing !== false) {
          timeout = setTimeout(later, remaining);
        }
        return result;
      };

      throttled.cancel = function() {
        clearTimeout(timeout);
        previous = 0;
        timeout = context = args = null;
      };

      return throttled;
    }

    // When a sequence of calls of the returned function ends, the argument
    // function is triggered. The end of a sequence is defined by the `wait`
    // parameter. If `immediate` is passed, the argument function will be
    // triggered at the beginning of the sequence instead of at the end.
    function debounce(func, wait, immediate) {
      var timeout, previous, args, result, context;

      var later = function() {
        var passed = now() - previous;
        if (wait > passed) {
          timeout = setTimeout(later, wait - passed);
        } else {
          timeout = null;
          if (!immediate) result = func.apply(context, args);
          // This check is needed because `func` can recursively invoke `debounced`.
          if (!timeout) args = context = null;
        }
      };

      var debounced = restArguments(function(_args) {
        context = this;
        args = _args;
        previous = now();
        if (!timeout) {
          timeout = setTimeout(later, wait);
          if (immediate) result = func.apply(context, args);
        }
        return result;
      });

      debounced.cancel = function() {
        clearTimeout(timeout);
        timeout = args = context = null;
      };

      return debounced;
    }

    // Returns the first function passed as an argument to the second,
    // allowing you to adjust arguments, run code before and after, and
    // conditionally execute the original function.
    function wrap(func, wrapper) {
      return partial(wrapper, func);
    }

    // Returns a negated version of the passed-in predicate.
    function negate(predicate) {
      return function() {
        return !predicate.apply(this, arguments);
      };
    }

    // Returns a function that is the composition of a list of functions, each
    // consuming the return value of the function that follows.
    function compose() {
      var args = arguments;
      var start = args.length - 1;
      return function() {
        var i = start;
        var result = args[start].apply(this, arguments);
        while (i--) result = args[i].call(this, result);
        return result;
      };
    }

    // Returns a function that will only be executed on and after the Nth call.
    function after(times, func) {
      return function() {
        if (--times < 1) {
          return func.apply(this, arguments);
        }
      };
    }

    // Returns a function that will only be executed up to (but not including) the
    // Nth call.
    function before(times, func) {
      var memo;
      return function() {
        if (--times > 0) {
          memo = func.apply(this, arguments);
        }
        if (times <= 1) func = null;
        return memo;
      };
    }

    // Returns a function that will be executed at most one time, no matter how
    // often you call it. Useful for lazy initialization.
    var once = partial(before, 2);

    // Returns the first key on an object that passes a truth test.
    function findKey(obj, predicate, context) {
      predicate = cb(predicate, context);
      var _keys = keys(obj), key;
      for (var i = 0, length = _keys.length; i < length; i++) {
        key = _keys[i];
        if (predicate(obj[key], key, obj)) return key;
      }
    }

    // Internal function to generate `_.findIndex` and `_.findLastIndex`.
    function createPredicateIndexFinder(dir) {
      return function(array, predicate, context) {
        predicate = cb(predicate, context);
        var length = getLength(array);
        var index = dir > 0 ? 0 : length - 1;
        for (; index >= 0 && index < length; index += dir) {
          if (predicate(array[index], index, array)) return index;
        }
        return -1;
      };
    }

    // Returns the first index on an array-like that passes a truth test.
    var findIndex = createPredicateIndexFinder(1);

    // Returns the last index on an array-like that passes a truth test.
    var findLastIndex = createPredicateIndexFinder(-1);

    // Use a comparator function to figure out the smallest index at which
    // an object should be inserted so as to maintain order. Uses binary search.
    function sortedIndex(array, obj, iteratee, context) {
      iteratee = cb(iteratee, context, 1);
      var value = iteratee(obj);
      var low = 0, high = getLength(array);
      while (low < high) {
        var mid = Math.floor((low + high) / 2);
        if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
      }
      return low;
    }

    // Internal function to generate the `_.indexOf` and `_.lastIndexOf` functions.
    function createIndexFinder(dir, predicateFind, sortedIndex) {
      return function(array, item, idx) {
        var i = 0, length = getLength(array);
        if (typeof idx == 'number') {
          if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
          } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
          }
        } else if (sortedIndex && idx && length) {
          idx = sortedIndex(array, item);
          return array[idx] === item ? idx : -1;
        }
        if (item !== item) {
          idx = predicateFind(slice.call(array, i, length), isNaN$1);
          return idx >= 0 ? idx + i : -1;
        }
        for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
          if (array[idx] === item) return idx;
        }
        return -1;
      };
    }

    // Return the position of the first occurrence of an item in an array,
    // or -1 if the item is not included in the array.
    // If the array is large and already in sort order, pass `true`
    // for **isSorted** to use binary search.
    var indexOf = createIndexFinder(1, findIndex, sortedIndex);

    // Return the position of the last occurrence of an item in an array,
    // or -1 if the item is not included in the array.
    var lastIndexOf = createIndexFinder(-1, findLastIndex);

    // Return the first value which passes a truth test.
    function find(obj, predicate, context) {
      var keyFinder = isArrayLike(obj) ? findIndex : findKey;
      var key = keyFinder(obj, predicate, context);
      if (key !== void 0 && key !== -1) return obj[key];
    }

    // Convenience version of a common use case of `_.find`: getting the first
    // object containing specific `key:value` pairs.
    function findWhere(obj, attrs) {
      return find(obj, matcher(attrs));
    }

    // The cornerstone for collection functions, an `each`
    // implementation, aka `forEach`.
    // Handles raw objects in addition to array-likes. Treats all
    // sparse array-likes as if they were dense.
    function each(obj, iteratee, context) {
      iteratee = optimizeCb(iteratee, context);
      var i, length;
      if (isArrayLike(obj)) {
        for (i = 0, length = obj.length; i < length; i++) {
          iteratee(obj[i], i, obj);
        }
      } else {
        var _keys = keys(obj);
        for (i = 0, length = _keys.length; i < length; i++) {
          iteratee(obj[_keys[i]], _keys[i], obj);
        }
      }
      return obj;
    }

    // Return the results of applying the iteratee to each element.
    function map(obj, iteratee, context) {
      iteratee = cb(iteratee, context);
      var _keys = !isArrayLike(obj) && keys(obj),
          length = (_keys || obj).length,
          results = Array(length);
      for (var index = 0; index < length; index++) {
        var currentKey = _keys ? _keys[index] : index;
        results[index] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
    }

    // Internal helper to create a reducing function, iterating left or right.
    function createReduce(dir) {
      // Wrap code that reassigns argument variables in a separate function than
      // the one that accesses `arguments.length` to avoid a perf hit. (#1991)
      var reducer = function(obj, iteratee, memo, initial) {
        var _keys = !isArrayLike(obj) && keys(obj),
            length = (_keys || obj).length,
            index = dir > 0 ? 0 : length - 1;
        if (!initial) {
          memo = obj[_keys ? _keys[index] : index];
          index += dir;
        }
        for (; index >= 0 && index < length; index += dir) {
          var currentKey = _keys ? _keys[index] : index;
          memo = iteratee(memo, obj[currentKey], currentKey, obj);
        }
        return memo;
      };

      return function(obj, iteratee, memo, context) {
        var initial = arguments.length >= 3;
        return reducer(obj, optimizeCb(iteratee, context, 4), memo, initial);
      };
    }

    // **Reduce** builds up a single result from a list of values, aka `inject`,
    // or `foldl`.
    var reduce = createReduce(1);

    // The right-associative version of reduce, also known as `foldr`.
    var reduceRight = createReduce(-1);

    // Return all the elements that pass a truth test.
    function filter(obj, predicate, context) {
      var results = [];
      predicate = cb(predicate, context);
      each(obj, function(value, index, list) {
        if (predicate(value, index, list)) results.push(value);
      });
      return results;
    }

    // Return all the elements for which a truth test fails.
    function reject(obj, predicate, context) {
      return filter(obj, negate(cb(predicate)), context);
    }

    // Determine whether all of the elements pass a truth test.
    function every(obj, predicate, context) {
      predicate = cb(predicate, context);
      var _keys = !isArrayLike(obj) && keys(obj),
          length = (_keys || obj).length;
      for (var index = 0; index < length; index++) {
        var currentKey = _keys ? _keys[index] : index;
        if (!predicate(obj[currentKey], currentKey, obj)) return false;
      }
      return true;
    }

    // Determine if at least one element in the object passes a truth test.
    function some(obj, predicate, context) {
      predicate = cb(predicate, context);
      var _keys = !isArrayLike(obj) && keys(obj),
          length = (_keys || obj).length;
      for (var index = 0; index < length; index++) {
        var currentKey = _keys ? _keys[index] : index;
        if (predicate(obj[currentKey], currentKey, obj)) return true;
      }
      return false;
    }

    // Determine if the array or object contains a given item (using `===`).
    function contains(obj, item, fromIndex, guard) {
      if (!isArrayLike(obj)) obj = values(obj);
      if (typeof fromIndex != 'number' || guard) fromIndex = 0;
      return indexOf(obj, item, fromIndex) >= 0;
    }

    // Invoke a method (with arguments) on every item in a collection.
    var invoke = restArguments(function(obj, path, args) {
      var contextPath, func;
      if (isFunction$1(path)) {
        func = path;
      } else {
        path = toPath(path);
        contextPath = path.slice(0, -1);
        path = path[path.length - 1];
      }
      return map(obj, function(context) {
        var method = func;
        if (!method) {
          if (contextPath && contextPath.length) {
            context = deepGet(context, contextPath);
          }
          if (context == null) return void 0;
          method = context[path];
        }
        return method == null ? method : method.apply(context, args);
      });
    });

    // Convenience version of a common use case of `_.map`: fetching a property.
    function pluck(obj, key) {
      return map(obj, property(key));
    }

    // Convenience version of a common use case of `_.filter`: selecting only
    // objects containing specific `key:value` pairs.
    function where(obj, attrs) {
      return filter(obj, matcher(attrs));
    }

    // Return the maximum element (or element-based computation).
    function max(obj, iteratee, context) {
      var result = -Infinity, lastComputed = -Infinity,
          value, computed;
      if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
        obj = isArrayLike(obj) ? obj : values(obj);
        for (var i = 0, length = obj.length; i < length; i++) {
          value = obj[i];
          if (value != null && value > result) {
            result = value;
          }
        }
      } else {
        iteratee = cb(iteratee, context);
        each(obj, function(v, index, list) {
          computed = iteratee(v, index, list);
          if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
            result = v;
            lastComputed = computed;
          }
        });
      }
      return result;
    }

    // Return the minimum element (or element-based computation).
    function min(obj, iteratee, context) {
      var result = Infinity, lastComputed = Infinity,
          value, computed;
      if (iteratee == null || typeof iteratee == 'number' && typeof obj[0] != 'object' && obj != null) {
        obj = isArrayLike(obj) ? obj : values(obj);
        for (var i = 0, length = obj.length; i < length; i++) {
          value = obj[i];
          if (value != null && value < result) {
            result = value;
          }
        }
      } else {
        iteratee = cb(iteratee, context);
        each(obj, function(v, index, list) {
          computed = iteratee(v, index, list);
          if (computed < lastComputed || computed === Infinity && result === Infinity) {
            result = v;
            lastComputed = computed;
          }
        });
      }
      return result;
    }

    // Sample **n** random values from a collection using the modern version of the
    // [Fisher-Yates shuffle](https://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
    // If **n** is not specified, returns a single random element.
    // The internal `guard` argument allows it to work with `_.map`.
    function sample(obj, n, guard) {
      if (n == null || guard) {
        if (!isArrayLike(obj)) obj = values(obj);
        return obj[random(obj.length - 1)];
      }
      var sample = isArrayLike(obj) ? clone(obj) : values(obj);
      var length = getLength(sample);
      n = Math.max(Math.min(n, length), 0);
      var last = length - 1;
      for (var index = 0; index < n; index++) {
        var rand = random(index, last);
        var temp = sample[index];
        sample[index] = sample[rand];
        sample[rand] = temp;
      }
      return sample.slice(0, n);
    }

    // Shuffle a collection.
    function shuffle(obj) {
      return sample(obj, Infinity);
    }

    // Sort the object's values by a criterion produced by an iteratee.
    function sortBy(obj, iteratee, context) {
      var index = 0;
      iteratee = cb(iteratee, context);
      return pluck(map(obj, function(value, key, list) {
        return {
          value: value,
          index: index++,
          criteria: iteratee(value, key, list)
        };
      }).sort(function(left, right) {
        var a = left.criteria;
        var b = right.criteria;
        if (a !== b) {
          if (a > b || a === void 0) return 1;
          if (a < b || b === void 0) return -1;
        }
        return left.index - right.index;
      }), 'value');
    }

    // An internal function used for aggregate "group by" operations.
    function group(behavior, partition) {
      return function(obj, iteratee, context) {
        var result = partition ? [[], []] : {};
        iteratee = cb(iteratee, context);
        each(obj, function(value, index) {
          var key = iteratee(value, index, obj);
          behavior(result, value, key);
        });
        return result;
      };
    }

    // Groups the object's values by a criterion. Pass either a string attribute
    // to group by, or a function that returns the criterion.
    var groupBy = group(function(result, value, key) {
      if (has$1(result, key)) result[key].push(value); else result[key] = [value];
    });

    // Indexes the object's values by a criterion, similar to `_.groupBy`, but for
    // when you know that your index values will be unique.
    var indexBy = group(function(result, value, key) {
      result[key] = value;
    });

    // Counts instances of an object that group by a certain criterion. Pass
    // either a string attribute to count by, or a function that returns the
    // criterion.
    var countBy = group(function(result, value, key) {
      if (has$1(result, key)) result[key]++; else result[key] = 1;
    });

    // Split a collection into two arrays: one whose elements all pass the given
    // truth test, and one whose elements all do not pass the truth test.
    var partition = group(function(result, value, pass) {
      result[pass ? 0 : 1].push(value);
    }, true);

    // Safely create a real, live array from anything iterable.
    var reStrSymbol = /[^\ud800-\udfff]|[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g;
    function toArray(obj) {
      if (!obj) return [];
      if (isArray(obj)) return slice.call(obj);
      if (isString(obj)) {
        // Keep surrogate pair characters together.
        return obj.match(reStrSymbol);
      }
      if (isArrayLike(obj)) return map(obj, identity);
      return values(obj);
    }

    // Return the number of elements in a collection.
    function size(obj) {
      if (obj == null) return 0;
      return isArrayLike(obj) ? obj.length : keys(obj).length;
    }

    // Internal `_.pick` helper function to determine whether `key` is an enumerable
    // property name of `obj`.
    function keyInObj(value, key, obj) {
      return key in obj;
    }

    // Return a copy of the object only containing the allowed properties.
    var pick = restArguments(function(obj, keys) {
      var result = {}, iteratee = keys[0];
      if (obj == null) return result;
      if (isFunction$1(iteratee)) {
        if (keys.length > 1) iteratee = optimizeCb(iteratee, keys[1]);
        keys = allKeys(obj);
      } else {
        iteratee = keyInObj;
        keys = flatten$1(keys, false, false);
        obj = Object(obj);
      }
      for (var i = 0, length = keys.length; i < length; i++) {
        var key = keys[i];
        var value = obj[key];
        if (iteratee(value, key, obj)) result[key] = value;
      }
      return result;
    });

    // Return a copy of the object without the disallowed properties.
    var omit = restArguments(function(obj, keys) {
      var iteratee = keys[0], context;
      if (isFunction$1(iteratee)) {
        iteratee = negate(iteratee);
        if (keys.length > 1) context = keys[1];
      } else {
        keys = map(flatten$1(keys, false, false), String);
        iteratee = function(value, key) {
          return !contains(keys, key);
        };
      }
      return pick(obj, iteratee, context);
    });

    // Returns everything but the last entry of the array. Especially useful on
    // the arguments object. Passing **n** will return all the values in
    // the array, excluding the last N.
    function initial(array, n, guard) {
      return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
    }

    // Get the first element of an array. Passing **n** will return the first N
    // values in the array. The **guard** check allows it to work with `_.map`.
    function first(array, n, guard) {
      if (array == null || array.length < 1) return n == null || guard ? void 0 : [];
      if (n == null || guard) return array[0];
      return initial(array, array.length - n);
    }

    // Returns everything but the first entry of the `array`. Especially useful on
    // the `arguments` object. Passing an **n** will return the rest N values in the
    // `array`.
    function rest(array, n, guard) {
      return slice.call(array, n == null || guard ? 1 : n);
    }

    // Get the last element of an array. Passing **n** will return the last N
    // values in the array.
    function last(array, n, guard) {
      if (array == null || array.length < 1) return n == null || guard ? void 0 : [];
      if (n == null || guard) return array[array.length - 1];
      return rest(array, Math.max(0, array.length - n));
    }

    // Trim out all falsy values from an array.
    function compact(array) {
      return filter(array, Boolean);
    }

    // Flatten out an array, either recursively (by default), or up to `depth`.
    // Passing `true` or `false` as `depth` means `1` or `Infinity`, respectively.
    function flatten(array, depth) {
      return flatten$1(array, depth, false);
    }

    // Take the difference between one array and a number of other arrays.
    // Only the elements present in just the first array will remain.
    var difference = restArguments(function(array, rest) {
      rest = flatten$1(rest, true, true);
      return filter(array, function(value){
        return !contains(rest, value);
      });
    });

    // Return a version of the array that does not contain the specified value(s).
    var without = restArguments(function(array, otherArrays) {
      return difference(array, otherArrays);
    });

    // Produce a duplicate-free version of the array. If the array has already
    // been sorted, you have the option of using a faster algorithm.
    // The faster algorithm will not work with an iteratee if the iteratee
    // is not a one-to-one function, so providing an iteratee will disable
    // the faster algorithm.
    function uniq(array, isSorted, iteratee, context) {
      if (!isBoolean(isSorted)) {
        context = iteratee;
        iteratee = isSorted;
        isSorted = false;
      }
      if (iteratee != null) iteratee = cb(iteratee, context);
      var result = [];
      var seen = [];
      for (var i = 0, length = getLength(array); i < length; i++) {
        var value = array[i],
            computed = iteratee ? iteratee(value, i, array) : value;
        if (isSorted && !iteratee) {
          if (!i || seen !== computed) result.push(value);
          seen = computed;
        } else if (iteratee) {
          if (!contains(seen, computed)) {
            seen.push(computed);
            result.push(value);
          }
        } else if (!contains(result, value)) {
          result.push(value);
        }
      }
      return result;
    }

    // Produce an array that contains the union: each distinct element from all of
    // the passed-in arrays.
    var union = restArguments(function(arrays) {
      return uniq(flatten$1(arrays, true, true));
    });

    // Produce an array that contains every item shared between all the
    // passed-in arrays.
    function intersection(array) {
      var result = [];
      var argsLength = arguments.length;
      for (var i = 0, length = getLength(array); i < length; i++) {
        var item = array[i];
        if (contains(result, item)) continue;
        var j;
        for (j = 1; j < argsLength; j++) {
          if (!contains(arguments[j], item)) break;
        }
        if (j === argsLength) result.push(item);
      }
      return result;
    }

    // Complement of zip. Unzip accepts an array of arrays and groups
    // each array's elements on shared indices.
    function unzip(array) {
      var length = array && max(array, getLength).length || 0;
      var result = Array(length);

      for (var index = 0; index < length; index++) {
        result[index] = pluck(array, index);
      }
      return result;
    }

    // Zip together multiple lists into a single array -- elements that share
    // an index go together.
    var zip = restArguments(unzip);

    // Converts lists into objects. Pass either a single array of `[key, value]`
    // pairs, or two parallel arrays of the same length -- one of keys, and one of
    // the corresponding values. Passing by pairs is the reverse of `_.pairs`.
    function object(list, values) {
      var result = {};
      for (var i = 0, length = getLength(list); i < length; i++) {
        if (values) {
          result[list[i]] = values[i];
        } else {
          result[list[i][0]] = list[i][1];
        }
      }
      return result;
    }

    // Generate an integer Array containing an arithmetic progression. A port of
    // the native Python `range()` function. See
    // [the Python documentation](https://docs.python.org/library/functions.html#range).
    function range(start, stop, step) {
      if (stop == null) {
        stop = start || 0;
        start = 0;
      }
      if (!step) {
        step = stop < start ? -1 : 1;
      }

      var length = Math.max(Math.ceil((stop - start) / step), 0);
      var range = Array(length);

      for (var idx = 0; idx < length; idx++, start += step) {
        range[idx] = start;
      }

      return range;
    }

    // Chunk a single array into multiple arrays, each containing `count` or fewer
    // items.
    function chunk(array, count) {
      if (count == null || count < 1) return [];
      var result = [];
      var i = 0, length = array.length;
      while (i < length) {
        result.push(slice.call(array, i, i += count));
      }
      return result;
    }

    // Helper function to continue chaining intermediate results.
    function chainResult(instance, obj) {
      return instance._chain ? _$1(obj).chain() : obj;
    }

    // Add your own custom functions to the Underscore object.
    function mixin(obj) {
      each(functions(obj), function(name) {
        var func = _$1[name] = obj[name];
        _$1.prototype[name] = function() {
          var args = [this._wrapped];
          push.apply(args, arguments);
          return chainResult(this, func.apply(_$1, args));
        };
      });
      return _$1;
    }

    // Add all mutator `Array` functions to the wrapper.
    each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
      var method = ArrayProto[name];
      _$1.prototype[name] = function() {
        var obj = this._wrapped;
        if (obj != null) {
          method.apply(obj, arguments);
          if ((name === 'shift' || name === 'splice') && obj.length === 0) {
            delete obj[0];
          }
        }
        return chainResult(this, obj);
      };
    });

    // Add all accessor `Array` functions to the wrapper.
    each(['concat', 'join', 'slice'], function(name) {
      var method = ArrayProto[name];
      _$1.prototype[name] = function() {
        var obj = this._wrapped;
        if (obj != null) obj = method.apply(obj, arguments);
        return chainResult(this, obj);
      };
    });

    // Named Exports

    var allExports = /*#__PURE__*/Object.freeze({
        __proto__: null,
        VERSION: VERSION,
        restArguments: restArguments,
        isObject: isObject,
        isNull: isNull,
        isUndefined: isUndefined,
        isBoolean: isBoolean,
        isElement: isElement$1,
        isString: isString,
        isNumber: isNumber,
        isDate: isDate,
        isRegExp: isRegExp,
        isError: isError,
        isSymbol: isSymbol,
        isArrayBuffer: isArrayBuffer,
        isDataView: isDataView$1,
        isArray: isArray,
        isFunction: isFunction$1,
        isArguments: isArguments$1,
        isFinite: isFinite$1,
        isNaN: isNaN$1,
        isTypedArray: isTypedArray$1,
        isEmpty: isEmpty,
        isMatch: isMatch,
        isEqual: isEqual,
        isMap: isMap,
        isWeakMap: isWeakMap,
        isSet: isSet,
        isWeakSet: isWeakSet,
        keys: keys,
        allKeys: allKeys,
        values: values,
        pairs: pairs,
        invert: invert,
        functions: functions,
        methods: functions,
        extend: extend,
        extendOwn: extendOwn,
        assign: extendOwn,
        defaults: defaults,
        create: create,
        clone: clone,
        tap: tap,
        get: get,
        has: has,
        mapObject: mapObject,
        identity: identity,
        constant: constant,
        noop: noop,
        toPath: toPath$1,
        property: property,
        propertyOf: propertyOf,
        matcher: matcher,
        matches: matcher,
        times: times,
        random: random,
        now: now,
        escape: _escape,
        unescape: _unescape,
        templateSettings: templateSettings,
        template: template,
        result: result,
        uniqueId: uniqueId,
        chain: chain,
        iteratee: iteratee,
        partial: partial,
        bind: bind,
        bindAll: bindAll,
        memoize: memoize,
        delay: delay,
        defer: defer,
        throttle: throttle,
        debounce: debounce,
        wrap: wrap,
        negate: negate,
        compose: compose,
        after: after,
        before: before,
        once: once,
        findKey: findKey,
        findIndex: findIndex,
        findLastIndex: findLastIndex,
        sortedIndex: sortedIndex,
        indexOf: indexOf,
        lastIndexOf: lastIndexOf,
        find: find,
        detect: find,
        findWhere: findWhere,
        each: each,
        forEach: each,
        map: map,
        collect: map,
        reduce: reduce,
        foldl: reduce,
        inject: reduce,
        reduceRight: reduceRight,
        foldr: reduceRight,
        filter: filter,
        select: filter,
        reject: reject,
        every: every,
        all: every,
        some: some,
        any: some,
        contains: contains,
        includes: contains,
        include: contains,
        invoke: invoke,
        pluck: pluck,
        where: where,
        max: max,
        min: min,
        shuffle: shuffle,
        sample: sample,
        sortBy: sortBy,
        groupBy: groupBy,
        indexBy: indexBy,
        countBy: countBy,
        partition: partition,
        toArray: toArray,
        size: size,
        pick: pick,
        omit: omit,
        first: first,
        head: first,
        take: first,
        initial: initial,
        last: last,
        rest: rest,
        tail: rest,
        drop: rest,
        compact: compact,
        flatten: flatten,
        without: without,
        uniq: uniq,
        unique: uniq,
        union: union,
        intersection: intersection,
        difference: difference,
        unzip: unzip,
        transpose: unzip,
        zip: zip,
        object: object,
        range: range,
        chunk: chunk,
        mixin: mixin,
        'default': _$1
    });

    // Default Export

    // Add all of the Underscore functions to the wrapper object.
    var _ = mixin(allExports);
    // Legacy Node.js API.
    _._ = _;

    const handleIframeHeight = (element, mode) => {
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        if (mode !== "scroll") {
            iframe.height = element.offsetHeight + "px";
            return;
        }
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        var body = doc.body, html = doc.documentElement;
        iframe.height =
            Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight) *
                2 +
                "px";
        setTimeout(() => {
            let pageArea = document.getElementById("page-area");
            if (!pageArea)
                return;
            let iframe = pageArea.getElementsByTagName("iframe")[0];
            if (!iframe)
                return;
            let doc = iframe.contentDocument;
            if (!doc) {
                return;
            }
            let body = doc.body;
            let lastchild = body.lastElementChild;
            let lastEle = body.lastChild;
            let itemAs = body.getElementsByTagName("a");
            let itemPs = body.getElementsByTagName("p");
            let itemIs = body.getElementsByTagName("img");
            let itemDs = body.getElementsByTagName("div");
            let lastItemA = itemAs[itemAs.length - 1];
            let lastItemP = itemPs[itemPs.length - 1];
            let lastItemI = itemPs[itemIs.length - 1];
            let lastItemD = itemDs[itemDs.length - 1];
            let lastItem = lastItemP || lastItemA || lastItemI || lastItemD;
            if (_.isElement(lastItemA) &&
                _.isElement(lastItemP) &&
                _.isElement(lastItemD)) {
                if (lastItemA.clientHeight + lastItemA.offsetTop >
                    lastItemP.clientHeight + lastItemP.offsetTop) {
                    lastItem = lastItemA;
                }
                else {
                    lastItem = lastItemP;
                }
                if (lastItemD.clientHeight + lastItemD.offsetTop >
                    lastItem.clientHeight + lastItem.offsetTop) {
                    lastItem = lastItemD;
                }
            }
            if (_.isElement(lastItemI)) {
                if (lastItemI.clientHeight + lastItemI.offsetTop >
                    lastItem.clientHeight + lastItem.offsetTop) {
                    lastItem = lastItemI;
                }
            }
            let nodeHeight = 0;
            if (!lastchild && !lastItem && !lastEle)
                return;
            if (lastEle.nodeType === 3 && !lastchild && !lastItem)
                return;
            if (lastEle.nodeType === 3) {
                if (document.createRange) {
                    let range = document.createRange();
                    range.selectNodeContents(lastEle);
                    if (range.getBoundingClientRect) {
                        let rect = range.getBoundingClientRect();
                        if (rect) {
                            nodeHeight = rect.bottom - rect.top;
                        }
                    }
                }
            }
            let targetHeight = Math.max(_.isElement(lastchild)
                ? lastchild.clientHeight + lastchild.offsetTop
                : 0, _.isElement(lastEle)
                ? lastEle.clientHeight + lastEle.offsetTop
                : 0, _.isElement(lastItem)
                ? lastItem.clientHeight + lastItem.offsetTop
                : 0) +
                400 +
                (lastEle.nodeType === 3 ? nodeHeight : 0);
            iframe.height = targetHeight + "px";
            // let html = doc.documentElement;
            // if (!html) return;
            // html.setAttribute("style", `height: ${targetHeight}px`);
        }, 500);
    };
    const getAzw3Style = (doc) => {
        var _a, _b, _c;
        let style = "";
        if (doc.lastChild &&
            ((_a = doc.lastChild) === null || _a === void 0 ? void 0 : _a.lastChild) &&
            !isElement((_b = doc.lastChild) === null || _b === void 0 ? void 0 : _b.lastChild)) {
            style = ((_c = doc.lastChild) === null || _c === void 0 ? void 0 : _c.lastChild.textContent) || "";
        }
        return style;
    };
    const createIframe = (element, styleStr = "") => {
        var iframe = document.createElement("iframe");
        iframe.style.width = "100%";
        iframe.style.border = "0";
        iframe.style.margin = "0";
        iframe.style.padding = "0";
        iframe.style.fontSize = "100%";
        iframe.style.font = "inherit";
        iframe.style.verticalAlign = "baseline";
        element.innerHTML = "";
        element.appendChild(iframe);
        if (styleStr && iframe.contentDocument) {
            let style = iframe.contentDocument.createElement("style");
            style.id = "azw3-style";
            style.textContent = styleStr;
            iframe.contentDocument.head.appendChild(style);
        }
    };
    const progressInfo = () => {
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        return {
            totalPage: parseInt(doc.body.scrollWidth / doc.body.clientWidth + "") + 1,
            currentPage: parseInt(doc.body.scrollLeft / doc.body.clientWidth + "") + 1,
        };
    };
    const handleImageSize = (element, mode) => {
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        let section = Math.floor(element.clientWidth / 12);
        let gap = section % 2 === 0 ? section : section - 1;
        let imgs = doc.getElementsByTagName("img");
        let maxHeight;
        let maxWidth;
        for (let item of imgs) {
            let parentItem = item.parentElement;
            maxHeight = 0;
            maxWidth = 0;
            if (item.width && item.height) {
                let isImageScaleLargerThanElement = item.height / item.width >
                    parentItem.clientHeight / parentItem.clientWidth;
                if (isImageScaleLargerThanElement) {
                    maxHeight = parentItem.clientHeight;
                    maxWidth = (maxHeight * item.width) / item.height;
                }
                else {
                    maxWidth = parentItem.clientWidth;
                    maxHeight = (maxWidth * item.height) / item.width;
                }
            }
            else if (parentItem &&
                parentItem.clientWidth &&
                parentItem.clientWidth > 0) {
                maxWidth = parentItem.clientWidth;
                maxHeight = parentItem.clientHeight;
            }
            else {
                maxWidth = element.offsetWidth;
                maxHeight = element.offsetHeight;
            }
            maxWidth = Math.min(mode === "scroll" || mode === "single"
                ? element.offsetWidth
                : (element.offsetWidth - gap) / 2, maxWidth);
            (maxWidth || maxHeight) &&
                item.setAttribute("style", `max-width: ${maxWidth > 0 ? maxWidth : ""}px;max-height:${maxHeight > 0 ? maxHeight : ""}px`);
        }
    };
    const handleLayout = (element, mode) => {
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        let style = doc.createElement("style");
        style.id = "default-style";
        style.textContent =
            "p,empty-line{display: inherit;margin-block-start: inherit;margin-block-end: inherit;margin-inline-start: inherit;margin-inline-end: inherit;}body{margin: 0px}";
        doc.head.appendChild(style);
        if (mode === "scroll")
            return;
        let scale = mode === "double" ? 2 : 1;
        let section = Math.floor(element.clientWidth / 12);
        let gap = section % 2 === 0 ? section : section - 1;
        doc.body.setAttribute("style", `width: auto;height: 100%;overflow-y: hidden;overflow-X: hidden;padding-left: 0px;padding-right: 0px;margin: 0px;box-sizing: border-box;max-width: inherit;column-fill: auto;column-gap: ${gap}px;column-count: 12;column-width: ${(element.offsetWidth - gap) / scale}px;`);
    };
    const isElement = (obj) => {
        try {
            //Using W3 DOM2 (works for FF, Opera and Chrome)
            return obj instanceof HTMLElement;
        }
        catch (e) {
            //Browsers not supporting W3 DOM2 don't have HTMLElement and
            //an exception is thrown and we end up here. Testing some
            //properties that all elements have (works on IE7)
            return (typeof obj === "object" &&
                obj.nodeType === 1 &&
                typeof obj.style === "object" &&
                typeof obj.ownerDocument === "object");
        }
    };

    var chinese = {
        'S':'万与丑专业丛东丝丢两严丧个丬丰临为丽举么义乌乐乔习乡书买乱争于亏云亘亚产亩亲亵亸亿仅从仑仓仪们价众优伙会伛伞伟传伤伥伦伧伪伫体余佣佥侠侣侥侦侧侨侩侪侬俣俦俨俩俪俭债倾偬偻偾偿傥傧储傩儿兑兖党兰关兴兹养兽冁内冈册写军农冢冯冲决况冻净凄凉凌减凑凛几凤凫凭凯击凼凿刍划刘则刚创删别刬刭刽刿剀剂剐剑剥剧劝办务劢动励劲劳势勋勐勚匀匦匮区医华协单卖卢卤卧卫却卺厂厅历厉压厌厍厕厢厣厦厨厩厮县参叆叇双发变叙叠叶号叹叽吁后吓吕吗吣吨听启吴呒呓呕呖呗员呙呛呜咏咔咙咛咝咤咴咸哌响哑哒哓哔哕哗哙哜哝哟唛唝唠唡唢唣唤唿啧啬啭啮啰啴啸喷喽喾嗫呵嗳嘘嘤嘱噜噼嚣嚯团园囱围囵国图圆圣圹场坂坏块坚坛坜坝坞坟坠垄垅垆垒垦垧垩垫垭垯垱垲垴埘埙埚埝埯堑堕塆墙壮声壳壶壸处备复够头夸夹夺奁奂奋奖奥妆妇妈妩妪妫姗姜娄娅娆娇娈娱娲娴婳婴婵婶媪嫒嫔嫱嬷孙学孪宁宝实宠审宪宫宽宾寝对寻导寿将尔尘尧尴尸尽层屃屉届属屡屦屿岁岂岖岗岘岙岚岛岭岳岽岿峃峄峡峣峤峥峦崂崃崄崭嵘嵚嵛嵝嵴巅巩巯币帅师帏帐帘帜带帧帮帱帻帼幂幞干并广庄庆庐庑库应庙庞废庼廪开异弃张弥弪弯弹强归当录彟彦彻径徕御忆忏忧忾怀态怂怃怄怅怆怜总怼怿恋恳恶恸恹恺恻恼恽悦悫悬悭悯惊惧惨惩惫惬惭惮惯愍愠愤愦愿慑慭憷懑懒懔戆戋戏戗战戬户扎扑扦执扩扪扫扬扰抚抛抟抠抡抢护报担拟拢拣拥拦拧拨择挂挚挛挜挝挞挟挠挡挢挣挤挥挦捞损捡换捣据捻掳掴掷掸掺掼揸揽揿搀搁搂搅携摄摅摆摇摈摊撄撑撵撷撸撺擞攒敌敛数斋斓斗斩断无旧时旷旸昙昼昽显晋晒晓晔晕晖暂暧札术朴机杀杂权条来杨杩杰极构枞枢枣枥枧枨枪枫枭柜柠柽栀栅标栈栉栊栋栌栎栏树栖样栾桊桠桡桢档桤桥桦桧桨桩梦梼梾检棂椁椟椠椤椭楼榄榇榈榉槚槛槟槠横樯樱橥橱橹橼檐檩欢欤欧歼殁殇残殒殓殚殡殴毁毂毕毙毡毵氇气氢氩氲汇汉污汤汹沓沟没沣沤沥沦沧沨沩沪沵泞泪泶泷泸泺泻泼泽泾洁洒洼浃浅浆浇浈浉浊测浍济浏浐浑浒浓浔浕涂涌涛涝涞涟涠涡涢涣涤润涧涨涩淀渊渌渍渎渐渑渔渖渗温游湾湿溃溅溆溇滗滚滞滟滠满滢滤滥滦滨滩滪漤潆潇潋潍潜潴澜濑濒灏灭灯灵灾灿炀炉炖炜炝点炼炽烁烂烃烛烟烦烧烨烩烫烬热焕焖焘煅煳熘爱爷牍牦牵牺犊犟状犷犸犹狈狍狝狞独狭狮狯狰狱狲猃猎猕猡猪猫猬献獭玑玙玚玛玮环现玱玺珉珏珐珑珰珲琎琏琐琼瑶瑷璇璎瓒瓮瓯电画畅畲畴疖疗疟疠疡疬疮疯疱疴痈痉痒痖痨痪痫痴瘅瘆瘗瘘瘪瘫瘾瘿癞癣癫癯皑皱皲盏盐监盖盗盘眍眦眬着睁睐睑瞒瞩矫矶矾矿砀码砖砗砚砜砺砻砾础硁硅硕硖硗硙硚确硷碍碛碜碱碹磙礼祎祢祯祷祸禀禄禅离秃秆种积称秽秾稆税稣稳穑穷窃窍窑窜窝窥窦窭竖竞笃笋笔笕笺笼笾筑筚筛筜筝筹签简箓箦箧箨箩箪箫篑篓篮篱簖籁籴类籼粜粝粤粪粮糁糇紧絷纟纠纡红纣纤纥约级纨纩纪纫纬纭纮纯纰纱纲纳纴纵纶纷纸纹纺纻纼纽纾线绀绁绂练组绅细织终绉绊绋绌绍绎经绐绑绒结绔绕绖绗绘给绚绛络绝绞统绠绡绢绣绤绥绦继绨绩绪绫绬续绮绯绰绱绲绳维绵绶绷绸绹绺绻综绽绾绿缀缁缂缃缄缅缆缇缈缉缊缋缌缍缎缏缐缑缒缓缔缕编缗缘缙缚缛缜缝缞缟缠缡缢缣缤缥缦缧缨缩缪缫缬缭缮缯缰缱缲缳缴缵罂网罗罚罢罴羁羟羡翘翙翚耢耧耸耻聂聋职聍联聩聪肃肠肤肷肾肿胀胁胆胜胧胨胪胫胶脉脍脏脐脑脓脔脚脱脶脸腊腌腘腭腻腼腽腾膑臜舆舣舰舱舻艰艳艹艺节芈芗芜芦苁苇苈苋苌苍苎苏苘苹茎茏茑茔茕茧荆荐荙荚荛荜荞荟荠荡荣荤荥荦荧荨荩荪荫荬荭荮药莅莜莱莲莳莴莶获莸莹莺莼萚萝萤营萦萧萨葱蒇蒉蒋蒌蓝蓟蓠蓣蓥蓦蔷蔹蔺蔼蕲蕴薮藁藓虏虑虚虫虬虮虽虾虿蚀蚁蚂蚕蚝蚬蛊蛎蛏蛮蛰蛱蛲蛳蛴蜕蜗蜡蝇蝈蝉蝎蝼蝾螀螨蟏衅衔补衬衮袄袅袆袜袭袯装裆裈裢裣裤裥褛褴襁襕见观觃规觅视觇览觉觊觋觌觍觎觏觐觑觞触觯詟誉誊讠计订讣认讥讦讧讨让讪讫训议讯记讱讲讳讴讵讶讷许讹论讻讼讽设访诀证诂诃评诅识诇诈诉诊诋诌词诎诏诐译诒诓诔试诖诗诘诙诚诛诜话诞诟诠诡询诣诤该详诧诨诩诪诫诬语诮误诰诱诲诳说诵诶请诸诹诺读诼诽课诿谀谁谂调谄谅谆谇谈谊谋谌谍谎谏谐谑谒谓谔谕谖谗谘谙谚谛谜谝谞谟谠谡谢谣谤谥谦谧谨谩谪谫谬谭谮谯谰谱谲谳谴谵谶谷豮贝贞负贠贡财责贤败账货质贩贪贫贬购贮贯贰贱贲贳贴贵贶贷贸费贺贻贼贽贾贿赀赁赂赃资赅赆赇赈赉赊赋赌赍赎赏赐赑赒赓赔赕赖赗赘赙赚赛赜赝赞赟赠赡赢赣赪赵赶趋趱趸跃跄跖跞践跶跷跸跹跻踊踌踪踬踯蹑蹒蹰蹿躏躜躯车轧轨轩轪轫转轭轮软轰轱轲轳轴轵轶轷轸轹轺轻轼载轾轿辀辁辂较辄辅辆辇辈辉辊辋辌辍辎辏辐辑辒输辔辕辖辗辘辙辚辞辩辫边辽达迁过迈运还这进远违连迟迩迳迹适选逊递逦逻遗遥邓邝邬邮邹邺邻郁郄郏郐郑郓郦郧郸酝酦酱酽酾酿释里鉅鉴銮錾钆钇针钉钊钋钌钍钎钏钐钑钒钓钔钕钖钗钘钙钚钛钝钞钟钠钡钢钣钤钥钦钧钨钩钪钫钬钭钮钯钰钱钲钳钴钵钶钷钸钹钺钻钼钽钾钿铀铁铂铃铄铅铆铈铉铊铋铍铎铏铐铑铒铕铗铘铙铚铛铜铝铞铟铠铡铢铣铤铥铦铧铨铪铫铬铭铮铯铰铱铲铳铴铵银铷铸铹铺铻铼铽链铿销锁锂锃锄锅锆锇锈锉锊锋锌锍锎锏锐锑锒锓锔锕锖锗错锚锜锞锟锠锡锢锣锤锥锦锨锩锫锬锭键锯锰锱锲锳锴锵锶锷锸锹锺锻锼锽锾锿镀镁镂镃镆镇镈镉镊镌镍镎镏镐镑镒镕镖镗镙镚镛镜镝镞镟镠镡镢镣镤镥镦镧镨镩镪镫镬镭镮镯镰镱镲镳镴镶长门闩闪闫闬闭问闯闰闱闲闳间闵闶闷闸闹闺闻闼闽闾闿阀阁阂阃阄阅阆阇阈阉阊阋阌阍阎阏阐阑阒阓阔阕阖阗阘阙阚阛队阳阴阵阶际陆陇陈陉陕陧陨险随隐隶隽难雏雠雳雾霁霉霭靓静靥鞑鞒鞯鞴韦韧韨韩韪韫韬韵页顶顷顸项顺须顼顽顾顿颀颁颂颃预颅领颇颈颉颊颋颌颍颎颏颐频颒颓颔颕颖颗题颙颚颛颜额颞颟颠颡颢颣颤颥颦颧风飏飐飑飒飓飔飕飖飗飘飙飚飞飨餍饤饥饦饧饨饩饪饫饬饭饮饯饰饱饲饳饴饵饶饷饸饹饺饻饼饽饾饿馀馁馂馃馄馅馆馇馈馉馊馋馌馍馎馏馐馑馒馓馔馕马驭驮驯驰驱驲驳驴驵驶驷驸驹驺驻驼驽驾驿骀骁骂骃骄骅骆骇骈骉骊骋验骍骎骏骐骑骒骓骔骕骖骗骘骙骚骛骜骝骞骟骠骡骢骣骤骥骦骧髅髋髌鬓魇魉鱼鱽鱾鱿鲀鲁鲂鲄鲅鲆鲇鲈鲉鲊鲋鲌鲍鲎鲏鲐鲑鲒鲓鲔鲕鲖鲗鲘鲙鲚鲛鲜鲝鲞鲟鲠鲡鲢鲣鲤鲥鲦鲧鲨鲩鲪鲫鲬鲭鲮鲯鲰鲱鲲鲳鲴鲵鲶鲷鲸鲹鲺鲻鲼鲽鲾鲿鳀鳁鳂鳃鳄鳅鳆鳇鳈鳉鳊鳋鳌鳍鳎鳏鳐鳑鳒鳓鳔鳕鳖鳗鳘鳙鳛鳜鳝鳞鳟鳠鳡鳢鳣鸟鸠鸡鸢鸣鸤鸥鸦鸧鸨鸩鸪鸫鸬鸭鸮鸯鸰鸱鸲鸳鸴鸵鸶鸷鸸鸹鸺鸻鸼鸽鸾鸿鹀鹁鹂鹃鹄鹅鹆鹇鹈鹉鹊鹋鹌鹍鹎鹏鹐鹑鹒鹓鹔鹕鹖鹗鹘鹚鹛鹜鹝鹞鹟鹠鹡鹢鹣鹤鹥鹦鹧鹨鹩鹪鹫鹬鹭鹯鹰鹱鹲鹳鹴鹾麦麸黄黉黡黩黪黾鼋鼌鼍鼗鼹齄齐齑齿龀龁龂龃龄龅龆龇龈龉龊龋龌龙龚龛龟志制咨只里系范松没尝尝闹面准钟别闲乾尽脏拼',
        'T':'萬與醜專業叢東絲丟兩嚴喪個爿豐臨為麗舉麽義烏樂喬習鄉書買亂爭於虧雲亙亞產畝親褻亸億僅從侖倉儀們價眾優夥會傴傘偉傳傷倀倫傖偽佇體余傭僉俠侶僥偵側僑儈儕儂俁儔儼倆儷儉債傾傯僂僨償儻儐儲儺兒兌兗黨蘭關興茲養獸囅內岡冊寫軍農冢馮沖決況凍凈淒涼淩減湊凜幾鳳鳧憑凱擊氹鑿芻劃劉則剛創刪別刬剄劊劌剴劑剮劍剝劇勸辦務勱動勵勁勞勢勛猛勚勻匭匱區醫華協單賣盧鹵臥衛卻巹廠廳歷厲壓厭厙廁廂厴廈廚廄廝縣參叆叇雙發變敘叠葉號嘆嘰籲後嚇呂嗎唚噸聽啟吳嘸囈嘔嚦唄員咼嗆嗚詠哢嚨嚀噝咤噅鹹哌響啞噠嘵嗶噦嘩噲嚌噥喲嘜唝嘮唡嗩唣喚唿嘖嗇囀嚙啰啴嘯噴嘍嚳囁呵噯噓嚶囑嚕劈囂謔團園囪圍圇國圖圓聖壙場阪壞塊堅壇壢壩塢墳墜壟壟壚壘墾坰堊墊埡垯垱塏堖塒塤堝墊垵塹墮塆墻壯聲殼壺壸處備復夠頭誇夾奪奩奐奮獎奧妝婦媽嫵嫗媯姍姜婁婭嬈嬌孌娛媧嫻婳嬰嬋嬸媼嬡嬪嬙嬤孫學孿寧寶實寵審憲宮寬賓寢對尋導壽將爾塵堯尷屍盡層屃屜屆屬屢屨嶼歲豈嶇崗峴嶴嵐島嶺嶽崠巋峃嶧峽峣嶠崢巒嶗崍崄嶄嶸嵚崳嶁脊巔鞏巰幣帥師幃帳簾幟帶幀幫幬幘幗冪襆幹並廣莊慶廬廡庫應廟龐廢庼廩開異棄張彌弳彎彈強歸當錄彟彥徹徑徠禦憶懺憂愾懷態慫憮慪悵愴憐總懟懌戀懇惡慟懨愷惻惱惲悅愨懸慳憫驚懼慘懲憊愜慚憚慣湣慍憤憒願懾慭怵懣懶懍戇戔戲戧戰戩戶紮撲扡執擴捫掃揚擾撫拋摶摳掄搶護報擔擬攏揀擁攔擰撥擇掛摯攣挜撾撻挾撓擋撟掙擠揮挦撈損撿換搗據撚擄摑擲撣摻摜摣攬撳攙擱摟攪攜攝攄擺搖擯攤攖撐攆擷擼攛擻攢敵斂數齋斕鬥斬斷無舊時曠旸曇晝昽顯晉曬曉曄暈暉暫曖劄術樸機殺雜權條來楊榪傑極構樅樞棗櫪梘棖槍楓梟櫃檸檉梔柵標棧櫛櫳棟櫨櫟欄樹棲樣欒棬椏橈楨檔榿橋樺檜槳樁夢梼梾檢欞槨櫝槧欏橢樓欖櫬櫚櫸槚檻檳櫧橫檣櫻櫫櫥櫓櫞檐檁歡歟歐殲歿殤殘殞殮殫殯毆毀轂畢斃氈毿氌氣氫氬氳匯漢汙湯洶沓溝沒灃漚瀝淪滄沨溈滬沵濘淚澩瀧瀘濼瀉潑澤涇潔灑窪浹淺漿澆湞浉濁測澮濟瀏浐渾滸濃潯浕塗湧濤澇淶漣潿渦涢渙滌潤澗漲澀澱淵淥漬瀆漸澠漁瀋滲溫遊灣濕潰濺漵溇潷滾滯灩灄滿瀅濾濫灤濱灘滪濫瀠瀟瀲濰潛瀦瀾瀨瀕灝滅燈靈災燦煬爐燉煒熗點煉熾爍爛烴燭煙煩燒燁燴燙燼熱煥燜燾煆糊溜愛爺牘牦牽犧犢犟狀獷獁猶狽麅狝獰獨狹獅獪猙獄猻獫獵獼玀豬貓猬獻獺璣玙玚瑪瑋環現玱璽瑉玨琺瓏珰琿琎璉瑣瓊瑤璦璇瓔瓚甕甌電畫暢畬疇癤療瘧癘瘍癧瘡瘋皰屙癰痙癢瘂癆瘓癇癡癉瘆瘞瘺癟癱癮癭癩癬癲臒皚皺皸盞鹽監蓋盜盤瞘眥眬著睜睞瞼瞞矚矯磯礬礦碭碼磚硨硯碸礪礱礫礎硁矽碩硤磽硙硚確鹼礙磧磣堿碹滾禮祎禰禎禱禍稟祿禪離禿稈種積稱穢秾穭稅穌穩穡窮竊竅窯竄窩窺竇窶豎競篤筍筆筧箋籠籩築篳篩筜箏籌簽簡箓簀篋籜籮簞簫簣簍籃籬籪籟糴類秈糶糲粵糞糧糝糇緊縶糸糾紆紅紂纖紇約級紈纊紀紉緯紜纮純紕紗綱納纴縱綸紛紙紋紡纻纼紐紓線紺紲紱練組紳細織終縐絆紼絀紹繹經紿綁絨結絝繞绖絎繪給絢絳絡絕絞統綆綃絹繡绤綏絳繼綈績緒綾绬續綺緋綽緔緄繩維綿綬繃綢绹綹綣綜綻綰綠綴緇緙緗緘緬纜緹緲緝缊繢緦綞緞緶缐緱縋緩締縷編緡緣縉縛縟縝縫缞縞纏縭縊縑繽縹縵縲纓縮繆繅纈繚繕繒韁繾繰繯繳纘罌網羅罰罷羆羈羥羨翹翙翚耮耬聳恥聶聾職聹聯聵聰肅腸膚膁腎腫脹脅膽勝朧腖臚脛膠脈膾臟臍腦膿臠腳脫腡臉臘腌腘腭膩靦膃騰臏臜輿艤艦艙艫艱艷艹藝節羋薌蕪蘆蓯葦藶莧萇蒼苧蘇檾蘋莖蘢蔦塋煢繭荊薦荙莢蕘蓽蕎薈薺蕩榮葷滎犖熒蕁藎蓀蔭蕒葒葤藥蒞蓧萊蓮蒔萵薟獲蕕瑩鶯蒓萚蘿螢營縈蕭薩蔥蕆蕢蔣蔞藍薊蘺蕷鎣驀薔蘞藺藹蘄蘊藪槁蘚虜慮虛蟲虬蟣雖蝦蠆蝕蟻螞蠶蠔蜆蠱蠣蟶蠻蟄蛺蟯螄蠐蛻蝸蠟蠅蟈蟬蠍螻蠑螀蟎蟏釁銜補襯袞襖裊袆襪襲袯裝襠裈褳襝褲襇褸襤繈襕見觀觃規覓視覘覽覺覬覡覿觍覦覯覲覷觴觸觶詟譽謄訁計訂訃認譏訐訌討讓訕訖訓議訊記讱講諱謳詎訝訥許訛論讻訟諷設訪訣證詁訶評詛識诇詐訴診詆謅詞詘詔诐譯詒誆誄試詿詩詰詼誠誅詵話誕詬詮詭詢詣諍該詳詫諢詡诪誡誣語誚誤誥誘誨誑說誦誒請諸諏諾讀諑誹課諉諛誰諗調諂諒諄誶談誼謀諶諜謊諫諧謔謁謂諤諭諼讒諮諳諺諦謎諞谞謨讜謖謝謠謗謚謙謐謹謾謫譾謬譚譖譙讕譜譎讞譴譫讖谷豮貝貞負贠貢財責賢敗賬貨質販貪貧貶購貯貫貳賤賁貰貼貴貺貸貿費賀貽賊贄賈賄貲賃賂贓資賅贐賕賑賚賒賦賭賫贖賞賜赑赒賡賠賧賴赗贅賻賺賽賾贗贊赟贈贍贏贛赪趙趕趨趲躉躍蹌跖躒踐跶蹺蹕躚躋踴躊蹤躓躑躡蹣躕躥躪躦軀車軋軌軒轪軔轉軛輪軟轟軲軻轤軸軹軼軤軫轢軺輕軾載輊轎辀輇輅較輒輔輛輦輩輝輥輞辌輟輜輳輻輯辒輸轡轅轄輾轆轍轔辭辯辮邊遼達遷過邁運還這進遠違連遲邇逕跡適選遜遞邐邏遺遙鄧鄺鄔郵鄒鄴鄰郁郤郟鄶鄭鄆酈鄖鄲醞酦醬釅釃釀釋裏鉅鑒鑾鏨釓釔針釘釗釙釕釷釬釧釤钑釩釣鍆釹钖釵钘鈣鈈鈦鈍鈔鐘鈉鋇鋼鈑鈐鑰欽鈞鎢鉤鈧鈁鈥鈄鈕鈀鈺錢鉦鉗鈷缽鈳鉕鈽鈸鉞鉆鉬鉭鉀鈿鈾鐵鉑鈴鑠鉛鉚鈰鉉鉈鉍鈹鐸铏銬銠鉺銪鋏鋣鐃铚鐺銅鋁銱銦鎧鍘銖銑鋌銩铦鏵銓鉿銚鉻銘錚銫鉸銥鏟銃鐋銨銀銣鑄鐒鋪铻錸鋱鏈鏗銷鎖鋰鋥鋤鍋鋯鋨銹銼鋝鋒鋅鋶鐦鐧銳銻鋃鋟鋦錒錆鍺錯錨锜錁錕锠錫錮鑼錘錐錦鍁錈錇錟錠鍵鋸錳錙鍥锳鍇鏘鍶鍔鍤鍬鍾鍛鎪锽鍰鎄鍍鎂鏤镃鏌鎮镈鎘鑷鐫鎳鎿鎦鎬鎊鎰镕鏢鏜鏍镚鏞鏡鏑鏃鏇镠鐔鐝鐐鏷鑥鐓鑭鐠鑹鏹鐙鑊鐳镮鐲鐮鐿鑔鑣镴鑲長門閂閃閆闬閉問闖閏闈閑閎間閔閌悶閘鬧閨聞闥閩閭闿閥閣閡閫鬮閱閬阇閾閹閶鬩閿閽閻閼闡闌闃阓闊闋闔闐阘闕闞阛隊陽陰陣階際陸隴陳陘陜隉隕險隨隱隸雋難雛讎靂霧霽黴靄靚靜靨韃鞽韉韝韋韌韨韓韙韞韜韻頁頂頃頇項順須頊頑顧頓頎頒頌頏預顱領頗頸頡頰颋頜潁颎頦頤頻颒頹頷颕穎顆題颙顎顓顏額顳顢顛顙顥颣顫顬顰顴風飏飐颮颯颶飔颼飖飗飄飆飈飛饗饜饤饑饦餳飩餼飪飫飭飯飲餞飾飽飼饳飴餌饒餉饸饹餃饻餅餑饾餓餘餒馂馃餛餡館餷饋馉餿饞馌饃馎餾饈饉饅饊饌饢馬馭馱馴馳驅驲駁驢駔駛駟駙駒騶駐駝駑駕驛駘驍罵骃驕驊駱駭駢骉驪騁驗骍骎駿騏騎騍騅骔骕驂騙騭骙騷騖驁騮騫騸驃騾驄驏驟驥骦驤髏髖髕鬢魘魎魚鱽鱾魷鲀魯魴鲄鮁鮃鮎鱸鲉鲊鮒鲌鮑鱟鲏鮐鮭鮚鲓鮪鮞鲖鲗鲘鲙鱭鮫鮮鲝鯗鱘鯁鱺鰱鰹鯉鰣鰷鯀鯊鯇鲪鯽鲬鯖鯪鲯鯫鯡鯤鯧鯝鯢鯰鯛鯨鲹鯴鯔鱝鰈鲾鲿鳀鳁鳂鰓鱷鰍鰒鰉鳈鳉鯿鰠鰲鰭鰨鰥鰩鳑鳒鰳鰾鱈鱉鰻鰵鱅鳛鱖鱔鱗鱒鳠鳡鱧鳣鳥鳩雞鳶鳴鸤鷗鴉鸧鴇鴆鴣鶇鸕鴨鸮鴦鸰鴟鴝鴛鸴鴕鷥鷙鴯鴰鵂鸻鸼鴿鸞鴻鹀鵓鸝鵑鵠鵝鵒鷴鵜鵡鵲鶓鵪鹍鵯鵬鹐鶉鹒鹓鹔鶘鹖鶚鶻鶿鶥鶩鹝鷂鹟鹠鹡鹢鶼鶴鹥鸚鷓鷚鷯鷦鷲鷸鷺鹯鷹鸌鹲鸛鹴鹺麥麩黃黌黡黷黲黽黿鼌鼉鼗鼴齇齊齏齒齔龁龂齟齡齙齠齜齦齬齪齲齷龍龔龕龜誌制咨只裏系範松沒嘗嘗鬧面準鐘別閑乾盡臟拼'
    };

    var zh = chinese;

    /**
     * Author:luolei
     * Module dependencies.
     * 简繁体转换
     */

    var zhData = zh;

    /**
     * 简体字
     */
    var S = zhData.S;

    /**
     * 繁体字
     */
    var T = zhData.T;

    /**
     * 转换文本
     * @param {String} str - 待转换的文本
     * @param {Boolean} toT - 是否转换成繁体
     * @returns {String} - 转换结果
     */

    function tranStr (str, toT) {
        var i;
        var letter;
        var code;
        var isChinese;
        var index;
        var src;
        var des;
        var result = '';

        if (toT) {
            src = S;
            des = T;
        } else {
            src = T;
            des = S;
        }

        if (typeof str !== 'string') {
            return str;
        }

        for (i = 0; i < str.length; i++) {
            letter = str.charAt(i);
            code = str.charCodeAt(i);
            // 根据字符的Unicode判断是否为汉字，以提高性能
            isChinese = (code > 0x3400 && code < 0x9FC3) || (code > 0xF900 && code < 0xFA6A);
            if (!isChinese) {
                result += letter;
                continue;
            }

            index = src.indexOf(letter);

            if (index !== -1) {
                result += des.charAt(index);
            } else {
                result += letter;
            }
        }

        return result;
    }


    var Chinese = {
        s2t:function (str){
    		return tranStr(str,true)
    	},
    	t2s:function (str){
    		return tranStr(str,false)
    	}
    };

    var chineseS2t = Chinese;

    let lock = false;
    const handleScrollPage$1 = (element, chapterList, chapterDocList, mode, delta, isSliding, trigger) => __awaiter(void 0, void 0, void 0, function* () {
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        let section = Math.floor(element.clientWidth / 12);
        let gap = section % 2 === 0 ? section : section - 1;
        if (delta > 0 && doc.body.scrollLeft > 0) {
            doc.body.scrollBy({
                top: 0,
                left: -element.offsetWidth - gap,
                behavior: isSliding ? "smooth" : "auto",
            });
            // trigger("page-changed");
        }
        else if (delta > 0 && doc.body.scrollLeft === 0) {
            handlePrevChapter(element, chapterList, chapterDocList, mode);
            trigger("rendered");
        }
        else if (delta < 0) {
            handleTurnChapter(element, chapterList, chapterDocList, mode, trigger);
            doc.body.scrollBy({
                top: 0,
                left: element.offsetWidth + gap,
                behavior: isSliding ? "smooth" : "auto",
            });
        }
    });
    const handlePrevChapter = (element, chapterList, chapterDocList, mode) => {
        let chapterTitle = StorageUtil.getKookitConfig("chapterTitle");
        let chapterIndex = _.findIndex(chapterList.map((item) => {
            item.label = item.label.trim();
            return item;
        }), {
            label: chapterTitle.trim(),
        });
        if (chapterIndex === 0 || chapterIndex === -1 || !chapterTitle) {
            return;
        }
        StorageUtil.setKookitConfig("chapterTitle", chapterList[chapterIndex - 1].label);
        StorageUtil.setKookitConfig("text", "prevChapter");
        handleRenderChatper(chapterList[chapterIndex - 1].label, chapterDocList, element, mode);
    };
    const handleRenderChatper = (label = "", chapterDocList, element, mode) => {
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        doc.body.innerHTML = "";
        let chapterIndex = _.findIndex(chapterDocList.map((item) => {
            item.title = item.title.trim();
            return item;
        }), {
            title: label.trim(),
        });
        chapterIndex = chapterIndex === -1 ? 0 : chapterIndex;
        doc.body.innerHTML = chapterDocList[chapterIndex].text;
        StorageUtil.setKookitConfig("chapterTitle", chapterDocList[chapterIndex].title);
        StorageUtil.setKookitConfig("percentage", chapterIndex / chapterDocList.length + "");
        handleIframeHeight(element, mode);
        handleImageSize(element, mode);
        handleScrollPosition$1(element, mode);
    };
    const handleScrollPosition$1 = (element, mode, _text = "", _count = "0") => {
        let text = _text || StorageUtil.getKookitConfig("text") || "";
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        let nodeList = Array.from(doc.body.querySelectorAll("h1,h2,h3,h4,p,img"));
        if (text) {
            let targetNodeList = nodeList.filter((s, index) => {
                return (((s.innerText &&
                    (s.innerText === text ||
                        s.innerText === chineseS2t.t2s(text) ||
                        s.innerText === chineseS2t.s2t(text))) ||
                    (s.getAttribute("recindex") &&
                        s.getAttribute("recindex") === text)) &&
                    Math.abs(index - parseInt(_count || StorageUtil.getKookitConfig("count"))) < 2);
            });
            let targetNode = targetNodeList[0];
            if (mode !== "scroll") {
                doc.body.scrollTo(text && targetNode
                    ? targetNode.getBoundingClientRect().left
                    : text === "prevChapter"
                        ? doc.body.scrollWidth
                        : 0, 0);
            }
            else {
                element.scrollTo(0, text && targetNode ? targetNode.getBoundingClientRect().top : 0);
            }
        }
        else {
            if (mode !== "scroll") {
                doc.body.scrollTo(0, 0);
            }
            else {
                element.scrollTo(0, 0);
            }
        }
    };
    const handleTurnChapter = (element, chapterList, chapterDocList, mode, trigger) => {
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        if (Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) <
            10 &&
            Math.abs(doc.body.scrollWidth - doc.body.scrollLeft - doc.body.clientWidth) < 10) {
            handleNextChapter(element, chapterList, chapterDocList, mode);
            trigger("rendered");
        }
    };
    const handleRecord = (element, mode) => __awaiter(void 0, void 0, void 0, function* () {
        if (lock)
            return;
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        let nodeList = Array.from(doc.body.querySelectorAll("h1,h2,h3,h4,p,img"));
        let visibleNode = nodeList.filter((s) => isScrolledIntoView(element, s, mode) &&
            (s.innerText.trim() || s.getAttribute("recindex")));
        let firstVisibleNode = visibleNode[0];
        let count = 0;
        for (let i = 0; i < nodeList.length; i++) {
            if (isScrolledIntoView(element, nodeList[i], mode) &&
                nodeList[i].tagName === "IMG") {
                count = i;
                break;
            }
            if (isScrolledIntoView(element, nodeList[i], mode) &&
                firstVisibleNode &&
                nodeList[i].innerHTML === firstVisibleNode.innerHTML &&
                nodeList[i].tagName !== "IMG") {
                count = i;
                break;
            }
        }
        StorageUtil.setKookitConfig("text", firstVisibleNode
            ? firstVisibleNode.innerText
                ? firstVisibleNode.innerText
                : firstVisibleNode.getAttribute("recindex")
                    ? firstVisibleNode.getAttribute("recindex")
                    : ""
            : "");
        StorageUtil.setKookitConfig("count", count + "");
        lock = true;
        setTimeout(() => {
            lock = false;
        }, 100);
    });
    const handleNextChapter = (element, chapterList, chapterDocList, mode) => {
        let chapterTitle = StorageUtil.getKookitConfig("chapterTitle");
        let chapterIndex = _.findIndex(chapterList.map((item) => {
            item.label = item.label.trim();
            return item;
        }), {
            label: chapterTitle.trim(),
        });
        if (chapterIndex === chapterList.length - 1 || chapterIndex === -1) {
            return;
        }
        StorageUtil.setKookitConfig("chapterTitle", chapterList[chapterIndex + 1].label);
        StorageUtil.setKookitConfig("text", "");
        handleRenderChatper(chapterList[chapterIndex + 1].label, chapterDocList, element, mode);
    };
    const getVisibleText = (element, mode) => {
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        let nodeList = Array.from(doc.body.querySelectorAll("h1,h2,h3,h4,p,img"));
        let visibleNode = nodeList.filter((s) => isScrolledIntoView(element, s, mode) &&
            (s.innerText.trim() || s.getAttribute("recindex")));
        return (mode !== "scroll" ? visibleNode : nodeList)
            .map((item) => item.innerText)
            .join(" ");
    };
    const getSearchResult = (keyword, chapterDocList) => {
        let searchResult = [];
        for (let i = 0; i < chapterDocList.length; i++) {
            let chapterDoc = new DOMParser().parseFromString(chapterDocList[i].text, "text/html");
            let nodeList = Array.from(chapterDoc.body.querySelectorAll("h1,h2,h3,h4,p,img"));
            for (let j = 0; j < nodeList.length; j++) {
                if (nodeList[j].innerText.indexOf(keyword) > -1) {
                    searchResult.push({
                        excerpt: nodeList[j].innerText,
                        cfi: JSON.stringify({
                            text: nodeList[j].innerText,
                            chapterTitle: chapterDocList[i].title,
                            count: j,
                            percentage: i / chapterDocList.length,
                        }),
                    });
                }
            }
        }
        return searchResult;
    };
    const isScrolledIntoView = (element, el, mode) => {
        var isVisible = false;
        var rect = el.getBoundingClientRect();
        if (mode !== "scroll" && el.innerText.trim()) {
            let elemLeft = rect.left;
            isVisible = elemLeft > -10 && elemLeft <= element.offsetWidth;
        }
        else if (el.innerText.trim()) {
            let elemTop = rect.top;
            isVisible =
                elemTop >= element.scrollTop &&
                    elemTop <= element.scrollTop + element.offsetHeight;
        }
        else if (mode !== "scroll" &&
            (el.id || el.onerror) &&
            el.tagName === "IMG") {
            let elemLeft = rect.left;
            isVisible = elemLeft >= 0 && elemLeft <= element.offsetWidth;
        }
        else if ((el.id || el.onerror) && el.tagName === "IMG") {
            let elemTop = rect.top;
            isVisible =
                elemTop >= element.scrollTop - element.clientHeight / 2 &&
                    elemTop <=
                        element.scrollTop + element.offsetHeight + element.clientHeight / 2;
        }
        return isVisible;
    };

    class MobiParser {
        constructor(bookStr) {
            this.bookStr = bookStr;
            this.chapterList = [];
            this.chapterDocList = [];
        }
        getChapterDoc() {
            let tempChapterList = this.bookStr.indexOf("<mbp:pagebreak>") > -1
                ? this.bookStr
                    .split("<mbp:pagebreak>")
                    .filter((item) => item.trim() !== "")
                : this.bookStr
                    .split("<address> </address>")
                    .filter((item) => item.trim() !== "");
            let chapterList = [];
            let titleList = [];
            let tempChapter = "";
            for (let i = 0; i < tempChapterList.length; i++) {
                let chapterDoc = new DOMParser().parseFromString(tempChapterList[i], "text/html");
                if (isNodeTitle(chapterDoc)) {
                    chapterList.push(tempChapter + tempChapterList[i]);
                    tempChapter = "";
                }
                else {
                    tempChapter += tempChapterList[i];
                }
            }
            if (chapterList.length === 0) {
                chapterList.push(tempChapter);
            }
            for (let i = 0; i < chapterList.length; i++) {
                let chapterDoc = new DOMParser().parseFromString(chapterList[i], "text/html");
                let titleNodeList = chapterDoc.querySelectorAll("h1,h2,h3,h4,blockquote,font,b");
                let firstValidTitle;
                for (let i = 0; i < titleNodeList.length; i++) {
                    if (titleNodeList[i].innerText.trim() &&
                        !isSpecialChar(titleNodeList[i].innerText) &&
                        !isKeyword(titleNodeList[i].innerText)) {
                        firstValidTitle = titleNodeList[i];
                        break;
                    }
                }
                this.chapterDocList.push({
                    title: firstValidTitle
                        ? titleList.indexOf(firstValidTitle.innerText) === -1
                            ? firstValidTitle.innerText
                            : firstValidTitle.innerText + "#" + i
                        : "Forword",
                    text: chapterList[i],
                });
                firstValidTitle && titleList.push(firstValidTitle.innerText);
            }
            return this.chapterDocList;
        }
        getChapter() {
            for (let i = 0; i < this.chapterDocList.length; i++) {
                let random = Math.floor(Math.random() * 900000) + 100000;
                this.chapterList.push({
                    label: this.chapterDocList[i].title,
                    id: "title" + random,
                    href: "title" + random,
                    subitems: [],
                });
            }
            return this.chapterList;
        }
    }

    class StrParser {
        constructor(bookStr) {
            this.bookStr = bookStr;
            this.chapterList = [];
            this.chapterDocList = [];
            this.bookDoc = new DOMParser().parseFromString(this.bookStr, "text/html");
            this.chapterDomList = [];
        }
        getChapter() {
            this.chapterDomList = Array.from(this.bookDoc.querySelectorAll("h1,h2,h3,h4,font,b"));
            if (this.chapterDomList.length > 0) {
                this.insertPageBreak();
                let parser = new MobiParser(this.bookDoc.body.innerHTML);
                this.chapterDocList = parser.getChapterDoc();
                this.chapterList = parser.getChapter();
            }
            else {
                this.getExtraTitle();
                this.generateChapterList();
                this.insertPageBreak();
            }
            return this.chapterList;
        }
        insertPageBreak() {
            for (let i = 0; i < this.chapterDomList.length; i++) {
                // this.chapterDomList[i].id = this.chapterList[i].id;
                var newItem = document.createElement("address");
                var textnode = document.createTextNode(" ");
                newItem.appendChild(textnode);
                this.chapterDomList[i].parentNode &&
                    this.chapterDomList[i].parentNode.insertBefore(newItem, this.chapterDomList[i]);
            }
        }
        generateChapterList() {
            if (this.chapterDomList.length === 0) {
                let random = Math.floor(Math.random() * 900000) + 100000;
                this.chapterList.push({
                    label: "Forword",
                    id: "title" + random,
                    href: "title" + random,
                    subitems: [],
                });
            }
            let titleList = [];
            for (let i = 0; i < this.chapterDomList.length; i++) {
                let random = Math.floor(Math.random() * 900000) + 100000;
                this.chapterList.push({
                    label: this.chapterDomList[i]
                        ? titleList.lastIndexOf(this.chapterDomList[i].innerText) === -1
                            ? this.chapterDomList[i].innerText
                            : titleList[titleList.lastIndexOf(this.chapterDomList[i].innerText)] + i
                        : "Forword",
                    id: "title" + random,
                    href: "title" + random,
                    subitems: [],
                });
                titleList.push(this.chapterList[i].label);
            }
        }
        getExtraTitle() {
            let isStartWithKeyword = false;
            if (this.chapterDomList.length === 0) {
                this.chapterDomList = Array.from(this.bookDoc.getElementsByTagName("p")).filter((item) => {
                    if (!isStartWithKeyword &&
                        ((item.innerText.trim().startsWith("第") &&
                            startWithDI(item.innerText.trim())) ||
                            item.innerText.trim().startsWith("Chapter") ||
                            item.innerText.trim().startsWith("CHAPTER"))) {
                        isStartWithKeyword = true;
                    }
                    return isTitle(item.innerText.trim(), isStartWithKeyword);
                });
            }
        }
        getChapterDoc() {
            if (this.chapterDocList.length > 0) {
                return this.chapterDocList;
            }
            let chapterStrList = this.bookDoc.body.innerHTML
                .split("<address> </address>")
                .filter((item) => item.trim() !== "");
            for (let i = 0; i < chapterStrList.length; i++) {
                if (chapterStrList.length > this.chapterList.length && i === 0) {
                    let random = Math.floor(Math.random() * 900000) + 100000;
                    this.chapterList.unshift({
                        label: "Forword" + i,
                        id: "title" + random,
                        href: "title" + random,
                        subitems: [],
                    });
                }
                this.chapterDocList.push({
                    title: this.chapterList[i].label,
                    text: chapterStrList[i],
                });
            }
            return this.chapterDocList;
        }
    }

    class EventEmitter {
        constructor() {
            this.callbacks = {};
            this.callbacks.base = {};
        }
        /**
         * On
         */
        on(_names, callback) {
            const that = this;
            // Errors
            if (typeof _names === "undefined" || _names === "") {
                console.warn("wrong names");
                return false;
            }
            if (typeof callback === "undefined") {
                console.warn("wrong callback");
                return false;
            }
            // Resolve names
            const names = this.resolveNames(_names);
            // Each name
            names.forEach(function (_name) {
                // Resolve name
                const name = that.resolveName(_name);
                // Create namespace if not exist
                if (!(that.callbacks[name.namespace] instanceof Object))
                    that.callbacks[name.namespace] = {};
                // Create callback if not exist
                if (!(that.callbacks[name.namespace][name.value] instanceof Array))
                    that.callbacks[name.namespace][name.value] = [];
                // Add callback
                that.callbacks[name.namespace][name.value].push(callback);
            });
            return this;
        }
        /**
         * Off
         */
        off(_names) {
            const that = this;
            // Errors
            if (typeof _names === "undefined" || _names === "") {
                console.warn("wrong name");
                return false;
            }
            // Resolve names
            const names = this.resolveNames(_names);
            // Each name
            names.forEach(function (_name) {
                // Resolve name
                const name = that.resolveName(_name);
                // Remove namespace
                if (name.namespace !== "base" && name.value === "") {
                    delete that.callbacks[name.namespace];
                }
                // Remove specific callback in namespace
                else {
                    // Default
                    if (name.namespace === "base") {
                        // Try to remove from each namespace
                        for (const namespace in that.callbacks) {
                            if (that.callbacks[namespace] instanceof Object &&
                                that.callbacks[namespace][name.value] instanceof Array) {
                                delete that.callbacks[namespace][name.value];
                                // Remove namespace if empty
                                if (Object.keys(that.callbacks[namespace]).length === 0)
                                    delete that.callbacks[namespace];
                            }
                        }
                    }
                    // Specified namespace
                    else if (that.callbacks[name.namespace] instanceof Object &&
                        that.callbacks[name.namespace][name.value] instanceof Array) {
                        delete that.callbacks[name.namespace][name.value];
                        // Remove namespace if empty
                        if (Object.keys(that.callbacks[name.namespace]).length === 0)
                            delete that.callbacks[name.namespace];
                    }
                }
            });
            return this;
        }
        /**
         * Trigger
         */
        trigger(_name, _args = []) {
            // Errors
            if (typeof _name === "undefined" || _name === "") {
                console.warn("wrong name");
                return false;
            }
            const that = this;
            let finalResult = null;
            // Default args
            const args = !(_args instanceof Array) ? [] : _args;
            // Resolve names (should on have one event)
            let name = this.resolveNames(_name);
            // Resolve name
            name = this.resolveName(name[0]);
            setTimeout(() => {
                if (name.namespace === "base") {
                    // Try to find callback in each namespace
                    for (const namespace in that.callbacks) {
                        if (that.callbacks[namespace] instanceof Object &&
                            that.callbacks[namespace][name.value] instanceof Array) {
                            that.callbacks[namespace][name.value].forEach(function (callback) {
                                callback.apply(that, args);
                            });
                        }
                        else if (this.callbacks[name.namespace] instanceof Object) {
                            if (name.value === "") {
                                console.warn("wrong name");
                                return this;
                            }
                            that.callbacks[name.namespace][name.value].forEach(function (callback) {
                                callback.apply(that, args);
                            });
                        }
                        return finalResult;
                    }
                }
            }, 100);
            // Default namespace
            // Specified namespace
        }
        /**
         * Resolve names
         */
        resolveNames(_names) {
            let names = _names;
            names = names.replace(/[^a-zA-Z0-9 ,/.]/g, "");
            names = names.replace(/[,/]+/g, " ");
            names = names.split(" ");
            return names;
        }
        /**
         * Resolve name
         */
        resolveName(name) {
            const newName = {};
            const parts = name.split(".");
            newName.original = name;
            newName.value = parts[0];
            newName.namespace = "base"; // Base namespace
            // Specified namespace
            if (parts.length > 1 && parts[1] !== "") {
                newName.namespace = parts[1];
            }
            return newName;
        }
    }

    class StrRender extends EventEmitter {
        constructor(bookStr, mode, isSliding) {
            super();
            this.bookStr = bookStr;
            this.mode = mode;
            this.chapterList = [];
            this.chapterDocList = [];
            this.element = "";
            this.isSliding = isSliding || false;
        }
        renderTo(element) {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                if (!(yield excuteCode())) {
                    resolve();
                    return;
                }
                this.element = element;
                let parser = new StrParser(this.bookStr);
                this.chapterList = parser.getChapter();
                this.chapterDocList = parser.getChapterDoc();
                let chapterTitle = StorageUtil.getKookitConfig("chapterTitle") ||
                    this.chapterDocList[0].title;
                createIframe(element);
                handleRenderChatper(chapterTitle, this.chapterDocList, this.element, this.mode);
                handleLayout(element, this.mode);
                this.trigger("rendered");
                resolve();
            }));
        }
        getChapter() {
            return this.chapterList;
        }
        getPageSize() {
            return {
                width: this.element.clientWidth,
                height: this.element.clientHeight,
            };
        }
        goToChapter(title) {
            handleRenderChatper(title, this.chapterDocList, this.element, this.mode);
            this.trigger("rendered");
        }
        goToPosition(cfi) {
            let { text, chapterTitle, count } = JSON.parse(cfi);
            handleRenderChatper(chapterTitle, this.chapterDocList, this.element, this.mode);
            handleScrollPosition$1(this.element, this.mode, text, count);
            this.record();
            this.trigger("rendered");
        }
        record() {
            handleRecord(this.element, this.mode);
        }
        removeContent() {
            this.element.innerHTML = "";
        }
        flatChapter(chapters) {
            return chapters;
        }
        prev() {
            return __awaiter(this, void 0, void 0, function* () {
                this.trigger("page-changed");
                let pageArea = document.getElementById("page-area");
                if (!pageArea)
                    return;
                let iframe = pageArea.getElementsByTagName("iframe")[0];
                if (!iframe)
                    return;
                let doc = iframe.contentDocument;
                if (!doc) {
                    return;
                }
                if (this.mode === "scroll" || doc.body.scrollLeft === 0) {
                    handlePrevChapter(this.element, this.chapterList, this.chapterDocList, this.mode);
                    this.trigger("rendered");
                }
                else {
                    handleScrollPage$1(this.element, this.chapterList, this.chapterDocList, this.mode, 1, this.isSliding, this.trigger);
                }
                handleRecord(this.element, this.mode);
            });
        }
        next() {
            return __awaiter(this, void 0, void 0, function* () {
                this.trigger("page-changed");
                let pageArea = document.getElementById("page-area");
                if (!pageArea)
                    return;
                let iframe = pageArea.getElementsByTagName("iframe")[0];
                if (!iframe)
                    return;
                let doc = iframe.contentDocument;
                if (!doc) {
                    return;
                }
                if (Math.abs(doc.body.scrollWidth - doc.body.scrollLeft - doc.body.clientWidth) < 10 ||
                    this.mode === "scroll") {
                    handleNextChapter(this.element, this.chapterList, this.chapterDocList, this.mode);
                    this.trigger("rendered");
                }
                else {
                    handleScrollPage$1(this.element, this.chapterList, this.chapterDocList, this.mode, -1, this.isSliding, this.trigger);
                }
                handleRecord(this.element, this.mode);
            });
        }
        visibleText() {
            return getVisibleText(this.element, this.mode);
        }
        doSearch(keyword) {
            return getSearchResult(keyword, this.chapterDocList);
        }
        getProgress() {
            return progressInfo();
        }
        getPosition() {
            return {
                text: StorageUtil.getKookitConfig("text"),
                chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
                count: StorageUtil.getKookitConfig("count"),
                percentage: StorageUtil.getKookitConfig("percentage"),
            };
        }
        setStyle(css) {
            let pageArea = document.getElementById("page-area");
            if (!pageArea)
                return;
            let iframe = pageArea.getElementsByTagName("iframe")[0];
            if (!iframe)
                return;
            let doc = iframe.contentDocument;
            if (!doc) {
                return;
            }
            doc.body.setAttribute("style", css + doc.body.getAttribute("style"));
        }
    }

    function ab2str(buf) {
        if (buf instanceof ArrayBuffer) {
            buf = new Uint8Array(buf);
        }
        return new TextDecoder("utf-8").decode(buf);
    }
    var domParser = new DOMParser();
    class MobiBuffer {
        constructor(capacity) {
            this.capacity = capacity;
            this.fragment_list = [];
            this.imageArray = [];
            this.cur_fragment = new Fragment(capacity);
            this.fragment_list.push(this.cur_fragment);
        }
        write(byte) {
            var result = this.cur_fragment.write(byte);
            if (!result) {
                this.cur_fragment = new Fragment(this.capacity);
                this.fragment_list.push(this.cur_fragment);
                this.cur_fragment.write(byte);
            }
        }
        get(idx) {
            var fi = 0;
            while (fi < this.fragment_list.length) {
                var frag = this.fragment_list[fi];
                if (idx < frag.size) {
                    return frag.get(idx);
                }
                idx -= frag.size;
                fi += 1;
            }
            return null;
        }
        size() {
            var s = 0;
            for (var i = 0; i < this.fragment_list.length; i++) {
                s += this.fragment_list[i].size;
            }
            return s;
        }
        shrink() {
            var total_buffer = new Uint8Array(this.size());
            var offset = 0;
            for (var i = 0; i < this.fragment_list.length; i++) {
                var frag = this.fragment_list[i];
                if (frag.full()) {
                    total_buffer.set(frag.buffer, offset);
                }
                else {
                    total_buffer.set(frag.buffer.slice(0, frag.size), offset);
                }
                offset += frag.size;
            }
            return total_buffer;
        }
    }
    var copagesne_uint8array = function (buffers) {
        var total_size = 0;
        for (let i = 0; i < buffers.length; i++) {
            var buffer = buffers[i];
            total_size += buffer.length;
        }
        var total_buffer = new Uint8Array(total_size);
        var offset = 0;
        for (let i = 0; i < buffers.length; i++) {
            buffer = buffers[i];
            total_buffer.set(buffer, offset);
            offset += buffer.length;
        }
        return total_buffer;
    };
    class Fragment {
        constructor(capacity) {
            this.buffer = new Uint8Array(capacity);
            this.capacity = capacity;
            this.size = 0;
        }
        write(byte) {
            if (this.size >= this.capacity) {
                return false;
            }
            this.buffer[this.size] = byte;
            this.size += 1;
            return true;
        }
        full() {
            return this.size === this.capacity;
        }
        get(idx) {
            return this.buffer[idx];
        }
    }
    var uncompression_lz77 = function (data) {
        var length = data.length;
        var offset = 0; // Current offset into data
        var buffer = new MobiBuffer(data.length);
        while (offset < length) {
            var char = data[offset];
            offset += 1;
            if (char === 0) {
                buffer.write(char);
            }
            else if (char <= 8) {
                for (var i = offset; i < offset + char; i++) {
                    buffer.write(data[i]);
                }
                offset += char;
            }
            else if (char <= 0x7f) {
                buffer.write(char);
            }
            else if (char <= 0xbf) {
                var next = data[offset];
                offset += 1;
                var distance = (((char << 8) | next) >> 3) & 0x7ff;
                var lz_length = (next & 0x7) + 3;
                var buffer_size = buffer.size();
                for (let i = 0; i < lz_length; i++) {
                    buffer.write(buffer.get(buffer_size - distance));
                    buffer_size += 1;
                }
            }
            else {
                buffer.write(32);
                buffer.write(char ^ 0x80);
            }
        }
        return buffer;
    };
    class MobiFile {
        constructor(data) {
            this.getAzw3Style = (doc) => {
                var _a, _b, _c;
                let style = "";
                if (doc.documentElement.lastChild &&
                    ((_a = doc.documentElement.lastChild) === null || _a === void 0 ? void 0 : _a.lastChild) &&
                    !this.isElement((_b = doc.documentElement.lastChild) === null || _b === void 0 ? void 0 : _b.lastChild)) {
                    style = ((_c = doc.documentElement.lastChild) === null || _c === void 0 ? void 0 : _c.lastChild.textContent) || "";
                }
                return style;
            };
            this.render_image = (imgDoms, i) => {
                return new Promise((resolve, reject) => {
                    var imgDom = imgDoms[i];
                    var idx = imgDom.getAttribute("recindex")
                        ? +imgDom.getAttribute("recindex")
                        : i + 1;
                    imgDom.setAttribute("onerror", "this.style.display='none'");
                    // imgDom.setAttribute("style", "max-width: 100%; max-height: 100%");
                    var blob = this.read_image(idx - 1);
                    var imgReader = new FileReader();
                    imgReader.onload = (e) => {
                        var _a, _b;
                        imgDom.src = (_a = e.target) === null || _a === void 0 ? void 0 : _a.result;
                        resolve((_b = e.target) === null || _b === void 0 ? void 0 : _b.result);
                    };
                    imgReader.onerror = function (err) {
                        reject(err);
                    };
                    imgReader.readAsDataURL(blob);
                });
            };
            this.view = new DataView(data);
            this.buffer = this.view.buffer;
            this.offset = 0;
            this.header = null;
        }
        parse() { }
        getUint8() {
            var v = this.view.getUint8(this.offset);
            this.offset += 1;
            return v;
        }
        getUint16() {
            var v = this.view.getUint16(this.offset);
            this.offset += 2;
            return v;
        }
        getUint32() {
            var v = this.view.getUint32(this.offset);
            this.offset += 4;
            return v;
        }
        getStr(size) {
            var v = ab2str(this.buffer.slice(this.offset, this.offset + size));
            this.offset += size;
            return v;
        }
        skip(size) {
            this.offset += size;
        }
        setoffset(_of) {
            this.offset = _of;
        }
        get_record_extrasize(data, flags) {
            var pos = data.length - 1;
            var extra = 0;
            for (var i = 15; i > 0; i--) {
                if (flags & (1 << i)) {
                    var res = this.buffer_get_varlen(data, pos);
                    var size = res[0];
                    var l = res[1];
                    pos = res[2];
                    pos -= size - l;
                    extra += size;
                }
            }
            if (flags & 1) {
                var a = data[pos];
                extra += (a & 0x3) + 1;
            }
            return extra;
        }
        // data should be uint8array
        buffer_get_varlen(data, pos) {
            var l = 0;
            var size = 0;
            var byte_count = 0;
            var mask = 0x7f;
            var stop_flag = 0x80;
            var shift = 0;
            for (var i = 0;; i++) {
                var byte = data[pos];
                size |= (byte & mask) << shift;
                shift += 7;
                l += 1;
                byte_count += 1;
                pos -= 1;
                var to_stop = byte & stop_flag;
                if (byte_count >= 4 || to_stop > 0) {
                    break;
                }
            }
            return [size, l, pos];
        }
        // 读出文本内容
        read_text() {
            var text_end = this.palm_header.record_count;
            var buffers = [];
            for (var i = 1; i <= text_end; i++) {
                buffers.push(this.read_text_record(i));
            }
            var all = copagesne_uint8array(buffers);
            return ab2str(all);
        }
        read_text_record(i) {
            var flags = this.mobi_header.extra_flags;
            var begin = this.reclist[i].offset;
            var end = this.reclist[i + 1].offset;
            var data = new Uint8Array(this.buffer.slice(begin, end));
            var ex = this.get_record_extrasize(data, flags);
            data = new Uint8Array(this.buffer.slice(begin, end - ex));
            if (this.palm_header.compression === 2) {
                var buffer = uncompression_lz77(data);
                return buffer.shrink();
            }
            else if (this.palm_header.compression === 17480) {
                return data;
                // var buffer = uncompression_huff(data);
                // return buffer.shrink();
            }
            else {
                return data;
            }
        }
        // 从buffer中读出image
        read_image(idx) {
            var first_image_idx = this.mobi_header.first_image_idx;
            var begin = this.reclist[first_image_idx + idx].offset;
            var end = this.reclist[first_image_idx + idx + 1].offset;
            var data = new Uint8Array(this.buffer.slice(begin, end));
            return new Blob([data.buffer]);
        }
        load() {
            this.header = this.load_pdbheader();
            this.reclist = this.load_reclist();
            this.load_record0();
        }
        load_pdbheader() {
            var header = {};
            header.name = this.getStr(32);
            header.attr = this.getUint16();
            header.version = this.getUint16();
            header.ctime = this.getUint32();
            header.mtime = this.getUint32();
            header.btime = this.getUint32();
            header.mod_num = this.getUint32();
            header.appinfo_offset = this.getUint32();
            header.sortinfo_offset = this.getUint32();
            header.type = this.getStr(4);
            header.creator = this.getStr(4);
            header.uid = this.getUint32();
            header.next_rec = this.getUint32();
            header.record_num = this.getUint16();
            return header;
        }
        load_reclist() {
            var reclist = [];
            for (var i = 0; i < this.header.record_num; i++) {
                var record = {};
                record.offset = this.getUint32();
                // TODO(zz) change
                record.attr = this.getUint32();
                reclist.push(record);
            }
            return reclist;
        }
        load_record0() {
            this.palm_header = this.load_record0_header();
            this.mobi_header = this.load_mobi_header();
        }
        load_record0_header() {
            var p_header = {};
            var first_record = this.reclist[0];
            this.setoffset(first_record.offset);
            p_header.compression = this.getUint16();
            this.skip(2);
            p_header.text_length = this.getUint32();
            p_header.record_count = this.getUint16();
            p_header.record_size = this.getUint16();
            p_header.encryption_type = this.getUint16();
            this.skip(2);
            return p_header;
        }
        load_mobi_header() {
            var mobi_header = {};
            var start_offset = this.offset;
            mobi_header.identifier = this.getUint32();
            mobi_header.header_length = this.getUint32();
            mobi_header.mobi_type = this.getUint32();
            mobi_header.text_encoding = this.getUint32();
            mobi_header.uid = this.getUint32();
            mobi_header.generator_version = this.getUint32();
            this.skip(40);
            mobi_header.first_nonbook_index = this.getUint32();
            mobi_header.full_name_offset = this.getUint32();
            mobi_header.full_name_length = this.getUint32();
            mobi_header.language = this.getUint32();
            mobi_header.input_language = this.getUint32();
            mobi_header.output_language = this.getUint32();
            mobi_header.min_version = this.getUint32();
            mobi_header.first_image_idx = this.getUint32();
            mobi_header.huff_rec_index = this.getUint32();
            mobi_header.huff_rec_count = this.getUint32();
            mobi_header.datp_rec_index = this.getUint32();
            mobi_header.datp_rec_count = this.getUint32();
            mobi_header.exth_flags = this.getUint32();
            this.skip(36);
            mobi_header.drm_offset = this.getUint32();
            mobi_header.drm_count = this.getUint32();
            mobi_header.drm_size = this.getUint32();
            mobi_header.drm_flags = this.getUint32();
            this.skip(8);
            // TODO (zz) fdst_index
            this.skip(4);
            this.skip(46);
            mobi_header.extra_flags = this.getUint16();
            this.setoffset(start_offset + mobi_header.header_length);
            return mobi_header;
        }
        load_exth_header() {
            // TODO
            return {};
        }
        extractContent(s) {
            var span = document.createElement("span");
            span.innerHTML = s;
            return span.textContent || span.innerText;
        }
        render() {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                this.load();
                var content = this.read_text();
                var bookDoc = domParser.parseFromString(content, "text/html").documentElement;
                var imgDoms = bookDoc.getElementsByTagName("img");
                for (let i = 0; i < imgDoms.length; i++) {
                    yield this.render_image(imgDoms, i);
                }
                resolve(bookDoc);
            }));
        }
        isElement(obj) {
            try {
                //Using W3 DOM2 (works for FF, Opera and Chrome)
                return obj instanceof HTMLElement;
            }
            catch (e) {
                //Browsers not supporting W3 DOM2 don't have HTMLElement and
                //an exception is thrown and we end up here. Testing some
                //properties that all elements have (works on IE7)
                return (typeof obj === "object" &&
                    obj.nodeType === 1 &&
                    typeof obj.style === "object" &&
                    typeof obj.ownerDocument === "object");
            }
        }
        getMetadata() {
            this.load();
            return {
                compression: this.palm_header.compression,
                ctime: this.header.ctime,
                mtime: this.header.mtime,
                language: this.mobi_header.language,
            };
        }
    }

    class Azw3Render extends EventEmitter {
        constructor(azw3Buffer, mode, isSliding) {
            super();
            this.azw3Buffer = azw3Buffer;
            this.mode = mode;
            this.isSliding = isSliding || false;
            this.chapterList = [];
            this.chapterDocList = [];
            this.bookStr = "";
            this.element = "";
        }
        renderTo(element) {
            return __awaiter(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    if (!(yield excuteCode())) {
                        resolve();
                        return;
                    }
                    let mobiDoc = yield new MobiFile(this.azw3Buffer).render();
                    let bookStr = mobiDoc.outerHTML;
                    this.bookStr = bookStr;
                    this.element = element;
                    let parser = new StrParser(this.bookStr);
                    this.chapterList = parser.getChapter();
                    this.chapterDocList = parser.getChapterDoc();
                    let chapterTitle = StorageUtil.getKookitConfig("chapterTitle") ||
                        this.chapterDocList[0].title;
                    createIframe(element, getAzw3Style(mobiDoc));
                    handleLayout(element, this.mode);
                    handleRenderChatper(chapterTitle, this.chapterDocList, this.element, this.mode);
                    this.trigger("rendered");
                    resolve();
                }));
            });
        }
        getChapter() {
            return this.chapterList;
        }
        getPageSize() {
            return {
                width: this.element.clientWidth,
                height: this.element.clientHeight,
            };
        }
        goToChapter(title) {
            handleRenderChatper(title, this.chapterDocList, this.element, this.mode);
            this.trigger("rendered");
        }
        goToPosition(cfi) {
            let { text, chapterTitle, count } = JSON.parse(cfi);
            handleRenderChatper(chapterTitle, this.chapterDocList, this.element, this.mode);
            handleScrollPosition$1(this.element, this.mode, text, count);
            this.record();
            this.trigger("rendered");
        }
        prev() {
            return __awaiter(this, void 0, void 0, function* () {
                let pageArea = document.getElementById("page-area");
                if (!pageArea)
                    return;
                let iframe = pageArea.getElementsByTagName("iframe")[0];
                if (!iframe)
                    return;
                let doc = iframe.contentDocument;
                if (!doc) {
                    return;
                }
                if (this.mode === "scroll" || doc.body.scrollLeft === 0) {
                    handlePrevChapter(this.element, this.chapterList, this.chapterDocList, this.mode);
                    this.trigger("rendered");
                }
                else {
                    handleScrollPage$1(this.element, this.chapterList, this.chapterDocList, this.mode, 1, this.isSliding, this.trigger);
                }
                handleRecord(this.element, this.mode);
            });
        }
        removeContent() {
            this.element.innerHTML = "";
        }
        next() {
            return __awaiter(this, void 0, void 0, function* () {
                let pageArea = document.getElementById("page-area");
                if (!pageArea)
                    return;
                let iframe = pageArea.getElementsByTagName("iframe")[0];
                if (!iframe)
                    return;
                let doc = iframe.contentDocument;
                if (!doc) {
                    return;
                }
                if (Math.abs(doc.body.scrollWidth - doc.body.scrollLeft - doc.body.clientWidth) < 10 ||
                    this.mode === "scroll") {
                    handleNextChapter(this.element, this.chapterList, this.chapterDocList, this.mode);
                    this.trigger("rendered");
                }
                else {
                    handleScrollPage$1(this.element, this.chapterList, this.chapterDocList, this.mode, -1, this.isSliding, this.trigger);
                }
                handleRecord(this.element, this.mode);
            });
        }
        visibleText() {
            return getVisibleText(this.element, this.mode);
        }
        doSearch(keyword) {
            return getSearchResult(keyword, this.chapterDocList);
        }
        flatChapter(chapters) {
            return chapters;
        }
        getProgress() {
            return progressInfo();
        }
        record() {
            handleRecord(this.element, this.mode);
        }
        getPosition() {
            return {
                text: StorageUtil.getKookitConfig("text"),
                chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
                count: StorageUtil.getKookitConfig("count"),
                percentage: StorageUtil.getKookitConfig("percentage"),
            };
        }
        getMetadata() {
            return new MobiFile(this.azw3Buffer).getMetadata();
        }
        setStyle(css) {
            let pageArea = document.getElementById("page-area");
            if (!pageArea)
                return;
            let iframe = pageArea.getElementsByTagName("iframe")[0];
            if (!iframe)
                return;
            let doc = iframe.contentDocument;
            if (!doc) {
                return;
            }
            doc.body.setAttribute("style", css + doc.body.getAttribute("style"));
        }
    }

    class EpubRender extends EventEmitter {
        constructor(epubBuffer, mode, isSliding) {
            super();
            this.epubBuffer = epubBuffer;
            this.mode = mode;
            this.isSliding = isSliding || false;
            this.chapterList = [];
            this.chapterDocList = [];
            this.bookStr = "";
            this.element = "";
        }
        renderTo(element, cfi) {
            return __awaiter(this, void 0, void 0, function* () {
                return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    if (!(yield excuteCode())) {
                        resolve();
                        return;
                    }
                    this.epub = window.ePub(this.epubBuffer, {});
                    this.element = element;
                    this.rendition = this.epub.renderTo(this.element, {
                        manager: "default",
                        flow: this.mode === "scroll" ? "scrolled" : "auto",
                        width: "100%",
                        height: "100%",
                        snap: true,
                        spread: this.mode === "single" ? "none" : "",
                    });
                    this.rendition.display(cfi).then(() => {
                        this.trigger("rendered");
                        resolve();
                    });
                    this.rendition.on("rendered", () => {
                        this.trigger("rendered");
                    });
                }));
            });
        }
        getChapter() {
            return __awaiter(this, void 0, void 0, function* () {
                let chapter = yield this.epub.loaded.navigation;
                if (!chapter)
                    return [];
                this.chapterList = chapter.toc;
                return this.chapterList;
            });
        }
        getPageSize() {
            return {
                width: this.element.clientWidth,
                height: this.element.clientHeight,
            };
        }
        flatChapter(chapters) {
            let newChapter = [];
            for (let i = 0; i < chapters.length; i++) {
                if (chapters[i].subitems[0]) {
                    newChapter.push(chapters[i]);
                    newChapter = newChapter.concat(this.flatChapter(chapters[i].subitems));
                }
                else {
                    newChapter.push(chapters[i]);
                }
            }
            return newChapter;
        }
        goToChapter(title) {
            var _a;
            if (!this.flattenChapters) {
                this.flattenChapters = this.flatChapter(this.chapterList);
            }
            let href = (_a = this.flattenChapters[_.findLastIndex(this.flattenChapters.map((item) => {
                item.label = item.label.trim();
                return item;
            }), { label: title.trim() })]) === null || _a === void 0 ? void 0 : _a.href;
            this.rendition.display(href);
            this.trigger("rendered");
        }
        goToPosition(cfiStr) {
            return __awaiter(this, void 0, void 0, function* () {
                let position = JSON.parse(cfiStr) || {};
                this.epub.rendition.display(position.cfi);
                yield this.record();
                this.trigger("rendered");
            });
        }
        removeContent() {
            this.element.innerHTML = "";
        }
        prev() {
            return __awaiter(this, void 0, void 0, function* () {
                this.rendition.prev();
                yield this.record();
                // this.trigger("rendered");
                this.trigger("page-changed");
            });
        }
        next() {
            return __awaiter(this, void 0, void 0, function* () {
                this.rendition.next();
                yield this.record();
                // this.trigger("rendered");
                this.trigger("page-changed");
            });
        }
        visibleText() {
            return __awaiter(this, void 0, void 0, function* () {
                const currentLocation = this.rendition.currentLocation();
                const cfibase = currentLocation.start.cfi
                    .replace(/!.*/, "")
                    .replace("epubcfi(", "");
                const cfistart = currentLocation.start.cfi
                    .replace(/.*!/, "")
                    .replace(/\)/, "");
                const cfiend = currentLocation.end.cfi.replace(/.*!/, "").replace(/\)/, "");
                const cfiRange = `epubcfi(${cfibase}!,${cfistart},${cfiend})`;
                let range = yield this.epub.getRange(cfiRange);
                let text = range.toString();
                return text;
            });
        }
        doSearch(keyword) {
            return Promise.all(this.epub.spine.spineItems.map((item) => item
                .load(this.epub.load.bind(this.epub))
                .then(item.find.bind(item, keyword))
                .finally(item.unload.bind(item)))).then((results) => Promise.resolve([].concat.apply([], results).map((item) => {
                item.cfi = JSON.stringify({ cfi: item.cfi });
                return item;
            })));
        }
        getProgress() {
            return __awaiter(this, void 0, void 0, function* () {
                let currentLocation = this.rendition.currentLocation();
                if (!currentLocation.start) {
                    yield this.epub.locations.generate();
                    currentLocation = this.rendition.currentLocation();
                }
                return {
                    currentPage: this.mode === "double"
                        ? parseInt(currentLocation.start.displayed.page / 2 + "") + 1
                        : currentLocation.start.displayed.page + 1,
                    totalPage: currentLocation.start.displayed.total,
                };
            });
        }
        record() {
            return __awaiter(this, void 0, void 0, function* () {
                let currentLocation = this.rendition.currentLocation();
                let locations = this.epub.locations._locations;
                if (!currentLocation.start || locations.length === 0) {
                    locations = yield this.epub.locations.generate();
                    currentLocation = this.rendition.currentLocation();
                }
                const cfi = currentLocation.start.cfi;
                let percentage = this.epub.locations.percentageFromCfi(cfi);
                let chapterHref = currentLocation.start.href;
                if (!this.flattenChapters) {
                    this.flattenChapters = this.flatChapter(this.chapterList);
                }
                let chapter = "Unknown Chapter";
                let currentChapter = this.flattenChapters.filter((item) => item.href.indexOf(chapterHref) > -1 ||
                    chapterHref.indexOf(item.href) > -1)[0];
                if (currentChapter) {
                    chapter = currentChapter.label.trim(" ");
                }
                StorageUtil.setKookitConfig("cfi", cfi);
                StorageUtil.setKookitConfig("percentage", percentage);
                StorageUtil.setKookitConfig("chapterTitle", chapter);
            });
        }
        getPosition() {
            return __awaiter(this, void 0, void 0, function* () {
                yield this.record();
                return {
                    cfi: StorageUtil.getKookitConfig("cfi"),
                    percentage: StorageUtil.getKookitConfig("percentage"),
                    chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
                };
            });
        }
        getMetadata() {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                this.epub = window.ePub(this.epubBuffer, {});
                let metadata = yield this.epub.loaded.metadata;
                let coverUrl = yield this.epub.coverUrl();
                let blob = yield fetch(coverUrl).then((r) => r.blob());
                var reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = () => {
                    metadata.cover = reader.result;
                    resolve(metadata);
                };
            }));
        }
        setStyle(css) {
            this.rendition.themes.default(css);
        }
    }

    class MobiRender extends EventEmitter {
        constructor(mobiBuffer, mode, isSliding) {
            super();
            this.mobiBuffer = mobiBuffer;
            this.mode = mode;
            this.chapterList = [];
            this.chapterDocList = [];
            this.bookStr = "";
            this.element = "";
            this.isSliding = isSliding || false;
        }
        renderTo(element) {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                if (!(yield excuteCode())) {
                    resolve();
                    return;
                }
                let mobiDoc = yield new MobiFile(this.mobiBuffer).render();
                let bookStr = mobiDoc.outerHTML;
                this.bookStr = bookStr;
                this.element = element;
                let parser = new MobiParser(this.bookStr);
                this.chapterDocList = parser.getChapterDoc();
                this.chapterList = parser.getChapter();
                let chapterTitle = StorageUtil.getKookitConfig("chapterTitle") ||
                    this.chapterDocList[0].title;
                createIframe(element);
                handleLayout(element, this.mode);
                handleRenderChatper(chapterTitle, this.chapterDocList, this.element, this.mode);
                this.trigger("rendered");
                resolve();
            }));
        }
        getPageSize() {
            return {
                width: this.element.clientWidth,
                height: this.element.clientHeight,
            };
        }
        flatChapter(chapters) {
            return chapters;
        }
        getChapter() {
            return this.chapterList;
        }
        goToChapter(title) {
            handleRenderChatper(title, this.chapterDocList, this.element, this.mode);
            this.trigger("rendered");
        }
        goToPosition(cfi) {
            let { text, chapterTitle, count } = JSON.parse(cfi);
            handleRenderChatper(chapterTitle, this.chapterDocList, this.element, this.mode);
            handleScrollPosition$1(this.element, this.mode, text, count);
            this.record();
            this.trigger("rendered");
        }
        removeContent() {
            this.element.innerHTML = "";
        }
        prev() {
            return __awaiter(this, void 0, void 0, function* () {
                this.trigger("page-changed");
                let pageArea = document.getElementById("page-area");
                if (!pageArea)
                    return;
                let iframe = pageArea.getElementsByTagName("iframe")[0];
                if (!iframe)
                    return;
                let doc = iframe.contentDocument;
                if (!doc) {
                    return;
                }
                if (this.mode === "scroll" || doc.body.scrollLeft === 0) {
                    handlePrevChapter(this.element, this.chapterList, this.chapterDocList, this.mode);
                    this.trigger("rendered");
                }
                else {
                    handleScrollPage$1(this.element, this.chapterList, this.chapterDocList, this.mode, 1, this.isSliding, this.trigger);
                }
                handleRecord(this.element, this.mode);
            });
        }
        next() {
            return __awaiter(this, void 0, void 0, function* () {
                this.trigger("page-changed");
                let pageArea = document.getElementById("page-area");
                if (!pageArea)
                    return;
                let iframe = pageArea.getElementsByTagName("iframe")[0];
                if (!iframe)
                    return;
                let doc = iframe.contentDocument;
                if (!doc) {
                    return;
                }
                if (Math.abs(doc.body.scrollWidth - doc.body.scrollLeft - doc.body.clientWidth) < 10 ||
                    this.mode === "scroll") {
                    handleNextChapter(this.element, this.chapterList, this.chapterDocList, this.mode);
                    this.trigger("rendered");
                }
                else {
                    handleScrollPage$1(this.element, this.chapterList, this.chapterDocList, this.mode, -1, this.isSliding, this.trigger);
                }
                handleRecord(this.element, this.mode);
            });
        }
        visibleText() {
            return getVisibleText(this.element, this.mode);
        }
        doSearch(keyword) {
            return getSearchResult(keyword, this.chapterDocList);
        }
        getProgress() {
            return progressInfo();
        }
        record() {
            handleRecord(this.element, this.mode);
        }
        getPosition() {
            return {
                text: StorageUtil.getKookitConfig("text"),
                chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
                count: StorageUtil.getKookitConfig("count"),
                percentage: StorageUtil.getKookitConfig("percentage"),
            };
        }
        getMetadata() {
            return new MobiFile(this.mobiBuffer).getMetadata();
        }
        setStyle(css) {
            let pageArea = document.getElementById("page-area");
            if (!pageArea)
                return;
            let iframe = pageArea.getElementsByTagName("iframe")[0];
            if (!iframe)
                return;
            let doc = iframe.contentDocument;
            if (!doc) {
                return;
            }
            doc.body.setAttribute("style", css + doc.body.getAttribute("style"));
        }
    }

    class TxtParser {
        constructor(bookStr) {
            this.bookStr = bookStr;
            this.chapterList = [];
            this.chapterDocList = [];
            this.bookDoc = new DOMParser().parseFromString(this.bookStr, "text/html");
            this.chapterDomList = [];
        }
        getChapter() {
            let titleList = [];
            this.chapterDomList = Array.from(this.bookDoc.getElementsByTagName("h1"));
            for (let i = 0; i < this.chapterDomList.length; i++) {
                let random = Math.floor(Math.random() * 900000) + 100000;
                this.chapterList.push({
                    label: this.chapterDomList[i]
                        ? titleList.lastIndexOf(this.chapterDomList[i].innerText) === -1
                            ? this.chapterDomList[i].innerText
                            : titleList[titleList.lastIndexOf(this.chapterDomList[i].innerText)] + i
                        : "Forword",
                    id: "title" + random,
                    href: "title" + random,
                    subitems: [],
                });
                titleList.push(this.chapterList[i].label);
            }
            for (let i = 0; i < this.chapterDomList.length; i++) {
                this.chapterDomList[i].id = this.chapterList[i].id;
                var newItem = document.createElement("span");
                var textnode = document.createTextNode("pagebreak");
                newItem.appendChild(textnode);
                this.chapterDomList[i].parentNode.insertBefore(newItem, this.chapterDomList[i]);
            }
            return this.chapterList;
        }
        getChapterDoc() {
            let chapterStrList = this.bookDoc.body.innerHTML
                .split("<span>pagebreak</span>")
                .filter((item) => item.trim());
            for (let i = 0; i < chapterStrList.length; i++) {
                if (chapterStrList.length > this.chapterList.length && i === 0) {
                    let random = Math.floor(Math.random() * 900000) + 100000;
                    this.chapterList.unshift({
                        label: "Forword" + "#" + i,
                        id: "title" + random,
                        href: "title" + random,
                        subitems: [],
                    });
                }
                this.chapterDocList.push({
                    title: this.chapterList[i].label,
                    text: chapterStrList[i],
                });
            }
            return this.chapterDocList;
        }
    }

    class TxtRender extends EventEmitter {
        constructor(txtBuffer, mode, encoding = "utf-8", isSliding) {
            super();
            this.txtBuffer = txtBuffer;
            this.encoding = encoding;
            this.mode = mode;
            this.chapterList = [];
            this.chapterDocList = [];
            this.bookStr = "";
            this.element = "";
            this.isSliding = isSliding || false;
        }
        renderTo(element) {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                if (!(yield excuteCode())) {
                    resolve();
                    return;
                }
                let text = new TextDecoder(this.encoding).decode(this.txtBuffer);
                let bookStr = txtToHtml(text);
                this.bookStr = bookStr;
                this.element = element;
                let parser = new TxtParser(this.bookStr);
                this.chapterList = parser.getChapter();
                this.chapterDocList = parser.getChapterDoc();
                let chapterTitle = StorageUtil.getKookitConfig("chapterTitle") ||
                    this.chapterDocList[0].title;
                createIframe(element);
                handleLayout(element, this.mode);
                handleRenderChatper(chapterTitle, this.chapterDocList, this.element, this.mode);
                this.trigger("rendered");
                resolve();
            }));
        }
        getChapter() {
            return this.chapterList;
        }
        goToChapter(title) {
            handleRenderChatper(title, this.chapterDocList, this.element, this.mode);
            this.trigger("rendered");
        }
        getPageSize() {
            return {
                width: this.element.clientWidth,
                height: this.element.clientHeight,
            };
        }
        goToPosition(cfi) {
            let { text, chapterTitle, count } = JSON.parse(cfi);
            handleRenderChatper(chapterTitle, this.chapterDocList, this.element, this.mode);
            handleScrollPosition$1(this.element, this.mode, text, count);
            this.record();
            this.trigger("rendered");
        }
        record() {
            handleRecord(this.element, this.mode);
        }
        removeContent() {
            this.element.innerHTML = "";
        }
        flatChapter(chapters) {
            return chapters;
        }
        prev() {
            return __awaiter(this, void 0, void 0, function* () {
                this.trigger("page-changed");
                let pageArea = document.getElementById("page-area");
                if (!pageArea)
                    return;
                let iframe = pageArea.getElementsByTagName("iframe")[0];
                if (!iframe)
                    return;
                let doc = iframe.contentDocument;
                if (!doc) {
                    return;
                }
                if (this.mode === "scroll" || doc.body.scrollLeft === 0) {
                    handlePrevChapter(this.element, this.chapterList, this.chapterDocList, this.mode);
                    this.trigger("rendered");
                }
                else {
                    handleScrollPage$1(this.element, this.chapterList, this.chapterDocList, this.mode, 1, this.isSliding, this.trigger);
                }
                handleRecord(this.element, this.mode);
            });
        }
        next() {
            return __awaiter(this, void 0, void 0, function* () {
                this.trigger("page-changed");
                let pageArea = document.getElementById("page-area");
                if (!pageArea)
                    return;
                let iframe = pageArea.getElementsByTagName("iframe")[0];
                if (!iframe)
                    return;
                let doc = iframe.contentDocument;
                if (!doc) {
                    return;
                }
                if (Math.abs(doc.body.scrollWidth - doc.body.scrollLeft - doc.body.clientWidth) < 10 ||
                    this.mode === "scroll") {
                    handleNextChapter(this.element, this.chapterList, this.chapterDocList, this.mode);
                    this.trigger("rendered");
                }
                else {
                    handleScrollPage$1(this.element, this.chapterList, this.chapterDocList, this.mode, -1, this.isSliding, this.trigger);
                }
                // this.trigger("rendered");
                handleRecord(this.element, this.mode);
            });
        }
        visibleText() {
            return getVisibleText(this.element, this.mode);
        }
        doSearch(keyword) {
            return getSearchResult(keyword, this.chapterDocList);
        }
        getProgress() {
            return progressInfo();
        }
        getPosition() {
            return {
                text: StorageUtil.getKookitConfig("text"),
                chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
                count: StorageUtil.getKookitConfig("count"),
                percentage: StorageUtil.getKookitConfig("percentage"),
            };
        }
        setStyle(css) {
            let pageArea = document.getElementById("page-area");
            if (!pageArea)
                return;
            let iframe = pageArea.getElementsByTagName("iframe")[0];
            if (!iframe)
                return;
            let doc = iframe.contentDocument;
            if (!doc) {
                return;
            }
            doc.body.setAttribute("style", css + doc.body.getAttribute("style"));
        }
    }

    const mimetype = {
        svg: "image/svg+xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        zip: "application/zip",
        rar: "application/x-rar-compressed",
        "7z": "application/x-7z-compressed",
        tar: "application/x-tar",
        html: "text/html",
        htm: "text/html",
        xml: "text/xml",
        xhtml: "application/xhtml+xml",
    };

    class ComicParser {
        constructor(fileNameList, zip, mode, element, format) {
            this.fileNameList = fileNameList;
            this.zip = zip;
            this.bookStr = "";
            this.format = format;
            this.bookDoc = null;
            this.mode = mode;
            this.chapterList = [];
            this.extension = this.fileNameList[0].split(".").reverse()[0];
            this.element = element;
            this.getBookStr();
        }
        getBookStr() {
            let bookDoc = document.createElement("div");
            let scale = this.mode === "single" ? 1 : 2;
            let section = Math.floor(this.element.clientWidth / 12);
            let gap = section % 2 === 0 ? section : section - 1;
            for (let i = 0; i < this.fileNameList.length; i++) {
                let imageDom = document.createElement("img");
                imageDom.id = i + "";
                imageDom.setAttribute("style", `width: ${this.mode === "scroll"
                ? this.element.clientWidth
                : (this.element.clientWidth - gap) / scale}px;max-height:${this.mode === "scroll" ? "inherit" : this.element.clientHeight}px`);
                bookDoc.appendChild(imageDom);
            }
            this.bookDoc = bookDoc;
        }
        getChapter() {
            for (let i = 0; i < this.fileNameList.length; i++) {
                this.chapterList.push({
                    label: this.fileNameList[i],
                    id: i + "",
                    href: i,
                    subitems: [],
                });
            }
            return this.chapterList;
        }
        getImgRatio() {
            this.extension = this.fileNameList[0].split(".").reverse()[0];
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var i = new Image();
                i.onload = function () {
                    resolve(i.height / i.width);
                };
                let buffer;
                if (this.format === "cbr") {
                    buffer = this.zip.decompress(this.fileNameList[0]);
                }
                else if (this.format === "cbt") {
                    buffer =
                        this.zip[_.findLastIndex(this.zip, { name: this.fileNameList[0] })]
                            .buffer;
                }
                else {
                    buffer = yield this.zip.file(this.fileNameList[0]).async("arraybuffer");
                }
                i.src =
                    "data:" +
                        mimetype[this.extension.toLowerCase()] +
                        ";base64," +
                        this.base64ArrayBuffer(buffer);
            }));
        }
        renderComic() {
            let pageArea = document.getElementById("page-area");
            if (!pageArea)
                return;
            let iframe = pageArea.getElementsByTagName("iframe")[0];
            if (!iframe)
                return;
            let doc = iframe.contentDocument;
            if (!doc) {
                return;
            }
            doc.body.innerHTML = this.bookDoc.outerHTML;
        }
        renderImage(i) {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                this.extension = this.fileNameList[0].split(".").reverse()[0];
                let pageArea = document.getElementById("page-area");
                if (!pageArea)
                    return;
                let iframe = pageArea.getElementsByTagName("iframe")[0];
                if (!iframe)
                    return;
                let doc = iframe.contentDocument;
                if (!doc) {
                    return;
                }
                if (doc.getElementById(i + "") &&
                    !doc.getElementById(i + "").src) {
                    let buffer;
                    if (this.format === "cbr") {
                        buffer = this.zip.decompress(this.fileNameList[i]);
                    }
                    else if (this.format === "cbt") {
                        buffer =
                            this.zip[_.findLastIndex(this.zip, { name: this.fileNameList[i] })]
                                .buffer;
                    }
                    else {
                        buffer = yield this.zip
                            .file(this.fileNameList[i])
                            .async("arraybuffer");
                    }
                    if (doc.getElementById(i + "")) {
                        doc.getElementById(i + "").src =
                            "data:" +
                                mimetype[this.extension.toLowerCase()] +
                                ";base64," +
                                this.base64ArrayBuffer(buffer);
                        resolve();
                    }
                    else {
                        resolve();
                    }
                }
                else {
                    resolve();
                }
            }));
        }
        base64ArrayBuffer(arrayBuffer) {
            var base64 = "";
            var encodings = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
            var bytes = new Uint8Array(arrayBuffer);
            var byteLength = bytes.byteLength;
            var byteRemainder = byteLength % 3;
            var mainLength = byteLength - byteRemainder;
            var a, b, c, d;
            var chunk;
            for (var i = 0; i < mainLength; i = i + 3) {
                chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
                a = (chunk & 16515072) >> 18;
                b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
                c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
                d = chunk & 63; // 63       = 2^6 - 1
                base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
            }
            if (byteRemainder === 1) {
                chunk = bytes[mainLength];
                a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2
                b = (chunk & 3) << 4; // 3   = 2^2 - 1
                base64 += encodings[a] + encodings[b] + "==";
            }
            else if (byteRemainder === 2) {
                chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];
                a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
                b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4
                c = (chunk & 15) << 2; // 15    = 2^4 - 1
                base64 += encodings[a] + encodings[b] + encodings[c] + "=";
            }
            return base64;
        }
    }

    const handleScrollPage = (element, delta, isSliding) => __awaiter(void 0, void 0, void 0, function* () {
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        let section = Math.floor(element.clientWidth / 12);
        let gap = section % 2 === 0 ? section : section - 1;
        if (delta > 0 && doc.body.scrollLeft > 0) {
            doc.body.scrollBy({
                top: 0,
                left: -element.offsetWidth - gap,
                behavior: isSliding ? "smooth" : "auto",
            });
        }
        else if (delta > 0 && doc.body.scrollLeft === 0) {
            return;
        }
        else if (delta < 0) {
            doc.body.scrollBy({
                top: 0,
                left: element.offsetWidth + gap,
                behavior: isSliding ? "smooth" : "auto",
            });
        }
    });
    const handleScrollPosition = (element, mode, _id = "") => {
        let id = _id || parseInt(StorageUtil.getKookitConfig("count")) || 0;
        let pageArea = document.getElementById("page-area");
        if (!pageArea)
            return;
        let iframe = pageArea.getElementsByTagName("iframe")[0];
        if (!iframe)
            return;
        let doc = iframe.contentDocument;
        if (!doc) {
            return;
        }
        if (id) {
            let nodeList = Array.from(doc.body.querySelectorAll("img"));
            let targetNode = nodeList[id];
            if (mode !== "scroll") {
                doc.body.scrollTo(id && targetNode ? targetNode.getBoundingClientRect().left : 0, 0);
            }
            else {
                element.scrollTo(0, id && targetNode ? targetNode.getBoundingClientRect().top : 0);
            }
        }
        else {
            if (mode !== "scroll") {
                doc.body.scrollTo(0, 0);
            }
            else {
                element.scrollTo(0, 0);
            }
        }
    };

    class ComicRender extends EventEmitter {
        constructor(dataSource, zip, mode, format, isSliding) {
            super();
            this.isSliding = isSliding || false;
            this.mode = mode;
            this.format = format;
            this.zip = zip;
            this.dataSource = dataSource;
            this.element = "";
            this.parser = "";
            this.chapterList = [];
            this.largestId = parseInt(StorageUtil.getKookitConfig("count")) || 0;
        }
        renderTo(element, id = 0) {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                if (!(yield excuteCode())) {
                    resolve();
                    return;
                }
                this.element = element;
                createIframe(element);
                this.parser = new ComicParser(this.dataSource, this.zip, this.mode, this.element, this.format);
                this.chapterList = this.parser.getChapter();
                this.parser.renderComic();
                yield this.renderImage(id);
                let pageArea = document.getElementById("page-area");
                if (!pageArea)
                    return;
                let iframe = pageArea.getElementsByTagName("iframe")[0];
                if (!iframe)
                    return;
                let doc = iframe.contentDocument;
                if (!doc) {
                    return;
                }
                if (!doc.getElementById(id + "")) {
                    return;
                }
                let imgRatio = yield this.parser.getImgRatio();
                let height = doc.getElementById(id + "").clientWidth * imgRatio;
                let imgs = doc.getElementsByTagName("img");
                let section = Math.floor(this.element.clientWidth / 12);
                let gap = section % 2 === 0 ? section : section - 1;
                for (let i = 0; i < imgs.length; i++) {
                    if (this.mode === "scroll") {
                        imgs[i].style.height = height + "px";
                    }
                    else {
                        let scale = this.mode === "single" ? 1 : 2;
                        if (height > this.element.clientHeight) {
                            imgs[i].style.height = this.element.clientHeight + "px";
                            imgs[i].style.width = this.element.clientHeight / imgRatio + "px";
                            imgs[i].style.paddingLeft =
                                (this.element.clientWidth - (this.mode === "single" ? 0 : gap)) /
                                    2 /
                                    scale -
                                    this.element.clientHeight / imgRatio / 2 +
                                    "px";
                        }
                        else {
                            imgs[i].style.height = height + "px";
                            imgs[i].style.marginTop =
                                this.element.clientHeight / 2 - height / 2 + "px";
                        }
                    }
                }
                handleLayout(element, this.mode);
                handleIframeHeight(element, this.mode);
                this.trigger("rendered");
                resolve();
            }));
        }
        flatChapter(chapters) {
            return chapters;
        }
        getProgress() {
            return {
                totalPage: this.chapterList.length,
                currentPage: parseInt(StorageUtil.getKookitConfig("count")) || 0,
            };
        }
        getPageSize() {
            return {
                width: this.element.clientWidth,
                height: this.element.clientHeight,
            };
        }
        renderImage(id) {
            return __awaiter(this, void 0, void 0, function* () {
                yield this.parser.renderImage(id - 3);
                yield this.parser.renderImage(id - 2);
                yield this.parser.renderImage(id - 1);
                yield this.parser.renderImage(id);
                yield this.parser.renderImage(id + 1);
                yield this.parser.renderImage(id + 2);
                yield this.parser.renderImage(id + 3);
            });
        }
        getChapter() {
            return this.chapterList;
        }
        goToPosition(cfi) {
            let { id } = JSON.parse(cfi);
            handleScrollPosition(this.element, this.mode, id);
            this.record();
        }
        goToChapter(title) {
            return __awaiter(this, void 0, void 0, function* () {
                handleScrollPosition(this.element, this.mode, this.dataSource.indexOf(title) + "");
                yield this.renderImage(this.dataSource.indexOf(title));
            });
        }
        record() {
            return __awaiter(this, void 0, void 0, function* () {
                handleRecord(this.element, this.mode);
                let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
                yield this.parser.renderImage(id - 3);
                yield this.parser.renderImage(id - 2);
                yield this.parser.renderImage(id - 1);
                yield this.parser.renderImage(id);
                yield this.parser.renderImage(id + 1);
                yield this.parser.renderImage(id + 2);
                yield this.parser.renderImage(id + 3);
            });
        }
        removeContent() {
            this.element.innerHTML = "";
        }
        prev() {
            return __awaiter(this, void 0, void 0, function* () {
                let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
                yield this.parser.renderImage(id);
                yield this.parser.renderImage(id - 1);
                yield this.parser.renderImage(id - 2);
                yield this.parser.renderImage(id - 3);
                yield this.parser.renderImage(id - 4);
                handleScrollPage(this.element, 1, this.isSliding);
                handleRecord(this.element, this.mode);
            });
        }
        next() {
            return __awaiter(this, void 0, void 0, function* () {
                let id = parseInt(StorageUtil.getKookitConfig("count")) || 0;
                yield this.parser.renderImage(id);
                yield this.parser.renderImage(id + 1);
                yield this.parser.renderImage(id + 2);
                yield this.parser.renderImage(id + 3);
                yield this.parser.renderImage(id + 4);
                handleScrollPage(this.element, -1, this.isSliding);
                handleRecord(this.element, this.mode);
            });
        }
        getPosition() {
            return {
                text: StorageUtil.getKookitConfig("text"),
                chapterTitle: StorageUtil.getKookitConfig("chapterTitle"),
                count: StorageUtil.getKookitConfig("count"),
                percentage: StorageUtil.getKookitConfig("percentage"),
            };
        }
        setStyle(css) {
            let pageArea = document.getElementById("page-area");
            if (!pageArea)
                return;
            let iframe = pageArea.getElementsByTagName("iframe")[0];
            if (!iframe)
                return;
            let doc = iframe.contentDocument;
            if (!doc) {
                return;
            }
            doc.body.setAttribute("style", css + doc.body.getAttribute("style"));
        }
    }

    window.e = window.eval;
    window.a = window.atob;

    exports.Azw3Render = Azw3Render;
    exports.ComicRender = ComicRender;
    exports.EpubRender = EpubRender;
    exports.MobiRender = MobiRender;
    exports.StrRender = StrRender;
    exports.TxtRender = TxtRender;

    Object.defineProperty(exports, '__esModule', { value: true });

}));
