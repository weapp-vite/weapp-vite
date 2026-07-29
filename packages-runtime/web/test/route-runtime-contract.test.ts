import { afterEach, describe, expect, it, vi } from 'vitest'

const runtime = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  app: {
    bindVisibility: vi.fn(),
    ensureLaunched: vi.fn(),
    getEnterOptions: vi.fn(() => ({ path: 'enter' })),
    getLaunchOptions: vi.fn(() => ({ path: 'launch' })),
    instance: { app: true } as unknown,
    register: vi.fn((options: unknown) => options),
  },
  configureRouting: vi.fn(),
  configureTabBar: vi.fn(),
  configureWebSeo: vi.fn(),
  defineComponent: vi.fn(),
  dispatchPageLifetime: vi.fn(),
  ensureNativeComponentsDefined: vi.fn(),
  ensureNavigationBarDefined: vi.fn(),
  getHistoryStack: vi.fn((state: any) => state?.stack),
  navigationMetrics: vi.fn(),
  currentAppEntry: undefined as (() => unknown) | undefined,
  pageStack: undefined as FakePageStack | undefined,
  popState: undefined as ((target: any, state: any) => void) | undefined,
  readRouteTarget: vi.fn(),
  resourceHints: vi.fn(),
  routeResult: vi.fn(async (api: string, options: unknown, succeeded: boolean, reason?: string) => ({
    api,
    options,
    reason,
    succeeded,
  })),
  rpx: vi.fn(),
  setButtonFormConfig: vi.fn(),
  setExecutionMode: vi.fn(),
  setWarningOptions: vi.fn(),
  syncDocumentHead: vi.fn(),
  syncRouting: vi.fn(),
  syncTabBarRoute: vi.fn(),
  switchTab: undefined as ((options: any) => unknown) | undefined,
  tabPaths: [] as string[],
  viewport: vi.fn(),
}))

class FakePageStack {
  entries: Array<{ active: boolean, id: string, instance?: unknown, query: Record<string, string> }> = []
  tabPages = new Set<string>()

  constructor(
    private readonly registry: Map<string, unknown>,
    private readonly beforeMount: (entry: unknown) => void,
  ) {
    runtime.pageStack = this
  }

  configureTabPages(ids: Iterable<string>) {
    this.tabPages = new Set(ids)
  }

  push(id: string, query: Record<string, string>) {
    if (!this.registry.has(id)) {
      return false
    }
    const entry = { active: true, id, query }
    this.beforeMount(entry)
    this.entries.push(entry)
    return true
  }

  replace(id: string, query: Record<string, string>) {
    if (!this.registry.has(id)) {
      return false
    }
    const entry = { active: true, id, query }
    this.beforeMount(entry)
    if (this.entries.length) {
      this.entries[this.entries.length - 1] = entry
    }
    else {
      this.entries.push(entry)
    }
    return true
  }

  relaunch(id: string, query: Record<string, string>) {
    if (!this.registry.has(id)) {
      return false
    }
    this.entries.length = 0
    return this.push(id, query)
  }

  switchTab(id: string, query: Record<string, string>) {
    if (!this.tabPages.has(id) || !this.registry.has(id)) {
      return false
    }
    return this.relaunch(id, query)
  }

  back(delta = 1) {
    if (this.entries.length <= 1) {
      return false
    }
    this.entries.splice(Math.max(1, this.entries.length - Math.max(1, delta)))
    return true
  }
}

vi.mock('../src/shared/slugify', () => ({
  slugify: (id: string, prefix: string) => `${prefix}-${id.replaceAll('/', '-')}`,
}))

vi.mock('../src/runtime/appShell/tabBar', () => ({
  configureTabBar: runtime.configureTabBar,
  getTabBarPagePaths: () => runtime.tabPaths,
  syncTabBarRoute: runtime.syncTabBarRoute,
}))

