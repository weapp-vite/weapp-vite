import type { CapturedValue, CaptureExpressionTools } from './captureTypes'
import { describe, expect, it, vi } from 'vitest'
import { decodeCapturedData } from './captureRead'
import { createCaptureBridgeMetrics, serializeCaptureValue } from './captureSerialize'

const expressions: CaptureExpressionTools = {
  isExpression: node => !!node && typeof node === 'object' && 'type' in node && node.type === 'Identifier',
  generate: node => ({ code: (node as { name: string }).name }),
}

describe('transformScript capture serialization', () => {
  it('preserves explicit undefined, null, descriptors, sparse arrays and special numbers', () => {
    const input = { missingValue: undefined, nullValue: null, numbers: [-0, Number.NaN, Infinity], holes: Array.from({ length: 2 }) }
    delete input.holes[0]
    Object.defineProperty(input, 'privateField', { value: 'hidden', enumerable: false })
    const encoded = serializeCaptureValue(input)
    const result = decodeCapturedData(JSON.parse(JSON.stringify(encoded))) as typeof input
    expect(Object.hasOwn(result, 'missingValue')).toBe(true)
    expect(Object.hasOwn(result, 'absent')).toBe(false)
    expect(result.nullValue).toBe(null)
    expect(Object.is(result.numbers[0], -0)).toBe(true)
    expect(Number.isNaN(result.numbers[1])).toBe(true)
    expect(result.numbers[2]).toBe(Infinity)
    expect(Object.hasOwn(result.holes, 0)).toBe(false)
    expect(Object.hasOwn(result.holes, 1)).toBe(true)
    expect(Object.getOwnPropertyDescriptor(result, 'privateField')).toEqual(Object.getOwnPropertyDescriptor(input, 'privateField'))
  })

  it('has no sentinel collision or prototype assignment when reading ordinary output', () => {
    const value = JSON.parse('{"kind":"callback","__proto__":{"polluted":true}}') as unknown
    const result = decodeCapturedData(serializeCaptureValue(value)) as object
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
    expect(Object.hasOwn(result, '__proto__')).toBe(true)
    expect(result).toEqual(value)
  })

  it('describes the root warn callback and opaque transfer without traversing their owners', () => {
    const key = Symbol('script baseline AST transfer')
    const token = Object.defineProperty({}, 'ast', { get: () => {
      throw new Error('must not touch')
    } })
    const result = serializeCaptureValue({ warn() {}, [key]: token }, { inputOptions: true, transferKey: key })
    expect(result).toMatchObject({
      kind: 'object',
      properties: [
        { key: 'warn', value: { kind: 'callback', role: 'options.warn' } },
        { key: { symbol: 'script baseline AST transfer' }, value: { kind: 'opaque', valueKind: 'object' } },
      ],
    })
    expect(() => decodeCapturedData(result)).toThrow('Cannot decode captured callback')
  })

  it('bridges expression ASTs to generated source and original spans without AST transport', () => {
    class Position {
      constructor(readonly line: number, readonly column: number, readonly index: number) {}
    }
    const ast = { type: 'Identifier', name: 'item', start: 2, end: 6, loc: { start: new Position(1, 2, 2), end: new Position(1, 6, 6), filename: undefined }, ignoredHugeSubtree: { secret: 'AST internals' } }
    const metrics = createCaptureBridgeMetrics()
    const generate = vi.fn(expressions.generate)
    const result = serializeCaptureValue({ classStyleBindings: [{ expAst: ast, rawExpAst: ast }] }, { inputOptions: true, expressions: { ...expressions, generate }, metrics })
    const json = JSON.stringify(result)
    expect(json).toContain('ast-expression')
    expect(json).toContain('generatedSource')
    expect(json).not.toContain('ignoredHugeSubtree')
    expect(json).not.toContain('AST internals')
    expect(json.match(/"id":1/g)).toHaveLength(2)
    expect(generate).toHaveBeenCalledTimes(2)
    expect(metrics).toMatchObject({ expressionCount: 2, generatedUtf16Chars: 8 })
    expect(() => decodeCapturedData(result)).toThrow('ast-expression')
  })

  it('rejects accessors without executing them and rejects unsupported prototypes', () => {
    const getter = vi.fn(() => 1)
    expect(() => serializeCaptureValue(Object.defineProperty({}, 'read', { get: getter }))).toThrow('accessor')
    expect(getter).not.toHaveBeenCalled()
    expect(() => serializeCaptureValue(new Map())).toThrow('prototype')
  })

  it.each([Symbol('unknown'), 2n, () => 1])('rejects unsupported values (%s)', (value) => {
    expect(() => serializeCaptureValue({ value })).toThrow('Unsupported')
  })

  it('rejects unowned callbacks and symbols even in option mode', () => {
    expect(() => serializeCaptureValue({ nested: { warn() {} } }, { inputOptions: true })).toThrow('Unsupported function')
    expect(() => serializeCaptureValue({ [Symbol('script baseline AST transfer')]: undefined }, { inputOptions: true })).toThrow('Unknown symbol ownership')
    expect(() => serializeCaptureValue({ nested: { [Symbol('unknown')]: 1 } }, { inputOptions: true })).toThrow('Unknown symbol ownership')
  })

  it('rejects unknown expression shapes and new AST option fields', () => {
    expect(() => serializeCaptureValue({ expAst: {} }, { inputOptions: true, expressions })).toThrow('Unsupported expression AST')
    expect(() => serializeCaptureValue({ newAst: { type: 'Identifier', name: 'x' } }, { inputOptions: true, expressions })).toThrow('approved option field')
  })

  it('rejects cycles while allowing ordinary shared immutable values', () => {
    const value: { circular?: object } = {}
    value.circular = value
    expect(() => serializeCaptureValue(value)).toThrow('circular')
    const shared = { value: 1 }
    expect(decodeCapturedData(serializeCaptureValue({ a: shared, b: shared }))).toEqual({ a: shared, b: shared })
  })

  it.each([
    { kind: 'number', value: 'invalid' },
    { kind: 'boolean', value: () => {} },
    { kind: 'object', prototype: 'Unknown', properties: [] },
    { kind: 'object', prototype: 'Object', properties: [{ key: 'x', value: { kind: 'null' } }] },
  ])('rejects malformed persisted output trees (%j)', (value) => {
    expect(() => decodeCapturedData(value as CapturedValue)).toThrow('Invalid captured')
  })
})
