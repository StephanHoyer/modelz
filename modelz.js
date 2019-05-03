(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.modelz = factory());
}(this, function () { 'use strict';

  function noop() {}

  function identity(thing) {
    return thing
  }

  function type(obj) {
    return {}.toString.call(obj)
  }

  function isObject(thing) {
    return thing !== null && type(thing) === '[object Object]'
  }

  function isArray(thing) {
    return type(thing) == '[object Array]'
  }

  function isFunction(thing) {
    return typeof thing === 'function'
  }

  function isString(thing) {
    return typeof thing === 'string'
  }

  function isNumber(thing) {
    return typeof thing === 'number'
  }

  var defaultFieldConfig = {
    construct: identity,
    getCacheKey: noop,
    enumerable: true,
    required: false,
  };

  var defaultGlobalConfig = {
    castString: true,
    parseNumbers: true,
    onChangeListener: function() {
      return noop
    },
    extraProperties: false,
    embedPlainData: true,
    preInit: identity,
    postInit: identity,
    types: {},
  };

  function createCacheFunction(depProps) {
    return function(obj) {
      return depProps.map(function (prop) { return obj[prop]; }).join('|<3|')
    }
  }

  function modelz(globalConfig) {
    globalConfig = Object.assign({}, defaultGlobalConfig, globalConfig);
    function getConstructor(item, fieldname) {
      var constructors = Object.assign(
        {
          string: function string(value) {
            if (isString(value)) {
              return value
            }
            if (globalConfig.castString) {
              return '' + value
            }
            throw Error(("Expect a string for \"" + fieldname + "\", got \"" + value + "\""))
          },
          number: function number(value) {
            if (isNumber(value)) {
              return value
            }
            if (isString(value) && globalConfig.parseNumbers) {
              return parseFloat(value)
            }
            throw Error(("Expect a number for \"" + fieldname + "\", got \"" + value + "\""))
          },
          boolean: function boolean(value) {
            return !!value
          },
          array: function array(value) {
            return [].concat(value)
          },
          object: function object(value) {
            return Object.assign({}, value)
          },
          date: function date(value) {
            return new Date(value)
          },
          identity: identity,
        },
        globalConfig.types
      );

      if (isFunction(item)) {
        return item
      }
      if (constructors[item] == null) {
        throw Error(
          ("Try to use unknown type \"" + item + "\" as type for \"" + fieldname + "\"")
        )
      }
      return constructors[item]
    }
    function parseConfig(fieldConfig, fieldname) {
      if (isObject(fieldConfig)) {
        if (isFunction(fieldConfig.construct)) {
          // constructor
          return fieldConfig
        }

        if (isString(fieldConfig.type)) {
          // type
          return Object.assign(
            {
              construct: getConstructor(fieldConfig.type, fieldname),
            },
            fieldConfig
          )
        }

        if (
          isArray(fieldConfig.get) &&
          isFunction(fieldConfig.get[0]) &&
          (isFunction(fieldConfig.get[1]) || isArray(fieldConfig.get[1]))
        ) {
          // computed property with cache function
          return {
            getCacheKey: isArray(fieldConfig.get[1])
              ? createCacheFunction(fieldConfig.get[1])
              : fieldConfig.get[1],
            get: fieldConfig.get[0],
            set: fieldConfig.set,
          }
        }

        if (isFunction(fieldConfig.get)) {
          // computed property
          return {
            getCacheKey: noop,
            get: fieldConfig.get,
            set: fieldConfig.set,
          }
        }
      }

      if (isArray(fieldConfig) && fieldConfig.length === 2) {
        // short syntax without default [type, required]
        var type = fieldConfig[0];
        var required = fieldConfig[1];
        return {
          construct: getConstructor(type, fieldname),
          required: required,
        }
      }

      if (isArray(fieldConfig) && fieldConfig.length === 3) {
        // short syntax [type, required, default]
        var type$1 = fieldConfig[0];
        var required$1 = fieldConfig[1];
        var defaultValue = fieldConfig[2];
        return {
          construct: getConstructor(type$1, fieldname),
          required: required$1,
          default: defaultValue,
        }
      }

      if (isFunction(fieldConfig)) {
        // plain construct
        return {
          construct: fieldConfig,
        }
      }

      if (isString(fieldConfig)) {
        try {
          // init by type
          return {
            construct: getConstructor(fieldConfig, fieldname),
          }
        } catch (e) {
          // fail silently and try next init
        }
      }

      try {
        // init by default
        return {
          construct: getConstructor(typeof fieldConfig, fieldname),
          required: true,
          default: fieldConfig,
        }
      } catch (e) {
        throw new Error(
          ("No proper config handler found for config:\n" + (JSON.stringify(
            fieldConfig
          )))
        )
      }
    }

    return function Schema(fields, config) {
      config = Object.assign({}, globalConfig, config);
      return function construct(sourceData) {
        if ( sourceData === void 0 ) sourceData = {};

        var _data = {};
        var onChange = noop;

        var result = {};
        if (config.extraProperties) {
          result = Object.assign({}, sourceData);
        }

        if (config.embedPlainData) {
          Object.defineProperty(result, '_data', {
            get: function () { return _data; },
            enumerable: false,
          });
        }
        result = config.preInit(result);
        onChange = config.onChangeListener(result);
        var loop = function ( fieldname ) {
          var fieldConfig = Object.assign(
            {},
            defaultFieldConfig,
            parseConfig(fields[fieldname], fieldname)
          );
          Object.defineProperty(result, fieldname, {
            enumerable: !isFunction(fieldConfig.get) && fieldConfig.enumerable,
            get: function() {
              if (fieldConfig.get) {
                var key = fieldConfig.getCacheKey(result);
                if (
                  !_data.hasOwnProperty(fieldname) ||
                  key == null ||
                  key !== _data[fieldname].key
                ) {
                  _data[fieldname] = { key: key, value: fieldConfig.get(result) };
                }
                return _data[fieldname].value
              }
              return result._data[fieldname]
            },
            set: function(value) {
              var oldValue = result[fieldname];
              if (isFunction(fieldConfig.set)) {
                fieldConfig.set(result, value);
              } else if (!fieldConfig.required && value == null) {
                _data[fieldname] = value = null;
              } else {
                _data[fieldname] = fieldConfig.construct(
                  value,
                  result,
                  fieldConfig
                );
              }
              onChange(fieldname, value, oldValue);
            },
          });

          if (sourceData[fieldname] != null) {
            result[fieldname] = sourceData[fieldname];
          } else if (fieldConfig.hasOwnProperty('default')) {
            result[fieldname] = fieldConfig.default;
          } else if (fieldConfig.required) {
            throw Error('No value set for ' + fieldname)
          } else if (!fieldConfig.get) {
            // default to null if it's not a computed prop
            result[fieldname] = null;
          }
        };

        for (var fieldname in fields) loop( fieldname );
        result = config.postInit(result);
        if (!globalConfig.extraProperties) {
          Object.seal(result);
        }
        return result
      }
    }
  }

  return modelz;

}));
//# sourceMappingURL=modelz.js.map
