import type { Plugin } from 'vite'
import type { CorePluginState } from '../helpers'
import { parseSidecarSourceRequest } from '../../../moduleGraph/protocol'
import { createGenerateBundleHook, createRenderStartHook } from './emit'
import { createBuildEndHook } from './end'
import { createLoadHook, createOptionsHook } from './load'
import { createLogicalEntryLoadHook, createLogicalEntryResolveHook } from './logicalEntry'
import { createTransformHook } from './transform'
import { createBuildStartHook, createWatchChangeHook } from './watch'

const CORE_TRANSFORM_FILTER_RE = /\.(?:[cm]?[jt]sx?|vue)(?:\?.*)?$/

export function createCoreLifecyclePlugin(state: CorePluginState): Plugin {
  const isPluginBuild = state.buildTarget === 'plugin'
  const loadLogicalEntry = createLogicalEntryLoadHook(state)
  const loadSource = createLoadHook(state)

  return {
    name: 'weapp-vite:pre',
    enforce: 'pre',
    configResolved(config) {
      state.resolvedConfig = config
    },
    configureServer(server) {
      state.ctx.moduleGraphService.bindDevServer(server)
    },
    buildStart: createBuildStartHook(state),
    watchChange: createWatchChangeHook(state),
    options: createOptionsHook(state),
    resolveId: createLogicalEntryResolveHook(state),
    async load(id) {
      state.ctx.moduleGraphService.bindPluginContext(this)
      const logicalResult = await loadLogicalEntry.call(this, id)
      if (logicalResult || parseSidecarSourceRequest(id)) {
        return logicalResult
      }
      return await loadSource.call(this, id)
    },
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
