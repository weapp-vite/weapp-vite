import type { MutableCompilerContext } from '../../context'
import path from 'pathe'
import { resolveHmrRuntimeDecision } from '../hmrRuntime'
import { resolveStatefulHmrStartupFallback } from '../hmrRuntimeHostCapabilities'
import { getHmrRuntimeSession, isBorrowedHmrRuntimeSession } from '../hmrRuntimeSession'
import { resolveIdePrivateConfigPath } from './index'

/** 启动先核验宿主能力并准备 classic 设置；存量 stateful 交接仍保护已发布产物。 */
export async function prepareClassicIdeConfig(ctx: MutableCompilerContext): Promise<void> {
  const config = ctx.configService
  if (!config?.isDev || config.platform !== 'weapp' || isBorrowedHmrRuntimeSession(ctx)) {
    return
  }
  const runtime = getHmrRuntimeSession(ctx)
  const configPath = resolveIdePrivateConfigPath(config)
  if (configPath) {
    await runtime.classicIdeConfig.reconcileStale(configPath)
  }
  let decision = runtime.resolve(resolveHmrRuntimeDecision({
    platform: config.platform,
    configured: config.weappViteConfig.hmr?.runtime,
    compileHotReLoad: config.projectPrivateConfig.setting?.compileHotReLoad,
  }))
  const fallback = resolveStatefulHmrStartupFallback({ platform: config.platform, runtime: decision.runtime })
  if (fallback) {
    runtime.requestClassic(fallback)
    decision = runtime.resolve(decision)
  }
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
