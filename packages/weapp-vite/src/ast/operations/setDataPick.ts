import type * as t from '@babel/types'
import type { AstEngineName } from '../types'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '../../utils/babel'

const TEMPLATE_MUSTACHE_RE = /\{\{([\s\S]*?)\}\}/g
const WX_FOR_TAG_RE = /<[^>]*\bwx:for\s*=\s*(?:"[^"]*"|'[^']*')[^>]*>/g
const WX_FOR_ITEM_RE = /\bwx:for-item\s*=\s*(?:"([^"]+)"|'([^']+)')/
const WX_FOR_INDEX_RE = /\bwx:for-index\s*=\s*(?:"([^"]+)"|'([^']+)')/

const JS_GLOBAL_IDENTIFIERS = new Set([
  'undefined',
  'NaN',
  'Infinity',
  'globalThis',
  'Math',
  'Number',
  'String',
  'Boolean',
  'Object',
  'Array',
  'Date',
  'JSON',
  'RegExp',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
])

function collectLoopScopeAliases(template: string): Set<string> {
  const aliases = new Set<string>()
  const tagMatches = template.match(WX_FOR_TAG_RE) ?? []
  for (const tag of tagMatches) {
    const itemMatch = tag.match(WX_FOR_ITEM_RE)
    if (itemMatch) {
      const itemAlias = (itemMatch[1] ?? itemMatch[2] ?? '').trim()
      if (itemAlias) {
        aliases.add(itemAlias)
      }
    }
    else {
      aliases.add('item')
    }

    const indexMatch = tag.match(WX_FOR_INDEX_RE)
    if (indexMatch) {
      const indexAlias = (indexMatch[1] ?? indexMatch[2] ?? '').trim()
      if (indexAlias) {
        aliases.add(indexAlias)
      }
    }
    else {
      aliases.add('index')
    }
  }
  return aliases
}

function extractTemplateExpressions(template: string): string[] {
  const expressions: string[] = []
  let match = TEMPLATE_MUSTACHE_RE.exec(template)
  while (match) {
    const expression = (match[1] ?? '').trim()
    if (expression) {
      expressions.push(expression)
    }
    match = TEMPLATE_MUSTACHE_RE.exec(template)
  }
  TEMPLATE_MUSTACHE_RE.lastIndex = 0
  return expressions
}

function collectIdentifiersFromExpression(expression: string): Set<string> {
  const collected = new Set<string>()
  let ast: t.File | undefined
  try {
    ast = parse(`const __weappViteExpr = (${expression});`, {
      ...BABEL_TS_MODULE_PARSER_OPTIONS,
      sourceType: 'module',
    }) as unknown as t.File
  }
  catch {
    return collected
  }

  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (name === '__weappViteExpr') {
        return
      }
      if (path.scope.hasBinding(name, true)) {
        return
      }
      if (JS_GLOBAL_IDENTIFIERS.has(name)) {
        return
      }
      collected.add(name)
    },
    MemberExpression(path) {
      const member = path.node
      if (member.computed || member.object.type !== 'ThisExpression' || member.property.type !== 'Identifier') {
        return
      }
      collected.add(member.property.name)
    },
    OptionalMemberExpression(path) {
      const member = path.node
      if (member.computed || member.object.type !== 'ThisExpression' || member.property.type !== 'Identifier') {
        return
      }
      collected.add(member.property.name)
    },
  })

  return collected
}

function collectWithBabel(template: string): string[] {
  const templateExpressions = extractTemplateExpressions(template)
  if (!templateExpressions.length) {
    return []
  }
  const loopAliases = collectLoopScopeAliases(template)
  const keys = new Set<string>()
  for (const expression of templateExpressions) {
    const identifiers = collectIdentifiersFromExpression(expression)
    for (const identifier of identifiers) {
      if (!loopAliases.has(identifier)) {
        keys.add(identifier)
      }
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b))
}

/**
 * 从编译后的 WXML 模板提取渲染相关的顶层 key。
 *
 * 当前实现先保持 Babel 语义稳定，`astEngine` 作为统一入口为后续 Oxc 分析预留。
 */
export function collectSetDataPickKeysFromTemplateCode(
  template: string,
  options?: {
    astEngine?: AstEngineName
  },
): string[] {
  void options
  return collectWithBabel(template)
}
