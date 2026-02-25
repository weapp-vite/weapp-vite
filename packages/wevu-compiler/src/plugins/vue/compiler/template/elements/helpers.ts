import type { DirectiveNode, ElementNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext } from '../types'
import * as t from '@babel/types'
import { NodeTypes } from '@vue/compiler-core'
import { parseJsLike } from '../../../../../utils/babel'
import { generateExpression } from '../expression/parse'

const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i
export const FOR_ITEM_ALIAS_PLACEHOLDER = '__wv_for_item__'

export function isStructuralDirective(node: ElementNode): {
  type: 'if' | 'for' | null
  directive: DirectiveNode | undefined
} {
  // 检查 v-if、v-else-if、v-else、v-for
  for (const prop of node.props) {
    if (prop.type === NodeTypes.DIRECTIVE) {
      if (prop.name === 'if' || prop.name === 'else-if' || prop.name === 'else') {
        return { type: 'if', directive: prop }
      }
      if (prop.name === 'for') {
        return { type: 'for', directive: prop }
      }
    }
  }
  return { type: null, directive: undefined }
}

export function pushScope(context: TransformContext, names: string[]) {
  if (!names.length) {
    return
  }
  context.scopeStack.push(new Set(names))
}

export function popScope(context: TransformContext) {
  if (context.scopeStack.length) {
    context.scopeStack.pop()
  }
}

export function pushForScope(context: TransformContext, info: ForParseResult) {
  if (!info.listExp) {
    return
  }
  context.forStack.push({ ...info })
}

export function popForScope(context: TransformContext) {
  if (context.forStack.length) {
    context.forStack.pop()
  }
}

export function withForScope<T>(context: TransformContext, info: ForParseResult, fn: () => T): T {
  pushForScope(context, info)
  try {
    return fn()
  }
  finally {
    popForScope(context)
  }
}

export function pushSlotProps(context: TransformContext, mapping: Record<string, string>) {
  if (!Object.keys(mapping).length) {
    return
  }
  context.slotPropStack.push(mapping)
}

export function popSlotProps(context: TransformContext) {
  if (context.slotPropStack.length) {
    context.slotPropStack.pop()
  }
}

export function withScope<T>(context: TransformContext, names: string[], fn: () => T): T {
  pushScope(context, names)
  try {
    return fn()
  }
  finally {
    popScope(context)
  }
}

export function withSlotProps<T>(context: TransformContext, mapping: Record<string, string>, fn: () => T): T {
  pushSlotProps(context, mapping)
  try {
    return fn()
  }
  finally {
    popSlotProps(context)
  }
}

export function collectScopePropMapping(context: TransformContext): Record<string, string> {
  const mapping: Record<string, string> = {}
  if (!context.slotMultipleInstance) {
    return mapping
  }
  for (const scope of context.scopeStack) {
    for (const name of scope) {
      if (!/^[A-Z_$][\w$]*$/i.test(name)) {
        continue
      }
      if (!Object.prototype.hasOwnProperty.call(mapping, name)) {
        mapping[name] = name
      }
    }
  }
  return mapping
}

export function buildScopePropsExpression(context: TransformContext): string | null {
  const mapping = collectScopePropMapping(context)
  const keys = Object.keys(mapping)
  if (!keys.length) {
    return null
  }
  return `[${keys.map(key => `${toWxmlStringLiteral(key)},${key}`).join(',')}]`
}

export function toWxmlStringLiteral(value: string) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  return `'${escaped}'`
}

export function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

export function isScopedSlotsDisabled(context: TransformContext) {
  return context.scopedSlotsCompiler === 'off'
}

export function findSlotDirective(node: ElementNode): DirectiveNode | undefined {
  return node.props.find(
    prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'slot',
  ) as DirectiveNode | undefined
}

function isIdentifier(value: string) {
  return IDENTIFIER_RE.test(value)
}

function splitTopLevelByComma(input: string): string[] {
  const out: string[] = []
  let start = 0
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let quote: '\'' | '"' | '`' | '' = ''
  let escaped = false

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === quote) {
        quote = ''
      }
      continue
    }

    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch
      continue
    }

    if (ch === '(') {
      parenDepth += 1
      continue
    }
    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1)
      continue
    }
    if (ch === '[') {
      bracketDepth += 1
      continue
    }
    if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1)
      continue
    }
    if (ch === '{') {
      braceDepth += 1
      continue
    }
    if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1)
      continue
    }

    if (ch === ',' && parenDepth === 0 && bracketDepth === 0 && braceDepth === 0) {
      out.push(input.slice(start, i).trim())
      start = i + 1
    }
  }

  out.push(input.slice(start).trim())
  return out.filter(Boolean)
}

