import type { WxmlTransformVisitor } from '../../types'
import type { WxmlSyntax } from '../template/lexical'
import { assertSafeConditionalRemoval, scriptTags } from '../remove/safety'
import { failAt } from '../template/lexical'
import { applySourceEdits } from '../template/ranges'
import { scanTemplate } from '../template/scan'
import { indexElementTree } from '../template/tree'
import { createLocator } from './encoding'
import { createEditableNode } from './node'
import { createTraversal } from './traversal'

/** 以一次扫描建立编辑会话；删除父节点后不再访问其子树。 */
export async function editWxml(code: string, fileName: string, syntax: WxmlSyntax, visitor: WxmlTransformVisitor): Promise<string> {
  if (typeof code !== 'string' || typeof visitor !== 'function') {
    throw new TypeError('edit expects template source and a visitor function.')
  }
  const { elements } = scanTemplate(code, fileName, scriptTags, false, syntax)
  const state = { active: true, code, fileName, syntax, locate: createLocator(code) }
  const editors = new Map<typeof elements[number], ReturnType<typeof createEditableNode>>()
  const tree = indexElementTree(elements)
  const traversal = createTraversal(elements, tree, element => editors.get(element)!.handle, (element, message) => failAt(code, fileName, element.start, message), () => state.active)
  for (const element of elements) {
    const children = () => element.removed ? [] : tree.children(element).filter(child => !child.removed)
    editors.set(element, createEditableNode(state, element, {
      children: () => Object.freeze(children().map(child => editors.get(child)!.handle)),
      childInfo: () => Object.freeze(children().map(child => editors.get(child)!.info)),
      assertActive: () => {
        traversal.assertActive(element)
      },
      walk: visitor => traversal.walk(element, visitor),
      skipChildren: () => traversal.skipChildren(element),
      remove: () => traversal.remove(element),
    }, element.parent ? editors.get(element.parent)!.info : undefined))
  }
  try {
    await traversal.visit(visitor)
    assertSafeConditionalRemoval(code, fileName, elements)
    return applySourceEdits(code, [...editors.values()].flatMap(editor => editor.edits()))
  }
  finally {
    state.active = false
    traversal.close()
  }
}
