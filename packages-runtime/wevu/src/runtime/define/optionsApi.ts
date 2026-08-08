import { hasOwn } from '../../utils'
import { inject, provide } from '../provide'

type OptionRecord = Record<string, any>

const MISSING_INJECTION = Symbol('wevu-missing-options-api-injection')

function resolveInjectionDescriptor(descriptor: unknown) {
  if (typeof descriptor === 'string' || typeof descriptor === 'symbol') {
    return { from: descriptor }
  }
  if (!descriptor || typeof descriptor !== 'object') {
    return undefined
  }
  const record = descriptor as OptionRecord
  return {
    from: record.from,
    hasDefault: hasOwn(record, 'default'),
    defaultValue: record.default,
  }
}

function resolveDefaultValue(value: unknown, context: OptionRecord) {
  return typeof value === 'function' ? value.call(context) : value
}

/**
 * 将 Vue Options API 的 inject 解析为 setup 绑定。
 */
export function resolveOptionsApiInjections(
  option: unknown,
  context: OptionRecord,
): OptionRecord {
  const result: OptionRecord = {}
  if (Array.isArray(option)) {
    for (const key of option) {
      if (typeof key === 'string' || typeof key === 'symbol') {
        result[key as any] = inject(key)
      }
    }
    return result
  }
  if (!option || typeof option !== 'object') {
    return result
  }
  for (const [localKey, rawDescriptor] of Object.entries(option as OptionRecord)) {
    const descriptor = resolveInjectionDescriptor(rawDescriptor)
    if (!descriptor || descriptor.from == null) {
      continue
    }
    const value = inject(descriptor.from, MISSING_INJECTION)
    result[localKey] = value === MISSING_INJECTION && descriptor.hasDefault
      ? resolveDefaultValue(descriptor.defaultValue, context)
      : value === MISSING_INJECTION ? undefined : value
  }
  return result
}

/**
 * 注册 Vue Options API 的 provide 返回值。
 */
export function applyOptionsApiProvide(option: unknown, context: OptionRecord): void {
  const provided = typeof option === 'function' ? option.call(context) : option
  if (!provided || typeof provided !== 'object') {
    return
  }
  for (const key of Reflect.ownKeys(provided)) {
    provide(key, Reflect.get(provided, key))
  }
}
