import type { RootNode, TemplateChildNode } from '@vue/compiler-core'
import type { TemplateCompileResult } from './types'
import { NodeTypes } from '@vue/compiler-core'
import { resolveTemplateTagName } from './htmlTagMapping'

/** 在原始 AST 上保存标签来源，后续模板转换不得替代其位置。 */
export function collectTemplateSourceTags(root: RootNode, filename: string, htmlTagToWxmlMap?: Record<string, string>) {
  const tags: NonNullable<TemplateCompileResult['sourceTags']> = []
  const visit = (nodes: TemplateChildNode[]) => {
    for (const node of nodes) {
      if (node.type === NodeTypes.ELEMENT) {
        tags.push({ tag: node.tag, resolvedTag: resolveTemplateTagName(node.tag, { htmlTagToWxmlMap }), filename, loc: { start: { ...node.loc.start }, end: { ...node.loc.end } } })
        if (node.tag !== 'wxs') {
          visit(node.children)
        }
      }
    }
  }
  visit(root.children)
  return tags
}
