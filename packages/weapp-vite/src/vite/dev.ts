import type { InlineConfig } from 'vite'
import type { WeappBuildSession } from './session'
import { createDevModuleGraphPlugin } from '../moduleGraph/devProvider'
import { notifyDevModuleGraphHost } from '../moduleGraph/host'
import { createViteWatchIgnored } from '../runtime/watch/options'

/** 宿主仅提供依赖图和服务生命周期；小程序快照沿用原生构建落盘。 */
export function prepareDevHostConfig(session: WeappBuildSession, merged: InlineConfig, user: InlineConfig) {
  const ctx = session.context
  return {
    plugin: createDevModuleGraphPlugin(ctx, merged, change => notifyDevModuleGraphHost(ctx, change)),
    config: {
      appType: 'custom',
      resolve: merged.resolve,
      define: merged.define,
      optimizeDeps: { noDiscovery: true, include: [], entries: [] },
      server: {
        watch: {
          ignored: createViteWatchIgnored(ctx.configService.cwd, ctx.configService.outDir, user.server?.watch?.ignored),
        },
      },
    } satisfies InlineConfig,
  }
}
