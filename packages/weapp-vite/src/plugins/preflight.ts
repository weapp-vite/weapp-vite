import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { isObject } from '@weapp-core/shared'
import { createDebugger } from '../debugger'

const debug = createDebugger('weapp-vite:preflight')
const removePlugins = ['vite:build-import-analysis']

function createPluginPruner(): Plugin {
  return {
    name: 'weapp-vite:preflight',
    enforce: 'pre',
    configResolved(config) {
      if (!config.plugins?.length) {
        return
      }

      for (const removePlugin of removePlugins) {
        const idx = config.plugins.findIndex(plugin => plugin.name === removePlugin)
        if (idx > -1) {
          const [plugin] = (config.plugins as Plugin[]).splice(idx, 1)
          plugin && debug?.('remove plugin', plugin.name)
        }
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
