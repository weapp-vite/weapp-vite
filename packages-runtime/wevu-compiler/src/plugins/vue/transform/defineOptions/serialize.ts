import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../../../utils/babel'

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return typeof error === 'string' ? error : ''
}

const BEHAVIOR_NOT_DEFINED_RE = /\bBehavior is not defined\b/

export function shouldFallbackToRawDefineOptions(error: unknown) {
  const message = getErrorMessage(error)
  return BEHAVIOR_NOT_DEFINED_RE.test(message)
}

function normalizeScriptSetupLang(lang?: string) {
  if (!lang) {
    return 'ts'
  }
  const lower = lang.toLowerCase()
  if (lower === 'txt') {
    return 'ts'
  }
  return lower
}

export function resolveScriptSetupExtension(lang?: string) {
  const normalized = normalizeScriptSetupLang(lang)
  if (normalized === 'ts' || normalized === 'tsx' || normalized === 'cts' || normalized === 'mts') {
    return 'ts'
  }
  return 'js'
}

const IDENTIFIER_LIKE_KEY_RE = /^[A-Z_$][\w$]*$/i
const OBJECT_TO_STRING = Object.prototype.toString

function isIdentifierLikeKey(key: string) {
  return IDENTIFIER_LIKE_KEY_RE.test(key)
}

function getObjectTag(value: unknown) {
  return OBJECT_TO_STRING.call(value)
}

type SerializableNativeFunction
  = | ((...args: any[]) => unknown)
    | (new (...args: any[]) => unknown)

const SERIALIZABLE_NATIVE_FUNCTIONS = new Map<SerializableNativeFunction, string>([
  [String, 'String'],
  [Number, 'Number'],
  [Boolean, 'Boolean'],
  [Object, 'Object'],
  [Array, 'Array'],
  [Function, 'Function'],
  [Date, 'Date'],
  [RegExp, 'RegExp'],
  [Map, 'Map'],
  [Set, 'Set'],
  [WeakMap, 'WeakMap'],
  [WeakSet, 'WeakSet'],
  [Promise, 'Promise'],
])

function isParsableFunctionExpressionSource(source: string) {
  try {
    babelParse(`(${source})`, BABEL_TS_MODULE_PARSER_OPTIONS)
    return true
  }
  catch {
    return false
  }
}

function tryConvertObjectMethodSourceToFunctionExpression(source: string) {
  try {
    const wrappedAst = babelParse(`({ ${source} })`, BABEL_TS_MODULE_PARSER_OPTIONS)
    const statement = wrappedAst.program.body[0]
    if (!statement || !t.isExpressionStatement(statement) || !t.isObjectExpression(statement.expression)) {
      return null
    }
    const firstProperty = statement.expression.properties[0]
    if (!firstProperty) {
      return null
    }
    if (t.isObjectMethod(firstProperty)) {
      const functionName = t.isIdentifier(firstProperty.key) ? t.identifier(firstProperty.key.name) : null
      const functionExpression = t.functionExpression(
        functionName,
        firstProperty.params as any[],
        firstProperty.body,
        firstProperty.generator,
        firstProperty.async,
      )
      return generate(functionExpression).code
    }
    if (
      t.isObjectProperty(firstProperty)
      && (t.isFunctionExpression(firstProperty.value) || t.isArrowFunctionExpression(firstProperty.value))
    ) {
      return generate(firstProperty.value).code
    }
  }
  catch {
    // ignore
  }
  return null
}

function normalizeFunctionSourceToExpression(source: string) {
  if (isParsableFunctionExpressionSource(source)) {
    return source
  }
  const converted = tryConvertObjectMethodSourceToFunctionExpression(source)
  if (converted && isParsableFunctionExpressionSource(converted)) {
    return converted
  }
  throw new Error('defineOptions 的参数中包含无法序列化的函数值。')
}

