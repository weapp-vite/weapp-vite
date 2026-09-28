import type { Plugin, ResolvedConfig } from 'vite'
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
  let activeHostConfig: ResolvedConfig | undefined
  return {
    ...plugin,
    apply: 'serve',
    devtools: {
      ...devtools,
      async setup(ctx) {
        let setupStarted = false
        try {
          if (ctx.viteConfig.command !== 'serve') {
            return
          }
          const clientAssets = controller.definition.clientAssets
          if (typeof clientAssets !== 'string' || !isAbsolute(clientAssets) || !existsSync(join(clientAssets, 'index.html'))) {
            throw new Error('Dashboard Vite 插件需要已构建 clientAssets 的绝对目录，请先调用 resolveDashboardClientAssets。')
          }
          setupStarted = true
          await devtools.setup(ctx)
          activeHostConfig = ctx.viteConfig
        }
        catch (error) {
          // 只有 SDK 安装开始前的校验失败，才能保证旧宿主仍然完整可用。
          if (!activeHostConfig || setupStarted) {
            activeHostConfig = undefined
            controller.dispose()
          }
          throw error
        }
      },
    },
    async closeBundle(...args) {
      // 只有成功安装的宿主拥有控制器；旧环境或失败候选的清理不能释放当前宿主。
      if (this.environment.getTopLevelConfig() === activeHostConfig) {
        activeHostConfig = undefined
        controller.dispose()
      }
      const closeBundle = plugin.closeBundle
      await (typeof closeBundle === 'function' ? closeBundle : closeBundle?.handler)?.apply(this, args)
    },
  }
}
