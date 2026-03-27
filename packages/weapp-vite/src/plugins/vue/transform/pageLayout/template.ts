import type { LayoutPropValue, ResolvedPageLayout } from './types'
import {
  escapeDoubleQuotedAttr,
  getLayoutConditionalDirective,
  getLayoutElseDirective,
  toKebabCase,
} from './shared'

function toKebabAttrName(key: string) {
  return toKebabCase(key)
}

export function hasDynamicExpressionLayoutProps(props: Record<string, LayoutPropValue> | undefined) {
  if (!props) {
    return false
  }
  return Object.values(props).some(value => typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'expression')
}

export function serializeLayoutProps(props: Record<string, LayoutPropValue> | undefined) {
  if (!props || Object.keys(props).length === 0) {
    return ''
  }

  const attrs = Object.entries(props).map(([key, value]) => {
    const attrName = toKebabAttrName(key)
    if (typeof value === 'string') {
      return `${attrName}="${escapeDoubleQuotedAttr(value)}"`
    }
    if (typeof value === 'object' && value && 'kind' in value && value.kind === 'expression') {
      return `${attrName}="{{__wv_layout_bind_${key}}}"`
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      return `${attrName}="{{${String(value)}}}"`
    }
    return ''
  }).filter(Boolean)

  return attrs.length > 0 ? ` ${attrs.join(' ')}` : ''
}

export function collapseNestedLayoutWrapper(template: string, tagName: string) {
  const closeTag = `</${tagName}>`
  let next = template

  while (next.startsWith(`<${tagName}`) && next.endsWith(closeTag)) {
    const openTagEnd = next.indexOf('>')
    if (openTagEnd < 0) {
      break
    }
    const inner = next.slice(openTagEnd + 1, -closeTag.length)
    if (!inner.startsWith(`<${tagName}`)) {
      break
    }
    next = inner
  }

  return next
}

function serializeFallbackLayoutValue(value: LayoutPropValue | undefined, keyName: string) {
  if (value === undefined) {
    return `(__wv_page_layout_props&&__wv_page_layout_props.${keyName})`
  }
  if (typeof value === 'object' && value && 'kind' in value && value.kind === 'expression') {
    return `(__wv_page_layout_props&&__wv_page_layout_props.${keyName})!==undefined?__wv_page_layout_props.${keyName}:__wv_layout_bind_${keyName}`
  }
  return `(__wv_page_layout_props&&__wv_page_layout_props.${keyName})!==undefined?__wv_page_layout_props.${keyName}:${JSON.stringify(value)}`
}

function buildDynamicLayoutAttrs(
  propKeys: string[],
  currentLayout: ResolvedPageLayout | undefined,
) {
  if (propKeys.length === 0) {
    return ''
  }

  return ` ${propKeys.map((key) => {
    const attrName = toKebabAttrName(key)
    return `${attrName}="{{${serializeFallbackLayoutValue(currentLayout?.props?.[key], key)}}}"`
  }).join(' ')}`
}

export function buildDynamicLayoutTemplate(
  innerTemplate: string,
  currentLayout: ResolvedPageLayout | undefined,
  layouts: ResolvedPageLayout[],
  propKeys: string[],
) {
  const blocks = layouts.map((layout, index) => {
    const attrs = buildDynamicLayoutAttrs(propKeys, currentLayout)
    const condition = currentLayout?.layoutName === layout.layoutName
      ? `{{!__wv_page_layout_name || __wv_page_layout_name === '${layout.layoutName}'}}`
      : `{{__wv_page_layout_name === '${layout.layoutName}'}}`
    const directive = getLayoutConditionalDirective(index)
    return `<block ${directive}="${condition}"><${layout.tagName}${attrs}>${innerTemplate}</${layout.tagName}></block>`
  })

  return `${blocks.join('')}<block ${getLayoutElseDirective()}>${innerTemplate}</block>`
}
