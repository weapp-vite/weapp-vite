import type { TemplateNodeLike } from './templateRuntime'
import { isTemplateDefinition } from './templateRuntime'

export type TemplateFileLoader<T extends TemplateNodeLike> = (owner: string, source: string) => { root: T, filePath: string }

/** 展开 include 的可渲染内容，并保留嵌套引用的来源文件。 */
export function expandTemplateIncludes<T extends TemplateNodeLike>(root: T, filePath: string, loadTemplate: TemplateFileLoader<T>) {
  const owners = new WeakMap<T, string>()
  const expand = (node: T, owner: string, stack: string[], included = false): T | undefined => {
    if (included && (isTemplateDefinition(node) || node.name === 'wxs')) {
      return
    }
    owners.set(node, owner)
    if (node.name === 'include' && node.attribs?.src) {
      const source = node.attribs.src
      const loaded = loadTemplate(owner, source.endsWith('.wxml') ? source : `${source}.wxml`)
      if (stack.includes(loaded.filePath)) {
        throw new Error('Circular WXML include is not supported')
      }
      const { src: _src, ...attributes } = node.attribs
      node.name = 'block'
      node.attribs = attributes
      node.children = (loaded.root.children ?? []).flatMap((child) => {
        const expanded = expand(child as T, loaded.filePath, [...stack, loaded.filePath], true)
        return expanded ? [expanded] : []
      })
      return node
    }
    node.children = node.children?.flatMap((child) => {
      const expanded = expand(child as T, owner, stack, included)
      return expanded ? [expanded] : []
    })
    return node
  }
  expand(root, filePath, [filePath])
  return owners
}
