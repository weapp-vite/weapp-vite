import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  launchIsolatedMiniProgram,
  readPageWxml,
  relaunchPage,
  ROUTER_NAVIGATION_SETTLE_TIMEOUT,
  tapControlUntil,
  waitForCurrentPagePath,
  waitForRenderedSelector,
} from './wevu-features.runtime.shared'

const ROUTER_SUB_READY_STORAGE_KEY = '__weapp_vite_router_sub_ready__'
const ROUTER_TARGET_STORAGE_KEY = '__weapp_vite_router_target__'

async function waitForRouterSubReady(miniProgram: any, timeoutMs = 6_000) {
  const start = Date.now()
  let latest: any = null
  while (Date.now() - start <= timeoutMs) {
    latest = await miniProgram.callWxMethodWithOptions('getStorageSync', {
      timeout: 2_500,
    }, ROUTER_SUB_READY_STORAGE_KEY).catch(() => null)
    if (latest?.route === 'pages/router-stability/sub/index' && latest?.componentReady === true) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 220))
  }
  throw new Error(`Failed to confirm router-stability sub page ready: ${JSON.stringify(latest)}`)
}

async function waitForRouterTarget(miniProgram: any, expectedPath: string, expectedSource: string, timeoutMs = ROUTER_NAVIGATION_SETTLE_TIMEOUT) {
  const normalizedExpectedPath = expectedPath.replace(/^\/+/, '')
  const start = Date.now()
  let latest: any = null
  while (Date.now() - start <= timeoutMs) {
    latest = await miniProgram.callWxMethodWithOptions('getStorageSync', {
      timeout: 2_500,
    }, ROUTER_TARGET_STORAGE_KEY).catch(() => null)
    if (latest?.route === normalizedExpectedPath && latest?.source === expectedSource) {
      return latest
    }
    await new Promise(resolve => setTimeout(resolve, 220))
  }
  return null
}

async function enterRouterSubPage(miniProgram: any) {
  const indexPage = await relaunchPage(miniProgram, '/pages/router-stability/index', 'router stability (page context)')
  if (!indexPage) {
    throw new Error('Failed to launch router-stability index page')
  }

  await miniProgram.callWxMethodWithOptions('removeStorageSync', {
    timeout: 2_500,
  }, ROUTER_SUB_READY_STORAGE_KEY).catch(() => {})
  await indexPage.callMethod('_openSubPage')
  const subPage = await waitForCurrentPagePath(
    miniProgram,
    '/pages/router-stability/sub/index',
    ROUTER_NAVIGATION_SETTLE_TIMEOUT,
  )
  if (!subPage) {
    throw new Error('Failed to confirm router-stability sub page readiness')
  }
  await waitForRouterSubReady(miniProgram)
  return await miniProgram.currentPage({
    retries: 2,
    timeout: 5_000,
  }).catch(() => subPage)
}

async function assertRouterActionRoute(
  miniProgram: any,
  actionId: string,
  actionSelector: string,
  actionMethod: string,
  expectedPath: string,
  expectedSource: string,
) {
  async function runStep<T>(label: string, task: () => Promise<T>) {
    try {
      return await task()
    }
    catch (error) {
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      throw new Error(`[router-assert:${actionId}:${label}] ${reason}`)
    }
  }

  async function readCurrentRouteDebug() {
    try {
      const currentPage = await miniProgram.currentPage()
      const currentPath = String(currentPage?.path ?? '').replace(/^\/+/, '')
      const currentWxml = currentPage ? await readPageWxml(currentPage) : ''
      return ` actual=${currentPath} wxml=${currentWxml.slice(0, 400)}`
    }
    catch {
      return ''
    }
  }

  const subPage = await runStep('enter-sub', () => enterRouterSubPage(miniProgram))
  const rendered = await runStep('wait-action-rendered', () => waitForRenderedSelector(subPage, actionSelector, 8_000))
  await runStep('clear-target-probe', () => miniProgram.callWxMethodWithOptions('removeStorageSync', {
    timeout: 2_500,
  }, ROUTER_TARGET_STORAGE_KEY).catch(() => {}))
  let targetProbe: any = null
  let navigatedPage: any = null
  async function checkNavigated() {
    targetProbe = await waitForRouterTarget(
      miniProgram,
      expectedPath,
      expectedSource,
      800,
    )
    if (targetProbe) {
      return true
    }
    navigatedPage = await waitForCurrentPagePath(
      miniProgram,
      expectedPath,
      800,
    )
    return Boolean(navigatedPage)
  }
  let invoked = false
  if (rendered) {
    invoked = await runStep('tap-action', () => tapControlUntil(subPage, actionSelector, checkNavigated)).catch(() => false)
  }
  if (!invoked) {
    const currentSubPage = await runStep('refresh-action-page', async () => {
      return await miniProgram.currentPage({
        retries: 2,
        timeout: 5_000,
      }).catch(() => subPage)
    })
    const methodResult = await runStep('call-action-fallback', () => currentSubPage.callMethod(actionMethod))
    if (methodResult !== true && methodResult?.ok !== true) {
      throw new Error(`[router-assert:${actionId}:call-failed] method=${actionMethod} result=${JSON.stringify(methodResult)} rendered=${rendered}`)
    }
    invoked = await checkNavigated()
  }
  if (!invoked) {
    throw new Error(`[router-assert:${actionId}:trigger-failed] selector=${actionSelector} method=${actionMethod} rendered=${rendered}`)
  }
  if (targetProbe) {
    expect(targetProbe.source).toBe(expectedSource)
    return
  }
  navigatedPage ??= await runStep('wait-action-route', () => waitForCurrentPagePath(
    miniProgram,
    expectedPath,
    ROUTER_NAVIGATION_SETTLE_TIMEOUT,
  ))

  if (!navigatedPage) {
    const debug = await readCurrentRouteDebug()
    throw new Error(`[router-assert:${actionId}:navigation-timeout] expected=${expectedPath.replace(/^\/+/, '')}${debug}`)
  }

  expect(navigatedPage.query?.source).toBe(expectedSource)
}

