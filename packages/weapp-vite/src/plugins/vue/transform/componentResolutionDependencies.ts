import type { SFCStyleBlock } from 'vue/compiler-sfc'
import type { CompileVueFileOptions, VueTransformResult } from 'wevu/compiler'
import type { CompilerContext } from '../../../context'
import { WEVU_CLASS_STYLE_RUNTIME_MODULE } from '@weapp-core/constants'
import { resolveMiniPlatform } from '../../../platform'
import { normalizeFsResolvedId } from '../../../utils/resolvedId'
import { syncVueSfcStyleDependencies } from '../../utils/invalidateEntry'
import { rebaseSfcTemplateDependencies, resolveSfcTemplateSource } from '../../utils/sfcTemplateDependencies'
import { compilerSnapshotSourceId, getCompilerSourceSnapshot } from '../../utils/sourceSnapshot'
import { addNormalizedWatchFiles } from '../../utils/watchFiles'

type HostCompilationMeta = NonNullable<VueTransformResult['meta']> & {
  componentResolutionDeps?: string[]
}

/** 解析器发现的中间桶文件和缺失目标归属于当前编译选项。 */
export const componentResolutionDependencies = new WeakMap<CompileVueFileOptions, Set<string>>()

const compilerScriptModules = new Set([WEVU_CLASS_STYLE_RUNTIME_MODULE])

/** 宿主解析输入独立保存，JSON-only 刷新可以替换编译器自己的外部块依赖。 */
export function applyComponentResolutionDependencies(result: VueTransformResult, options: CompileVueFileOptions, filename: string) {
  const resolved = componentResolutionDependencies.get(options)
  if (resolved) {
    const meta: HostCompilationMeta = result.meta ??= {}
    meta.componentResolutionDeps = [...resolved]
  }
  const source = resolveSfcTemplateSource(options.sfcSrc, result.bindingManifest?.sourceFile, filename)
  if (!source) {
    return
  }
  const platform = resolveMiniPlatform(options.template?.platform?.name)
  for (const output of [result, ...(result.scopedSlotComponents ?? [])]) {
    if (output.template) {
      // scoped-slot 与 owner 的产物位于同一目录；编译器自生 WXS 已按该输出目录定位。
      output.template = rebaseSfcTemplateDependencies(output.template, source, filename, platform, output.classStyleWxs ? compilerScriptModules : undefined)
    }
  }
}

/** 在宿主消费边界合并依赖，各分析器只维护自己拥有的字段。 */
export function getVueCompilationDependencies(result: VueTransformResult): string[] {
  const meta = result.meta as HostCompilationMeta | undefined
  return [...new Set([
    ...(meta?.sfcSrcCompilationDeps ?? []),
    ...(meta?.nativeSlotContextDeps ?? []),
    ...(meta?.propsAnalysisDeps ?? []),
    ...(meta?.componentResolutionDeps ?? []),
  ].map(id => normalizeFsResolvedId(id)))]
}

/** 完整编译结果由同一入口替换所有依赖域，避免 bundle 刷新遗留旧的外部块。 */
export function syncVueCompilationDependencies(options: {
  ctx: CompilerContext
  pluginCtx: any
  filename: string
  result: VueTransformResult
  configService: NonNullable<CompilerContext['configService']>
  styleBlocks?: SFCStyleBlock[]
}) {
  const { ctx, pluginCtx, filename, result, configService } = options
  const styleBlocks = options.styleBlocks ?? result.meta?.styleBlocks as SFCStyleBlock[] | undefined
  const styleDependencies = syncVueSfcStyleDependencies(ctx, filename, styleBlocks)
  addNormalizedWatchFiles(pluginCtx, styleDependencies)
  ctx.moduleGraphService.replaceEntryDependencies(filename, 'style', styleDependencies)

  const externalSources = result.meta?.sfcSrcDeps ?? []
  addNormalizedWatchFiles(pluginCtx, externalSources)
  if (configService.isDev) {
    const styleBindings = ctx.runtimeState.build.hmr.vueEntryStyleBindings
    if (externalSources.length) {
      styleBindings.set(filename, { sources: externalSources, expressions: result.meta?.cssVars })
    }
    else {
      styleBindings.delete(filename)
    }
  }

  const jsxDependencies = result.meta?.jsxDependencies ?? []
  addNormalizedWatchFiles(pluginCtx, jsxDependencies)
  ctx.moduleGraphService.replaceEntryDependencies(filename, 'jsx', jsxDependencies)
  const scriptDependencies = getVueCompilationDependencies(result)
  addNormalizedWatchFiles(pluginCtx, scriptDependencies)
  const sources = getCompilerSourceSnapshot(configService)
  ctx.moduleGraphService.replaceEntryDependencies(filename, 'script', scriptDependencies, id => compilerSnapshotSourceId(sources, id))
}
