import type { Document, EditVisitor } from '../types'
import type { EditSession } from './state'
import { copyDocument, createPatchedDocument } from './document'
import { EditableHandle } from './node'
import { parseRawEdits } from './raw'
import { parseCompleteEdits } from './snippets'
import { assertValid } from './state'

/** 同步编辑会话验证变更词法后发布新文档，原始文档保持不变。 */
export function edit(document: Document, visitor: EditVisitor): Document {
  assertValid(document)
  if (typeof visitor !== 'function') {
    throw new TypeError('Expected a synchronous WXML edit visitor.')
  }
  const session: EditSession = { document, active: true, hasStructuralInvalidations: false, edits: new Map() }
  const stack = document.children.map(node => new EditableHandle(session, node)).reverse()
  try {
    while (stack.length) {
      const handle = stack.pop()!
      if (session.hasStructuralInvalidations && handle.isInvalidated()) {
        continue
      }
      const { node } = handle
      const result: unknown = visitor(handle)
      if (result !== null && (typeof result === 'object' || typeof result === 'function')
        && typeof (result as { then?: unknown }).then === 'function') {
        // 已启动的异步函数可能在句柄失效后拒绝，显式收尾以免遗留未处理异常。
        void Promise.resolve(result).catch(() => {})
        throw new TypeError('WXML edit visitors must be synchronous; Promise results are not supported.')
      }
      if (result === false || node.kind !== 'element'
        || (session.hasStructuralInvalidations && handle.isInvalidated())) {
        continue
      }
      for (let index = node.children.length - 1; index >= 0; index--) {
        const child = node.children[index]!
        stack.push(new EditableHandle(session, child, handle))
      }
    }
    // 访问器结束即冻结私有修改，后续 resolver 校验不能重新开启编辑会话。
    session.active = false
    if (!session.edits.size) {
      return copyDocument(document)
    }
    const next = session.rawOwners?.size
      ? parseRawEdits(session)
      : createPatchedDocument(session) ?? parseCompleteEdits(session)
    assertValid(next)
    return next
  }
  finally {
    session.active = false
    session.edits.clear()
    session.rawOwners?.clear()
  }
}
