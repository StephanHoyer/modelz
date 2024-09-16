[![Build status](https://github.com/StephanHoyer/modelz/actions/workflows/node.js.yml/badge.svg)](https://github.com/StephanHoyer/modelz/actions/workflows/node.js.yml)
[![rethink.js](https://img.shields.io/badge/rethink-js-yellow.svg)](https://github.com/rethinkjs/manifest)
![](http://img.badgesize.io/StephanHoyer/modelz/master/modelz.js.svg?compression=brotli)

# modelz

Simple model schema helper

With _modelz_, we try to build a `backbone/ampersand`-Model in a new way. No prototypes involved here.

Currently it's a minimal approach to have properties with getter/setter, automatic children construction and change-events.

## how to install?

```shell
npm install modelz
```

## how to use?

```javascript
// load function and set global config for it
import models from 'modelz'

const Schema = models() // <-- potential global module config goes here

const dogSchema = Schema({
  breed: breedModel,
  name: ['string', true],
  color: color,
  friends: [dogModel],
})
```

This creates a Schema for a model `dogModel`. `dogModel` then will have four properties.

To create the model simply do:

```javascript
function dogModel(dog) {
  dog = dogSchema(dog)

  dog.bark = function () {
    console.log(dog.name + ' barks!')
  }

  return dog
}
```

and then create an instance with:

```javascript
const lassie = dogModel({
  name: 'Lassie',
  breed: { name: 'Collie' },
  color: 'pied',
  friends: [{ name: 'Tommy' }],
})

lassie.bark() // console.logs 'Lassie barks!'
```

## So how does this help me?

- It validates the input data
- It sets defaults if given
- It constructs sub-models (breed)
- It removes data that is not specified in schema
- It allows for (cacheable) computed properties

## detail usage

### defining properties

```javascript
import models from 'modelz'

const Schema = models()

const dogSchema = Schema({
  name: ['string', true], //property definition
})
```

There a different ways to define a property:

#### type as string

Example: `name: 'string'`

Property is optional and has no default value. Types can be

- `string`
- `number`
- `date`

#### Array without default

Example: `name: ['string', true]`

Property is a string, required and has no default value. This is also possible
with constructor function.

#### Array with default

Example: `name: ['string', true, 'no name']`

Property is a string, required and has `'no name'` as default value. This is
also possible with constructor function.

#### default single value

Example: `name: 'no name'`

Property is a string, required and has `'no name'` as default value. This is
only possible with primitive types (`string`, `number`, `date`).

#### detailed description via object

Example: `name: { type: 'string', required: true, default: 'no name' }`

Possible config properties are

##### type

Can be `string`, `number` or `date`

##### construct

Init function that is called, with the given value as parameter. The return-value it then set as the value of this field

##### get

Function that gets called when you access the property, it gets the instance as only parameter. The return-value is then return as value of the field.
See `computed properties`

##### set

Function that gets called when you set the property, it gets the new value as only parameter. See `computed properties`

##### cacheKey

This can either be a function or a list of property names.

If a function is set it gets called when accessing the property before the `get`-function itself is called. If this returns the same value for subsequent accesses to the property, the same value is returned without calling `get`-function itself again.

If this is a list of property names, the sting-representations of those properties is used as the cache key.

##### enumerable

Defines if this property is serialized or not

##### required

Defines if this property is required or not

##### default

Defines the default value if no initial value for the property is given. This can be either a value or a callback function. If it's a function and no initial value was giving during construct the `default`-callback is called with the initial values of the instance as parameter.

### init-Hooks

Example:

```javascript
const userSchema = Schema({
  // fields definition
}, {
  preInit: function(user) {
    // do some stuff before getter/setter are applied
    user.onChange = new Signal();
    return user; // always return the instance!!
  },
  postInit: function(user) {
    // do some stuff after getter/setter are applied
    return user; // always return the instance!!
  }
}
```

This can be used to e. G. add a change listeners to all instances upon
construction (see `test.js`).

### onChangeListener-Hook

```javascript
const userSchema = Schema({
  // fields definition
}, {
  onChangeListener: function(user) {
    return user.onChange.dispatch;
  }
})
```

The listener should return a function that will be called, when an attribute on
the instance changes for whatever reason. The signature of this function is

```javascript
function(attributeKey, newValue, oldValue) {
  // do, what's required to do here.
}
```

see `test.js`

### children models

Example: `user: createUser`

Property is an object. All data that is passed under the users key on
initialization is passed to the `createUser` function. The result is returned
and stored at the key `user` of the instance.

### computed properties

```javascript
const schema = Schema({
  a: 'string',
  b: 'string',
  ab: {
    get: function (testObj) {
      return testObj.a + '|' + testObj.b
    },
    set: function (testObj, value) {
      value = value.split('|')
      testObj.a = value[0]
      testObj.b = value[1]
    },
  },
})

const test = schema({
  a: 'foo',
  b: 'bar',
})

assert(test.ab, 'foo|bar')
```

Computed properties can be cached too. There are two possibilities:

- Define the properties the cached prop depends on (see `ab`)
- or roll your own (see `x`)

```javascript
const schema = Schema({
  a: 'string',
  b: 'string',
  ab: {
    get: function (testObj) {
      return testObj.a + '|' + testObj.b
    },
    cacheKey: ['a', 'b'],
  },
  x: {
    get: function (testObj) {
      return heavyComputationToGetX(testObj)
    },
    cacheKey: function getCacheKey(testObj) {
      return someSimplerFunctionToComputeCacheKey(testObj)
    },
  },
})
```

## Road map

Refer to the issues.
