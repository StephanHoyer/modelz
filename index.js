'use strict';

function noop() {}

function extend (target, source) {
  target = target || {};
  for (var prop in source) {
    target[prop] = source[prop];
  }
  return target;
}

function identity(thing) {
  return thing;
}

function type(obj) {
  return {}.toString.call(obj);
}

function isObject(thing) {
  return thing !== null && type(thing) === '[object Object]';
}

function isArray(thing) {
  return type(thing) == '[object Array]';
}

function isFunction(thing) {
  return typeof thing === 'function';
}

function isString(thing){
  return typeof thing === 'string';
}

function isNumber(thing) {
  return typeof thing === 'number';
}

function isUndefined(thing) {
  return typeof thing === 'undefined';
}

function clone(thing) {
  if (isArray(thing)) {
    return [].concat(thing);
  }
  if (typeof thing === 'object') {
    return extend({}, thing);
  }
  return thing;
}

module.exports = function(globalConfig) {
  globalConfig = extend({
    castString: true,
    parseNumbers: true,
    onChangeListener: function() { return noop; },
    extraProperties: false,
    embedPlainData: true,
    arrayConstructor: identity,
  }, globalConfig);

  function getConstructor(item) {
    if (isFunction(item)) {
      return item;
    }
    if (isString(item)) {
      var constructors = {
        string: function(value) {
          if (isString(value)) {
            return value;
          }
          if (globalConfig.castString) {
            return '' + value;
          }
          throw Error('Value "' + value + '" is not a string');
        },
        number: function(value) {
          if (isNumber(value)) {
            return value;
          }
          if (isString(value) && globalConfig.parseNumbers) {
            return parseFloat(value);
          }
          throw Error('Value ' + value + ' is not a number');
        },
        array: function(value) {
          return value;
        },
        object: function(value) {
          return value;
        },
        date: function(value) {
          return new Date(value);
        },
      };
      if (isUndefined(constructors[item])) {
        throw Error(item + ' is not an allowed type.');
      }
      return constructors[item];
    }
  }

  function parseConfig(config) {
    if (isArray(config) && config.length === 1) {
      // array of things
      return {
        isArray: true,
        constructor: getConstructor(config[0]),
        required: true
      };
    }
    if (isArray(config) && config.length === 2) {
      // short syntax without default [type, required]
      return {
        isArray: isArray(config[0]) ? true : false,
        constructor: getConstructor(isArray(config[0]) ? config[0][0] : config[0]),
        required: config[1]
      };
    }
    if (isArray(config) && config.length === 3) {
      // short syntax [type, required, default]
      // or even [[type], required, default]
      return {
        isArray: isArray(config[0]) ? true : false,
        constructor: getConstructor(isArray(config[0]) ? config[0][0] : config[0]),
        required: config[1],
        default: config[2]
      };
    }
    if (isFunction(config)) {
      // plain constructor
      return {
        isArray: false,
        constructor: config,
        required: true,
        default: null
      };
    }
    if (isObject(config) && isFunction(config.get)) {
      // computed property
      return {
        get: config.get,
        set: config.set,
        isArray: false,
        constructor: identity,
        required: false,
        default: null
      };
    }
    if (isString(config)) {
      try {
        // init by type
        return {
          isArray: false,
          constructor: getConstructor(config),
          required: true,
          default: null
        };
      } catch(e) {
        // fail silently and try next init
      }
    }
    try {
      // init by default
      return {
        isArray: false,
        constructor: getConstructor(typeof config),
        required: true,
        default: config
      };
    } catch(e) {
      throw new Error('No proper config handler found for config: \n' + JSON.stringify(config));
    }
  }

  return function Schema(fields, config) {
    config = extend(globalConfig, config);
    return function(data) {
      var _data = {};
      var onChange = noop;

      var result = {};
      if (globalConfig.extraProperties) {
        result = clone(data);
      }

      if (config.embedPlainData) {
        result._data = _data;
      }
      if (config.init) {
        config.init(result);
      }
      if (config.onChangeListener) {
        onChange = config.onChangeListener(result);
      }

      Object.keys(fields).forEach(function(fieldname) {
        var fieldConfig = parseConfig(fields[fieldname]);
        var arrayData;
        if (fieldConfig.isArray) {
          if (fieldConfig.required && isUndefined(data[fieldname]) && isUndefined(fieldConfig.default)) {
            throw Error('No value set for ' + fieldname);
          } else if (data[fieldname]) {
            arrayData = data[fieldname].map(fieldConfig.constructor);
            _data[fieldname] = config.arrayConstructor(arrayData, fieldname);
          } else if (isUndefined(data[fieldname]) && !isArray(fieldConfig.default)) {
            throw Error('Default value for ' + fieldname + ' should be an array');
          } else if (isUndefined(data[fieldname])) {
            arrayData = fieldConfig.default.map(fieldConfig.constructor);
            _data[fieldname] = config.arrayConstructor(arrayData, fieldname);
          } else if (!isArray(data[fieldname])) {
            throw Error('Try to set a non array value ' +
                        data[fieldname] +
                        ' to array property ' +
                        fieldname);
          }
        } else {
          if (fieldConfig.required && isUndefined(data[fieldname]) && isUndefined(fieldConfig.default)) {
            throw Error('No value set for ' + fieldname);
          } else if (data[fieldname]) {
            _data[fieldname] = fieldConfig.constructor(data[fieldname]);
          } else if (fieldConfig.required) {
            _data[fieldname] = fieldConfig.constructor(fieldConfig.default);
          }
        }
        result.__defineGetter__(fieldname, function() {
          if (isFunction(fieldConfig.get)) {
            return fieldConfig.get(result);
          }
          return result._data[fieldname];
        });
        result.__defineSetter__(fieldname, function(value) {
          var oldValue = result[fieldname];
          if (isFunction(fieldConfig.set)) {
            fieldConfig.set(result, value);
          } else {
            _data[fieldname] = value;
          }
          onChange(fieldname, value, oldValue);
        });
      });
      return result;
    };
  };

};
