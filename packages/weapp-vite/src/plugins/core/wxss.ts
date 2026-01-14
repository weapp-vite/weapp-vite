import type { Plugin } from 'vite'
import type { CorePluginState } from './helpers'

export function createWxssResolverPlugin(_state: CorePluginState): Plugin {
  return {
    name: 'weapp-vite:pre:wxss',
    enforce: 'pre',
    resolveId: {
      filter: {
        id: /\.wxss$/,
      },
      handler(id) {
        return id.replace(/\.wxss$/, '.css?wxss')
      },
    },
  }
}
