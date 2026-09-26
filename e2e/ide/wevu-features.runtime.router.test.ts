import { afterAll, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  callRoutePageMethod,
  closeSharedMiniProgram,
  launchIsolatedMiniProgram,
  ROUTER_NAVIGATION_SETTLE_TIMEOUT,
  waitForCurrentPagePath,
} from './wevu-features.runtime.shared'
import {
  DYNAMIC_ROUTE,
  dynamicNodes,
  ROUTER_COMPONENT_TARGET,
  ROUTER_INDEX_ROUTE,
  ROUTER_PAGE_TARGET,
  ROUTER_SUB_ROUTE,
  routerCheckpoint,
  routerIndexNodes,
  routerSubNodes,
  routerTargetNodes,
  SHOWCASE_ROUTE,
  showcaseNodes,
} from './wevuFeaturesDom/router'

const ROUTER_SUB_READY_STORAGE_KEY = '__weapp_vite_router_sub_ready__'
const ROUTER_TARGET_STORAGE_KEY = '__weapp_vite_router_target__'

async function waitForRouterSubReady(miniProgram: any, timeoutMs = 6_000) {
  const start = Date.now()
  let latest: any = null
  while (Date.now() - start <= timeoutMs) {
    latest = await miniProgram.callWxMethodWithOptions('getStorageSync', {
      timeout: 2_500,
    }, ROUTER_SUB_READY_STORAGE_KEY)
    if (latest?.route === 'pages/router-stability/sub/index' && latest?.componentReady === true) {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 220))
  }
  throw new Error(`Failed to confirm router-stability sub page ready: ${JSON.stringify(latest)}`)
}

async function waitForPage(miniProgram: any, route: string) {
  const page = await waitForCurrentPagePath(miniProgram, route, ROUTER_NAVIGATION_SETTLE_TIMEOUT)
  expect(page, `Navigation did not reach ${route}`).toBeTruthy()
  return page
}

async function assertTargetSource(miniProgram: any, page: any, route: string, source: string) {
  expect(page.query?.source).toBe(source)
  const probe = await miniProgram.callWxMethodWithOptions('getStorageSync', {
    timeout: 2_500,
  }, ROUTER_TARGET_STORAGE_KEY)
  expect(probe).toMatchObject({ route: route.slice(1), source })
}

async function clearProbe(miniProgram: any, key: string) {
  await miniProgram.callWxMethodWithOptions('removeStorageSync', { timeout: 2_500 }, key)
}

let routerMiniProgram: any = null

async function getRouterMiniProgram() {
  if (!routerMiniProgram) {
    // 原生 Router 上下文不能沿用其他 suite 的导航历史；本 suite 冷启动一次，后续页面复用会话。
    routerMiniProgram = await launchIsolatedMiniProgram()
  }
  return routerMiniProgram
}

