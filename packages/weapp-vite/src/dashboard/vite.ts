import type { Plugin } from 'vite'
import type { AnalyzeDashboardDevframeController } from './index'
import { existsSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { createPluginFromDevframe } from '@vitejs/devtools-kit/node'

export interface AnalyzeDashboardPluginOptions {
  base?: string
}

/** 使用官方适配器挂载到现有 Vite DevTools；认证、Origin 与 MCP 策略由宿主负责。 */
export function createAnalyzeDashboardPlugin(
  controller: AnalyzeDashboardDevframeController,
  options: AnalyzeDashboardPluginOptions = {},
): Plugin {
  const plugin = createPluginFromDevframe(controller.definition, {
    base: options.base === undefined ? undefined : `/${options.base}/`.replace(/\/+/g, '/'),
  })
  const devtools = plugin.devtools!
  return {
    ...plugin,
    apply: 'serve',
    devtools: {
      ...devtools,
      async setup(ctx) {
        try {
          if (ctx.viteConfig.command !== 'serve') {
            return
          }
          const clientAssets = controller.definition.clientAssets
          if (typeof clientAssets !== 'string' || !isAbsolute(clientAssets) || !existsSync(join(clientAssets, 'index.html'))) {
            throw new Error('Dashboard Vite 插件需要已构建 clientAssets 的绝对目录，请先调用 resolveDashboardClientAssets。')
          }
          await devtools.setup(ctx)
        }
        catch (error) {
          controller.dispose()
          throw error
        }
      },
    },
    async closeBundle(...args) {
      controller.dispose()
      const closeBundle = plugin.closeBundle
      await (typeof closeBundle === 'function' ? closeBundle : closeBundle?.handler)?.apply(this, args)
    },
  }
}
