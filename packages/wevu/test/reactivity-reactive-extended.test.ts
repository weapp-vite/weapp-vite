import { describe, expect, it } from 'vitest'
import { effect } from '@/reactivity/core'
import { convertToReactive, isReactive, reactive, toRaw, touchReactive } from '@/reactivity/reactive'

describe('reactive - edge cases and boundary values', () => {
  describe('reactive on primitives', () => {
    it('should return primitive as-is for number', () => {
      const result = reactive(42 as any)
      expect(result).toBe(42)
      expect(isReactive(result)).toBe(false)
    })

    it('should return primitive as-is for string', () => {
      const result = reactive('hello' as any)
      expect(result).toBe('hello')
      expect(isReactive(result)).toBe(false)
    })

    it('should return primitive as-is for boolean', () => {
      const result = reactive(true as any)
      expect(result).toBe(true)
      expect(isReactive(result)).toBe(false)
    })

    it('should return primitive as-is for null', () => {
      const result = reactive(null as any)
      expect(result).toBeNull()
      expect(isReactive(result)).toBe(false)
    })

    it('should return primitive as-is for undefined', () => {
      const result = reactive(undefined as any)
      expect(result).toBeUndefined()
      expect(isReactive(result)).toBe(false)
    })
  })

  describe('reactive caching', () => {
    it('should return same proxy for same object', () => {
      const obj = { count: 0 }
      const proxy1 = reactive(obj)
      const proxy2 = reactive(obj)

      expect(proxy1).toBe(proxy2)
    })

    it('should return self when called on reactive object', () => {
      const obj = { count: 0 }
      const proxy = reactive(obj)
      const proxy2 = reactive(proxy)

      expect(proxy2).toBe(proxy)
    })

    it('should handle multiple levels of wrapping attempt', () => {
      const obj = { count: 0 }
      const r1 = reactive(obj)
      const r2 = reactive(r1)
      const r3 = reactive(r2)

      expect(r1).toBe(r2)
      expect(r2).toBe(r3)
    })
  })

  describe('deleteProperty tracking', () => {
    it('should trigger effect when property deleted', () => {
      const obj = reactive({ count: 0, extra: 'value' })
      let effectCount = 0

      effect(() => {
        // 通过访问对象来跟踪 VERSION_KEY
        touchReactive(obj)
        effectCount++
      })

      expect(effectCount).toBe(1)

      delete obj.extra
      expect(effectCount).toBe(2)
    })

    it('should not trigger when deleting non-existent property', () => {
      const obj = reactive({ count: 0 })
      let effectCount = 0

      effect(() => {
        void obj.count
        effectCount++
      })

      expect(effectCount).toBe(1)

      delete (obj as any).nonExistent
      // 不应触发：因为属性不存在
      expect(effectCount).toBe(1)
    })

    it('should return true when delete succeeds', () => {
      const obj = reactive({ count: 0 })
      const result = delete obj.count

      expect(result).toBe(true)
      expect('count' in obj).toBe(false)
    })

    it('should handle deleting symbol properties', () => {
      const sym = Symbol('test')
      const obj = reactive({ [sym]: 'value' })

      let effectCount = 0
      effect(() => {
        void obj[sym]
        effectCount++
      })

      expect(effectCount).toBe(1)

      delete obj[sym]
      expect(effectCount).toBe(2)
      expect(sym in obj).toBe(false)
    })
  })

  describe('ownKeys tracking', () => {
    it('should track when iterating over keys', () => {
      const obj = reactive({ a: 1, b: 2 })
      let keys: string[] = []
      let effectCount = 0

      effect(() => {
        keys = Object.keys(obj)
        effectCount++
      })

      expect(effectCount).toBe(1)
      expect(keys).toEqual(['a', 'b'])

      obj.c = 3
      expect(effectCount).toBe(2)
      expect(keys).toEqual(['a', 'b', 'c'])
    })

    it('should track when using Object.getOwnPropertyNames', () => {
      const obj = reactive({ a: 1 })
      let names: string[] = []
      let effectCount = 0

      effect(() => {
        names = Object.getOwnPropertyNames(obj)
        effectCount++
      })

      expect(effectCount).toBe(1)
      expect(names).toEqual(['a'])

      obj.b = 2
      expect(effectCount).toBe(2)
      expect(names).toEqual(['a', 'b'])
    })

    it('should track when using for...in loop', () => {
      const obj = reactive({ a: 1, b: 2 })
      const keys: string[] = []
      let effectCount = 0

      effect(() => {
        for (const key in obj) {
          keys.push(key)
        }
        effectCount++
      })

      expect(effectCount).toBe(1)

      obj.c = 3
      expect(effectCount).toBe(2)
    })
  })

  describe('toRaw', () => {
    it('should return original object from reactive proxy', () => {
      const obj = { count: 0 }
      const proxy = reactive(obj)
      const raw = toRaw(proxy)

      expect(raw).toBe(obj)
      expect(isReactive(raw)).toBe(false)
    })

    it('should return same value for non-reactive input', () => {
      const obj = { count: 0 }
      const raw = toRaw(obj)

      expect(raw).toBe(obj)
    })

    it('should handle null', () => {
      const raw = toRaw(null)
      expect(raw).toBeNull()
    })

    it('should handle undefined', () => {
      const raw = toRaw(undefined)
      expect(raw).toBeUndefined()
    })

    it('should handle primitives', () => {
      expect(toRaw(42)).toBe(42)
      expect(toRaw('hello')).toBe('hello')
      expect(toRaw(true)).toBe(true)
    })

    it('should work with nested reactive objects', () => {
      const inner = { value: 42 }
      const outer = { nested: reactive(inner) }
      const proxy = reactive(outer)

      const rawOuter = toRaw(proxy)
      expect(rawOuter).toBe(outer)

      const rawInner = toRaw(rawOuter.nested)
      expect(rawInner).toBe(inner)
    })
  })

  describe('isReactive', () => {
    it('should return true for reactive objects', () => {
      const obj = reactive({ count: 0 })
      expect(isReactive(obj)).toBe(true)
    })

    it('should return false for plain objects', () => {
      const obj = { count: 0 }
      expect(isReactive(obj)).toBe(false)
    })

    it('should return false for primitives', () => {
      expect(isReactive(42)).toBe(false)
      expect(isReactive('hello')).toBe(false)
      expect(isReactive(true)).toBe(false)
      expect(isReactive(null)).toBe(false)
      expect(isReactive(undefined)).toBe(false)
    })

    it('should return false for arrays', () => {
      const arr = [1, 2, 3]
      expect(isReactive(arr)).toBe(false)
    })

    it('should return true for reactive arrays', () => {
      const arr = reactive([1, 2, 3])
      expect(isReactive(arr)).toBe(true)
    })
  })

  describe('convertToReactive', () => {
    it('should convert objects to reactive', () => {
      const obj = { count: 0 }
      const result = convertToReactive(obj)

      expect(isReactive(result)).toBe(true)
    })

    it('should return primitives as-is', () => {
      expect(convertToReactive(42)).toBe(42)
      expect(convertToReactive('hello')).toBe('hello')
      expect(convertToReactive(true)).toBe(true)
      expect(convertToReactive(null)).toBeNull()
      expect(convertToReactive(undefined)).toBeUndefined()
    })

    it('should return reactive objects as reactive', () => {
      const obj = reactive({ count: 0 })
      const result = convertToReactive(obj)

      expect(result).toBe(obj)
      expect(isReactive(result)).toBe(true)
    })

    it('should convert arrays to reactive', () => {
      const arr = [1, 2, 3]
      const result = convertToReactive(arr)

      expect(isReactive(result)).toBe(true)
    })
  })

  describe('touchReactive', () => {
    it('should establish dependency on reactive object', () => {
      const obj = reactive({ count: 0 })
      let effectCount = 0

      effect(() => {
        touchReactive(obj)
        effectCount++
      })

      expect(effectCount).toBe(1)

      obj.count = 10
      expect(effectCount).toBe(2)
    })

    it('should work with raw objects', () => {
      const obj = { count: 0 }
      const proxy = reactive(obj)
      let effectCount = 0

      effect(() => {
        touchReactive(obj) // Use raw object
        effectCount++
      })

      expect(effectCount).toBe(1)

      proxy.count = 10
      expect(effectCount).toBe(2)
    })

    it('should work with reactive proxy', () => {
      const obj = reactive({ count: 0 })
      let effectCount = 0

      effect(() => {
        touchReactive(obj)
        effectCount++
      })

      expect(effectCount).toBe(1)

      obj.count = 10
      expect(effectCount).toBe(2)
    })

    it('should track any property changes', () => {
      const obj = reactive({ a: 1, b: 2 })
      let effectCount = 0

      effect(() => {
        touchReactive(obj)
        effectCount++
      })

      expect(effectCount).toBe(1)

      obj.a = 10
      expect(effectCount).toBe(2)

      obj.b = 20
      expect(effectCount).toBe(3)

      obj.c = 30
      expect(effectCount).toBe(4)
    })
  })

  describe('reactive edge cases', () => {
    it('should handle empty object', () => {
      const obj = reactive({})

      expect(isReactive(obj)).toBe(true)
      expect(Object.keys(obj)).toEqual([])

      obj.newProp = 'value'
      expect(obj.newProp).toBe('value')
    })

    it('should handle empty array', () => {
      const arr = reactive([])

      expect(isReactive(arr)).toBe(true)
      expect(arr.length).toBe(0)

      arr.push(1)
      expect(arr.length).toBe(1)
      expect(arr[0]).toBe(1)
    })

    it('should handle objects with symbol properties', () => {
      const sym = Symbol('test')
      const obj = reactive({
        [sym]: 'symbol value',
        regular: 'regular value',
      })

      expect(obj[sym]).toBe('symbol value')
      expect(obj.regular).toBe('regular value')

      let effectCount = 0
      effect(() => {
        void obj[sym]
        effectCount++
      })

      expect(effectCount).toBe(1)

      obj[sym] = 'new value'
      expect(effectCount).toBe(2)
    })

    it('should handle objects with special characters in keys', () => {
      const obj = reactive({
        '中文': 'Chinese',
        'emoji🎉': 'party',
        'spaced key': 'value',
      })

      expect(obj['中文']).toBe('Chinese')
      expect(obj['emoji🎉']).toBe('party')
      expect(obj['spaced key']).toBe('value')
    })

    it('should handle class instances', () => {
      class Counter {
        count = 0

        increment() {
          this.count++
        }
      }

      const instance = new Counter()
      const proxy = reactive(instance)

      expect(isReactive(proxy)).toBe(true)
      expect(proxy.count).toBe(0)

      proxy.increment()
      expect(proxy.count).toBe(1)
    })

    it('should handle objects with null prototype', () => {
      const obj = Object.create(null)
      obj.key = 'value'
      const proxy = reactive(obj)

      expect(isReactive(proxy)).toBe(true)
      expect(proxy.key).toBe('value')

      let effectCount = 0
      effect(() => {
        void proxy.key
        effectCount++
      })

      expect(effectCount).toBe(1)

      proxy.key = 'new value'
      expect(effectCount).toBe(2)
    })

    it('should handle Date objects', () => {
      const date = new Date('2024-01-01')
      const proxy = reactive(date)

      expect(isReactive(proxy)).toBe(true)
      // 说明：Date 对象在 Proxy 下存在兼容性问题，这里只验证其为 reactive
      expect(toRaw(proxy)).toBe(date)
    })

    it('should handle Map objects', () => {
      const map = new Map([['key', 'value']])
      const proxy = reactive(map)

      expect(isReactive(proxy)).toBe(true)
      // 说明：Map/Set 在 Proxy 下存在方法绑定问题，这里只验证其为 reactive
      expect(toRaw(proxy)).toBe(map)
    })

    it('should handle Set objects', () => {
      const set = new Set([1, 2, 3])
      const proxy = reactive(set)

      expect(isReactive(proxy)).toBe(true)
      expect(toRaw(proxy)).toBe(set)
    })

    it('should handle deeply nested structures', () => {
      const obj = reactive({
        level1: {
          level2: {
            level3: {
              value: 42,
            },
          },
        },
      })

      expect(obj.level1.level2.level3.value).toBe(42)

      let effectCount = 0
      effect(() => {
        void obj.level1.level2.level3.value
        effectCount++
      })

      expect(effectCount).toBe(1)

      obj.level1.level2.level3.value = 100
      expect(effectCount).toBe(2)
    })
  })
})
