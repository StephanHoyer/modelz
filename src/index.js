'use strict'

import {
  identity,
  isArray,
  isFunction,
  isNumber,
  isObject,
  isString,
  noop,
} from './util'

const defaultFieldConfig = {
  constructor: identity,
  required: false,
}

const defaultGlobalConfig = {
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
}

function createCacheFunction(depProps) {
  return function(obj) {
    return depProps.map(prop => obj[prop]).join('|<3|')
  }
}

function modelz(globalConfig) {
  globalConfig = Object.assign({}, defaultGlobalConfig, globalConfig)
  function getConstructor(item, fieldname) {
    const constructors = Object.assign(
      {
        string(value) {
          if (isString(value)) {
            return value
          }
          if (globalConfig.castString) {
            return '' + value
          }
          throw Error(`Expect a string for "${fieldname}", got "${value}"`)
        },
        number(value) {
          if (isNumber(value)) {
            return value
          }
          if (isString(value) && globalConfig.parseNumbers) {
            return parseFloat(value)
          }
          throw Error(`Expect a number for "${fieldname}", got "${value}"`)
        },
        boolean(value) {
          return !!value
        },
        array(value) {
          return [].concat(value)
        },
        object(value) {
          return Object.assign({}, value)
        },
        date(value) {
          return new Date(value)
        },
        identity,
      },
      globalConfig.types
    )

    if (isFunction(item)) {
      return item
    }
    if (constructors[item] == null) {
      throw Error(
        `Try to use unknown type "${item}" as type for "${fieldname}"`
      )
    }
    return constructors[item]
  }
  function parseConfig(fieldConfig, fieldname) {
    if (isArray(fieldConfig) && fieldConfig.length === 2) {
      // short syntax without default [type, required]
      const [type, required] = fieldConfig
      return {
        constructor: getConstructor(type, fieldname),
        required,
      }
    }
    if (isArray(fieldConfig) && fieldConfig.length === 3) {
      // short syntax [type, required, default]
      const [type, required, defaultValue] = fieldConfig
      return {
        constructor: getConstructor(type, fieldname),
        required,
        default: defaultValue,
      }
    }
    if (isFunction(fieldConfig)) {
      // plain constructor
      return {
        constructor: fieldConfig,
      }
    }
    if (isObject(fieldConfig) && isFunction(fieldConfig.get)) {
      // computed property
      return {
        getCacheKey: noop,
        get: fieldConfig.get,
        set: fieldConfig.set,
      }
    }
    if (
      isObject(fieldConfig) &&
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
    if (isString(fieldConfig)) {
      try {
        // init by type
        return {
          constructor: getConstructor(fieldConfig, fieldname),
        }
      } catch (e) {
        // fail silently and try next init
      }
    }
    try {
      // init by default
      return {
        constructor: getConstructor(typeof fieldConfig, fieldname),
        required: true,
        default: fieldConfig,
      }
    } catch (e) {
      throw new Error(
        `No proper config handler found for config:\n${JSON.stringify(
          fieldConfig
        )}`
      )
    }
  }

  return function Schema(fields, config) {
    config = Object.assign({}, globalConfig, config)
    return function construct(data = {}) {
      const _data = {}
      let onChange = noop

      let result = {}
      if (config.extraProperties) {
        result = Object.assign({}, data)
      }

      if (config.embedPlainData) {
        result._data = _data
      }
      result = config.preInit(result)
      onChange = config.onChangeListener(result)

      for (const fieldname in fields) {
        if (!fields.hasOwnProperty(fieldname)) {
          continue
        }
        const fieldConfig = Object.assign(
          {},
          defaultFieldConfig,
          parseConfig(fields[fieldname], fieldname)
        )
        if (data.hasOwnProperty(fieldname)) {
          if (data[fieldname] == null) {
            _data[fieldname] = data[fieldname]
          } else {
            _data[fieldname] = fieldConfig.constructor(data[fieldname], result)
          }
        } else if (fieldConfig.default === null) {
          _data[fieldname] = fieldConfig.default
        } else if (fieldConfig.hasOwnProperty('default')) {
          _data[fieldname] = fieldConfig.constructor(
            fieldConfig.default,
            result
          )
        } else if (fieldConfig.required) {
          throw Error(`No value set for ${fieldname}`)
        }
        Object.defineProperty(result, fieldname, {
          enumerable: !isFunction(fieldConfig.get),
          get: function() {
            if (fieldConfig.get) {
              const key = fieldConfig.getCacheKey(result)
              if (
                !_data.hasOwnProperty(fieldname) ||
                key == null ||
                key !== _data[fieldname].key
              ) {
                _data[fieldname] = {
                  key,
                  value: fieldConfig.get(result),
                }
              }
              return _data[fieldname].value
            }
            return result._data[fieldname]
          },
          set: function(value) {
            const oldValue = result[fieldname]
            if (isFunction(fieldConfig.set)) {
              fieldConfig.set(result, value)
            } else {
              _data[fieldname] = value
            }
            onChange(fieldname, value, oldValue)
          },
        })
      }
      result = config.postInit(result)
      if (!globalConfig.extraProperties) {
        Object.seal(result)
      }
      return result
    }
  }
}

export default modelz