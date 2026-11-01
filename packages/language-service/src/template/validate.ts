import type { LanguageProfile } from '../profiles'
import type { Diagnostic } from '../types'
import type { TemplateAttribute, TemplateTag, TemplateToken } from './types'
import { parse } from '@weapp-vite/ast'
import { collectTemplateExpressions } from './expressions'
import { validateScriptModules } from './modules'

function expressionError(source: string): { offset: number, message: string } | undefined {
  if (!source.trim()) {
    return { offset: 0, message: '插值表达式不能为空' }
  }
  let first: unknown
  for (const [index, wrapped] of [`(${source}\n)`, `({${source}\n})`].entries()) {
    try {
      parse(wrapped, { sourceType: 'script' })
      return undefined
    }
    catch (error) {
      if (index === 0) {
        first = error
      }
    }
  }
  const error = first as { pos?: number, message?: string }
  return { offset: Math.max(0, Math.min(source.length, (error.pos ?? 1) - 1)), message: error.message?.replace(/\s*\(\d+:\d+\)$/, '') ?? '无效的表达式' }
}

function isBindingName(name: string): boolean {
  try {
    const statement = parse(`let ${name};`, { sourceType: 'script' }).program.body[0]
    return statement.type === 'VariableDeclaration' && statement.declarations.length === 1 && statement.declarations[0].id.type === 'Identifier' && statement.declarations[0].id.name === name && !statement.declarations[0].init
  }
  catch {
    return false
  }
}

function validateSwanExpressions(token: TemplateTag, profile: LanguageProfile, report: (code: string, attribute: TemplateAttribute, message: string) => unknown, diagnostics: Diagnostic[]) {
  for (const attribute of token.attributes.filter(attribute => [profile.directives.if, profile.directives.elif, profile.directives.for].includes(attribute.name))) {
    if (attribute.value?.includes('{{')) {
      continue
    }
    let expression = attribute.value ?? ''
    let offset = attribute.valueStart ?? attribute.start
    if (attribute.name === profile.directives.for) {
      const separator = /\s+in\s+/.exec(expression)
      if (separator) {
        const aliases = expression.slice(0, separator.index).split(',').map(name => name.trim())
        if (aliases.length > 2 || aliases.some(name => !isBindingName(name)) || (aliases.length === 2 && aliases[0] === aliases[1])) {
          report('invalid-loop-binding', attribute, 's-for 的循环项和索引必须是不同的有效标识符')
        }
        const start = separator.index + separator[0].length
        expression = expression.slice(start)
        offset += start
      }
    }
    const error = expressionError(expression)
    if (error) {
      const start = offset + error.offset
      diagnostics.push({ code: 'template/invalid-expression', severity: 'error', start, end: Math.min(start + 1, attribute.end), message: error.message })
    }
  }
}

function validateDirectives(source: string, tokens: TemplateToken[], profile: LanguageProfile): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const names = new Set(Object.values(profile.directives))
  const { if: ifName, elif, else: elseName, for: forName, forItem, forIndex } = profile.directives
  const siblings = new Map<number | undefined, { end: number, continues: boolean }>()
  const report = (code: string, attribute: TemplateAttribute, message: string) => diagnostics.push({ code: `template/${code}`, severity: 'error', start: attribute.start, end: attribute.end, message })
  for (const token of tokens) {
    if (token.kind !== 'tag' || token.closing) {
      continue
    }
    const seen = new Set<string>()
    for (const attribute of token.attributes) {
      if (names.has(attribute.name)) {
        if (seen.has(attribute.name)) {
          report('duplicate-directive', attribute, `指令 ${attribute.name} 不能重复`)
        }
        seen.add(attribute.name)
      }
    }
    const conditionals = token.attributes.filter(attribute => [ifName, elif, elseName].includes(attribute.name))
    if (new Set(conditionals.map(attribute => attribute.name)).size > 1) {
      report('conflicting-condition', conditionals[1], '同一元素只能使用一个条件分支指令')
    }
    const conditional = conditionals[0]
    if (conditional && [elif, elseName].includes(conditional.name)) {
      const previous = siblings.get(token.parent)
      const gap = previous ? source.slice(previous.end, token.start).replace(/<!--[\s\S]*?-->/g, '').trim() : undefined
      if (!previous?.continues || gap !== '') {
        report('orphan-condition', conditional, `${conditional.name} 必须紧邻同级的 ${ifName} 或 ${elif}`)
      }
    }
    siblings.set(token.parent, { end: token.matching === undefined ? token.end : tokens[token.matching].end, continues: !!conditional && [ifName, elif].includes(conditional.name) })
    const loop = token.attributes.find(attribute => attribute.name === forName)
    const bindings = token.attributes.filter(attribute => [forItem, forIndex].includes(attribute.name))
    for (const attribute of bindings) {
      if (!isBindingName(attribute.value?.trim() ?? '')) {
        report('invalid-loop-binding', attribute, `${attribute.name} 必须是有效的单个 JavaScript 标识符`)
      }
      if (!loop) {
        report('missing-loop', attribute, `${attribute.name} 需要同一元素上的 ${forName}`)
      }
    }
    const item = bindings.find(attribute => attribute.name === forItem)
    const index = bindings.find(attribute => attribute.name === forIndex)
    if (loop && (item?.value?.trim() || 'item') === (index?.value?.trim() || 'index')) {
      report('duplicate-loop-binding', index ?? item ?? loop, '循环项与索引不能使用同一个标识符')
    }
    if (profile.platform === 'swan') {
      validateSwanExpressions(token, profile, report, diagnostics)
    }
  }
  return diagnostics
}

/** 共用语法校验保留平台指令边界；未知自定义属性和组件不作推测性拒绝。 */
export function validateTemplate(source: string, tokens: TemplateToken[], profile?: LanguageProfile): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  for (const expression of collectTemplateExpressions(source, tokens)) {
    const error = expressionError(expression.source)
    if (error) {
      const start = expression.start + error.offset
      diagnostics.push({ code: 'template/invalid-expression', severity: 'error', start, end: Math.min(start + 1, expression.end), message: error.message })
    }
  }
  if (profile) {
    diagnostics.push(...validateDirectives(source, tokens, profile))
    diagnostics.push(...validateScriptModules(source, tokens, profile))
  }
  return diagnostics
}
