import type { ForParseResult } from '../types'
import * as t from '@weapp-vite/ast/babelTypes'
import { parseJsLike } from '../../../../../utils/babel'
import { generateExpression } from '../expression/parse'

const IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i
const WHITESPACE_RE = /\s/
export const FOR_ITEM_ALIAS_PLACEHOLDER = '__wv_for_item__'
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
  return out
}
function splitForExpression(exp: string): { source: string, list: string } | null {
  let parenDepth = 0
  let bracketDepth = 0
  let braceDepth = 0
  let quote: '\'' | '"' | '`' | '' = ''
  let escaped = false
  let emptyAliasSplit: { source: string, list: string } | null = null

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

    const keyword = exp.startsWith('in', i)
      ? 'in'
      : exp.startsWith('of', i)
        ? 'of'
        : undefined
    if (
      keyword
      && (i === 0 || WHITESPACE_RE.test(exp[i - 1]!))
      && (i + keyword.length === exp.length || WHITESPACE_RE.test(exp[i + keyword.length]!))
    ) {
      const split = {
        source: exp.slice(0, i).trim(),
        list: exp.slice(i + keyword.length).trim(),
      }
      if (split.source) {
        return split
      }
      emptyAliasSplit = split
    }
  }

  return emptyAliasSplit
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
interface PatternAliasResult {
  aliases: Record<string, string>
  error?: string
  requiresProjection: boolean
}

function collectPatternAliases(
  node: t.LVal | t.PatternLike,
  base: string,
  result: PatternAliasResult,
) {
  if (t.isIdentifier(node)) {
    result.aliases[node.name] = base
    return
  }

  if (t.isAssignmentPattern(node)) {
    result.requiresProjection = true
    collectPatternAliases(node.left as t.LVal, base, result)
    return
  }

  if (t.isRestElement(node)) {
    if (t.isIdentifier(node.argument)) {
      result.aliases[node.argument.name] = base
    }
    return
  }

  if (t.isArrayPattern(node)) {
    node.elements.forEach((element, index) => {
      if (!element) {
        return
      }
      if (t.isRestElement(element)) {
        // 小程序模板表达式不支持 slice；数组剩余元素必须在逻辑层执行。
        result.requiresProjection = true
        collectPatternAliases(element, base, result)
        return
      }
      collectPatternAliases(element as t.LVal, `${base}[${index}]`, result)
    })
    return
  }

  if (!t.isObjectPattern(node)) {
    return
  }

  node.properties.forEach((property) => {
    if (t.isRestElement(property)) {
      result.requiresProjection = true
      collectPatternAliases(property, base, result)
      return
    }
    const nextBase = toMemberAccess(base, property.key, property.computed)
    collectPatternAliases(property.value as t.LVal, nextBase, result)
  })
}

function parseItemAliases(pattern: string): PatternAliasResult {
  const result: PatternAliasResult = {
    aliases: {},
    requiresProjection: false,
  }
  try {
    const ast = parseJsLike(`(${pattern}) => {}`)
    const stmt = ast.program.body[0]
    if (!stmt || stmt.type !== 'ExpressionStatement') {
      return { ...result, error: 'v-for 别名模式无法解析。' }
    }
    const exp = stmt.expression
    if (!t.isArrowFunctionExpression(exp) || exp.params.length !== 1) {
      return { ...result, error: 'v-for 别名模式无法解析。' }
    }
    const patternNode = exp.params[0]
    if (t.isRestElement(patternNode)) {
      return { ...result, error: 'v-for 不支持顶层剩余参数；请在数组或对象解构中使用剩余元素。' }
    }
    collectPatternAliases(patternNode as t.LVal, FOR_ITEM_ALIAS_PLACEHOLDER, result)
    if (result.requiresProjection) {
      result.aliases = Object.fromEntries(
        Object.keys(result.aliases).map(name => [name, `${FOR_ITEM_ALIAS_PLACEHOLDER}.${name}`]),
      )
    }
    return result
  }
  catch {
    return { ...result, error: 'v-for 别名模式无法解析。' }
  }
}
export function parseForExpression(exp: string): ForParseResult {
  const split = splitForExpression(exp.trim())
  if (!split) {
    return { error: 'v-for 表达式必须使用 in 或 of 分隔别名与列表。' }
  }
  if (!split.source) {
    return { error: 'v-for 表达式缺少循环项别名。' }
  }
  if (!split.list) {
    return { error: 'v-for 表达式缺少列表。' }
  }

  const source = stripOuterParentheses(split.source)
  const segments = splitTopLevelByComma(source).filter(Boolean)
  if (segments.length > 3) {
    return {
      listExp: split.list,
      itemPatternError: 'v-for 最多支持 item、key 与 index 三个别名；额外别名无法等价映射到小程序循环作用域。',
    }
  }

  const result: ForParseResult = {
    listExp: split.list,
  }

  const rawItem = segments[0]?.trim()
  if (rawItem) {
    if (isIdentifier(rawItem) && t.isValidIdentifier(rawItem)) {
      result.item = rawItem
    }
    else {
      const parsed = parseItemAliases(rawItem)
      if (parsed.error) {
        result.itemPatternError = parsed.error
      }
      if (Object.keys(parsed.aliases).length) {
        result.item = FOR_ITEM_ALIAS_PLACEHOLDER
        result.itemAliases = parsed.aliases
        if (parsed.requiresProjection) {
          result.itemPattern = rawItem
          result.itemPatternRequiresProjection = true
        }
      }
    }
  }

  if (segments.length === 2) {
    const rawIndex = segments[1]?.trim()
    if (rawIndex && isIdentifier(rawIndex) && t.isValidIdentifier(rawIndex)) {
      result.index = rawIndex
    }
    else {
      result.itemPatternError = 'v-for 第二个别名必须是标识符；解构形式无法等价映射到小程序循环索引。'
    }
  }
  else if (segments.length === 3) {
    const rawKey = segments[1]?.trim()
    const rawIndex = segments[2]?.trim()
    if (rawKey && isIdentifier(rawKey) && t.isValidIdentifier(rawKey) && rawIndex && isIdentifier(rawIndex) && t.isValidIdentifier(rawIndex)) {
      result.key = rawKey
      result.index = rawIndex
    }
    else {
      result.itemPatternError = 'v-for 的 key 与 index 别名必须是标识符；解构形式无法等价映射到小程序循环作用域。'
    }
  }
  if (result.itemPatternRequiresProjection && segments.length === 3) {
    result.itemPatternError = 'v-for 需要逻辑层投影的解构暂不支持同时声明 key 与 index；无法保证不同列表类型上的等价语义。'
  }

  return result
}
