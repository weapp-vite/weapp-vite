import type { ApiCompatibility, ApiEntryTab, ApiKind, ApiScope, CoreApiCategory, CoreApiCategoryOption, WevuApiItem, WevuApiSeed } from './wevuApiCatalogTypes'
import { getWevuApiDescription } from './wevuApiDescriptions'
import { wevuDirectiveSeeds, wevuElementSeeds, wevuHtmlTagSeeds } from './wevuApiTemplateMatrix'
import { wevuTypeSeeds } from './wevuApiTypeMatrix'
import { wevuApplicationApiSeeds, wevuVueGapSeeds } from './wevuApiVueBaseline'

export type { ApiCompatibility, ApiEntry, ApiEntryTab, ApiKind, ApiPhase, ApiScope, CoreApiCategory, CoreApiCategoryOption, WevuApiItem } from './wevuApiCatalogTypes'

export const wevuCoreCategories: CoreApiCategoryOption[] = [
  { value: 'all', label: '全部' },
  { value: 'application', label: '应用与通用', group: '应用与通用 API' },
  { value: 'macros', label: '编译宏', group: 'Script Setup 宏' },
  { value: 'reactivity', label: '响应式', group: '响应式与调度' },
  { value: 'lifecycle', label: '生命周期', group: '生命周期' },
  { value: 'setup', label: 'Setup 与宿主', group: 'Setup 与宿主能力' },
  { value: 'options', label: 'Options', group: 'Options API' },
  { value: 'instances', label: '组件实例', group: '组件实例' },
  { value: 'directives', label: '模板指令', group: '模板指令' },
  { value: 'elements', label: '特殊元素', group: '特殊元素与内置组件' },
  { value: 'html-tags', label: 'HTML 标签', group: 'HTML 标签转换' },
  { value: 'types', label: 'TypeScript', group: 'TypeScript 类型' },
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

export function matchesWevuApiSearch(item: WevuApiItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) {
    return true
  }
  const searchText = [item.name, item.description, item.group, item.entry, item.kind, item.phase, item.transform, ...(item.keywords || [])].join(' ').toLowerCase()
  return searchText.includes(normalizedQuery)
}

function api(
  name: string,
  href: string,
  group: string,
  kind: ApiKind,
  compatibility: ApiCompatibility,
  options: Pick<WevuApiItem, 'entry' | 'scopes' | 'keywords'> & Partial<Pick<WevuApiItem, 'phase' | 'vueHref' | 'transform'>> = { entry: 'wevu' },
): WevuApiItem {
  const entry = options.entry
  return {
    name,
    description: getWevuApiDescription(entry, name),
    href,
    group,
    kind,
    phase: options.phase || (kind === 'macro' ? 'compile' : kind === 'type' ? 'type' : 'runtime'),
    compatibility,
    entry,
    scopes: options.scopes,
    keywords: options.keywords,
    vueHref: options.vueHref,
    transform: options.transform,
  }
}

function fromSeed(seed: WevuApiSeed): WevuApiItem {
  return {
    ...seed,
    entry: seed.entry || 'wevu',
  }
}

const vueCore = (name: string, anchor = name.toLowerCase()) => api(`${name}()`, `/wevu/api/core#${anchor}`, '应用与通用 API', 'global', 'vue-compatible')
const reactivity = (name: string, compatibility: ApiCompatibility = 'vue-compatible') => api(`${name}()`, `/wevu/api/reactivity#${name.toLowerCase()}`, '响应式与调度', 'reactivity', compatibility)
const lifecycle = (name: string, compatibility: ApiCompatibility, scopes: ApiScope[]) => api(`${name}()`, `/wevu/api/lifecycle#${name.toLowerCase()}`, '生命周期', 'lifecycle', compatibility, { entry: 'wevu', scopes })
const setup = (name: string, anchor = name.toLowerCase(), compatibility: ApiCompatibility = 'wevu-extension') => api(`${name}()`, `/wevu/api/setup-context#${anchor}`, 'Setup 与宿主能力', 'setup', compatibility)
function routerApi(
  name: string,
  anchor: string,
  group: string,
  kind: ApiKind = 'runtime',
  compatibility: ApiCompatibility = 'vue-different',
  keywords: string[] = [],
) {
  return api(name, `/wevu/api/router#${anchor}`, group, kind, compatibility, { entry: 'wevu/router', keywords })
}

function routerType(name: string, group: string, compatibility: ApiCompatibility = 'vue-different', keywords: string[] = []) {
  return api(name, `/wevu/api/router-types#type-${name.toLowerCase()}`, group, 'type', compatibility, { entry: 'wevu/router', keywords })
}

