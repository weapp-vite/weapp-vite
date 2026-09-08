import type { LoadConfigOptions } from '../config/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import { createCompilerContextInstance } from '../../context/createCompilerContextInstance'
import { createSharedBuildConfig } from '../sharedBuildConfig'

/** 快照拥有独立编译状态，避免清空活动 DevEngine 的组件注册与模块依赖。 */
export async function createStatefulHmrSnapshotOptions(loadOptions: LoadConfigOptions) {
  const ctx = createCompilerContextInstance()
  ctx.currentBuildTarget = 'app'
  await ctx.configService.load(loadOptions)
  await ctx.scanService.loadAppEntry()
  ctx.scanService.loadSubPackages()
  const options = ctx.configService.merge(
    undefined,
    createSharedBuildConfig(ctx.configService, ctx.scanService),
  )
  return {
    options,
    getEntryIds: () => ctx.runtimeState.build.hmr.resolvedEntryMap.keys(),
    getDelegatedComponentEntryIds: () => Array.from(ctx.runtimeState.build.hmr.resolvedEntryMap.keys()).filter(id =>
      /\.(?:vue|jsx|tsx)$/.test(id)
      && ctx.runtimeState.build.hmr.entriesMap.get(ctx.configService.relativeAbsoluteSrcRoot(removeExtensionDeep(id)))?.type === 'component',
    ),
    getComponentPageStyleOptions: () => ctx.runtimeState.build.hmr.componentPageStyleOptions,
  }
}
