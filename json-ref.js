//   Copyright 2011 Jonathan D. Knezek
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.


/**
 * A JavaScript implementation of the default referencing scheme used by Json.NET to encode object and array references.
 * By Jonathan D. Knezek.
 * https://github.com/jdknezek/json-ref
 */
(function() {

  this.ref = function(value) {
    var ref, refs;
    refs = [];
    ref = function(value) {
      var i, k, r, result, v, _i, _len;
      if (!value) {
        return value;
      }
      if (typeof value !== 'object') {
        return value;
      }
      for (i = _i = 0, _len = refs.length; _i < _len; i = ++_i) {
        r = refs[i];
        if (r === value) {
          return {
            $ref: "" + (i + 1)
          };
        }
      }
      result = {
        $id: "" + (refs.push(value))
      };
      if ('[object Array]' === Object.prototype.toString.call(value)) {
        result.$values = (function() {
          var _j, _len1, _results;
          _results = [];
          for (_j = 0, _len1 = value.length; _j < _len1; _j++) {
            v = value[_j];
            _results.push(ref(v));
          }
          return _results;
        })();
      } else {
        for (k in value) {
          v = value[k];
          result[k] = ref(v);
        }
      }
      return result;
    };
    return ref(value);
  };

  this.deref = function(value) {
    var deref, refs;
    refs = {};
    deref = function(value) {
      var k, result, v, _i, _len, _ref;
      if (!value) {
        return value;
      }
      if (typeof value !== 'object') {
        return value;
      }
      if ('$ref' in value) {
        return refs[value.$ref];
      }
      if ('$id' in value) {
        if ('$values' in value) {
          result = refs[value.$id] = [];
          _ref = value.$values;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            v = _ref[_i];
            result.push(deref(v));
          }
          return result;
        }
        result = refs[value.$id] = {};
        for (k in value) {
          v = value[k];
          if (k !== '$id') {
            result[k] = deref(v);
          }
        }
        return result;
      }
      return value;
    };
    return deref(value);
  };

}).call(this);
