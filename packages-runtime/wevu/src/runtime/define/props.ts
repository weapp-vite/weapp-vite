import type {
  ComponentPropsOptions,
  MiniProgramComponentPropertyOption,
  MiniProgramComponentShortProperty,
} from '../types'
import {
  WEVU_GENERIC_SLOT_OWNER_DATA_KEY,
  WEVU_GENERIC_SLOT_OWNER_ID_ATTR,
  WEVU_GENERIC_SLOT_OWNER_ID_PROP,
  WEVU_GENERIC_SLOT_OWNER_PROP_PREFIX,
  WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR,
  WEVU_GENERIC_SLOT_PROPS_DATA_KEY,
  WEVU_GENERIC_SLOT_SCOPE_ATTR,
  WEVU_GENERIC_SLOT_SCOPE_PROP,
  WEVU_NATIVE_SLOT_SCOPE_DATA_KEY,
  WEVU_SLOT_NAMES_PROP,
  WEVU_SLOT_OWNER_ID_KEY,
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_OWNER_KEY,
  WEVU_SLOT_PROPS_DATA_KEY,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'
import { hasOwn } from '../../utils'
import { rememberSlotOwnerId } from '../scopedSlots'

const ALLOW_NULL_PROP_INPUT_KEY = '__wevu_allowNullPropInput'
const PUBLIC_ALLOW_NULL_PROP_INPUT_KEY = 'allowNullPropInput'

const NATIVE_PROPERTY_TYPE_MAP = new Map<unknown, MiniProgramComponentShortProperty | null>([
  [String, String],
  [Number, Number],
  [Boolean, Boolean],
  [Object, Object],
  [Array, Array],
  ['String', String],
  ['Number', Number],
  ['Boolean', Boolean],
  ['Object', Object],
  ['Array', Array],
  [null, null],
  ['null', null],
  ['Null', null],
])

function toNativePropertyType(candidate: unknown) {
  return NATIVE_PROPERTY_TYPE_MAP.get(candidate)
}

function normalizeTypeCandidates(raw: unknown) {
  if (raw === undefined) {
    return []
  }
  const source = Array.isArray(raw) ? raw : [raw]
  const normalized: Array<MiniProgramComponentShortProperty | null> = []
  source.forEach((item) => {
    const mapped = toNativePropertyType(item)
    if (mapped === undefined) {
      return
    }
    if (!normalized.includes(mapped)) {
      normalized.push(mapped)
    }
  })
  const requiredNativeTypes = normalized.filter((item): item is MiniProgramComponentShortProperty => item !== null)
  if (requiredNativeTypes.length > 0) {
    return requiredNativeTypes
  }
  if (normalized.includes(null)) {
    return [null]
  }
  return [null]
}

function applyTypeOptions(target: Record<string, any>, rawType: unknown) {
  const candidates = normalizeTypeCandidates(rawType)
  if (candidates.length === 0) {
    return
  }

  target.type = candidates[0]
  if (candidates.length > 1) {
    const optionalTypes: any[] = []
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

function appendOptionalType(target: Record<string, any>, candidate: unknown) {
  if (candidate === undefined || target.type === candidate) {
    return
  }
  const optionalTypes = Array.isArray(target.optionalTypes)
    ? [...target.optionalTypes]
    : []
  if (optionalTypes.includes(candidate)) {
    return
  }
  optionalTypes.push(candidate)
  target.optionalTypes = optionalTypes
}

function normalizeOptionalTypeCandidates(raw: unknown) {
  if (!Array.isArray(raw)) {
    return []
  }
  const normalized: MiniProgramComponentShortProperty[] = []
  raw.forEach((item) => {
    const mapped = toNativePropertyType(item)
    if (mapped === undefined || mapped === null || normalized.includes(mapped)) {
      return
    }
    normalized.push(mapped)
  })
  return normalized
}

function normalizeExplicitPropertyDefinition(
  definition: unknown,
  allowNullPropInput: boolean,
) {
  if (definition === undefined) {
    return undefined
  }
  if (definition === null) {
    return { type: null }
  }
  if (Array.isArray(definition) || typeof definition === 'function') {
    const propOptions: Record<string, any> = {}
    applyTypeOptions(propOptions, definition)
    if (allowNullPropInput && propOptions.type !== null) {
      appendOptionalType(propOptions, null)
    }
    if (!hasOwn(propOptions, 'type')) {
      propOptions.type = null
    }
    return propOptions
  }
  if (typeof definition !== 'object') {
    return definition
  }

  const propOptions: Record<string, any> = {
    ...(definition as Record<string, any>),
  }

  if ('type' in propOptions) {
    const normalizedTypes = normalizeTypeCandidates(propOptions.type)
    propOptions.type = normalizedTypes[0] ?? null
    const existingOptionalTypes = normalizeOptionalTypeCandidates(propOptions.optionalTypes)
    for (const candidate of normalizedTypes.slice(1)) {
      if (candidate !== null && !existingOptionalTypes.includes(candidate)) {
        existingOptionalTypes.push(candidate)
      }
    }
    if (existingOptionalTypes.length > 0) {
      propOptions.optionalTypes = existingOptionalTypes
    }
    else {
      delete propOptions.optionalTypes
    }
  }

  if (!hasOwn(propOptions, 'type')) {
    propOptions.type = null
  }

  if (allowNullPropInput && propOptions.type !== null) {
    appendOptionalType(propOptions, null)
  }

  return propOptions
}

function normalizeExplicitProperties(
  properties: MiniProgramComponentPropertyOption,
  allowNullPropInput: boolean,
) {
  const normalizedProperties: Record<string, any> = {}
  Object.entries(properties).forEach(([key, definition]) => {
    const normalizedDefinition = normalizeExplicitPropertyDefinition(definition, allowNullPropInput)
    if (normalizedDefinition !== undefined) {
      normalizedProperties[key] = normalizedDefinition
    }
  })
  return normalizedProperties
}

function syncSlotOwnerId(this: any, next: unknown) {
  rememberSlotOwnerId(next)
  if (typeof next !== 'string') {
    return
  }
  this?.setData?.({
    [WEVU_SLOT_OWNER_ID_KEY]: next,
    [WEVU_SLOT_OWNER_ID_PROP]: next,
    [WEVU_GENERIC_SLOT_OWNER_ID_PROP]: next,
    [WEVU_GENERIC_SLOT_OWNER_ID_ATTR]: next,
  })
}

function normalizeSlotScopeValue(value: unknown) {
  if (!value || typeof value !== 'object') {
    return {}
  }
  if (!Array.isArray(value)) {
    return value
  }
  const result: Record<string, unknown> = {}
  for (let i = 0; i < value.length; i += 2) {
    const key = value[i]
    if (typeof key === 'string' && key) {
      result[key] = value[i + 1]
    }
  }
  return result
}

function syncNativeSlotScope(this: any, next: unknown) {
  const slotScope = normalizeSlotScopeValue(next)
  const payload: Record<string, unknown> = {
    [WEVU_NATIVE_SLOT_SCOPE_DATA_KEY]: slotScope,
  }
  for (const [key, value] of Object.entries(slotScope)) {
    if (value !== undefined) {
      payload[key] = value
    }
  }
  this?.setData?.(payload)
}

function syncSlotOwnerProps(this: any, next: unknown) {
  const payload: Record<string, unknown> = {
    [WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR]: next,
  }
  const ownerProps = normalizeSlotScopeValue(next)
  payload[WEVU_SLOT_OWNER_KEY] = {
    ...(this?.data?.[WEVU_SLOT_OWNER_KEY] ?? {}),
    ...ownerProps,
  }
  payload[WEVU_GENERIC_SLOT_OWNER_DATA_KEY] = {
    ...(this?.data?.[WEVU_GENERIC_SLOT_OWNER_DATA_KEY] ?? {}),
    ...ownerProps,
  }
  payload[WEVU_SLOT_PROPS_DATA_KEY] = ownerProps
  payload[WEVU_GENERIC_SLOT_PROPS_DATA_KEY] = ownerProps
  for (const [key, value] of Object.entries(ownerProps)) {
    if (value !== undefined) {
      payload[`${WEVU_GENERIC_SLOT_OWNER_PROP_PREFIX}${key}`] = value
    }
  }
  this?.setData?.(payload)
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
  const resolvedExplicit = explicitProperties
    ?? (baseProperties && typeof baseProperties === 'object' ? (baseProperties as any) : undefined)
  const attachInternalProps = (source?: Record<string, any>) => {
    const next = { ...(source ?? {}) }
    if (!hasOwn(next, WEVU_SLOT_OWNER_ID_PROP)) {
      next[WEVU_SLOT_OWNER_ID_PROP] = { type: String, value: '', observer: syncSlotOwnerId }
    }
    if (!hasOwn(next, WEVU_GENERIC_SLOT_OWNER_ID_PROP)) {
      next[WEVU_GENERIC_SLOT_OWNER_ID_PROP] = { type: String, value: '', observer: syncSlotOwnerId }
    }
    if (!hasOwn(next, WEVU_GENERIC_SLOT_OWNER_ID_ATTR)) {
      next[WEVU_GENERIC_SLOT_OWNER_ID_ATTR] = { type: String, value: '', observer: syncSlotOwnerId }
    }
    if (!hasOwn(next, WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR)) {
      next[WEVU_GENERIC_SLOT_OWNER_PROPS_ATTR] = { type: null, value: null, observer: syncSlotOwnerProps }
    }
    if (!hasOwn(next, WEVU_SLOT_SCOPE_KEY)) {
      next[WEVU_SLOT_SCOPE_KEY] = { type: null, value: null, observer: syncNativeSlotScope }
    }
    if (!hasOwn(next, WEVU_GENERIC_SLOT_SCOPE_PROP)) {
      next[WEVU_GENERIC_SLOT_SCOPE_PROP] = { type: null, value: null, observer: syncNativeSlotScope }
    }
    if (!hasOwn(next, WEVU_GENERIC_SLOT_SCOPE_ATTR)) {
      next[WEVU_GENERIC_SLOT_SCOPE_ATTR] = { type: null, value: null, observer: syncNativeSlotScope }
    }
    if (!hasOwn(next, WEVU_SLOT_NAMES_PROP)) {
      next[WEVU_SLOT_NAMES_PROP] = { type: null, value: null }
    }
    return next
  }

  if (resolvedExplicit || !props) {
    const {
      properties: _ignored,
      ...rest
    } = normalizedBaseOptions
    const normalizedExplicitProperties = resolvedExplicit
      ? allowNullPropInput
        ? normalizeExplicitProperties(resolvedExplicit as any, allowNullPropInput)
        : (resolvedExplicit as any)
      : undefined
    return {
      ...rest,
      properties: attachInternalProps(normalizedExplicitProperties),
    }
  }

  const properties: Record<string, any> = {}
  Object.entries(props).forEach(([key, definition]) => {
    if (definition === undefined) {
      return
    }
    if (definition === null) {
      properties[key] = { type: null }
      return
    }
    if (Array.isArray(definition) || typeof definition === 'function') {
      const propOptions: Record<string, any> = {}
      applyTypeOptions(propOptions, definition)
      if (allowNullPropInput && propOptions.type !== null) {
        appendOptionalType(propOptions, null)
      }
      if (!hasOwn(propOptions, 'type')) {
        propOptions.type = null
      }
      properties[key] = propOptions
      return
    }
    if (typeof definition === 'object') {
      // 在 Vue <script setup> 中，defineModel() 会生成空的 modifiers props。
      if (key.endsWith('Modifiers') && Object.keys(definition).length === 0) {
        properties[key] = { type: Object, value: {} }
        return
      }
      const propOptions: Record<string, any> = {}
      if ('type' in definition && definition.type !== undefined) {
        applyTypeOptions(propOptions, (definition as any).type)
      }
      if (Array.isArray((definition as any).optionalTypes)) {
        const optionalTypes = (definition as any).optionalTypes.map((item: unknown) => toNativePropertyType(item)).filter((item: unknown): item is MiniProgramComponentShortProperty => item !== undefined && item !== null)
        if (optionalTypes.length > 0) {
          const existingOptionalTypes = Array.isArray(propOptions.optionalTypes)
            ? propOptions.optionalTypes as any[]
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
      if (allowNullPropInput && propOptions.type !== null) {
        appendOptionalType(propOptions, null)
      }
      if (!hasOwn(propOptions, 'type')) {
        propOptions.type = null
      }
      properties[key] = propOptions
    }
  })

  return {
    ...normalizedBaseOptions,
    properties: attachInternalProps(properties),
  }
}
