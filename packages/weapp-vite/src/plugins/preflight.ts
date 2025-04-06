import type { CompilerContext } from '@/context'
import type { Plugin } from 'vite'
import { isObject } from '@weapp-core/shared'

const removePlugins = ['vite:build-import-analysis']
export function preflight({ configService }: CompilerContext): Plugin[] {
  return [
    {
      name: 'weapp-vite:preflight',
      enforce: 'pre',
      configResolved(config) {
        for (const removePlugin of removePlugins) {
          const idx = config.plugins?.findIndex(x => x.name === removePlugin)
          if (idx > -1) {
            (config.plugins as Plugin[]).splice(idx, 1)
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
