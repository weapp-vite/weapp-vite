import type { InlineConfig, PluginOption } from 'vite'
import type { WeappBuildSession } from './session'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { createDevModuleGraphPlugin } from '../moduleGraph/devProvider'
import { notifyDevModuleGraphHost } from '../moduleGraph/host'
import { createViteWatchIgnored } from '../runtime/watch/options'

/** 宿主仅提供依赖图和服务生命周期；小程序快照沿用原生构建落盘。 */
export function prepareDevHostConfig(session: WeappBuildSession, merged: InlineConfig, user: InlineConfig): { plugins: PluginOption[], config: InlineConfig } {
  const ctx = session.context
  if (session.statefulController) {
    const { plugins: _plugins, configFile: _configFile, ...normalized } = merged
    return {
      plugins: [...session.statefulController.plugins, ...(merged.plugins ?? [])],
      config: {
        ...normalized,
        logLevel: user.logLevel,
        appType: 'custom',
        define: {
          ...merged.define,
          App: `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].App`,
          Page: `globalThis[${JSON.stringify(WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY)}].Page`,
        },
        optimizeDeps: { noDiscovery: true, include: [], entries: [] },
        experimental: { ...merged.experimental, bundledDev: true },
        server: {
          ...merged.server,
          ...user.server,
          // bundledDev 已隔离源码 HMR；保留宿主对配置与环境文件的原生重启。
          hmr: user.server?.hmr,
          watch: {
            ...user.server?.watch,
            ignored: createViteWatchIgnored(ctx.configService.cwd, ctx.configService.outDir, user.server?.watch?.ignored),
          },
        },
        build: { ...merged.build, watch: undefined, write: false },
      } satisfies InlineConfig,
    }
  }
  return {
    plugins: [createDevModuleGraphPlugin(ctx, merged, change => notifyDevModuleGraphHost(ctx, change))],
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
