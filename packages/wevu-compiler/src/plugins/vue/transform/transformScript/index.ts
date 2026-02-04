import type { File as BabelFile, ObjectExpression } from '@babel/types'
import type { WevuDefaults } from '../../../../types/wevu'
import type { WevuPageFeatureFlag } from '../../../wevu/pageFeatures'
import type { TransformResult, TransformScriptOptions, TransformState } from './utils'
import { WE_VU_RUNTIME_APIS } from '../../../../constants'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../../../utils/babel'
import { resolveWarnHandler } from '../../../../utils/warn'
import { collectWevuPageFeatureFlags } from '../../../wevu/pageFeatures'
import { injectTemplateComponentMeta } from '../scriptTemplateMeta'
import { vueSfcTransformPlugin } from '../scriptVueSfcTransform'
import { createCollectVisitors } from './collect'
import { createImportVisitors } from './imports'
import { createMacroVisitors } from './macros'
import { rewriteDefaultExport, serializeWevuDefaults } from './rewrite'

export type { TransformResult, TransformScriptOptions } from './utils'

/**
 * 转换 Vue SFC 脚本：处理宏、导入、默认导出与 wevu 相关注入。
 */
export function transformScript(source: string, options?: TransformScriptOptions): TransformResult {
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

  // 先运行 Vue SFC 转换插件
  traverse(ast, vueSfcTransformPlugin().visitor as any)

  const visitor = {
    ...createMacroVisitors(state),
    ...createImportVisitors(ast.program, state),
    ...createCollectVisitors(state),
  }

  traverse(ast, visitor as any)

  // <script setup> 组件导入自动注册：移除 import，并注入元信息对象（满足用户在 script 中访问/打印的需求）
  if (options?.templateComponentMeta) {
    state.transformed = injectTemplateComponentMeta(ast, options.templateComponentMeta) || state.transformed
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

  const generated = generate(ast, {
    retainLines: true,
  })

  return {
    code: generated.code,
    transformed: state.transformed,
  }
}
