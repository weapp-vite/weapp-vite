export type ApiCompatibility = 'vue-compatible' | 'vue-different' | 'miniprogram-bridge' | 'wevu-extension'
export type ApiKind = 'global' | 'macro' | 'reactivity' | 'lifecycle' | 'setup' | 'options' | 'store' | 'runtime'
export type ApiScope = 'app' | 'page' | 'component'
export type ApiEntry = 'wevu' | 'wevu/router' | 'wevu/store'
export type ApiEntryTab = 'core' | 'router' | 'store'
export type CoreApiCategory = 'all' | 'core' | 'macros' | 'reactivity' | 'lifecycle' | 'setup' | 'template' | 'options' | 'runtime'

export interface CoreApiCategoryOption {
  value: CoreApiCategory
  label: string
  group?: string
}

export interface WevuApiItem {
  name: string
  href: string
  group: string
  kind: ApiKind
  compatibility: ApiCompatibility
  entry: ApiEntry
  scopes?: ApiScope[]
  keywords?: string[]
}

export const wevuCoreCategories: CoreApiCategoryOption[] = [
  { value: 'all', label: '全部' },
  { value: 'core', label: '入口与组件', group: '入口与 Vue 兼容' },
  { value: 'macros', label: '编译宏', group: 'Script Setup 宏' },
  { value: 'reactivity', label: '响应式', group: '响应式与调度' },
  { value: 'lifecycle', label: '生命周期', group: '生命周期' },
  { value: 'setup', label: 'Setup 与宿主', group: 'Setup 与宿主能力' },
  { value: 'template', label: '模板与模型', group: '模板与模型工具' },
  { value: 'options', label: 'Options', group: 'Options API' },
  { value: 'runtime', label: '运行时桥接', group: '运行时桥接' },
]

export function getApiEntryHref(value: ApiEntryTab) {
  return value === 'core' ? '/wevu/api/' : `/wevu/api/?entry=${value}`
}

export function getCoreCategoryHref(value: CoreApiCategory) {
  return value === 'all' ? '/wevu/api/' : `/wevu/api/?category=${value}`
}

export function resolveWevuApiNavigation(url: URL): { entry: ApiEntryTab, category: CoreApiCategory } {
  const entryParam = url.searchParams.get('entry')
  const entry = entryParam === 'router' || entryParam === 'store' ? entryParam : 'core'
  const categoryParam = url.searchParams.get('category')
  const category = entry === 'core' && wevuCoreCategories.some(item => item.value === categoryParam)
    ? categoryParam as CoreApiCategory
    : 'all'

  return { entry, category }
}

function api(
  name: string,
  href: string,
  group: string,
  kind: ApiKind,
  compatibility: ApiCompatibility,
  options: Pick<WevuApiItem, 'entry' | 'scopes' | 'keywords'> = { entry: 'wevu' },
): WevuApiItem {
  return {
    name,
    href,
    group,
    kind,
    compatibility,
    entry: options.entry,
    scopes: options.scopes,
    keywords: options.keywords,
  }
}

const vueCore = (name: string, anchor = name.toLowerCase()) => api(`${name}()`, `/wevu/api/core#${anchor}`, '入口与 Vue 兼容', 'global', 'vue-compatible')
const reactivity = (name: string, compatibility: ApiCompatibility = 'vue-compatible') => api(`${name}()`, `/wevu/api/reactivity#${name.toLowerCase()}`, '响应式与调度', 'reactivity', compatibility)
const lifecycle = (name: string, compatibility: ApiCompatibility, scopes: ApiScope[]) => api(`${name}()`, `/wevu/api/lifecycle#${name.toLowerCase()}`, '生命周期', 'lifecycle', compatibility, { entry: 'wevu', scopes })
const setup = (name: string, anchor = name.toLowerCase(), compatibility: ApiCompatibility = 'wevu-extension') => api(`${name}()`, `/wevu/api/setup-context#${anchor}`, 'Setup 与宿主能力', 'setup', compatibility)

