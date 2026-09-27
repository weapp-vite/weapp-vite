import type { InlineConfig } from 'vite'
import type { CompilerContext } from '../../context'
import type { LoadConfigOptions } from '../config/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import { build } from 'vite'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { compilerSourceId } from '../../plugins/compilerPlugin/hmr'
import { setCompilerSourceSnapshot } from '../../plugins/utils/sourceSnapshot'
import { normalizeFsResolvedId } from '../../utils/resolvedId'
import { shareWxmlDependencies } from '../../wxml/processing/dependencies'
import { createSharedBuildConfig } from '../sharedBuildConfig'
import { resolveComponentPageGlobalStyleRoutes } from './componentPageStyles'

/** 快照独立编译；初始化到构建收尾均不写支持文件，由活动 DevEngine 统一维护。 */
export async function buildStatefulHmrSnapshot(
  loadOptions: LoadConfigOptions,
  configure: (options: InlineConfig) => InlineConfig = options => options,
  owner?: Pick<CompilerContext, 'runtimeState'>,
  sources?: ReadonlyMap<string, string | null>,
) {
  const ctx = createCompilerContextInstance()
  if (owner) {
    shareWxmlDependencies(owner, ctx)
  }
  return await ctx.autoImportService.runWithoutOutputWrites(async () => {
    ctx.currentBuildTarget = 'app'
    await ctx.configService.load(loadOptions)
    if (sources) {
      setCompilerSourceSnapshot(ctx.configService, sources)
    }
    await ctx.scanService.loadAppEntry()
    ctx.scanService.loadSubPackages()
    let globalStyleRoutes: string[] = []
    const baseOptions = ctx.configService.merge(
      undefined,
      createSharedBuildConfig(ctx.configService, ctx.scanService),
    )
    baseOptions.plugins = [...(baseOptions.plugins ?? []), {
      name: 'weapp-vite:stateful-hmr-page-style-metadata',
      enforce: 'post',
      generateBundle(_options, bundle) {
        // 资产快照随后会删除 JS chunk，必须在完整产物阶段确认页面注册与样式边界。
        globalStyleRoutes = resolveComponentPageGlobalStyleRoutes(Object.values(bundle), ctx.runtimeState.build.hmr.componentPageStyleOptions)
      },
    }]
    const options = configure(baseOptions)
    options.build = { ...options.build, watch: undefined, write: false }
    if (sources) {
      options.plugins = [{
        name: 'weapp-vite:snapshot-input',
        enforce: 'pre',
        load: {
          order: 'pre',
          handler(id) {
            if (id.startsWith('\0') || id.includes('?')) {
              return null
            }
            const sourceId = normalizeFsResolvedId(id)
            const nativeEntry = ctx.runtimeState.build.hmr.entriesMap.get(removeExtensionDeep(ctx.configService.relativeAbsoluteSrcRoot(sourceId)))
            if (sourceId.endsWith('.vue') || (nativeEntry?.path && normalizeFsResolvedId(nativeEntry.path) === sourceId)
              || (ctx.scanService.appEntry?.path && normalizeFsResolvedId(ctx.scanService.appEntry.path) === sourceId)) {
              return null
            }
            const source = sources.get(compilerSourceId(id))
            if (source === null) {
              throw new Error(`Source removed from snapshot: ${id}`)
            }
            return source === undefined ? null : { code: source }
          },
        },
      }, ...(options.plugins ?? [])]
    }
    const output = await build(options)
    return {
      output,
      getGlassEaselAnalysisByOwner: () => ctx.runtimeState.glassEasel.analysisByOwner,
      getEntryIds: () => ctx.runtimeState.build.hmr.resolvedEntryMap.keys(),
      getDelegatedComponentEntryIds: () => Array.from(ctx.runtimeState.build.hmr.resolvedEntryMap.keys()).filter(id =>
        /\.(?:vue|jsx|tsx)$/.test(id)
        && ctx.runtimeState.build.hmr.entriesMap.get(ctx.configService.relativeAbsoluteSrcRoot(removeExtensionDeep(id)))?.type === 'component',
      ),
      getGlobalStyleRoutes: () => globalStyleRoutes,
    }
  }).finally(() => ctx.moduleGraphService.resetSession())
}
