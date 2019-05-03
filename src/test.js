'use strict'

const Schema = require('../modelz')()
const o = require('ospec')

function barThing(name) {
  return {
    what() {
      return `this is a bar named "${name}"`
    },
    type: 'typeBar',
  }
}

function collection(type) {
  return function(arr) {
    return [].concat(arr.map(type))
  }
}

const fooModel = Schema(
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
    // optional child model as object config
    barThing2: {
      construct: barThing,
    },
    // optional child collection without default
    barThingList: collection(barThing),
  },
  {
    preInit(foo) {
      foo.onChange = () => {}
      return foo
    },
    onChangeListener: function(foo) {
      return (...args) => foo.onChange(...args)
    },
    postInit(foo) {
      foo.getPrefixedBar = function(prefix) {
        return prefix + foo.bar
      }
      return foo
    },
  }
)

const foo = fooModel({
  bar: 'this is a foo',
  numberWithoutDefault: 0,
  stringWithoutDefault: '',
  count: 7,
  barThing: 'my super bar',
  barThing2: 'my super super bar',
  barThingList: ['bar1', 'bar2', 'bar3'],
})

o.spec('Schema', function() {
  o('# Basics', function() {
    o(foo.type).equals('typeFoo')
    o(foo.count).equals(7)
    o(foo.baz).equals(123)
    o(foo.numberWithoutDefault).equals(0)
    o(foo.stringWithoutDefault).equals('')
    o(foo.getPrefixedBar('ATTENTION: ')).equals('ATTENTION: this is a foo')
    o(foo.barThing.type).equals('typeBar')
    o(foo.barThing.what()).equals('this is a bar named "my super bar"')
    o(foo.barThing2.what()).equals('this is a bar named "my super super bar"')
    o(foo.barThingList.length).equals(3)
    o(foo.barThingList[1].what()).equals('this is a bar named "bar2"')
    const throwError = o.spy()
    try {
      fooModel({
        barThing: 'aa',
        barThingList: [],
      })
    } catch (e) {
      throwError(e)
    }
    o(throwError.callCount).equals(1)

    foo.onChange = o.spy()
    foo.bar = 'new bar'

    const [key, value, oldValue] = foo.onChange.args
    o(key).equals('bar')
    o(value).equals('new bar')
    o(oldValue).equals('this is a foo')
  })

  o('# Arrays/Collections', function() {
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

    o(testObj.list.last()).equals('hoho')

    testObj.list = ['reassigned', 'list']
    o(testObj.list.last()).equals('list')
  })

  o('# Defaults for complex types', function() {
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
    o(second.arrayProp).deepEquals(['foo'])
    o(second.objProp).deepEquals({ bar: 'foo' })
  })

  o('# null/undefined handling', function() {
    const schema = Schema({
      optionalString: 'string',
      mandatoryStringWithDefault: ['string', true, 'DEFAULT'],
    })
    const a = schema()
    o(a.optionalString).equals(null)
    o(a.mandatoryStringWithDefault).equals('DEFAULT')
    const b = schema({
      optionalString: null,
      mandatoryStringWithDefault: 'xx',
    })
    o(b.optionalString).equals(null)
    o(b.mandatoryStringWithDefault).equals('xx')
    const c = schema({
      mandatoryStringWithDefault: null,
    })
    o(c.optionalString).equals(null)
    o(c.mandatoryStringWithDefault).equals('DEFAULT')
  })

  o('# Extra properties', function() {
    let schema = Schema({})
    let testObj = schema({ bar: 'huhu' })
    o(testObj.bar).equals(undefined)
    schema = Schema(
      {},
      {
        extraProperties: true,
      }
    )
    testObj = schema({ bar: 'huhu' })
    o(testObj.bar).equals('huhu')
  })

  o.spec('# Computed properties', function() {
    o('basic usage', function() {
      const aChanged = o.spy()
      const bChanged = o.spy()
      const abChanged = o.spy()
      const schema = Schema(
        {
          a: 'string',
          b: 'string',
          ab: {
            get: function(testObj) {
              return testObj.a + '|' + testObj.b
            },
            set: function(testObj, value) {
              [testObj.a, testObj.b] = value.split('|')
            },
          },
        },
        {
          onChangeListener: function() {
            return function(key, newValue, oldValue) {
              if (key === 'a') {
                aChanged(oldValue, newValue)
              }
              if (key === 'b') {
                bChanged(oldValue, newValue)
              }
              if (key === 'ab') {
                abChanged(oldValue, newValue)
              }
            }
          },
        }
      )
      const testObj = schema({ a: 'AA', b: 'BB' })
      o(testObj.ab).equals('AA|BB')
      testObj.ab = 'CC|DD'
      o(testObj.a).equals('CC')
      o(testObj.b).equals('DD')
      o(aChanged.args).deepEquals(['AA', 'CC'])
      o(bChanged.args).deepEquals(['BB', 'DD'])
      o(abChanged.args).deepEquals(['AA|BB', 'CC|DD'])
    })
  })

  o('cache property', function() {
    const getCacheKeySpy = o.spy()
    const getXSpy = o.spy()
    const modelX = Schema({
      x: {
        get: [
          getXSpy,
          function getCacheKey(obj) {
            getCacheKeySpy(obj)
            return getCacheKeySpy.callCount <= 2 ? 'cacheKey' : 'third call'
          },
        ],
      },
    })
    const xObj = modelX()
    xObj.x
    o(getXSpy.args[0]).equals(xObj)
    o(getXSpy.callCount).equals(1)
    o(getCacheKeySpy.args[0]).equals(xObj)
    o(getCacheKeySpy.callCount).equals(1)
    xObj.x
    o(getCacheKeySpy.callCount).equals(2)
    o(getXSpy.callCount).equals(1)
    xObj.x
    o(getCacheKeySpy.callCount).equals(3)
    o(getXSpy.callCount).equals(2)

    const getASpy = o.spy()
    const modelA = Schema({
      aDep: ['string', true, 'A'],
      a: {
        get: [getASpy, ['aDep']],
      },
    })
    const aObj = modelA()
    aObj.a
    o(getASpy.args[0]).equals(aObj)
    o(getASpy.callCount).equals(1)
    aObj.a
    o(getASpy.callCount).equals(1)
    aObj.aDep = 'B'
    aObj.a
    o(getASpy.callCount).equals(2)
    aObj.a
    o(getASpy.callCount).equals(2)
  })
})
