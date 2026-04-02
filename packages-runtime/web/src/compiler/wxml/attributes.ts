import type { RenderElementNode, RenderNode } from './types'
import { CONTROL_ATTRS, EVENT_KIND_ALIAS, EVENT_PREFIX_RE, normalizeAttributeName } from '../../shared/wxml'
import { buildExpression, parseInterpolations } from './interpolation'

export function extractFor(attribs: Record<string, string>) {
  const expr = attribs['wx:for']
  const itemName = attribs['wx:for-item']?.trim() || 'item'
  let indexName = attribs['wx:for-index']?.trim() || 'index'
  const key = attribs['wx:key']
  const restAttribs: Record<string, string> = {}
  for (const [name, value] of Object.entries(attribs)) {
    if (CONTROL_ATTRS.has(name)) {
      continue
    }
    restAttribs[name] = value
  }
  if (itemName === indexName) {
    indexName = `${indexName}Index`
  }
  return { expr, itemName, indexName, key, restAttribs }
}

export function isConditionalElement(node: RenderNode): node is RenderElementNode {
  if (node.type !== 'element') {
    return false
  }
  const attribs = node.attribs ?? {}
  return 'wx:if' in attribs || 'wx:elif' in attribs || 'wx:else' in attribs
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

function parseEventAttribute(name: string) {
  if (name.includes(':')) {
    const [prefix, rawEvent] = name.split(':', 2)
    return { prefix, rawEvent }
  }
  const match = EVENT_PREFIX_RE.exec(name)
  if (!match) {
    return undefined
  }
  return { prefix: name.slice(0, name.length - match[1].length), rawEvent: match[1] }
}

export function resolveComponentTagName(name: string, componentTags?: Record<string, string>) {
  if (!componentTags) {
    return undefined
  }
  return componentTags[name] ?? componentTags[name.toLowerCase()]
}

const PROPERTY_BIND_EXCLUSIONS = new Set(['class', 'style', 'id', 'slot'])

function shouldBindAsProperty(name: string) {
  if (PROPERTY_BIND_EXCLUSIONS.has(name)) {
    return false
  }
  if (name.startsWith('data-') || name.startsWith('aria-')) {
    return false
  }
  return true
}

function normalizePropertyName(name: string) {
  return name.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
}

export function renderAttributes(
  attribs: Record<string, string>,
  scopeVar: string,
  wxsVar: string,
  options?: { skipControl?: boolean, preferProperty?: boolean },
) {
  let buffer = ''
  for (const [rawName, rawValue] of Object.entries(attribs)) {
    if (options?.skipControl && CONTROL_ATTRS.has(rawName)) {
      continue
    }
    const eventInfo = parseEventAttribute(rawName)
    if (eventInfo) {
      const event = eventInfo.rawEvent.toLowerCase()
      const handlerExpr = buildExpression(parseInterpolations(rawValue ?? ''), scopeVar, wxsVar)
      const domEvent = EVENT_KIND_ALIAS[event] ?? event
      const flags = {
        catch: eventInfo.prefix.includes('catch'),
        capture: eventInfo.prefix.includes('capture'),
      }
      buffer += ` @${domEvent}=\${ctx.event(${JSON.stringify(event)}, ${handlerExpr}, ${scopeVar}, ${wxsVar}, ${JSON.stringify(flags)})}`
      continue
    }
    const useProperty = options?.preferProperty && shouldBindAsProperty(rawName)
    const name = useProperty ? normalizePropertyName(rawName) : normalizeAttributeName(rawName)
    const expr = buildExpression(parseInterpolations(rawValue ?? ''), scopeVar, wxsVar)
    buffer += ` ${useProperty ? '.' : ''}${name}=\${${expr}}`
  }
  return buffer
}