function splitForExpression(exp: string): { source: string, list: string } | null {
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let quote: '\'' | '"' | '`' | '' = ''
  let escaped = false

  for (let i = 0; i < exp.length; i += 1) {
    const ch = exp[i]

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === quote) {
        quote = ''
      }
      continue
    }

    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch
      continue
    }

    if (ch === '(') {
      parenDepth += 1
      continue
    }
    if (ch === ')') {
      parenDepth = Math.max(0, parenDepth - 1)
      continue
    }
    if (ch === '[') {
      bracketDepth += 1
      continue
    }
    if (ch === ']') {
      bracketDepth = Math.max(0, bracketDepth - 1)
      continue
    }
    if (ch === '{') {
      braceDepth += 1
      continue
    }
    if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1)
      continue
    }

    if (parenDepth !== 0 || bracketDepth !== 0 || braceDepth !== 0) {
      continue
    }

    if (exp.startsWith(' in ', i) || exp.startsWith(' of ', i)) {
      return {
        source: exp.slice(0, i).trim(),
        list: exp.slice(i + 4).trim(),
      }
    }
  }

  return null
}

function stripOuterParentheses(value: string): string {
  const trimmed = value.trim()
  if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
    return trimmed
  }

  let depth = 0
  for (let i = 0; i < trimmed.length; i += 1) {
    const ch = trimmed[i]
    if (ch === '(') {
      depth += 1
    }
    else if (ch === ')') {
      depth -= 1
      if (depth === 0 && i !== trimmed.length - 1) {
        return trimmed
      }
    }
  }

  return trimmed.slice(1, -1).trim()
}

function toMemberAccess(base: string, property: t.ObjectProperty['key'], computed: boolean): string {
  if (!computed) {
    if (t.isIdentifier(property) && isIdentifier(property.name)) {
      return `${base}.${property.name}`
    }
    if (t.isStringLiteral(property)) {
      return `${base}[${JSON.stringify(property.value)}]`
    }
  }
  if (t.isExpression(property)) {
    return `${base}[${generateExpression(property)}]`
  }
  return base
}

function collectPatternAliases(
  node: t.LVal | t.PatternLike,
  base: string,
  aliases: Record<string, string>,
) {
  if (t.isIdentifier(node)) {
    aliases[node.name] = base
    return
  }

  if (t.isAssignmentPattern(node)) {
    collectPatternAliases(node.left as t.LVal, base, aliases)
    return
  }

  if (t.isRestElement(node)) {
    if (t.isIdentifier(node.argument)) {
      aliases[node.argument.name] = base
    }
    return
  }

  if (t.isArrayPattern(node)) {
    node.elements.forEach((element, index) => {
      if (!element) {
        return
      }
      if (t.isRestElement(element)) {
        collectPatternAliases(element, `${base}.slice(${index})`, aliases)
        return
      }
      collectPatternAliases(element as t.LVal, `${base}[${index}]`, aliases)
    })
    return
  }

  if (!t.isObjectPattern(node)) {
    return
  }

  node.properties.forEach((property) => {
    if (t.isRestElement(property)) {
      if (t.isIdentifier(property.argument)) {
        aliases[property.argument.name] = base
      }
      return
    }
    const nextBase = toMemberAccess(base, property.key, property.computed)
    collectPatternAliases(property.value as t.LVal, nextBase, aliases)
  })
}

function parseItemAliases(pattern: string): Record<string, string> {
  try {
    const ast = parseJsLike(`(${pattern}) => {}`)
    const stmt = ast.program.body[0]
    if (!stmt || stmt.type !== 'ExpressionStatement') {
      return {}
    }
    const exp = stmt.expression
    if (!t.isArrowFunctionExpression(exp) || exp.params.length !== 1) {
      return {}
    }
    const aliases: Record<string, string> = {}
    collectPatternAliases(exp.params[0] as t.LVal, FOR_ITEM_ALIAS_PLACEHOLDER, aliases)
    return aliases
  }
  catch {
    return {}
  }
}

export function parseForExpression(exp: string): ForParseResult {
  const split = splitForExpression(exp.trim())
  if (!split) {
    return {}
  }

  const source = stripOuterParentheses(split.source)
  const segments = splitTopLevelByComma(source)
  if (!segments.length || segments.length > 3) {
    return { listExp: split.list }
  }

  const result: ForParseResult = {
    listExp: split.list,
  }

  const rawItem = segments[0]?.trim()
  if (rawItem) {
    if (isIdentifier(rawItem)) {
      result.item = rawItem
    }
    else {
      const aliases = parseItemAliases(rawItem)
      if (Object.keys(aliases).length) {
        result.item = FOR_ITEM_ALIAS_PLACEHOLDER
        result.itemAliases = aliases
      }
    }
  }

  if (segments.length === 2) {
    const rawIndex = segments[1]?.trim()
    if (rawIndex && isIdentifier(rawIndex)) {
      result.index = rawIndex
    }
  }
  else if (segments.length === 3) {
    const rawKey = segments[1]?.trim()
    const rawIndex = segments[2]?.trim()
    if (rawKey && isIdentifier(rawKey)) {
      result.key = rawKey
    }
    if (rawIndex && isIdentifier(rawIndex)) {
      result.index = rawIndex
    }
  }

  return result
}
