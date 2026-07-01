import type { Plugin } from 'vite'
import type { CorePluginState } from './helpers'
import { recordHmrProfileDuration, recordHmrProfileOperation } from '../../utils/hmrProfile'

export function createWxssResolverPlugin(state: CorePluginState): Plugin {
  return {
    name: 'weapp-vite:pre:wxss',
    enforce: 'pre',
    resolveId: {
      filter: {
        id: /\.wxss$/,
      },
      handler(id) {
        const startedAt = performance.now()
        try {
          return id.replace(/\.wxss$/, '.css?wxss')
        }
        finally {
          const profile = state.ctx.runtimeState?.build?.hmr?.profile
          recordHmrProfileDuration(profile, 'pluginResolveMs', performance.now() - startedAt)
          recordHmrProfileOperation(profile, 'resolveCount')
        }
      },
    },
  }
}
