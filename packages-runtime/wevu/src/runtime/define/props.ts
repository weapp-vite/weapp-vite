import type {
  ComponentPropsOptions,
  MiniProgramComponentPropertyOption,
  MiniProgramComponentShortProperty,
} from '../types'
import {
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { hasOwn } from '../../utils'

const ALLOW_NULL_PROP_INPUT_KEY = '__wevu_allowNullPropInput'
const PUBLIC_ALLOW_NULL_PROP_INPUT_KEY = 'allowNullPropInput'

type NormalizedNativePropertyType = MiniProgramComponentShortProperty | FunctionConstructor | null

const NATIVE_PROPERTY_TYPE_MAP = new Map<unknown, NormalizedNativePropertyType>([
  [String, String],
  [Number, Number],
  [Boolean, Boolean],
  [Object, Object],
  [Array, Array],
  [Function, Function],
  ['String', String],
  ['Number', Number],
  ['Boolean', Boolean],
  ['Object', Object],
  ['Array', Array],
  ['Function', Function],
  [null, null],
  ['null', null],
  ['Null', null],
])

function toNativePropertyType(candidate: unknown) {
  return NATIVE_PROPERTY_TYPE_MAP.get(candidate)
}

function collectNativePropertyTypeCandidates(
  raw: unknown,
  normalized: NormalizedNativePropertyType[] = [],
) {
  if (Array.isArray(raw)) {
    for (const item of raw) {
      collectNativePropertyTypeCandidates(item, normalized)
    }
    return normalized
  }
  const mapped = toNativePropertyType(raw)
  if (mapped !== undefined && !normalized.includes(mapped)) {
    normalized.push(mapped)
  }
  return normalized
}

function normalizeTypeCandidates(raw: unknown) {
  if (raw === undefined) {
    return []
  }
  const normalized = collectNativePropertyTypeCandidates(raw)
  const requiredNativeTypes = normalized.filter((item): item is Exclude<NormalizedNativePropertyType, null> => item !== null)
  if (requiredNativeTypes.length > 0) {
    return requiredNativeTypes
  }
  return [null]
}

function applyTypeOptions(target: Record<string, unknown>, rawType: unknown) {
  const candidates = normalizeTypeCandidates(rawType)
  if (candidates.length === 0) {
    return
  }

  target.type = candidates[0]
  if (candidates.length > 1) {
    const optionalTypes: NormalizedNativePropertyType[] = []
    for (const candidate of candidates.slice(1)) {
      if (!optionalTypes.includes(candidate)) {
        optionalTypes.push(candidate)
      }
    }
    if (optionalTypes.length > 0) {
      target.optionalTypes = optionalTypes
    }
  }
}

function preserveImplicitNativeDefault(target: Record<string, unknown>) {
  if (hasOwn(target, 'value')) {
    return
  }
  if (target.type === String) {
    target.value = ''
  }
  else if (target.type === Number) {
    target.value = 0
  }
  else if (target.type === Boolean) {
    target.value = false
  }
  else if (target.type === Array) {
    target.value = []
  }
}

function applyNullableTransportOptions(
  target: Record<string, unknown>,
  definition: unknown,
  allowNullPropInput: boolean,
) {
  if (!allowNullPropInput || target.type === null) {
    return
  }
  const definitionRecord = definition && typeof definition === 'object' && !Array.isArray(definition)
    ? (definition as Record<string, unknown>)
    : undefined
  const candidates = collectNativePropertyTypeCandidates(
    definitionRecord
      ? [definitionRecord.type, definitionRecord.optionalTypes]
      : definition,
  )
  const explicitlyNullable = candidates.includes(null)
  const nativeTypes = candidates.filter(candidate => candidate !== null)
  const acceptsMultipleNativeTypes = nativeTypes.length > 1
  const acceptsMissingInput = definitionRecord?.required !== true
  // glass-easel 会先按主 type 校验并转换，optionalTypes 无法保护合法的联合值与空值传输。
  if (!explicitlyNullable && !acceptsMultipleNativeTypes && !acceptsMissingInput) {
    return
  }

  // 显式声明的 null 必须保持可观察；其余降级场景则保留原主类型的宿主隐式默认值。
  if (!explicitlyNullable) {
    preserveImplicitNativeDefault(target)
  }
  target.type = null
  delete target.optionalTypes
}

function normalizeVueProps(
  props: ComponentPropsOptions | undefined,
  allowNullPropInput: boolean,
) {
  const properties: Record<string, any> = {}
  if (!props) {
    return properties
  }

  Object.entries(props).forEach(([key, definition]) => {
    if (definition === undefined) {
      return
    }
    if (definition === null) {
      properties[key] = { type: null }
      return
    }
    if (Array.isArray(definition) || typeof definition === 'function') {
      const propOptions: Record<string, unknown> = {}
      applyTypeOptions(propOptions, definition)
      if (!hasOwn(propOptions, 'type')) {
        propOptions.type = null
      }
      applyNullableTransportOptions(propOptions, definition, allowNullPropInput)
      properties[key] = propOptions
      return
    }
    if (typeof definition === 'object') {
      // 在 Vue <script setup> 中，defineModel() 会生成空的 modifiers props。
      if (key.endsWith('Modifiers') && Object.keys(definition).length === 0) {
        properties[key] = { type: Object, value: {} }
        return
      }
      const propOptions: Record<string, unknown> = {}
      if ('type' in definition && definition.type !== undefined) {
        applyTypeOptions(propOptions, (definition as any).type)
      }
      if (Array.isArray((definition as any).optionalTypes)) {
        const optionalTypes = (definition as any).optionalTypes.map((item: unknown) => toNativePropertyType(item)).filter((item: unknown): item is Exclude<NormalizedNativePropertyType, null> => item !== undefined && item !== null)
        if (optionalTypes.length > 0) {
          const existingOptionalTypes = Array.isArray(propOptions.optionalTypes)
            ? propOptions.optionalTypes as NormalizedNativePropertyType[]
            : []
          for (const optionalType of optionalTypes) {
            if (optionalType === propOptions.type) {
              continue
            }
            if (!existingOptionalTypes.includes(optionalType)) {
              existingOptionalTypes.push(optionalType)
            }
          }
          if (existingOptionalTypes.length > 0) {
            propOptions.optionalTypes = existingOptionalTypes
          }
        }
      }
      if ('observer' in definition && (typeof (definition as any).observer === 'function' || typeof (definition as any).observer === 'string')) {
        propOptions.observer = (definition as any).observer
      }
      const defaultValue = 'default' in definition ? (definition as any).default : (definition as any).value
      if (defaultValue !== undefined) {
        propOptions.value = typeof defaultValue === 'function' ? (defaultValue as any)() : defaultValue
      }
      if (!hasOwn(propOptions, 'type')) {
        propOptions.type = null
      }
      applyNullableTransportOptions(propOptions, definition, allowNullPropInput)
      properties[key] = propOptions
    }
  })

  return properties
}

export function normalizeProps(
  baseOptions: Record<string, any>,
  props?: ComponentPropsOptions,
  explicitProperties?: MiniProgramComponentPropertyOption,
) {
  const allowNullPropInput = Boolean(
    (baseOptions as any)[ALLOW_NULL_PROP_INPUT_KEY]
    ?? (baseOptions as any)[PUBLIC_ALLOW_NULL_PROP_INPUT_KEY],
  )
  const {
    [ALLOW_NULL_PROP_INPUT_KEY]: _ignoredAllowNullPropInput,
    [PUBLIC_ALLOW_NULL_PROP_INPUT_KEY]: _ignoredPublicAllowNullPropInput,
    ...normalizedBaseOptions
  } = baseOptions
  const baseProperties = (baseOptions as any).properties
  const normalizedBaseProperties = baseProperties && typeof baseProperties === 'object' && Object.keys(baseProperties).length > 0
    ? (baseProperties as any)
    : undefined
  const resolvedExplicit = explicitProperties
    ?? normalizedBaseProperties
  const shouldAttachInternalProps = Boolean(props || resolvedExplicit)
  const attachInternalProps = (source?: Record<string, any>) => {
    const next = { ...(source ?? {}) }
    if (!shouldAttachInternalProps) {
      return next
    }
    if (!hasOwn(next, WEVU_SLOT_OWNER_ID_PROP)) {
      next[WEVU_SLOT_OWNER_ID_PROP] = { type: String, value: '' }
    }
    if (!hasOwn(next, WEVU_SLOT_SCOPE_KEY)) {
      next[WEVU_SLOT_SCOPE_KEY] = { type: null, value: null }
    }
    if (!hasOwn(next, WEVU_SLOT_NAMES_PROP)) {
      next[WEVU_SLOT_NAMES_PROP] = { type: null, value: null }
    }
    return next
  }

  if (resolvedExplicit) {
    const {
      properties: _ignored,
      ...rest
    } = normalizedBaseOptions
    const normalizedExplicitProperties = resolvedExplicit
    const normalizedVueProps = normalizeVueProps(props, allowNullPropInput)
    return {
      ...rest,
      properties: attachInternalProps({
        ...normalizedVueProps,
        ...normalizedExplicitProperties,
      }),
    }
  }

  return {
    ...normalizedBaseOptions,
    properties: attachInternalProps(normalizeVueProps(props, allowNullPropInput)),
  }
}
