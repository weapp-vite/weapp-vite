import type { WxmlTransformVisitor } from '../../types'
import type { WxmlSyntax } from '../template/lexical'
import type { Element } from '../template/scan'
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
  let locator: ReturnType<typeof createLocator> | undefined
  const state = { active: true, code, fileName, syntax, locate: (offset: number) => (locator ??= createLocator(code))(offset) }
  const editors = new Map<typeof elements[number], ReturnType<typeof createEditableNode>>()
  const tree = indexElementTree(elements)
  // eslint-disable-next-line ts/no-use-before-define -- 节点按需工厂与遍历共享会话，实际调用发生在两者初始化之后。
  const traversal = createTraversal(elements, tree, element => getEditor(element).handle, (element, message) => failAt(code, fileName, element.start, message), () => state.active)
  function getEditor(element: Element): ReturnType<typeof createEditableNode> {
    const known = editors.get(element)
    if (known) {
      return known
    }
    const children = () => element.removed ? [] : tree.children(element).filter(child => !child.removed)
    const editor = createEditableNode(state, element, {
      children: () => Object.freeze(children().map(child => getEditor(child).handle)),
      childInfo: () => Object.freeze(children().map(child => getEditor(child).info)),
      parent: () => element.parent ? getEditor(element.parent).info : undefined,
      assertActive: () => {
        traversal.assertActive(element)
      },
      walk: visitor => traversal.walk(element, visitor),
      skipChildren: () => traversal.skipChildren(element),
      remove: () => traversal.remove(element),
    })
    editors.set(element, editor)
    return editor
  }
  try {
    await traversal.visit(visitor)
    if (traversal.hasRemovals()) {
      assertSafeConditionalRemoval(code, fileName, elements)
    }
    return applySourceEdits(code, [...editors.values()].flatMap(editor => editor.edits()))
  }
  finally {
    state.active = false
    traversal.close()
  }
}
