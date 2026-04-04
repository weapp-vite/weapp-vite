import { afterAll, describe, expect, it } from 'vitest'
import {
  closeSharedMiniProgram,
  launchIsolatedMiniProgram,
  readPageWxml,
  relaunchPage,
  resolveSelectorById,
  ROUTER_NAVIGATION_SETTLE_TIMEOUT,
  tapControlUntil,
  waitForCurrentPagePath,
  waitForRouteWithMarker,
} from './wevu-features.runtime.shared'

async function enterRouterSubPage(miniProgram: any) {
  const indexPage = await relaunchPage(miniProgram, '/pages/router-stability/index', 'router stability (page context)')
  if (!indexPage) {
    throw new Error('Failed to launch router-stability index page')
  }

  const openSubSelector = await resolveSelectorById(indexPage, 'router-open-sub')
  const opened = await tapControlUntil(indexPage, openSubSelector, async () => {
    const currentPage = await waitForCurrentPagePath(
      miniProgram,
      '/pages/router-stability/sub/index',
      ROUTER_NAVIGATION_SETTLE_TIMEOUT,
    )
    return Boolean(currentPage)
  })
  if (!opened) {
    throw new Error('Failed to enter router-stability sub page from index page')
  }

  const subPage = await waitForRouteWithMarker(miniProgram, '/pages/router-stability/sub/index', 'router stability (sub page)')
  if (!subPage) {
    throw new Error('Failed to confirm router-stability sub page readiness')
  }
  return subPage
}

async function assertRouterActionRoute(
  miniProgram: any,
  actionId: string,
  expectedPath: string,
  markerText: string,
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

  const subPage = await runStep('enter-sub', () => enterRouterSubPage(miniProgram))
  const selector = await runStep('resolve-action-selector', () => resolveSelectorById(subPage, actionId))
  await runStep('tap-action', () => tapControlUntil(subPage, selector, async () => {
    const currentPage = await waitForCurrentPagePath(
      miniProgram,
      expectedPath,
      ROUTER_NAVIGATION_SETTLE_TIMEOUT,
    )
    return Boolean(currentPage)
  }))

  const targetPage = await runStep('wait-target-page', () => waitForRouteWithMarker(miniProgram, expectedPath, markerText))
  if (!targetPage) {
    let currentPath = ''
    let currentWxml = ''
    try {
      const currentPage = await miniProgram.currentPage()
      currentPath = String(currentPage?.path ?? '').replace(/^\/+/, '')
      if (currentPage) {
        currentWxml = await readPageWxml(currentPage)
      }
    }
    catch {
    }
    throw new Error(`[router-assert:${actionId}:route-miss] expected=${expectedPath.replace(/^\/+/, '')} actual=${currentPath} wxml=${currentWxml.slice(0, 400)}`)
  }
  expect(targetPage).toBeTruthy()
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

    const showcaseBeforeWxml = await readPageWxml(showcasePage)
    expect(showcaseBeforeWxml).toContain('parse summary = pending')
    expect(showcaseBeforeWxml).toContain('named summary = pending')
    expect(showcaseBeforeWxml).toContain('run summary = idle')

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

    const showcaseAfterWxml = await readPageWxml(showcasePage)
    expect(showcaseAfterWxml).toContain('hash-only summary = aborted')
    expect(showcaseAfterWxml).toContain('forward summary = aborted')
    expect(showcaseAfterWxml).toContain('go summary = noop')
    expect(showcaseAfterWxml).toContain('ready summary = ready')
    expect(showcaseAfterWxml).toContain('run summary = ok')

    const dynamicPage = await relaunchPage(miniProgram, '/pages/router-dynamic/index', 'wevu/router 能力展示 (dynamic + guards)')
    if (!dynamicPage) {
      throw new Error('Failed to launch router-dynamic page')
    }

    const dynamicBeforeWxml = await readPageWxml(dynamicPage)
    expect(dynamicBeforeWxml).toContain('base routes = pending')
    expect(dynamicBeforeWxml).toContain('guard summary = pending')
    expect(dynamicBeforeWxml).toContain('run summary = idle')

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

    const dynamicAfterWxml = await readPageWxml(dynamicPage)
    expect(dynamicAfterWxml).toContain('clear summary = ')
    expect(dynamicAfterWxml).toContain('-&gt;0')
    expect(dynamicAfterWxml).toContain('guard summary = block-ok|error-ok|after=2')
    expect(dynamicAfterWxml).toContain('error summary = guard-fail-intentional')
    expect(dynamicAfterWxml).toContain('run summary = ok')
  })

  it('resolves previous-page pageRouter.navigateTo relative route using original page base path', async () => {
    const miniProgram = await getRouterMiniProgram()
    await assertRouterActionRoute(
      miniProgram,
      'router-sub-call-prev-page-router',
      '/pages/router-stability/target/index',
      'route=pages/router-stability/target/index source=page-router-from-index',
    )
  })

  it('resolves component this.router.navigateTo relative route using component base path', async () => {
    const miniProgram = await getRouterMiniProgram()
    await assertRouterActionRoute(
      miniProgram,
      'router-sub-call-component-router',
      '/components/router-origin-probe/target/index',
      'route=components/router-origin-probe/target/index source=component-router',
    )
  })
})
