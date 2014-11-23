'use strict';

function noop() {}

function extend (target, source, source2) {
  target = target || {};
  for (var prop in source) {
    target[prop] = source[prop];
  }
  if (source2) {
    for (prop in source2) {
      target[prop] = source2[prop];
    }
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

module.exports = {
  clone: clone,
  isUndefined: isUndefined,
  isNumber: isNumber,
  isString: isString,
  isFunction: isFunction,
  isArray: isArray,
  isObject: isObject,
  identity: identity,
  extend: extend,
  noop: noop
};

