import type { Attribute, Diagnostic, Document, ElementNode, InterpolationRecovery, Node, ParseOptions } from '@weapp-vite/wxml'
import type { TemplateInputOptions } from './templateInput'
import { getMiniProgramPlatformDescriptor, getMiniProgramScriptModuleOptions } from '@weapp-core/shared/platforms'
import { decodeAttribute, parse } from '@weapp-vite/wxml'

export type SharedTemplateParseOptions = TemplateInputOptions

interface RecoveredInterpolation extends InterpolationRecovery {
  readonly diagnostic: Diagnostic
}

export interface SharedTemplateDocument {
  readonly document: Document
  readonly source: string
  readonly recoveries: readonly RecoveredInterpolation[]
}

function templateError(diagnostic: Diagnostic) {
  return new Error(`[web] ${diagnostic.start}: ${diagnostic.message}`)
}

function resolveOptions(options: SharedTemplateParseOptions): ParseOptions {
  const platform = options.platform ?? 'weapp'
  const scriptTag = platform === 'qq' ? 'wxs' : platform === 'ks' ? 'ks' : getMiniProgramScriptModuleOptions(platform, getMiniProgramPlatformDescriptor(platform).outputExtensions.wxs).tag
  const syntax = options.syntax ?? (options.platform === 'weapp' ? 'legacy' : 'xml')
  return { platform, syntax, rawTags: options.rawTags ?? [scriptTag, 'script'] }
}

function acceptRecovery(source: string, diagnostic: Diagnostic, known: readonly RecoveredInterpolation[]): RecoveredInterpolation {
  const range = diagnostic.recovery
  if (diagnostic.code !== 'template/invalid-interpolation' || range?.kind !== 'interpolation'
    || !Number.isInteger(range.start) || !Number.isInteger(range.end)
    || range.start < 0 || range.end > source.length || range.end - range.start < 4
    || !source.startsWith('{{', range.start) || !source.startsWith('}}', range.end - 2)
    || known.some(previous => previous.start < range.end && range.start < previous.end)) {
    throw templateError(diagnostic)
  }
  return { ...range, diagnostic }
}

function verifyRecoveryContexts(document: Document, recoveries: readonly RecoveredInterpolation[]) {
  const remaining = new Set(recoveries)
  const pending = [...document.children]
  while (pending.length && remaining.size) {
    const node = pending.pop()!
    const ranges = node.kind === 'element'
      ? node.attributes.map(attribute => ({ start: attribute.valueStart, end: attribute.valueEnd }))
      : node.kind === 'text' ? [node] : []
    for (const range of ranges) {
      const { start, end } = range
      if (start === undefined || end === undefined) {
        continue
      }
      for (const recovery of remaining) {
        if (start <= recovery.start && recovery.end <= end) {
          remaining.delete(recovery)
        }
      }
    }
    if (node.kind === 'element') {
      for (const child of node.children) {
        pending.push(child)
      }
    }
  }
  if (remaining.size) {
    throw templateError(remaining.values().next().value!.diagnostic)
  }
}

/** 正常源码只解析一次；仅用明确插值范围建立等长错误消费视图。 */
export function parseSharedTemplateDocument(source: string, options: SharedTemplateParseOptions = {}): SharedTemplateDocument {
  const profile = resolveOptions(options)
  const recoveries: RecoveredInterpolation[] = []
  let view = source
  let document = parse(view, profile)
  while (true) {
    const errors = document.diagnostics.filter(diagnostic => diagnostic.severity === 'error')
    if (!errors.length) {
      if (recoveries.length) {
        verifyRecoveryContexts(document, recoveries)
      }
      return { document, source, recoveries }
    }
    for (const diagnostic of errors) {
      const recovery = acceptRecovery(source, diagnostic, recoveries)
      recoveries.push(recovery)
      view = view.slice(0, recovery.start) + 'x'.repeat(recovery.end - recovery.start) + view.slice(recovery.end)
    }
    document = parse(view, profile)
  }
}

/** 使用原始 UTF-16 范围恢复文本，再按普通文本或脚本语义消费。 */
export function readSharedTemplateText(parsed: SharedTemplateDocument, node: Exclude<Node, ElementNode>) {
  const value = parsed.source.slice(node.start, node.end)
  return node.kind === 'text' ? decodeAttribute(value, 'xml') : value
}

function readAttribute(parsed: SharedTemplateDocument, attribute: Attribute) {
  if (attribute.valueStart === undefined || attribute.valueEnd === undefined) {
    return ''
  }
  const { source, document, recoveries } = parsed
  const value = source.slice(attribute.valueStart, attribute.valueEnd)
  const syntax = document.syntax
  if (syntax !== 'legacy' || !recoveries.length) {
    return decodeAttribute(value, syntax, true, attribute.quote)
  }
  const contained = recoveries.filter(range => attribute.valueStart! <= range.start && range.end <= attribute.valueEnd!)
    .sort((left, right) => left.start - right.start)
  if (!contained.length) {
    return decodeAttribute(value, syntax, true, attribute.quote)
  }
  let decoded = ''
  let offset = attribute.valueStart
  for (const range of contained) {
    decoded += decodeAttribute(source.slice(offset, range.start), 'legacy', true, attribute.quote)
    decoded += decodeAttribute(source.slice(range.start, range.end), 'legacy', false, attribute.quote)
    offset = range.end
  }
  decoded += decodeAttribute(source.slice(offset, attribute.valueEnd), 'legacy', true, attribute.quote)
  return decoded
}

/** 属性只在 Web 消费边界解码一次，保留原型形状键与重复属性首值。 */
export function readSharedTemplateAttributes(parsed: SharedTemplateDocument, node: ElementNode): Record<string, string> {
  const attribs: Record<string, string> = Object.create(null)
  for (const attribute of node.attributes) {
    if (!Object.hasOwn(attribs, attribute.name)) {
      attribs[attribute.name] = readAttribute(parsed, attribute)
    }
  }
  return attribs
}
