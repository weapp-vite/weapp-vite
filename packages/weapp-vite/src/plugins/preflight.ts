import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { isObject } from '@weapp-core/shared'
import { createDebugger } from '../debugger'
import logger from '../logger'

const debug = createDebugger('weapp-vite:preflight')
const removePlugins = [
  'vite:build-import-analysis',
  'native:import-analysis-build',
]
const EXTERNAL_TAILWINDCSS_PLUGIN_PREFIX = 'weapp-tailwindcss:'
const BUILTIN_TAILWINDCSS_VERSION = '6.24.0'

function createPluginPruner(): Plugin {
  let warnedExternalTailwindcss = false
  return {
    name: 'weapp-vite:preflight',
    enforce: 'pre',
    configResolved(config) {
      if (!config.plugins?.length) {
        return
      }

      for (const removePlugin of removePlugins) {
        const plugins = config.plugins as Plugin[]
        const idx = plugins.findIndex(plugin => plugin.name === removePlugin)
        if (idx > -1) {
          const [plugin] = plugins.splice(idx, 1)
          plugin && debug?.('remove plugin', plugin.name)
        }
      }

      const externalTailwindcssPlugins = config.plugins.filter(plugin =>
        plugin.name.startsWith(EXTERNAL_TAILWINDCSS_PLUGIN_PREFIX),
      )
      if (externalTailwindcssPlugins.length === 0) {
        return
      }
      const plugins = config.plugins as Plugin[]
      for (let index = plugins.length - 1; index >= 0; index--) {
        const plugin = plugins[index]
        if (plugin?.name.startsWith(EXTERNAL_TAILWINDCSS_PLUGIN_PREFIX)) {
          plugins.splice(index, 1)
          debug?.('remove plugin', plugin.name)
        }
      }
      if (!warnedExternalTailwindcss) {
        warnedExternalTailwindcss = true
        logger.warn(
          `[weapp-vite] 检测到已注册 \`weapp-tailwindcss/vite\` 插件，已由内置集成接管并禁用外部插件。自 weapp-vite@${BUILTIN_TAILWINDCSS_VERSION} 起无需单独安装或注册 weapp-tailwindcss，请删除对应 import 和 plugins 配置。`,
        )
      }
    },
  }
}

function createEnvSynchronizer({ configService }: CompilerContext): Plugin {
  return {
    name: 'weapp-vite:set-env',
    enforce: 'pre',
    configResolved(config) {
      if (!isObject(config.env)) {
        return
      }

      for (const [key, value] of Object.entries(config.env)) {
        configService.setDefineEnv(key, value)
      }
    },
  }
}

export function preflight(ctx: CompilerContext): Plugin[] {
  return [createPluginPruner(), createEnvSynchronizer(ctx)]
}
