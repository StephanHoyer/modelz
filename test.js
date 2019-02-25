'use strict'

const Schema = require('./')()
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
      defaultNullString: ['string', false, null],
    })
    const a = schema()
    o(a.optionalString).equals(undefined)
    o(a.defaultNullString).equals(null)
    const b = schema({
      optionalString: null,
      defaultNullString: 'xx',
    })
    o(b.optionalString).equals(null)
    o(b.defaultNullString).equals('xx')
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

  o('# Computed properties', function() {
    const aChanged = o.spy()
    const bChanged = o.spy()
    const abChanged = o.spy()
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
