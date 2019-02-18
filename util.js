'use strict'

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

function isUndefined(thing) {
  return typeof thing === 'undefined'
}

function clone(thing) {
  if (isArray(thing)) {
    return [].concat(thing.map(clone))
  }
  if (typeof thing === 'object') {
    return Object.assign({}, thing)
  }
  return thing
}

module.exports = {
  clone: clone,
  isUndefined: isUndefined,
  isNumber: isNumber,
  isString: isString,
  isFunction: isFunction,
  isArray: isArray,
  isObject: isObject,
  identity: identity,
  noop: noop,
}
