import type {
  ImportEntry,
  IncludeEntry,
  RenderNode,
  TemplateDefinition,
  WxsEntry,
} from './types'

import { dirname, relative } from 'pathe'

export function shouldMarkWxsImport(pathname: string) {
  const lower = pathname.toLowerCase()
  if (lower.endsWith('.wxs') || lower.endsWith('.wxs.ts') || lower.endsWith('.wxs.js')) {
    return false
  }
  return lower.endsWith('.ts') || lower.endsWith('.js')
}

interface CollectSpecialNodesContext {
  templates: TemplateDefinition[]
  includes: IncludeEntry[]
  imports: ImportEntry[]
  wxs: WxsEntry[]
  wxsModules: Map<string, string>
  warnings: string[]
  sourceId: string
  resolveTemplate: (raw: string) => string | undefined
  resolveWxs: (raw: string) => string | undefined
}

export function collectSpecialNodes(nodes: RenderNode[], context: CollectSpecialNodesContext) {
  const renderable: RenderNode[] = []
  for (const node of nodes) {
    if (node.type === 'element') {
      const name = node.name ?? ''
      if (name === 'template' && node.attribs?.name) {
        context.templates.push({
          name: node.attribs.name,
          nodes: collectSpecialNodes(node.children ?? [], context),
        })
        continue
      }
      if ((name === 'import' || name === 'wx-import') && node.attribs?.src) {
        const resolved = context.resolveTemplate(node.attribs.src)
        if (resolved) {
          context.imports.push({
            id: resolved,
            importName: `__wxml_import_${context.imports.length}`,
          })
        }
        else {
          context.warnings.push(`[web] 无法解析模板依赖: ${node.attribs.src} (from ${context.sourceId})`)
        }
        continue
      }
      if ((name === 'include' || name === 'wx-include') && node.attribs?.src) {
        const resolved = context.resolveTemplate(node.attribs.src)
        if (resolved) {
          context.includes.push({
            id: resolved,
            importName: `__wxml_include_${context.includes.length}`,
          })
        }
        else {
          context.warnings.push(`[web] 无法解析模板依赖: ${node.attribs.src} (from ${context.sourceId})`)
        }
        continue
      }
      if (name === 'wxs') {
        const moduleName = node.attribs?.module?.trim()
        if (moduleName) {
          const previousSource = context.wxsModules.get(moduleName)
          if (previousSource) {
            context.warnings.push(`[web] WXS 模块名重复: ${moduleName} (from ${context.sourceId})`)
          }
          context.wxsModules.set(moduleName, context.sourceId)
          if (node.attribs?.src) {
            const resolved = context.resolveWxs(node.attribs.src)
            if (resolved) {
              context.wxs.push({
                module: moduleName,
                kind: 'src',
                importName: `__wxs_${context.wxs.length}`,
                value: resolved,
              })
            }
          }
          else {
            const inlineCode = (node.children ?? [])
              .filter(child => child.type === 'text')
              .map(child => child.data ?? '')
              .join('')
            context.wxs.push({
              module: moduleName,
              kind: 'inline',
              importName: `__wxs_${context.wxs.length}`,
              value: inlineCode,
            })
          }
        }
        continue
      }
      if (node.children?.length) {
        node.children = collectSpecialNodes(node.children, context)
      }
    }
    renderable.push(node)
  }
  return renderable
}

export function toRelativeImport(from: string, target: string) {
  const fromDir = dirname(from)
  const rel = relative(fromDir, target)
  if (!rel || rel.startsWith('.')) {
    const fallback = normalizeTemplatePath(target).split('/').pop() ?? ''
    return rel || `./${fallback}`
  }
  return `./${rel}`
}

export function normalizeTemplatePath(pathname: string) {
  return pathname.split('\\').join('/')
}
