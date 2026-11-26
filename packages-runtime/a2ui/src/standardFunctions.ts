/**
 * 标准函数语义对齐 @a2ui/web_core 0.16.1 的 common/basic_functions 与 v1_0 实现。
 * Copyright 2024 Google LLC，Apache-2.0（https://www.apache.org/licenses/LICENSE-2.0）。
 */
import type { DataContext, FunctionImplementation } from '@a2ui/web_core'
import {
  A2uiExpressionError,
  analyzeRegex,
  computed,
  ExpressionParser,
  getValue,
  isSignal,
  MAX_REGEX_VALUE_CODE_POINTS,
} from '@a2ui/web_core'

type BuiltinFunction = Pick<FunctionImplementation, 'returnType' | 'execute'>

interface ValidationResult { valid: boolean, message?: string, code?: string, severity?: string }

function validationResult(valid: boolean, message?: string, code?: string): ValidationResult {
  return {
    valid,
    ...(!valid && message ? { message } : {}),
    ...(!valid && code ? { code, severity: 'error' } : {}),
  }
}

function validateRequired(value: unknown): ValidationResult {
  const valid = value !== null
    && value !== undefined
    && !(typeof value === 'string' && value === '')
    && !(Array.isArray(value) && value.length === 0)
  return validationResult(valid, valid ? undefined : 'This field is required.')
}

const compiledRegexCache = new Map<string, RegExp>()

function compileRegex(pattern: string): RegExp {
  const cached = compiledRegexCache.get(pattern)
  if (cached) {
    compiledRegexCache.delete(pattern)
    compiledRegexCache.set(pattern, cached)
    return cached
  }
  const analysis = analyzeRegex(pattern)
  if (!analysis.ok) {
    throw new A2uiExpressionError(`Invalid or unsafe regex pattern (${analysis.reason}): ${pattern}`, 'regex')
  }
  let compiled: RegExp
  try {
    compiled = new RegExp(pattern, 'u')
  }
  catch (error) {
    throw new A2uiExpressionError(`Invalid regex pattern (UNSUPPORTED_SYNTAX): ${pattern}`, 'regex', error)
  }
  if (compiledRegexCache.size >= 256) {
    const oldest = compiledRegexCache.keys().next().value
    if (oldest !== undefined) {
      compiledRegexCache.delete(oldest)
    }
  }
  compiledRegexCache.set(pattern, compiled)
  return compiled
}

function validateRegex(value: unknown, pattern: string): ValidationResult {
  const text = String(value ?? '')
  if (Array.from(text).length > MAX_REGEX_VALUE_CODE_POINTS) {
    return validationResult(false, 'Value exceeds the maximum length for pattern matching.')
  }
  const valid = compileRegex(pattern).test(text)
  return validationResult(valid, valid ? undefined : 'Value does not match required pattern.')
}

function validateLength(value: unknown, min?: number, max?: number): ValidationResult {
  const length = typeof value === 'string' || Array.isArray(value) ? value.length : 0
  if (min !== undefined && !Number.isNaN(min) && length < min) {
    return validationResult(false, `Minimum length is ${min}.`)
  }
  if (max !== undefined && !Number.isNaN(max) && length > max) {
    return validationResult(false, `Maximum length is ${max}.`)
  }
  return validationResult(true)
}

function validateNumeric(value: unknown, min?: number, max?: number): ValidationResult {
  const number = Number(value)
  if (Number.isNaN(number)) {
    return validationResult(false, 'Value must be a valid number.')
  }
  if (min !== undefined && !Number.isNaN(min) && number < min) {
    return validationResult(false, `Minimum value is ${min}.`)
  }
  if (max !== undefined && !Number.isNaN(max) && number > max) {
    return validationResult(false, `Maximum value is ${max}.`)
  }
  return validationResult(true)
}

const emailRegex = /^[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i

function validateEmail(value: unknown): ValidationResult {
  const valid = typeof value === 'string' && emailRegex.test(value)
  return validationResult(
    valid,
    valid ? undefined : 'Please enter a valid email address (e.g. user@example.com).',
    valid ? undefined : 'INVALID_EMAIL',
  )
}

function dynamicBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'valid' in value) {
    const valid = value.valid
    if (typeof valid === 'boolean') {
      return valid
    }
  }
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true'
  }
  if (typeof value === 'number') {
    return value !== 0 && !Number.isNaN(value)
  }
  return false
}

function coerceString(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value) ?? String(value)
    }
    catch {
      return String(value)
    }
  }
  return String(value)
}

function adaptExpression(value: any, catalogId?: string): any {
  if (Array.isArray(value)) {
    return value.map(item => adaptExpression(item, catalogId))
  }
  if (typeof value !== 'object' || value === null) {
    return value
  }
  if (typeof value.path === 'string' && value.componentId === undefined && value['@path'] === undefined) {
    return { '@path': value.path }
  }
  const callName = typeof value.call === 'string' && typeof value['@call'] !== 'string'
    ? value.call
    : typeof value['@call'] === 'string'
      ? value['@call']
      : undefined
  if (callName !== undefined) {
    const args: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value.args ?? {})) {
      Object.defineProperty(args, key, {
        value: adaptExpression(item, catalogId),
        enumerable: true,
        writable: true,
        configurable: true,
      })
    }
    const resolvedCatalogId = value.catalogId ?? (catalogId && !callName.startsWith('@') ? catalogId : undefined)
    return {
      '@call': callName,
      args,
      ...(resolvedCatalogId !== undefined ? { catalogId: resolvedCatalogId } : {}),
    }
  }
  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    Object.defineProperty(result, key, {
      value: adaptExpression(item, catalogId),
      enumerable: true,
      writable: true,
      configurable: true,
    })
  }
  return result
}

function formatString(value: unknown, context: DataContext) {
  const parts = new ExpressionParser().parse(coerceString(value))
  const catalogId = context.surface?.defaultCatalog?.id
  const signals = parts.map(part => (
    typeof part === 'object' && part !== null && !Array.isArray(part)
      ? context.resolveSignal(adaptExpression(part, catalogId))
      : part
  ))
  return computed(() => signals.map(part => coerceString(isSignal(part) ? getValue(part) : part)).join(''))
}

const implementations: Record<string, BuiltinFunction> = {
  required: { returnType: 'validationResult', execute: args => validateRequired(args.value) },
  regex: { returnType: 'validationResult', execute: args => validateRegex(args.value, String(args.pattern)) },
  length: { returnType: 'validationResult', execute: args => validateLength(args.value, args.min as number | undefined, args.max as number | undefined) },
  numeric: { returnType: 'validationResult', execute: args => validateNumeric(args.value, args.min as number | undefined, args.max as number | undefined) },
  email: { returnType: 'validationResult', execute: args => validateEmail(args.value) },
  and: { returnType: 'boolean', execute: args => (args.values as unknown[]).every(dynamicBoolean) },
  or: { returnType: 'boolean', execute: args => (args.values as unknown[]).some(dynamicBoolean) },
  not: { returnType: 'boolean', execute: args => !dynamicBoolean(args.value) },
  formatString: { returnType: 'string', execute: (args, context) => formatString(args.value, context) },
}

// Core 的根入口不导出标准实现，版本入口又会引入 Web 组件，因此这里保留轻量等价实现。
export const builtinFunctions = new Map<string, BuiltinFunction>(Object.entries(implementations))
