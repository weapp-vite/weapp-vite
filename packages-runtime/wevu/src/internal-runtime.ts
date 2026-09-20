export { createApp } from './runtime/app'
export { takePendingRuntimeAppRegistration } from './runtime/app/pending'
export type {
  HighFrequencyWarningMonitorOptions,
  LayoutHostBinding,
  RuntimeCapabilityName,
  RuntimeCapabilityRegistry,
  ScopedSlotMountState,
  SetDataScheduler,
  SetDataSchedulerOptions,
  TemplateRefBinding,
} from './runtime/capabilities'
export { useCssModule, useCssVars } from './runtime/css'
export {
  INTERNAL_DEFAULTS_SCOPE_KEY,
  resetWevuDefaults,
  setWevuDefaults,
} from './runtime/defaults'
export {
  createIsolatedWevuComponentDefinition,
  createWevuComponent,
  createWevuComponentDefinition,
  defineComponent,
  getWevuComponentLifecycleDefinition,
} from './runtime/define'
export { useDisposables } from './runtime/disposables'
export { useElementIntersectionObserver } from './runtime/elementIntersectionObserver'
export { installInlineEvents } from './runtime/features/inlineEvents'
export { installLayout } from './runtime/features/layout'
export { installPatchStrategy } from './runtime/features/patchStrategy'
export {
  resolveLayoutBridge,
  resolveLayoutHost,
  useLayoutBridge,
  useLayoutHosts,
  waitForLayoutHost,
} from './runtime/features/publicLayout'
export {
  resolveRuntimePageLayoutName,
  setPageLayout,
  syncRuntimePageLayoutState,
  syncRuntimePageLayoutStateFromRuntime,
  usePageLayout,
} from './runtime/features/publicLayout'
export {
  createWevuScopedSlotComponent,
  installScopedSlots,
} from './runtime/features/scopedSlots'
export { installSetDataHighFrequencyWarning } from './runtime/features/setDataHighFrequencyWarning'
export { installTemplateRefs } from './runtime/features/templateRefs'
export {
  callHookList,
  callHookReturn,
  getCurrentInstance,
  getCurrentSetupContext,
  onActivated,
  onAddToFavorites,
  onAttached,
  onBeforeMount,
  onBeforeUnmount,
  onBeforeUpdate,
  onDeactivated,
  onDetached,
  onError,
  onErrorCaptured,
  onHide,
  onLaunch,
  onLoad,
  onMemoryWarning,
  onMounted,
  onMoved,
  onPageNotFound,
  onPageScroll,
  onPullDownRefresh,
  onReachBottom,
  onReady,
  onResize,
  onRouteDone,
  onSaveExitState,
  onServerPrefetch,
  onShareAppMessage,
  onShareTimeline,
  onShow,
  onTabItemTap,
  onThemeChange,
  onUnhandledRejection,
  onUnload,
  onUnmounted,
  onUpdated,
  setCurrentInstance,
  setCurrentSetupContext,
} from './runtime/hooks'

export { useIntersectionObserver } from './runtime/intersectionObserver'

export {
  createTextVNode,
  createVNode,
  Fragment,
  isVNode,
  mergeProps,
  normalizeJsxIsland,
  resolveComponent,
  resolveDirective,
  transformOn,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelText,
  vShow,
  withDirectives,
} from './runtime/jsxIsland'
export { isNoSetData, markNoSetData } from './runtime/noSetData'
export {
  getCurrentPageStackSnapshot,
  getNavigationBarMetrics,
  useNavigationBarMetrics,
  usePageStack,
} from './runtime/pageEnvironment'
export { usePageScrollThrottle } from './runtime/pageScroll'
export {
  hasInjectionContext,
  inject,
  injectGlobal,
  provide,
  provideGlobal,
  setGlobalProvidedValue,
} from './runtime/provide'
export { useAsyncPullDownRefresh } from './runtime/pullDownRefresh'
export {
  mountRuntimeInstance,
  registerApp,
  registerComponent,
  runSetupFunction,
  setRuntimeSetDataVisibility,
  teardownRuntimeInstance,
} from './runtime/register'
export {
  useBoundingClientRect,
  useScrollOffset,
  useSelectorFields,
  useSelectorQuery,
} from './runtime/selectorQuery'
export { createUniAppHost } from './runtime/uniAppHost'
export { useUpdatePerformanceListener } from './runtime/updatePerformance'
export { defineAppSetup, use } from './runtime/use'
export {
  mergeModels,
  useAttrs,
  useBindModel,
  useChangeModel,
  useModel,
  useNativeInstance,
  useNativePageRouter,
  useNativeRouter,
  useSlots,
  useTemplateRef,
} from './runtime/vueCompat'
export { version } from './version'
