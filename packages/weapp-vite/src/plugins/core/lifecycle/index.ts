import type { Plugin } from 'vite'
import type { CorePluginState } from '../helpers'
import { createGenerateBundleHook, createRenderStartHook } from './emit'
import { createBuildEndHook } from './end'
import { createLoadHook, createOptionsHook } from './load'
import { createTransformHook } from './transform'
import { createBuildStartHook, createWatchChangeHook } from './watch'

const CORE_TRANSFORM_FILTER_RE = /\.(?:[cm]?[jt]sx?|vue)(?:\?.*)?$/

export function createCoreLifecyclePlugin(state: CorePluginState): Plugin {
  const isPluginBuild = state.buildTarget === 'plugin'

  return {
    name: 'weapp-vite:pre',
    enforce: 'pre',
    configResolved(config) {
      state.resolvedConfig = config
    },
    buildStart: createBuildStartHook(state),
    watchChange: createWatchChangeHook(state),
    options: createOptionsHook(state),
    load: createLoadHook(state),
    transform: {
      filter: {
        id: CORE_TRANSFORM_FILTER_RE,
      },
      handler: createTransformHook(state),
    },
    renderStart: createRenderStartHook(state),
    generateBundle: createGenerateBundleHook(state, isPluginBuild),
    buildEnd: createBuildEndHook(state),
  }
}
