import type { Document, Node, SerializeOptions } from './types'
import { editOverlays } from './edit/overlay'
import { canonicalAttribute } from './encoding'

/** 保留模式输出当前文档源码；规范模式逐节点输出并保留所有文本。 */
export function serialize(document: Document, options: SerializeOptions = {}): string {
  if (document.diagnostics.length && document.diagnostics.some(diagnostic => diagnostic.severity === 'error')) {
    throw new TypeError('Cannot serialize an invalid WXML document.')
  }
  if (options.mode === undefined || options.mode === 'preserve') {
    return document.source
  }
  if (options.mode !== 'canonical') {
    throw new TypeError(`Unknown WXML serialization mode: ${String(options.mode)}.`)
  }
  const overlay = editOverlays.get(document)
  let output = ''
  const stack: Array<Node | string> = [...(overlay?.original ?? document).children].reverse()
  while (stack.length) {
    const node = stack.pop()!
    if (typeof node === 'string') {
      output += node
    }
    else if (node.kind !== 'element') {
      output += overlay?.text.get(node) ?? node.data
    }
    else {
      const element = overlay?.elements.get(node) ?? node
      output += `<${element.name}`
      for (const attribute of element.attributes) {
        output += ` ${canonicalAttribute(attribute, document.syntax)}`
      }
      output += node.selfClosing ? ' />' : '>'
      if (!node.selfClosing) {
        stack.push(`</${element.name}>`)
        for (let index = node.children.length - 1; index >= 0; index--) {
          stack.push(node.children[index]!)
        }
      }
    }
  }
  return output
}
