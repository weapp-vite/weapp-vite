import type { WxmlElementInfo } from '../../types'
import type { WxmlSyntax } from '../template/lexical'
import { scriptTags } from '../remove/safety'
import { scanTemplate } from '../template/scan'
import { indexElementTree } from '../template/tree'
import { createLocator } from '../transform/encoding'

/** 每份最终模板只在首次遍历时扫描，多个回调共享不可变的观察节点。 */
export function createValidationNodes(code: string, fileName: string, syntax: WxmlSyntax): readonly WxmlElementInfo[] {
  const { elements } = scanTemplate(code, fileName, scriptTags, false, syntax)
  const tree = indexElementTree(elements)
  const locate = createLocator(code)
  const nodes = new Map<typeof elements[number], WxmlElementInfo>()
  for (const element of elements) {
    const attributes = Object.freeze(element.attrs.map(attr => Object.freeze({
      name: attr.name,
      rawValue: attr.end === attr.nameEnd ? null : code.slice(attr.valueStart, attr.valueEnd),
      quote: attr.quote,
    })))
    nodes.set(element, Object.freeze({
      get children() {
        return Object.freeze(tree.children(element).map(child => nodes.get(child)!))
      },
      tagName: element.tag,
      attributes,
      parent: element.parent ? nodes.get(element.parent) : undefined,
      location: locate(element.start),
      hasAttribute: (name: string) => attributes.some(attr => attr.name === name),
      getAttribute: (name: string) => attributes.find(attr => attr.name === name),
    }))
  }
  return Object.freeze([...nodes.values()])
}
