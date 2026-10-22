import type { MutableCompilerContext } from '../../context'
import { resolveHmrRuntimeDecision } from '../hmrRuntime'
import { getHmrRuntimeSession, isBorrowedHmrRuntimeSession } from '../hmrRuntimeSession'
import { resolveIdePrivateConfigPath } from './index'

/** 必须先于清空输出和首个 classic 发布；模式决策读取解析器保留的用户请求值。 */
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
  if (decision.runtime === 'classic' && configPath) {
    await runtime.classicIdeConfig.activate(configPath)
  }
}