describe('e2e app: wevu-features / router', { concurrent: false }, () => {
  afterAll(async () => {
    if (routerMiniProgram) {
      const miniProgram = routerMiniProgram
      routerMiniProgram = null
      await miniProgram.close()
    }
    await closeSharedMiniProgram()
  })

  it('resolves component this.router.navigateTo relative route using component base path', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/wevu-features', [
      routerCheckpoint('index', ROUTER_INDEX_ROUTE, '首屏显示进入 sub 页的操作', routerIndexNodes),
      routerCheckpoint('sub', ROUTER_SUB_ROUTE, '进入 sub 页并渲染 RouterOriginProbe 组件', routerSubNodes),
      routerCheckpoint('component-target', ROUTER_COMPONENT_TARGET, '组件相对导航后渲染组件目录目标路径和来源', routerTargetNodes('component')),
    ])
    const miniProgram = await getRouterMiniProgram()
    const indexPage = await miniProgram.reLaunch(ROUTER_INDEX_ROUTE)
    await acceptance.check('index', miniProgram, indexPage)
    await clearProbe(miniProgram, ROUTER_SUB_READY_STORAGE_KEY)
    await callRoutePageMethod(miniProgram, indexPage, ROUTER_INDEX_ROUTE, '_openSubPage')
    const subPage = await waitForPage(miniProgram, ROUTER_SUB_ROUTE)
    await acceptance.check('sub', miniProgram, subPage)
    await waitForRouterSubReady(miniProgram)
    await clearProbe(miniProgram, ROUTER_TARGET_STORAGE_KEY)
    const invoked = await callRoutePageMethod(miniProgram, subPage, ROUTER_SUB_ROUTE, '_runComponentRouterFromProbe')
    expect(invoked).toBe(true)
    const targetPage = await waitForPage(miniProgram, ROUTER_COMPONENT_TARGET)
    await acceptance.check('component-target', miniProgram, targetPage)
    await assertTargetSource(miniProgram, targetPage, ROUTER_COMPONENT_TARGET, 'component-router')
  })

  it('resolves pageRouter.navigateTo relative route using page base path', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/wevu-features', [
      routerCheckpoint('index', ROUTER_INDEX_ROUTE, '首屏显示 pageRouter 相对导航操作', routerIndexNodes),
      routerCheckpoint('page-target', ROUTER_PAGE_TARGET, '相对导航后渲染页面目录目标路径和来源', routerTargetNodes('page')),
    ])
    const miniProgram = await getRouterMiniProgram()
    const indexPage = await miniProgram.reLaunch(ROUTER_INDEX_ROUTE)
    await acceptance.check('index', miniProgram, indexPage)
    await clearProbe(miniProgram, ROUTER_TARGET_STORAGE_KEY)
    const invoked = await callRoutePageMethod(miniProgram, indexPage, ROUTER_INDEX_ROUTE, 'triggerPageRouterRelativeFromIndex')
    expect(invoked).toBe(true)
    const targetPage = await waitForPage(miniProgram, ROUTER_PAGE_TARGET)
    await acceptance.check('page-target', miniProgram, targetPage)
    await assertTargetSource(miniProgram, targetPage, ROUTER_PAGE_TARGET, 'page-router-from-index')
  })

  it('renders router query, resolved paths and aborted navigation results', async (context) => {
    const acceptance = createDomAcceptance(context, 'e2e-apps/wevu-features', [
      routerCheckpoint('initial', SHOWCASE_ROUTE, '首屏展示未执行的 router showcase 结果', showcaseNodes(false)),
      routerCheckpoint('resolved', SHOWCASE_ROUTE, '执行 query、路由解析和不支持的导航后渲染每项结果', showcaseNodes(true)),
    ])
    const miniProgram = await getRouterMiniProgram()
    const page = await miniProgram.reLaunch(SHOWCASE_ROUTE)
    await acceptance.check('initial', miniProgram, page)
    const result = await callRoutePageMethod(miniProgram, page, SHOWCASE_ROUTE, 'runE2E')
    expect(result?.ok, JSON.stringify(result)).toBe(true)
    expect(result.checks).toEqual({
      parseOk: true,
      stringifyOk: true,
      namedOk: true,
      aliasOk: true,
      relativeOk: true,
      hashOnlyOk: true,
      forwardOk: true,
      goOk: true,
      readyOk: true,
    })
    expect(result.details.namedRouteSummary).toContain('/pages/router-showcase/profile/12/detail/logs?from=named')
    expect(result.details.aliasSummary).toContain('/router-profile/9/detail-alias/trace')
    expect(result.details.runSummary).toBe('ok')
    await acceptance.check('resolved', miniProgram, page)
  })

  it('renders dynamic route removal, options snapshot and guard failure results', async (context) => {
    // clearRoutes 改变应用级 router，放在 suite 最后，避免污染其他导航场景。
    const acceptance = createDomAcceptance(context, 'e2e-apps/wevu-features', [
      routerCheckpoint('initial', DYNAMIC_ROUTE, '首屏展示未执行的 dynamic router 结果', dynamicNodes(false)),
      routerCheckpoint('completed', DYNAMIC_ROUTE, '动态路由增删和 guard 失败后渲染路径、计数及错误', dynamicNodes(true)),
    ])
    const miniProgram = await getRouterMiniProgram()
    const page = await miniProgram.reLaunch(DYNAMIC_ROUTE)
    await acceptance.check('initial', miniProgram, page)
    const result = await callRoutePageMethod(miniProgram, page, DYNAMIC_ROUTE, 'runE2E')
    expect(result?.ok, JSON.stringify(result)).toBe(true)
    expect(result.checks).toEqual({
      baseRoutesOk: true,
      addRemoveOk: true,
      clearOk: true,
      optionsOk: true,
      guardOk: true,
      errorOk: true,
    })
    expect(result.details.addRemoveSummary).toContain('/router-dynamic/parent/5/child/metrics?from=dynamic')
    expect(result.details.clearSummary).toContain('->0')
    expect(result.details.guardSummary).toContain('after=2')
    expect(result.details.errorSummary).toContain('guard-fail-intentional')
    expect(result.details.runSummary).toBe('ok')
    await acceptance.check('completed', miniProgram, page)
  })
})
