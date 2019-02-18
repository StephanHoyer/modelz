'use strict'

const Schema = require('./')()
const tape = require('tape')

function barThing(name) {
  return {
    what: function() {
      return 'this is a bar named "' + name + '"'
    },
    type: 'typeBar',
  }
}

function collection(type) {
  return function(arr) {
    return [].concat(arr.map(type))
  }
}

const fooSchema = Schema(
  {
    // required string with default
    type: ['string', true, 'typeFoo'],
    // required number with default
    baz: 123,
    numberWithoutDefault: 'number',
    stringWithoutDefault: 'string',
    // required string without default
    bar: ['string', true],
    // required number without default
    count: ['number', true, 1],
    // optional child model without default
    barThing: barThing,
    // optional child collection without default
    barThingList: collection(barThing),
  },
  {
    preInit: function(foo) {
      foo.onChange = () => {}
      return foo
    },
    onChangeListener: function(foo) {
      return (...args) => foo.onChange(...args)
    },
  }
)

function fooModel(foo) {
  foo = fooSchema(foo)
  foo.getPrefixedBar = function(prefix) {
    return prefix + foo.bar
  }
  return foo
}

const foo = fooModel({
  bar: 'this is a foo',
  numberWithoutDefault: 0,
  stringWithoutDefault: '',
  count: 7,
  barThing: 'my super bar',
  barThingList: ['bar1', 'bar2', 'bar3'],
})

tape('Schema', function(t) {
  t.test('# Basics', function(t) {
    t.equal(
      foo.type,
      'typeFoo',
      'should allow string properties and set defaults'
    )
    t.equal(foo.count, 7, 'should allow number properties')
    t.equal(foo.baz, 123, 'should allow definition by default value')
    t.equal(
      foo.numberWithoutDefault,
      0,
      'should allow to even set falsy number values'
    )
    t.equal(
      foo.stringWithoutDefault,
      '',
      'should allow to even set falsy string values'
    )
    t.equal(
      foo.getPrefixedBar('ATTENTION: '),
      'ATTENTION: this is a foo',
      'should use properties'
    )
    t.equal(foo.barThing.type, 'typeBar', 'should instantiate sub models')
    t.equal(
      foo.barThing.what(),
      'this is a bar named "my super bar"',
      'submodel should be fully instantiated'
    )
    t.equal(foo.barThingList.length, 3, 'should allow array property')
    t.equal(
      foo.barThingList[1].what(),
      'this is a bar named "bar2"',
      'items of array property should be instantiated'
    )
    t.throws(function() {
      fooModel({
        barThing: 'aa',
        barThingList: [],
      })
    }, 'should throw error if data misses a required field')
    foo.onChange = function(key, value, oldValue) {
      t.ok(true, 'should fire events')
      t.equal(key, 'bar', 'should deliver changed key')
      t.equal(value, 'new bar', 'should deliver new value')
      t.equal(oldValue, 'this is a foo', 'should deliver old value')
      t.end()
    }
    foo.bar = 'new bar'
  })

  t.test('# Arrays/Collections', function(t) {
    const stringCollection = function(strings) {
      const arr = [].concat(strings.map(a => a.toString()))
      arr.last = () => arr[arr.length - 1]
      return arr
    }

    const schema = Schema({
      list: stringCollection,
    })

    const testObj = schema({
      list: ['haha', 'huhu', 'hoho'],
    })

    t.equal(testObj.list.last(), 'hoho', 'defined function should be callable')
    t.end()
  })

  t.test('# Defaults for complex types', function(t) {
    const schema = Schema({
      // default arrays
      arrayProp: ['array', true, ['foo']],
      // default objects
      objProp: ['object', true, { bar: 'foo' }],
    })
    const first = schema()
    const second = schema()
    first.arrayProp.push('bar')
    first.objProp.baz = 'foz'
    t.deepEqual(second.arrayProp, ['foo'])
    t.deepEqual(second.objProp, { bar: 'foo' })
    t.end()
  })

  t.test('# Extra properties', function(t) {
    let schema = Schema({})
    let testObj = schema({ bar: 'huhu' })
    t.equal(testObj.bar, undefined, 'bar property shouldn\'t be presend')
    schema = Schema(
      {},
      {
        extraProperties: true,
      }
    )
    testObj = schema({ bar: 'huhu' })
    t.equal(testObj.bar, 'huhu', 'bar property should now be possible')
    t.end()
  })

  t.test('# Computed properties', function(t) {
    t.plan(6)
    const schema = Schema(
      {
        a: 'string',
        b: 'string',
        ab: {
          cacheKey: ['a', 'b'],
          get: function(testObj) {
            return testObj.a + '|' + testObj.b
          },
          set: function(testObj, value) {
            //ES6 [testObj.a, testObj.b] = value.split('|');
            value = value.split('|')
            testObj.a = value[0]
            testObj.b = value[1]
          },
        },
      },
      {
        onChangeListener: function() {
          return function(key, newValue, oldValue) {
            if (key === 'a') {
              t.deepEqual(
                [oldValue, newValue],
                ['AA', 'CC'],
                'change event on first dependency should be fired'
              )
            }
            if (key === 'b') {
              t.deepEqual(
                [oldValue, newValue],
                ['BB', 'DD'],
                'change event on second dependency should be fired'
              )
            }
            if (key === 'ab') {
              t.deepEqual(
                [oldValue, newValue],
                ['AA|BB', 'CC|DD'],
                'change event on computed property should be fired'
              )
            }
          }
        },
      }
    )
    const testObj = schema({ a: 'AA', b: 'BB' })
    t.equal(testObj.ab, 'AA|BB', 'should have computed property')
    testObj.ab = 'CC|DD'
    t.equal(testObj.a, 'CC', 'attribute should be set by computed property')
    t.equal(testObj.b, 'DD', 'attribute should be set by computed property')
  })
})