function parseExpressionFromSource(source: string) {
  const ast = babelParse(`(${source})`, BABEL_TS_MODULE_PARSER_OPTIONS)
  const statement = ast.program.body[0]
  if (!statement || !t.isExpressionStatement(statement)) {
    throw new Error('defineOptions 的函数源码解析失败。')
  }
  return statement.expression
}

function rewriteFunctionSourceWithScopeValues(source: string, scopeValues: Record<string, unknown>) {
  if (!Object.keys(scopeValues).length) {
    return source
  }

  const wrappedAst = babelParse(`(${source})`, BABEL_TS_MODULE_PARSER_OPTIONS)

  traverse(wrappedAst, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      if (path.scope.hasBinding(path.node.name)) {
        return
      }
      if (!Object.hasOwn(scopeValues, path.node.name)) {
        return
      }

      try {
        const replacement = serializeStaticValueToExpression(scopeValues[path.node.name], new WeakSet<object>(), {})
        path.replaceWith(parseExpressionFromSource(replacement) as any)
      }
      catch {
        // ignore unsupported captured values and keep the original identifier
      }
    },
  })

  const statement = wrappedAst.program.body[0]
  if (!statement || !t.isExpressionStatement(statement)) {
    throw new Error('defineOptions 的函数源码解析失败。')
  }

  const expression = statement.expression
  return generate(expression).code
}

export function serializeStaticValueToExpression(
  value: unknown,
  seen = new WeakSet<object>(),
  scopeValues: Record<string, unknown> = {},
): string {
  if (value === null) {
    return 'null'
  }

  if (value === undefined) {
    return 'undefined'
  }

  const valueType = typeof value
  if (valueType === 'string') {
    return JSON.stringify(value)
  }
  if (valueType === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (valueType === 'number') {
    if (Number.isNaN(value)) {
      return 'Number.NaN'
    }
    if (value === Number.POSITIVE_INFINITY) {
      return 'Number.POSITIVE_INFINITY'
    }
    if (value === Number.NEGATIVE_INFINITY) {
      return 'Number.NEGATIVE_INFINITY'
    }
    if (Object.is(value, -0)) {
      return '-0'
    }
    return String(value)
  }
  if (valueType === 'bigint') {
    return `${String(value)}n`
  }
  if (valueType === 'symbol') {
    throw new Error('defineOptions 的参数中不支持 Symbol 值。')
  }
  if (valueType === 'function') {
    const source = Function.prototype.toString.call(value)
    if (source.includes('[native code]')) {
      const nativeLiteral = SERIALIZABLE_NATIVE_FUNCTIONS.get(value as SerializableNativeFunction)
      if (nativeLiteral) {
        return nativeLiteral
      }
      throw new Error('defineOptions 的参数中不支持原生函数值。')
    }
    const normalized = normalizeFunctionSourceToExpression(source)
    const rewritten = normalizeFunctionSourceToExpression(rewriteFunctionSourceWithScopeValues(normalized, scopeValues))
    return `(${rewritten})`
  }

  if (getObjectTag(value) === '[object Date]') {
    return `new Date(${JSON.stringify(value.toISOString())})`
  }
  if (getObjectTag(value) === '[object RegExp]') {
    return value.toString()
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => serializeStaticValueToExpression(item, seen, scopeValues)).join(', ')}]`
  }

  if (value && typeof value === 'object') {
    if (seen.has(value as object)) {
      throw new Error('defineOptions 的参数中不支持循环引用。')
    }
    seen.add(value as object)

    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) {
      throw new Error('defineOptions 的参数仅支持普通对象。')
    }

    const objectValue = value as Record<string, unknown>
    const props = Object.keys(objectValue).map((key) => {
      const encodedKey = isIdentifierLikeKey(key) ? key : JSON.stringify(key)
      return `${encodedKey}: ${serializeStaticValueToExpression(objectValue[key], seen, scopeValues)}`
    })
    return `{ ${props.join(', ')} }`
  }

  throw new Error(`defineOptions 的参数中包含不支持的值类型：${valueType}`)
}
