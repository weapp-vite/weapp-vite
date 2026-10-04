import type { CaptureBridgeMetrics, CapturedValue, CaptureExpressionTools } from './captureTypes'

const expressionFields = new Set(['expAst', 'rawExpAst', 'listExpAst', 'rawListExpAst', 'projectedListExpAst'])
const spanFields = new Set(['start', 'end', 'loc'])
const locationFields = new Set(['start', 'end', 'filename', 'identifierName'])
const positionFields = new Set(['line', 'column', 'index'])

function dataProperty(object: object, key: PropertyKey, path: string) {
  const descriptor = Object.getOwnPropertyDescriptor(object, key)
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) {
    throw new TypeError(`Capture rejects accessor at ${path}`)
  }
  return descriptor
}

function copySpanFields(object: object, fields: Set<string>, path: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of Reflect.ownKeys(object)) {
    if (typeof key !== 'string' || !fields.has(key)) {
      throw new TypeError(`Unknown expression span property at ${path}`)
    }
    const value: unknown = dataProperty(object, key, `${path}.${key}`).value
    if (value && typeof value === 'object') {
      result[key] = copySpanFields(value, key === 'loc' ? locationFields : positionFields, `${path}.${key}`)
    }
    else if (value === undefined || value === null || typeof value === 'number' || typeof value === 'string') {
      result[key] = value
    }
    else {
      throw new TypeError(`Unsupported expression span value at ${path}.${key}`)
    }
  }
  return result
}

export function createCaptureBridgeMetrics(): CaptureBridgeMetrics {
  return {
    expressionCount: 0,
    generatedUtf16Chars: 0,
    spanCoordinates: 'original expression parser input; not assumed to index script or SFC',
    cost: 'diagnostic JS generation; not a zero-cost native transfer',
  }
}

/** 全标记树保留 undefined、属性描述符和数组空洞；函数、symbol 与 AST 只能走明确边界。 */
export function serializeCaptureValue(value: unknown, options: {
  inputOptions?: boolean
  transferKey?: symbol
  expressions?: CaptureExpressionTools
  metrics?: CaptureBridgeMetrics
} = {}): CapturedValue {
  const active = new WeakSet<object>()
  const expressionIds = new WeakMap<object, number>()
  let nextExpressionId = 0
  const visit = (current: unknown, path: string, field?: string): CapturedValue => {
    if (current === undefined) {
      return { kind: 'undefined' }
    }
    if (current === null) {
      return { kind: 'null' }
    }
    if (typeof current === 'string' || typeof current === 'boolean') {
      return { kind: typeof current, value: current } as CapturedValue
    }
    if (typeof current === 'number') {
      return { kind: 'number', value: Object.is(current, -0) ? '-0' : String(current) }
    }
    if (typeof current === 'function' && options.inputOptions && path === '$.warn') {
      return { kind: 'callback', role: 'options.warn', ownership: 'caller; never transferred' }
    }
    if (typeof current !== 'object') {
      throw new TypeError(`Unsupported ${typeof current} at ${path}`)
    }
    if (active.has(current)) {
      throw new TypeError(`Capture rejects circular data at ${path}`)
    }
    if (options.expressions?.isExpression(current)) {
      if (!field || !expressionFields.has(field)) {
        throw new TypeError(`Expression outside an approved option field at ${path}`)
      }
      const nodeType: unknown = dataProperty(current, 'type', path).value
      if (typeof nodeType !== 'string') {
        throw new TypeError(`Missing expression type at ${path}`)
      }
      const span: Record<string, unknown> = {}
      for (const key of spanFields) {
        if (Object.hasOwn(current, key)) {
          span[key] = dataProperty(current, key, `${path}.${key}`).value
        }
      }
      const originalSpan = visit(copySpanFields(span, spanFields, path), `${path}.originalSpan`)
      const generatedSource = options.expressions.generate(current as never).code
      if (typeof generatedSource !== 'string') {
        throw new TypeError(`Expression generator returned no source at ${path}`)
      }
      if (!expressionIds.has(current)) {
        expressionIds.set(current, ++nextExpressionId)
      }
      if (options.metrics) {
        options.metrics.expressionCount++
        options.metrics.generatedUtf16Chars += generatedSource.length
      }
      return { kind: 'ast-expression', id: expressionIds.get(current)!, nodeType, generatedSource, originalSpan }
    }
    if (field && expressionFields.has(field) && options.inputOptions) {
      throw new TypeError(`Unsupported expression AST at ${path}`)
    }
    const prototype: unknown = Object.getPrototypeOf(current)
    if (prototype !== Object.prototype && prototype !== null && prototype !== Array.prototype) {
      throw new TypeError(`Unsupported object prototype at ${path}`)
    }
    active.add(current)
    try {
      return {
        kind: 'object',
        prototype: Array.isArray(current) ? 'Array' : prototype === null ? 'null' : 'Object',
        properties: Reflect.ownKeys(current).map((key) => {
          const descriptor = dataProperty(current, key, `${path}.${String(key)}`)
          const flags = { enumerable: descriptor.enumerable === true, configurable: descriptor.configurable === true, writable: descriptor.writable === true }
          if (typeof key === 'symbol') {
            if (!options.inputOptions || path !== '$' || key !== options.transferKey) {
              throw new TypeError(`Unknown symbol ownership at ${path}`)
            }
            return {
              key: { symbol: 'script baseline AST transfer' as const },
              ...flags,
              value: { kind: 'opaque' as const, role: 'script baseline AST transfer' as const, ownership: 'existing baseline loader; never consumed' as const, valueKind: descriptor.value === null ? 'null' : typeof descriptor.value },
            }
          }
          return { key, ...flags, value: visit(descriptor.value, `${path}.${key}`, key) }
        }),
      }
    }
    finally {
      active.delete(current)
    }
  }
  return visit(value, '$')
}
