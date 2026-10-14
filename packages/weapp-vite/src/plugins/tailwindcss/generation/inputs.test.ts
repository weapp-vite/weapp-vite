import { expect, it, vi } from 'vitest'
import { copyGenerationValue, equalGenerationValue } from './inputs'

it('copies every configuration value without mutating the original, including sparse arrays', () => {
  const callback = () => {}
  const roots = ['first']
  roots.length = 3
  roots[2] = 'third'
  const options = { target: 'weapp', roots, hooks: { callback } }
  const copy = copyGenerationValue(options)
  expect(copy).not.toBe(options)
  expect(copy.roots).not.toBe(options.roots)
  expect(Object.isFrozen(copy.roots)).toBe(true)
  expect(1 in copy.roots).toBe(false)
  expect(copy.hooks.callback).toBe(callback)
  expect(equalGenerationValue(copy, options)).toBe(true)
  expect(equalGenerationValue(copy, { ...options, hooks: { callback: () => {} } })).toBe(false)
  options.roots[0] = 'later'
  expect(copy.roots[0]).toBe('first')
  expect(equalGenerationValue(copy, options)).toBe(false)
})

it('compares non-enumerable and symbol keys and preserves a null prototype', () => {
  const marker = Symbol('option')
  const before = { [marker]: 'first' }
  const after = { [marker]: 'second' }
  Object.defineProperty(before, 'hidden', { value: 'first' })
  Object.defineProperty(after, 'hidden', { value: 'first' })
  expect(equalGenerationValue(copyGenerationValue(before), after)).toBe(false)
  expect(equalGenerationValue(copyGenerationValue(before), Object.defineProperty({ [marker]: 'first' }, 'hidden', { value: 'second' }))).toBe(false)
  const empty = Object.create(null) as Record<string, unknown>
  expect(Object.getPrototypeOf(copyGenerationValue(empty))).toBeNull()
  expect(equalGenerationValue(copyGenerationValue(empty), {})).toBe(false)
})

it.each(['object', 'array'] as const)('refuses a %s accessor without reading it', (kind) => {
  const getter = vi.fn(() => 'unsafe')
  const array: unknown[] = []
  array.length = 1
  const value = kind === 'object' ? {} : array
  Object.defineProperty(value, kind === 'object' ? 'option' : '0', { get: getter })
  expect(() => copyGenerationValue(value)).toThrow('accessors')
  expect(getter).not.toHaveBeenCalled()
})

it.each(['extra', 'symbol', 'map', 'subclass'] as const)('refuses an array with %s configuration state', (kind) => {
  const callback = vi.fn(() => [])
  const value = kind === 'subclass' ? new (class extends Array {})() : []
  if (kind !== 'subclass') {
    Object.defineProperty(value, kind === 'symbol' ? Symbol('option') : kind, { value: kind === 'map' ? callback : 'custom' })
  }
  expect(() => copyGenerationValue(value)).toThrow()
  expect(callback).not.toHaveBeenCalled()
})

it.each([new Map(), new Set(), /pattern/, new Date(), new Proxy({}, {}), new (class Config {})()])('refuses unknown configuration objects', (value) => {
  expect(() => copyGenerationValue(value)).toThrow()
  expect(equalGenerationValue({}, value)).toBe(false)
})

it('refuses cycles but accepts separate properties referring to the same plain input', () => {
  const cycle: { self?: unknown } = {}
  cycle.self = cycle
  expect(() => copyGenerationValue(cycle)).toThrow()
  const shared = { enabled: true }
  expect(equalGenerationValue(copyGenerationValue({ first: shared, second: shared }), { first: shared, second: shared })).toBe(true)
})
