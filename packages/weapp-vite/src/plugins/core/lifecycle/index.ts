import type { Plugin } from 'vite'
import type { CorePluginState } from '../helpers'
import { parseSidecarSourceMetadata } from '../../../moduleGraph/protocol'
import { resolveRequestRuntimeOptions } from '../../../runtime/config/internal/injectRequestGlobals'
import {
  createNativeWebRuntimeModuleMatcher,
  createWebRuntimeGlobalBridgeCode,
  createWebRuntimeNativeInject,
  getWebRuntimeGlobalResolvedId,
  nativeWebApisImplementationRootFromEntry,
  resolveWebRuntimeGlobalTarget,
  WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID,
  WEB_RUNTIME_APP_PRELUDE_STARTUP_RESOLVED_ID,
  WEB_RUNTIME_APP_PRELUDE_STARTUP_VIRTUAL_ID,
  WEB_RUNTIME_APP_PRELUDE_VIRTUAL_ID,
  WEB_RUNTIME_GLOBAL_RESOLVED_PREFIX,
  WEB_RUNTIME_GLOBAL_VIRTUAL_PREFIX,
  WEB_RUNTIME_INJECT_RESOLVED_ID,
  WEB_RUNTIME_INJECT_VIRTUAL_ID,
} from '../../../runtime/config/internal/injectRequestGlobals/nativeInject'
import { beginHmrStyleUpdatePlan, clearPendingHmrStyleUpdates } from '../../../runtime/hmrStyleUpdate'
import { bindEntryChunkLifecycle } from '../../hooks/useLoadEntry/entryChunkLifecycleRegistry'
import { clearNativeEntryAssetOwners } from '../../utils/nativeEntryAssetOwners'
import { createGenerateBundleHook, createRenderStartHook } from './emit'
import { resolveAppPreludeCode } from './emit/appPrelude'
import { createBuildEndHook } from './end'
import { createLoadHook, createOptionsHook } from './load'
import { createLogicalEntryLoadHook, createLogicalEntryResolveHook } from './logicalEntry'
import { createTransformHook } from './transform'
import { createBuildStartHook, createWatchChangeHook } from './watch'

const CORE_TRANSFORM_FILTER_RE = /(?:\.(?:[cm]?[jt]sx?|vue)(?:\?.*)?$|^weapp-vite:web-runtime:app-prelude(?:\.js)?$)/

