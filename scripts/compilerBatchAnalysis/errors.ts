/** Babel 为每个错误创建 clone 闭包；保留函数结构及行为探针，不能比较进程内函数引用。 */
import { CompilerDiagnosticError } from '../../packages-runtime/wevu-compiler/src/types/diagnostics'

function describeClone(clone: (...args: unknown[]) => unknown) {
  const prototype = Object.getOwnPropertyDescriptor(clone, 'prototype')?.value as object | undefined
  if (Object.getOwnPropertyNames(clone).some(key => !['name', 'length', 'prototype'].includes(key))
    || Object.getOwnPropertySymbols(clone).length
    || (prototype && (Object.getOwnPropertyNames(prototype).some(key => key !== 'constructor') || Object.getOwnPropertySymbols(prototype).length || Reflect.get(prototype, 'constructor') !== clone))) {
    throw new Error('Unsupported Babel clone function properties; inspect private raw error evidence')
  }
  return {
    name: clone.name,
    arity: clone.length,
    source: Function.prototype.toString.call(clone),
    descriptors: Object.fromEntries(Object.getOwnPropertyNames(clone).map((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(clone, key)!
      return [key, { writable: descriptor.writable, enumerable: descriptor.enumerable, configurable: descriptor.configurable }]
    })),
    prototype: prototype
      ? { constructor: 'self', descriptor: { ...Object.getOwnPropertyDescriptor(prototype, 'constructor'), value: 'self' } }
      : undefined,
  }
}

function prototypeEvidence(value: object) {
  const prototype: unknown = Object.getPrototypeOf(value)
  const builtins = [Object, Array, Map, Set, Date, ArrayBuffer, DataView, Uint8Array, Uint8ClampedArray, Int8Array, Uint16Array, Int16Array, Uint32Array, Int32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array, Error, SyntaxError, TypeError, RangeError, ReferenceError, EvalError, URIError, AggregateError]
  if (prototype === null) {
    return { name: null }
  }
  const builtin = builtins.find(constructor => constructor.prototype === prototype)
  if (builtin) {
    return { name: builtin.name }
  }
  if (prototype === CompilerDiagnosticError.prototype && Object.getPrototypeOf(prototype) === Error.prototype
    && Object.getOwnPropertyNames(prototype).join() === 'constructor' && !Object.getOwnPropertySymbols(prototype).length) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'constructor')!
    if (descriptor.value === CompilerDiagnosticError) {
      return { name: CompilerDiagnosticError.name, source: Function.prototype.toString.call(CompilerDiagnosticError), descriptor: { ...descriptor, value: 'constructor' }, parent: 'Error' }
    }
  }
  // Babel 位置信息是只有 constructor 的 Position 类，保留其结构与源码。
  if (prototype && typeof prototype === 'object' && Object.getPrototypeOf(prototype) === Object.prototype
    && Object.getOwnPropertyNames(prototype).join() === 'constructor' && !Object.getOwnPropertySymbols(prototype).length) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'constructor')!
    const constructor: unknown = descriptor.value
    if (typeof constructor === 'function' && constructor.name === 'Position') {
      return { name: constructor.name, source: Function.prototype.toString.call(constructor), descriptor: { ...descriptor, value: 'constructor' } }
    }
  }
  throw new Error('Unsupported error object prototype; inspect private raw error evidence')
}

function encode(value: unknown, seen: Map<object, unknown>, probeClone: boolean): unknown {
  if (typeof value === 'function') {
    throw new TypeError('Unsupported callable error field; inspect private raw error evidence')
  }
  if (typeof value === 'symbol') {
    throw new TypeError('Unsupported symbol error field; inspect private raw error evidence')
  }
  if (!value || typeof value !== 'object') {
    return value
  }
  if (seen.has(value)) {
    return seen.get(value)
  }
  if (Object.getOwnPropertySymbols(value).length) {
    throw new Error('Unsupported symbol error field; inspect private raw error evidence')
  }
  const result: { prototype: ReturnType<typeof prototypeEvidence>, fields: Record<string, unknown>, descriptors: Record<string, unknown>, contents?: unknown } = { prototype: prototypeEvidence(value), fields: {}, descriptors: {} }
  seen.set(value, result)
  if (value instanceof Date) {
    result.contents = value.getTime()
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    result.contents = Array.from(value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength))
  }
  if (value instanceof Map) {
    result.contents = Array.from(value, ([key, item]) => [encode(key, seen, probeClone), encode(item, seen, probeClone)])
  }
  if (value instanceof Set) {
    result.contents = Array.from(value, item => encode(item, seen, probeClone))
  }
  for (const key of Object.getOwnPropertyNames(value)) {
    if (key === 'stack' && value instanceof Error) {
      continue
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!
    const babelError = value instanceof SyntaxError && Reflect.get(value, 'code') === 'BABEL_PARSER_SYNTAX_ERROR'
    if (!('value' in descriptor) && !(babelError && key === 'message')) {
      throw new Error('Unsupported accessor error field; inspect private raw error evidence')
    }
    const field: unknown = 'value' in descriptor ? descriptor.value : Reflect.get(value, key)
    Object.defineProperty(result.descriptors, key, { enumerable: true, configurable: true, writable: true, value: {
      writable: descriptor.writable,
      enumerable: descriptor.enumerable,
      configurable: descriptor.configurable,
      get: descriptor.get ? Function.prototype.toString.call(descriptor.get) : undefined,
      set: descriptor.set ? Function.prototype.toString.call(descriptor.set) : undefined,
    } })
    let evidence: unknown
    if (key === 'clone' && typeof field === 'function' && value instanceof SyntaxError && Reflect.get(value, 'code') === 'BABEL_PARSER_SYNTAX_ERROR') {
      const clone = field as (...args: unknown[]) => unknown
      evidence = {
        kind: 'babel-parser-clone',
        function: describeClone(clone),
        // 探针结果仍保留 clone 的函数结构，仅停止重复执行下一层探针。
        probes: probeClone
          ? [undefined, { loc: { line: 7, column: 9, index: 23 } }, { details: { expected: 'compiler-batch-clone-probe' } }].map(overrides => encode(Reflect.apply(clone, value, [overrides]), new Map(), false))
          : undefined,
      }
    }
    else {
      evidence = encode(field, seen, probeClone)
    }
    Object.defineProperty(result.fields, key, { enumerable: true, configurable: true, writable: true, value: evidence })
  }
  return result
}

/** 栈与原错误 inspect 单独私有保存；语义证据保留所有非 stack 自有字段及嵌套 cause。 */
export function errorEvidence(value: unknown): unknown {
  return encode(value, new Map(), true)
}
