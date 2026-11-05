import type { Document, EditVisitor, TemplateDocument } from './types'
import { bindDocument, contextFor, requireContext } from './documentContext'
import { editWithContext } from './edit'
import { compatibilityContext } from './options'

/** 旧结构化文档按原选项恢复上下文，核心文档须保留所属解析器关联。 */
export function edit(document: Document, visitor: EditVisitor): Document
export function edit(document: TemplateDocument, visitor: EditVisitor): TemplateDocument
export function edit(document: TemplateDocument, visitor: EditVisitor): TemplateDocument {
  let context = contextFor(document)
  if (!context && 'platform' in document && 'options' in document) {
    const legacy = document as Document
    context = compatibilityContext(legacy.options)
    bindDocument(document, context)
  }
  return editWithContext(document, visitor, context ?? requireContext(document))
}
