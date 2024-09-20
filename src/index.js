'use strict'

import {
  identity,
  isArray,
  isFunction,
  isNumber,
  isObject,
  isString,
  noop,
} from './util.js'

const defaultFieldConfig = {
  construct: identity,
  getCacheKey: noop,
  enumerable: true,
  required: false,
}

const defaultGlobalConfig = {
  castString: true,
  parseNumbers: true,
  onChangeListener: () => noop,
  extraProperties: false,
  embedPlainData: true,
  preInit: identity,
  postInit: identity,
  types: {},
}

function createCacheFunction({ cacheKey }) {
  if (isArray(cacheKey)) {
    return (obj) =>
      cacheKey
        .map((prop) =>
          obj[prop] instanceof Date ? obj[prop].getTime() : obj[prop]
        )
        .join('|<3|')
  }
  if (isFunction(cacheKey)) {
    return cacheKey
  }
  return noop
}

function modelz(globalConfig) {
  const {
    castString,
    debug,
    embedPlainData,
    extraProperties,
    onChangeListener,
    parseNumbers,
    postInit,
    preInit,
    types,
  } = {
    ...defaultGlobalConfig,
    ...globalConfig,
  }
  function getConstructor(item, fieldName) {
    const constructors = {
      string(value) {
        if (isString(value)) {
          return value
        }
        if (castString) {
          return '' + value
        }
        throw Error(`Expect a string for "${fieldName}", got "${value}"`)
      },
      number(value) {
        if (isNumber(value)) {
          return value
        }
        if (isString(value) && parseNumbers) {
          return parseFloat(value)
        }
        throw Error(`Expect a number for "${fieldName}", got "${value}"`)
      },
      boolean(value) {
        return !!value
      },
      array(value) {
        return [...value]
      },
      object(value) {
        return { ...value }
      },
      date(value) {
        return new Date(value)
      },
      identity,
      ...types,
    }

    if (isFunction(item)) {
      return item
    }
    if (constructors[item] == null) {
      throw Error(
        `Try to use unknown type "${item}" as type for "${fieldName}"`
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
        return {
          construct: getConstructor(fieldConfig.type, fieldName),
          ...fieldConfig,
        }
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
        construct: getConstructor(type, fieldName),
        required,
      }
    }

    if (isArray(fieldConfig) && fieldConfig.length === 3) {
      // short syntax [type, required, default]
      const [type, required, defaultValue] = fieldConfig
      return {
        construct: getConstructor(type, fieldName),
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
        `No proper config handler found for config:\n${JSON.stringify(
          fieldConfig
        )}`
      )
    }
  }

  return function Schema(fields, config) {
    config = {
      embedPlainData,
      extraProperties,
      preInit,
      postInit,
      onChangeListener,
      ...config,
    }
    const modelName = config.name ? config.name : 'instance'
    const thisSchema = { modelName }
    return function construct(sourceData = {}) {
      debug &&
        debug.extend('create')(
          `constructing ${modelName} with data %O`,
          sourceData
        )
      if (sourceData._schema === thisSchema) {
        return sourceData
      }
      const _data = {}
      let onChange = noop

      let result = {}
      if (config.extraProperties) {
        result = { ...sourceData }
      } else if (debug) {
        const fieldKeys = Object.keys(fields)
        const ignoredProperties = Object.keys(sourceData).filter(
          (key) => !fieldKeys.includes(key)
        )
        if (ignoredProperties.length) {
          debug.extend('warn')(
            `The properties %o are not defined on target ${modelName} and will therefore be dropped.`,
            ignoredProperties
          )
        }
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
      Object.defineProperty(result, '_schema', {
        get: () => thisSchema,
        enumerable: false,
      })
      result = config.preInit(result)
      onChange = config.onChangeListener(result)
      for (const fieldName in fields) {
        const fieldConfig = {
          ...defaultFieldConfig,
          ...parseConfig(fields[fieldName], fieldName),
        }
        Object.defineProperty(result, fieldName, {
          enumerable: fieldConfig.enumerable,
          get: function () {
            if (fieldConfig.get) {
              const key = fieldConfig.getCacheKey(result)
              if (
                !_data.hasOwnProperty(fieldName) ||
                key == null ||
                key !== _data[fieldName].key
              ) {
                _data[fieldName] = { key, value: fieldConfig.get(result) }
              }
              return _data[fieldName].value
            }
            return result._data[fieldName]
          },
          set: function (value) {
            const oldValue = result[fieldName]
            if (isFunction(fieldConfig.set)) {
              fieldConfig.set(result, value)
            } else if (!fieldConfig.required && value == null) {
              _data[fieldName] = value = null
            } else {
              _data[fieldName] = fieldConfig.construct(
                value,
                result,
                fieldConfig
              )
            }
            onChange(fieldName, value, oldValue)
          },
        })

        if (sourceData[fieldName] != null) {
          result[fieldName] = sourceData[fieldName]
        } else if (fieldConfig.hasOwnProperty('default')) {
          if (isFunction(fieldConfig.default)) {
            result[fieldName] = fieldConfig.default(sourceData)
          } else {
            result[fieldName] = fieldConfig.default
          }
        } else if (fieldConfig.required) {
          throw Error('No value set for ' + fieldName)
        } else if (!fieldConfig.get) {
          // default to null if it's not a computed prop
          result[fieldName] = null
        }
      }
      result = config.postInit(result)
      if (!extraProperties) {
        Object.seal(result)
      }
      return result
    }
  }
}

export default modelz
