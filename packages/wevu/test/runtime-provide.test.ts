import { afterEach, describe, expect, it } from 'vitest'
import { inject, provide } from '@/runtime/provide'

describe('provide/inject', () => {
  // provide 和 inject 使用全局 Map，需要在每个测试后清理
  afterEach(() => {
    // 清空全局 store（通过注入不存在的 key 强制重置）
    // 注意：实际实现可能需要导出清理函数
  })

  describe('basic functionality', () => {
    it('should provide and inject values', () => {
      const key = Symbol('test')
      const value = { count: 42 }

      provide(key, value)
      const injected = inject(key)

      expect(injected).toBe(value)
      expect(injected).toEqual({ count: 42 })
    })

    it('should work with string keys', () => {
      provide('message', 'Hello World')
      const injected = inject('message')

      expect(injected).toBe('Hello World')
    })

    it('should work with number keys', () => {
      provide(123, 'numeric key')
      const injected = inject(123)

      expect(injected).toBe('numeric key')
    })

    it('should work with object keys', () => {
      const key = { id: 'unique' }
      const value = { data: 'test' }

      provide(key, value)
      const injected = inject(key)

      expect(injected).toBe(value)
    })

    it('should allow updating provided values', () => {
      const key = 'counter'

      provide(key, 1)
      expect(inject(key)).toBe(1)

      provide(key, 2)
      expect(inject(key)).toBe(2)
    })
  })

  describe('default values', () => {
    it('should return default value when key not found', () => {
      const key = Symbol('missing')
      const defaultValue = 'default'

      const result = inject(key, defaultValue)

      expect(result).toBe('default')
    })

    it('should return undefined as default value', () => {
      const key = Symbol('missing')
      const result = inject(key, undefined)

      expect(result).toBeUndefined()
    })

    it('should return null as default value', () => {
      const key = Symbol('missing')
      const result = inject(key, null)

      expect(result).toBeNull()
    })

    it('should return 0 as default value', () => {
      const key = Symbol('missing')
      const result = inject(key, 0)

      expect(result).toBe(0)
    })

    it('should return false as default value', () => {
      const key = Symbol('missing')
      const result = inject(key, false)

      expect(result).toBe(false)
    })

    it('should return empty string as default value', () => {
      const key = Symbol('missing')
      const result = inject(key, '')

      expect(result).toBe('')
    })

    it('should prioritize provided value over default', () => {
      const key = 'test'
      provide(key, 'provided')

      const result = inject(key, 'default')

      expect(result).toBe('provided')
    })
  })

  describe('error handling', () => {
    it('should throw error when key not found and no default', () => {
      const key = Symbol('missing')

      expect(() => inject(key)).toThrow('wevu.inject: no value found for key')
    })

    it('should throw error for undefined key without default', () => {
      expect(() => inject(undefined as any)).toThrow('wevu.inject: no value found for key')
    })

    it('should throw error for null key without default', () => {
      expect(() => inject(null as any)).toThrow('wevu.inject: no value found for key')
    })
  })

  describe('type safety', () => {
    it('should maintain type information', () => {
      interface User {
        name: string
        age: number
      }

      const key = Symbol('user')
      const user: User = { name: 'Alice', age: 30 }

      provide<User>(key, user)
      const injected = inject<User>(key)

      expect(injected.name).toBe('Alice')
      expect(injected.age).toBe(30)
    })

    it('should handle complex nested types', () => {
      const key = 'config'
      const config = {
        api: {
          baseUrl: 'https://example.com',
          timeout: 5000,
        },
        features: {
          enabled: ['feature1', 'feature2'],
          disabled: [],
        },
      }

      provide(key, config)
      const injected = inject(key)

      expect(injected).toEqual(config)
      expect(injected.api.baseUrl).toBe('https://example.com')
      expect(injected.features.enabled).toHaveLength(2)
    })
  })

  describe('edge cases', () => {
    it('should handle providing undefined value', () => {
      const key = 'undefined-value'
      provide(key, undefined)

      const result = inject(key, 'default')
      expect(result).toBeUndefined()
    })

    it('should handle providing null value', () => {
      const key = 'null-value'
      provide(key, null)

      const result = inject(key, 'default')
      expect(result).toBeNull()
    })

    it('should handle providing empty objects', () => {
      const key = 'empty-object'
      provide(key, {})

      const result = inject(key)
      expect(result).toEqual({})
    })

    it('should handle providing empty arrays', () => {
      const key = 'empty-array'
      provide(key, [])

      const result = inject(key)
      expect(result).toEqual([])
    })

    it('should handle Symbol.for keys', () => {
      const key = Symbol.for('global-symbol')
      provide(key, 'global value')

      const result = inject(Symbol.for('global-symbol'))
      expect(result).toBe('global value')
    })

    it('should differentiate between different Symbol instances', () => {
      const key1 = Symbol('key')
      const key2 = Symbol('key')

      provide(key1, 'value1')
      provide(key2, 'value2')

      expect(inject(key1)).toBe('value1')
      expect(inject(key2)).toBe('value2')
    })
  })

  describe('multiple provides', () => {
    it('should handle multiple different keys', () => {
      provide('key1', 'value1')
      provide('key2', 'value2')
      provide('key3', 'value3')

      expect(inject('key1')).toBe('value1')
      expect(inject('key2')).toBe('value2')
      expect(inject('key3')).toBe('value3')
    })

    it('should handle rapid successive provides', () => {
      for (let i = 0; i < 100; i++) {
        provide(`key${i}`, i)
      }

      for (let i = 0; i < 100; i++) {
        expect(inject(`key${i}`)).toBe(i)
      }
    })
  })
})
