import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { isObject } from '@weapp-core/shared'
import { createDebugger } from '../debugger'
// TODO 在新版本的 rolldown vite 里没有用
const removePlugins = ['vite:build-import-analysis']

const debug = createDebugger('weapp-vite:preflight')
export function preflight({ configService }: CompilerContext): Plugin[] {
  return [
    {
      name: 'weapp-vite:preflight',
      enforce: 'pre',
      configResolved(config) {
        for (const removePlugin of removePlugins) {
          const idx = config.plugins?.findIndex(x => x.name === removePlugin)
          if (idx > -1) {
            const plugin = (config.plugins as Plugin[]).splice(idx, 1)
            plugin[0] && debug?.('remove plugin', plugin[0].name)
          }
        }
      },
    },
    {
      name: 'weapp-vite:set-env',
      enforce: 'pre',
      configResolved(config) {
        if (isObject(config.env)) {
          for (const [key, value] of Object.entries(config.env)) {
            configService.setDefineEnv(key, value)
          }
        }
      },
    },
  ]
}
