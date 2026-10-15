import type {
  ImportEntry,
  IncludeEntry,
  TemplateDefinition,
  WxmlCompileOptions,
  WxmlDependencyContext,
  WxsEntry,
} from './types'
import { extractNavigationBarFromPageMeta } from './navigation'
import { parseWxml } from './parser'
import { collectSpecialNodes } from './specialNodes'

/** 共享模板分析阶段，依赖扫描复用其结果而不生成渲染代码。 */
export function prepareWxml(options: WxmlCompileOptions, dependencyContext: WxmlDependencyContext) {
  const warnings = dependencyContext.warnings
  let nodes = parseWxml(options.source)
  let navigationBarAttrs: Record<string, string> | undefined
  if (options.navigationBar) {
    const extracted = extractNavigationBarFromPageMeta(nodes)
    nodes = extracted.nodes
    if (extracted.warnings.length > 0) {
      warnings.push(...extracted.warnings)
    }
    navigationBarAttrs = extracted.attrs
  }

  const templates: TemplateDefinition[] = []
  const includes: IncludeEntry[] = []
  const imports: ImportEntry[] = []
  const wxs: WxsEntry[] = []
  const renderNodes = collectSpecialNodes(nodes, {
    templates,
    includes,
    imports,
    wxs,
    wxsModules: new Map<string, string>(),
    warnings,
    sourceId: options.id,
    resolveTemplate: (raw: string) => options.resolveTemplatePath(raw, options.id),
    resolveWxs: (raw: string) => options.resolveWxsPath(raw, options.id),
  })

  return { renderNodes, navigationBarAttrs, templates, includes, imports, wxs }
}