export const wevuApiCatalog: WevuApiItem[] = [
  api('createApp()', '/wevu/api/core#createapp', '入口与 Vue 兼容', 'global', 'vue-different'),
  vueCore('defineComponent'),
  ...['defineProps', 'withDefaults', 'defineEmits', 'defineSlots', 'defineExpose', 'defineModel', 'defineOptions']
    .map(name => api(`${name}()`, `/wevu/api/core#${name.toLowerCase()}`, 'Script Setup 宏', 'macro', 'vue-compatible')),
  api('definePageMeta()', '/wevu/api/core#definepagemeta', 'Script Setup 宏', 'macro', 'wevu-extension'),
  api('defineAppSetup()', '/wevu/api/core#defineappsetup', 'Script Setup 宏', 'macro', 'wevu-extension'),
  ...['ref', 'customRef', 'reactive', 'shallowRef', 'shallowReactive', 'readonly', 'shallowReadonly', 'computed', 'watch', 'watchEffect', 'watchPostEffect', 'watchSyncEffect', 'effectScope', 'getCurrentScope', 'onScopeDispose', 'toRef', 'toRefs', 'unref', 'toValue', 'triggerRef', 'toRaw', 'markRaw', 'isRef', 'isReactive', 'isShallowRef', 'isShallowReactive', 'isRaw', 'isReadonly', 'isProxy', 'nextTick']
    .map(name => reactivity(name)),
  ...['effect', 'stop', 'batch', 'startBatch', 'endBatch', 'traverse']
    .map(name => reactivity(name, 'wevu-extension')),
  ...[
    ['onLaunch', ['app']],
    ['onShow', ['app', 'page', 'component']],
    ['onHide', ['app', 'page', 'component']],
    ['onError', ['app']],
    ['onPageNotFound', ['app']],
    ['onUnhandledRejection', ['app']],
    ['onThemeChange', ['app']],
    ['onMemoryWarning', ['app']],
    ['onLoad', ['page']],
    ['onReady', ['page', 'component']],
    ['onUnload', ['page']],
    ['onPullDownRefresh', ['page']],
    ['onReachBottom', ['page']],
    ['onPageScroll', ['page']],
    ['onRouteDone', ['page', 'component']],
    ['onTabItemTap', ['page']],
    ['onResize', ['page', 'component']],
    ['onShareAppMessage', ['page']],
    ['onShareTimeline', ['page']],
    ['onAddToFavorites', ['page']],
    ['onSaveExitState', ['page']],
    ['onAttached', ['component']],
    ['onDetached', ['component']],
    ['onMoved', ['component']],
  ].map(([name, scopes]) => lifecycle(name as string, 'miniprogram-bridge', scopes as ApiScope[])),
  ...['onBeforeMount', 'onMounted', 'onBeforeUpdate', 'onUpdated', 'onBeforeUnmount', 'onUnmounted', 'onActivated', 'onDeactivated', 'onErrorCaptured', 'onServerPrefetch']
    .map(name => lifecycle(name, name === 'onServerPrefetch' ? 'vue-different' : 'vue-different', ['page', 'component'])),
  ...['getCurrentInstance', 'getCurrentSetupContext', 'provide', 'inject'].map(name => setup(name, name.toLowerCase(), 'vue-compatible')),
  ...['provideGlobal', 'injectGlobal', 'useNativeInstance', 'useNativeRouter', 'useNativePageRouter', 'useBindModel', 'useChangeModel', 'useIntersectionObserver', 'useElementIntersectionObserver', 'useSelectorQuery', 'useBoundingClientRect', 'useSelectorFields', 'useScrollOffset', 'useDisposables', 'usePageLayout', 'setPageLayout', 'usePageStack', 'getCurrentPageStackSnapshot', 'useNavigationBarMetrics', 'getNavigationBarMetrics', 'usePageScrollThrottle', 'useUpdatePerformanceListener', 'useAsyncPullDownRefresh']
    .map((name) => {
      const sharedAnchor: Record<string, string> = {
        getCurrentPageStackSnapshot: 'usepagestack',
        getNavigationBarMetrics: 'usenavigationbarmetrics',
        injectGlobal: 'provideglobal',
        provideGlobal: 'provideglobal',
        setPageLayout: 'usepagelayout',
      }
      return setup(name, sharedAnchor[name] || name.toLowerCase(), name.startsWith('provide') || name.startsWith('inject') ? 'wevu-extension' : 'miniprogram-bridge')
    }),
  ...['use', 'mergeModels', 'useModel', 'useAttrs', 'useSlots', 'useTemplateRef', 'normalizeClass', 'normalizeStyle']
    .map(name => api(`${name}()`, `/wevu/api/core#${name.toLowerCase()}`, '模板与模型工具', 'setup', name === 'use' ? 'wevu-extension' : 'vue-compatible')),
  ...['props', 'emits', 'data', 'setup', 'computed', 'methods', 'watch']
    .map(name => api(name, `/wevu/api/options-api#${name}`, 'Options API', 'options', 'vue-different', { entry: 'wevu', scopes: ['page', 'component'] })),
  ...['properties', 'behaviors', 'lifetimes', 'pageLifetimes', 'externalClasses', 'options', 'observers', 'relations', 'features', 'setData', 'setupLifecycle']
    .map(name => api(name, `/wevu/api/options-api#${name.toLowerCase()}`, 'Options API', 'options', 'miniprogram-bridge', { entry: 'wevu', scopes: ['page', 'component'] })),
  ...['defineStore', 'createStore', 'storeToRefs'].map(name => api(`${name}()`, `/wevu/api/store#${name.toLowerCase()}`, 'Store', 'store', name === 'defineStore' || name === 'storeToRefs' ? 'vue-compatible' : 'wevu-extension', { entry: 'wevu/store' })),
  ...['createRouter', 'useRouter', 'useRoute', 'parseQuery', 'stringifyQuery', 'isNavigationFailure']
    .map(name => api(`${name}()`, '/wevu/router', 'Router', 'runtime', name === 'useRouter' || name === 'useRoute' ? 'vue-different' : 'wevu-extension', { entry: 'wevu/router' })),
  ...['setWevuDefaults', 'resetWevuDefaults', 'markNoSetData', 'isNoSetData', 'addMutationRecorder', 'removeMutationRecorder']
    .map(name => api(`${name}()`, `/wevu/api/runtime-bridge#${name.toLowerCase()}`, '运行时桥接', 'runtime', 'wevu-extension')),
]

export const wevuApiGroups = [...new Set(wevuApiCatalog.map(item => item.group))]
