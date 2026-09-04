import type { File } from '@weapp-vite/ast/babelTypes'
import type { CompileVueFileOptions } from '../../vue/transform/compileVueFile/types'
import type { JsxCompileContext } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse } from '../../../utils/babel'
import { createBindingManifest } from '../../vue/compiler/template/bindingManifest'
import { formatWxml } from '../../vue/compiler/template/format'
import { getMiniProgramTemplatePlatform } from '../../vue/compiler/template/platforms'
import * as analysis from './analysis'
import { createJsxModuleResolver } from './moduleResolver'
import { compileRenderableExpression, renderDynamicIslandSupportTemplate } from './render'

export function createJsxCompileContext(options?: CompileVueFileOptions): JsxCompileContext {
  return {
    platform: options?.template?.platform ?? getMiniProgramTemplatePlatform(),
    mustacheInterpolation: options?.template?.mustacheInterpolation ?? 'compact',
    formatWxml: options?.template?.formatWxml ?? false,
    warnings: [],
    bindingManifest: createBindingManifest(options?.bindingManifestSourceFile ?? ''),
    inlineExpressions: [],
    inlineExpressionSeed: 0,
    scopeStack: [],
    moduleResolver: undefined,
    importedBindings: new Map(),
    resolvingExports: new Set(),
    dynamicIslands: [],
    dynamicIslandSeed: 0,
    dynamicIslandMode: 'auto',
  }
}

function collectImportedBindings(ast: File, context: JsxCompileContext) {
  for (const statement of ast.program.body) {
    if (!t.isImportDeclaration(statement)) {
      continue
    }
    const source = statement.source.value
    for (const specifier of statement.specifiers) {
      if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.local)) {
        const importedName = t.isIdentifier(specifier.imported) ? specifier.imported.name : specifier.imported.value
        context.importedBindings?.set(specifier.local.name, { source, importedName })
      }
      else if (t.isImportDefaultSpecifier(specifier) && t.isIdentifier(specifier.local)) {
        context.importedBindings?.set(specifier.local.name, { source, importedName: 'default' })
      }
      else if (t.isImportNamespaceSpecifier(specifier) && t.isIdentifier(specifier.local)) {
        context.importedBindings?.set(specifier.local.name, { source, importedName: '*' })
      }
    }
  }
}

export function compileJsxTemplate(source: string, filename: string, options?: CompileVueFileOptions) {
  const ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as File
  const context = createJsxCompileContext(options)
  context.filename = filename
  context.bindingManifest.sourceFile = options?.bindingManifestSourceFile ?? filename
  context.moduleResolver = createJsxModuleResolver(context.warnings)
  collectImportedBindings(ast, context)

  const { renderExpression } = analysis.analyzeJsxAst(ast, context)
  if (!renderExpression) {
    context.warnings = context.warnings.map(message => (
      message === '未识别到默认导出组件。'
        ? `未在 ${filename} 中识别到默认导出组件。`
        : message
    ))
    return {
      template: undefined,
      warnings: context.warnings,
      bindingManifest: context.bindingManifest,
      inlineExpressions: context.inlineExpressions,
      dynamicIslands: context.dynamicIslands,
    }
  }

  let template = compileRenderableExpression(renderExpression, context)
  if (context.dynamicIslands?.length) {
    template += renderDynamicIslandSupportTemplate(context)
  }
  return {
    template: context.formatWxml ? formatWxml(template) : template,
    warnings: context.warnings,
    bindingManifest: context.bindingManifest,
    inlineExpressions: context.inlineExpressions,
    dynamicIslands: context.dynamicIslands,
  }
}

export function collectJsxAutoComponents(source: string, filename: string, options?: CompileVueFileOptions) {
  const context = createJsxCompileContext(options)
  return analysis.collectJsxAutoComponentContext(source, filename, context, {
    astEngine: options?.astEngine,
    warn: options?.warn,
  })
}

/**
 * 单次解析同时编译模板和收集自动组件上下文，避免重复 babelParse 和 traverse。
 */
export function compileJsxTemplateAndCollectComponents(source: string, filename: string, options?: CompileVueFileOptions) {
  const ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as File
  const context = createJsxCompileContext(options)
  context.filename = filename
  context.bindingManifest.sourceFile = options?.bindingManifestSourceFile ?? filename
  context.moduleResolver = createJsxModuleResolver(context.warnings)
  collectImportedBindings(ast, context)

  const { renderExpression, autoComponentContext } = analysis.analyzeJsxAst(ast, context)

  let template: string | undefined
  if (renderExpression) {
    template = compileRenderableExpression(renderExpression, context)
    if (context.dynamicIslands?.length) {
      template += renderDynamicIslandSupportTemplate(context)
    }
    if (context.formatWxml) {
      template = formatWxml(template)
    }
  }
  else {
    context.warnings = context.warnings.map(message => (
      message === '未识别到默认导出组件。'
        ? `未在 ${filename} 中识别到默认导出组件。`
        : message
    ))
  }

  return {
    template,
    warnings: context.warnings,
    bindingManifest: context.bindingManifest,
    inlineExpressions: context.inlineExpressions,
    autoComponentContext,
    dynamicIslands: context.dynamicIslands,
    dependencies: context.moduleResolver.getDependencies(),
  }
}
