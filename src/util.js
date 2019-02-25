'use strict'

export function noop() {}

export function identity(thing) {
  return thing
}

export function type(obj) {
  return {}.toString.call(obj)
}

export function isObject(thing) {
  return thing !== null && type(thing) === '[object Object]'
}

export function isArray(thing) {
  return type(thing) == '[object Array]'
}

export function isFunction(thing) {
  return typeof thing === 'function'
}

export function isString(thing) {
  return typeof thing === 'string'
}

export function isNumber(thing) {
  return typeof thing === 'number'
}

export function isUndefined(thing) {
  return typeof thing === 'undefined'
}
