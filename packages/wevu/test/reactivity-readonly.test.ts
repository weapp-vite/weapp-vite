import { describe, expect, it } from 'vitest'
import { reactive } from '@/reactivity/reactive'
import { readonly } from '@/reactivity/readonly'
import { ref } from '@/reactivity/ref'

describe('readonly - edge cases and boundary values', () => {
  describe('readonly on refs', () => {
    it('should create readonly wrapper for ref', () => {
      const original = ref(10)
      const ro = readonly(original)

      expect(ro.value).toBe(10)

      original.value = 20
      expect(ro.value).toBe(20)
    })

    it('should throw when trying to set readonly ref value', () => {
      const original = ref(10)
      const ro = readonly(original)

      expect(() => {
        ro.value = 20
      }).toThrow('无法给只读 ref 赋值')
    })

    it('should handle ref with null value', () => {
      const original = ref<any>(null)
      const ro = readonly(original)

      expect(ro.value).toBeNull()
    })

    it('should handle ref with undefined value', () => {
      const original = ref<any>(undefined)
      const ro = readonly(original)

      expect(ro.value).toBeUndefined()
    })

    it('should handle ref with object value', () => {
      const original = ref({ count: 0 })
      const ro = readonly(original)

      expect(ro.value).toEqual({ count: 0 })

      // 仍然可以修改对象（shallow readonly）
      ro.value.count = 10
      expect(ro.value.count).toBe(10)
    })
  })

  describe('readonly on objects', () => {
    it('should throw when trying to set property', () => {
      const obj = { count: 0 }
      const ro = readonly(obj)

      expect(() => {
        (ro as any).count = 10
      }).toThrow('无法在只读对象上设置属性')
    })

    it('should throw when trying to delete property', () => {
      const obj = { count: 0 }
      const ro = readonly(obj)

      expect(() => {
        delete (ro as any).count
      }).toThrow('无法在只读对象上删除属性')
    })

    it('should throw when trying to define new property', () => {
      const obj = { count: 0 }
      const ro = readonly(obj)

      expect(() => {
        Object.defineProperty(ro, 'newProp', { value: 10 })
      }).toThrow('无法在只读对象上定义属性')
    })

    it('should allow reading nested objects (shallow readonly)', () => {
      const obj = {
        nested: {
          value: 42,
        },
      }
      const ro = readonly(obj)

      expect(ro.nested.value).toBe(42)

      // 嵌套对象不是 readonly（shallow）
      ro.nested.value = 100
      expect(ro.nested.value).toBe(100)
    })

    it('should handle empty object', () => {
      const obj = {}
      const ro = readonly(obj)

      expect(ro).toEqual({})
      expect(() => {
        (ro as any).newProp = 'test'
      }).toThrow('无法在只读对象上设置属性')
    })
  })

  describe('readonly on arrays', () => {
    it('should throw when trying to set array element', () => {
      const arr = [1, 2, 3]
      const ro = readonly(arr)

      expect(() => {
        ro[0] = 10
      }).toThrow('无法在只读对象上设置属性')
    })

    it('should throw when trying to push to array', () => {
      const arr = [1, 2, 3]
      const ro = readonly(arr)

      expect(() => {
        ro.push(4)
      }).toThrow('无法在只读对象上设置属性')
    })

    it('should throw when trying to delete array element', () => {
      const arr = [1, 2, 3]
      const ro = readonly(arr)

      expect(() => {
        delete ro[0]
      }).toThrow('无法在只读对象上删除属性')
    })

    it('should allow reading array elements', () => {
      const arr = [1, 2, 3]
      const ro = readonly(arr)

      expect(ro[0]).toBe(1)
      expect(ro[1]).toBe(2)
      expect(ro[2]).toBe(3)
      expect(ro.length).toBe(3)
    })

    it('should handle empty array', () => {
      const arr: number[] = []
      const ro = readonly(arr)

      expect(ro.length).toBe(0)
      expect(() => {
        ro.push(1)
      }).toThrow('无法在只读对象上设置属性')
    })

    it('should allow reading nested arrays (shallow)', () => {
      const arr = [[1, 2], [3, 4]]
      const ro = readonly(arr)

      expect(ro[0][0]).toBe(1)

      // 嵌套数组不是 readonly
      ro[0][0] = 100
      expect(ro[0][0]).toBe(100)
    })
  })

  describe('readonly on primitives', () => {
    it('should return primitive value as-is for number', () => {
      const num = 42
      const ro = readonly(num as any)

      expect(ro).toBe(42)
    })

    it('should return primitive value as-is for string', () => {
      const str = 'hello'
      const ro = readonly(str as any)

      expect(ro).toBe('hello')
    })

    it('should return primitive value as-is for boolean', () => {
      const bool = true
      const ro = readonly(bool as any)

      expect(ro).toBe(true)
    })

    it('should return primitive value as-is for null', () => {
      const n = null
      const ro = readonly(n as any)

      expect(ro).toBeNull()
    })

    it('should return primitive value as-is for undefined', () => {
      const u = undefined
      const ro = readonly(u as any)

      expect(ro).toBeUndefined()
    })
  })

  describe('readonly with reactive objects', () => {
    it('should work with reactive objects', () => {
      const obj = reactive({ count: 0 })
      const ro = readonly(obj)

      expect(ro.count).toBe(0)

      // 原始 reactive 对象仍可变更
      obj.count = 10
      expect(ro.count).toBe(10)

      // 但 readonly 包装会阻止赋值
      expect(() => {
        (ro as any).count = 20
      }).toThrow('无法在只读对象上设置属性')
    })

    it('should handle reactive arrays', () => {
      const arr = reactive([1, 2, 3])
      const ro = readonly(arr)

      expect(ro[0]).toBe(1)

      arr[0] = 100
      expect(ro[0]).toBe(100)

      expect(() => {
        ro[0] = 200
      }).toThrow('无法在只读对象上设置属性')
    })
  })

  describe('readonly edge cases', () => {
    it('should handle objects with symbols', () => {
      const sym = Symbol('test')
      const obj = {
        [sym]: 'symbol value',
        regular: 'regular value',
      }
      const ro = readonly(obj)

      expect(ro[sym]).toBe('symbol value')
      expect(ro.regular).toBe('regular value')
    })

    it('should handle objects with getters', () => {
      const obj = {
        _value: 10,
        get value() {
          return this._value
        },
      }
      const ro = readonly(obj)

      expect(ro.value).toBe(10)
    })

    it('should prevent setting properties with Symbol keys', () => {
      const sym = Symbol('test')
      const obj = { [sym]: 'value' }
      const ro = readonly(obj)

      expect(() => {
        (ro as any)[sym] = 'new value'
      }).toThrow('无法在只读对象上设置属性')
    })

    it('should handle objects with special characters in keys', () => {
      const obj = {
        '中文': 'Chinese',
        'emoji🎉': 'party',
        'spaced key': 'value',
      }
      const ro = readonly(obj)

      expect(ro['中文']).toBe('Chinese')
      expect(ro['emoji🎉']).toBe('party')
      expect(ro['spaced key']).toBe('value')
    })

    it('should handle deeply nested objects (shallow behavior)', () => {
      const obj = {
        level1: {
          level2: {
            level3: {
              value: 42,
            },
          },
        },
      }
      const ro = readonly(obj)

      expect(ro.level1.level2.level3.value).toBe(42)

      // 深层嵌套不是 readonly
      ro.level1.level2.level3.value = 100
      expect(ro.level1.level2.level3.value).toBe(100)

      // 但顶层是 readonly
      expect(() => {
        (ro as any).level1 = {}
      }).toThrow('无法在只读对象上设置属性')
    })

    it('should handle class instances', () => {
      class Counter {
        count = 0
        increment() {
          this.count++
        }
      }

      const instance = new Counter()
      const ro = readonly(instance)

      expect(ro.count).toBe(0)
      expect(typeof ro.increment).toBe('function')

      // 说明：readonly 会阻止调用会修改状态的方法
      expect(() => {
        ro.increment()
      }).toThrow('无法在只读对象上设置属性')

      // 但原始实例仍可变更
      instance.increment()
      expect(instance.count).toBe(1)
      expect(ro.count).toBe(1)
    })

    it('should handle objects with null prototype', () => {
      const obj = Object.create(null)
      obj.key = 'value'
      const ro = readonly(obj)

      expect(ro.key).toBe('value')
      expect(() => {
        ro.key = 'new value'
      }).toThrow('无法在只读对象上设置属性')
    })
  })
})