export function createCoreLifecyclePlugin(state: CorePluginState): Plugin {
  const isPluginBuild = state.buildTarget === 'plugin'
  const loadLogicalEntry = createLogicalEntryLoadHook(state)
  const resolveLogicalEntry = createLogicalEntryResolveHook(state)
  const loadSource = createLoadHook(state)
  const requestGlobalsOptions = resolveRequestRuntimeOptions({
    appPrelude: state.ctx.configService?.weappViteConfig?.appPrelude,
    webRuntime: state.ctx.configService?.weappViteConfig?.injectWebRuntimeGlobals,
    injectRequestGlobals: state.ctx.configService?.weappViteConfig?.injectRequestGlobals,
  }, state.ctx.configService?.packageJson)
  const nativeWebRuntimeInject = requestGlobalsOptions?.native === true
    ? createWebRuntimeNativeInject(
        requestGlobalsOptions.targets,
        requestGlobalsOptions.networkDefaults,
      )
    : null
  let nativeWebApisImplementationRoot: string | undefined
  const isNativeWebRuntimeInjectModuleId = createNativeWebRuntimeModuleMatcher({
    resolveImplementationRoot: () => nativeWebApisImplementationRoot,
  })
  const buildEnd = createBuildEndHook(state)
  const buildStart = createBuildStartHook(state)
  let releaseServer: (() => void) | undefined
  let releaseStyleUpdate: ((success?: boolean) => void) | undefined
  let releaseEntryRegistration: (() => void) | undefined

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
      clearNativeEntryAssetOwners(state.ctx, this?.environment)
      releaseEntryRegistration?.()
      releaseEntryRegistration = undefined
      releaseStyleGeneration(false)
      releaseStyleUpdate = state.ctx.configService.isDev
        ? beginHmrStyleUpdatePlan(
            state.ctx.configService,
            (state.ctx.moduleGraphService.getPendingChanges?.() ?? []).map(change => change.file),
            !state.hmrState.hasBuiltOnce || state.ctx.runtimeState.build.hmr.fullEntryScan === true,
          )
        : undefined
      try {
        state.entryChunkLifecycle?.beginBuild(state.hmrRootInputIds)
        releaseEntryRegistration = state.entryChunkLifecycle
          ? bindEntryChunkLifecycle(this?.environment ?? state.ctx, state.entryChunkLifecycle)
          : undefined
        return await buildStart.call(this)
      }
      catch (error) {
        releaseEntryRegistration?.()
        releaseEntryRegistration = undefined
        releaseStyleGeneration(false)
        throw error
      }
    },
    watchChange: createWatchChangeHook(state),
    options: createOptionsHook(state),
    async resolveId(id, importer) {
      if (nativeWebRuntimeInject && id === '@wevu/web-apis/runtime') {
        // 捕获打包器解析出的实现包根，让 matcher 与模块图用同一解析基准；
        // alias/自定义 resolver 下 Node 解析会分叉，导致 shim 分组静默漏收实现模块。
        try {
          const resolved = await this.resolve(id, importer, { skipSelf: true })
          if (resolved?.id) {
            nativeWebApisImplementationRoot = nativeWebApisImplementationRootFromEntry(resolved.id)
          }
        }
        catch {
          // 解析失败保留 Node fallback，不阻断构建。
        }
      }
      if ((nativeWebRuntimeInject && (
        id === WEB_RUNTIME_INJECT_VIRTUAL_ID
        || id === WEB_RUNTIME_INJECT_RESOLVED_ID
        || id.startsWith(WEB_RUNTIME_GLOBAL_VIRTUAL_PREFIX)
        || id.startsWith(WEB_RUNTIME_GLOBAL_RESOLVED_PREFIX)
      )) || (state.nativeAppPreludeEnabled && (
        id === WEB_RUNTIME_APP_PRELUDE_VIRTUAL_ID
        || id === WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID
        || id === WEB_RUNTIME_APP_PRELUDE_STARTUP_VIRTUAL_ID
        || id === WEB_RUNTIME_APP_PRELUDE_STARTUP_RESOLVED_ID
      ))) {
        let resolvedId = WEB_RUNTIME_INJECT_RESOLVED_ID
        if (id.startsWith(WEB_RUNTIME_GLOBAL_VIRTUAL_PREFIX) || id.startsWith(WEB_RUNTIME_GLOBAL_RESOLVED_PREFIX)) {
          const target = resolveWebRuntimeGlobalTarget(id) ?? id.slice(WEB_RUNTIME_GLOBAL_VIRTUAL_PREFIX.length)
          resolvedId = getWebRuntimeGlobalResolvedId(target)
        }
        else if (id === WEB_RUNTIME_APP_PRELUDE_VIRTUAL_ID || id === WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID) {
          resolvedId = WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID
        }
        else if (id === WEB_RUNTIME_APP_PRELUDE_STARTUP_VIRTUAL_ID || id === WEB_RUNTIME_APP_PRELUDE_STARTUP_RESOLVED_ID) {
          resolvedId = WEB_RUNTIME_APP_PRELUDE_STARTUP_RESOLVED_ID
        }
        return { id: resolvedId, moduleSideEffects: true }
      }
      return resolveLogicalEntry.call(this, id, importer)
    },
    async load(id) {
      state.ctx.moduleGraphService.bindPluginContext(state, this)
      const nativePlan = state.nativeWebRuntimeInjectPlan ?? nativeWebRuntimeInject
      if (nativePlan && id === WEB_RUNTIME_INJECT_RESOLVED_ID) {
        return { code: nativePlan.code, moduleSideEffects: true }
      }
      const globalTarget = resolveWebRuntimeGlobalTarget(id)
      if (nativePlan && globalTarget && (nativePlan.bindingTargets.includes(globalTarget) || nativePlan.globalTargets.includes(globalTarget))) {
        return { code: createWebRuntimeGlobalBridgeCode(nativePlan, globalTarget), moduleSideEffects: true }
      }
      if (state.nativeAppPreludeEnabled && (id === WEB_RUNTIME_APP_PRELUDE_RESOLVED_ID || id === WEB_RUNTIME_APP_PRELUDE_STARTUP_RESOLVED_ID)) {
        const preludePath = state.ctx.scanService.appEntry?.preludePath
        if (preludePath) {
          this.addWatchFile(preludePath)
        }
        if (id === WEB_RUNTIME_APP_PRELUDE_STARTUP_RESOLVED_ID) {
          return {
            code: `import { runAppPrelude } from ${JSON.stringify(WEB_RUNTIME_APP_PRELUDE_VIRTUAL_ID)};\nrunAppPrelude();`,
            moduleSideEffects: true,
          }
        }
        const code = await resolveAppPreludeCode(preludePath, {
          importMetaDefineRegistry: state.ctx.configService.importMetaDefineRegistry,
          relativePath: preludePath
            ? state.ctx.configService.relativeAbsoluteSrcRoot(preludePath)
            : undefined,
          exportRunner: true,
        })
        return { code: code ?? 'export function runAppPrelude() {}', moduleSideEffects: true }
      }
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
      handler: createTransformHook(state, isNativeWebRuntimeInjectModuleId),
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
    buildEnd: {
      // 先完成本代入口与样式计划，再准备 CSS；此时 Vite 的预处理资源仍然有效。
      order: 'pre',
      sequential: true,
      async handler(error) {
        state.entryChunkLifecycle?.endBuild()
        if (error) {
          releaseStyleGeneration(false)
        }
        return await buildEnd.call(this)
      },
    },
    closeBundle() {
      clearNativeEntryAssetOwners(state.ctx, this?.environment)
      releaseEntryRegistration?.()
      releaseEntryRegistration = undefined
      if (state.resolvedConfig?.build?.write === false) {
        releaseStyleGeneration(true)
      }
      // watch 构建每轮都可能关闭 bundle；scope 必须保留到 watcher 真正关闭。
      if (!this.meta.watchMode || state.resolvedConfig?.command === 'serve') {
        releaseScope()
      }
    },
    closeWatcher() {
      clearNativeEntryAssetOwners(state.ctx, this?.environment)
      releaseEntryRegistration?.()
      releaseEntryRegistration = undefined
      releaseStyleGeneration(false)
      clearPendingHmrStyleUpdates(state.ctx.configService)
      releaseScope()
    },
  }
}
