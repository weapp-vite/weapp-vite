import type { WxmlCompileOptions, WxmlCompileResult, WxmlTagDiagnostic } from './types'

import { readFileSync } from 'node:fs'
import { RUNTIME_ID, TEMPLATE_QUERY } from '../../plugin/constants'
import { resolveTemplateInput } from '../../shared/templateInput'
import { appendTemplateInputQuery } from '../../shared/templateInputQuery'
import { addDependency, collectDependencies, createDependencyContext, warnCircularTemplate, warnReadTemplate } from './dependency'
import { buildNavigationBarAttrs } from './navigation'
import { prepareWxml } from './prepare'
import { renderer } from './renderer'
import { normalizeTemplatePath, shouldMarkWxsImport, toRelativeImport } from './specialNodes'

function appendTemplateQuery(pathname: string, input: NonNullable<WxmlCompileOptions['input']>) {
  return appendTemplateInputQuery(`${pathname}${pathname.includes('?') ? '&' : '?'}${TEMPLATE_QUERY}`, input)
}

function templateIdentity(filename: string, input: NonNullable<WxmlCompileOptions['input']>) {
  return JSON.stringify([filename, input.platform, input.syntax, input.rawTags])
}

function compileTemplate(options: WxmlCompileOptions, diagnoseUnknownTags: boolean): WxmlCompileResult {
  const dependencyContext = options.dependencyContext ?? createDependencyContext()
  const expandDependencies = options.expandDependencies ?? !options.dependencyContext
  const warnings = dependencyContext.warnings

  const tagDiagnostics: WxmlTagDiagnostic[] = []

  const resolveInput = (filename: string, inherited: NonNullable<WxmlCompileOptions['input']>) => resolveTemplateInput(filename, options.resolveInput?.(filename, inherited), inherited)
  const expandDependencyTree = (dependencies: string[], importer: string, inheritedInput: NonNullable<WxmlCompileOptions['input']>) => {
    for (const target of dependencies) {
      const input = resolveInput(target, inheritedInput)
      const identity = templateIdentity(target, input)
      if (dependencyContext.active.has(identity)) {
        warnCircularTemplate(dependencyContext, importer, target)
        continue
      }
      if (dependencyContext.visited.has(identity)) {
        continue
      }
      dependencyContext.visited.add(identity)
      dependencyContext.active.add(identity)
      let source: string
      try {
        source = readFileSync(target, 'utf8')
      }
      catch {
        warnReadTemplate(dependencyContext, target)
        dependencyContext.active.delete(identity)
        continue
      }
      try {
        const result = prepareWxml({
          id: target,
          source,
          input,
          resolveTemplatePath: options.resolveTemplatePath,
          resolveWxsPath: options.resolveWxsPath,
          componentTags: options.componentTags,
        }, dependencyContext, diagnoseUnknownTags)
        tagDiagnostics.push(...result.tagDiagnostics)
        collectDependencies(result, dependencyContext)
        expandDependencyTree([...result.imports, ...result.includes].map(entry => entry.id), target, result.input)
      }
      catch (error) {
        if (error instanceof Error && error.message) {
          warnings.push(`[web] 无法解析模板依赖: ${target} ${error.message}`)
        }
      }
      dependencyContext.active.delete(identity)
    }
  }

  const prepared = prepareWxml(options, dependencyContext, diagnoseUnknownTags)
  tagDiagnostics.push(...prepared.tagDiagnostics)
  const {
    renderNodes: renderNodesList,
    navigationBarAttrs,
    templates,
    includes,
    imports,
    wxs,
  } = prepared

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
    `import { bindRuntimeEvent } from '${RUNTIME_ID}'`,
    `import { bindRuntimeDataset } from '${RUNTIME_ID}'`,
    `import { transformInlineStyleValue as __weappInlineStyle } from '${RUNTIME_ID}'`,
  ]
  const bodyLines: string[] = []
  const directDependencies: string[] = []

  for (const entry of imports) {
    const importPath = normalizeTemplatePath(toRelativeImport(options.id, entry.id))
    importLines.push(`import { templates as ${entry.importName} } from '${appendTemplateQuery(importPath, resolveInput(entry.id, prepared.input))}'`)
    addDependency(entry.id, dependencyContext, directDependencies)
  }

  for (const entry of includes) {
    const importPath = normalizeTemplatePath(toRelativeImport(options.id, entry.id))
    importLines.push(`import { render as ${entry.importName} } from '${appendTemplateQuery(importPath, resolveInput(entry.id, prepared.input))}'`)
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
    const identity = templateIdentity(options.id, prepared.input)
    dependencyContext.visited.add(identity)
    dependencyContext.active.add(identity)
    expandDependencyTree([...imports, ...includes].map(entry => entry.id), options.id, prepared.input)
    dependencyContext.active.delete(identity)
  }

  const code = [...importLines, '', ...bodyLines].join('\n')
  const dependencies = expandDependencies ? dependencyContext.dependencies : directDependencies
  return {
    code,
    dependencies,
    warnings: warnings.length > 0 ? warnings : undefined,
    tagDiagnostics,
  }
}

export function compileWxml(options: WxmlCompileOptions): WxmlCompileResult {
  return compileTemplate(options, true)
}

/** 依赖模块的标签诊断由入口模板按其组件注册作用域统一收集。 */
export function compileWxmlDependency(options: WxmlCompileOptions): WxmlCompileResult {
  return compileTemplate(options, false)
}
