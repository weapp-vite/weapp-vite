import type { ComponentPropsOptions } from '../types'

function normalizeTypeCandidates(raw: unknown) {
  if (Array.isArray(raw)) {
    return raw.filter(item => item !== undefined)
  }
  if (raw === undefined) {
    return []
  }
  return [raw]
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

export function normalizeProps(
  baseOptions: Record<string, any>,
  props?: ComponentPropsOptions,
  explicitProperties?: WechatMiniprogram.Component.PropertyOption,
) {
  const baseProperties = (baseOptions as any).properties
  const resolvedExplicit = explicitProperties
    ?? (baseProperties && typeof baseProperties === 'object' ? (baseProperties as any) : undefined)
  const attachInternalProps = (source?: Record<string, any>) => {
    const next = { ...(source ?? {}) }
    if (!Object.prototype.hasOwnProperty.call(next, '__wvSlotOwnerId')) {
      next.__wvSlotOwnerId = { type: String, value: '' }
    }
    if (!Object.prototype.hasOwnProperty.call(next, '__wvSlotScope')) {
      next.__wvSlotScope = { type: null, value: null }
    }
    return next
  }

  if (resolvedExplicit || !props) {
    const { properties: _ignored, ...rest } = baseOptions
    return {
      ...rest,
      properties: attachInternalProps(resolvedExplicit as any),
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
      if (!Object.prototype.hasOwnProperty.call(propOptions, 'type')) {
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
        const optionalTypes = (definition as any).optionalTypes.filter((item: unknown) => item !== undefined)
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
      if (!Object.prototype.hasOwnProperty.call(propOptions, 'type')) {
        propOptions.type = null
      }
      properties[key] = propOptions
    }
  })

  return {
    ...baseOptions,
    properties: attachInternalProps(properties),
  }
}
