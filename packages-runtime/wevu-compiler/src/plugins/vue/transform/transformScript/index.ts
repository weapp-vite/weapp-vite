import type { File as BabelFile, ObjectExpression } from '@weapp-vite/ast/babelTypes'
import type { WevuDefaults } from '../../../../types/wevu'
import type { WevuPageFeatureFlag } from '../../../wevu/pageFeatures'
import type { TransformResult, TransformScriptOptions, TransformState } from './utils'
import { WE_VU_RUNTIME_APIS } from '../../../../constants'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../../../utils/babel'
import { resolveWarnHandler } from '../../../../utils/warn'
import { collectWevuPageFeatureFlags } from '../../../wevu/pageFeatures'
import { pruneTemplateComponentMeta } from '../scriptTemplateMeta'
import { vueSfcTransformPlugin } from '../scriptVueSfcTransform'
import { createCollectVisitors } from './collect'
import { tryFastTransformCompiledScriptSetup } from './fastSetup'
import { createImportVisitors } from './imports'
import { createMacroVisitors } from './macros'
import { rewriteDefaultExport, serializeWevuDefaults } from './rewrite'

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
  const warn = resolveWarnHandler(options?.warn)

  const state: TransformState = {
    transformed: false,
    defineComponentAliases: new Set<string>([WE_VU_RUNTIME_APIS.defineComponent, '_defineComponent']),
    defineComponentDecls: new Map<string, ObjectExpression>(),
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
      runVisitor(vueSfcVisitors.ImportDeclaration, path)
      if (!path.removed) {
        runVisitor(importVisitors.ImportDeclaration, path)
      }
    },
    CallExpression(path: any) {
      runVisitor(vueSfcVisitors.CallExpression, path)
      if (!path.removed) {
        runVisitor(macroVisitors.CallExpression, path)
      }
    },
  }

  traverse(ast, visitor as any)

  // <script setup> 组件导入自动注册：移除仅供模板使用的 import 与自动返回 getter。
  if (options?.templateComponentMeta) {
    state.transformed = pruneTemplateComponentMeta(ast, options.templateComponentMeta) || state.transformed
  }

  state.transformed = rewriteDefaultExport(
    ast,
    state,
    options,
    enabledPageFeatures,
    serializedWevuDefaults,
    parsedWevuDefaults,
  ) || state.transformed

  if (!state.transformed) {
    return {
      code: source,
      transformed: false,
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
  }
}
