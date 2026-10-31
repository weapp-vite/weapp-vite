import type { SourceEdit } from '../types'
import type { TemplateFormatOptions, TemplateFormatResult, TemplateTag, TemplateToken } from './types'
import { resolveLanguageProfile } from '../profiles'
import { LanguageError } from '../types'
import { scanTemplate } from './scanner'
import { validateTemplate } from './validate'

function identity(source: string, token: TemplateToken) {
  return token.kind === 'tag'
    ? { kind: token.kind, name: token.name, closing: token.closing, selfClosing: token.selfClosing, attributes: token.attributes.map(attribute => ({ name: attribute.name, rawValue: attribute.rawValue })) }
    : { kind: token.kind, source: source.slice(token.start, token.end) }
}

function formatTag(source: string, tag: TemplateTag, options: TemplateFormatOptions, linePrefix: string) {
  if (tag.closing) {
    return `</${tag.name}>`
  }
  const ending = tag.selfClosing ? ' />' : '>'
  const attributes = tag.attributes.map(attribute => attribute.rawValue === undefined ? attribute.name : `${attribute.name}=${attribute.rawValue}`)
  const flat = `<${tag.name}${attributes.length ? ` ${attributes.join(' ')}` : ''}${ending}`
  const indentation = /^[\t ]*$/.test(linePrefix) ? linePrefix : ''
  const wrap = attributes.length > 0 && ((options.singleAttributePerLine && attributes.length > 1) || attributes.length >= (options.wrapAttributes ?? Number.POSITIVE_INFINITY) || linePrefix.length + flat.length > (options.printWidth ?? 80) || attributes.some(attribute => /[\r\n]/.test(attribute)))
  if (!wrap) {
    return flat
  }
  const indent = options.indent ?? (options.useTabs ? '\t' : ' '.repeat(options.tabWidth ?? 2))
  const newline = options.endOfLine === 'crlf' ? '\r\n' : options.endOfLine === 'cr' ? '\r' : options.endOfLine === 'lf' ? '\n' : source.includes('\r\n') ? '\r\n' : '\n'
  const lines = [`<${tag.name}`, ...attributes.map(attribute => `${indentation}${indent}${attribute}`)]
  if (options.bracketSameLine) {
    lines[lines.length - 1] += ending
  }
  else {
    lines.push(`${indentation}${ending.trimStart()}`)
  }
  return lines.join(newline)
}

/** 编辑范围引用原始文档 UTF-16 偏移；无效输入只返回原文及诊断，编辑列表为空。 */
export function formatTemplateResult(source: string, fileName = 'component.wxml', options: TemplateFormatOptions = {}): TemplateFormatResult {
  const scanned = scanTemplate(source)
  scanned.diagnostics.push(...validateTemplate(source, scanned.tokens, resolveLanguageProfile(fileName, options)))
  if (scanned.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
    return { code: source, changed: false, edits: [], diagnostics: scanned.diagnostics }
  }
  const edits: SourceEdit[] = []
  let linePrefix = ''
  const formatted = scanned.tokens.map((token) => {
    const segment = token.kind === 'tag' ? formatTag(source, token, options, linePrefix) : source.slice(token.start, token.end)
    if (token.kind === 'tag' && segment !== source.slice(token.start, token.end)) {
      edits.push({ start: token.start, end: token.end, newText: segment })
    }
    const lastBreak = Math.max(segment.lastIndexOf('\n'), segment.lastIndexOf('\r'))
    linePrefix = lastBreak < 0 ? linePrefix + segment : segment.slice(lastBreak + 1)
    return segment
  }).join('')
  const output = scanTemplate(formatted)
  if (output.diagnostics.length || JSON.stringify(scanned.tokens.map(token => identity(source, token))) !== JSON.stringify(output.tokens.map(token => identity(formatted, token)))) {
    return { code: source, changed: false, edits: [], diagnostics: [{ code: 'template/unsafe-format', severity: 'error', start: 0, end: source.length, message: '格式化改变了受保护的模板结构或文本，拒绝修改' }] }
  }
  return { code: formatted, changed: formatted !== source, edits, diagnostics: scanned.diagnostics }
}

/** 仅修改标签布局；文本、插值、属性值和内联脚本逐字保留，失败时不返回可写结果。 */
export function formatTemplate(source: string, fileName = 'component.wxml', options: TemplateFormatOptions = {}): string {
  const result = formatTemplateResult(source, fileName, options)
  if (result.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
    throw new LanguageError(fileName, result.diagnostics)
  }
  return result.code
}
