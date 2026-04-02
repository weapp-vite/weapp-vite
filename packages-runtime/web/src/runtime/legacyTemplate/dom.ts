import type { Element, Node } from 'domhandler'
import type { ExtractForResult, LegacyTemplateScope } from './types'
import { escapeAttribute, resolveAttributeValue } from './expression'

const CONTROL_ATTRS = new Set([
  'wx:if',
  'wx:elif',
  'wx:else',
  'wx:for',
  'wx:for-item',
  'wx:for-index',
  'wx:key',
])

const EVENT_PREFIX_RE = /^(bind|catch|mut-bind|capture-bind|capture-catch)([\w-]+)$/
const EVENT_KIND_ALIAS: Record<string, string> = {
  tap: 'click',
  longtap: 'contextmenu',
  longpress: 'contextmenu',
}

const EVENT_PREFIX_FLAGS: Record<string, { catch?: boolean, capture?: boolean }> = {
  'bind': {},
  'catch': { catch: true },
  'mut-bind': {},
  'capture-bind': { capture: true },
  'capture-catch': { capture: true, catch: true },
}

export const SELF_CLOSING_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'image',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

export function normalizeTagName(name: string) {
  switch (name) {
    case 'view':
    case 'cover-view':
    case 'navigator':
    case 'scroll-view':
    case 'swiper':
    case 'swiper-item':
    case 'movable-area':
    case 'movable-view':
    case 'cover-image':
      return 'div'
    case 'text':
    case 'icon':
      return 'span'
    case 'image':
      return 'img'
    case 'button':
      return 'weapp-button'
    case 'input':
      return 'input'
    case 'textarea':
      return 'textarea'
    case 'form':
      return 'form'
    case 'label':
      return 'label'
    case 'picker':
    case 'picker-view':
      return 'select'
    case 'block':
      return '#fragment'
    case 'slot':
      return 'slot'
    default:
      return name || 'div'
  }
}

function normalizeAttributeName(name: string) {
  if (name === 'class' || name === 'style' || name.startsWith('data-')) {
    return name
  }
  if (name === 'hover-class') {
    return 'data-hover-class'
  }
  return name.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)
}

export function extractFor(attribs: Record<string, string>): ExtractForResult {
  const expr = attribs['wx:for']
  const restAttribs: Record<string, string> = {}
  const itemName = attribs['wx:for-item']?.trim() || 'item'
  let indexName = attribs['wx:for-index']?.trim() || 'index'

  for (const [key, val] of Object.entries(attribs)) {
    if (key === 'wx:for' || key === 'wx:for-item' || key === 'wx:for-index' || key === 'wx:key') {
      continue
    }
    restAttribs[key] = val
  }

  if (itemName === indexName) {
    indexName = `${indexName}Index`
  }

  return {
    expr,
    itemName,
    indexName,
    restAttribs,
  }
}

export function buildAttributeString(
  attribs: Record<string, string>,
  scope: LegacyTemplateScope,
) {
  let result = ''
  for (const [name, rawValue] of Object.entries(attribs)) {
    if (CONTROL_ATTRS.has(name)) {
      continue
    }

    const eventMatch = EVENT_PREFIX_RE.exec(name)
    if (eventMatch) {
      const [, prefix, rawEvent] = eventMatch
      const event = rawEvent.toLowerCase()
      const handlerName = resolveAttributeValue(rawValue, scope).trim()
      if (!handlerName) {
        continue
      }
      const runtimeEvent = EVENT_KIND_ALIAS[event] ?? event
      const flags = EVENT_PREFIX_FLAGS[prefix] ?? {}
      result += ` data-wx-on-${runtimeEvent}="${escapeAttribute(handlerName)}"`
      const flagTokens = [
        flags.capture ? 'capture' : '',
        flags.catch ? 'catch' : '',
      ].filter(Boolean)
      if (flagTokens.length) {
        result += ` data-wx-on-flags-${runtimeEvent}="${flagTokens.join(',')}"`
      }
      continue
    }

    const value = resolveAttributeValue(rawValue, scope)
    if (value === '') {
      continue
    }
    const normalizedName = normalizeAttributeName(name)
    result += ` ${normalizedName}="${escapeAttribute(value)}"`
  }
  return result
}

export function stripControlAttributes(attribs: Record<string, string>) {
  const result: Record<string, string> = {}
  for (const [name, value] of Object.entries(attribs)) {
    if (!CONTROL_ATTRS.has(name)) {
      result[name] = value
    }
  }
  return result
}

export function isConditionalElement(node: Node): node is Element {
  if (node.type !== 'tag') {
    return false
  }
  const attribs = (node as Element).attribs ?? {}
  return 'wx:if' in attribs || 'wx:elif' in attribs || 'wx:else' in attribs
}
