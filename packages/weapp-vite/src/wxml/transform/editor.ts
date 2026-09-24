import type { WxmlTransformVisitor } from '../../types'
import type { WxmlSyntax } from '../template/lexical'
import { assertSafeConditionalRemoval, scriptTags } from '../remove/safety'
import { applySourceEdits } from '../template/ranges'
import { scanTemplate } from '../template/scan'
import { createLocator } from './encoding'
import { createEditableNode } from './node'

/** 以一次扫描建立编辑会话；删除父节点后不再访问其子树。 */
export async function editWxml(code: string, fileName: string, syntax: WxmlSyntax, visitor: WxmlTransformVisitor): Promise<string> {
  if (typeof code !== 'string' || typeof visitor !== 'function') {
    throw new TypeError('edit expects template source and a visitor function.')
  }
  const { elements } = scanTemplate(code, fileName, scriptTags, false, syntax)
  const state = { active: true, code, fileName, syntax, locate: createLocator(code) }
  const editors = new Map<typeof elements[number], ReturnType<typeof createEditableNode>>()
  try {
    for (const element of elements) {
      if (element.parent?.removed) {
        element.removed = true
        continue
      }
      const editor = createEditableNode(state, element, element.parent ? editors.get(element.parent)?.info : undefined)
      editors.set(element, editor)
      await visitor(editor.handle)
    }
    assertSafeConditionalRemoval(code, fileName, elements)
    return applySourceEdits(code, [...editors.values()].flatMap(editor => editor.edits()))
  }
  finally {
    state.active = false
  }
}
