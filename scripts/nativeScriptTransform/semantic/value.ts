import type { SemanticValue } from './types'
import { types } from 'node:util'

/** 立即冻结可观察值，保留 JSON 会丢失的值、别名、空槽和跨 realm 错误。 */
export function snapshotSemanticValue(value: unknown): SemanticValue {
  const seen = new Map<object, number>()
  function visit(input: unknown): SemanticValue {
    function properties(object: object, omit: Set<string> = new Set()): [string, SemanticValue][] {
      return Object.keys(object).filter(key => !omit.has(key)).sort().map(key => [key, visit(Reflect.get(object, key))])
    }
    if (input === null) {
      return { type: 'null' }
    }
    if (input === undefined) {
      return { type: 'undefined' }
    }
    if (typeof input === 'boolean') {
      return { type: 'boolean', value: input }
    }
    if (typeof input === 'string' || typeof input === 'bigint') {
      return { type: typeof input === 'string' ? 'string' : 'bigint', value: String(input) }
    }
    if (typeof input === 'number') {
      return { type: 'number', value: Object.is(input, -0) ? '-0' : String(input) }
    }
    if (typeof input === 'symbol') {
      return { type: 'symbol', description: input.description ?? null }
    }
    if (typeof input === 'function') {
      return { type: 'function' }
    }
    if (typeof input !== 'object') {
      throw new TypeError(`Unsupported semantic value: ${typeof input}`)
    }
    const existing = seen.get(input)
    if (existing !== undefined) {
      return { type: 'reference', id: existing }
    }
    const id = seen.size
    seen.set(input, id)
    if (Object.getOwnPropertySymbols(input).some(symbol => Object.prototype.propertyIsEnumerable.call(input, symbol))) {
      throw new TypeError('Enumerable symbol keys require an explicit semantic observation')
    }
    if (types.isNativeError(input)) {
      const error = input as Error
      return {
        type: 'error',
        id,
        name: error.name,
        message: error.message,
        ...(Object.hasOwn(error, 'cause') ? { cause: visit(error.cause) } : {}),
        properties: properties(input, new Set(['name', 'message', 'stack', 'cause'])),
      }
    }
    if (Array.isArray(input)) {
      const values = Array.from({ length: input.length }, (_, index): SemanticValue =>
        Object.hasOwn(input, index) ? visit(input[index]) : { type: 'hole' })
      const indexes = new Set(Array.from({ length: input.length }, (_, index) => String(index)))
      return { type: 'array', id, values, properties: properties(input, indexes) }
    }
    const prototype = Object.getPrototypeOf(input)
    if (prototype !== null && Object.prototype.toString.call(input) !== '[object Object]') {
      throw new TypeError(`Unsupported semantic object: ${Object.prototype.toString.call(input)}`)
    }
    return { type: 'object', id, properties: properties(input) }
  }
  return visit(value)
}
