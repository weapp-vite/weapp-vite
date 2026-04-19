import * as webApis from '@wevu/web-apis'
import { describe, expect, it } from 'vitest'
import * as api from '@/api'
import * as fetchEntry from '@/fetch'
import * as root from '@/index'
import * as reactivity from '@/reactivity'
import * as router from '@/router'
import * as runtime from '@/runtime'
import * as store from '@/store'

const ROOT_RUNTIME_EXPORTS = [
  'addMutationRecorder',
  'batch',
  'callHookList',
  'callHookReturn',
  'callUpdateHooks',
  'computed',
  'createApp',
  'createStore',
  'createWevuComponent',
  'createWevuScopedSlotComponent',
  'customRef',
  'defineAppSetup',
  'defineComponent',
  'defineStore',
  'effect',
  'effectScope',
  'endBatch',
  'getCurrentInstance',
  'getCurrentScope',
  'getCurrentSetupContext',
  'getDeepWatchStrategy',
  'getReactiveVersion',
  'hasInjectionContext',
  'inject',
  'injectGlobal',
  'isNoSetData',
  'isProxy',
  'isRaw',
  'isReactive',
  'isReadonly',
  'isRef',
  'isShallowReactive',
  'isShallowRef',
  'markNoSetData',
  'markRaw',
  'mergeModels',
  'mountRuntimeInstance',
  'nextTick',
  'normalizeClass',
  'normalizeStyle',
  'onActivated',
  'onAddToFavorites',
  'onAttached',
  'onBeforeMount',
  'onBeforeUnmount',
  'onBeforeUpdate',
  'onDeactivated',
  'onDetached',
  'onError',
  'onErrorCaptured',
  'onHide',
  'onLaunch',
  'onLoad',
  'onMemoryWarning',
  'onMounted',
  'onMoved',
  'onPageNotFound',
  'onPageScroll',
  'onPullDownRefresh',
  'onReachBottom',
  'onReady',
  'onResize',
  'onRouteDone',
  'onSaveExitState',
  'onScopeDispose',
  'onServerPrefetch',
  'onShareAppMessage',
  'onShareTimeline',
  'onShow',
  'onTabItemTap',
  'onThemeChange',
  'onUnhandledRejection',
  'onUnload',
  'onUnmounted',
  'onUpdated',
  'prelinkReactiveTree',
  'provide',
  'provideGlobal',
  'reactive',
  'readonly',
  'ref',
  'registerApp',
  'registerComponent',
  'registerPageLayoutBridge',
  'registerRuntimeLayoutHosts',
  'removeMutationRecorder',
  'resetWevuDefaults',
  'resolveLayoutBridge',
  'resolveLayoutHost',
  'resolveRuntimePageLayoutName',
  'runSetupFunction',
  'setCurrentInstance',
  'setCurrentSetupContext',
  'setDeepWatchStrategy',
  'setGlobalProvidedValue',
  'setPageLayout',
  'setRuntimeSetDataVisibility',
  'setWevuDefaults',
  'shallowReactive',
  'shallowReadonly',
  'shallowRef',
  'startBatch',
  'stop',
  'storeToRefs',
  'syncRuntimePageLayoutState',
  'syncRuntimePageLayoutStateFromRuntime',
  'teardownRuntimeInstance',
  'toRaw',
  'toRef',
  'toRefs',
  'toValue',
  'touchReactive',
  'traverse',
  'triggerRef',
  'unref',
  'unregisterPageLayoutBridge',
  'unregisterRuntimeLayoutHosts',
  'use',
  'useAttrs',
  'useBindModel',
  'useDisposables',
  'useIntersectionObserver',
  'useLayoutBridge',
  'useLayoutHosts',
  'useModel',
  'useNativeInstance',
  'useNativePageRouter',
  'useNativeRouter',
  'usePageLayout',
  'usePageScrollThrottle',
  'useSlots',
  'useTemplateRef',
  'useUpdatePerformanceListener',
  'version',
  'waitForLayoutHost',
  'watch',
  'watchEffect',
  'watchPostEffect',
  'watchSyncEffect',
] as const

describe('export barrels', () => {
  it('loads public exports', () => {
    expect(api).toMatchObject({
      createWeapi: expect.any(Function),
      wpi: expect.any(Object),
    })
    expect(router).toMatchObject({
      NavigationFailureType: expect.any(Object),
      createRouter: expect.any(Function),
      createNavigationFailure: expect.any(Function),
      isNavigationFailure: expect.any(Function),
      parseQuery: expect.any(Function),
      resolveRouteLocation: expect.any(Function),
      stringifyQuery: expect.any(Function),
      useNativePageRouter: expect.any(Function),
      useNativeRouter: expect.any(Function),
      useRoute: expect.any(Function),
      useRouter: expect.any(Function),
    })
    expect(reactivity).toBeTruthy()
    expect(runtime).toBeTruthy()
    expect(store).toBeTruthy()
    expect(root).toBeTruthy()
  })

  it('covers all runtime exports of root entry', () => {
    const keys = Object.keys(root).sort()
    expect(keys).toEqual([...new Set([
      ...ROOT_RUNTIME_EXPORTS,
      ...Object.keys(webApis),
    ])].sort())
  })

  it('re-exports web api helpers from fetch entry', () => {
    expect(fetchEntry.installWebRuntimeGlobals).toBe(webApis.installWebRuntimeGlobals)
    expect(fetchEntry.installAbortGlobals).toBe(webApis.installAbortGlobals)
    expect(fetchEntry.HeadersPolyfill).toBe(webApis.HeadersPolyfill)
    expect(fetchEntry.RequestPolyfill).toBe(webApis.RequestPolyfill)
    expect(fetchEntry.ResponsePolyfill).toBe(webApis.ResponsePolyfill)
    expect(fetchEntry.setMiniProgramNetworkDefaults).toBe(webApis.setMiniProgramNetworkDefaults)
    expect(fetchEntry.WebSocketPolyfill).toBe(webApis.WebSocketPolyfill)
  })
})
