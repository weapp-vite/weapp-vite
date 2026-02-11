import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { toWxmlStringLiteral } from './helpers'

const skippedComponentAttrNames = new Set([
  'class',
  'style',
  'ref',
  'key',
  'slot',
  'is',
  'data-is',
  'vue-slots',
  '__wvAttrs',
  '__wv-slot-scope',
  '__wv-slot-owner-id',
])

function shouldCollectComponentAttr(name: string): boolean {
  const normalized = name.trim()
  if (!normalized) {
    return false
  }
  if (skippedComponentAttrNames.has(normalized)) {
    return false
  }
  if (normalized.startsWith('generic:')) {
    return false
  }
  if (normalized.startsWith('data-wv-')) {
    return false
  }
  if (normalized.startsWith('__wv')) {
    return false
  }
  return true
}

function getBindArgName(prop: DirectiveNode): string {
  if (prop.arg?.type !== NodeTypes.SIMPLE_EXPRESSION) {
    return ''
  }
  return prop.arg.content.trim()
}

function parseTransformedAttrEntries(attr: string): Array<{ name: string, value?: string }> {
  const entries: Array<{ name: string, value?: string }> = []
  const regex = /([^\s=]+)(?:="([^"]*)")?/g
  let match: RegExpExecArray | null = regex.exec(attr)
  while (match) {
    const [, name, value] = match
    entries.push({ name, value })
    match = regex.exec(attr)
  }
  return entries
}

function resolveAttrValueExpression(
  transformedMap: Map<string, { valueType: 'literal' | 'expression', value: string }>,
  attrName: string,
  fallbackLiteral: string,
): string {
  const transformed = transformedMap.get(attrName)
  if (!transformed) {
    return toWxmlStringLiteral(fallbackLiteral)
  }
  return transformed.valueType === 'expression'
    ? transformed.value
    : toWxmlStringLiteral(transformed.value)
}

export function buildComponentAttrsPayload(
  node: ElementNode,
  attrs: string[],
  context: TransformContext,
  options?: { skipSlotDirective?: boolean },
): string | undefined {
  const transformedMap = new Map<string, { valueType: 'literal' | 'expression', value: string }>()
  for (const attr of attrs) {
    const entries = parseTransformedAttrEntries(attr)
    for (const entry of entries) {
      const value = entry.value ?? ''
      const expressionMatch = value.match(/^\{\{([\s\S]*)\}\}$/)
      if (expressionMatch) {
        transformedMap.set(entry.name, { valueType: 'expression', value: expressionMatch[1] ?? '' })
      }
      else {
        transformedMap.set(entry.name, { valueType: 'literal', value })
      }
    }
  }

  const pairExpressions: string[] = []

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE) {
      if (!shouldCollectComponentAttr(prop.name)) {
        continue
      }
      const value = prop.value?.type === NodeTypes.TEXT ? prop.value.content : ''
      pairExpressions.push(
        toWxmlStringLiteral(prop.name),
        resolveAttrValueExpression(transformedMap, prop.name, value),
      )
      continue
    }

    if (prop.type !== NodeTypes.DIRECTIVE) {
      continue
    }
    if (options?.skipSlotDirective && prop.name === 'slot') {
      continue
    }
    if (prop.name !== 'bind') {
      continue
    }

    const argName = getBindArgName(prop)
    if (!shouldCollectComponentAttr(argName)) {
      continue
    }

    const rawExpValue = prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.exp.content : ''
    if (!rawExpValue) {
      continue
    }

    const valueExpression = transformedMap.get(argName)?.valueType === 'expression'
      ? transformedMap.get(argName)!.value
      : normalizeWxmlExpressionWithContext(rawExpValue, context)

    pairExpressions.push(toWxmlStringLiteral(argName), valueExpression)
  }

  if (!pairExpressions.length) {
    return undefined
  }

  return `__wvAttrs="{{[${pairExpressions.join(',')}]}}"`
}
