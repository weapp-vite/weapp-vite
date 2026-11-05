import type { Document, EditVisitor, EditVisitors, TemplateDocument } from './types'
import { bindDocument, contextFor, requireContext } from './documentContext'
import { editWithContext } from './edit'
import { compatibilityContext } from './options'

/** 旧结构化文档按原选项恢复上下文，核心文档须保留所属解析器关联。 */
export function edit(document: Document, visitor: EditVisitor): Document
export function edit(document: TemplateDocument, visitor: EditVisitor): TemplateDocument
export function edit(document: Document, visitors: EditVisitors): Document
export function edit(document: TemplateDocument, visitors: EditVisitors): TemplateDocument
export function edit<State>(document: Document, visitors: EditVisitors<State>, state: State): Document
export function edit<State>(document: TemplateDocument, visitors: EditVisitors<State>, state: State): TemplateDocument
export function edit<State>(document: TemplateDocument, visitor: EditVisitor | EditVisitors<State>, state?: State): TemplateDocument {
  let context = contextFor(document)
  if (!context && 'platform' in document && 'options' in document) {
    const legacy = document as Document
    context = compatibilityContext(legacy.options)
    bindDocument(document, context)
  }
  return editWithContext(document, visitor, context ?? requireContext(document), state)
}
