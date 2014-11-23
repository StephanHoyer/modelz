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

Refer to the tests for all posibilities.

Roadmap
-------

Refer to the issues.
