import type { Plugin } from 'vite'
import type { CorePluginState } from '../helpers'
import { parseSidecarSourceMetadata } from '../../../moduleGraph/protocol'
import { beginHmrStyleUpdatePlan, clearPendingHmrStyleUpdates } from '../../../runtime/hmrStyleUpdate'
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
  const buildStart = createBuildStartHook(state)
  let releaseServer: (() => void) | undefined
  let releaseStyleUpdate: ((success?: boolean) => void) | undefined

  const releaseStyleGeneration = (success: boolean) => {
    releaseStyleUpdate?.(success)
    releaseStyleUpdate = undefined
  }

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
    async buildStart() {
      releaseStyleGeneration(false)
      releaseStyleUpdate = state.ctx.configService.isDev
        ? beginHmrStyleUpdatePlan(
            state.ctx.configService,
            (state.ctx.moduleGraphService.getPendingChanges?.() ?? []).map(change => change.file),
            !state.hmrState.hasBuiltOnce || state.ctx.runtimeState.build.hmr.fullEntryScan === true,
          )
        : undefined
      try {
        return await buildStart.call(this)
      }
      catch (error) {
        releaseStyleGeneration(false)
        throw error
      }
    },
    watchChange: createWatchChangeHook(state),
    options: createOptionsHook(state),
    resolveId: createLogicalEntryResolveHook(state),
    async load(id) {
      state.ctx.moduleGraphService.bindPluginContext(state, this)
      const logicalResult = await loadLogicalEntry.call(this, id)
      if (logicalResult || parseSidecarSourceMetadata(id)) {
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
    writeBundle: {
      order: 'post',
      sequential: true,
      async handler() {
        // 输出编译器也会发现依赖；统一在产物完成后将本轮声明交给长期 Vite 图。
        await state.ctx.moduleGraphService.syncDevGraph(this)
      },
    },
    async buildEnd(error) {
      state.entryChunkLifecycle?.endBuild()
      if (error) {
        releaseStyleGeneration(false)
      }
      return await buildEnd.call(this)
    },
    closeBundle() {
      if (state.resolvedConfig?.build?.write === false) {
        releaseStyleGeneration(true)
      }
      // watch 构建每轮都可能关闭 bundle；scope 必须保留到 watcher 真正关闭。
      if (!this.meta.watchMode || state.resolvedConfig?.command === 'serve') {
        releaseScope()
      }
    },
    closeWatcher() {
      releaseStyleGeneration(false)
      clearPendingHmrStyleUpdates(state.ctx.configService)
      releaseScope()
    },
  }
}
