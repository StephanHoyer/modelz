'use strict'

const {
  clone,
  identity,
  isArray,
  isFunction,
  isNumber,
  isObject,
  isString,
  isUndefined,
  noop,
} = require('./util')

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
}

module.exports = function(globalConfig) {
  globalConfig = Object.assign({}, defaultGlobalConfig, globalConfig)

  function getConstructor(item, fieldname) {
    if (isFunction(item)) {
      return item
    }
    if (isString(item)) {
      const constructors = {
        string: function(value) {
          if (isString(value)) {
            return value
          }
          if (globalConfig.castString) {
            return '' + value
          }
          throw Error(
            'Expect a string for "' + fieldname + '", got "' + value + '"'
          )
        },
        number: function(value) {
          if (isNumber(value)) {
            return value
          }
          if (isString(value) && globalConfig.parseNumbers) {
            return parseFloat(value)
          }
          throw Error(
            'Expect a number for "' + fieldname + '", got "' + value + '"'
          )
        },
        boolean: function(value) {
          return !!value
        },
        array: function(value) {
          return [].concat(value)
        },
        object: function(value) {
          return Object.assign({}, value)
        },
        date: function(value) {
          return new Date(value)
        },
      }
      if (isUndefined(constructors[item])) {
        throw Error(
          'Try to use unknown type "' +
            item +
            '" as type for ' +
            fieldname +
            '"'
        )
      }
      return constructors[item]
    }
  }

  function parseConfig(config, fieldname) {
    if (isArray(config) && config.length === 1) {
      // array of things
      return {
        constructor: getConstructor(config[0], fieldname),
      }
    }
    if (isArray(config) && config.length === 2) {
      // short syntax without default [type, required]
      const [type, required] = config
      return {
        constructor: getConstructor(type),
        required,
      }
    }
    if (isArray(config) && config.length === 3) {
      // short syntax [type, required, default]
      const [type, required, defaultValue] = config
      return {
        constructor: getConstructor(type),
        required,
        default: defaultValue,
      }
    }
    if (isFunction(config)) {
      // plain constructor
      return {
        constructor: config,
      }
    }
    if (isObject(config) && isFunction(config.get)) {
      // computed property
      return {
        get: config.get,
        set: config.set,
      }
    }
    if (isString(config)) {
      try {
        // init by type
        return {
          constructor: getConstructor(config, fieldname),
        }
      } catch (e) {
        // fail silently and try next init
      }
    }
    try {
      // init by default
      return {
        constructor: getConstructor(typeof config, fieldname),
        required: true,
        default: config,
      }
    } catch (e) {
      throw new Error(
        'No proper config handler found for config: \n' + JSON.stringify(config)
      )
    }
  }

  return function Schema(fields, config) {
    config = Object.assign(globalConfig, config)
    return function construct(data = {}) {
      const _data = {}
      let onChange = noop

      let result = {}
      if (config.extraProperties) {
        result = clone(data)
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
        let fieldConfig = parseConfig(fields[fieldname], fieldname)
        fieldConfig = Object.assign({}, defaultFieldConfig, fieldConfig)
        if (
          fieldConfig.required &&
          data[fieldname] == null &&
          isUndefined(fieldConfig.default)
        ) {
          throw Error('No value set for ' + fieldname)
        } else if (data[fieldname] != null) {
          _data[fieldname] = fieldConfig.constructor(data[fieldname], result)
        } else if (fieldConfig.required) {
          _data[fieldname] = fieldConfig.constructor(fieldConfig.default)
        }
        Object.defineProperty(result, fieldname, {
          get: function() {
            if (isFunction(fieldConfig.get)) {
              return fieldConfig.get(result)
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
      return config.postInit(result)
    }
  }
}
