import type { ComponentPropsOptions } from '../types'

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
    if (!Object.prototype.hasOwnProperty.call(next, '__wvAttrs')) {
      next.__wvAttrs = { type: null, value: null }
    }
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
    if (definition === null || definition === undefined) {
      return
    }
    if (Array.isArray(definition) || typeof definition === 'function') {
      properties[key] = { type: definition }
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
        propOptions.type = (definition as any).type
      }
      const defaultValue = 'default' in definition ? (definition as any).default : (definition as any).value
      if (defaultValue !== undefined) {
        propOptions.value = typeof defaultValue === 'function' ? (defaultValue as any)() : defaultValue
      }
      properties[key] = propOptions
    }
  })

  return {
    ...baseOptions,
    properties: attachInternalProps(properties),
  }
}
