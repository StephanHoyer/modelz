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
  construct: identity,
  getCacheKey: noop,
  enumerable: true,
  required: false,
}

const defaultGlobalConfig = {
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
}

function createCacheFunction(fieldConfig) {
  if (isArray(fieldConfig.cacheKey)) {
    return function (obj) {
      return fieldConfig.cacheKey.map((prop) => obj[prop]).join('|<3|')
    }
  }
  if (isFunction(fieldConfig.cacheKey)) {
    return fieldConfig.cacheKey
  }
  return noop
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
      const [type, required] = fieldConfig
      return {
        construct: getConstructor(type, fieldname),
        required,
      }
    }

    if (isArray(fieldConfig) && fieldConfig.length === 3) {
      // short syntax [type, required, default]
      const [type, required, defaultValue] = fieldConfig
      return {
        construct: getConstructor(type, fieldname),
        required,
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
        `No proper config handler found for config:\n${JSON.stringify(
          fieldConfig
        )}`
      )
    }
  }

  return function Schema(fields, config) {
    config = Object.assign({}, globalConfig, config)
    return function construct(sourceData = {}) {
      if (sourceData._isInitialized) {
        return sourceData
      }
      const _data = {}
      let onChange = noop

      let result = {}
      if (config.extraProperties) {
        result = Object.assign({}, sourceData)
      }

      if (config.embedPlainData) {
        Object.defineProperty(result, '_data', {
          get: () => _data,
          enumerable: false,
        })
      }
      Object.defineProperty(result, '_isInitialized', {
        get: () => true,
        enumerable: false,
      })
      result = config.preInit(result)
      onChange = config.onChangeListener(result)
      for (const fieldname in fields) {
        const fieldConfig = Object.assign(
          {},
          defaultFieldConfig,
          parseConfig(fields[fieldname], fieldname)
        )
        Object.defineProperty(result, fieldname, {
          enumerable: fieldConfig.enumerable,
          get: function () {
            if (fieldConfig.get) {
              const key = fieldConfig.getCacheKey(result)
              if (
                !_data.hasOwnProperty(fieldname) ||
                key == null ||
                key !== _data[fieldname].key
              ) {
                _data[fieldname] = { key, value: fieldConfig.get(result) }
              }
              return _data[fieldname].value
            }
            return result._data[fieldname]
          },
          set: function (value) {
            const oldValue = result[fieldname]
            if (isFunction(fieldConfig.set)) {
              fieldConfig.set(result, value)
            } else if (!fieldConfig.required && value == null) {
              _data[fieldname] = value = null
            } else {
              _data[fieldname] = fieldConfig.construct(
                value,
                result,
                fieldConfig
              )
            }
            onChange(fieldname, value, oldValue)
          },
        })

        if (sourceData[fieldname] != null) {
          result[fieldname] = sourceData[fieldname]
        } else if (fieldConfig.hasOwnProperty('default')) {
          if (isFunction(fieldConfig.default)) {
            result[fieldname] = fieldConfig.default(sourceData)
          } else {
            result[fieldname] = fieldConfig.default
          }
        } else if (fieldConfig.required) {
          throw Error('No value set for ' + fieldname)
        } else if (!fieldConfig.get) {
          // default to null if it's not a computed prop
          result[fieldname] = null
        }
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
