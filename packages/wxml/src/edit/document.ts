import type { DocumentContext } from '../documentContext'
import type { ElementNode, Node, TemplateDocument } from '../types'
import type { CanonicalElement } from './overlay'
import type { EditSession } from './state'
import { bindDocument, contextFor, createDocument, parseContext } from '../documentContext'
import { assertExpressionBoundary } from '../encoding'
import { TemplateLexicalError } from '../lexical'
import { readTag } from '../tag'
import { editedAttributes } from './attributes'
import { openingTag, renderEdits } from './output'
import { editOverlays } from './overlay'
import { assertValid } from './state'

/** 只投影公开文档字段，兼容使用原型 getter 的延迟文档与普通解析结果。 */
export function copyDocument(document: TemplateDocument, context = contextFor(document)): TemplateDocument {
  if (context) {
    return createDocument(document.source, document, context)
  }
  return { source: document.source, syntax: document.syntax, tokens: document.tokens, diagnostics: document.diagnostics, children: document.children }
}

/** 延迟状态由实例独占，getter 与物化方法共享原型，避免每次编辑分配访问器闭包。 */
class PatchedDocument implements TemplateDocument {
  readonly syntax: TemplateDocument['syntax']
  readonly diagnostics: TemplateDocument['diagnostics'] = []
  #snapshot: EditSession | undefined
  #context: DocumentContext
  #sourceValue: string | undefined
  #materialized: TemplateDocument | undefined

  constructor(original: TemplateDocument, snapshot: EditSession) {
    const context = this.#context = snapshot.context
    if (context.metadata) {
      Object.assign(this, context.metadata)
    }
    this.syntax = original.syntax
    this.#snapshot = snapshot
  }

  get source() {
    if (this.#sourceValue === undefined) {
      this.#sourceValue = renderEdits(this.#snapshot!)
      this.#snapshot = undefined
    }
    return this.#sourceValue
  }

  get children() {
    return this.#readDocument().children
  }

  get tokens() {
    return this.#readDocument().tokens
  }

  toJSON() {
    return copyDocument(this, this.#context)
  }

  #readDocument() {
    if (!this.#materialized) {
      const document = parseContext(this.source, this.#context)
      assertValid(document)
      this.#materialized = document
      editOverlays.delete(this)
    }
    return this.#materialized
  }
}

/** 结构不变的受控修改只验证改动词法，公开 AST 与范围首次读取时统一重建。 */
export function createPatchedDocument(session: EditSession): TemplateDocument | undefined {
  const { document: original, context } = session
  if (session.hasStructuralInvalidations || context.resolveScriptBoundary || original.diagnostics.length) {
    return undefined
  }
  const elements = new Map<ElementNode, CanonicalElement>()
  const text = new Map<Node, string>()
  for (const [node, state] of session.edits) {
    if (state.removed || state.before?.length || state.after?.length || state.prepend?.length || state.append?.length) {
      return undefined
    }
    if (node.kind === 'element') {
      if (state.replacement !== undefined || (state.name && state.name !== node.name
        && context.dialect.rawTags.some(name => name.toLowerCase() === node.name.toLowerCase() || name.toLowerCase() === state.name!.toLowerCase()))) {
        return undefined
      }
      if (!state.unvalidatedAttributes?.size) {
        elements.set(node, { name: state.name ?? node.name, attributes: editedAttributes(node, state) })
        continue
      }
      const source = openingTag(session, node, state, false)
      try {
        const opening = readTag(source, 0, original.syntax)
        if (opening.end !== source.length || opening.selfClosing !== node.selfClosing) {
          return undefined
        }
        elements.set(node, opening)
      }
      catch (error) {
        if (!(error instanceof TemplateLexicalError)) {
          throw error
        }
        throw new TypeError(`Invalid WXML document: ${error.message}`)
      }
    }
    else if (state.replacement !== undefined) {
      if (node.kind !== 'text' || typeof state.replacement !== 'string') {
        return undefined
      }
      if (state.literalText && state.replacement) {
        text.set(node, state.replacement)
        continue
      }
      if (state.literalText === false) {
        assertExpressionBoundary(state.replacement, original.syntax)
      }
      const replacement = parseContext(state.replacement, context)
      assertValid(replacement)
      if (replacement.children.length !== 1 || replacement.children[0]?.kind !== 'text') {
        return undefined
      }
      text.set(node, state.replacement)
    }
  }
  const snapshot: EditSession = {
    document: original,
    context,
    active: false,
    hasStructuralInvalidations: session.hasStructuralInvalidations,
    // 会话关闭后句柄全部失效，私有修改状态不再变化；仅复制 teardown 会清空的归属容器。
    edits: new Map(session.edits),
  }
  const document = new PatchedDocument(original, snapshot)
  bindDocument(document, context)
  editOverlays.set(document, { original, elements, text })
  return document
}
