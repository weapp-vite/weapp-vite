import type { File as BabelFile, ObjectExpression } from '@weapp-vite/ast/babelTypes'
import type { WevuDefaults } from '../../../../types/wevu'
import type { WevuPageFeatureFlag } from '../../../wevu/pageFeatures'
import type { TransformResult, TransformScriptOptions, TransformState } from './utils'
import * as t from '@weapp-vite/ast/babelTypes'
import {
  isWevuRuntimeModuleId,
  WE_VU_RUNTIME_APIS,
} from '../../../../constants'
import {
  createWevuRuntimeCapabilityMetadata,
  mergeWevuRuntimeCapabilityMetadata,
} from '../../../../runtimeCapabilities'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../../../utils/babel'
import { resolveWarnHandler } from '../../../../utils/warn'
import { collectWevuPageFeatureFlags } from '../../../wevu/pageFeatures'
import { resolveComponentExpression } from '../scriptComponent'
import { pruneTemplateComponentMeta } from '../scriptTemplateMeta'
import { vueSfcTransformPlugin } from '../scriptVueSfcTransform'
import { createCollectVisitors } from './collect'
import { tryFastTransformCompiledScriptSetup } from './fastSetup'
import { createImportVisitors } from './imports'
import { createMacroVisitors } from './macros'
import { rewriteDefaultExport, serializeWevuDefaults } from './rewrite'
import {
  analyzeWevuComponentOptions,
  analyzeWevuDefaults,
  analyzeWevuRuntimeCalls,
  injectWevuRuntimeCapabilityInstallers,
} from './runtimeCapabilities'

export type { TransformResult, TransformScriptOptions } from './utils'

function runVisitor(visitor: any, path: any) {
  if (typeof visitor === 'function') {
    visitor(path)
  }
}

/**
 * 转换 Vue SFC 脚本：处理宏、导入、默认导出与 wevu 相关注入。
 */