vi.mock('../src/runtime/button', () => ({ setButtonFormConfig: runtime.setButtonFormConfig }))
vi.mock('../src/runtime/component', () => ({ defineComponent: runtime.defineComponent }))
vi.mock('../src/runtime/execution', () => ({ setRuntimeExecutionMode: runtime.setExecutionMode }))
vi.mock('../src/runtime/nativeComponents', () => ({
  ensureNativeComponentsDefined: runtime.ensureNativeComponentsDefined,
}))
vi.mock('../src/runtime/navigationBar', () => ({
  ensureNavigationBarDefined: runtime.ensureNavigationBarDefined,
  setNavigationBarMetrics: runtime.navigationMetrics,
}))
vi.mock('../src/runtime/rpx', () => ({ setupRpx: runtime.rpx }))
vi.mock('../src/runtime/seo', () => ({
  configureWebSeo: runtime.configureWebSeo,
  setupWebResourceHints: runtime.resourceHints,
  syncWebDocumentHead: runtime.syncDocumentHead,
}))
vi.mock('../src/runtime/viewport', () => ({ setupWebViewport: runtime.viewport }))
vi.mock('../src/runtime/warning', () => ({ setRuntimeWarningOptions: runtime.setWarningOptions }))
vi.mock('../src/runtime/polyfill/appState', () => ({
  resolveCurrentPages: (entries: Array<{ instance?: unknown }>) => entries.flatMap(entry => entry.instance ? [entry.instance] : []),
}))
vi.mock('../src/runtime/polyfill/routeRuntime/appLifecycle', () => ({
  AppLifecycleRuntime: class {
    constructor(currentEntry: () => unknown) {
      runtime.currentAppEntry = currentEntry
    }

    bindVisibility = runtime.app.bindVisibility
    ensureLaunched = runtime.app.ensureLaunched
    getEnterOptions = runtime.app.getEnterOptions
    getLaunchOptions = runtime.app.getLaunchOptions
    register = runtime.app.register
    instance = runtime.app.instance
  },
}))
vi.mock('../src/runtime/polyfill/routeRuntime/history', () => ({
  configureWebRouting: runtime.configureRouting,
  getWebHistoryStack: runtime.getHistoryStack,
  readWebRouteTarget: runtime.readRouteTarget,
  syncWebRouting: runtime.syncRouting,
}))
vi.mock('../src/runtime/polyfill/routeRuntime/lifecycle', () => ({
  augmentPageComponentOptions: (component: unknown) => component,
  dispatchPageLifetimeToComponents: runtime.dispatchPageLifetime,
}))
vi.mock('../src/runtime/polyfill/routeRuntime/options', () => ({
  normalizeComponentOptions: (options?: unknown) => options ?? {},
  normalizePageOptions: (options?: any) => ({
    component: options?.component ?? {},
    hooks: options?.hooks ?? {},
  }),
}))
vi.mock('../src/runtime/polyfill/routeRuntime/result', () => ({ resolveRouteAction: runtime.routeResult }))
vi.mock('../src/runtime/polyfill/routeRuntime/stack', () => ({ PageStackRuntime: FakePageStack }))
vi.mock('../src/runtime/polyfill/routeRuntime/url', () => ({
  parsePageUrl: (url: string) => {
    const [id, queryText = ''] = url.replace(/^\//, '').split('?')
    return { id, query: Object.fromEntries(new URLSearchParams(queryText)) }
  },
}))

describe('web route runtime orchestration', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initializes, registers and routes through every orchestration branch', async () => {
    const routes = await import('../src/runtime/polyfill/routeRuntime')
    const resizeListeners: Array<() => void> = []

    runtime.configureRouting.mockImplementation((_config, _ids, callback) => {
      runtime.addEventListener.mockImplementation((_type, listener) => resizeListeners.push(listener))
      runtime.popState = callback
    })
    runtime.configureTabBar.mockImplementation((_config, callback) => {
      runtime.switchTab = callback
    })

    routes.initializePageRoutes([], {
      rpx: { designWidth: 375 },
      navigationBar: { statusBarHeight: 20, navigationBarHeight: 44 },
      form: { reportSubmit: true },
      runtime: {
        executionMode: 'strict',
        warnings: { dedupe: false, level: 'error' },
        viewport: { width: 'device-width' },
        routing: { mode: 'history' },
        seo: { title: 'Web' },
        resourceHints: { preconnect: ['https://example.com'] },
      },
    } as any)
    expect(runtime.setExecutionMode).toHaveBeenCalledWith('strict')
    expect(runtime.setWarningOptions).toHaveBeenCalledWith({ dedupe: false, level: 'error' })
    expect(runtime.viewport).toHaveBeenCalled()
    expect(runtime.configureWebSeo).toHaveBeenCalled()
    expect(runtime.resourceHints).toHaveBeenCalled()
    expect(runtime.app.bindVisibility).toHaveBeenCalled()

    vi.stubGlobal('window', {})
    routes.registerPage(undefined, { id: 'pages/home/index' })
    const homeOptions = { component: { data: { ready: true } }, hooks: { onShow: vi.fn() } }
    expect(routes.registerPage(homeOptions as any, {
      id: 'pages/home/index',
      navigationBar: { title: 'Home' },
      style: '.home{}',
      template: () => '<view />',
    })).toBe(homeOptions)
    routes.registerPage({}, { id: 'pages/detail/index' })
    routes.registerPage({}, { id: 'pages/settings/index' })
    expect(runtime.ensureNavigationBarDefined).toHaveBeenCalled()
    expect(runtime.defineComponent).toHaveBeenCalledWith(
      'wv-page-pages-home-index',
      expect.objectContaining({ id: 'pages/home/index' }),
    )

    const componentOptions = { methods: { tap: vi.fn() } }
    expect(routes.registerComponent(componentOptions as any, { id: 'components/card/index' })).toBe(componentOptions)
    routes.registerComponent(undefined, { id: 'components/card/index', template: () => '<slot />' })
    expect(runtime.defineComponent).toHaveBeenCalledWith(
      'wv-component-components-card-index',
      expect.objectContaining({ id: 'components/card/index' }),
    )
    for (const [, definition] of runtime.defineComponent.mock.calls) {
      definition.template()
    }
    expect(routes.registerApp({ onLaunch: vi.fn() })).toEqual({ onLaunch: expect.any(Function) })
    expect(runtime.currentAppEntry?.()).toBeUndefined()

    runtime.tabPaths = ['pages/home/index', 'pages/settings/index']
    runtime.readRouteTarget.mockReturnValueOnce({ id: 'pages/home/index', query: { source: 'deep-link' } })
    routes.initializePageRoutes(['pages/home/index', 'pages/detail/index', 'pages/settings/index'], {
      form: { reportSubmit: false },
      navigationBar: { statusBarHeight: 21 },
      rpx: { designWidth: 750 },
    } as any)
    expect(runtime.pageStack?.entries).toHaveLength(1)
    expect(runtime.pageStack?.entries[0]).toMatchObject({
      id: 'pages/home/index',
      query: { source: 'deep-link' },
    })
    expect(runtime.rpx).toHaveBeenCalledWith({ designWidth: 750 })
    expect(runtime.navigationMetrics).toHaveBeenCalledWith({ statusBarHeight: 21 })
    expect(runtime.setButtonFormConfig).toHaveBeenCalledWith({ reportSubmit: false })
    expect(runtime.syncRouting).toHaveBeenCalledWith(expect.any(Array), 'replace')

    vi.stubGlobal('window', { addEventListener: runtime.addEventListener })
    routes.initializePageRoutes(['pages/home/index', 'pages/detail/index', 'pages/settings/index'])
    routes.initializePageRoutes(['pages/home/index'])
    expect(runtime.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    const resize = resizeListeners[0]
    expect(resize).toBeTypeOf('function')
    runtime.pageStack!.entries.length = 0
    resize?.()
    runtime.pageStack!.entries.push({
      active: true,
      id: 'pages/home/index',
      instance: { page: true },
      query: {},
    })
    resize?.()
    expect(runtime.dispatchPageLifetime).toHaveBeenCalledWith({ page: true }, 'resize')

    expect(routes.getCurrentPageInstance()).toEqual({ page: true })
    expect(runtime.currentAppEntry?.()).toMatchObject({ id: 'pages/home/index' })
    expect(routes.getCurrentPagesInternal()).toEqual([{ page: true }])
    expect(routes.getAppInstance()).toBe(runtime.app.instance)
    expect(routes.getLaunchOptionsSync()).toEqual({ path: 'launch' })
    expect(routes.getEnterOptionsSync()).toEqual({ path: 'enter' })

    await expect(routes.navigateTo({ url: '/pages/detail/index?from=home' })).resolves.toMatchObject({
      api: 'navigateTo',
      succeeded: true,
    })
    expect(runtime.syncRouting).toHaveBeenLastCalledWith(expect.any(Array), 'push')
    await expect(routes.redirectTo({ url: '/pages/settings/index' })).resolves.toMatchObject({
      api: 'redirectTo',
      succeeded: true,
    })
    await expect(routes.reLaunch({ url: '/pages/home/index' })).resolves.toMatchObject({
      api: 'reLaunch',
      succeeded: true,
    })
    await expect(routes.switchTab({ url: '/pages/settings/index' })).resolves.toMatchObject({
      api: 'switchTab',
      succeeded: true,
    })
    await expect(runtime.switchTab?.('/pages/home/index')).resolves.toMatchObject({
      api: 'switchTab',
      succeeded: true,
    })
    await routes.navigateTo({ url: '/pages/detail/index' })
    await expect(routes.navigateBack({ delta: 1 })).resolves.toMatchObject({
      api: 'navigateBack',
      succeeded: true,
    })

    for (const [api, action] of [
      ['navigateTo', routes.navigateTo],
      ['redirectTo', routes.redirectTo],
      ['reLaunch', routes.reLaunch],
      ['switchTab', routes.switchTab],
    ] as const) {
      await expect(action({ url: '/pages/missing/index' })).resolves.toMatchObject({ api, succeeded: false })
    }
    await expect(routes.navigateTo({} as any)).resolves.toMatchObject({ succeeded: false })
    await expect(routes.redirectTo({} as any)).resolves.toMatchObject({ succeeded: false })
    await expect(routes.reLaunch({} as any)).resolves.toMatchObject({ succeeded: false })
    await expect(routes.switchTab({} as any)).resolves.toMatchObject({ succeeded: false })
    runtime.pageStack!.entries.splice(0, runtime.pageStack!.entries.length, {
      active: true,
      id: 'pages/home/index',
      query: {},
    })
    await expect(routes.navigateBack()).resolves.toMatchObject({ succeeded: false })

    runtime.pageStack!.entries.length = 0
    runtime.readRouteTarget.mockReturnValueOnce(undefined)
    routes.initializePageRoutes(['pages/detail/index'])
    expect(runtime.pageStack!.entries).toEqual([expect.objectContaining({
      id: 'pages/detail/index',
      query: {},
    })])
    runtime.pageStack!.entries.length = 0
    routes.initializePageRoutes(['pages/not-registered/index'])
    expect(runtime.pageStack!.entries).toEqual([])
  })

  it('reconciles shorter, longer, divergent and direct browser history targets', async () => {
    const routes = await import('../src/runtime/polyfill/routeRuntime')
    const reconcile = runtime.popState as (
      target: { id: string, query: Record<string, string> } | undefined,
      state: unknown,
    ) => void
    const stack = runtime.pageStack!

    stack.entries.splice(0, stack.entries.length, { active: true, id: 'pages/home/index', query: {} }, { active: true, id: 'pages/detail/index', query: {} })
    reconcile(undefined, { stack: [{ id: 'pages/home/index', query: { restored: '1' } }] })
    expect(stack.entries).toHaveLength(1)

    reconcile(undefined, { stack: [
      { id: 'pages/home/index', query: {} },
      { id: 'pages/detail/index', query: { next: '1' } },
    ] })
    expect(stack.entries).toHaveLength(2)
    expect(stack.entries[1]).toMatchObject({ id: 'pages/detail/index', query: { next: '1' } })

    reconcile(undefined, { stack: [{ id: 'pages/settings/index', query: { reset: '1' } }] })
    expect(stack.entries).toEqual([expect.objectContaining({ id: 'pages/settings/index' })])
    reconcile(undefined, { stack: [] })
    reconcile({ id: 'pages/home/index', query: { direct: '1' } }, undefined)
    expect(stack.entries).toEqual([expect.objectContaining({ id: 'pages/home/index' })])
    reconcile({ id: 'pages/missing/index', query: {} }, undefined)

    stack.entries.length = 0
    reconcile(undefined, { stack: [{ id: 'pages/missing/index', query: {} }] })
    expect(runtime.syncDocumentHead).toHaveBeenLastCalledWith({ route: undefined, title: undefined })

    const back = vi.spyOn(stack, 'back').mockImplementationOnce(() => {
      stack.entries.length = 0
      return true
    })
    await expect(routes.navigateBack()).resolves.toMatchObject({ succeeded: true })
    expect(runtime.syncTabBarRoute).toHaveBeenLastCalledWith('')
    back.mockRestore()

    stack.entries.length = 0
    expect(routes.getCurrentPageInstance()).toBeUndefined()
  })
})