export const wevuApiCatalog: WevuApiItem[] = [
  api('createApp()', '/wevu/api/core#createapp', '应用与通用 API', 'global', 'vue-different'),
  vueCore('defineComponent'),
  ...wevuApplicationApiSeeds.map(fromSeed),
  ...['defineProps', 'withDefaults', 'defineEmits', 'defineSlots', 'defineExpose', 'defineModel', 'defineOptions']
    .map(name => api(`${name}()`, `/wevu/api/core#${name.toLowerCase()}`, 'Script Setup 宏', 'macro', 'vue-compatible')),
  ...[
    ['defineAppJson()', 'defineappjson', '声明并提取 app.json 配置。'],
    ['definePageJson()', 'definepagejson', '声明并提取页面 JSON 配置。'],
    ['defineComponentJson()', 'definecomponentjson', '声明并提取组件 JSON 配置。'],
    ['defineSitemapJson()', 'definesitemapjson', '以类型安全函数声明 sitemap 配置。'],
    ['defineThemeJson()', 'definethemejson', '以类型安全函数声明主题配置。'],
  ].map(([name, anchor, description]) => ({
    name,
    description,
    href: `/wevu/api/core#${anchor}`,
    group: 'Script Setup 宏',
    kind: 'macro' as const,
    phase: 'compile' as const,
    compatibility: 'wevu-extension' as const,
    entry: 'wevu' as const,
    keywords: ['JSON', 'weapp-vite', '配置宏'],
  })),
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
    .map(name => api(`${name}()`, `/wevu/api/core#${name.toLowerCase()}`, 'Setup 与宿主能力', 'setup', name === 'use' ? 'wevu-extension' : 'vue-compatible')),
  ...['props', 'emits', 'data', 'setup', 'computed', 'methods', 'watch']
    .map(name => api(name, `/wevu/api/options-api#${name}`, 'Options API', 'options', 'vue-different', { entry: 'wevu', scopes: ['page', 'component'] })),
  ...['properties', 'behaviors', 'lifetimes', 'pageLifetimes', 'externalClasses', 'options', 'observers', 'relations', 'features', 'setData', 'setupLifecycle']
    .map(name => api(name, `/wevu/api/options-api#${name.toLowerCase()}`, 'Options API', 'options', 'miniprogram-bridge', { entry: 'wevu', scopes: ['page', 'component'] })),
  ...wevuVueGapSeeds.map(fromSeed),
  ...wevuDirectiveSeeds.map(fromSeed),
  ...wevuElementSeeds.map(fromSeed),
  ...wevuHtmlTagSeeds.map(fromSeed),
  ...wevuTypeSeeds.map(fromSeed),
  api('defineStore()', '/wevu/api/store#definestore', 'Store 入口', 'store', 'vue-different', { entry: 'wevu/store', keywords: ['Pinia', '定义'] }),
  api('createStore()', '/wevu/api/store#createstore', 'Store 入口', 'store', 'wevu-extension', { entry: 'wevu/store', keywords: ['Manager', '隔离'] }),
  api('storeToRefs()', '/wevu/api/store#storetorefs', 'Store 入口', 'store', 'vue-different', { entry: 'wevu/store', keywords: ['Pinia', '解构', '响应式'] }),
  ...[
    ['$id', 'store-id', ['标识', 'id']],
    ['$state', 'store-state', ['状态', 'Options Store']],
    ['$patch()', 'store-patch', ['批量更新', 'mutation']],
    ['$reset()', 'store-reset', ['重置', '初始状态']],
    ['$subscribe()', 'store-subscribe', ['订阅', 'mutation']],
    ['$onAction()', 'store-onaction', ['Action', '订阅']],
  ].map(([name, anchor, keywords]) => api(name as string, `/wevu/api/store#${anchor}`, 'Store 实例', 'store', 'vue-different', { entry: 'wevu/store', keywords: keywords as string[] })),
  api('manager.install()', '/wevu/api/store#storemanager-install', 'Store Manager', 'store', 'vue-different', { entry: 'wevu/store', keywords: ['安装', 'app.use', 'no-op'] }),
  api('manager.use()', '/wevu/api/store#storemanager-use', 'Store Manager', 'store', 'vue-different', { entry: 'wevu/store', keywords: ['插件', 'plugin'] }),
  ...[
    ['state', 'options-state', ['状态', 'Options Store']],
    ['getters', 'options-getters', ['派生状态', 'computed', 'Options Store']],
    ['actions', 'options-actions', ['方法', 'Action', 'Options Store']],
  ].map(([name, anchor, keywords]) => api(name as string, `/wevu/api/store#${anchor}`, 'Options Store', 'options', 'vue-different', { entry: 'wevu/store', keywords: keywords as string[] })),
  ...[
    ['StoreManager', 'storemanager'],
    ['DefineStoreOptions', 'definestoreoptions'],
    ['StoreToRefsResult', 'storetorefsresult'],
    ['ActionContext', 'actioncontext'],
    ['ActionSubscriber', 'actionsubscriber'],
    ['SubscriptionCallback', 'subscriptioncallback'],
    ['StoreSubscribeOptions', 'storesubscribeoptions'],
    ['MutationType', 'mutationtype'],
  ].map(([name, anchor]) => api(name, `/wevu/api/store#${anchor}`, 'Store 类型', 'type', 'wevu-extension', { entry: 'wevu/store', keywords: ['TypeScript', '类型'] })),
  ...[
    ['createRouter()', 'createrouter'],
    ['useRouter()', 'userouter'],
    ['useRoute()', 'useroute'],
  ].map(([name, anchor]) => routerApi(name, anchor, 'Router 入口', 'runtime', 'vue-different', ['Vue Router', '路由实例'])),
  ...[
    ['useNativeRouter()', 'usenativerouter'],
    ['useNativePageRouter()', 'usenativepagerouter'],
  ].map(([name, anchor]) => routerApi(name, anchor, '原生 Router', 'runtime', 'miniprogram-bridge', ['原生路由', 'SetupContextRouter'])),
  ...[
    ['resolveRouteLocation()', 'resolveroutelocation', 'wevu-extension'],
    ['parseQuery()', 'parsequery', 'wevu-extension'],
    ['stringifyQuery()', 'stringifyquery', 'wevu-extension'],
    ['createNavigationFailure()', 'createnavigationfailure', 'wevu-extension'],
    ['isNavigationFailure()', 'isnavigationfailure', 'vue-different'],
    ['NavigationFailureType', 'navigationfailuretype', 'vue-different'],
  ].map(([name, anchor, compatibility]) => routerApi(name, anchor, '解析与导航失败', 'runtime', compatibility as ApiCompatibility, ['resolve', 'query', 'failure'])),
  ...[
    ['router.nativeRouter', 'router-nativerouter'],
    ['router.options', 'router-options'],
    ['router.currentRoute', 'router-currentroute'],
    ['router.install()', 'router-install'],
    ['router.resolve()', 'router-resolve'],
    ['router.isReady()', 'router-isready'],
  ].map(([name, anchor]) => routerApi(name, anchor, 'Router 实例', 'runtime', 'vue-different', ['实例', '状态', '安装'])),
  ...['push', 'replace', 'back', 'go', 'forward']
    .map(name => routerApi(`router.${name}()`, `router-${name}`, '导航方法', 'runtime', 'vue-different', ['跳转', 'navigate', 'history'])),
  ...['hasRoute', 'getRoutes', 'addRoute', 'removeRoute', 'clearRoutes']
    .map(name => routerApi(`router.${name}()`, `router-${name.toLowerCase()}`, '动态路由', 'runtime', 'vue-different', ['路由记录', 'route record', '动态'])),
  ...['beforeEach', 'beforeResolve', 'afterEach', 'onError']
    .map(name => routerApi(`router.${name}()`, `router-${name.toLowerCase()}`, '导航守卫', 'runtime', 'vue-different', ['守卫', 'guard', '错误处理'])),
  ...[
    'RouterNavigation',
    'UseRouterOptions',
    'AddRoute',
    'RouteLocationRaw',
    'RouteLocationNormalizedLoaded',
    'RouteLocationRedirectedFrom',
    'LocationQuery',
    'LocationQueryRaw',
    'LocationQueryValue',
    'LocationQueryValueRaw',
    'RouteParams',
    'RouteParamsRaw',
    'RouteParamValue',
    'RouteParamValueRaw',
    'RouteParamsMode',
    'RouteQueryParser',
    'RouteQueryStringifier',
  ].map(name => routerType(name, '位置与参数类型', 'vue-different', ['TypeScript', 'location', 'query', 'params'])),
  ...[
    'NavigationFailure',
    'NavigationFailureTypeValue',
    'NavigationMode',
    'NavigationRedirect',
    'NavigationGuard',
    'NavigationGuardResult',
    'NavigationGuardContext',
    'NavigationAfterEach',
    'NavigationAfterEachContext',
    'NavigationErrorHandler',
    'NavigationErrorContext',
  ].map(name => routerType(name, '守卫与失败类型', 'vue-different', ['TypeScript', 'guard', 'failure'])),
  ...[
    'NamedRouteRecord',
    'NamedRoutes',
    'RouteMeta',
    'RouteRecordInput',
    'RouteRecordRaw',
    'RouteRecordMatched',
    'RouteRecordRedirect',
  ].map(name => routerType(name, '路由记录类型', 'vue-different', ['TypeScript', 'route record', 'meta'])),
  ...[
    'SetupContextRouter',
    'RouterNavigateToOption',
    'RouterRedirectToOption',
    'RouterReLaunchOption',
    'RouterSwitchTabOption',
    'TypedRouterUrl',
    'TypedRouterTabBarUrl',
    'WevuTypedRouterRouteMap',
  ].map(name => routerType(name, '小程序 Router 类型', 'miniprogram-bridge', ['TypeScript', '原生路由', '类型路由'])),
  ...['setWevuDefaults', 'resetWevuDefaults', 'markNoSetData', 'isNoSetData', 'addMutationRecorder', 'removeMutationRecorder']
    .map(name => api(`${name}()`, `/wevu/api/runtime-bridge#${name.toLowerCase()}`, '运行时桥接', 'runtime', 'wevu-extension')),
]

export const wevuApiGroups = [...new Set(wevuApiCatalog.map(item => item.group))]
