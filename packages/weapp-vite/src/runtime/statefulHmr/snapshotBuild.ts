import type { InlineConfig } from 'vite'
import type { LoadConfigOptions } from '../config/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import { build } from 'vite'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { createSharedBuildConfig } from '../sharedBuildConfig'

/** 快照独立编译；初始化到构建收尾均不写支持文件，由活动 DevEngine 统一维护。 */
export async function buildStatefulHmrSnapshot(
  loadOptions: LoadConfigOptions,
  configure: (options: InlineConfig) => InlineConfig = options => options,
) {
  const ctx = createCompilerContextInstance()
  return await ctx.autoImportService.runWithoutOutputWrites(async () => {
    ctx.currentBuildTarget = 'app'
    await ctx.configService.load(loadOptions)
    await ctx.scanService.loadAppEntry()
    ctx.scanService.loadSubPackages()
    const options = configure(ctx.configService.merge(
      undefined,
      createSharedBuildConfig(ctx.configService, ctx.scanService),
    ))
    options.build = { ...options.build, watch: undefined, write: false }
    const output = await build(options)
    return {
      output,
      getEntryIds: () => ctx.runtimeState.build.hmr.resolvedEntryMap.keys(),
      getDelegatedComponentEntryIds: () => Array.from(ctx.runtimeState.build.hmr.resolvedEntryMap.keys()).filter(id =>
        /\.(?:vue|jsx|tsx)$/.test(id)
        && ctx.runtimeState.build.hmr.entriesMap.get(ctx.configService.relativeAbsoluteSrcRoot(removeExtensionDeep(id)))?.type === 'component',
      ),
      getComponentPageStyleOptions: () => ctx.runtimeState.build.hmr.componentPageStyleOptions,
    }
  })
}
