import type { Element, Node } from 'domhandler'
import type { ExtractForResult, LegacyTemplateScope } from './types'
import {
  CONTROL_ATTRS,
  hasControlAttribute,
  normalizeAttributeName,
  resolveControlAttributeValue,
} from '../../shared/wxml'
import {
  MINI_PROGRAM_EVENT_ATTRIBUTE_PREFIX,
  MINI_PROGRAM_EVENT_FLAG_ATTRIBUTE_PREFIX,
} from '../component/constants'
import { escapeAttribute, resolveAttributeValue } from './expression'

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

export function extractFor(attribs: Record<string, string>): ExtractForResult {
  const expr = resolveControlAttributeValue(attribs, 'for')
  const restAttribs: Record<string, string> = {}
  const itemName = resolveControlAttributeValue(attribs, 'for-item')?.trim() || 'item'
  let indexName = resolveControlAttributeValue(attribs, 'for-index')?.trim() || 'index'

  for (const [key, val] of Object.entries(attribs)) {
    if (CONTROL_ATTRS.has(key)) {
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
      result += ` ${MINI_PROGRAM_EVENT_ATTRIBUTE_PREFIX}${runtimeEvent}="${escapeAttribute(handlerName)}"`
      const flagTokens = [
        flags.capture ? 'capture' : '',
        flags.catch ? 'catch' : '',
      ].filter(Boolean)
      if (flagTokens.length) {
        result += ` ${MINI_PROGRAM_EVENT_FLAG_ATTRIBUTE_PREFIX}${runtimeEvent}="${flagTokens.join(',')}"`
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
  return hasControlAttribute(attribs, 'if')
    || hasControlAttribute(attribs, 'elif')
    || hasControlAttribute(attribs, 'else')
}