export function transformScript(source: string, options?: TransformScriptOptions): TransformResult {
  const fastResult = tryFastTransformCompiledScriptSetup(source, options)
  if (fastResult) {
    return fastResult
  }

  const ast: BabelFile = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS)
  const sourceRuntimeCapabilities = analyzeWevuRuntimeCalls(ast)
  const warn = resolveWarnHandler(options?.warn)

  const state: TransformState = {
    transformed: false,
    defineComponentAliases: new Set<string>([WE_VU_RUNTIME_APIS.defineComponent, '_defineComponent']),
    defineComponentDecls: new Map<string, ObjectExpression>(),
    useSlotsAliases: new Set<string>(),
    usesSlots: false,
    defaultExportPath: null,
  }

  const enabledPageFeatures: Set<WevuPageFeatureFlag> = options?.isPage
    ? collectWevuPageFeatureFlags(ast)
    : new Set<WevuPageFeatureFlag>()
  const serializedWevuDefaults = options?.wevuDefaults && Object.keys(options.wevuDefaults).length > 0
    ? serializeWevuDefaults(options.wevuDefaults, warn)
    : undefined
  const parsedWevuDefaults: WevuDefaults | undefined = serializedWevuDefaults
    ? JSON.parse(serializedWevuDefaults)
    : undefined

  const vueSfcVisitors = vueSfcTransformPlugin().visitor as Record<string, any>
  const macroVisitors = createMacroVisitors(ast.program, state)
  const importVisitors = createImportVisitors(ast.program, state)
  const collectVisitors = createCollectVisitors(state)
  const visitor = {
    ...vueSfcVisitors,
    ...macroVisitors,
    ...importVisitors,
    ...collectVisitors,
    ImportDeclaration(path: any) {
      const source = path.node.source.value
      const canProvideUseSlots = source === 'vue' || isWevuRuntimeModuleId(source)
      for (const specifier of path.node.specifiers) {
        if (
          canProvideUseSlots
          && specifier.type === 'ImportSpecifier'
          && (
            (specifier.imported.type === 'Identifier' && specifier.imported.name === 'useSlots')
            || (specifier.imported.type === 'StringLiteral' && specifier.imported.value === 'useSlots')
          )
        ) {
          state.useSlotsAliases.add(specifier.local.name)
        }
      }
      runVisitor(vueSfcVisitors.ImportDeclaration, path)
      if (!path.removed) {
        runVisitor(importVisitors.ImportDeclaration, path)
      }
    },
    CallExpression(path: any) {
      if (path.node.callee.type === 'Identifier' && state.useSlotsAliases.has(path.node.callee.name)) {
        state.usesSlots = true
      }
      runVisitor(vueSfcVisitors.CallExpression, path)
      if (!path.removed) {
        runVisitor(macroVisitors.CallExpression, path)
      }
    },
  }

  traverse(ast, visitor as any)
  const templateRuntimeCapabilities = createWevuRuntimeCapabilityMetadata([
    ...(options?.templateRefs?.length || options?.layoutHosts?.length ? ['templateRefs'] as const : []),
    ...(options?.inlineExpressions?.length ? ['inlineEvents'] as const : []),
    ...(options?.layoutHosts?.length ? ['layout'] as const : []),
  ])
  const componentExpression = state.defaultExportPath
    ? resolveComponentExpression(
        state.defaultExportPath.node.declaration,
        state.defineComponentDecls,
        state.defineComponentAliases,
      )
    : null
  const defaultDeclaration = state.defaultExportPath?.node.declaration
  let componentCapabilityExpression = componentExpression
  if (t.isIdentifier(defaultDeclaration)) {
    componentCapabilityExpression = defaultDeclaration
  }
  else if (
    t.isCallExpression(defaultDeclaration)
    && t.isIdentifier(defaultDeclaration.callee)
    && state.defineComponentAliases.has(defaultDeclaration.callee.name)
  ) {
    const firstArgument = defaultDeclaration.arguments[0]
    if (firstArgument && !t.isSpreadElement(firstArgument) && t.isExpression(firstArgument)) {
      componentCapabilityExpression = firstArgument
    }
  }
  const defaultsBranch = options?.isApp
    ? parsedWevuDefaults?.app
    : parsedWevuDefaults?.component
  const componentRuntimeCapabilities = componentCapabilityExpression
    ? analyzeWevuComponentOptions({
        expression: componentCapabilityExpression,
        scope: state.defaultExportPath?.scope,
        defaults: defaultsBranch as Record<string, unknown> | undefined,
      })
    : undefined
  const defaultsRuntimeCapabilities = options?.isApp
    ? analyzeWevuDefaults(parsedWevuDefaults)
    : undefined
  const runtimeCapabilities = mergeWevuRuntimeCapabilityMetadata(
    options?.runtimeCapabilities,
    templateRuntimeCapabilities,
    sourceRuntimeCapabilities,
    componentRuntimeCapabilities,
    defaultsRuntimeCapabilities,
  )

  // <script setup> 组件导入自动注册：移除仅供模板使用的 import 与自动返回 getter。
  if (options?.templateComponentMeta) {
    state.transformed = pruneTemplateComponentMeta(ast, options.templateComponentMeta) || state.transformed
  }

  const rewriteOptions = state.usesSlots && !options?.scopedSlotHostProperties
    ? { ...options, scopedSlotHostProperties: true }
    : options
  state.transformed = rewriteDefaultExport(
    ast,
    state,
    rewriteOptions,
    enabledPageFeatures,
    serializedWevuDefaults,
    parsedWevuDefaults,
  ) || state.transformed
  state.transformed = injectWevuRuntimeCapabilityInstallers(ast.program, runtimeCapabilities) || state.transformed

  if (!state.transformed) {
    return {
      code: source,
      transformed: false,
      ...(runtimeCapabilities ? { runtimeCapabilities } : {}),
    }
  }

  const sourceMap = options?.sourceMap !== false
  const generated = generate(ast, {
    compact: options?.minify === true,
    minified: options?.minify === true,
    retainLines: options?.minify !== true,
    sourceMaps: sourceMap,
    sourceFileName: 'inline.ts',
  }, source)

  return {
    code: generated.code,
    map: sourceMap ? generated.map as TransformResult['map'] : null,
    transformed: state.transformed,
    ...(runtimeCapabilities ? { runtimeCapabilities } : {}),
  }
}
