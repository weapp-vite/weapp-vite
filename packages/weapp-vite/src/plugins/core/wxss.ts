import type { Plugin } from 'vite'
import type { CorePluginState } from './helpers'
import { ALL_NATIVE_STYLE_RESOLVER_EXTENSIONS } from '../../platforms/sourceAssets'
import { recordHmrProfileDuration, recordHmrProfileOperation } from '../../utils/hmrProfile'

const nativeStyleExtensionRe = new RegExp(`\\.(${ALL_NATIVE_STYLE_RESOLVER_EXTENSIONS.join('|')})$`)

export function createWxssResolverPlugin(state: CorePluginState): Plugin {
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
