import type { Plugin } from 'vite'
import type { CorePluginState } from '../helpers'
import { createGenerateBundleHook, createRenderStartHook } from './emit'
import { createBuildEndHook } from './end'
import { createLoadHook, createOptionsHook } from './load'
import { createBuildStartHook, createWatchChangeHook } from './watch'

export function createCoreLifecyclePlugin(state: CorePluginState): Plugin {
  const isPluginBuild = state.buildTarget === 'plugin'

  return {
    name: 'weapp-vite:pre',
    enforce: 'pre',
    buildStart: createBuildStartHook(state),
    watchChange: createWatchChangeHook(state),
    options: createOptionsHook(state),
    load: createLoadHook(state),
    renderStart: createRenderStartHook(state),
    generateBundle: createGenerateBundleHook(state, isPluginBuild),
    buildEnd: createBuildEndHook(state),
  }
}
