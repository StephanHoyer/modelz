(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.modelz = factory());
})(this, (function () { 'use strict';

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
    onChangeListener: function () {
      return noop
    },
    extraProperties: false,
    embedPlainData: true,
    preInit: identity,
    postInit: identity,
    types: {},
  };

  function createCacheFunction(fieldConfig) {
    if (isArray(fieldConfig.cacheKey)) {
      return function (obj) {
        return fieldConfig.cacheKey.map(function (prop) { return obj[prop]; }).join('|<3|')
      }
    }
    if (isFunction(fieldConfig.cacheKey)) {
      return fieldConfig.cacheKey
    }
    return noop
  }

  function modelz(globalConfig) {
    globalConfig = Object.assign({}, defaultGlobalConfig, globalConfig);
    function getConstructor(item, fieldName) {
      var constructors = Object.assign(
        {
          string: function string(value) {
            if (isString(value)) {
              return value
            }
            if (globalConfig.castString) {
              return '' + value
            }
            throw Error(("Expect a string for \"" + fieldName + "\", got \"" + value + "\""))
          },
          number: function number(value) {
            if (isNumber(value)) {
              return value
            }
            if (isString(value) && globalConfig.parseNumbers) {
              return parseFloat(value)
            }
            throw Error(("Expect a number for \"" + fieldName + "\", got \"" + value + "\""))
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
          ("Try to use unknown type \"" + item + "\" as type for \"" + fieldName + "\"")
        )
      }
      return constructors[item]
    }
    function parseConfig(fieldConfig, fieldName) {
      if (isObject(fieldConfig)) {
        if (isFunction(fieldConfig.construct)) {
          // constructor
          return fieldConfig
        }

        if (isString(fieldConfig.type)) {
          // type
          return Object.assign(
            {
              construct: getConstructor(fieldConfig.type, fieldName),
            },
            fieldConfig
          )
        }

        if (isFunction(fieldConfig.get)) {
          return {
            getCacheKey: createCacheFunction(fieldConfig),
            get: fieldConfig.get,
            set: fieldConfig.set,
            enumerable: fieldConfig.enumerable || false,
          }
        }
      }

      if (isArray(fieldConfig) && fieldConfig.length === 2) {
        // short syntax without default [type, required]
        var type = fieldConfig[0];
        var required = fieldConfig[1];
        return {
          construct: getConstructor(type, fieldName),
          required: required,
        }
      }

      if (isArray(fieldConfig) && fieldConfig.length === 3) {
        // short syntax [type, required, default]
        var type$1 = fieldConfig[0];
        var required$1 = fieldConfig[1];
        var defaultValue = fieldConfig[2];
        return {
          construct: getConstructor(type$1, fieldName),
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
            construct: getConstructor(fieldConfig, fieldName),
          }
        } catch (e) {
          // fail silently and try next init
        }
      }

      try {
        // init by default
        return {
          construct: getConstructor(typeof fieldConfig, fieldName),
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
      var modelName = config.name ? config.name : 'instance';
      var thisSchema = { modelName: modelName };
      return function construct(sourceData) {
        if ( sourceData === void 0 ) sourceData = {};

        globalConfig.debug &&
          globalConfig.debug.extend('create')(
            ("constructing " + modelName + " with data %O"),
            sourceData
          );
        if (sourceData._schema === thisSchema) {
          return sourceData
        }
        var _data = {};
        var onChange = noop;

        var result = {};
        if (config.extraProperties) {
          result = Object.assign({}, sourceData);
        } else if (globalConfig.debug) {
          var fieldKeys = Object.keys(fields);
          var ignoredProperties = Object.keys(sourceData).filter(
            function (key) { return !fieldKeys.includes(key); }
          );
          if (ignoredProperties.length) {
            globalConfig.debug.extend('warn')(
              ("The properties %o are not defined on target " + modelName + " and will therefore be dropped."),
              ignoredProperties
            );
          }
        }

        if (config.embedPlainData) {
          Object.defineProperty(result, '_data', {
            get: function () { return _data; },
            enumerable: false,
          });
        }
        Object.defineProperty(result, '_isInitialized', {
          get: function () { return true; },
          enumerable: false,
        });
        Object.defineProperty(result, '_schema', {
          get: function () { return thisSchema; },
          enumerable: false,
        });
        result = config.preInit(result);
        onChange = config.onChangeListener(result);
        var loop = function ( fieldName ) {
          var fieldConfig = Object.assign(
            {},
            defaultFieldConfig,
            parseConfig(fields[fieldName], fieldName)
          );
          Object.defineProperty(result, fieldName, {
            enumerable: fieldConfig.enumerable,
            get: function () {
              if (fieldConfig.get) {
                var key = fieldConfig.getCacheKey(result);
                if (
                  !_data.hasOwnProperty(fieldName) ||
                  key == null ||
                  key !== _data[fieldName].key
                ) {
                  _data[fieldName] = { key: key, value: fieldConfig.get(result) };
                }
                return _data[fieldName].value
              }
              return result._data[fieldName]
            },
            set: function (value) {
              var oldValue = result[fieldName];
              if (isFunction(fieldConfig.set)) {
                fieldConfig.set(result, value);
              } else if (!fieldConfig.required && value == null) {
                _data[fieldName] = value = null;
              } else {
                _data[fieldName] = fieldConfig.construct(
                  value,
                  result,
                  fieldConfig
                );
              }
              onChange(fieldName, value, oldValue);
            },
          });

          if (sourceData[fieldName] != null) {
            result[fieldName] = sourceData[fieldName];
          } else if (fieldConfig.hasOwnProperty('default')) {
            if (isFunction(fieldConfig.default)) {
              result[fieldName] = fieldConfig.default(sourceData);
            } else {
              result[fieldName] = fieldConfig.default;
            }
          } else if (fieldConfig.required) {
            throw Error('No value set for ' + fieldName)
          } else if (!fieldConfig.get) {
            // default to null if it's not a computed prop
            result[fieldName] = null;
          }
        };

        for (var fieldName in fields) loop( fieldName );
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
