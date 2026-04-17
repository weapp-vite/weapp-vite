import type {
  ComponentPropsOptions,
  MiniProgramComponentPropertyOption,
  MiniProgramComponentShortProperty,
} from '../types'
import {
  WEVU_SLOT_OWNER_ID_PROP,
  WEVU_SLOT_SCOPE_KEY,
} from '@weapp-core/constants'

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
    if (!Object.hasOwn(propOptions, 'type')) {
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

  if (!Object.hasOwn(propOptions, 'type')) {
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
    if (!Object.hasOwn(next, WEVU_SLOT_OWNER_ID_PROP)) {
      next[WEVU_SLOT_OWNER_ID_PROP] = { type: String, value: '' }
    }
    if (!Object.hasOwn(next, WEVU_SLOT_SCOPE_KEY)) {
      next[WEVU_SLOT_SCOPE_KEY] = { type: null, value: null }
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
      if (!Object.hasOwn(propOptions, 'type')) {
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
      if (!Object.hasOwn(propOptions, 'type')) {
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
