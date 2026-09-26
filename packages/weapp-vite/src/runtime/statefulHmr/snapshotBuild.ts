import type { InlineConfig } from 'vite'
import type { CompilerContext } from '../../context'
import type { LoadConfigOptions } from '../config/types'
import { readFile } from 'node:fs/promises'
import { removeExtensionDeep } from '@weapp-core/shared'
import { build } from 'vite'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { createPublicAssetSourcePlan } from '../../plugins/asset/publicSources'
import { shareWxmlDependencies } from '../../wxml/processing/dependencies'
import { createSharedBuildConfig } from '../sharedBuildConfig'
import { resolveComponentPageGlobalStyleRoutes } from './componentPageStyles'

/** 快照独立编译；初始化到构建收尾均不写支持文件，由活动 DevEngine 统一维护。 */
export async function buildStatefulHmrSnapshot(
  loadOptions: LoadConfigOptions,
  configure: (options: InlineConfig) => InlineConfig = options => options,
  owner?: Pick<CompilerContext, 'runtimeState'>,
) {
  const ctx = createCompilerContextInstance()
  if (owner) {
    shareWxmlDependencies(owner, ctx)
  }
  return await ctx.autoImportService.runWithoutOutputWrites(async () => {
    ctx.currentBuildTarget = 'app'
    await ctx.configService.load(loadOptions)
    await ctx.scanService.loadAppEntry()
    ctx.scanService.loadSubPackages()
    let globalStyleRoutes: string[] = []
    let publicAssets: ReturnType<typeof createPublicAssetSourcePlan> | undefined
    const baseOptions = ctx.configService.merge(
      undefined,
      createSharedBuildConfig(ctx.configService, ctx.scanService),
    )
    baseOptions.plugins = [...(baseOptions.plugins ?? []), {
      name: 'weapp-vite:stateful-hmr-page-style-metadata',
      enforce: 'post',
      configResolved(config) {
        publicAssets = createPublicAssetSourcePlan({ publicDir: config.publicDir, copyPublicDir: config.build.copyPublicDir }, ctx.configService.outDir)
      },
      async generateBundle(_options, bundle) {
        // 资产快照随后会删除 JS chunk，必须在完整产物阶段确认页面注册与样式边界。
        globalStyleRoutes = resolveComponentPageGlobalStyleRoutes(Object.values(bundle), ctx.runtimeState.build.hmr.componentPageStyleOptions)
        // write:false 不运行 Vite 的 public 复制阶段；把未被编译产物覆盖的文件交给原生资产写出。
        for (const file of await publicAssets?.scan() ?? []) {
          const fileName = publicAssets!.outputName(file)
          if (!bundle[fileName]) {
            this.emitFile({ type: 'asset', fileName, source: await readFile(file) })
          }
        }
      },
    }]
    const options = configure(baseOptions)
    options.build = { ...options.build, watch: undefined, write: false }
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
