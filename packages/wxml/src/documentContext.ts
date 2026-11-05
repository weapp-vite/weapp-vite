import type { CompiledState } from './dialect'
import type { CompiledDialect, ParseOptions, TemplateDocument } from './types'
import { scanCompiledDocument } from './scannerCore'

export type DocumentFields = Omit<TemplateDocument, 'source'>

export interface DocumentContext {
  readonly dialect: CompiledDialect
  readonly state: CompiledState
  readonly resolveScriptBoundary?: ParseOptions['resolveScriptBoundary']
  readonly metadata?: object
  readonly createDocument?: (source: string, fields: DocumentFields) => TemplateDocument
}

const contexts = new WeakMap<TemplateDocument, DocumentContext>()

/** 配置属于解析器，文档仅保存弱关联；编辑延续同一个不可变上下文。 */
export function bindDocument(document: TemplateDocument, context: DocumentContext): TemplateDocument {
  contexts.set(document, context)
  return document
}

export function contextFor(document: TemplateDocument) {
  return contexts.get(document)
}

export function requireContext(document: TemplateDocument): DocumentContext {
  const context = contexts.get(document)
  if (!context) {
    throw new TypeError('This template document has no parser context; parse its source with a selected parser before editing.')
  }
  return context
}

/** 文档构造由所属上下文负责，核心仅创建通用字段并绑定完整结果。 */
export function createDocument(source: string, fields: DocumentFields, context: DocumentContext): TemplateDocument {
  const document = context.createDocument
    ? context.createDocument(source, fields)
    : { source, syntax: fields.syntax, tokens: fields.tokens, diagnostics: fields.diagnostics, children: fields.children }
  return bindDocument(document, context)
}

/** 完整解析复用绑定方言与文档工厂，不为每份源码建立闭包。 */
export function parseContext<Result extends TemplateDocument>(source: string, context: DocumentContext & { readonly createDocument: (source: string, fields: DocumentFields) => Result }): Result
export function parseContext(source: string, context: DocumentContext): TemplateDocument
export function parseContext(source: string, context: DocumentContext): TemplateDocument {
  const result = scanCompiledDocument(source, context.state, context.resolveScriptBoundary, true)
  return createDocument(source, result, context)
}
