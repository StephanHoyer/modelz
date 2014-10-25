'use strict';

var Signal = require('signals').Signal;
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
  bar: ['string', true],
  count: ['number', true, 1],
  barThing: barThing,
  barThingList: [barThing],
}, {
  init: function(instance) {
    instance.onChange = new Signal();
  },
  onChangeListener: function(instance) {
    return instance.onChange.dispatch;
  }
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
  t.test('# Basics', function(t) {
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
    t.throws(function() {
      fooModel({
        barThing: 'aa',
        barThingList: []
      });
    }, 'should throw error if data misses a required field');
    foo.onChange.addOnce(function(key, value, oldValue) {
      t.ok(true, 'should fire events');
      t.equal(key, 'bar', 'should deliver changed key');
      t.equal(value, 'new bar', 'should deliver new value');
      t.equal(oldValue, 'this is a foo', 'should deliver old value');
      t.end();
    });
    foo.bar = 'new bar';
  });
  t.test('# Arrays', function(t) {
    var schema = Schema({
      list: ['string']
    }, {
      arrayConstructor: function(array) {
        array.last = function() {
          return array[array.length -1];
        };
        return array;
      }
    });
    var testObj = schema({
      list: ['haha', 'huhu', 'hoho']
    });
    t.equal(testObj.list.last(), 'hoho', 'defined function should be callable');
    t.end();
  });
  t.test('# Extra properties', function(t) {
    var schema = Schema({});
    var testObj = schema({ bar: 'huhu' });
    t.equal(testObj.bar, undefined, 'bar property shouldn\'t be presend');
    schema = Schema({}, { extraProperties: true });
    testObj = schema({ bar: 'huhu' });
    t.equal(testObj.bar, 'huhu', 'bar property should now be possible');
    t.end();
  });
});
