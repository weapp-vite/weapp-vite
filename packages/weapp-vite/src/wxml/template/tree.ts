import type { Element } from './scan'

/** 利用扫描器的先序结果建立直接子节点和半开子树区间，不递归重扫源码。 */
export function indexElementTree(elements: readonly Element[]) {
  const children = new Map<Element | undefined, Element[]>()
  const starts = new Map<Element, number>()
  const ends = elements.map((_, index) => index + 1)
  for (const [index, element] of elements.entries()) {
    starts.set(element, index)
    const siblings = children.get(element.parent) ?? []
    siblings.push(element)
    children.set(element.parent, siblings)
  }
  for (let index = elements.length - 1; index >= 0; index--) {
    const parent = elements[index]!.parent
    if (parent) {
      const start = starts.get(parent)!
      ends[start] = Math.max(ends[start]!, ends[index]!)
    }
  }
  return {
    children: (element: Element) => children.get(element) ?? [],
    start: (element: Element) => starts.get(element)!,
    end: (element: Element) => ends[starts.get(element)!]!,
  }
}
