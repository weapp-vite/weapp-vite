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
  const buildEnd = createBuildEndHook(state)
  let releaseServer: (() => void) | undefined

  const releaseScope = () => {
    // scope 属于本插件实例；不同 hook 的 JS context 身份不能作为构建存活凭据。
    state.ctx.moduleGraphService.unbindBuildContext(state)
    releaseServer?.()
    releaseServer = undefined
  }

  return {
    name: 'weapp-vite:pre',
    enforce: 'pre',
    configResolved(config) {
      state.resolvedConfig = config
    },
    configureServer(server) {
      releaseServer?.()
      releaseServer = state.ctx.moduleGraphService.bindDevServer(server)
    },
    buildStart: createBuildStartHook(state),
    watchChange: createWatchChangeHook(state),
    options: createOptionsHook(state),
    resolveId: createLogicalEntryResolveHook(state),
    async load(id) {
      state.ctx.moduleGraphService.bindPluginContext(state, this)
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
    async buildEnd() {
      state.entryChunkLifecycle?.endBuild()
      return await buildEnd.call(this)
    },
    closeBundle() {
      // watch 构建每轮都可能关闭 bundle；scope 必须保留到 watcher 真正关闭。
      if (!this.meta.watchMode || state.resolvedConfig?.command === 'serve') {
        releaseScope()
      }
    },
    closeWatcher() {
      releaseScope()
    },
  }
}
