import type { Plugin } from 'vite'
import type { CorePluginState } from './helpers'
import { recordHmrProfileDuration, recordHmrProfileOperation } from '../../utils/hmrProfile'

export function createWxssResolverPlugin(state: CorePluginState): Plugin {
  const nativeStyleExtensionRe = /\.(wxss|acss)$/
  return {
    name: 'weapp-vite:pre:native-style',
    enforce: 'pre',
    resolveId: {
      filter: {
        id: nativeStyleExtensionRe,
      },
      handler(id) {
        const startedAt = performance.now()
        try {
          return id.replace(nativeStyleExtensionRe, (_match, extension: string) => `.css?nativeStyle=${extension}`)
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
