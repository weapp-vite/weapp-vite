import type { MiniProgram } from '@weapp-vite/miniprogram-automator'
import { ok as assert } from 'node:assert'
import process from 'node:process'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDomAcceptance } from '../utils/domAcceptance'
import {
  currentPage,
  DOCUMENT,
  expectCapturedBeforeUnload,
  expectListPosition,
  expectNativeRoutePhases,
  expectPagePosition,
  FEATURE_ROUTES,
  LIST,
  NATIVE,
  setListPosition,
  SKYLINE,
  snapshot,
  TAB,
  TAB_PEER,
} from './feature1087.shared'
import {
  APP_ROOT,
  closeSharedMiniProgram,
  DIST_ROOT,
  getSharedMiniProgram,
  PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT,
  prepareGithubIssuesBuild,
  relaunchPage,
  releaseSharedMiniProgram,
} from './github-issues.runtime.shared'

describe('e2e app: github-issues / feature #1087 scroll restoration', { concurrent: false }, () => {
  let miniProgram: MiniProgram

  beforeAll(async () => {
    await prepareGithubIssuesBuild()
    const app = await fs.readJSON(path.join(DIST_ROOT, 'app.json')) as {
      pages: string[]
      tabBar: { list: { pagePath: string }[] }
    }
    expect(app.pages.filter(route => route.startsWith('pages/feature-1087/')).sort())
      .toEqual(FEATURE_ROUTES.map(route => route.slice(1)).sort())
    expect(app.tabBar.list.map(tab => tab.pagePath)).toEqual([TAB.slice(1), TAB_PEER.slice(1)])
    for (const route of app.pages) {
      for (const extension of ['js', 'json', 'wxml']) {
        expect(await fs.pathExists(path.join(DIST_ROOT, `${route}.${extension}`)), `${route}.${extension}`).toBe(true)
      }
    }
    // 仅修改本 suite 的隔离项目配置；AppID、SDK 和其他 fixture 设置保持不变。
    const configPath = path.join(APP_ROOT, 'project.private.config.json')
    const config = await fs.readJSON(configPath) as { setting: Record<string, unknown> }
    config.setting.skylineRenderEnable = true
    await fs.writeJSON(configPath, config, { spaces: 2 })
    miniProgram = await getSharedMiniProgram()
  }, PREPARE_GITHUB_ISSUES_BUILD_TIMEOUT)

  beforeEach(async () => {
    const native = await relaunchPage(miniProgram, NATIVE, undefined, 30_000, { forceRelaunch: true })
    assert(native)
    await native.callMethod('_reset')
  }, 45_000)

  afterEach(async () => {
    await releaseSharedMiniProgram(miniProgram)
  })

  afterAll(async () => {
    await closeSharedMiniProgram()
  }, 30_000)

  it('reports native route capabilities and restores WebView page coordinates after native destruction', async (ctx) => {
    await miniProgram.navigateTo(DOCUMENT)
    const page = await currentPage(miniProgram, DOCUMENT)
    const initial = await snapshot(page)
    process.stdout.write(`[feature1087 native capability] ${JSON.stringify({
      SDKVersion: initial.SDKVersion,
      platform: initial.platform,
      renderer: initial.renderer,
      apis: initial.apis,
      automatic: initial.automatic,
    })}\n`)
    expect(initial.automatic, 'Native SDK >=3.5.5 and all four on/off route API pairs are required').toBe(true)
    expect(Object.values(initial.apis)).toEqual(Array.from({ length: 8 }).fill('function'))
    expect(initial.renderer).toBe('webview')
    await page.callMethodWithOptions('_setPosition', { routeOnly: true }, 720)
    await expectPagePosition(page, 720)
    // 直接调用宿主导航，不经过 router.push/replace，也不在 Promise 回调里手动 capture。
    await miniProgram.callWxMethod('redirectTo', { url: NATIVE })
    const native = await currentPage(miniProgram, NATIVE)
    const left = await snapshot(native)
    expectCapturedBeforeUnload(left.records, initial.instance)
    expectNativeRoutePhases(left.records, NATIVE, 'redirectTo')
    await miniProgram.reLaunch(DOCUMENT)
    const recreated = await currentPage(miniProgram, DOCUMENT)
    await expectPagePosition(recreated, 720)
    const restored = await snapshot(recreated)
    expect(restored.instance).not.toBe(initial.instance)
    expect(restored.records).toContainEqual(expect.objectContaining({ instance: restored.instance, phase: 'restore:applied', ready: true }))
    expectNativeRoutePhases(restored.records, DOCUMENT, 'reLaunch')
    expect(restored.errors).toEqual([])
    await recreated.callMethodWithOptions('_setPosition', { routeOnly: true }, 120)
    await expectPagePosition(recreated, 120)
    expect(await recreated.callMethodWithOptions('_restore', { routeOnly: true })).toBe(true)
    await expectPagePosition(recreated, 720)
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'restored-page',
      route: DOCUMENT,
      action: '原生 redirectTo 销毁后 reLaunch 恢复真实页面滚动位置',
      nodes: [{ selector: '#feature1087-page text', text: 'WebView document scrolling' }],
    }])
    await dom.check('restored-page', miniProgram, recreated)
  })

  it('isolates both axes and container ids by query and restores only after recreated content renders', async (ctx) => {
    const feedA = `${LIST}?feed=a`
    const feedB = `${LIST}?feed=b`
    await miniProgram.reLaunch(feedA)
    const first = await currentPage(miniProgram, LIST)
    const old = await snapshot(first)
    await setListPosition(first, 420, 80, 610)
    await miniProgram.reLaunch(feedB)
    const second = await currentPage(miniProgram, LIST)
    await expectListPosition(second, 0, 0, 0)
    await setListPosition(second, 180, 35, 250)
    await miniProgram.reLaunch(feedA)
    const recreated = await currentPage(miniProgram, LIST)
    await expectListPosition(recreated, 420, 80, 610)
    const state = await snapshot(recreated)
    expect(state.instance).not.toBe(old.instance)
    expectCapturedBeforeUnload(state.records, old.instance, 420)
    expect(state.records).toContainEqual(expect.objectContaining({ instance: state.instance, phase: 'restore:applied', ready: true, contentReady: true }))
    await recreated.callMethod('_invalidate', 'clearPrimary')
    await recreated.callMethod('_invalidate', 'stopPrimary')
    await miniProgram.reLaunch(feedB)
    await expectListPosition(await currentPage(miniProgram, LIST), 180, 35, 250)
    await miniProgram.reLaunch(feedA)
    await expectListPosition(await currentPage(miniProgram, LIST), 0, 0, 610)
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'isolated',
      route: LIST,
      action: '只清除 primary 容器，保留同查询的 secondary 与业务快照',
      nodes: [{ selector: '#feature1087-marker', text: 'saved:420:80:610' }],
    }])
    await dom.check('isolated', miniProgram, await currentPage(miniProgram, LIST))
  })

  it('restores actual Skyline scroll-view coordinates without using page scrolling', async (ctx) => {
    await miniProgram.reLaunch(SKYLINE)
    const first = await currentPage(miniProgram, SKYLINE)
    const probe = await snapshot(first)
    process.stdout.write(`[feature1087 Skyline capability] ${JSON.stringify({ SDKVersion: probe.SDKVersion, renderer: probe.renderer, apis: probe.apis })}\n`)
    expect(probe.renderer, 'Skyline must really be selected; a WebView fallback is not acceptance').toBe('skyline')
    expect(probe.automatic).toBe(true)
    await setListPosition(first, 350, 0, 570)
    await miniProgram.reLaunch(NATIVE)
    await miniProgram.reLaunch(SKYLINE)
    const restored = await currentPage(miniProgram, SKYLINE)
    await expectListPosition(restored, 350, 0, 570)
    expect((await snapshot(restored)).errors).toEqual([])
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'skyline',
      route: SKYLINE,
      action: 'Skyline 重新创建后恢复实际列表坐标',
      nodes: [{ selector: '#feature1087-marker', text: 'saved:350:0:570' }],
    }])
    await dom.check('skyline', miniProgram, restored)
  })

  it('does not replay stale snapshots onto retained pages when navigating back', async (ctx) => {
    await miniProgram.reLaunch(LIST)
    const retained = await currentPage(miniProgram, LIST)
    await setListPosition(retained, 240, 40, 380)
    const before = await snapshot(retained)
    const restores = before.records.filter(record => record.instance === before.instance && record.phase === 'restore:applied')
    await retained.callMethod('_deferPosition', 500, 60, 700)
    await miniProgram.navigateTo(NATIVE)
    // 业务异步结果在隐藏期间完成，不通过栈顶限定的 Page 协议调用隐藏实例。
    await (await currentPage(miniProgram, NATIVE)).callMethod('_release')
    await miniProgram.navigateBack()
    const back = await currentPage(miniProgram, LIST)
    await expectListPosition(back, 500, 60, 700)
    const after = await snapshot(back)
    expect(after.instance).toBe(before.instance)
    expect(after.records.filter(record => record.instance === before.instance && record.phase === 'restore:applied')).toEqual(restores)
    expect(after.records.some(record => record.instance === before.instance && record.phase === 'unload')).toBe(false)
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'retained',
      route: LIST,
      action: '返回保留页面，较新的业务内容未被旧快照覆盖',
      nodes: [{ selector: '#feature1087-marker', text: 'saved:500:60:700' }],
    }])
    await dom.check('retained', miniProgram, back)
  })

  it('does not replay a cached tab snapshot over newer retained tab content', async (ctx) => {
    await miniProgram.switchTab(TAB)
    const retained = await currentPage(miniProgram, TAB)
    await setListPosition(retained, 290, 45, 440)
    const before = await snapshot(retained)
    const restores = before.records.filter(record => record.instance === before.instance && record.phase === 'restore:applied')
    await retained.callMethod('_deferPosition', 620, 75, 810)
    await miniProgram.switchTab(TAB_PEER)
    await (await currentPage(miniProgram, TAB_PEER)).callMethod('_release')
    await miniProgram.switchTab(TAB)
    const back = await currentPage(miniProgram, TAB)
    await expectListPosition(back, 620, 75, 810)
    const after = await snapshot(back)
    expect(after.instance).toBe(before.instance)
    expect(after.records.filter(record => record.instance === before.instance && record.phase === 'restore:applied')).toEqual(restores)
    expectNativeRoutePhases(after.records, TAB, 'switchTab')
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'retained-tab',
      route: TAB,
      action: '切换回来时保留 tab 的较新业务状态',
      nodes: [{ selector: '#feature1087-marker', text: 'saved:620:75:810' }],
    }])
    await dom.check('retained-tab', miniProgram, back)
  })

  it('waits for explicit business content readiness and supports repeated manual restoration', async (ctx) => {
    const route = `${LIST}?manual=1`
    await miniProgram.reLaunch(route)
    const first = await currentPage(miniProgram, LIST)
    await first.callMethodWithOptions('_loadContent', { routeOnly: true })
    await setListPosition(first, 480, 90, 660)
    await miniProgram.reLaunch(NATIVE)
    await miniProgram.reLaunch(route)
    const recreated = await currentPage(miniProgram, LIST)
    const initial = await snapshot(recreated)
    expect(initial.contentReady).toBe(false)
    expect(initial.records.some(record => record.instance === initial.instance && record.phase === 'restore:applied')).toBe(false)
    expect(await recreated.$('#feature1087-content')).toBeNull()
    await recreated.callMethodWithOptions('_loadContent', { routeOnly: true })
    expect(await recreated.callMethodWithOptions('_restore', { routeOnly: true })).toEqual([true, true, true])
    await expectListPosition(recreated, 480, 90, 660)
    await setListPosition(recreated, 110, 20, 130)
    expect(await recreated.callMethodWithOptions('_restore', { routeOnly: true })).toEqual([true, true, true])
    await expectListPosition(recreated, 480, 90, 660)
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'manual-content',
      route: LIST,
      action: '业务完成内容加载后显式恢复两容器坐标及自定义快照',
      nodes: [{ selector: '#feature1087-marker', text: 'saved:480:90:660' }, { selector: '#feature1087-content', count: 1 }],
    }])
    await dom.check('manual-content', miniProgram, recreated)
  })

  it('does not capture rejected navigation and captures only the accepted guard redirect', async (ctx) => {
    const source = `${LIST}?feed=guard-source`
    await miniProgram.reLaunch(source)
    const page = await currentPage(miniProgram, LIST)
    await setListPosition(page, 390, 65, 520)
    const initial = await snapshot(page)
    await page.callMethod('_navigate', `${LIST}?guard=abort`)
    await expect.poll(async () => (await snapshot(page)).navigation.settled).toBe(true)
    const aborted = await snapshot(page)
    expect(aborted.navigation.failed).toBe(true)
    expect(aborted.instance).toBe(initial.instance)
    expect(aborted.records.some(record => record.instance === initial.instance && record.phase === 'capture')).toBe(false)
    await expectListPosition(page, 390, 65, 520)
    await page.callMethod('_navigate', `${LIST}?guard=redirect`)
    await expect.poll(async () => {
      const target = await currentPage(miniProgram, LIST)
      return (await snapshot(target)).navigation
    }).toMatchObject({ settled: true, path: '/pages/feature-1087/index?feed=redirected' })
    const redirected = await currentPage(miniProgram, LIST)
    await expectListPosition(redirected, 0, 0, 0)
    const accepted = await snapshot(redirected)
    expect(accepted.instance).not.toBe(initial.instance)
    expect(accepted.records.filter(record => record.instance === initial.instance && record.phase === 'capture')).toHaveLength(1)
    expect(accepted.records).toContainEqual(expect.objectContaining({ phase: 'guard:abort' }))
    expect(accepted.records).toContainEqual(expect.objectContaining({ phase: 'guard:redirect' }))
    await miniProgram.reLaunch(source)
    const restored = await currentPage(miniProgram, LIST)
    await expectListPosition(restored, 390, 65, 520)
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'guarded',
      route: LIST,
      action: '取消导航不采集，接受重定向后才能保存并恢复源页面',
      nodes: [{ selector: '#feature1087-marker', text: 'saved:390:65:520' }],
    }])
    await dom.check('guarded', miniProgram, restored)
  })

  async function pendingRestore() {
    const route = `${LIST}?manual=1`
    await miniProgram.reLaunch(route)
    const seed = await currentPage(miniProgram, LIST)
    await seed.callMethodWithOptions('_loadContent', { routeOnly: true })
    await setListPosition(seed, 420, 80, 610)
    await miniProgram.reLaunch(NATIVE)
    await miniProgram.reLaunch(route)
    const page = await currentPage(miniProgram, LIST)
    await page.callMethodWithOptions('_loadContent', { routeOnly: true })
    await page.callMethod('_beginDeferredRestore')
    const { instance } = await snapshot(page)
    await expect.poll(async () => (await snapshot(page)).records.some(record => record.instance === instance && record.phase === 'restore:start')).toBe(true)
    return { page, instance }
  }

  it('clears one route key without discarding another and releases destroyed registrations across repeated visits', async (ctx) => {
    const feedA = `${LIST}?feed=clear-a`
    const feedB = `${LIST}?feed=clear-b`
    const instances: number[] = []
    let firstKey = ''
    for (const route of [feedA, feedB, `${LIST}?feed=clear-c`]) {
      await miniProgram.reLaunch(route)
      const page = await currentPage(miniProgram, LIST)
      const state = await snapshot(page)
      instances.push(state.instance)
      if (route === feedA) {
        firstKey = state.path
      }
      await setListPosition(page, 360, 55, 490)
      await miniProgram.reLaunch(NATIVE)
    }
    const hub = await currentPage(miniProgram, NATIVE)
    const records = (await snapshot(hub)).records
    for (const instance of instances) {
      expect(records.filter(record => record.instance === instance && record.phase === 'capture')).toHaveLength(1)
      expect(records.filter(record => record.instance === instance && record.phase === 'unload')).toHaveLength(1)
    }
    await hub.callMethod('_clear', firstKey)
    await miniProgram.reLaunch(feedA)
    await expectListPosition(await currentPage(miniProgram, LIST), 0, 0, 0)
    await miniProgram.reLaunch(feedB)
    await expectListPosition(await currentPage(miniProgram, LIST), 360, 55, 490)
    await miniProgram.reLaunch(NATIVE)
    const reset = await currentPage(miniProgram, NATIVE)
    await reset.callMethod('_clear')
    await miniProgram.reLaunch(feedB)
    await expectListPosition(await currentPage(miniProgram, LIST), 0, 0, 0)
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'cleared',
      route: LIST,
      action: '清除全部快照后，重新创建的列表保持初始业务状态',
      nodes: [{ selector: '#feature1087-marker', text: 'fresh' }],
    }])
    await dom.check('cleared', miniProgram, await currentPage(miniProgram, LIST))
  })

  it('cancels a deferred custom restore when its page is destroyed before content completion', async (ctx) => {
    const { instance } = await pendingRestore()
    await miniProgram.reLaunch(NATIVE)
    const hub = await currentPage(miniProgram, NATIVE)
    await hub.callMethod('_release')
    await expect.poll(async () => (await snapshot(hub)).records.filter(record => record.instance === instance && record.phase.startsWith('restore:')).map(record => record.phase))
      .toEqual(['restore:start', 'restore:stale'])
    expect((await snapshot(hub)).records).toContainEqual(expect.objectContaining({ instance, phase: 'scroll:false' }))
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'destroyed',
      route: NATIVE,
      action: '旧异步恢复完成后仍保持原生目标页',
      nodes: [{ selector: '#feature1087-native', text: 'Native navigation and controller lifetime probe' }],
    }])
    await dom.check('destroyed', miniProgram, hub)
  })

  it('stops a registration while its async restore is pending without applying the old snapshot', async (ctx) => {
    const { page, instance } = await pendingRestore()
    await page.callMethod('_invalidate', 'stopBusiness')
    await page.callMethod('_release')
    await expect.poll(async () => (await snapshot(page)).records.some(record => record.instance === instance && record.phase === 'scroll:false')).toBe(true)
    expect((await snapshot(page)).marker).toBe('waiting')
    expect(await page.callMethodWithOptions('_restore', { routeOnly: true })).toEqual([true, true, false])
    await expectListPosition(page, 420, 80, 610)
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'stopped',
      route: LIST,
      action: '停止业务注册，保留独立滚动容器的显式恢复能力',
      nodes: [{ selector: '#feature1087-marker', text: 'waiting' }],
    }])
    await dom.check('stopped', miniProgram, page)
  })

  it('invalidates a pending restore on clear without preventing independent container restores', async (ctx) => {
    const { page, instance } = await pendingRestore()
    await page.callMethod('_invalidate', 'clearBusiness')
    await page.callMethod('_release')
    await expect.poll(async () => (await snapshot(page)).records.some(record => record.instance === instance && record.phase === 'scroll:false')).toBe(true)
    expect((await snapshot(page)).marker).toBe('waiting')
    expect(await page.callMethodWithOptions('_restore', { routeOnly: true }, true)).toEqual([true, true])
    await expectListPosition(page, 420, 80, 610)
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'invalidated',
      route: LIST,
      action: '清除业务快照使旧恢复失效，其他容器仍可恢复',
      nodes: [{ selector: '#feature1087-marker', text: 'waiting' }],
    }])
    await dom.check('invalidated', miniProgram, page)
  })

  it('disposes the controller with pending work and prevents later route capture or scroll side effects', async (ctx) => {
    const { page, instance } = await pendingRestore()
    await page.callMethod('_invalidate', 'dispose')
    await page.callMethod('_release')
    await expect.poll(async () => (await snapshot(page)).records.some(record => record.instance === instance && record.phase === 'scroll:false')).toBe(true)
    expect((await snapshot(page)).marker).toBe('waiting')
    expect(await page.callMethodWithOptions('_restore', { routeOnly: true })).toEqual([false, false, false])
    await expectListPosition(page, 0, 0, 0)
    const dom = createDomAcceptance(ctx, 'e2e-apps/github-issues', [{
      id: 'disposed',
      route: LIST,
      action: '释放 controller 后没有迟到的业务状态或滚动写入',
      nodes: [{ selector: '#feature1087-marker', text: 'waiting' }],
    }])
    await dom.check('disposed', miniProgram, page)
    await miniProgram.reLaunch(NATIVE)
    const hub = await currentPage(miniProgram, NATIVE)
    const state = await snapshot(hub)
    expect(state.records.some(record => record.instance === instance && record.phase === 'capture')).toBe(false)
    expect(state.errors).toEqual([])
  })
})
