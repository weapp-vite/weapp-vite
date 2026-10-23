import type { MutableCompilerContext } from '../../context'
import path from 'pathe'
import { resolveHmrRuntimeDecision } from '../hmrRuntime'
import { getHmrRuntimeSession, isBorrowedHmrRuntimeSession } from '../hmrRuntimeSession'
import { resolveIdePrivateConfigPath } from './index'

/** 首构先于清空输出；已有 stateful 产物保留到完整发布前再交接 IDE 设置。 */
export async function prepareClassicIdeConfig(ctx: MutableCompilerContext): Promise<void> {
  const config = ctx.configService
  if (!config?.isDev || config.platform !== 'weapp' || isBorrowedHmrRuntimeSession(ctx)) {
    return
  }
  const runtime = getHmrRuntimeSession(ctx)
  const decision = runtime.resolve(resolveHmrRuntimeDecision({
    platform: config.platform,
    configured: config.weappViteConfig.hmr?.runtime,
    compileHotReLoad: config.projectPrivateConfig.setting?.compileHotReLoad,
  }))
  const configPath = resolveIdePrivateConfigPath(config)
  if (decision.runtime === 'classic') {
    if (runtime.classicIdeConfig.preservesPendingOutput(config.outDir)
      && (!configPath || !runtime.classicIdeConfig.hasPendingAssetHandoff(configPath, config.outDir))) {
      throw new Error('[weapp-vite] classic 配置重载改变了待交接 IDE 配置路径，停止原生发布。')
    }
    if (!configPath) {
      return
    }
    if (runtime.classicIdeConfig.hasPendingAssetHandoff(configPath)) {
      if (!runtime.classicIdeConfig.hasPendingAssetHandoff(configPath, config.outDir)) {
        throw new Error('[weapp-vite] classic 配置重载改变了待交接输出根，停止原生发布。')
      }
      if (!runtime.outputOwnership.has(path.resolve(config.outDir))) {
        await runtime.classicIdeConfig.activatePendingAssetHandoff(configPath, config.outDir)
      }
      return
    }
    await runtime.classicIdeConfig.activate(configPath)
  }
}
