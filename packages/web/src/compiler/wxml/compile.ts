import type {
  ImportEntry,
  IncludeEntry,
  TemplateDefinition,
  WxmlCompileOptions,
  WxmlCompileResult,
  WxsEntry,
} from './types'

import { readFileSync } from 'node:fs'
import { addDependency, createDependencyContext, warnCircularTemplate, warnReadTemplate } from './dependency'
import { buildNavigationBarAttrs, extractNavigationBarFromPageMeta } from './navigation'
import { parseWxml } from './parser'
import { renderer } from './renderer'
import { collectSpecialNodes, normalizeTemplatePath, shouldMarkWxsImport, toRelativeImport } from './specialNodes'

export function compileWxml(options: WxmlCompileOptions): WxmlCompileResult {
  const dependencyContext = options.dependencyContext ?? createDependencyContext()
  const expandDependencies = options.expandDependencies ?? !options.dependencyContext
  const warnings = dependencyContext.warnings

  const expandDependencyTree = (dependencies: string[], importer: string) => {
    for (const target of dependencies) {
      if (!target) {
        continue
      }
      if (dependencyContext.active.has(target)) {
        warnCircularTemplate(dependencyContext, importer, target)
        continue
      }
      if (dependencyContext.visited.has(target)) {
        continue
      }
      dependencyContext.visited.add(target)
      dependencyContext.active.add(target)
      let source: string
      try {
        source = readFileSync(target, 'utf8')
      }
      catch {
        warnReadTemplate(dependencyContext, target)
        dependencyContext.active.delete(target)
        continue
      }
      try {
        const result = compileWxml({
          id: target,
          source,
          resolveTemplatePath: options.resolveTemplatePath,
          resolveWxsPath: options.resolveWxsPath,
          dependencyContext,
          expandDependencies: false,
        })
        expandDependencyTree(result.dependencies, target)
      }
      catch (error) {
        if (error instanceof Error && error.message) {
          warnings.push(`[web] 无法解析模板依赖: ${target} ${error.message}`)
        }
      }
      dependencyContext.active.delete(target)
    }
  }

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
  const wxsModules = new Map<string, string>()

  const renderNodesList = collectSpecialNodes(nodes, {
    templates,
    includes,
    imports,
    wxs,
    wxsModules,
    warnings,
    sourceId: options.id,
    resolveTemplate: (raw: string) => options.resolveTemplatePath(raw, options.id),
    resolveWxs: (raw: string) => options.resolveWxsPath(raw, options.id),
  })

  if (options.navigationBar && options.navigationBar.config.navigationStyle !== 'custom') {
    const attrs = buildNavigationBarAttrs(options.navigationBar.config, navigationBarAttrs)
    renderNodesList.unshift({
      type: 'element',
      name: 'weapp-navigation-bar',
      attribs: attrs,
    })
  }

  const importLines: string[] = [
    `import { html } from 'lit'`,
    `import { repeat } from 'lit/directives/repeat.js'`,
  ]
  const bodyLines: string[] = []
  const directDependencies: string[] = []

  for (const entry of imports) {
    const importPath = normalizeTemplatePath(toRelativeImport(options.id, entry.id))
    importLines.push(`import { templates as ${entry.importName} } from '${importPath}'`)
    addDependency(entry.id, dependencyContext, directDependencies)
  }

  for (const entry of includes) {
    const importPath = normalizeTemplatePath(toRelativeImport(options.id, entry.id))
    importLines.push(`import { render as ${entry.importName} } from '${importPath}'`)
    addDependency(entry.id, dependencyContext, directDependencies)
  }

  for (const entry of wxs) {
    if (entry.kind === 'src') {
      const baseImport = normalizeTemplatePath(toRelativeImport(options.id, entry.value))
      const importPath = shouldMarkWxsImport(entry.value)
        ? `${baseImport}?wxs`
        : baseImport
      importLines.push(`import ${entry.importName} from '${importPath}'`)
      addDependency(entry.value, dependencyContext, directDependencies)
    }
  }

  if (templates.length > 0 || imports.length > 0) {
    const templatePairs: string[] = []
    for (const entry of imports) {
      templatePairs.push(`...${entry.importName}`)
    }
    for (const template of templates) {
      const rendered = renderer.renderNodes(template.nodes, 'scope', '__wxs_modules', options.componentTags)
      templatePairs.push(`${JSON.stringify(template.name)}: (scope, ctx) => ${rendered}`)
    }
    bodyLines.push(`const __templates = { ${templatePairs.join(', ')} }`)
  }
  else {
    bodyLines.push(`const __templates = {}`)
  }

  if (wxs.length > 0) {
    bodyLines.push(`const __wxs_inline_cache = Object.create(null)`)
    bodyLines.push(`let __wxs_modules = {}`)
    const wxsMapEntries: string[] = []
    for (const entry of wxs) {
      if (entry.kind === 'inline') {
        const inlineCode = entry.value.trim()
        const cacheKey = JSON.stringify(entry.module)
        if (inlineCode) {
          bodyLines.push(`function ${entry.importName}(ctx) {`)
          bodyLines.push(`  if (!__wxs_inline_cache[${cacheKey}]) {`)
          bodyLines.push(`    __wxs_inline_cache[${cacheKey}] = ctx.createWxsModule(${JSON.stringify(inlineCode)}, ${JSON.stringify(options.id)})`)
          bodyLines.push(`  }`)
          bodyLines.push(`  return __wxs_inline_cache[${cacheKey}]`)
          bodyLines.push(`}`)
        }
        else {
          bodyLines.push(`function ${entry.importName}() { return {} }`)
        }
        wxsMapEntries.push(`${JSON.stringify(entry.module)}: ${entry.importName}(ctx)`)
        continue
      }
      wxsMapEntries.push(`${JSON.stringify(entry.module)}: ${entry.importName}`)
    }
    bodyLines.push(`function __resolveWxsModules(ctx) {`)
    bodyLines.push(`  return { ${wxsMapEntries.join(', ')} }`)
    bodyLines.push(`}`)
  }
  else {
    bodyLines.push(`const __wxs_modules = {}`)
  }

  const includesRender = includes.map(entry => `${entry.importName}(scope, ctx)`)
  const renderContent = renderer.renderNodes(renderNodesList, 'scope', '__wxs_modules', options.componentTags)
  const contentExpr = includesRender.length > 0
    ? `[${[...includesRender, renderContent].join(', ')}]`
    : renderContent

  bodyLines.push(`export function render(scope, ctx) {`)
  if (wxs.length > 0) {
    bodyLines.push(`  __wxs_modules = __resolveWxsModules(ctx)`)
  }
  bodyLines.push(`  return ${contentExpr}`)
  bodyLines.push(`}`)
  bodyLines.push(`export const templates = __templates`)
  bodyLines.push(`export default render`)

  if (expandDependencies) {
    dependencyContext.visited.add(options.id)
    dependencyContext.active.add(options.id)
    expandDependencyTree(directDependencies, options.id)
    dependencyContext.active.delete(options.id)
  }

  const code = [...importLines, '', ...bodyLines].join('\n')
  const dependencies = expandDependencies ? dependencyContext.dependencies : directDependencies
  return {
    code,
    dependencies,
    warnings: warnings.length > 0 ? warnings : undefined,
  }
}
