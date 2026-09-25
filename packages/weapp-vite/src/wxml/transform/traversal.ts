import type { WxmlTransformNode, WxmlTransformVisitor } from '../../types'
import type { Element } from '../template/scan'
import type { indexElementTree } from '../template/tree'
import { AsyncLocalStorage } from 'node:async_hooks'

interface VisitFrame {
  node: Element
  active: boolean
  skipped: boolean
  walking: boolean
}

/** 回调拥有独立遍历帧；嵌套 walk 不改变外层跳过状态。 */
export function createTraversal(
  elements: readonly Element[],
  tree: ReturnType<typeof indexElementTree>,
  handle: (element: Element) => WxmlTransformNode,
  fail: (element: Element, message: string) => never,
  isActive: () => boolean,
) {
  const frames = new AsyncLocalStorage<VisitFrame>()
  let hasRemovals = false
  const assertActive = (element: Element) => {
    const frame = frames.getStore()
    if (!isActive() || element.removed || !frame?.active) {
      fail(element, 'This template node is no longer editable.')
    }
    if (frame.walking) {
      fail(element, 'Await node.walk before continuing this visitor; concurrent editing is not supported.')
    }
    return frame!
  }
  const visit = async (start: number, end: number, visitor: WxmlTransformVisitor) => {
    for (let index = start; index < end;) {
      const node = elements[index]!
      if (node.removed) {
        index = tree.end(node)
        continue
      }
      const frame: VisitFrame = { node, active: true, skipped: false, walking: false }
      try {
        if (!isActive()) {
          fail(node, 'This template edit session has already completed.')
        }
        await frames.run(frame, () => visitor(handle(node)))
        if (frame.walking) {
          fail(node, 'The visitor completed before node.walk; await or return its promise.')
        }
      }
      finally {
        frame.active = false
      }
      index = frame.skipped || node.removed ? tree.end(node) : index + 1
    }
  }
  return {
    assertActive,
    hasRemovals: () => hasRemovals,
    close: () => frames.disable(),
    visit: (visitor: WxmlTransformVisitor) => visit(0, elements.length, visitor),
    walk(element: Element, visitor: WxmlTransformVisitor): Promise<void> {
      const frame = assertActive(element)
      if (typeof visitor !== 'function') {
        fail(element, 'walk expects a visitor function.')
      }
      frame.walking = true
      const promise = visit(tree.start(element) + 1, tree.end(element), visitor)
        .finally(() => {
          frame.walking = false
        })
      // 未等待的异步遍历仍由会话拒绝，避免其稍后失败成为未处理拒绝。
      void promise.catch(() => {})
      return promise
    },
    skipChildren(element: Element) {
      const frame = assertActive(element)
      if (frame.node !== element) {
        fail(element, 'skipChildren must be called on the current visitor node.')
      }
      frame.skipped = true
    },
    remove(element: Element) {
      hasRemovals = true
      for (let index = tree.start(element); index < tree.end(element); index++) {
        elements[index]!.removed = true
      }
    },
  }
}
