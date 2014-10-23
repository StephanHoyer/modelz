'use strict';

var Schema = require('./')();
var tape = require('tape');

function barThing(name) {
  return {
    what: function() {
      return 'this is a bar named "' + name + '"';
    },
    type: 'typeBar'
  };
}

var fooSchema = Schema({
  type: ['string', true, 'typeFoo'],
  bar: ['string', true, 'gggg'],
  count: ['number', true, 1],
  barThing: barThing,
  barThingList: [barThing],
});

function fooModel(foo) {
  foo = fooSchema(foo);
  foo.getPrefixedBar = function(prefix) {
    return prefix + foo.bar;
  };
  return foo;
}

var foo = fooModel({
  bar: 'this is a foo',
  count: 7,
  barThing: 'my super bar',
  barThingList: ['bar1', 'bar2', 'bar3']
});

tape('Schema', function(t) {
  t.equal(foo.type, 'typeFoo', 'should allow string properties and set defaults');
  t.equal(foo.count, 7, 'should allow number properties');
  t.equal(foo.getPrefixedBar('ATTENTION: '), 'ATTENTION: this is a foo',
          'should use properties');
  t.equal(foo.barThing.type, 'typeBar', 'should instantiate sub models');
  t.equal(foo.barThing.what(), 'this is a bar named "my super bar"',
          'submodel should be fully instantiated');
  t.equal(foo.barThingList.length, 3, 'should allow array property');
  t.equal(foo.barThingList[1].what(), 'this is a bar named "bar2"',
          'items of array property should be instantiated');
  foo.onChange.addOnce(function(key, value) {
    t.equal(key, 'bar');
    t.equal(value, 'new bar');
    t.end();
  });
  foo.bar = 'new bar';
});