let routerMiniProgram: any = null

async function getRouterMiniProgram() {
  if (!routerMiniProgram) {
    routerMiniProgram = await launchIsolatedMiniProgram()
  }
  return routerMiniProgram
}

describe.sequential('e2e app: wevu-features / router', () => {
  afterAll(async () => {
    if (routerMiniProgram) {
      const miniProgram = routerMiniProgram
      routerMiniProgram = null
      await miniProgram.close()
    }
    await closeSharedMiniProgram()
  })

  it('covers advanced wevu/router showcase and dynamic pages', async () => {
    const miniProgram = await getRouterMiniProgram()

    const showcasePage = await relaunchPage(miniProgram, '/pages/router-showcase/index', 'wevu/router 能力展示 (showcase)')
    if (!showcasePage) {
      throw new Error('Failed to launch router-showcase page')
    }

    const showcaseResult = await showcasePage.callMethod('runE2E')
    expect(showcaseResult?.ok, JSON.stringify(showcaseResult)).toBe(true)
    expect(showcaseResult?.checks?.parseOk).toBe(true)
    expect(showcaseResult?.checks?.stringifyOk).toBe(true)
    expect(showcaseResult?.checks?.namedOk).toBe(true)
    expect(showcaseResult?.checks?.aliasOk).toBe(true)
    expect(showcaseResult?.checks?.relativeOk).toBe(true)
    expect(showcaseResult?.checks?.hashOnlyOk).toBe(true)
    expect(showcaseResult?.checks?.forwardOk).toBe(true)
    expect(showcaseResult?.checks?.goOk).toBe(true)
    expect(showcaseResult?.checks?.readyOk).toBe(true)
    expect(showcaseResult?.details?.namedRouteSummary).toContain('/pages/router-showcase/profile/12/detail/logs?from=named')
    expect(showcaseResult?.details?.aliasSummary).toContain('/router-profile/9/detail-alias/trace')
    expect(showcaseResult?.details?.runSummary).toBe('ok')

    const dynamicPage = await relaunchPage(miniProgram, '/pages/router-dynamic/index', 'wevu/router 能力展示 (dynamic + guards)')
    if (!dynamicPage) {
      throw new Error('Failed to launch router-dynamic page')
    }

    const dynamicResult = await dynamicPage.callMethod('runE2E')
    expect(dynamicResult?.ok, JSON.stringify(dynamicResult)).toBe(true)
    expect(dynamicResult?.checks?.baseRoutesOk).toBe(true)
    expect(dynamicResult?.checks?.addRemoveOk).toBe(true)
    expect(dynamicResult?.checks?.clearOk).toBe(true)
    expect(dynamicResult?.checks?.optionsOk).toBe(true)
    expect(dynamicResult?.checks?.guardOk).toBe(true)
    expect(dynamicResult?.checks?.errorOk).toBe(true)
    expect(dynamicResult?.details?.addRemoveSummary).toContain('/router-dynamic/parent/5/child/metrics?from=dynamic')
    expect(dynamicResult?.details?.clearSummary).toContain('->0')
    expect(dynamicResult?.details?.guardSummary).toContain('after=2')
    expect(dynamicResult?.details?.errorSummary).toContain('guard-fail-intentional')
    expect(dynamicResult?.details?.runSummary).toBe('ok')
  })

  it('resolves pageRouter.navigateTo relative route using page base path', async () => {
    const miniProgram = await getRouterMiniProgram()
    const indexPage = await relaunchPage(miniProgram, '/pages/router-stability/index', 'router stability (page context)')
    if (!indexPage) {
      throw new Error('Failed to launch router-stability index page')
    }
    await miniProgram.callWxMethodWithOptions('removeStorageSync', {
      timeout: 2_500,
    }, ROUTER_TARGET_STORAGE_KEY).catch(() => {})
    const invoked = await indexPage.callMethod('triggerPageRouterRelativeFromIndex')
    expect(invoked).toBe(true)
    const targetProbe = await waitForRouterTarget(
      miniProgram,
      '/pages/router-stability/target/index',
      'page-router-from-index',
    )
    if (targetProbe) {
      expect(targetProbe.source).toBe('page-router-from-index')
      return
    }
    const navigatedPage = await waitForCurrentPagePath(
      miniProgram,
      '/pages/router-stability/target/index',
      ROUTER_NAVIGATION_SETTLE_TIMEOUT,
    )
    if (!navigatedPage) {
      throw new Error('[router-assert:router-index-page-router:navigation-timeout] expected=pages/router-stability/target/index')
    }
    expect(navigatedPage.query?.source).toBe('page-router-from-index')
  })

  it('resolves component this.router.navigateTo relative route using component base path', async () => {
    const miniProgram = await getRouterMiniProgram()
    await assertRouterActionRoute(
      miniProgram,
      'cmp-router-nav',
      '#cmp-router-nav',
      'runComponentRouterFromProbe',
      '/components/router-origin-probe/target/index',
      'component-router',
    )
  })
})
