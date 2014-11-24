[![Build Status](https://travis-ci.org/StephanHoyer/modelz.svg?branch=master)](https://travis-ci.org/StephanHoyer/modelz)

model-schema
============

Simple model scheme helper

javascript is broken!
---------------------

... not all of it. In fact most of it is quite awesome. But let's face it: `this` and `prototype` are not so well solved. The dynamic this context leads to great flexibilty but also to either bugs or verbose binding-call-apply-orgies.

we can fix this!
----------------

Turns out that you can leave these clunky parts out and still have an awesome language. Just use the functional part and the plain objects. Even [Douglas Crockfort](http://www.ustream.tv/recorded/46640057) thinks this way!

How you can do most things without new/this/prototype you can read [here](https://gist.github.com/StephanHoyer/3f0ecd395c24cc2e142f).

so what's models?
-----------------

With *models*, we try to build a `backbone/ampersand`-Model for the upper attempt. No prototypes involved here.

Currenlty it's a minimal approach to have properties with getter/setter, automatic children/collection construction and change-events. It's currenlty 2.5k minified (not gziped) code.

how to install?
---------------

Browserify ftw!

```shell
npm install modelz --save
```

how to use?
-----------

```javascript
// load function and set global config for it
var Schema = require('modelz')() // <-- potential global module config goes here

var dogSchema = Schema({
  breed: breedModel,
  name: ['string', true],
  color: color,
  friends: [dogModel]
})
```

This creates a Schema for a model `dogModel`. `dogModel` then will have four properties.

To create the model simply do:

```javascript
function dogModel(dog) {
  dog = dogSchema(dog);
  
  dog.bark = function () {
    console.log(dog.name + ' barks!');
  }
  
  return dog;
}
```

and then create an instance with: 
```javascript
var lassie = dogModel({
  name: 'Lassie',
  breed: {name: 'Collie'},
  color: 'pied',
  friends: [{name: 'Tomy'}]
});

lassie.bark() // console.logs 'Lassie barks!'
```

So how does this help me?
-------------------------

* It validates the input data
* It sets defaults if given
* It constructs sub-models (breed) and sub-collections (friends) (Collections currently are plain JS arrays)
* It removes data that is not specified in schema

detail usage
------------

### defining properties

```javascript
var Schema = require('modelz')()

var dogSchema = Schema({
  name: ['string', true], //property definition
})
```

There a differnet ways to define a property:

#### type as string

Example: `name: 'string'`

Property is optional and has no default value. Types can be
* `string`
* `number`
* `date`


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

### init-Hooks

Example:
```javascript
var userSchema = Schema({
  // fields definition
}, {
  preInit: function(user) {
    // do some stuff before getter/setter are aplied
    user.onChange = new Signal();
    return user; // always return the instance!!
  },
  postInit: function(user) {
    // do some stuff after getter/setter are aplied
    return user; // always return the instance!!
  }
}
```

This can be used to e. G. add a change listeners to all instances upon
construction (see `test.js`).

### onChangeListener-Hook

```javascript
var userSchema = Schema({
  // fields definition
}, {
  onChangeListener: function(user) {
    return user.onChange.dispatch;
  }
}
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

### arrays and children collections

Example: `tags: ['string']`

Property will be a collection of strings. This is also possible with constructor
functions. 

Example: `users: [createUser]`

It expects an array of objects as input value on the `users`-property
on the input-object. It runs the constructor-function on each of the object and
stores the result on the `users`-property of the instance:

This also can be combined with all the above versions:

Example: `users: [[createUser], true, []]`

### computed properties

```javascript
var schema = Schema({
  a: 'string',
  b: 'string',
  ab: {
    get: function(testObj) {
      return testObj.a + '|' + testObj.b;
    },
    set: function(testObj, value) {
      value = value.split('|');
      testObj.a = value[0];
      testObj.b = value[1];
    }
  }
});

var test = schema({
  a: 'foo',
  b: 'bar'
})

assert(test.ab, 'foo|bar');
```

It creates a computed property on the instance. Getter is always required,
setter is optional.

In a future version the result will be cached. Currently it computes it on
every `get`.

Roadmap
-------

Refer to the issues.
