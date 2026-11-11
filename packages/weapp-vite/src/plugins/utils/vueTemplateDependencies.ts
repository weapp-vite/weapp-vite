import type { TemplateChildNode } from '@vue/compiler-core'
import type { SFCTemplateBlock } from 'vue/compiler-sfc'
import type { MpPlatform, WxmlDep } from '../../types'
import { NodeTypes } from '@vue/compiler-core'
import { parseVueSfc } from 'wevu/compiler'
import { getScriptModuleImportAttrs, isScriptModuleTagName } from '../../utils/wxmlScriptModule'
import { scanWxml } from '../../wxml'
import { getTemplateImportAttrs } from '../../wxml/shared'

/** Vue 负责模板结构；原生扫描器只读取依赖标签的起始属性，保留脚本类型校验。 */
export function collectSfcTemplateDependencies(block: Pick<SFCTemplateBlock, 'content'> & Partial<SFCTemplateBlock>, platform?: MpPlatform): WxmlDep[] {
  let template = block
  if (!template.ast || template.src) {
    // 外部 src 的旧 AST 仍属于空的内联块；复用支持脚本原文边界的 SFC parser。
    const parsed = parseVueSfc(`<template>${block.content}</template>`)
    if (parsed.errors.length) {
      throw parsed.errors[0]
    }
    template = parsed.descriptor.template ?? block
  }
  const offset = template.loc?.start.offset ?? 0
  const dependencies: WxmlDep[] = []
  const visit = (nodes: TemplateChildNode[]) => {
    for (const node of nodes) {
      if (node.type !== NodeTypes.ELEMENT) {
        continue
      }
      const attributes = getScriptModuleImportAttrs(node.tag, platform) ?? getTemplateImportAttrs(node.tag)
      if (attributes) {
        const start = node.loc.start.offset - offset
        const end = node.props.reduce((end, prop) => Math.max(end, prop.loc.end.offset - offset), start + node.tag.length + 1)
        const opening = `${block.content.slice(start, end)} />`
        for (const dependency of scanWxml(opening, { platform }).deps) {
          dependencies.push({ ...dependency, start: start + dependency.start, end: start + dependency.end })
        }
      }
      const scriptFilter = node.tag !== 'filter' || node.props.some(prop => prop.type === NodeTypes.ATTRIBUTE && ['module', 'src'].includes(prop.name))
      if (!isScriptModuleTagName(node.tag, platform) || !scriptFilter) {
        visit(node.children)
      }
    }
  }
  visit(template.ast?.children ?? [])
  return dependencies
}
